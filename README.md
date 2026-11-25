# Captionation Studio

Aplicación de escritorio gratuita para Windows que crea subtítulos animados con una palabra en **bold grande**.
Es la versión independiente de Adobe del panel [Captionation](https://github.com/manuelcasten/captionation) (Premiere / After Effects).

1. Abre un video o audio y lo **transcribe en tu PC** con whisper.cpp (sin internet después de la primera descarga del modelo).
2. Ajustas el estilo: **Clásico**, **Resalte al centro** o **Karaoke**, fuentes del sistema, colores de marca (pega #HEX, RGB o CMYK), presets `.sbmarca` del panel, animaciones de entrada y zona segura 9:16.
3. Corriges texto, negritas y tiempos de cada subtítulo.
4. **Exporta** los subtítulos con **fondo transparente**, al mismo tamaño y fps del video, para ponerlos encima en cualquier editor:
   - **ProRes 4444 `.mov`** (recomendado): EffectCraft, After Effects 2022, Premiere, DaVinci Resolve, Final Cut.
   - **WebM VP9 con alfa**: archivo liviano (CapCut, navegadores).
   - **Secuencia PNG**: la opción más compatible.
   - **Video con subtítulos quemados `.mp4`**.

Creado por **Manuel Aldana** · [manuelcasten.github.io](https://manuelcasten.github.io)

## Requisitos

- Windows 10 u 11 de 64 bits.
- **Funciona en procesadores sin AVX2** (por ejemplo Xeon E5 v2 / Ivy Bridge), donde no se pueden instalar After Effects ni Premiere 2025:
  - La interfaz es Electron (Chromium solo exige SSE3).
  - El motor de whisper.cpp elige en tiempo de ejecución la variante para tu CPU; en un CPU con AVX y sin AVX2 carga `ggml-cpu-sandybridge.dll` (solo AVX).
  - ffmpeg es una build x86-64 genérica que detecta el CPU al arrancar.

## Instalar

Descarga `Instalador Captionation Studio.exe` y ábrelo. No pide permisos de administrador; se instala en tu usuario y crea el acceso directo.
La primera transcripción descarga el motor de Whisper y el modelo (Medium: 823 MB) a `%LOCALAPPDATA%\SubtitulosBold`, la misma carpeta que usa el panel Captionation, así que si ya lo usaste no se vuelve a descargar.

## Desarrollo

```powershell
npm install
npm run vendor     # copia/descarga ffmpeg a vendor\ffmpeg
npm start          # abre la app
npm run dist       # construye dist\Instalador Captionation Studio.exe y lo copia a Descargas
```

- `app/render.js`: motor de render en canvas. Lo usan la vista previa y la exportación (lo que ves es lo que sale). Sigue las reglas de la plantilla de After Effects del panel.
- `app/app.js`: interfaz, transcripción, edición y exportación (ffmpeg recibe los cuadros RGBA por una tubería).
- `tools/verificar-sin-avx2.js`: desensambla un `.exe`/`.dll` y comprueba que no tenga instrucciones AVX2/FMA/AVX‑512 fuera de rutas protegidas por una comprobación de CPU.
- `tools/prueba-app.js`: prueba automática de punta a punta (abrir, transcribir, exportar, capturas).

### Verificación sin AVX2 (motor whisper.cpp)

```
whisper-cli.exe           11 instr. AVX2+ · protegidas: 11 · SIN PROTEGER: 0
whisper.dll               48 instr. AVX2+ · protegidas: 48 · SIN PROTEGER: 0
ggml.dll                  35 instr. AVX2+ · protegidas: 35 · SIN PROTEGER: 0
ggml-base.dll             13 instr. AVX2+ · protegidas: 13 · SIN PROTEGER: 0
ggml-cpu-sandybridge.dll  59 instr. AVX2+ · protegidas: 59 · SIN PROTEGER: 0
ggml-blas.dll             OK · ninguna instrucción AVX2/FMA/AVX-512
```

Las instrucciones "protegidas" son de las librerías de Microsoft (memchr, búsquedas de la STL…), que solo usan AVX2 después de comprobar el CPU (`__isa_available` / `__favor`). Como control, `ggml-cpu-haswell.dll` (que en un CPU sin AVX2 nunca se carga) da más de 5 600 instrucciones sin proteger. Además se probó una transcripción forzando la variante `sandybridge`: `CPU : SSE3 = 1 | SSSE3 = 1 | AVX = 1`.

## Licencias

Código de Captionation Studio: MIT. Incluye [ffmpeg](https://ffmpeg.org) (build de gyan.dev, GPL; licencia en `resources/ffmpeg`) y descarga [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (MIT) y sus modelos.
