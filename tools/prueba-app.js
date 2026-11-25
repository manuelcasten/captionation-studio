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
