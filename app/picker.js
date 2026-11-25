// =====================================================================
//  Captionation · selector de color propio (mismo archivo en la app y en el panel)
//  Reemplaza el selector nativo de Windows: cuadro de saturación/brillo, barra de tono,
//  campo para pegar #HEX, RGB o CMYK, y las muestras de la marca.
//  Uso: CapPicker.attach(input, { parse, palette: () => [...], onCommit: (hex) => {}, onRemove: (hex) => {} })
// =====================================================================
(function (root) {
  'use strict';
  const css = `
  .cpk{position:fixed;z-index:9999;width:236px;background:#141416;border:1px solid #2c2c31;box-shadow:0 12px 32px #000a;padding:10px;font:500 11px/1.3 "Segoe UI",sans-serif;color:#ececee;user-select:none}
  .cpk canvas{display:block;width:216px;cursor:crosshair}
  .cpk .sv{height:140px;border-radius:2px}
  .cpk .hu{height:12px;margin-top:8px;border-radius:2px}
  .cpk .rw{display:flex;gap:6px;align-items:center;margin-top:8px}
  .cpk .pv{width:28px;height:24px;border:1px solid #0006;flex:0 0 auto}
  .cpk input{flex:1;min-width:0;font:11px Consolas,monospace;color:#ececee;background:#0b0b0c;border:1px solid #2c2c31;padding:4px 6px;text-transform:uppercase;user-select:text}
  .cpk input:focus{outline:1px solid #0a5cff;border-color:#0a5cff}
  .cpk input.bad{border-color:#ff5a4f;outline:1px solid #ff5a4f}
  .cpk .sws{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
  .cpk .sws div{width:18px;height:18px;border:1px solid #0006;cursor:pointer}
  .cpk .sws div:hover{transform:scale(1.15)}
  .cpk .tip{color:#8b8b93;font-size:10px;margin-top:6px}
  .cpk .k{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000a;pointer-events:none;transform:translate(-50%,-50%)}
  .cpk .kh{position:absolute;width:4px;height:16px;background:#fff;box-shadow:0 0 0 1px #000a;pointer-events:none;transform:translate(-50%,-2px)}`;
  let styled = false, cur = null;

  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) || 0);
  function hsv2rgb(h, s, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5) * 255, f(3) * 255, f(1) * 255];
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }

  function close(commit) {
    if (!cur) return;
    const c = cur; cur = null;
    document.removeEventListener('pointerdown', c.outside, true);
    document.removeEventListener('keydown', c.keys, true);
    c.el.remove();
    if (commit !== false && c.input.value.toLowerCase() !== c.start.toLowerCase() && c.opts.onCommit) c.opts.onCommit(c.input.value.toLowerCase());
  }

  function open(input, opts) {
    if (cur && cur.input === input) { close(); return; }
    close();
    if (!styled) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true; }
    const el = document.createElement('div'); el.className = 'cpk';
    el.innerHTML = '<div style="position:relative"><canvas class="sv" width="216" height="140"></canvas><div class="k"></div></div>' +
      '<div style="position:relative"><canvas class="hu" width="216" height="12"></canvas><div class="kh"></div></div>' +
      '<div class="rw"><div class="pv"></div><input spellcheck="false" maxlength="40"></div><div class="sws"></div>' +
      '<div class="tip">' + (opts.tip || 'Pega #HEX, RGB o CMYK. Clic derecho en una muestra = quitarla.') + '</div>';
    document.body.appendChild(el);
    const sv = el.querySelector('.sv'), hu = el.querySelector('.hu'), knob = el.querySelector('.k'), kh = el.querySelector('.kh');
    const pv = el.querySelector('.pv'), hex = el.querySelector('input'), sws = el.querySelector('.sws');
    let [h, s, v] = rgb2hsv(...fromHex(input.value));

    function drawSV() {
      const g = sv.getContext('2d'), W = sv.width, H = sv.height;
      g.fillStyle = toHex(...hsv2rgb(h, 1, 1)); g.fillRect(0, 0, W, H);
      let gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    (function drawHue() {
      const g = hu.getContext('2d'), gr = g.createLinearGradient(0, 0, hu.width, 0);
      for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, toHex(...hsv2rgb(i * 60, 1, 1)));
      g.fillStyle = gr; g.fillRect(0, 0, hu.width, hu.height);
    })();
    function knobs() {
      knob.style.left = (s * 216) + 'px'; knob.style.top = ((1 - v) * 140) + 'px';
      kh.style.left = (h / 360 * 216) + 'px';
    }
    function set(hx, fromText) {
      input.value = hx;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      pv.style.background = hx;
      if (!fromText && document.activeElement !== hex) { hex.value = hx.toUpperCase(); hex.classList.remove('bad'); }
    }
    function fromHSV() { set(toHex(...hsv2rgb(h, s, v))); knobs(); }
    function drag(canvas, fn) {
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        const mv = (ev) => { const r = canvas.getBoundingClientRect(); fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))); };
        mv(e);
        canvas.onpointermove = mv;
        canvas.onpointerup = () => { canvas.onpointermove = null; };
      });
    }
    drag(sv, (x, y) => { s = x; v = 1 - y; fromHSV(); });
    drag(hu, (x) => { h = x * 360; drawSV(); fromHSV(); });
    function applyText(final) {
      const p = opts.parse(hex.value);
      hex.classList.toggle('bad', !p && (final || hex.value.length >= 6));
      if (!p) return false;
      [h, s, v] = rgb2hsv(...fromHex(p)); drawSV(); knobs(); set(p, true);
      if (final) hex.value = p.toUpperCase();
      return true;
    }
    hex.addEventListener('input', () => applyText(false));
    hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (applyText(true)) close(); } });
    function renderSws() {
      sws.innerHTML = '';
      (opts.palette ? opts.palette() : []).forEach((c) => {
        const d = document.createElement('div'); d.style.background = c; d.title = c.toUpperCase();
        d.onclick = () => { [h, s, v] = rgb2hsv(...fromHex(c)); drawSV(); knobs(); set(c); };
        d.oncontextmenu = (e) => { e.preventDefault(); if (opts.onRemove) { opts.onRemove(c); renderSws(); } };
        sws.appendChild(d);
      });
    }
    renderSws(); drawSV(); knobs();
    pv.style.background = input.value; hex.value = input.value.toUpperCase();

    // posición: debajo del cuadro de color, sin salirse de la ventana
    try { input.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    const r = input.getBoundingClientRect();
    let x = r.left, y = r.bottom + 4;
    if (x + 248 > document.documentElement.clientWidth) x = document.documentElement.clientWidth - 248;
    if (y + el.offsetHeight > innerHeight - 4) y = Math.max(4, r.top - el.offsetHeight - 4);
    el.style.left = Math.max(4, x) + 'px'; el.style.top = y + 'px';

    const outside = (e) => { if (!el.contains(e.target) && e.target !== input) close(); };
    const keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      // pegar en cualquier parte del selector
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && document.activeElement !== hex) { hex.value = ''; hex.focus(); }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', keys, true);
    cur = { el, input, opts, start: input.value, outside, keys };
    setTimeout(() => { hex.focus(); hex.select(); }, 0);
  }

  function attach(input, opts) {
    input.addEventListener('click', (e) => { e.preventDefault(); open(input, opts); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(input, opts); } });
  }
  root.CapPicker = { attach, close, isOpen: () => !!cur };
})(window);
