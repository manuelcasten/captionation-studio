// =====================================================================
//  Captionation Studio · lógica de la interfaz
//  Versión de escritorio del panel Captionation (Premiere / After Effects),
//  sin Adobe: abre un video, lo transcribe con whisper.cpp en local y exporta
//  los subtítulos animados con fondo transparente.
// =====================================================================
(function () {
  'use strict';
  const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), https = require('https');
  const { ipcRenderer, webUtils } = require('electron');
  const { pathToFileURL } = require('url');
  const R = window.CapRender;
  const $ = (id) => document.getElementById(id);

  // ---------- estado ----------
  const NUMS = ['estilo', 'esc', 'retraso', 'vel', 'tam', 'posX', 'posY', 'cpl', 'track2', 'bordeW', 'kar', 'cajaM', 'cajaR', 'glowI', 'glowR', 'sombra', 'fOp', 'fMargen', 'fRed'];
  const COLS = ['colReg', 'colBold', 'colBorde', 'colAct', 'colCaja', 'fColor'];
  const STYLE_IDS = NUMS.concat(COLS, ['fontReg', 'fontBold']);
  const CARDS = {
    clasico: { dis: 1, kar: 0, esc: 100, cpl: 18, fontReg: 'SegoeUI', fontBold: 'SegoeUI-Bold', caps: false },
    tipo:    { dis: 3, kar: 0, esc: 200, cpl: 26, fontReg: 'SegoeUI', fontBold: 'SegoeUI-Bold', caps: false },
    karaoke: { dis: 1, kar: 1, esc: 100, cpl: 16, fontReg: 'SegoeUI-Bold', fontBold: 'SegoeUIBlack', caps: true, track2: -20 }
  };
  let subs = [];               // { start: ms, end: ms, tokens: [{ w, b }], wordStarts?: [s] }
  let media = null;            // { path, hasVideo, W, H, fps, fpsStr, dur }
  let pvFmt = 'v', selIndex = -1, vT = 0;
  let dis = 1, align = 2, card = 'clasico';
  let palette = ['#ffffff', '#000000', '#ffd400', '#0a5cff'];
  let activeColor = 'colBold';
  let fontList = [];
  let exporting = false;
  let INFO = { ffmpeg: '', version: '1.0.0' };
  const vid = $('vid'), cv = $('pv');

  function status(msg, kind) { const s = $('status'); s.textContent = msg; s.className = kind || ''; }

  // ---------- versión y aviso de actualizaciones ----------
  const SITE = 'https://manuelcasten.github.io/';
  const verNum = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  function newer(a, b) { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; }
  function getJson(url) {
    return new Promise((res, rej) => {
      https.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (r) => {
        let d = ''; r.setEncoding('utf8'); r.on('data', (c) => { d += c; });
        r.on('end', () => { try { res(JSON.parse(d.replace(/^\uFEFF/, ''))); } catch (e) { rej(e); } });
      }).on('error', rej);
    });
  }
  const openUrl = (u) => ipcRenderer.invoke('open-external', u);
  $('siteLink').onclick = (e) => { e.preventDefault(); openUrl(SITE); };

  // ---------- ajustes ----------
  const UI_IDS = ['rule', 'ruleN', 'ruleList', 'wModel', 'wLang', 'wMax', 'wPrompt'];
  function collectStyle() {
    const s = { dis, align, card, caps: $('caps').checked, safeZone: $('safeZone').checked };
    STYLE_IDS.forEach((k) => { s[k] = $(k).value; });
    return s;
  }
  // estilo numérico para el motor de render
  function curStyle() {
    const s = { dis: dis === 2 ? 3 : dis, align, caps: $('caps').checked, safeZone: $('safeZone').checked };
    NUMS.forEach((k) => { s[k] = +$(k).value || 0; });
    COLS.forEach((k) => { s[k] = $(k).value; });
    return s;
  }
  function applyStyle(s) {
    if (!s) return;
    STYLE_IDS.forEach((k) => { if (s[k] !== undefined && $(k)) $(k).value = s[k]; });
    if (s.caps !== undefined) $('caps').checked = !!s.caps;
    if (s.safeZone !== undefined) $('safeZone').checked = !!s.safeZone;
    if (s.dis) dis = +s.dis;
    if (s.align) setAlign(+s.align);
    if (s.card) setCard(s.card, false);
    $('fOpR').value = $('fOp').value; $('glowIR').value = $('glowI').value;
    syncFontSel(); loadFaces();
  }
  function save() {
    try {
      const s = { style: collectStyle(), palette, pvFmt, fmt: expFmt };
      UI_IDS.forEach((k) => { s[k] = $(k).value; });
      localStorage.setItem('cs_settings', JSON.stringify(s));
    } catch (e) {}
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('cs_settings') || '{}');
      UI_IDS.forEach((k) => { if (s[k] !== undefined) $(k).value = s[k]; });
      if (Array.isArray(s.palette)) palette = s.palette;
      if (s.pvFmt) pvFmt = s.pvFmt;
      if (s.fmt) expFmt = s.fmt;
      if (s.style) applyStyle(s.style); else setCard('clasico', true);
    } catch (e) { setCard('clasico', true); }
  }

  // ---------- estilos de edición ----------
  function setCard(name, setDefaults) {
    card = name;
    document.querySelectorAll('.styleCard').forEach((c) => c.classList.toggle('on', c.dataset.card === name));
    if (!setDefaults) return;
    const d = CARDS[name];
    dis = d.dis;
    Object.keys(d).forEach((k) => { if ($(k) && k !== 'caps') $(k).value = d[k]; });
    $('caps').checked = d.caps;
    syncFontSel(); loadFaces(); renderList();
  }
  document.querySelectorAll('.styleCard').forEach((c) => { c.onclick = () => { setCard(c.dataset.card, true); save(); }; });
  function setAlign(v) {
    align = v;
    document.querySelectorAll('#alignSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.al === v));
  }
  document.querySelectorAll('#alignSeg button').forEach((b) => { b.onclick = () => { setAlign(+b.dataset.al); save(); queuePv(); }; });

  // ---------- fuentes del sistema (lee el nombre PostScript de cada .ttf/.otf) ----------
  function readFontNames(file) {
    let fd;
    try {
      fd = fs.openSync(file, 'r');
      const rd = (pos, len) => { const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, pos); return b; };
      const head = rd(0, 12);
      const num = head.readUInt16BE(4);
      const dir = rd(12, num * 16);
      let off = -1, len = 0;
      for (let i = 0; i < num; i++) {
        if (dir.toString('latin1', i * 16, i * 16 + 4) === 'name') { off = dir.readUInt32BE(i * 16 + 8); len = dir.readUInt32BE(i * 16 + 12); }
      }
      if (off < 0 || len > 2000000) return null;
      const t = rd(off, len);
      const count = t.readUInt16BE(2), strOff = t.readUInt16BE(4);
      const names = {};
      for (let i = 0; i < count; i++) {
        const r = 6 + i * 12;
        const plat = t.readUInt16BE(r), lang = t.readUInt16BE(r + 4), id = t.readUInt16BE(r + 6), l = t.readUInt16BE(r + 8), o = t.readUInt16BE(r + 10);
        if (![1, 2, 4, 6, 16, 17].includes(id)) continue;
        const raw = t.slice(strOff + o, strOff + o + l);
        let s;
        if (plat === 3 || plat === 0) { s = ''; for (let k = 0; k + 1 < raw.length; k += 2) s += String.fromCharCode(raw.readUInt16BE(k)); }
        else s = raw.toString('latin1');
        const pri = (plat === 3 && lang === 0x409) ? 2 : (plat === 3 ? 1 : 0);
        if (!names[id] || names[id].pri < pri) names[id] = { s, pri };
      }
      if (!names[6]) return null;
      const fam = (names[16] || names[1] || { s: '' }).s, sty = (names[17] || names[2] || { s: '' }).s;
      return { ps: names[6].s, label: (fam + ' ' + sty).trim(), file };
    } catch (e) { return null; }
    finally { try { if (fd !== undefined) fs.closeSync(fd); } catch (e) {} }
  }
  function scanFonts() {
    const dirs = [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts')];
    const seen = {}, list = [];
    dirs.forEach((d) => {
      let files = [];
      try { files = fs.readdirSync(d); } catch (e) {}
      files.filter((f) => /\.(ttf|otf)$/i.test(f)).forEach((f) => {
        const n = readFontNames(path.join(d, f));
        if (n && !seen[n.ps]) { seen[n.ps] = 1; list.push(n); }
      });
    });
    list.sort((a, b) => a.label.localeCompare(b.label));
    try { localStorage.setItem('cs_fonts', JSON.stringify(list)); } catch (e) {}
    fontList = list;
    $('fontInfo').textContent = list.length + ' fuentes';
    syncFontSel();
  }
  function syncFontSel() {
    document.querySelectorAll('.sbRange').forEach((r) => { r.value = $(r.dataset.for).value; });
    document.querySelectorAll('.fontSel').forEach((s) => {
      s.innerHTML = '';
      let grp = null, fam = '';
      fontList.forEach((f) => {
        const fm = f.label.split(' ')[0];
        if (fm !== fam) { fam = fm; grp = document.createElement('optgroup'); grp.label = fm; s.appendChild(grp); }
        const o = document.createElement('option'); o.value = f.ps; o.textContent = f.label + '  (' + f.ps + ')'; grp.appendChild(o);
      });
      const cur = $(s.dataset.for).value || '';
      if (cur && !fontList.some((f) => f.ps === cur)) { const o = document.createElement('option'); o.value = cur; o.textContent = cur + '  (no instalada en este PC)'; s.insertBefore(o, s.firstChild); }
      s.value = cur;
    });
  }
  document.querySelectorAll('.fontSel').forEach((s) => {
    s.onchange = () => { if (!s.value) return; $(s.dataset.for).value = s.value; save(); loadFaces(); };
  });
  $('btnFonts').onclick = () => { $('fontInfo').textContent = 'Buscando fuentes…'; setTimeout(scanFonts, 30); };

  // carga las fuentes elegidas en el motor de render (desde el archivo, así sale idéntica al exportar)
  const faces = {};
  let faceChain = Promise.resolve();
  function loadFaces() {
    faceChain = faceChain.then(async () => {
      const want = { capReg: $('fontReg').value || 'SegoeUI', capBold: $('fontBold').value || 'SegoeUI-Bold' };
      let changed = false;
      for (const slot of Object.keys(want)) {
        const ps = want[slot];
        if (faces[slot] && faces[slot].ps === ps) continue;
        let face = null;
        const tryFace = async (src) => { try { const f = new FontFace(slot, src); await f.load(); return f; } catch (e) { return null; } };
        const f = fontList.find((x) => x.ps === ps);
        if (f && f.file) { try { face = await tryFace(fs.readFileSync(f.file)); } catch (e) {} }
        if (!face) face = await tryFace('local("' + ps + '")');
        if (!face) { try { face = await tryFace(fs.readFileSync(path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', slot === 'capReg' ? 'segoeui.ttf' : 'segoeuib.ttf'))); } catch (e) {} }
        if (faces[slot]) { try { document.fonts.delete(faces[slot].face); } catch (e) {} }
        if (face) { document.fonts.add(face); faces[slot] = { ps, face }; } else delete faces[slot];
        changed = true;
      }
      if (changed) { R.fontsChanged(); queuePv(); }
    });
    return faceChain;
  }

  // deslizador junto a cada número
  const RANGES = { retraso: [0, 30], vel: [1, 60], tam: [10, 300], esc: [50, 600], track2: [-200, 400], posX: [0, 100], posY: [0, 100],
                   cpl: [5, 60], cajaM: [0, 100], cajaR: [0, 100], bordeW: [0, 50], glowR: [0, 200], sombra: [0, 200], fMargen: [0, 200], fRed: [0, 200] };
  Object.keys(RANGES).forEach((id) => {
    const n = $(id); if (!n) return;
    const r = document.createElement('input');
    r.type = 'range'; r.className = 'sbRange'; r.dataset.for = id;
    r.min = RANGES[id][0]; r.max = RANGES[id][1]; r.step = n.step || 1; r.value = n.value; r.style.flex = '1'; r.style.minWidth = '60px';
    n.parentNode.insertBefore(r, n);
    r.oninput = () => { n.value = r.value; n.dispatchEvent(new Event('input', { bubbles: true })); };
    r.onchange = () => { n.dispatchEvent(new Event('change', { bubbles: true })); save(); };
    n.addEventListener('input', () => { r.value = n.value; });
    n.addEventListener('change', () => { r.value = n.value; });
  });

  // ---------- presets de marca (mismo formato .sbmarca que el panel) ----------
  function getPresets() { try { return JSON.parse(localStorage.getItem('sb_presets') || '{}'); } catch (e) { return {}; } }
  function setPresets(p) { try { localStorage.setItem('sb_presets', JSON.stringify(p)); } catch (e) {} }
  function renderPresets(sel) {
    const p = getPresets(), s = $('preset');
    s.innerHTML = '<option value="">— ninguno —</option>';
    Object.keys(p).sort().forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; s.appendChild(o); });
    if (sel !== undefined) s.value = sel;
  }
  $('preset').onchange = () => {
    const p = getPresets()[$('preset').value];
    if (!p) return;
    applyStyle(p.style); renderList();
    if (Array.isArray(p.palette) && p.palette.length) { palette = p.palette.slice(); renderSwatches(); }
    $('presetName').value = $('preset').value;
    save();
    status('Preset "' + $('preset').value + '" cargado.', 'ok');
  };
  $('btnPresetSave').onclick = () => {
    const n = $('presetName').value.trim() || $('preset').value;
    if (!n) { status('Escribe un nombre para el preset.', 'err'); return; }
    const p = getPresets(); p[n] = { style: collectStyle(), palette: palette.slice() }; setPresets(p);
    renderPresets(n); status('Preset "' + n + '" guardado.', 'ok');
  };
  $('btnPresetDel').onclick = () => {
    const n = $('preset').value; if (!n) return;
    const p = getPresets(); delete p[n]; setPresets(p); renderPresets(''); status('Preset "' + n + '" borrado.', 'ok');
  };
  $('btnPresetExport').onclick = async () => {
    const p = getPresets();
    if (!Object.keys(p).length) { status('No hay presets guardados para exportar.', 'err'); return; }
    let f = await ipcRenderer.invoke('save-dialog', { title: 'Exportar marcas', defaultPath: 'Marcas Captionation.sbmarca', filters: [{ name: 'Marcas Captionation', extensions: ['sbmarca'] }] });
    if (!f) return;
    if (!/\.sbmarca$/i.test(f)) f += '.sbmarca';
    try { fs.writeFileSync(f, JSON.stringify({ tipo: 'subtitulos-bold-marcas', version: 3, presets: p }, null, 2), 'utf8'); status('Marcas exportadas:\n' + f, 'ok'); }
    catch (e) { status('No se pudo guardar: ' + e.message, 'err'); }
  };
  $('btnPresetImport').onclick = async () => {
    const r = await ipcRenderer.invoke('open-dialog', { title: 'Importar marcas', properties: ['openFile'], filters: [{ name: 'Marcas Captionation', extensions: ['sbmarca', 'json'] }] });
    if (!r) return;
    try {
      const inc = JSON.parse(fs.readFileSync(r[0], 'utf8').replace(/^\uFEFF/, '')).presets || {};
      const p = getPresets(); let n = 0;
      Object.keys(inc).forEach((k) => { p[k] = inc[k]; n++; });
      setPresets(p); renderPresets(); status(n + ' marca(s) importada(s).', 'ok');
    } catch (e) { status('Ese archivo no es un archivo de marcas válido.', 'err'); }
  };

  // ---------- muestras de color ----------
  function renderSwatches() {
    const box = $('swatches'); box.innerHTML = '';
    palette.forEach((hex, i) => {
      const d = document.createElement('div'); d.className = 'sw'; d.style.background = hex; d.title = hex;
      d.onclick = () => { $(activeColor).value = hex; $(activeColor).dispatchEvent(new Event('input', { bubbles: true })); save(); };
      d.oncontextmenu = (e) => { e.preventDefault(); palette.splice(i, 1); renderSwatches(); save(); };
      box.appendChild(d);
    });
  }
  function setActive(id) {
    activeColor = id;
    document.querySelectorAll('input.col').forEach((x) => x.classList.toggle('active', x.id === id));
  }
  document.querySelectorAll('input.col').forEach((x) => {
    x.addEventListener('focus', () => setActive(x.id));
    x.addEventListener('click', () => setActive(x.id));
  });
  $('btnSwAdd').onclick = () => { const v = $(activeColor).value.toLowerCase(); if (!palette.includes(v)) palette.push(v); renderSwatches(); save(); };

  // ---------- pegar códigos de color del manual de marca: #0A5CFF, 0a5cff, #FFF, rgb(10, 92, 255), CMYK ----------
  function parseColor(s) {
    const raw = String(s || '').toLowerCase();
    s = raw.trim().replace(/\s+/g, '');
    let m = s.match(/^#?([0-9a-f]{6})[;,.]?$/); if (m) return '#' + m[1];
    m = s.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])[;,.]?$/); if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
    m = s.match(/^(?:rgba?\()?(\d{1,3}),(\d{1,3}),(\d{1,3})(?:,[\d.]+)?\)?;?$/);
    if (m && [m[1], m[2], m[3]].every((n) => +n <= 255)) return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('');
    m = s.match(/c:?(\d{1,3})%?,?m:?(\d{1,3})%?,?y:?(\d{1,3})%?,?k:?(\d{1,3})%?/) || s.match(/^(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
    if (m && [m[1], m[2], m[3], m[4]].every((n) => +n <= 100)) {
      const k = 1 - m[4] / 100;
      return '#' + [m[1], m[2], m[3]].map((n) => Math.round(255 * (1 - n / 100) * k).toString(16).padStart(2, '0')).join('');
    }
    m = raw.match(/#([0-9a-f]{6})(?![0-9a-f])/) || raw.match(/(?:^|[^0-9a-z])([0-9a-f]{6})(?:$|[^0-9a-z])/); if (m) return '#' + m[1];
    return null;
  }
  function syncHex() {
    document.querySelectorAll('input.hex').forEach((h) => { if (document.activeElement !== h) { h.value = $(h.dataset.for).value.toUpperCase(); h.classList.remove('bad'); } });
  }
  document.querySelectorAll('input.col').forEach((x) => {
    const h = document.createElement('input');
    h.type = 'text'; h.className = 'hex'; h.dataset.for = x.id; h.maxLength = 40; h.spellcheck = false;
    h.title = 'Pega un código: #0A5CFF, 0a5cff, #FFF o rgb(10, 92, 255)';
    h.value = x.value.toUpperCase();
    x.parentNode.insertBefore(h, x.nextSibling);
    const apply = (final) => {
      const p = parseColor(h.value);
      h.classList.toggle('bad', !p && (final || h.value.length >= 6));
      if (!p) return;
      x.value = p;
      x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true }));
      save();
      if (final) h.value = p.toUpperCase();
    };
    h.addEventListener('focus', () => { setActive(x.id); h.select(); });
    h.addEventListener('input', () => apply(false));
    h.addEventListener('change', () => apply(true));
    h.addEventListener('blur', () => { apply(true); if (!parseColor(h.value)) { h.value = x.value.toUpperCase(); h.classList.remove('bad'); } });
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter') { apply(true); h.blur(); } });
    x.addEventListener('input', () => { if (document.activeElement !== h) h.value = x.value.toUpperCase(); });
  });
  [['fOpR', 'fOp'], ['glowIR', 'glowI']].forEach(([r, n]) => {
    $(r).oninput = () => { $(n).value = $(r).value; save(); queuePv(); };
    $(n).addEventListener('input', () => { $(r).value = $(n).value; });
  });

  // ---------- parser de .txt / .srt ----------
  const RE_TC  = /(\d{1,2}):(\d{2}):(\d{2})[:;](\d{2})\s*(?:-->|–|-)\s*(\d{1,2}):(\d{2}):(\d{2})[:;](\d{2})/;
  const RE_SRT = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  function parseSubs(txt, fps) {
    const lines = txt.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    const out = [];
    let cur = null;
    const flush = () => { if (cur && cur.text.trim()) out.push({ start: cur.start, end: cur.end, tokens: tokenize(cur.text.trim()) }); cur = null; };
    for (const raw of lines) {
      const line = raw.trim();
      let m;
      if ((m = line.match(RE_TC))) {
        flush();
        const f = (h, mi, s, fr) => Math.round(((+h * 3600 + +mi * 60 + +s) + +fr / Math.round(fps)) * 1000);
        cur = { text: '', start: f(m[1], m[2], m[3], m[4]), end: f(m[5], m[6], m[7], m[8]) };
      } else if ((m = line.match(RE_SRT))) {
        flush();
        const ms = (h, mi, s, x) => ((+h * 3600 + +mi * 60 + +s) * 1000) + +(x + '00').slice(0, 3);
        cur = { text: '', start: ms(m[1], m[2], m[3], m[4]), end: ms(m[5], m[6], m[7], m[8]) };
      } else if (!line) {
        flush();
      } else if (cur) {
        if (/^\d+$/.test(line) && !cur.text) continue;
        cur.text += (cur.text ? ' ' : '') + line;
      }
    }
    flush();
    return out;
  }
  function tokenize(text) {
    const parts = text.split(/\s+/).filter(Boolean);
    let inBold = false;
    return parts.map((p) => {
      let w = p, b = inBold;
      if (/^[^\w*]*\*/.test(w)) { b = true; inBold = true; w = w.replace('*', ''); }
      if (w.includes('*')) { inBold = false; }
      return { w: w.replace(/\*/g, ''), b };
    }).filter((t) => t.w);
  }
  // texto con *asteriscos* alrededor de lo que va en bold
  function markText(s) {
    const t = s.tokens, out = [];
    for (let i = 0; i < t.length;) {
      if (t[i].b) { let j = i; while (j < t.length && t[j].b) j++; out.push('*' + t.slice(i, j).map((x) => x.w).join(' ') + '*'); i = j; }
      else { out.push(t[i].w); i++; }
    }
    return out.join(' ');
  }

  $('btnTxt').onclick = async () => {
    const r = await ipcRenderer.invoke('open-dialog', { title: 'Elige el archivo de subtítulos', properties: ['openFile'], filters: [{ name: 'Subtítulos', extensions: ['txt', 'srt'] }] });
    if (!r) return;
    let txt;
    try { txt = fs.readFileSync(r[0], 'utf8'); } catch (e) { status('No pude leer el archivo: ' + e.message, 'err'); return; }
    const parsed = parseSubs(txt, media ? media.fps : 30);
    if (!parsed.length) { status('No encontré subtítulos con tiempos en ese archivo.', 'err'); return; }
    subs = parsed.sort((a, b) => a.start - b.start);
    const hasMarks = /\*/.test(txt);
    if (!hasMarks) applyRuleAll();
    $('txtInfo').textContent = path.basename(r[0]) + ' · ' + subs.length + ' subtítulos' + (hasMarks ? ' · con *asteriscos*' : '');
    changed(); status('');
  };

  // ---------- bold automático ----------
  const STOP = new Set(('a al algo algun alguna algunas alguno algunos ante antes aqui asi aun bien cada como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estan estar estas este esto estos fue fueron ha habia han hasta hay la las le les lo los mas me mi mis mucho muy nada ni no nos nuestra nuestro nuestros o otra otro para pero poco por porque pues que quien se sea ser si sido sin sobre son su sus tambien te tiene tienen todo todos tu tus un una unas uno unos y ya yo eh bueno entonces justamente realmente digamos osea').split(' '));
  const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]/g, '');
  const ARTIC = new Set('el la los las un una unos unas del al mi mis tu tus su sus nuestro nuestra nuestros nuestras este esta estos estas ese esa esos esas'.split(' '));
  const FILLER = new Set('entonces justamente primeramente realmente basicamente simplemente obviamente digamos osea tipo verdad bueno pues asi solo tan tanto mismo misma parte cosa cosas forma manera dices dice decir hacer hace sabe saber puede pueden pudiera pudieran tenemos tener tienen tiene quiero quieres sea fuera ser estar estan esta tenga tengan otro otros otra otras'.split(' '));
  const EMPH = new Set('importante importantes nunca siempre jamas nadie todo todos toda todas nada mejor peor gratis dinero primero segundo tercero cuarto primera segunda tercera clave secreto error errores problema problemas peligro peligroso toxico toxicos danina danino muerte salud cuidado ojo increible enorme cero mil millones'.split(' '));
  const VERBISH = /(ar|er|ir|aba|aban|ando|iendo|ado|ados|ido|idos|ria|rian|iera|ieran|ara|aran|amos|emos|imos|aron|ieron|ian)$/;
  function wordScore(w) {
    const n = norm(w);
    if (!n || STOP.has(n) || ARTIC.has(n) || FILLER.has(n)) return -1;
    let sc = Math.min(n.length, 9);
    if (/\d/.test(n)) sc += 6;
    if (EMPH.has(n)) sc += 5;
    if (n.length <= 3) sc -= 3;
    if (VERBISH.test(n) && !EMPH.has(n)) sc -= 3;
    return sc;
  }
  function pickPhrase(t, maxWords) {
    const scores = t.map((x) => wordScore(x.w));
    let best = -1;
    scores.forEach((sc, i) => { if (sc > 0 && (best < 0 || sc >= scores[best])) best = i; });
    if (best < 0) return;
    const limit = Math.max(1, Math.min(maxWords, t.length - 1 || 1));
    let a = best, b = best;
    const endsPhrase = (w) => /[.,;:!?…)]$/.test(w);
    while (a > 0 && b - a + 1 < limit && !endsPhrase(t[a - 1].w)) {
      const n = norm(t[a - 1].w);
      if (ARTIC.has(n)) { a--; break; }
      if (scores[a - 1] > 0) a--; else break;
    }
    while (b < t.length - 1 && b - a + 1 < limit && !endsPhrase(t[b].w) && scores[b + 1] > 0) b++;
    for (let i = a; i <= b; i++) t[i].b = true;
  }
  function applyRule(s) {
    const rule = $('rule').value, t = s.tokens;
    t.forEach((x) => { x.b = false; });
    if (rule === 'phrase') pickPhrase(t, 3);
    else if (rule === 'keyword') pickPhrase(t, 1);
    else if (rule === 'lastN') { const n = Math.max(1, parseInt($('ruleN').value, 10) || 1); t.forEach((x, i) => { x.b = i >= t.length - n; }); }
    else if (rule === 'allButFirst') t.forEach((x, i) => { x.b = i > 0; });
    else if (rule === 'list') { const L = new Set($('ruleList').value.split(',').map((x) => norm(x.trim())).filter(Boolean)); t.forEach((x) => { x.b = L.has(norm(x.w)); }); }
  }
  function applyRuleAll() { subs.forEach(applyRule); }
  function syncRuleUI() {
    $('rowN').style.display = $('rule').value === 'lastN' ? '' : 'none';
    $('rowList').style.display = $('rule').value === 'list' ? '' : 'none';
  }
  $('rule').onchange = () => { syncRuleUI(); save(); };
  $('btnRule').onclick = () => { applyRuleAll(); changed(); };
  $('caps').onchange = () => { renderList(); save(); };

  // ---------- lista de subtítulos (editable) ----------
  const fmtT = (ms) => { ms = Math.max(0, Math.round(ms)); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), c = Math.floor(ms % 1000 / 10); return m + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0'); };
  function parseT(s) {
    s = String(s).trim().replace(',', '.');
    let m = s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
    if (m) return Math.round(((+m[1] || 0) * 3600 + +m[2] * 60 + +m[3]) * 1000);
    m = s.match(/^(\d+(?:\.\d+)?)$/); if (m) return Math.round(+m[1] * 1000);
    return null;
  }
  let projTimer = 0;
  function changed() { renderList(); queuePv(); clearTimeout(projTimer); projTimer = setTimeout(saveProject, 400); }
  function saveProject() {
    if (!media) return;
    try { localStorage.setItem('cs_proj:' + media.path.toLowerCase(), JSON.stringify({ subs, t: Date.now() })); } catch (e) {}
  }
  function renderList() {
    const caps = $('caps').checked, list = $('list');
    list.innerHTML = '';
    $('listTitle').textContent = 'Subtítulos' + (subs.length ? ' (' + subs.length + ')' : '');
    if (!subs.length) {
      const d = document.createElement('div'); d.className = 'empty';
      d.textContent = media ? 'Pulsa "Transcribir" o carga un .txt / .srt.' : 'Abre un video o audio para empezar.';
      list.appendChild(d); queuePv(); return;
    }
    subs.forEach((s, idx) => {
      const row = document.createElement('div'); row.className = 'sub' + (idx === selIndex ? ' on' : '');
      row.dataset.i = idx;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = idx + 1;
      const tIn = (key) => {
        const inp = document.createElement('input'); inp.className = 'tm'; inp.value = fmtT(s[key]); inp.title = key === 'start' ? 'Entra' : 'Sale';
        inp.onchange = () => {
          const v = parseT(inp.value);
          const other = key === 'start' ? s.end : s.start;
          if (v === null || (key === 'start' ? v >= other : v <= other)) { inp.classList.add('bad'); return; }
          inp.classList.remove('bad');
          s[key] = v;
          if (key === 'start') { subs.sort((a, b) => a.start - b.start); selIndex = subs.indexOf(s); }
          changed();
        };
        inp.onclick = (e) => e.stopPropagation();
        return inp;
      };
      const ws = document.createElement('div'); ws.className = 'words';
      s.tokens.forEach((t) => {
        const w = document.createElement('span');
        w.className = 'w' + (t.b ? ' b' : '');
        w.textContent = caps ? t.w.toLocaleUpperCase('es') : t.w;
        w.onclick = (e) => { e.stopPropagation(); t.b = !t.b; w.classList.toggle('b', t.b); selIndex = idx; seekTo(s); changed(); };
        ws.appendChild(w);
      });
      const ed = document.createElement('button'); ed.className = 'ic'; ed.textContent = '✎'; ed.title = 'Editar texto';
      ed.onclick = (e) => {
        e.stopPropagation();
        const inp = document.createElement('input'); inp.className = 'edit'; inp.value = markText(s);
        ws.replaceWith(inp); inp.focus();
        let done = false;
        const commit = (ok) => {
          if (done) return; done = true;
          const tk = tokenize(inp.value.trim());
          if (ok && tk.length) {
            const same = tk.length === s.tokens.length;
            s.tokens = tk;
            if (!same) delete s.wordStarts;
          }
          changed();
        };
        inp.onkeydown = (ev) => { if (ev.key === 'Enter') commit(true); else if (ev.key === 'Escape') commit(false); };
        inp.onblur = () => commit(true);
        inp.onclick = (ev) => ev.stopPropagation();
      };
      const add = document.createElement('button'); add.className = 'ic'; add.textContent = '+'; add.title = 'Agregar un subtítulo después de este';
      add.onclick = (e) => { e.stopPropagation(); insertAfter(idx); };
      const del = document.createElement('button'); del.className = 'ic'; del.textContent = '×'; del.title = 'Borrar este subtítulo';
      del.onclick = (e) => { e.stopPropagation(); subs.splice(idx, 1); if (selIndex >= subs.length) selIndex = subs.length - 1; changed(); };
      row.onclick = () => { selIndex = idx; markRow(); seekTo(s); };
      row.append(n, tIn('start'), tIn('end'), ws, ed, add, del);
      list.appendChild(row);
    });
    queuePv();
  }
  function markRow() {
    document.querySelectorAll('#list .sub').forEach((r) => r.classList.toggle('on', +r.dataset.i === selIndex));
  }
  function insertAfter(idx) {
    const prev = subs[idx], next = subs[idx + 1];
    const st = prev ? prev.end : Math.round(curTime() * 1000);
    const en = Math.min(st + 1500, next ? Math.max(st + 300, next.start) : st + 1500);
    const s = { start: st, end: en, tokens: tokenize('Texto *nuevo*') };
    subs.splice(idx + 1, 0, s); subs.sort((a, b) => a.start - b.start);
    selIndex = subs.indexOf(s); changed(); seekTo(s);
  }
  $('btnAdd').onclick = () => {
    const ms = Math.round(curTime() * 1000);
    let idx = -1; subs.forEach((s, i) => { if (s.start <= ms) idx = i; });
    if (idx >= 0 && subs[idx].end > ms) { insertAfter(idx); return; }
    const next = subs[idx + 1];
    const s = { start: ms, end: next ? Math.max(ms + 300, Math.min(ms + 1500, next.start)) : ms + 1500, tokens: tokenize('Texto *nuevo*') };
    subs.splice(idx + 1, 0, s); selIndex = idx + 1; changed(); seekTo(s);
  };
  $('btnSrt').onclick = async () => {
    if (!subs.length) { status('No hay subtítulos para guardar.', 'err'); return; }
    const base = media ? path.join(path.dirname(media.path), path.parse(media.path).name + '.srt') : 'subtitulos.srt';
    const f = await ipcRenderer.invoke('save-dialog', { title: 'Guardar .srt', defaultPath: base, filters: [{ name: 'SubRip', extensions: ['srt'] }] });
    if (!f) return;
    const tc = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), x = Math.round(ms % 1000); return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':') + ',' + String(x).padStart(3, '0'); };
    const txt = subs.map((s, i) => (i + 1) + '\r\n' + tc(s.start) + ' --> ' + tc(s.end) + '\r\n' + markText(s) + '\r\n').join('\r\n');
    try { fs.writeFileSync(f, '\uFEFF' + txt, 'utf8'); status('Guardado (las *asteriscos* marcan el bold):\n' + f, 'ok'); } catch (e) { status(e.message, 'err'); }
  };

  // ---------- reproductor y vista previa ----------
  const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? h + ' h ' + m + ' min' : m ? m + ' min ' + x + ' s' : x + ' s'; };
  const clock = (sec) => fmtT(sec * 1000);
  function outSize() {
    if (media && media.hasVideo) return { W: media.W, H: media.H, fps: media.fps, fpsStr: media.fpsStr };
    return pvFmt === 'v' ? { W: 1080, H: 1920, fps: 30, fpsStr: '30' } : { W: 1920, H: 1080, fps: 30, fpsStr: '30' };
  }
  function curTime() { return media ? (vid.currentTime || 0) : vT; }
  function duration() { return media ? media.dur : Math.max(1, subs.length ? subs[subs.length - 1].end / 1000 + 0.5 : 1); }
  function seekTo(s) {
    const t = s.start / 1000 + Math.min(0.6, (s.end - s.start) / 2000);
    if (media) { vid.currentTime = t; } else vT = t;
    queuePv();
  }
  function fitFrame() {
    const { W, H } = outSize();
    const st = $('stage'), aw = st.clientWidth - 16, ah = st.clientHeight - 16;
    const k = Math.min(aw / W, ah / H);
    const fw = Math.max(10, Math.floor(W * k)), fh = Math.max(10, Math.floor(H * k));
    const fr = $('frame');
    if (fr.style.width !== fw + 'px' || fr.style.height !== fh + 'px') { fr.style.width = fw + 'px'; fr.style.height = fh + 'px'; }
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(fw * dpr), ch = Math.round(fh * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  }
  let pvRaf = 0;
  function queuePv() { if (!pvRaf) pvRaf = requestAnimationFrame(drawPv); }
  const SAMPLE = { start: 0, end: 3000, tokens: (localStorage.getItem('sb_lang') === 'en'
    ? [{ w: 'When' }, { w: 'the' }, { w: 'water' }, { w: 'boils', b: true }, { w: 'down,' }]
    : [{ w: 'Cuando' }, { w: 'se' }, { w: 'hierve', b: true }, { w: 'el' }, { w: 'agua,' }]) };
  function drawPv() {
    pvRaf = 0;
    if (exporting) return;
    syncHex();
    fitFrame();
    const { W, H, fps } = outSize();
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const k = cv.width / W;
    // zona segura 9:16 (solo en la vista previa)
    if (H > W && $('safeZone').checked) {
      ctx.fillStyle = 'rgba(255,70,70,.16)';
      ctx.fillRect(0, 0, cv.width, cv.height * 0.14);
      ctx.fillRect(0, cv.height * 0.78, cv.width, cv.height * 0.22);
      ctx.fillRect(cv.width * 0.87, cv.height * 0.14, cv.width * 0.13, cv.height * 0.64);
    }
    const T = curTime(), st = curStyle();
    if (!subs.length) R.drawSub(ctx, SAMPLE, 10, st, W, H, fps, k);
    else {
      const s = R.activeAt(subs, T);
      if (s) {
        R.drawSub(ctx, s, T - s.start / 1000, st, W, H, fps, k);
        const i = subs.indexOf(s);
        if (i !== selIndex) { selIndex = i; markRow(); const row = document.querySelector('#list .sub.on'); if (row && !vid.paused) row.scrollIntoView({ block: 'nearest' }); }
      }
    }
    $('tcNow').textContent = clock(T) + ' / ' + clock(duration());
    if (document.activeElement !== $('scrub')) $('scrub').value = Math.round(T / duration() * 1000);
    $('btnPlay').textContent = vid.paused ? '▶' : '❚❚';
    if (media && !vid.paused) queuePv();
  }
  $('btnPlay').onclick = () => { if (!media) return; if (vid.paused) vid.play(); else vid.pause(); queuePv(); };
  $('scrub').oninput = () => { const t = +$('scrub').value / 1000 * duration(); if (media) vid.currentTime = t; else vT = t; queuePv(); };
  vid.addEventListener('seeked', queuePv); vid.addEventListener('timeupdate', queuePv);
  vid.addEventListener('play', queuePv); vid.addEventListener('pause', queuePv);
  document.querySelectorAll('#pvFmt button').forEach((b) => { b.onclick = () => { pvFmt = b.dataset.f; syncFmtSeg(); save(); queuePv(); }; });
  function syncFmtSeg() {
    document.querySelectorAll('#pvFmt button').forEach((b) => b.classList.toggle('on', b.dataset.f === pvFmt));
    $('pvFmt').style.display = (media && media.hasVideo) ? 'none' : '';
    updateExpInfo();
  }
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); $('btnPlay').onclick(); }
  });
  document.addEventListener('input', () => queuePv());
  document.addEventListener('change', () => queuePv());
  window.addEventListener('resize', queuePv);

  // ---------- ffmpeg ----------
  let ffProc = null;
  function runFfmpeg(args, onLine) {
    return new Promise((res, rej) => {
      const p = cp.spawn(INFO.ffmpeg, args, { windowsHide: true });
      ffProc = p;
      let err = '';
      p.stderr.on('data', (d) => { const t = d.toString(); err += t; if (err.length > 20000) err = err.slice(-10000); if (onLine) t.split(/\r|\n/).forEach(onLine); });
      p.on('error', (e) => { ffProc = null; rej(e); });
      p.on('close', (code) => { ffProc = null; if (code === 0) res(err); else rej(Object.assign(new Error('ffmpeg terminó con error ' + code + '\n' + err.trim().split(/\r?\n/).slice(-3).join('\n')), { log: err })); });
    });
  }
  // lee tamaño, fps y duración (ffmpeg -i siempre "falla" sin salida: se usa el texto)
  async function probe(file) {
    let log = '';
    try { log = await runFfmpeg(['-hide_banner', '-i', file]); } catch (e) { log = e.log || ''; }
    const d = log.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const dur = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0;
    const vl = log.split(/\r?\n/).find((l) => /Stream #.*Video:/.test(l) && !/attached pic/.test(l));
    const hasAudio = /Stream #.*Audio:/.test(log);
    if (!vl) return { dur, hasVideo: false, hasAudio };
    const sz = vl.match(/,\s*(\d{2,5})x(\d{2,5})[\s,\[]/);
    let W = sz ? +sz[1] : 1920, H = sz ? +sz[2] : 1080;
    const rot = log.match(/rotation of (-?\d+(?:\.\d+)?) degrees/) || log.match(/rotate\s*:\s*(-?\d+)/);
    if (rot && Math.abs(Math.round(+rot[1])) % 180 === 90) { const t = W; W = H; H = t; }
    const fm = vl.match(/([\d.]+)\s*fps/) || vl.match(/([\d.]+)\s*tbr/);
    let f = fm ? +fm[1] : 30;
    const NTSC = { 23.98: '24000/1001', 23.976: '24000/1001', 29.97: '30000/1001', 47.95: '48000/1001', 59.94: '60000/1001', 119.88: '120000/1001' };
    let fpsStr;
    if (NTSC[f]) { fpsStr = NTSC[f]; const [a, b] = fpsStr.split('/'); f = a / b; }
    else if (Math.abs(f - Math.round(f)) < 0.06) { f = Math.round(f); fpsStr = String(f); }
    else fpsStr = String(f);
    if (!(f > 1 && f < 300)) { f = 30; fpsStr = '30'; }
    return { dur, hasVideo: true, hasAudio, W: W + (W % 2), H: H + (H % 2), fps: f, fpsStr };
  }

  // ---------- abrir video o audio ----------
  async function openMedia(file) {
    if (exporting) return;
    $('mediaInfo').textContent = 'Leyendo ' + path.basename(file) + '…';
    let info;
    try { info = await probe(file); } catch (e) { $('mediaInfo').textContent = 'No pude leer el archivo: ' + e.message; return; }
    if (!info.dur || (!info.hasVideo && !info.hasAudio)) { $('mediaInfo').textContent = 'Ese archivo no tiene video ni audio que se pueda leer.'; return; }
    if (media && media.proxy) { try { fs.unlinkSync(media.proxy); } catch (e) {} }
    media = Object.assign({ path: file }, info);
    vid.pause();
    vid.src = pathToFileURL(file).href;
    $('dropHint').style.display = 'none';
    const desc = path.basename(file) + ' · ' + (info.hasVideo ? info.W + '×' + info.H + ' · ' + (Math.round(info.fps * 100) / 100) + ' fps · ' : 'solo audio · ') + hms(info.dur);
    $('mediaInfo').textContent = desc;
    // proyecto guardado de este archivo
    subs = []; selIndex = -1;
    try {
      const pj = JSON.parse(localStorage.getItem('cs_proj:' + file.toLowerCase()) || 'null');
      if (pj && Array.isArray(pj.subs) && pj.subs.length) { subs = pj.subs; $('txtInfo').textContent = 'Subtítulos recuperados de la última sesión · ' + subs.length; }
      else $('txtInfo').textContent = '—';
    } catch (e) {}
    syncFmtSeg(); renderList(); queuePv();
  }
  // si Chromium no puede reproducir el códec (ProRes, HEVC, AVI…) se arma una copia liviana solo para la vista previa
  vid.addEventListener('error', async () => {
    if (!media || media.proxy || media.proxyBusy) return;
    media.proxyBusy = true;
    const m = media, proxy = path.join(os.tmpdir(), 'cs_proxy_' + Date.now() + '.mp4');
    const txt = $('mediaInfo').textContent;
    try {
      await runFfmpeg(['-y', '-hide_banner', '-i', m.path, '-vf', 'scale=-2:min(720\\,ih)', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', proxy],
        (l) => { const t = l.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/); if (t && media === m) $('mediaInfo').textContent = 'Preparando la vista previa… ' + Math.min(99, Math.round((+t[1] * 3600 + +t[2] * 60 + +t[3]) / m.dur * 100)) + '%'; });
      if (media !== m) { try { fs.unlinkSync(proxy); } catch (e) {} return; }
      m.proxy = proxy; vid.src = pathToFileURL(proxy).href; $('mediaInfo').textContent = txt;
    } catch (e) { if (media === m) $('mediaInfo').textContent = txt + '\nNo se puede previsualizar este archivo, pero sí transcribir y exportar.'; }
  });
  $('btnOpen').onclick = async () => {
    const r = await ipcRenderer.invoke('open-dialog', { title: 'Abrir video o audio', properties: ['openFile'],
      filters: [{ name: 'Video o audio', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mts', 'm2ts', 'mxf', 'wmv', 'flv', '3gp', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma'] }, { name: 'Todos', extensions: ['*'] }] });
    if (r) openMedia(r[0]);
  };
  const stage = $('stage');
  ['dragenter', 'dragover'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove('drag'); }));
  stage.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const p = webUtils ? webUtils.getPathForFile(f) : f.path;
    if (/\.(txt|srt)$/i.test(p)) { status('Para cargar subtítulos usa "Cargar .txt / .srt".', 'err'); return; }
    if (p) openMedia(p);
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // =================== Transcripción con Whisper (whisper.cpp, local) ===================
  // Motor oficial de whisper.cpp: elige en tiempo de ejecución la variante para el CPU
  // (ggml-cpu-sandybridge.dll en CPUs con AVX y sin AVX2, como un Xeon E5 v2).
  // Se comparte carpeta con el panel Captionation: si ya bajó el modelo, no se vuelve a bajar.
  const W_ENGINE = { url: 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-blas-bin-x64.zip', exe: 'whisper\\Release\\whisper-cli.exe' };
  const W_MODELS = {
    small:  { file: 'ggml-small-q8_0.bin',          size: 264464607, sha: '49c8fb02b65e6049d5fa6c04f81f53b867b5ec9540406812c643f177317f779f' },
    medium: { file: 'ggml-medium-q8_0.bin',         size: 823369779, sha: '42a1ffcbe4167d224232443396968db4d02d4e8e87e213d3ee2e03095dea6502' },
    turbo:  { file: 'ggml-large-v3-turbo-q8_0.bin', size: 874188075, sha: '317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1' }
  };
  const W_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
  let wProc = null, wCancel = false, wBusy = false;
  function wSet(msg, pct, kind) { $('wStatus').textContent = msg; $('wStatus').className = 'msg ' + (kind || ''); if (pct !== undefined) $('wBar').style.width = Math.max(0, Math.min(100, pct)) + '%'; }
  const wBase = () => path.join(process.env.LOCALAPPDATA || os.homedir(), 'SubtitulosBold');
  const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
  function wDownload(url, dest, onProg) {
    return new Promise((res, rej) => {
      const go = (u, n) => {
        const req = https.get(u, { headers: { 'User-Agent': 'CaptionationStudio' } }, (r) => {
          if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && n < 10) { r.resume(); go(new URL(r.headers.location, u).toString(), n + 1); return; }
          if (r.statusCode !== 200) { r.resume(); rej(new Error('HTTP ' + r.statusCode + ' al descargar')); return; }
          const total = +r.headers['content-length'] || 0; let got = 0;
          const out = fs.createWriteStream(dest);
          r.on('data', (c) => { got += c.length; if (wCancel) { req.destroy(); out.destroy(); rej(new Error('Cancelado')); } else if (onProg) onProg(got, total); });
          r.pipe(out);
          out.on('finish', () => out.close(() => res()));
          r.on('error', rej); out.on('error', rej);
        });
        req.on('error', rej);
      };
      go(url, 0);
    });
  }
  function wSha256(file) {
    const crypto = require('crypto');
    return new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
  }
  function wRun(exe, args, onErrLine, onOutLine) {
    return new Promise((res, rej) => {
      const p = cp.spawn(exe, args, { windowsHide: true, cwd: path.dirname(exe) });
      wProc = p;
      let err = '';
      p.stderr.on('data', (d) => { const t = d.toString(); err += t; if (err.length > 20000) err = err.slice(-10000); if (onErrLine) t.split(/\r?\n/).forEach(onErrLine); });
      p.stdout.on('data', (d) => { if (onOutLine) d.toString().split(/\r?\n/).forEach(onOutLine); });
      p.on('error', rej);
      p.on('close', (code) => { wProc = null; if (code === 0) res(); else rej(new Error(wCancel ? 'Cancelado' : 'whisper terminó con error ' + code + '\n' + err.split(/\r?\n/).slice(-4).join('\n'))); });
    });
  }
  async function wEnsureEngine() {
    const base = wBase(), exe = path.join(base, W_ENGINE.exe);
    if (fs.existsSync(exe)) return exe;
    fs.mkdirSync(base, { recursive: true });
    const zip = path.join(base, 'whisper-engine.zip');
    await wDownload(W_ENGINE.url, zip, (g, t) => wSet('Descargando el motor de transcripción… ' + mb(g) + (t ? ' de ' + mb(t) : ''), t ? g / t * 100 : 0));
    wSet('Instalando el motor…', 100);
    const q = (p) => "'" + p.replace(/'/g, "''") + "'";
    await new Promise((res, rej) => cp.execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      'Expand-Archive -LiteralPath ' + q(zip) + ' -DestinationPath ' + q(path.join(base, 'whisper')) + ' -Force'],
      { windowsHide: true }, (e) => (e ? rej(e) : res())));
    try { fs.unlinkSync(zip); } catch (e) {}
    if (!fs.existsSync(exe)) throw new Error('No se pudo instalar el motor de transcripción.');
    return exe;
  }
  async function wEnsureModel(key) {
    const m = W_MODELS[key], dir = path.join(wBase(), 'models'), file = path.join(dir, m.file);
    if (fs.existsSync(file) && fs.statSync(file).size === m.size) return file;
    fs.mkdirSync(dir, { recursive: true });
    const part = file + '.part';
    await wDownload(W_MODEL_URL + m.file, part, (g) => wSet('Descargando el modelo (solo la primera vez)… ' + mb(g) + ' de ' + mb(m.size), g / m.size * 100));
    wSet('Verificando el modelo…', 100);
    const h = await wSha256(part);
    if (h !== m.sha) { try { fs.unlinkSync(part); } catch (e) {} throw new Error('El modelo descargado no es válido (huella distinta). Intenta de nuevo.'); }
    fs.renameSync(part, file);
    return file;
  }

  // Agrupa palabras [{t, from, to} en ms] en subtítulos, sin terminar en conectores
  const CONN = new Set('a al ante con contra de del desde en entre hacia hasta para por sin sobre tras el la los las lo le les un una unos unas y e o u ni que se me te nos su sus mi mis tu tus es muy mas más pero como si cuando donde porque pues ya'.split(' '));
  function wSegment(words, maxChars) {
    const out = [];
    let cur = [];
    const len = (arr) => arr.reduce((a, w) => a + w.t.length + 1, -1);
    const flush = () => {
      if (!cur.length) return;
      const st = cur[0].from, en = cur[cur.length - 1].to;
      out.push({ start: st, end: Math.max(en, st + 400), tokens: cur.map((w) => ({ w: w.t, b: false })), wordStarts: cur.map((w) => (w.from - st) / 1000) });
      cur = [];
    };
    words.forEach((w) => {
      const prev = cur[cur.length - 1];
      if (prev) {
        const gap = w.from - prev.to;
        const would = len(cur) + 1 + w.t.length;
        const strongEnd = /[.!?…]$/.test(prev.t);
        const softEnd = /[,;:]$/.test(prev.t) && len(cur) >= maxChars * 0.5;
        if (gap > 600 || strongEnd || softEnd) flush();
        else if (would > maxChars) {
          const carry = [];
          while (cur.length > 1 && !/[.,;:!?…]$/.test(cur[cur.length - 1].t) && CONN.has(cur[cur.length - 1].t.toLowerCase().replace(/[^a-záéíóúüñ]/g, ''))) carry.unshift(cur.pop());
          flush(); cur = carry;
        }
      }
      cur.push(w);
    });
    flush();
    // si la pausa entre dos subtítulos es corta, el anterior se queda hasta que entra el siguiente
    for (let i = 0; i < out.length - 1; i++) {
      const gap = out[i + 1].start - out[i].end;
      if (gap > 0 && gap < 350) out[i].end = out[i + 1].start;
    }
    return out;
  }
  // Corrige palabras de marca mal escritas por parecido
  function wDist(a, b) {
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function wFixVocab(words, vocab) {
    const list = vocab.split(',').map((x) => x.trim()).filter((x) => x && !/\s/.test(x));
    words.forEach((w) => {
      const m = w.t.match(/^([¿¡"'(«]*)(.*?)([.,;:!?…"')»]*)$/);
      if (!m || !m[2]) return;
      const n = norm(m[2]);
      for (const v of list) {
        const nv = norm(v);
        if (n === nv) { w.t = m[1] + v + m[3]; return; }
        if (nv.length >= 4 && n[0] === nv[0] && n.length <= nv.length && nv.length - n.length <= 1 && wDist(n, nv) <= 1) { w.t = m[1] + v + m[3]; return; }
      }
    });
  }

  $('btnWhisperStop').onclick = () => {
    wCancel = true;
    if (wProc) { try { wProc.kill(); } catch (e) {} }
    if (ffProc && wBusy) { try { ffProc.kill(); } catch (e) {} }
  };
  $('btnWhisper').onclick = async () => {
    if (!media) { wSet('Primero abre un video o audio.', 0, 'err'); return; }
    if (!media.hasAudio) { wSet('Ese archivo no tiene audio.', 0, 'err'); return; }
    if (subs.length && !(await ipcRenderer.invoke('confirm', 'Ya hay ' + subs.length + ' subtítulos. ¿Reemplazarlos con una transcripción nueva?'))) return;
    wCancel = false; wBusy = true;
    $('btnWhisper').disabled = true; $('btnWhisperStop').style.display = '';
    $('wLive').textContent = '';
    let wav = null, outBase = null;
    const clean = () => { [wav, outBase && outBase + '.json'].forEach((f) => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} }); };
    try { fs.readdirSync(os.tmpdir()).filter((n) => /^cs_audio_\d+\.(wav|json)$/i.test(n)).forEach((n) => { try { fs.unlinkSync(path.join(os.tmpdir(), n)); } catch (e) {} }); } catch (e) {}
    try {
      const durS = media.dur;
      const exe = await wEnsureEngine();
      const model = await wEnsureModel($('wModel').value);
      if (wCancel) throw new Error('Cancelado');

      wav = path.join(os.tmpdir(), 'cs_audio_' + Date.now() + '.wav');
      wSet('Paso 1 de 2 · Extrayendo el audio…', 0);
      await runFfmpeg(['-y', '-hide_banner', '-i', media.path, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], (l) => {
        const t = l.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (t) { const p = (+t[1] * 3600 + +t[2] * 60 + +t[3]) / durS * 100; wSet('Paso 1 de 2 · Extrayendo el audio… ' + Math.min(100, Math.round(p)) + '%', p); }
      });
      if (wCancel) throw new Error('Cancelado');

      outBase = wav.replace(/\.wav$/i, '');
      const threads = Math.max(2, Math.min(16, (os.cpus() || []).length || 4));
      const args = ['-m', model, '-f', wav, '-l', $('wLang').value, '-ml', '1', '-sow', '-oj', '-of', outBase, '-pp', '-t', String(threads)];
      const vocab = $('wPrompt').value.trim();
      if (vocab) args.push('--prompt', 'En este video se menciona: ' + vocab + '.');
      const t0 = Date.now(); let pct = 0; const live = [];
      const show = () => {
        const el = (Date.now() - t0) / 1000;
        const eta = pct >= 2 ? ' · faltan ~' + hms(el * (100 - pct) / pct) : '';
        wSet('Paso 2 de 2 · Transcribiendo ' + hms(durS) + ' de audio… ' + pct + '% · ' + hms(el) + eta, pct);
      };
      const tick = setInterval(show, 1000); show();
      const toSec = (h, m, x) => +h * 3600 + +m * 60 + +x;
      try {
        await wRun(exe, args,
          (line) => { const m = line.match(/progress\s*=\s*(\d+)%/); if (m) pct = Math.max(pct, +m[1]); },
          (line) => {
            const m = line.match(/-->\s*(\d+):(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/); if (!m) return;
            pct = Math.max(pct, Math.min(99, Math.floor(toSec(m[1], m[2], m[3]) / durS * 100)));
            const w = m[4].trim(); if (w && !/^\[.*\]$/.test(w)) { live.push(w); if (live.length > 14) live.shift(); $('wLive').textContent = '… ' + live.join(' '); }
          });
      } finally { clearInterval(tick); }

      const json = JSON.parse(fs.readFileSync(outBase + '.json', 'utf8'));
      const words = [];
      (json.transcription || []).forEach((seg) => {
        const t = (seg.text || '').trim();
        if (!t || /^\[.*\]$|^\(.*\)$/.test(t)) return;
        t.split(/\s+/).forEach((p) => words.push({ t: p, from: seg.offsets.from, to: seg.offsets.to }));
      });
      if (!words.length) throw new Error('No se detectó voz en el audio.');
      if (vocab) wFixVocab(words, vocab);
      subs = wSegment(words, Math.max(8, +$('wMax').value || 26));
      applyRuleAll(); selIndex = -1; changed();
      $('txtInfo').textContent = 'Transcripción · ' + subs.length + ' subtítulos · ' + words.length + ' palabras';
      wSet('Listo: ' + subs.length + ' subtítulos. Revisa el bold y los textos en la lista y exporta.', 100, 'ok');
      $('wLive').textContent = '';
    } catch (e) {
      wSet((e && e.message) || String(e), 0, 'err');
    } finally {
      clean(); wBusy = false;
      $('btnWhisper').disabled = false; $('btnWhisperStop').style.display = 'none';
    }
  };

  // =================== Exportar ===================
  let expFmt = 'prores', lastOut = '', expCancel = false;
  const EXT = { prores: 'mov', webm: 'webm', burn: 'mp4' };
  function syncFmt() {
    document.querySelectorAll('.fmtOpt').forEach((o) => { const on = o.dataset.fmt === expFmt; o.classList.toggle('on', on); o.querySelector('input').checked = on; });
    updateExpInfo();
  }
  function updateExpInfo() {
    const { W, H, fpsStr, fps } = outSize();
    $('expInfo').textContent = W + '×' + H + ' · ' + (Math.round(fps * 100) / 100) + ' fps' + (fpsStr.includes('/') ? ' (' + fpsStr + ')' : '') + ' · ' + hms(duration()) +
      (media && media.hasVideo ? ' · igual que el video' : ' · formato ' + (pvFmt === 'v' ? '9:16' : '16:9'));
  }
  document.querySelectorAll('.fmtOpt').forEach((o) => { o.onclick = () => { expFmt = o.dataset.fmt; syncFmt(); save(); }; });
  $('btnExportStop').onclick = () => { expCancel = true; if (ffProc && exporting) { try { ffProc.stdin.destroy(); ffProc.kill(); } catch (e) {} } };
  $('btnShow').onclick = () => { if (lastOut) ipcRenderer.invoke('show-item', lastOut); };

  $('btnExport').onclick = async () => {
    if (exporting) return;
    if (!subs.length) { status('No hay subtítulos para exportar. Transcribe o carga un .txt / .srt.', 'err'); return; }
    if (expFmt === 'burn' && !(media && media.hasVideo)) { status('Para quemar los subtítulos hace falta abrir un video.', 'err'); return; }
    const name = (media ? path.parse(media.path).name : 'subtitulos') + '_captionation';
    const dir0 = media ? path.dirname(media.path) : os.homedir();
    let out;
    if (expFmt === 'png') {
      const r = await ipcRenderer.invoke('open-dialog', { title: 'Elige dónde crear la carpeta de imágenes PNG', defaultPath: dir0, properties: ['openDirectory', 'createDirectory'] });
      if (!r) return;
      out = path.join(r[0], name + '_png'); let i = 2; while (fs.existsSync(out)) out = path.join(r[0], name + '_png_' + i++);
    } else {
      const ext = EXT[expFmt];
      out = await ipcRenderer.invoke('save-dialog', { title: 'Exportar', defaultPath: path.join(dir0, name + (expFmt === 'burn' ? '_quemado' : '') + '.' + ext), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (!out) return;
      if (!new RegExp('\\.' + ext + '$', 'i').test(out)) out += '.' + ext;
      if (media && path.resolve(out).toLowerCase() === path.resolve(media.path).toLowerCase()) { status('Elige otro nombre: no se puede reemplazar el video original.', 'err'); return; }
    }
    return runExport(expFmt, out);
  };

  async function runExport(fmt, out) {
    if (exporting) return false;
    if (fmt === 'burn' && !(media && media.hasVideo)) { status('Para quemar los subtítulos hace falta abrir un video.', 'err'); return false; }
    const expFmt = fmt;
    const { W, H, fps, fpsStr } = outSize();
    let pattern, name = path.basename(out).replace(/_png(_\d+)?$/, '');
    if (expFmt === 'png') { fs.mkdirSync(out, { recursive: true }); pattern = path.join(out, name + '_%05d.png'); }
    const dur = duration(), nFrames = Math.max(1, Math.ceil(dur * fps - 1e-6));
    const raw = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', fpsStr, '-i', 'pipe:0'];
    const head = ['-y', '-hide_banner', '-loglevel', 'error', '-stats'];
    let args;
    if (expFmt === 'prores') args = head.concat(raw, ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', '-bits_per_mb', '8000', out]);
    else if (expFmt === 'webm') args = head.concat(raw, ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-auto-alt-ref', '0', out]);
    else if (expFmt === 'png') args = head.concat(raw, ['-c:v', 'png', '-pix_fmt', 'rgba', '-start_number', '0', pattern]);
    else args = head.concat(['-i', media.path], raw, ['-filter_complex', '[0:v][1:v]overlay=0:0:format=auto:eof_action=pass,format=yuv420p[v]',
      '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);

    exporting = true; expCancel = false; vid.pause();
    $('btnExport').disabled = true; $('btnExportStop').style.display = ''; $('btnShow').style.display = 'none';
    $('btnWhisper').disabled = true; $('btnOpen').disabled = true;
    const t0 = Date.now();
    const show = (n) => {
      const el = (Date.now() - t0) / 1000, p = n / nFrames;
      status('Exportando cuadro ' + n + ' de ' + nFrames + ' · ' + Math.round(p * 100) + '%' + (p > 0.02 ? ' · faltan ~' + hms(el * (1 - p) / p) : ''));
      $('eBar').style.width = (p * 100) + '%';
    };
    try {
      await loadFaces();
      await document.fonts.ready;
      const ec = document.createElement('canvas'); ec.width = W; ec.height = H;
      const ctx = ec.getContext('2d', { willReadFrequently: true });
      const style = curStyle();
      const blank = Buffer.alloc(W * H * 4);
      const proc = cp.spawn(INFO.ffmpeg, args, { windowsHide: true });
      ffProc = proc;
      let err = '';
      proc.stderr.on('data', (d) => { err += d.toString(); if (err.length > 20000) err = err.slice(-10000); });
      const closed = new Promise((res) => proc.on('close', res));
      let broken = false;
      proc.stdin.on('error', () => { broken = true; });
      const write = (buf) => new Promise((res) => { if (broken) { res(); return; } if (proc.stdin.write(buf)) res(); else proc.stdin.once('drain', res); });
      let lastShow = 0;
      for (let n = 0; n < nFrames; n++) {
        if (expCancel || broken) break;
        const T = n / fps;
        const s = R.activeAt(subs, T);
        if (!s) await write(blank);
        else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, W, H);
          R.drawSub(ctx, s, T - s.start / 1000, style, W, H, fps, 1);
          const img = ctx.getImageData(0, 0, W, H);
          await write(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength));
        }
        if (Date.now() - lastShow > 250) { lastShow = Date.now(); show(n); await new Promise((r) => setTimeout(r, 0)); }
      }
      try { proc.stdin.end(); } catch (e) {}
      const code = await closed;
      ffProc = null;
      if (expCancel) throw new Error('Cancelado');
      if (code !== 0) throw new Error('ffmpeg terminó con error ' + code + '\n' + err.trim().split(/\r?\n/).filter((l) => !/^frame=/.test(l)).slice(-4).join('\n'));
      lastOut = expFmt === 'png' ? path.join(out, name + '_00000.png') : out;
      $('eBar').style.width = '100%';
      status('Listo en ' + hms((Date.now() - t0) / 1000) + ':\n' + out + (expFmt === 'png' ? '\n(' + nFrames + ' imágenes PNG, ' + (Math.round(fps * 100) / 100) + ' fps)' : ''), 'ok');
      $('btnShow').style.display = '';
      return true;
    } catch (e) {
      status((e && e.message) || String(e), 'err');
      $('eBar').style.width = '0';
      if (expCancel && expFmt !== 'png') { try { fs.unlinkSync(out); } catch (e2) {} }
      return false;
    } finally {
      exporting = false; ffProc = null;
      $('btnExport').disabled = false; $('btnExportStop').style.display = 'none';
      $('btnWhisper').disabled = false; $('btnOpen').disabled = false;
      queuePv();
    }
  }
  // para las pruebas automáticas (tools/prueba-app.js)
  window.CS = { openMedia, runExport, getSubs: () => subs, setSubs: (s) => { subs = s; changed(); }, seek: (t) => { vid.currentTime = t; queuePv(); } };

  // azul = acción nueva · amarillo = ajustar
  ['btnTxt', 'btnPresetExport', 'btnPresetImport', 'btnSwAdd'].forEach((id) => $(id).classList.add('primary'));
  ['btnRule', 'btnPresetSave', 'btnFonts'].forEach((id) => $(id).classList.add('adj'));

  // ---------- inicio ----------
  (async () => {
    INFO = await ipcRenderer.invoke('info');
    $('verTxt').textContent = INFO.version;
    try { fontList = JSON.parse(localStorage.getItem('cs_fonts') || '[]'); } catch (e) { fontList = []; }
    if (fontList.length) $('fontInfo').textContent = fontList.length + ' fuentes'; else scanFonts();
    STYLE_IDS.concat(UI_IDS, ['caps', 'safeZone']).forEach((k) => { $(k).addEventListener('change', save); });
    load();
    setAlign(align); setActive(activeColor);
    renderSwatches(); renderPresets(); syncRuleUI(); syncFmt(); syncFmtSeg(); syncFontSel(); loadFaces();
    renderList();
    if (!fs.existsSync(INFO.ffmpeg)) status('Falta ffmpeg (' + INFO.ffmpeg + '). Reinstala Captionation Studio.', 'err');
    // aviso de versión nueva (version.json de la web; sin internet no pasa nada)
    setTimeout(async () => {
      try {
        const j = await getJson(SITE + 'version.json?t=' + Date.now());
        const c = j && j.studio;
        if (!c || !newer(c.version, INFO.version)) return;
        $('updTxt').textContent = 'Nueva versión ' + c.version + ' disponible' + (c.notes ? ': ' + c.notes : '');
        $('updBtn').onclick = () => openUrl(c.url || SITE);
        $('updBar').classList.add('on');
      } catch (e) {}
    }, 1500);
    const arg = process.argv.find((a) => /\.(mp4|mov|m4v|mkv|webm|avi|mp3|wav|m4a)$/i.test(a));
    if (arg && fs.existsSync(arg)) openMedia(arg);
  })();
})();
