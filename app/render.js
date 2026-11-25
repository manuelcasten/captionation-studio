// =====================================================================
//  Captionation Studio · motor de render (canvas 2D)
//  Lo usan la vista previa y la exportación: lo que ves es lo que sale.
//  Reglas copiadas de la plantilla de After Effects del panel Captionation
//  (renglones equilibrados, interlineado fijo de "Resalte al centro",
//  animaciones de entrada por palabra, caja de karaoke, sombra, glow, fondo).
// =====================================================================
(function (root) {
  'use strict';

  const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(String(h).substr(i, 2), 16) || 0);
  const rgba = (h, a) => { const c = hexRGB(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const FAM_REG = '"capReg", "Segoe UI", sans-serif', FAM_BOLD = '"capBold", "Segoe UI", sans-serif';

  // valores efectivos (zona segura TikTok/Reels en 9:16, área de acción en 16:9)
  function resolve(style, W, H) {
    const v = Object.assign({}, style);
    const vert = H > W;
    if (vert) {
      if (v.safeZone) { v.posY = clamp(v.posY, 16, 70); v.posX = clamp(v.posX, 12, 46); v.cpl = Math.min(v.cpl, 18); }
    } else { v.posY = clamp(v.posY, 8, 88); v.posX = clamp(v.posX, 8, 92); }
    return v;
  }

  // "Resalte al centro": solo UNA palabra resaltada (la más larga de las marcadas)
  function oneBold(toks, dis) {
    if (dis === 1) return toks;
    const L = (w) => w.replace(/[^0-9a-záéíóúüñ]/gi, '').length;
    let best = -1;
    toks.forEach((t, i) => { if (t.b && (best < 0 || L(t.w) >= L(toks[best].w))) best = i; });
    if (best < 0) toks.forEach((t, i) => { if (L(t.w) && (best < 0 || L(t.w) > L(toks[best].w))) best = i; });
    return best < 0 ? toks : toks.map((t, i) => ({ w: t.w, b: i === best }));
  }

  // cortes equilibrados (misma regla que la plantilla)
  function balLines(ws, wts, maxC, maxL) {
    const n0 = ws.length, cum = []; let tot = 0;
    for (let i = 0; i < n0; i++) { cum.push(tot); tot += wts[i] + (i < n0 - 1 ? 1 : 0); }
    if (n0 < 2 || tot <= maxC * 1.15) return [ws];
    const n = Math.min(maxL || 3, Math.ceil(tot / (maxC * 1.1))), cuts = []; let prev = 0;
    for (let r = 1; r < n; r++) {
      const goal = tot * r / n; let bj = -1, bd = 1e9;
      for (let i = prev + 1; i < n0; i++) {
        let d = Math.abs(cum[i] - goal);
        if (ws[i - 1].w.length <= 3) d += tot / n * 0.35;
        if (r === n - 1 && i === n0 - 1 && ws[i].w.length <= 4) d += tot;
        if (d < bd) { bd = d; bj = i; }
      }
      if (bj < 0) break;
      cuts.push(bj); prev = bj;
    }
    const out = []; let s = 0;
    cuts.concat([n0]).forEach((c) => { out.push(ws.slice(s, c)); s = c; });
    return out;
  }

  // inicio de cada palabra (segundos desde el inicio del subtítulo)
  function wordTimes(sub) {
    const t = sub.tokens;
    if (sub.wordStarts && sub.wordStarts.length === t.length) return sub.wordStarts;
    const dur = Math.max(0.1, (sub.end - sub.start) / 1000);
    const weights = t.map((x) => x.w.length + 2), total = weights.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return weights.map((w) => { const v = dur * 0.9 * acc / total; acc += w; return v; });
  }

  // ---------- maquetación (se calcula una vez por subtítulo y estilo) ----------
  const cache = new WeakMap();
  let fontEpoch = 0;
  function fontsChanged() { fontEpoch++; }

  function setFont(ctx, bold, sz, track) {
    ctx.font = sz.toFixed(2) + 'px ' + (bold ? FAM_BOLD : FAM_REG);
    try { ctx.letterSpacing = (track / 1000 * sz).toFixed(3) + 'px'; } catch (e) {}
  }

  function layout(ctx, sub, st, W, H) {
    const key = JSON.stringify(st) + '|' + W + 'x' + H + '|' + fontEpoch + '|' + sub.tokens.map((t) => (t.b ? '*' : '') + t.w).join(' ');
    const c = cache.get(sub);
    if (c && c.key === key) return c.L;

    const caps = !!st.caps, size = +st.tam, track = +st.track2;
    const all = oneBold(sub.tokens, st.dis).map((t, i) => ({ i, w: caps ? t.w.toLocaleUpperCase('es') : t.w, b: !!t.b }));
    const esc0 = Math.max(10, +st.esc) / 100;
    const bS = all.findIndex((t) => t.b); let bE = -1; all.forEach((t, i) => { if (t.b) bE = i; });
    const capt = st.dis !== 1 && bS >= 0;
    let escU = esc0;
    if (capt) { const lim = W * 0.86 / (Math.max(1, all[bS].w.length) * size * 0.62); if (escU > lim) escU = Math.max(1, lim); }
    const szB = size * escU;
    const lines = capt
      ? [all.slice(0, bS), all.slice(bS, bE + 1), all.slice(bE + 1)].filter((l) => l.length)
      : balLines(all, all.map((t) => t.w.length * (t.b ? esc0 : 1)), Math.max(5, +st.cpl));

    ctx.save();
    const words = [], lineInfo = [];
    let base = 0, prevBig = false;
    const gp = size * 0.22;
    lines.forEach((ln, li) => {
      const big = capt && ln[0].b;
      const mx = ln.some((t) => t.b) ? Math.max(size, szB) : size;
      if (li > 0) {
        if (capt) base += big ? 0.24 * size + gp + 0.74 * szB : (prevBig ? 0.24 * szB + gp + 0.74 * size : 1.2 * size);
        else base += 1.2 * mx;
      }
      prevBig = big;
      let x = 0; const lw = [];
      ln.forEach((t, k) => {
        const sz = t.b ? szB : size;
        setFont(ctx, t.b, sz, track);
        const m = ctx.measureText(t.w);
        const wd = { i: t.i, text: t.w, b: t.b, sz, x, base, w: m.width,
                     asc: m.actualBoundingBoxAscent || sz * 0.72, desc: m.actualBoundingBoxDescent || sz * 0.2 };
        words.push(wd); lw.push(wd);
        x += m.width;
        if (k < ln.length - 1) {
          const nb = t.b && ln[k + 1].b;
          setFont(ctx, nb, nb ? szB : size, track);
          x += ctx.measureText(' ').width;
        }
      });
      lineInfo.push({ words: lw, width: x, base });
    });
    ctx.restore();

    // alineación dentro del bloque (izq / centro / der)
    const al = +st.align;
    lineInfo.forEach((L) => {
      const dx = al === 1 ? 0 : (al === 3 ? -L.width : -L.width / 2);
      L.words.forEach((w) => { w.x += dx; });
    });
    // caja real de las letras -> se centra en la posición (igual que el punto de anclaje de AE)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    words.forEach((w) => { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x + w.w); y0 = Math.min(y0, w.base - w.asc); y1 = Math.max(y1, w.base + w.desc); });
    if (!words.length) { x0 = x1 = y0 = y1 = 0; }
    const cx = W * st.posX / 100, cy = H * st.posY / 100;
    const ox = cx - (x0 + x1) / 2, oy = cy - (y0 + y1) / 2;
    words.forEach((w) => { w.x += ox; w.base += oy; });
    const L = { words, size, szB, box: { x: x0 + ox, y: y0 + oy, w: x1 - x0, h: y1 - y0 } };
    cache.set(sub, { key, L });
    return L;
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  // capa de texto reutilizable (las sombras y el glow se aplican a la capa completa, como en AE)
  let layerCv = null;
  function getLayer(w, h) {
    if (!layerCv) layerCv = document.createElement('canvas');
    if (layerCv.width !== w || layerCv.height !== h) { layerCv.width = w; layerCv.height = h; }
    const lc = layerCv.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, w, h);
    return lc;
  }

  /**
   * Dibuja un subtítulo en el instante t (segundos desde su inicio).
   * ctx: canvas 2D de salida (ya limpio). W,H: tamaño del video. k: escala del canvas respecto al video (1 al exportar).
   */
  function drawSub(ctx, sub, t, style, W, H, fps, k) {
    if (!sub || !sub.tokens || !sub.tokens.length) return;
    k = k || 1;
    const st = resolve(style, W, H);
    ctx.save();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const L = layout(ctx, sub, st, W, H);
    const fd = 1 / (fps || 30);
    const stg = Math.max(0, +st.retraso) * fd;
    let dur = Math.max(+st.vel, 1) * fd;
    const est = Math.round(+st.estilo) || 1;
    if (est === 5) dur = fd;

    // fondo
    const fOp = +st.fOp;
    if (fOp > 0 && L.words.length) {
      const e = clamp(t / dur, 0, 1), a = fOp / 100 * (e * e * (3 - 2 * e)), m = +st.fMargen;
      ctx.fillStyle = rgba(st.fColor, a);
      rrect(ctx, L.box.x - m, L.box.y - m, L.box.w + 2 * m, L.box.h + 2 * m, +st.fRed);
      ctx.fill();
    }

    // palabra que se dice (karaoke)
    const kar = Math.round(+st.kar);
    let cur = -1;
    if (kar > 0) { const tm = wordTimes(sub); for (let i = 0; i < tm.length; i++) if (t >= tm[i]) cur = i; }
    if (kar === 1 && cur >= 0) {
      const w = L.words.find((x) => x.i === cur);
      if (w) {
        const m = +st.cajaM;
        ctx.fillStyle = st.colCaja;
        rrect(ctx, w.x - m, w.base - w.sz * 0.75 - m, w.w + 2 * m, w.sz * 0.97 + 2 * m, +st.cajaR);
        ctx.fill();
      }
    }

    // texto (en una capa aparte para la sombra y el glow)
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const lc = getLayer(cw, ch);
    lc.setTransform(k, 0, 0, k, 0, 0);
    lc.textBaseline = 'alphabetic'; lc.textAlign = 'left';
    const bw = +st.bordeW, track = +st.track2, kk = 1.70158;
    let any = false;
    L.words.forEach((w, n) => {
      const x = clamp((t - n * stg) / dur, 0, 1);
      const pO = 1 - Math.pow(1 - x, 3);
      if (pO <= 0.001) return;
      const pM = 1 + (kk + 1) * Math.pow(x - 1, 3) + kk * Math.pow(x - 1, 2), v = 1 - pM;
      let dy = 0, sc = 1;
      if (est === 2) dy = L.size * 0.7 * v;
      else if (est === 6) dy = -L.size * 0.9 * v;
      if (est === 1) sc = 1 - 0.6 * v; else if (est === 7) sc = 1 + 1.2 * v;
      lc.save();
      lc.globalAlpha = pO;
      if (est === 4 && pO < 1) lc.filter = 'blur(' + (15 * (1 - pO) * k).toFixed(2) + 'px)';
      const ax = w.x + w.w / 2, ay = w.base - w.sz * 0.35;
      lc.translate(ax, ay + dy); if (sc !== 1) lc.scale(Math.max(0.001, sc), Math.max(0.001, sc)); lc.translate(-ax, -ay);
      setFont(lc, w.b, w.sz, track);
      if (bw > 0) { lc.lineJoin = 'round'; lc.miterLimit = 2; lc.lineWidth = bw; lc.strokeStyle = st.colBorde; lc.strokeText(w.text, w.x, w.base); }
      lc.fillStyle = (kar > 0 && w.i === cur) ? st.colAct : (w.b ? st.colBold : st.colReg);
      lc.fillText(w.text, w.x, w.base);
      lc.restore();
      any = true;
    });
    if (any) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const glowI = +st.glowI;
      if (glowI > 0) {
        ctx.save();
        ctx.shadowColor = rgba(st.colReg, Math.min(1, glowI / 100));
        ctx.shadowBlur = Math.max(0, +st.glowR) * k; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        for (let i = 0; i < Math.max(1, Math.ceil(glowI / 100)); i++) ctx.drawImage(layerCv, 0, 0);
        ctx.restore();
      }
      const sh = +st.sombra;
      ctx.save();
      if (sh > 0) {
        ctx.shadowColor = 'rgba(0,0,0,' + Math.min(1, 0.5 * sh / 100) + ')';
        ctx.shadowBlur = 18 * k; ctx.shadowOffsetX = 3.5 * k; ctx.shadowOffsetY = 3.5 * k;
      }
      ctx.drawImage(layerCv, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // subtítulo activo en el instante T (segundos del video). subs ordenados por inicio.
  function activeAt(subs, T) {
    const ms = T * 1000;
    let lo = 0, hi = subs.length - 1, best = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (subs[m].start <= ms) { best = m; lo = m + 1; } else hi = m - 1; }
    for (let i = best; i >= 0 && i > best - 4; i--) if (subs[i].start <= ms && ms < subs[i].end) return subs[i];
    return null;
  }

  root.CapRender = { drawSub, activeAt, resolve, oneBold, balLines, wordTimes, fontsChanged, hexRGB };
})(window);
