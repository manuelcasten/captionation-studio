// Prepara vendor/ffmpeg/ffmpeg.exe para el instalador.
// Usa la build de Gyan (x86-64 genérico con detección de CPU en tiempo de ejecución: funciona sin AVX2).
// 1) si ya está en vendor/, no hace nada; 2) la copia de una instalación de winget (Gyan.FFmpeg);
// 3) si no la hay, descarga la build "essentials" de gyan.dev.
const fs = require('fs'), path = require('path'), https = require('https'), cp = require('child_process');
const root = path.join(__dirname, '..'), dest = path.join(root, 'vendor', 'ffmpeg');
const out = path.join(dest, 'ffmpeg.exe');
if (fs.existsSync(out)) { console.log('ffmpeg ya está en vendor/ffmpeg'); process.exit(0); }
fs.mkdirSync(dest, { recursive: true });

const wg = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
let local = null;
try {
  fs.readdirSync(wg).filter((d) => /^Gyan\.FFmpeg/i.test(d)).forEach((d) => {
    fs.readdirSync(path.join(wg, d)).forEach((s) => { const f = path.join(wg, d, s, 'bin', 'ffmpeg.exe'); if (fs.existsSync(f)) local = path.join(wg, d, s); });
  });
} catch (e) {}
if (local) {
  fs.copyFileSync(path.join(local, 'bin', 'ffmpeg.exe'), out);
  try { fs.copyFileSync(path.join(local, 'LICENSE'), path.join(dest, 'LICENSE-ffmpeg.txt')); } catch (e) {}
  console.log('ffmpeg copiado de ' + local);
  process.exit(0);
}

function get(u, file, n = 0) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'User-Agent': 'captionation-studio-build' } }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && n < 10) { r.resume(); get(new URL(r.headers.location, u).toString(), file, n + 1).then(res, rej); return; }
      if (r.statusCode !== 200) { r.resume(); rej(new Error('HTTP ' + r.statusCode)); return; }
      const o = fs.createWriteStream(file); r.pipe(o); o.on('finish', () => o.close(res)); o.on('error', rej);
    }).on('error', rej);
  });
}
(async () => {
  const tmp = path.join(root, 'vendor', 'ffmpeg-tmp');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const zip = path.join(tmp, 'ffmpeg.zip');
  console.log('Descargando ffmpeg…'); await get('https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip', zip);
  cp.execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`]);
  const dir = fs.readdirSync(tmp).map((d) => path.join(tmp, d)).find((d) => fs.existsSync(path.join(d, 'bin', 'ffmpeg.exe')));
  fs.copyFileSync(path.join(dir, 'bin', 'ffmpeg.exe'), out);
  try { fs.copyFileSync(path.join(dir, 'LICENSE'), path.join(dest, 'LICENSE-ffmpeg.txt')); } catch (e) {}
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ffmpeg listo en vendor/ffmpeg');
})().catch((e) => { console.error(e); process.exit(1); });
