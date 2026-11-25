// =====================================================================
//  Captionation - idioma de la interfaz (ES / EN)
//  El panel está escrito en español; en inglés se traduce el texto visible
//  (también lo que aparece después, como mensajes de estado).
//  Nunca toca los subtítulos del usuario, nombres de fuentes ni presets.
// =====================================================================
(function () {
  var KEY = 'sb_lang';
  var lang = 'es';
  try { lang = localStorage.getItem(KEY) || (/^es/i.test(navigator.language) ? 'es' : 'en'); } catch (e) {}

  // selector ES / EN
  var seg = document.getElementById('langSeg');
  if (seg) {
    seg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-l') === lang);
      b.onclick = function () {
        try { localStorage.setItem(KEY, b.getAttribute('data-l')); } catch (e) {}
        location.reload();
      };
    });
  }
  document.documentElement.lang = lang;
  if (lang !== 'en') return;

  var EX = {
    'Vista previa · clic en un subtítulo de la lista para verlo': 'Preview · click a caption in the list to see it',
    'Vista previa · texto de ejemplo': 'Preview · sample text',
    '0 · Transcribir con IA (Whisper)': '0 · AI transcription (Whisper)',
    'Modelo': 'Model', 'Small (264 MB) · rápido': 'Small (264 MB) · fast',
    'Medium (823 MB) · muy preciso': 'Medium (823 MB) · very accurate',
    'Large v3 Turbo (874 MB) · el más preciso': 'Large v3 Turbo (874 MB) · most accurate',
    'Idioma': 'Language', 'Español': 'Spanish', 'Inglés': 'English', 'Portugués': 'Portuguese', 'Detectar': 'Auto-detect',
    'Máx. caracteres por subtítulo': 'Max. characters per caption',
    'Palabras de marca (para que las escriba bien)': "Brand words (so they're spelled right)",
    'Transcribir secuencia': 'Transcribe sequence', 'Transcribir composición': 'Transcribe composition', 'Cancelar': 'Cancel',
    'Transcribe el audio de la secuencia activa en esta PC (sin internet). La primera vez descarga el motor y el modelo; después ya no.':
      "Transcribes the active sequence's audio on this computer (offline). The first time it downloads the engine and model; never again after that.",
    'Transcribe el audio de la composición activa (o solo el área de trabajo, si la acortaste) en esta PC, sin internet.':
      "Transcribes the active composition's audio (or just the work area, if you trimmed it) on this computer, offline.",
    '1 · Subtítulos': '1 · Captions', 'Cargar .txt / .srt': 'Load .txt / .srt', 'Negritas automáticas': 'Auto highlight',
    'Frase clave (automático)': 'Key phrase (auto)', 'Solo 1 palabra clave': 'Only 1 key word', 'Últimas N palabras': 'Last N words',
    'Todo menos la 1ª palabra': 'All but the 1st word', 'Palabras de mi lista': 'Words from my list', 'Ninguna': 'None',
    'Lista (separada por comas)': 'List (comma-separated)', 'Aplicar regla a todo': 'Apply rule to all', 'MAYÚSCULAS': 'UPPERCASE',
    'Clic en una palabra = bold / regular. Si el archivo trae *asteriscos*, se respetan.': 'Click a word = bold / regular. *Asterisks* in the file are kept.',
    'Corregir subtítulo seleccionado': 'Fix selected caption', 'Guardar': 'Save', '✓ Guardado': '✓ Saved',
    'Lo que va entre *asteriscos* sale resaltado. Enter = guardar. Ctrl+Z en After Effects lo deshace.':
      'Text between *asterisks* is highlighted. Enter = save. Ctrl+Z in After Effects undoes it.',
    '2 · Estilo de edición y marca': '2 · Style & brand', 'Clásico': 'Classic', 'Resalte al centro': 'Center highlight',
    'Fuente regular': 'Regular font', 'Fuente bold': 'Bold font', 'Actualizar lista de fuentes': 'Refresh font list',
    'Preset de marca': 'Brand preset', '— ninguno —': '— none —', 'Borrar': 'Delete',
    'Exportar marcas…': 'Export brands…', 'Importar marcas…': 'Import brands…',
    '3 · Texto y animación': '3 · Text & animation', 'Alineación': 'Alignment', 'Izquierda': 'Left', 'Centro': 'Center', 'Derecha': 'Right',
    'Animación de entrada': 'Entrance animation', 'Pop (escala)': 'Pop (scale)', 'Subir': 'Rise', 'Desenfoque': 'Blur',
    'Máquina de escribir': 'Typewriter', 'Caer desde arriba': 'Drop from above', 'Zoom (desde grande)': 'Zoom (from large)',
    'Retraso entre palabras (frames)': 'Delay between words (frames)', 'Duración de la entrada (frames)': 'Entrance duration (frames)',
    'Tamaño de letra': 'Font size', 'Escala del bold (%)': 'Bold scale (%)', 'Interletrado': 'Tracking',
    'Posición horizontal (%)': 'Horizontal position (%)', 'Posición vertical (%)': 'Vertical position (%)',
    'Respetar zona segura TikTok/Reels (vertical)': 'Keep the TikTok/Reels safe zone (vertical)', 'Caracteres por línea': 'Characters per line',
    '4 · Resaltar la palabra que se dice': '4 · Highlight the spoken word', 'Modo': 'Mode', 'No': 'Off',
    'Caja de color': 'Color box', 'Solo cambiar color': 'Color change only', 'Color de la palabra activa': 'Active word color',
    'Color de la caja': 'Box color', 'Margen de la caja (px)': 'Box padding (px)', 'Redondeo de la caja (px)': 'Box roundness (px)',
    'Por ahora el tiempo de cada palabra se reparte dentro de cada subtítulo. Con la transcripción integrada (próxima versión) será exacto.':
      "Each word's timing comes from the transcription; with a loaded .txt it is spread across the caption.",
    '5 · Colores de marca': '5 · Brand colors', 'Borde (grosor px)': 'Stroke (px)', '+ Muestra': '+ Swatch',
    'Elige un cuadro de color (queda marcado en azul) y haz clic en una muestra. Clic derecho en una muestra = borrarla.':
      'Pick a color box (outlined in blue), then click a swatch. Right-click a swatch to delete it.',
    '6 · Efectos y fondo': '6 · Effects & background', 'Brillo / glow (intensidad %)': 'Glow (intensity %)', 'Brillo / glow (radio)': 'Glow (radius)',
    'Sombra (%)': 'Shadow (%)', 'Opacidad del fondo (%)': 'Background opacity (%)', 'Color del fondo': 'Background color',
    'Margen del fondo (px)': 'Background padding (px)', 'Redondeo del fondo (px)': 'Background roundness (px)',
    'También puedes arrastrar cualquier efecto o preset de Premiere (desenfoque, glow, transiciones…) sobre los clips de subtítulos.':
      'You can also drag any Premiere effect or preset (blur, glow, transitions…) onto the caption clips.',
    '7 · Secuencia': '7 · Sequence', '7 · Composición': '7 · Composition',
    'Leer secuencia activa': 'Read active sequence', 'Leer composición activa': 'Read active composition',
    'Plantilla': 'Template', 'Incluida (automática)': 'Built-in (automatic)', 'Usar otra .mogrt…': 'Use another .mogrt…', 'Usar la incluida': 'Use built-in',
    'Pista de video': 'Video track', 'Los tiempos empiezan en': 'Timing starts at',
    'El inicio de la secuencia': 'Sequence start', 'El cabezal de reproducción': 'Playhead',
    'Insertar subtítulos': 'Insert captions', 'Re-aplicar estilo a la pista': 'Re-apply style to track', 'Aplicar estilo a todos': 'Apply style to all',
    'Descargar': 'Download', '+ Nueva pista arriba': '+ New track on top', 'Incluida (según la secuencia)': 'Built-in (matches the sequence)',
    'Texto corregido.': 'Text fixed.', 'Corrige el texto y pulsa Guardar.': 'Fix the text and press Save.',
    'Primero carga el .txt con los subtítulos.': 'Load the captions .txt first.', 'Aplicando estilo…': 'Applying style…',
    'Buscando fuentes…': 'Looking for fonts…', 'Cancelado': 'Canceled',
    'Nombre (ej. MiMarca)': 'Name (e.g. MyBrand)', 'mimarca, producto, Ana': 'mybrand, product, Ana', 'agua, filtro, mimarca': 'water, filter, mybrand',
    'Selecciona una capa CAP y pulsa el botón de arriba': 'Select a CAP layer and press the button above',
    'Selecciona en la línea de tiempo la capa CAP del subtítulo': "Select the caption's CAP layer in the timeline",
    'Borrar el preset elegido': 'Delete the selected preset',
    'Pega un código: #0A5CFF, 0a5cff, #FFF o rgb(10, 92, 255)': 'Paste a code: #0A5CFF, 0a5cff, #FFF or rgb(10, 92, 255)', 'Guarda el color marcado como muestra': 'Save the selected color as a swatch',
    'Cambia el estilo de todos los subtítulos de la pista elegida, sin tocar el texto': 'Changes the style of every caption on the chosen track, without touching the text',
    'Cambia "Captionation Estilo": todos los subtítulos del proyecto se actualizan': 'Changes "Captionation Estilo": every caption in the project updates',
    // ---- Captionation Studio ----
    'Abre o arrastra un video': 'Open or drop a video', 'Reproducir / pausa (barra espaciadora)': 'Play / pause (space bar)',
    'Formato cuando solo hay audio': 'Format when there is only audio', 'Subtítulos': 'Captions',
    '+ Añadir': '+ Add', 'Agrega un subtítulo en la posición actual': 'Adds a caption at the current position', 'Guardar .srt': 'Save .srt',
    'Clic en una palabra = bold / regular · ✎ = editar texto (*asteriscos* = bold) · los tiempos se editan en las casillas (min:seg.cc) · clic en la fila = ir a ese momento.':
      'Click a word = bold / regular · ✎ = edit text (*asterisks* = bold) · edit times in the boxes (min:sec.cc) · click a row = jump there.',
    '0 · Video y transcripción': '0 · Video & transcription', 'Abrir video o audio…': 'Open video or audio…', 'Transcribir': 'Transcribe',
    'Transcribe el audio en esta PC (sin internet). La primera vez descarga el motor y el modelo; después ya no.':
      'Transcribes the audio on this computer (offline). The first time it downloads the engine and model; never again after that.',
    'Importa el archivo .sbmarca que exportaste desde el panel Captionation de Premiere / After Effects.':
      'Import the .sbmarca file you exported from the Captionation panel in Premiere / After Effects.',
    '7 · Exportar': '7 · Export', 'Exportar…': 'Export…', 'Mostrar en la carpeta': 'Show in folder',
    'ProRes 4444 .mov · transparente': 'ProRes 4444 .mov · transparent',
    'Recomendado. Se importa con transparencia en EffectCraft, After Effects 2022, Premiere, DaVinci Resolve y Final Cut.':
      'Recommended. Imports with transparency in EffectCraft, After Effects 2022, Premiere, DaVinci Resolve and Final Cut.',
    'WebM VP9 · transparente': 'WebM VP9 · transparent', 'Archivo mucho más liviano. Para CapCut, navegadores y editores web.': 'Much smaller file. For CapCut, browsers and web editors.',
    'Secuencia PNG · transparente': 'PNG sequence · transparent',
    'Una imagen por cuadro en una carpeta. La opción más compatible (cualquier editor).': 'One image per frame in a folder. The most compatible option (any editor).',
    'Video con subtítulos quemados .mp4': 'Video with burned-in captions .mp4', 'El video original con los subtítulos encima, listo para subir.': 'The original video with the captions on top, ready to post.',
    'Editar texto': 'Edit text', 'Agregar un subtítulo después de este': 'Add a caption after this one', 'Borrar este subtítulo': 'Delete this caption',
    'Entra': 'In', 'Sale': 'Out',
    'Pulsa "Transcribir" o carga un .txt / .srt.': 'Press "Transcribe" or load a .txt / .srt.', 'Abre un video o audio para empezar.': 'Open a video or audio file to start.',
    'Primero abre un video o audio.': 'Open a video or audio file first.', 'Ese archivo no tiene audio.': 'That file has no audio.',
    'Ese archivo no tiene video ni audio que se pueda leer.': "That file has no readable video or audio.",
    'Paso 1 de 2 · Extrayendo el audio…': 'Step 1 of 2 · Extracting the audio…',
    'Instalando el motor…': 'Installing the engine…',
    'Verificando el modelo…': 'Checking the model…', 'No se detectó voz en el audio.': 'No speech was detected in the audio.',
    'No hay subtítulos para exportar. Transcribe o carga un .txt / .srt.': 'There are no captions to export. Transcribe or load a .txt / .srt.',
    'Para quemar los subtítulos hace falta abrir un video.': 'Open a video to burn in the captions.',
    'Elige otro nombre: no se puede reemplazar el video original.': "Choose another name: the original video can't be replaced.",
    'No hay subtítulos para guardar.': 'There are no captions to save.', 'Para cargar subtítulos usa "Cargar .txt / .srt".': 'To load captions use "Load .txt / .srt".',
    'No hay presets guardados para exportar.': 'There are no saved presets to export.', 'Escribe un nombre para el preset.': 'Type a name for the preset.',
    'Ese archivo no es un archivo de marcas válido.': "That isn't a valid brands file."
  };
  // ---- Captionation Studio 1.1 ----
  [['✂ Cortar', '✂ Cut'], ['Divide el subtítulo en el cabezal (tecla C)', 'Splits the caption at the playhead (C key)'],
   ['Unir con el siguiente', 'Join with next'], ['Une el subtítulo elegido con el siguiente', 'Joins the selected caption with the next one'],
   ['Arrastra un bloque para moverlo y sus bordes para cambiar la duración. Ctrl + rueda = zoom.', 'Drag a block to move it and its edges to change the duration. Ctrl + wheel = zoom.'],
   ['Alejar', 'Zoom out'], ['Acercar', 'Zoom in'], ['Ver todo', 'Fit'], ['Marcas', 'Brands'],
   ['Fijar esta fuente arriba de la lista', 'Pin this font to the top of the list'], ['Quitar de las fuentes fijadas', 'Unpin this font'],
   ['Guarda una marca abajo (o importa un .sbmarca) y aparece aquí.', 'Save a brand below (or import a .sbmarca) and it shows up here.'],
   ['Los colores que usas se guardan solos como muestras (en la marca activa). Clic en un cuadro de color = selector con campo para pegar #HEX, RGB o CMYK. Clic derecho en una muestra = quitarla.',
    'Colors you use are saved as swatches automatically (in the active brand). Click a color box = picker with a field to paste #HEX, RGB or CMYK. Right-click a swatch to remove it.'],
   ['Pega #HEX, RGB o CMYK. Clic derecho en una muestra = quitarla.', 'Paste #HEX, RGB or CMYK. Right-click a swatch to remove it.'],
   ['Pon el cabezal dentro de un subtítulo para cortarlo.', 'Put the playhead inside a caption to cut it.'],
   ['El corte queda demasiado cerca del borde del subtítulo.', 'The cut is too close to the edge of the caption.'],
   ['Elige un subtítulo que tenga otro después.', 'Pick a caption that has another one after it.'],
   ['Actualizar ahora', 'Update now'], ['Reintentar', 'Retry'],
   ['Espera a que termine la exportación o la transcripción y vuelve a pulsar.', 'Wait for the export or transcription to finish and press again.']
  ].forEach(function (p) { EX[p[0]] = p[1]; });
  // frases dentro de mensajes que cambian (números, nombres…)
  var RX = [
    [/^Subtítulo (\d+) cortado en (\S+)\.$/, 'Caption $1 cut at $2.'],
    [/^Descargando la versión (\S+)… (.*)$/, 'Downloading version $1… $2'],
    [/^Instalando la versión (\S+)….*$/, 'Installing version $1… the app closes and reopens by itself.'],
    [/^No se pudo actualizar: /, "Couldn't update: "],
    [/^★ Fijadas$/, '★ Pinned'],
    [/^Vista previa · subtítulo (\d+) de (\d+) \(clic en la lista para cambiar\)$/, 'Preview · caption $1 of $2 (click the list to change)'],
    [/— elegir de la lista/, '— pick from the list'], [/\(no instalada en este PC\)/, '(not installed on this PC)'],
    [/^(\d+) fuentes$/, '$1 fonts'], [/\(vacía\)/, '(empty)'], [/^Incluida \((vertical|horizontal)\)$/, 'Built-in ($1)'],
    [/^Nueva versión (\S+) disponible/, 'New version $1 available'],
    [/^Insertando (\d+) \/ (\d+)…$/, 'Inserting $1 / $2…'],
    [/^Listo: (\d+) subtítulos insertados en (\S+)\./, 'Done: $1 captions inserted on $2.'],
    [/^Estilo aplicado a (\d+) subtítulos de (\S+)\./, 'Style applied to $1 captions on $2.'],
    [/^(\d+) fuentes encontradas\..*$/, '$1 fonts found. Pick them in "Regular font" / "Bold font".'],
    [/^Preset "(.+)" guardado\.$/, 'Preset "$1" saved.'], [/^Preset "(.+)" borrado\.$/, 'Preset "$1" deleted.'],
    [/^Preset "(.+)" cargado\..*$/, 'Preset "$1" loaded.'],
    [/^Paso 1 de 2 · (Premiere exporta|After Effects renderiza) el audio/, 'Step 1 of 2 · $1 the audio'],
    [/Premiere exporta/, 'Premiere exports'], [/After Effects renderiza/, 'After Effects renders'],
    [/^Paso 2 de 2 · Transcribiendo (.+?) de audio… (\d+)%/, 'Step 2 of 2 · Transcribing $1 of audio… $2%'],
    [/entre entrada y salida/, 'between In and Out'], [/área de trabajo/, 'work area'],
    [/\(archivo temporal, se borra al terminar\)/, '(temporary file, deleted when done)'], [/ faltan ~/, ' ~'], [/ de ~/, ' of ~']
  ];
  // zonas que NO se traducen (texto del usuario)
  RX.push(
    [/^Subtítulos \((\d+)\)$/, 'Captions ($1)'],
    [/^Paso 1 de 2 · Extrayendo el audio… (\d+)%$/, 'Step 1 of 2 · Extracting the audio… $1%'],
    [/^Descargando el motor de transcripción… (.*)$/, 'Downloading the transcription engine… $1'],
    [/^Descargando el modelo \(solo la primera vez\)… (\S+ MB) de (\S+ MB)$/, 'Downloading the model (first time only)… $1 of $2'],
    [/^Listo: (\d+) subtítulos\. Revisa.*$/, 'Done: $1 captions. Check the bold and text in the list, then export.'],
    [/^Exportando cuadro (\d+) de (\d+) · (\d+)%/, 'Exporting frame $1 of $2 · $3%'],
    [/^Listo en (.+?):/, 'Done in $1:'], [/imágenes PNG/, 'PNG images'],
    [/ · solo audio · /, ' · audio only · '], [/ · igual que el video$/, ' · same as the video'], [/ · formato (9:16|16:9)$/, ' · $1 format'],
    [/^Leyendo (.+)…$/, 'Reading $1…'], [/^Preparando la vista previa… (\d+)%$/, 'Preparing the preview… $1%'],
    [/^Subtítulos recuperados de la última sesión · (\d+)$/, 'Captions restored from your last session · $1'],
    [/^Transcripción · (\d+) subtítulos · (\d+) palabras$/, 'Transcription · $1 captions · $2 words'],
    [/^(\d+) marca\(s\) importada\(s\)\.$/, '$1 brand(s) imported.'],
    [/^Guardado \(las \*asteriscos\* marcan el bold\):/, 'Saved (*asterisks* mark the bold):'],
    [/ · (\d+) subtítulos( · con \*asteriscos\*)?$/, ' · $1 captions'],
    [/ (\d+) h (\d+) min/, ' $1 h $2 min']
  );
  var SKIP = '#list, #wLive, #langSeg, #verTxt';

  function trText(s) {
    var t = s.trim(); if (!t) return s;
    if (EX[t] !== undefined) return s.replace(t, EX[t]);
    var out = t;
    for (var i = 0; i < RX.length; i++) out = out.replace(RX[i][0], RX[i][1]);
    return out === t ? s : s.replace(t, out);
  }
  function skip(node) { var el = node.nodeType === 1 ? node : node.parentElement; return !el || !!el.closest(SKIP); }
  function walk(root) {
    if (skip(root)) return;
    if (root.nodeType === 3) { var n = trText(root.nodeValue); if (n !== root.nodeValue) root.nodeValue = n; return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    ['placeholder', 'title'].forEach(function (a) { var v = root.getAttribute(a); if (v) { var n2 = trText(v); if (n2 !== v) root.setAttribute(a, n2); } });
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  walk(document.body);
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (m.type === 'characterData') walk(m.target);
      else m.addedNodes.forEach(walk);
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
})();
