# RULETA-Manual-Skills.md

## 1. Ficha

| Campo | Valor |
|-------|-------|
| Nombre | Ruleta de Imágenes |
| Versión | v3.0.1 |
| URL | https://sandovaljon.github.io/Ruleta-by-SandovalJon/ |
| Repo | https://github.com/SandovalJon/Ruleta-by-SandovalJon |
| Stack | HTML5, CSS3, JS vanilla, Canvas 2D, Web Audio, Firebase |
| Autor | SandovalJon |

## 2. Arquitectura y flujo

1. Usuario sube imágenes (drag & drop o clic)
2. Imágenes se procesan y redimensionan (max 800px)
3. Se dibuja la ruleta en Canvas 2D
4. Click en ruleta → girar con animación easeOut
5. Sonido tick sincronizado con sectores
6. Al parar → confeti + sonido victoria
7. Modo eliminación → ganador se elimina al siguiente giro
8. Grabar → MediaRecorder captura canvas + audio → MP4

## 3. Capacidades

- Girar ruleta (animación 3-7s)
- Subir hasta 500 imágenes
- Reordenar con drag & drop
- Modo eliminación persistente (marca ganadores con ✓, no los borra)
- Restaurar eliminados (botón ♻️)
- Máximo 12 imágenes visibles por giro (selección justa de todas las activas)
- 2 temas (Noche, Claro) + Esmeralda (solo dev)
- 25 idiomas
- Sonido on/off (persistente)
- Grabar MP4 800x800 con audio
- Confeti animado
- Efecto ruleta loca (colores cambiantes)
- Sets guardan/cargan estado de eliminación (Firebase)
- Instalable como app (manifest)

## 4. APIs/claves/recursos

- Firebase Auth (Google Login)
- Firestore (guardar/cargar sets)
- Web Audio API (sonidos sintetizados)
- Canvas 2D (dibujar ruleta)
- MediaRecorder (grabar video)
- localStorage (preferencias)

## 5. Datos/memoria

- localStorage: tema, idioma, sonido
- Firestore: sets de imágenes por usuario
- Session: imágenes cargadas, estado ruleta

## 6. Despliegue y operación

- Repo: GitHub → GitHub Pages
- Deploy: push a main → Pages auto-deploy
- App: manifest.json (instalable). Sin service worker (eliminado por problemas de caché).
- Actualizar: botón 🔄 limpia cache (visible para dev jdss07@outlook.fr)

## 7. Skills y lecciones

1. Service worker: no cachear scripts externos
2. Confeti: dibujar en canvas, no en div
3. Eliminación: no automática, esperar siguiente giro
4. Traducciones: script Node para 25 idiomas
5. Sonido: Web Audio requiere gesto del usuario
6. Service worker autodestructivo: versiones viejas quedan atrapadas en caché. El sw.js actual se desregistra y limpia caches al activarse.
7. finishSpin sin resetear isSpinning: si no hay imágenes visibles, la función retornaba temprano dejando isSpinning=true permanente. Fix: resetear antes del early return.
8. indexedDB.deleteDatabase al inicio: causaba errores async en beforeunload. Fix: eliminar el borrado, no persistir imágenes entre sesiones.

## 8. Estado y pendientes

**Versión actual:** v3.0.1 (2026-09-25)

**Pendientes:**
- Ideas: importar CSV, modo pantalla completa, modo pesos
- Mejoras: reordenar previews, animaciones de entrada
- Fixes aplicados: SW autodestructivo, isSpinning reset, límite 100 img, max 12 visibles