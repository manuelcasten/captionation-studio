// Prueba automática de punta a punta. Se ejecuta DENTRO de la ventana de la app:
//   set CS_TEST=tools\prueba-app.js & set CS_TEST_DIR=carpeta-con-prueba.mp4 & npx electron .
// Abre el video, transcribe con Whisper, exporta en los formatos pedidos (CS_TEST_FMTS) y guarda capturas.
(async () => {
  const { ipcRenderer } = require('electron');
  const path = require('path');
  const log = (...a) => console.log('[prueba] ' + a.join(' '));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (id) => document.getElementById(id);
  const dir = process.env.CS_TEST_DIR, video = path.join(dir, process.env.CS_TEST_VIDEO || 'prueba_vertical.mp4');
  try {
    await sleep(800);
    localStorage.removeItem('cs_proj:' + video.toLowerCase());
    await window.CS.openMedia(video);
    log('video:', $('mediaInfo').textContent);
    await sleep(1500);
    await ipcRenderer.invoke('test-shot', path.join(dir, 'shot1.png'));
    if (process.env.CS_TEST_SRT) {
      // sin transcribir: subtítulos fijos para probar exportaciones rápido
      window.CS.setSubs(JSON.parse(process.env.CS_TEST_SRT));
    } else {
      $('wModel').value = process.env.CS_TEST_MODEL || 'medium';
      const t0 = Date.now();
      $('btnWhisper').click();
      while (!/\b(ok|err)\b/.test($('wStatus').className)) await sleep(500);
      log('whisper (' + Math.round((Date.now() - t0) / 1000) + ' s):', $('wStatus').textContent);
    }
    const subs = window.CS.getSubs();
    log('subtitulos:', JSON.stringify(subs.map((s) => [s.start, s.end, s.tokens.map((t) => (t.b ? '*' : '') + t.w).join(' ')])));
    if (subs[1]) { window.CS.seek(subs[1].start / 1000 + 0.6); await sleep(1200); }
    await ipcRenderer.invoke('test-shot', path.join(dir, 'shot2.png'));
    // línea de tiempo, cortar/unir, selector de color, marcas y fuentes fijadas (CS_TEST_UI=1)
    if (process.env.CS_TEST_UI) {
      const n0 = window.CS.getSubs().length, s0 = window.CS.getSubs()[0];
      window.CS.seek((s0.start + (s0.end - s0.start) * 0.6) / 1000); await sleep(600);
      $('btnCut').click(); await sleep(300);
      const a = window.CS.getSubs();
      log('cortar: ' + n0 + ' -> ' + a.length + ' · ' + JSON.stringify(a.slice(0, 2).map((s) => [s.start, s.end, s.tokens.map((t) => t.w).join(' ')])));
      $('btnJoin').click(); await sleep(300);
      log('unir: -> ' + window.CS.getSubs().length + ' · bloques en la línea de tiempo: ' + document.querySelectorAll('#tlTrack .blk').length);
      // arrastrar el borde derecho del 2º bloque 40 px a la izquierda
      const blk = document.querySelectorAll('#tlTrack .blk')[1], h = blk.querySelector('.h.r'), r = h.getBoundingClientRect();
      const before = window.CS.getSubs()[1].end;
      const ev = (t, x) => h.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: r.top + 5, pointerId: 1, button: 0 }));
      ev('pointerdown', r.left + 3); ev('pointermove', r.left - 20); ev('pointermove', r.left - 37); ev('pointerup', r.left - 37);
      await sleep(300);
      log('recortar fin: ' + before + ' -> ' + window.CS.getSubs()[1].end + ' ms');
      // fijar fuente y marca
      document.querySelector('button.pin[data-for="fontBold"]').click();
      $('presetName').value = 'Marca prueba'; $('btnPresetSave').click(); await sleep(200);
      log('marcas en la barra: ' + [...document.querySelectorAll('#brandBar button')].map((b) => b.textContent + (b.classList.contains('on') ? '(activa)' : '')).join(', '));
      // selector de color: abrir y pegar un código
      $('colBold').click(); await sleep(300);
      const inp = document.querySelector('.cpk input'); inp.value = 'C100 M60 Y0 K0'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);
      await ipcRenderer.invoke('test-shot', path.join(dir, 'shot_ui.png'));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(200);
      log('color bold: ' + $('colBold').value + ' · muestras: ' + document.querySelectorAll('#swatches .sw').length);
    }
    // un PNG por estilo de edición (CS_TEST_CARDS=clasico,tipo,karaoke)
    for (const card of (process.env.CS_TEST_CARDS || '').split(',').filter(Boolean)) {
      document.querySelector('.styleCard[data-card="' + card + '"]').click();
      if (process.env.CS_TEST_ANIM) { $('estilo').value = process.env.CS_TEST_ANIM; $('estilo').dispatchEvent(new Event('change', { bubbles: true })); }
      await sleep(600);
      const ok = await window.CS.runExport('png', path.join(dir, 'card_' + card + '_png'));
      log('card ' + card + ': ' + (ok ? 'OK' : 'FALLO'));
    }
    for (const fmt of (process.env.CS_TEST_FMTS || '').split(',').filter(Boolean)) {
      const out = path.join(dir, 'salida_' + fmt + (fmt === 'png' ? '' : '.' + { prores: 'mov', webm: 'webm', burn: 'mp4' }[fmt]));
      const t0 = Date.now();
      const ok = await window.CS.runExport(fmt, out);
      log('export ' + fmt + ': ' + (ok ? 'OK' : 'FALLO') + ' en ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + $('status').textContent.replace(/\n/g, ' | '));
    }
    await ipcRenderer.invoke('test-shot', path.join(dir, 'shot3.png'));
    ipcRenderer.invoke('test-quit', 0);
  } catch (e) {
    log('ERROR ' + (e && e.stack || e));
    ipcRenderer.invoke('test-quit', 1);
  }
})();
