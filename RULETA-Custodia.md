# RULETA — Custodia del Proyecto

> Última actualización: 2026-10-12 · Versión del documento: v1

## Mapa del documento

Lectura por defecto: `7. MEMORIA` y este mapa. Las secciones `1`–`5` se abren **solo** cuando la tarea las mencione (`4. CAPACIDADES` y `5. LECCIONES` son de consulta).

- precios, wishlist, comandos, endpoints → `4. CAPACIDADES`
- KV, claves, APIs externas, config, dedup → `3. RECURSOS`
- worker / entry points / cron / despliegue / logs → `2. ARQUITECTURA`
- qué es el proyecto, stack, rutas, repo, versión → `1. IDENTIDAD`
- por qué algo se hizo así, gotchas, errores del pasado → `5. LECCIONES`
- cómo validar / desplegar / ver logs → `6. SKILLS`
- estado actual, decisiones, tarea activa → `7. MEMORIA`
- historial de cambios → `8. VERSIONES` (solo visibles; `8b` nunca)
- entradas antiguas → `5b` / `8b`

## 1. IDENTIDAD

- Qué es el proyecto: ruleta de imágenes para sortear al azar entre fotos subidas por el usuario. Anima el giro en Canvas 2D con sonido, permite deshacer, grabar el resultado en vídeo y compartirlo. Los sets se guardan en Firestore con inicio de sesión de Google. Funciona como PWA instalable.
- Stack: HTML5, CSS3, JavaScript vanilla (sin framework ni build), Canvas 2D, Web Audio API, Firebase Auth y Firestore. `index.html` es una SPA de 5.420 líneas con 3 bloques `<script>` inline.
- Rutas principales: `index.html` (todo el cliente), `sw.js` (service worker), `manifest.json` (PWA), `test/smoke.js` (suite de humo), `firestore.rules`, `firestore.indexes.json`, `firebase.json`. Este documento: `RULETA-Custodia.md`.
- Repo git y estado: `https://github.com/SandovalJon/Ruleta-by-SandovalJon.git`. Rama local `master`, remoto `origin/main` (no existe `origin/master`). `git status` limpio en el momento de la migración.
- URLs: `https://sandovaljon.github.io/Ruleta-by-SandovalJon/`. Repositorio: `https://github.com/SandovalJon/Ruleta-by-SandovalJon`.
- Versión del código: `12d9543` ("Quitar ImageDecoder del todo: solo Image.onload", 2026-10-04). La versión visible en la app es `v3.14.7` (`index.html`, línea 1133).
- Fecha de la última versión del código: 2026-10-04.

## 2. ARQUITECTURA

- Componentes: SPA de archivo único. Tres bloques `<script>` inline con dependencia de orden: el bloque 1 se ejecuta antes que el 3, así que no puede referenciar nada del bloque 3 durante la carga (solo en runtime). Estado y helpers como `t()` y `L` viven en el bloque 1; `tt()` y `U`, en el 3.
- Cómo se conectan: Firebase aporta autenticación con Google y persistencia de sets en Firestore. Sin red, la ruleta local sigue funcionando; solo se pierden el login y los sets.
- Entry points: `index.html`. Service worker con caché versionada (`ruleta-v49` en `sw.js`) que debe subirse en cada despliegue. `manifest.json` habilita la instalación como app.
- Flujos clave:
  1. El usuario sube hasta 500 imágenes por clic o arrastre; se redimensionan a miniatura de 64 px y completa de 512 px.
  2. La ruleta se dibuja en Canvas 2D de 512x512 con `requestAnimationFrame`.
  3. Clic o barra espaciadora:giro animado con `easeOut` y sonido de tick por frame.
  4. Al parar: confeti y sonido de victoria, salvo `prefers-reduced-motion`.
  5. Modo eliminación: el ganador se marca y se retira en el giro siguiente, no de inmediato.
  6. Grabación con MediaRecorder (canvas más audio) o WebCodecs como alternativa; salida 512x512.
  7. Compartir genera una tarjeta PNG de 512 px con marco dorado, no la foto original.
  8. Guardar o cargar un set requiere sesión; el set conserva nombre, imágenes, eliminados y modo.
- Despliegue (comandos exactos): `git push origin master:main` · Pages despliega solo, en 1-2 minutos · subir el número `ruleta-vN` en `sw.js` en cada despliegue.
- Operación (comandos exactos): pruebas `npm test` (suite local) y `npm run test:live` (contra el sitio publicado). Refrescar caché con el botón de la app o con `Ctrl+Shift+R`.

## 3. RECURSOS

- APIs que usa: Firebase Auth (login con Google) y Firestore (sets por usuario) servidos desde `gstatic`. Web Audio API para sonidos sintetizados, sin ficheros de audio. Canvas 2D para la ruleta. MediaRecorder y WebCodecs para grabar. Web Share API con respaldo a portapapeles. `navigator.brave` para detectar el aviso de nombres vacíos.
- Dónde vive la configuración: la configuración de Firebase está incrustada en `index.html` (proyecto `ruleta-d53d9`). No hay variables de entorno ni archivo de configuración aparte.
- Aviso de privacidad: esta sección referencia configuración sensible. Uso local. No subir a repos.
- Esquemas de datos: un set en Firestore guarda nombre, imágenes, índices eliminados y modo. Límites de Firestore aplicados: 100 escrituras por lote, 10 MB por lote y 1 MB por documento.
- Memoria / almacenamiento: `localStorage` para tema, sonido e imágenes eliminadas. Sin IndexedDB. Las imágenes cargadas viven en memoria de la sesión; recargar la página empieza vacío por diseño.

## 4. CAPACIDADES

- Girar la ruleta — animación de 3 a 7 s, 400 ms con movimiento reducido, con sonido de tick por frame. Verificado por: código; estado en ejecución no verificado.
- Subir imágenes — hasta 500 por clic o arrastre, con compresión por lotes de 25. Verificado por: código.
- Gestionar nombres — toma el nombre del archivo; avisa si llegan vacíos y permite renombrado masivo con deshacer. Verificado por: código.
- Reordenar — arrastre con ratón y táctil mediante `moveImage`, con umbral que evita el scroll accidental. Verificado por: código.
- Eliminar y limpiar — botón de eliminar en cada miniatura, modo eliminación que retira al girar y borrado total con confirmación. Verificado por: código.
- Buscar y previsualizar — buscador por texto con debounce de 120 ms; preview de 10 miniaturas con aviso "+N más" e insignia de posición. Verificado por: código.
- Deshacer — cubre giro, eliminación, borrado y renombrados, con botón y `Ctrl+Z`. Verificado por: código.
- Grabar vídeo — MediaRecorder o WebCodecs, salida 512x512 con audio. Verificado por: código.
- Compartir el ganador — tarjeta PNG 512x512 con marco dorado o texto. Verificado por: código.
- Temas e idiomas — temas Noche, Claro y Esmeralda (solo desarrollo), con seguimiento del sistema si no hay preferencia; 25 idiomas. Toda clave nueva debe añadirse a los 25. Verificado por: código.
- Sonido y confeti — interruptor persistente en `localStorage`; confeti dibujado en el canvas y desactivado con movimiento reducido. Verificado por: código.
- Atajos y accesibilidad — Espacio, Esc, S, E y `Ctrl+Z`, con panel de ayuda; resultado en `aria-live`, canvas con rol y foco visible. Verificado por: código.
- Avisos y errores — `friendlyErr` traduce permisos, red y sesión al idioma activo; banda offline, aviso de login, aviso de más de 50 imágenes y Open Graph para compartir el enlace. Verificado por: código.
- PWA — `manifest.json` y service worker versionado, con botón de instalar cuando el navegador lo permite. Verificado por: código.
- Suite de humo — `test/smoke.js` con 40 comprobaciones según la documentación heredada. Verificado por: el fichero existe; el recuento de 40 checks **no verificado** en esta migración, porque la suite declara sus comprobaciones con otro patrón de llamada.

## 5. LECCIONES

1. Orden de los scripts inline — Causa raíz: el bloque 1 se ejecuta antes que el 3; referenciar desde el bloque 1 una función del bloque 3 durante la carga provoca un error de TDZ en cascada que rompe la app entera. · Fix: subir el estado arriba y envolver los callbacks en funciones flecha para que la referencia se resuelva en runtime. · Verificación: la suite detecta excepciones al cargar.
2. Las comas en las traducciones se rompen al insertar — Causa raíz: los scripts de inserción duplicaban u omitían comas entre claves en los 25 idiomas. · Fix: normalizador que valida que haya exactamente una coma entre claves. · Verificación: `node --check` sobre los 3 scripts.
3. El service worker sirve HTML viejo después de cada despliegue — Causa raíz: la caché versionada no se renumeraba. · Fix: subir `ruleta-vN` en cada despliegue y usar `Ctrl+Shift+R`. · Verificación: el badge de versión es visible para todos.
4. Las eliminaciones heredadas se aplicaban a imágenes nuevas — Causa raíz: los índices eliminados persistían y se reaplicaban. · Fix: descartar el estado al cargar un set nuevo. · Verificación: test dedicado.
5. Hay navegadores que entregan archivos sin nombre y no hay recuperación posible por código — Causa raíz: Brave entrega el `File` sin nombre. · Fix: avisar, ofrecer renombrado masivo y mostrar números de posición. · Verificación: tests con archivos sin nombre.
6. La restauración automática borraba subidas en curso — Causa raíz: el auto-restore pisaba lo que el usuario estaba subiendo. · Fix: se eliminó el auto-restaurado; recargar empieza vacío. · Verificación: test de recarga vacía.
7. Un test verde no demuestra nada si el test no falla con el bug presente — Causa raíz: se aceptaron pruebas que nunca se rompían porque nunca se comprobó que detectaran el fallo. · Fix: reintroducir el bug a propósito y comprobar que el test lo detecta. · Verificación: aplicar siempre en tests críticos nuevos.
8. `ImageDecoder` no funciona en headless ni en Brave — Causa raíz: la descompresión con `ImageDecoder` fallaba en navegadores sin soporte real, provocando imágenes que nunca cargaban. · Fix: se eliminó `ImageDecoder` y se usa solo `Image.onload`. · Verificación: commits `8c9720b` y `12d9543` del 2026-10-04.

## 5b. LECCIONES (archivo)

Sin entradas archivadas todavía.

## 6. SKILLS

- Skill: ejecutar la suite de humo — Estado: verificada
  - Propósito: comprobar la app antes y después de un cambio.
  - Precondiciones: Node instalado; para la variante en vivo, el sitio publicado accesible.
  - Pasos: `npm test` para la comprobación local · `npm run test:live` contra `https://sandovaljon.github.io/Ruleta-by-SandovalJon/`.
  - Verificación: ambos scripts existen en `package.json`; el recuento de comprobaciones de la documentación heredada no está confirmado.
  - Agente: [opencode-1]

- Skill: desplegar a GitHub Pages con rama divergente — Estado: verificada
  - Propósito: publicar respetando que la rama local no es la remota.
  - Pasos: `git push origin master:main` · subir el número de caché en `sw.js` en el mismo commit · esperar el auto-deploy de Pages (1-2 min).
  - Verificación: el remoto expone `origin/main` y no `origin/master`, confirmado con `git branch -r`.
  - Agente: [opencode-1]

## 7. MEMORIA

- [opencode-1] Tarea activa: ninguna. Migración Ruta B ejecutada el 2026-10-12: se unificaron `RULETA-Base-Conocimiento.md` y `RULETA-Manual-Skills.md` en este archivo, y los originales quedaron en `archivados/`.
- [opencode-1] Corrección: la documentación heredada declaraba versión `v3.12.0` y commit `6fb15fe`, pero el código real es `v3.14.7` en `index.html:1133` y commit `12d9543`. Se adopta lo verificado en el código.
- [opencode-1] Decisión: `NOMBRE` es `RULETA` — motivo: carpeta, repo y prefijo de los archivos heredados coinciden en esa raíz — estado: tomada.
- [opencode-1] Decisión: recargar la página empieza vacío, sin restauración automática — motivo: la restauración automática borraba subidas en curso — estado: tomada.
- [opencode-1] Decisión: se eliminó `ImageDecoder` en favor de `Image.onload` — motivo: no funciona en headless ni en Brave — estado: tomada.
- Preferencias del usuario: español; respuestas concisas; un archivo de custodia por página; quiere que el agente ejecute y publique sin pedir confirmación paso a paso.
- [opencode-1] Comprometidos: rama local `master` publicada contra `origin/main`. Firebase Auth y Firestore siguen siendo dependencias obligatorias para guardar sets.
- Ideas (no comprometidos): importar CSV, modo pantalla completa, modo pesos (todas listadas en la documentación heredada, ninguna comprometida).

## 8. VERSIONES

- v1 | 2026-10-12 | Migración Ruta B a documento único | código: 12d9543
  - Agente: [opencode-1]
  - Qué cambió: se unificaron `RULETA-Base-Conocimiento.md` y `RULETA-Manual-Skills.md` en este archivo de custodia. Se corrigieron dos datos que la documentación heredaba desactualizados: la versión pasa de `v3.12.0` a `v3.14.7` y el commit de referencia de `6fb15fe` a `12d9543`. Se añadió la lección 8, extraída del historial de commits. No se modificó código de la app.
  - Secciones actualizadas: todas (creación por migración). `5. LECCIONES` combina las lecciones de ambos archivos heredados y añade la de `ImageDecoder`. `6. SKILLS` recoge la suite de humo y el despliegue con rama divergente.
  - Verificación: versión leída de `index.html:1133`; `git log -1` da `12d9543`; `git branch -r` muestra solo `origin/main`; `sw.js` declara `ruleta-v49`; `index.html` tiene 5.420 líneas y 3 bloques `<script>`; el proyecto Firebase `ruleta-d53d9` aparece en el código; ambos repos locales sin cambios sin commitear antes de migrar.
  - Pendientes: confirmar el número real de comprobaciones de `test/smoke.js`; la versión de `sw.js` no coincide con la de la app en este proyecto y merece revisión.

## 8b. VERSIONES (archivo)

Sin entradas archivadas todavía.