# RULETA-Base-Conocimiento.md

## 1. IDENTIDAD

- **Nombre:** Ruleta de Imágenes
- **Stack:** HTML5, CSS3, JavaScript vanilla, Web Audio API, Canvas 2D
- **Repo:** https://github.com/SandovalJon/Ruleta-by-SandovalJon
- **URL:** https://sandovaljon.github.io/Ruleta-by-SandovalJon/
- **Versión:** v3.0.1
- **Fecha:** 2026-09-25
- **Último commit:** bea8a0c

## 2. ARQUITECTURA

- **Entry point:** index.html (SPA single-file)
- **PWA:** manifest.json (instalable). El service worker (sw.js) es autodestructivo: limpia cachés viejas, se desregistra y recarga. No hay modo offline (Firebase requiere red).
- **Firebase:** Auth (Google) + Firestore (guardar/cargar sets)
- **Audio:** Web Audio API (tick, whoosh, win sound, notif, error)
- **Canvas:** Ruleta animada con requestAnimationFrame
- **Grabación:** MediaRecorder (canvas + audio) o WebCodecs (fallback)
- **Idiomas:** 25 idiomas (sistema i18n con objeto L)
- **Temas:** Noche, Claro, Esmeralda (solo dev)

## 3. RECURSOS

- **Firebase Config:** En index.html línea 3220+
- **APIs:** Ninguna externa (todo local)
- **Datos:** Firestore (sets de imágenes por usuario)
- **Memoria:** localStorage (tema, idioma, sonido)

## 4. CAPACIDADES

| Feature | Estado | Descripción |
|---------|--------|-------------|
| Girar ruleta | ✅ | Animación con easeOut, sonido tick |
| Subir imágenes | ✅ | Drag & drop, máximo 25 |
| Reordenar imágenes | ✅ | Drag & drop en previews |
| Eliminar imagen | ✅ | Click en X |
| Limpiar todo | ✅ | Con confirmación |
| Seleccionar tema | ✅ | Noche, Claro, Esmeralda (dev) |
| Seleccionar idioma | ✅ | 25 idiomas |
| Sonido on/off | ✅ | Persiste en localStorage |
| Modo eliminación | ✅ | Borde rojo, ganador se queda |
| Grabar MP4 | ✅ | 800x800, con audio |
| Confeti | ✅ | Canvas, colores aleatorios |
| Efecto ruleta loca | ✅ | Colores cambiantes durante giro |
| PWA | ✅ | Offline, installable |
| Badge versión | ✅ | Solo para dev |
| Botón actualizar | ✅ | Limpia cache y recarga |

## 5. LECCIONES

1. **Service worker caché:** Cachear solo archivos locales, no externos (Firebase). Causa: Firebase scripts bloquean carga offline. Fix: fetch solo origin === location.origin. Verificación: funciona offline.

2. **Confeti posición:** Usar position:fixed en mobile causa desalineación. Fix: dibujar directamente en el canvas de la ruleta. Verificación: confeti siempre en la posición correcta.

3. **Eliminación automática:** No eliminar ganador inmediatamente. Fix: eliminar solo al girar de nuevo. Verificación: ganador visible hasta nuevo giro.

4. **Traducciones:** Agregar nuevas claves a los 25 idiomas. Fix: script Node.js para insertar en todos los bloques. Verificación: verificar cada idioma.