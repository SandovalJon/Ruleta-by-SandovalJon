# RULETA-Base-Conocimiento.md

## 1. IDENTIDAD

- **Nombre:** Ruleta de Imágenes
- **Stack:** HTML5, CSS3, JavaScript vanilla, Web Audio API, Canvas 2D
- **Repo:** https://github.com/SandovalJon/Ruleta-by-SandovalJon
- **URL:** https://sandovaljon.github.io/Ruleta-by-SandovalJon/
- **Versión:** v3.12.0
- **Rama:** local `master` → remoto `main`
- **Último commit:** 6fb15fe

## 2. ARQUITECTURA

- **Entry point:** index.html (SPA single-file, ~5000 líneas)
- **Scripts inline:** 3 bloques. El bloque 1 NO puede usar nada del bloque 3 al cargar (solo en runtime). `t()`/L viven en el 1, `tt()`/U en el 3.
- **PWA:** manifest.json (instalable, botón 📲 cuando el navegador lo permite). Service worker con caché versionada (`ruleta-vN`, subir en cada deploy).
- **Firebase:** Auth (Google) + Firestore (guardar/cargar sets). Reglas en firestore.rules. Sin auto-guardado local: recargar empieza vacía.
- **Audio:** Web Audio API (tick, whoosh, win sound). Respeta `prefers-reduced-motion` (giro corto, sin confeti ni fondo animado).
- **Canvas:** Ruleta 512x512 con requestAnimationFrame. Más de 50 imágenes: solo colores, sin fotos.
- **Grabación:** MediaRecorder (canvas + audio) o WebCodecs (fallback). Salida 512x512.
- **Idiomas:** 25 idiomas, objetos L (general) y U (sets). Toda clave nueva va a los 25.
- **Temas:** Noche, Claro, Esmeralda (solo dev). Sin preferencia guardada sigue al sistema.

## 3. RECURSOS

- **Firebase Config:** En index.html (proyecto ruleta-d53d9)
- **APIs externas:** Firebase (gstatic). Sin red no hay login ni sets; la ruleta local sí funciona.
- **Datos:** Firestore (sets por usuario, límite 10 MB por lote de escritura, 1 MB por documento).
- **Memoria:** localStorage (tema, sonido, eliminadas). Sin IndexedDB.

## 4. CAPACIDADES

| Feature | Estado | Descripción |
|---------|--------|-------------|
| Girar ruleta | ✅ | Animación con easeOut, sonido tick (1/frame) |
| Subir imágenes | ✅ | Click o drag & drop, máximo 500, compresión por lotes |
| Nombres | ✅ | Del archivo; aviso si llegan vacíos (Brave); renombrado masivo con deshacer |
| Reordenar | ✅ | Drag ratón + táctil (umbral anti-scroll), función moveImage compartida |
| Eliminar imagen | ✅ | Botón ✕ (hover en PC, siempre visible en táctil) |
| Limpiar todo | ✅ | Con confirmación |
| Buscador | ✅ | Filtra miniaturas por texto, debounce 120 ms |
| Preview | ✅ | Máximo 10 miniaturas + aviso "+N más", insignia de posición |
| Deshacer | ✅ | Giro, eliminación, borrado y renombrados. Botón ↩️ + Ctrl+Z |
| Modo eliminación | ✅ | Ganador se elimina al girar de nuevo |
| Grabar MP4 | ✅ | 512x512, con audio |
| Compartir ganador | ✅ | Tarjeta 512px PNG con marco dorado (no la foto original) o texto |
| Seleccionar tema | ✅ | Noche, Claro, Esmeralda (dev); auto según sistema |
| Seleccionar idioma | ✅ | 25 idiomas |
| Sonido on/off | ✅ | Persiste en localStorage |
| Confeti | ✅ | En canvas, desactivado con movimiento reducido |
| Atajos | ✅ | Espacio, Esc, S, E, Ctrl+Z. Panel ⌨️ de ayuda |
| Errores humanos | ✅ | friendlyErr: permiso/red/sesión en tu idioma |
| Aviso login | ✅ | Sin sesión se indica que hay que entrar para guardar |
| Aviso offline | ✅ | Banda cuando se pierde la red |
| Aviso +50 | ✅ | Con más de 50, la ruleta dibuja colores (todas participan) |
| Open Graph | ✅ | Título, descripción e imagen para compartir el link |
| Badge versión | ✅ | Visible para todos |
| Botón actualizar | ✅ | Limpia cache y recarga |
| Tests humo | ✅ | test/smoke.js, 39 checks (npm test local, test:live en .io) |

## 5. LECCIONES

1. **Orden de scripts:** El bloque 1 se ejecuta antes que el 3. Referenciar funciones del 3 al cargar rompe todo (TDZ en cascada). Fix: mover estado arriba, envolver callbacks en arrow functions. Verificación: suite detecta excepciones al cargar.

2. **Comas en traducciones:** Los scripts de inserción duplicaban u omitían comas. Fix: normalizador que valida cada bloque (exactamente una coma entre claves). Verificación: node --check en los 3 scripts.

3. **Caché vieja:** El service worker servía HTML antiguo tras cada deploy. Fix: bump de `ruleta-vN` en cada cambio + Ctrl+Shift+R. Verificación: badge de versión visible.

4. **Eliminaciones heredadas:** Los índices eliminados persistían y se aplicaban a imágenes nuevas. Fix: descartar estado al cargar set nuevo. Verificación: test dedicado.

5. **Nombres vacíos (Brave):** Algunos navegadores entregan archivos sin nombre, irrecuperable por código. Fix: aviso + renombrado masivo + números de posición. Verificación: tests con archivos sin nombre.

6. **Restauración fantasma:** La carga automática borraba subidas en curso. Fix: se eliminó el auto-restore; recargar empieza vacía. Verificación: test de recarga vacía.

7. **Tests que pasan con el bug:** Un test verde no prueba nada si no falla con el bug presente. Fix: reintroducir el bug a propósito y comprobar que el test lo detecta. Verificación: hacerlo siempre en tests nuevos críticos.
