// Prueba de la actualización automática (en la app instalada):
//   CS_UPDATE_JSON=version.json local con { "studio": { "version": "9.9.9", "exe": "ruta\\al\\instalador.exe" } }
//   CS_TEST=tools\prueba-actualizar.js  CS_TEST_DIR=carpeta para la marca
// 1ª vez: espera el aviso y pulsa "Actualizar ahora". Al volver a abrirse sola, deja "relanzada.txt" y se cierra.
(async () => {
  const fs = require('fs'), path = require('path');
  const { ipcRenderer } = require('electron');
  const mark = path.join(process.env.CS_TEST_DIR, 'actualizando.txt');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  if (fs.existsSync(mark)) {
    fs.writeFileSync(path.join(process.env.CS_TEST_DIR, 'relanzada.txt'), 'version ' + document.getElementById('verTxt').textContent + ' ' + new Date().toISOString());
    fs.unlinkSync(mark);
    ipcRenderer.invoke('test-quit', 0);
    return;
  }
  for (let i = 0; i < 40 && !document.getElementById('updBar').classList.contains('on'); i++) await sleep(250);
  console.log('[prueba] aviso: ' + document.getElementById('updTxt').textContent + ' · botón: ' + document.getElementById('updBtn').textContent);
  fs.writeFileSync(mark, '1');
  document.getElementById('updBtn').click();
})();
