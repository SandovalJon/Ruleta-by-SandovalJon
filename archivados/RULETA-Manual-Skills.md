# RULETA-Manual-Skills.md

## 1. Ficha

| Campo | Valor |
|-------|-------|
| Nombre | Ruleta de Imágenes |
| Versión | v3.12.0 |
| URL | https://sandovaljon.github.io/Ruleta-by-SandovalJon/ |
| Repo | https://github.com/SandovalJon/Ruleta-by-SandovalJon |
| Stack | HTML5, CSS3, JS vanilla, Canvas 2D, Web Audio, Firebase |
| Autor | SandovalJon |

## 2. Arquitectura y flujo

1. Usuario sube imágenes (drag & drop o clic, hasta 500)
2. Imágenes se procesan y redimensionan (mini 64px, completa 512px)
3. Se dibuja la ruleta en Canvas 2D (512x512)
4. Click en ruleta o Espacio → girar con animación easeOut
5. Sonido tick sincronizado con sectores (1 por frame)
6. Al parar → confeti + sonido victoria (salvo movimiento reducido)
7. Modo eliminación → ganador se elimina al siguiente giro
8. Grabar → MediaRecorder captura canvas + audio → MP4/WebM 512x512
9. Compartir → tarjeta PNG 512x512 con marco dorado, o texto

## 3. Capacidades

- Girar ruleta (animación 3-7s, 400 ms con movimiento reducido)
- Subir hasta 500 imágenes (compresión por lotes de 25 al guardar)
- Preview limitado a 10 miniaturas + aviso "+N más" + buscador por texto
- Nombres de archivo; aviso si llegan vacíos; renombrado masivo con deshacer
- Miniaturas numeradas según posición
- Reordenar con drag ratón + táctil (función moveImage compartida)
- Deshacer giro, eliminación, borrado y renombrados (botón ↩️ + Ctrl+Z)
- Modo eliminación persistente (marca ganadores con ✓, no los borra)
- Restaurar eliminados (botón ♻️)
- Más de 50 imágenes: la ruleta dibuja colores, todas participan (aviso visible)
- 2 temas (Noche, Claro) + Esmeralda (solo dev); auto según sistema si no hay preferencia
- 25 idiomas
- Sonido on/off (persistente)
- Confeti animado en canvas
- Sets guardan/cargan nombre, imágenes, eliminados y modo (Firebase, login requerido)
- Errores en lenguaje humano (permiso/red/sesión) en tu idioma
- Aviso para iniciar sesión al guardar sin sesión
- Panel de atajos ⌨️ (Espacio, Esc, S, E, Ctrl+Z)
- Aviso sin conexión, metas Open Graph, botón instalar PWA
- Accesibilidad: resultado con aria-live, canvas con rol, foco visible
- Instalable como app (manifest + service worker versionado)
- Recargar empieza vacía (sin auto-restauración)

## 4. APIs/claves/recursos

- Firebase Auth (Google Login)
- Firestore (guardar/cargar sets, lotes de 100, 10 MB por lote)
- Web Audio API (sonidos sintetizados)
- Canvas 2D (dibujar ruleta)
- MediaRecorder / WebCodecs (grabar video)
- Web Share API (compartir ganador, con respaldo a portapapeles)
- localStorage (tema, sonido, eliminadas)
- navigator.brave (detección para aviso de nombres)

## 5. Datos/memoria

- localStorage: tema, sonido, eliminadas
- Firestore: sets de imágenes por usuario
- Session: imágenes cargadas, estado ruleta
- Sin IndexedDB (eliminado: recargar empieza vacía)

## 6. Despliegue y operación

- Repo: GitHub → GitHub Pages (rama local master → main remoto)
- Deploy: push a main → Pages auto-deploy (1-2 min)
- Service worker versionado (ruleta-vN): subir número en cada deploy
- Actualizar: botón 🔄 limpia cache; badge de versión visible para todos
- Tests: test/smoke.js, 40 checks (npm test local, npm run test:live)

## 7. Skills y lecciones

1. Service worker: no cachear scripts externos; versionar caché en cada deploy
2. Confeti: dibujar en canvas, no en div
3. Eliminación: no automática, esperar siguiente giro
4. Traducciones: script Node para 25 idiomas; normalizar comas tras insertar
5. Sonido: Web Audio requiere gesto del usuario
6. Orden de scripts: 3 bloques inline; el 1 no puede usar nada del 3 al cargar
7. finishSpin sin resetear isSpinning: resetear antes del early return
8. Tests verdes falsos: reintroducir el bug a propósito para validar el test
9. Nombres vacíos: si el navegador no entrega el nombre, ningún código lo recupera
10. Restauración fantasma: no auto-restaurar sobre subidas en curso (epoch)

## 8. Estado y pendientes

**Versión actual:** v3.12.0

**Pendientes:**
- Ideas: importar CSV, modo pantalla completa, modo pesos
- Mejoras: ninguna pendiente conocida
