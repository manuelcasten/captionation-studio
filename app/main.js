// Captionation Studio · proceso principal de Electron
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function ffmpegPath() {
  const packed = path.join(process.resourcesPath || '', 'ffmpeg', 'ffmpeg.exe');
  if (app.isPackaged && fs.existsSync(packed)) return packed;
  return path.join(__dirname, '..', 'vendor', 'ffmpeg', 'ffmpeg.exe');
}

let win;
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 980, minHeight: 640,
    backgroundColor: '#0b0b0c', title: 'Captionation Studio',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // enlaces externos -> navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type === 'keyDown' && inp.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
}

ipcMain.handle('info', () => ({ ffmpeg: ffmpegPath(), version: app.getVersion(), packaged: app.isPackaged }));
ipcMain.handle('open-dialog', async (e, opts) => {
  const r = await dialog.showOpenDialog(win, opts);
  return r.canceled ? null : r.filePaths;
});
ipcMain.handle('save-dialog', async (e, opts) => {
  const r = await dialog.showSaveDialog(win, opts);
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('show-item', (e, p) => { shell.showItemInFolder(p); });
ipcMain.handle('open-external', (e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });
// actualización: corre el instalador nuevo en silencio (/S), que reemplaza la app y la vuelve a abrir (--force-run)
ipcMain.handle('install-update', (e, file) => {
  if (!/\.exe$/i.test(file) || !fs.existsSync(file)) return false;
  require('child_process').spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  setTimeout(() => app.quit(), 300);
  return true;
});
ipcMain.handle('confirm', async (e, msg) => {
  const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['OK', 'Cancelar'], defaultId: 0, cancelId: 1, message: msg });
  return r.response === 0;
});

// pruebas automáticas: CS_TEST=archivo.js ejecuta ese guion en la ventana (ver tools/prueba-app.js)
ipcMain.handle('test-shot', async (e, file) => { const img = await win.webContents.capturePage(); fs.writeFileSync(file, img.toPNG()); return file; });
ipcMain.handle('test-quit', (e, code) => { app.exit(code || 0); });

// una sola ventana: si ya está abierta, se enfoca (así la actualización nunca choca con otra copia abierta)
if (!process.env.CS_TEST && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  createWindow();
  if (process.env.CS_TEST) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.executeJavaScript(fs.readFileSync(process.env.CS_TEST, 'utf8')).catch((err) => { console.error(err); app.exit(1); });
    });
    win.webContents.on('console-message', (ev) => { if (/^\[prueba\]/.test(ev.message) || ev.level === 'error') console.log(ev.message); });
  }
});
app.on('window-all-closed', () => app.quit());
