// Copia el instalador recién construido a la carpeta Descargas del usuario.
const fs = require('fs'), path = require('path'), os = require('os');
const src = path.join(__dirname, '..', 'dist', 'Instalador Captionation Studio.exe');
const dst = path.join(os.homedir(), 'Downloads', 'Instalador Captionation Studio.exe');
fs.copyFileSync(src, dst);
console.log('Instalador en ' + dst + ' (' + Math.round(fs.statSync(dst).size / 1048576) + ' MB)');
