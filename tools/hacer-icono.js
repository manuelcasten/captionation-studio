// Genera el icono de la app (build/icon.png 512 px y app/icon.png 256 px).
// Uso: npx electron tools/hacer-icono.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const font = fs.readFileSync(path.join(root, 'app', 'fonts', 'archivo-expanded-800.woff2')).toString('base64');
const html = `<!doctype html><html><head><style>
@font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:800;font-stretch:125%}
html,body{margin:0;background:transparent}
.i{width:512px;height:512px;border-radius:96px;background:#0b0b0c;position:relative;overflow:hidden}
.c{position:absolute;left:0;right:0;top:54px;text-align:center;font:800 330px/1 A;font-stretch:125%;color:#fff;letter-spacing:-10px}
.b{position:absolute;left:92px;right:92px;bottom:92px;height:58px;background:#0a5cff;border-radius:6px}
</style></head><body><div class="i"><div class="c">C</div><div class="b"></div></div></body></html>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'));
  await w.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))');
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const big = img.resize({ width: 512, height: 512 });
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), big.toPNG());
  fs.writeFileSync(path.join(root, 'app', 'icon.png'), big.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
  console.log('icono listo');
  app.exit(0);
});
