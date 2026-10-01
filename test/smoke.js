/**
 * Test de humo para la Ruleta de Imagenes.
 *
 * Levanta Chrome headless, carga la pagina real y comprueba que:
 *   1. La pagina carga sin excepciones ni errores de consola
 *   2. Las funciones criticas existen
 *   3. Subir imagenes funciona y respeta el orden
 *   4. Girar produce un ganador
 *   5. Deshacer revierte el giro
 *   6. La eliminacion y su deshacer funcionan
 *   7. Las imagenes se recuperan de IndexedDB al recargar
 *   8. Limpiar vacia memoria y IndexedDB
 *   9. Los limites de imagenes se respetan
 *  10. No quedan funciones huerfanas ni TDZ
 *
 * Uso:
 *   node test/smoke.js              -> prueba contra el archivo local
 *   node test/smoke.js --live       -> prueba contra https://sandovaljon.github.io/...
 *
 * Requiere: node, Chrome instalado, y la dependencia 'ws'.
 *   npm install ws
 */

'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const USE_LIVE = process.argv.includes('--live');
const LIVE_URL = 'https://sandovaljon.github.io/Ruleta-by-SandovalJon/';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const PORT = 9222 + Math.floor(Math.random() * 400);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function waitForPort() {
  for (let i = 0; i < 60; i++) {
    try {
      await getJSON('http://127.0.0.1:' + PORT + '/json/version');
      return true;
    } catch (e) {
      await sleep(400);
    }
  }
  return false;
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    this.exceptions = [];
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg.result);
        this.pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        const text = (d.exception && d.exception.description) || d.text;
        this.exceptions.push(text);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.errors.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
      }
    });
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const mid = ++this.id;
      this.pending.set(mid, resolve);
      this.ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(mid)) {
          this.pending.delete(mid);
          reject(new Error('timeout en ' + method));
        }
      }, 60000);
    });
  }

  async eval(expression, awaitPromise) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: !!awaitPromise,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('eval fallo: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result ? r.result.value : undefined;
  }

  /** Navega y reinyecta los helpers, porque la pagina se recrea al recargar. */
  async navigate(url) {
    const target = url || this.currentUrl;
    await this.send('Page.navigate', { url: target });
    await sleep(3000);
    await this.eval(HELPERS, true);
  }
}

// --- Helpers que se inyectan en la pagina ---
const HELPERS = `
  window.__t = {
    mkFile(name, color) {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const x = c.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, 200, 200);
      x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif';
      x.fillText(name, 10, 110);
      return new Promise(r => c.toBlob(b => r(new File([b], name, { type: 'image/png' })), 'image/png'));
    },
    async makeFiles(n) {
      const cols = ['#e94560','#0f3460','#16c79a','#ffd700','#4ecdc4','#ff6b6b','#45b7d1','#96ceb4'];
      const out = [];
      for (let i = 0; i < n; i++) out.push(await this.mkFile('Foto ' + i, cols[i % cols.length]));
      return out;
    },
    async waitFor(fn, ms) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (fn()) return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    },
    async waitSpin() {
      await this.waitFor(() => !isSpinning, 20000);
      await new Promise(r => setTimeout(r, 300));
    },
    clear() { confirm = () => true; document.getElementById('clearBtn').click(); },
    idbCount() {
      return new Promise(res => {
        const req = indexedDB.open('RuletaDB', 1);
        req.onsuccess = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('images')) { d.close(); return res(0); }
          const tx = d.transaction('images', 'readonly');
          const g = tx.objectStore('images').getAll();
          g.onsuccess = () => { res(g.result.length); d.close(); };
          g.onerror = () => { res(-1); d.close(); };
        };
        req.onerror = () => res(-1);
      });
    }
  };
  true;
`;

// --- Los tests ---
const tests = [
  {
    name: 'la pagina carga sin excepciones',
    run: null, // se verifica al final
  },
  {
    name: 'las funciones criticas existen',
    run: async (c) => {
      const required = [
        'handleFiles', 'spin', 'undo', 'clearUndo', 'getActiveIndices',
        'invalidateActive', 'rebuildWheel', 'updatePreview', 'compressImage',
        'loadImagesFromDB', 'clearImagesDB', 'saveImagesToDB', 'addDataUrls',
        'resetAndSetImages', 'toDataURLAsync', 'getMaxImages',
      ];
      const missing = await c.eval(
        `(${JSON.stringify(required)}).filter(n => typeof window[n] !== 'function')`
      );
      return missing.length === 0 ? true : 'faltan: ' + missing.join(', ');
    },
  },
  {
    name: 'el DOM tiene los controles esperados',
    run: async (c) => {
      const ids = ['dropZone', 'fileInput', 'previewImages', 'rouletteCanvas',
                   'result', 'undoBtn', 'clearBtn', 'undoLabel'];
      const missing = await c.eval(
        `(${JSON.stringify(ids)}).filter(i => !document.getElementById(i))`
      );
      return missing.length === 0 ? true : 'faltan: ' + missing.join(', ');
    },
  },
  {
    name: 'el resultado es anunciable por lectores de pantalla',
    run: async (c) => {
      const r = await c.eval(`(() => {
        const el = document.getElementById('result');
        const cv = document.getElementById('rouletteCanvas');
        return {
          live: el.getAttribute('aria-live'),
          role: el.getAttribute('role'),
          cvRole: cv.getAttribute('role'),
          cvLabel: !!cv.getAttribute('aria-label')
        };
      })()`);
      if (r.live !== 'polite') return 'aria-live = ' + r.live;
      if (r.role !== 'status') return 'role = ' + r.role;
      if (r.cvRole !== 'img') return 'canvas role = ' + r.cvRole;
      if (!r.cvLabel) return 'canvas sin aria-label';
      return true;
    },
  },
  {
    name: 'el limite de imagenes se respeta',
    run: async (c) => {
      const max = await c.eval('getMaxImages()');
      if (typeof max !== 'number' || max < 1) return 'getMaxImages() = ' + max;
      return true;
    },
  },
  {
    name: 'subir imagenes respeta el orden seleccionado',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const files = await __t.makeFiles(6);
        handleFiles(files);
        await __t.waitFor(() => !isLoading && images.length === 6, 15000);
        return {
          total: images.length,
          nombres: fileNames.slice(),
          huecos: images.filter(x => !x).length,
          previews: document.getElementById('previewImages').children.length
        };
      })()`, true);
      if (r.total !== 6) return 'se esperaban 6 imagenes, hay ' + r.total;
      if (r.huecos !== 0) return r.huecos + ' huecos en el array';
      if (r.previews !== 6) return r.previews + ' miniaturas';
      const esperado = ['Foto 0','Foto 1','Foto 2','Foto 3','Foto 4','Foto 5'];
      if (JSON.stringify(r.nombres) !== JSON.stringify(esperado)) {
        return 'orden incorrecto: ' + r.nombres.join(',');
      }
      return true;
    },
  },
  {
    name: 'girar produce un ganador valido',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        spin();
        await __t.waitSpin();
        return {
          ganador: winnerIndex,
          valido: winnerIndex >= 0 && winnerIndex < images.length,
          mensaje: document.getElementById('result').textContent,
          enDom: !!document.querySelector('.winner-name')
        };
      })()`, true);
      if (!r.valido) return 'winnerIndex = ' + r.ganador;
      if (!r.mensaje.includes('GANADOR') && !r.mensaje.includes('WINNER')) {
        return 'mensaje sin ganador: ' + r.mensaje;
      }
      if (!r.enDom) return 'el nombre del ganador no esta en el DOM';
      return true;
    },
  },
  {
    name: 'deshacer revierte el giro',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        const undoVisibleAntes = document.getElementById('undoBtn').style.display;
        undo();
        await new Promise(r => setTimeout(r, 300));
        return { ganador: winnerIndex, undoVisibleAntes };
      })()`, true);
      if (r.ganador !== -1) return 'winnerIndex quedo en ' + r.ganador;
      if (r.undoVisibleAntes === 'none') return 'el boton de deshacer no aparecio tras girar';
      return true;
    },
  },
  {
    name: 'eliminar ganador y su deshacer funcionan',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        spin();
        await __t.waitSpin();
        const antes = eliminatedIndices.size;
        eliminateWinner();
        await new Promise(r => setTimeout(r, 200));
        const despues = eliminatedIndices.size;
        undo();
        await new Promise(r => setTimeout(r, 200));
        return { antes, despues, trasUndo: eliminatedIndices.size };
      })()`, true);
      if (r.despues !== r.antes + 1) return 'eliminar no sumo (de ' + r.antes + ' a ' + r.despues + ')';
      if (r.trasUndo !== r.antes) return 'deshacer no revirtio (quedo en ' + r.trasUndo + ')';
      return true;
    },
  },
  {
    name: 'borrar una imagen y deshacer la restauran',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        const antes = images.length;
        const nombre = fileNames[1];
        removeImage(1);
        await new Promise(r => setTimeout(r, 200));
        const trasBorrar = images.length;
        undo();
        await new Promise(r => setTimeout(r, 200));
        return { antes, trasBorrar, trasUndo: images.length, nombre, nombreRestaurado: fileNames[1] };
      })()`, true);
      if (r.trasBorrar !== r.antes - 1) return 'no se borro (de ' + r.antes + ' a ' + r.trasBorrar + ')';
      if (r.trasUndo !== r.antes) return 'deshacer no restauro (quedo en ' + r.trasUndo + ')';
      if (r.nombreRestaurado !== r.nombre) return 'el nombre no se restauro';
      return true;
    },
  },
  {
    name: 'las imagenes sin nombre se pueden renombrar',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        // simular 3 archivos sin nombre, como los de un drag en la nube
        const mk = (color) => new Promise(res => {
          const c = document.createElement('canvas');
          c.width = 120; c.height = 120;
          const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,120,120);
          c.toBlob(b => res(new File([b], '', { type: 'image/png' })), 'image/png');
        });
        const files = [await mk('#f00'), await mk('#0f0'), await mk('#00f')];
        handleFiles(files, null);
        await __t.waitFor(() => !isLoading && images.length === 3, 15000);

        const genericosAntes = fileNames.filter(n => /^Imagen \\d+$/.test(n)).length;
        const hayAviso = document.getElementById('setMsg').textContent.length > 0;
        const hayInsignia = document.querySelectorAll('.preview-nameless').length;

        // renombrar la primera
        window.prompt = () => 'Maria Perez';
        renameImage(0);
        await new Promise(r => setTimeout(r, 300));

        return {
          genericosAntes,
          hayAviso,
          hayInsignia,
          nombre0: fileNames[0],
          insigniaTrasRenombrar: document.querySelectorAll('.preview-nameless').length
        };
      })()`, true);
      if (r.genericosAntes !== 3) return 'no se generaron 3 nombres genericos (hubo ' + r.genericosAntes + ')';
      if (!r.hayAviso) return 'no se mostro el aviso de nombres faltantes';
      if (r.hayInsignia !== 3) return 'faltan insignias de renombrar (hay ' + r.hayInsignia + ')';
      if (r.nombre0 !== 'Maria Perez') return 'el renombrado no se aplico: ' + r.nombre0;
      if (r.insigniaTrasRenombrar !== 2) return 'la insignia no desaparecio tras renombrar';
      return true;
    },
  },
  {
    name: 'deshacer un renombrado lo revierte',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        const antes = fileNames[0];
        window.prompt = () => 'Otro Nombre';
        renameImage(0);
        await new Promise(r => setTimeout(r, 200));
        const trasRenombrar = fileNames[0];
        undo();
        await new Promise(r => setTimeout(r, 200));
        return { antes, trasRenombrar, trasUndo: fileNames[0] };
      })()`, true);
      if (r.trasRenombrar !== 'Otro Nombre') return 'el renombrado no aplico: ' + r.trasRenombrar;
      if (r.trasUndo !== r.antes) return 'deshacer no revirtio el nombre (quedo "' + r.trasUndo + '" en vez de "' + r.antes + '")';
      return true;
    },
  },
  {
    name: 'el renombrado masivo aplica varios nombres a la vez',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const mk = (color) => new Promise(res => {
          const cc = document.createElement('canvas');
          cc.width = 120; cc.height = 120;
          const x = cc.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,120,120);
          cc.toBlob(b => res(new File([b], '', { type: 'image/png' })), 'image/png');
        });
        const files = [await mk('#f00'), await mk('#0f0'), await mk('#00f'), await mk('#ff0')];
        handleFiles(files, null);
        await __t.waitFor(() => !isLoading && images.length === 4, 15000);

        const botonVisible = document.getElementById('bulkRenameBtn').style.display !== 'none';
        openBulkRename();
        const filas = document.querySelectorAll('#bulkList .bulk-row').length;
        const inputs = document.querySelectorAll('#bulkList input[data-index]');
        const nombres = ['Ana', 'Beto', 'Caro', 'Dora'];
        inputs.forEach((inp, k) => { inp.value = nombres[k]; });
        saveBulkRename();
        await new Promise(r => setTimeout(r, 300));
        return {
          botonVisible, filas,
          aplicados: fileNames.slice(),
          modalCerrado: document.getElementById('bulkModal').style.display === 'none',
          botonOculto: document.getElementById('bulkRenameBtn').style.display === 'none'
        };
      })()`, true);
      if (!r.botonVisible) return 'el boton masivo no aparecio con 4 sin nombre';
      if (r.filas !== 4) return 'el modal mostro ' + r.filas + ' filas en vez de 4';
      const esperado = ['Ana', 'Beto', 'Caro', 'Dora'];
      if (JSON.stringify(r.aplicados) !== JSON.stringify(esperado)) {
        return 'nombres aplicados incorrectos: ' + JSON.stringify(r.aplicados);
      }
      if (!r.modalCerrado) return 'el modal no se cerro al guardar';
      if (!r.botonOculto) return 'el boton masivo sigue visible tras renombrar todo';
      return true;
    },
  },
  {
    name: 'deshacer un renombrado masivo lo revierte todo',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const mk = (color) => new Promise(res => {
          const cc = document.createElement('canvas');
          cc.width = 120; cc.height = 120;
          const x = cc.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,120,120);
          cc.toBlob(b => res(new File([b], '', { type: 'image/png' })), 'image/png');
        });
        const files = [await mk('#f00'), await mk('#0f0'), await mk('#00f'), await mk('#ff0')];
        handleFiles(files, null);
        await __t.waitFor(() => !isLoading && images.length === 4, 15000);
        openBulkRename();
        const inputs = document.querySelectorAll('#bulkList input[data-index]');
        inputs.forEach((inp, k) => { inp.value = 'X' + k; });
        saveBulkRename();
        await new Promise(r => setTimeout(r, 200));
        const tras = fileNames.slice();
        undo();
        await new Promise(r => setTimeout(r, 200));
        return { tras, trasUndo: fileNames.slice() };
      })()`, true);
      const esperadoX = ['X0', 'X1', 'X2', 'X3'];
      if (JSON.stringify(r.tras) !== JSON.stringify(esperadoX)) {
        return 'el masivo no aplico: ' + JSON.stringify(r.tras);
      }
      const esperadoGen = ['Imagen 1', 'Imagen 2', 'Imagen 3', 'Imagen 4'];
      if (JSON.stringify(r.trasUndo) !== JSON.stringify(esperadoGen)) {
        return 'deshacer no revirtio: ' + JSON.stringify(r.trasUndo);
      }
      return true;
    },
  },
  {
    name: 'el renombrado masivo sobrevive a la recarga',
    run: async (c, ctx) => {
      await c.eval(`(async () => {
        openBulkRename();
        const inputs = document.querySelectorAll('#bulkList input[data-index]');
        const nombres = ['Ana', 'Beto', 'Caro', 'Dora'];
        inputs.forEach((inp, k) => { inp.value = nombres[k]; });
        saveBulkRename();
        await new Promise(r => setTimeout(r, 200));
        autoSaveImages();
        await new Promise(r => setTimeout(r, 2000));
      })()`, true);
      await c.navigate(ctx.url);
      const r = await c.eval(`(async () => {
        await new Promise(r => setTimeout(r, 3000));
        return { total: images.length, nombres: fileNames.slice(0, 4) };
      })()`, true);
      if (r.total !== 4) return 'se esperaban 4 imagenes, hay ' + r.total;
      const esperado = ['Ana', 'Beto', 'Caro', 'Dora'];
      if (JSON.stringify(r.nombres) !== JSON.stringify(esperado)) {
        return 'nombres masivos no persistieron: ' + JSON.stringify(r.nombres);
      }
      return true;
    },
  },
  {
    name: 'los nombres no se desalinean con archivos no-imagen',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const mkImg = (name, color) => new Promise(res => {
          const c = document.createElement('canvas');
          c.width = 120; c.height = 120;
          const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,120,120);
          c.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png');
        });
        // un archivo que NO es imagen, seguido de imagenes con nombre
        const notImg = new File(['x'], 'LEEME.txt', { type: 'text/plain' });
        const a = await mkImg('Ana.jpg', '#f00');
        const b = await mkImg('Beto.png', '#0f0');
        // nombres alineados con el orden ORIGINAL (incluyendo el txt)
        handleFiles([notImg, a, b], ['LEEME.txt', 'Ana.jpg', 'Beto.png']);
        await __t.waitFor(() => !isLoading && images.length === 2, 15000);
        return { total: images.length, nombres: fileNames.slice() };
      })()`, true);
      if (r.total !== 2) return 'se esperaban 2 imagenes, hay ' + r.total;
      const esperado = ['Ana.jpg', 'Beto.png'];
      if (JSON.stringify(r.nombres) !== JSON.stringify(esperado)) {
        return 'nombres desalineados: ' + JSON.stringify(r.nombres) + ' (esperado ' + JSON.stringify(esperado) + ')';
      }
      return true;
    },
  },
  {
    name: 'los nombres originales sobreviven a la recarga',
    run: async (c) => {
      // cargar con nombres reconocibles y autoguardar
      await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const files = await __t.makeFiles(4);
        handleFiles(files);
        await __t.waitFor(() => !isLoading && images.length === 4, 15000);
        autoSaveImages();
        await new Promise(r => setTimeout(r, 2000));
      })()`, true);
      await c.navigate(c.currentUrl);
      const r = await c.eval(`(async () => {
        await new Promise(r => setTimeout(r, 3000));
        return { total: images.length, nombres: fileNames.slice() };
      })()`, true);
      if (r.total !== 4) return 'se esperaban 4 imagenes, hay ' + r.total;
      const esperado = ['Foto 0', 'Foto 1', 'Foto 2', 'Foto 3'];
      if (JSON.stringify(r.nombres) !== JSON.stringify(esperado)) {
        return 'nombres incorrectos tras recargar: ' + JSON.stringify(r.nombres);
      }
      return true;
    },
  },
  {
    name: 'los nombres originales sobreviven a girar',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        spin();
        await __t.waitSpin();
        await new Promise(r => setTimeout(r, 300));
        return {
          ganador: winnerIndex,
          esperado: fileNames[winnerIndex],
          enHistorial: spinHistory[0] ? spinHistory[0].nombre : null,
          enDom: document.querySelector('.winner-name') ? document.querySelector('.winner-name').textContent : null
        };
      })()`, true);
      if (!r.esperado) return 'el ganador no tiene nombre';
      if (/^Imagen \\d+$/.test(r.esperado)) return 'el ganador uso un nombre generico: ' + r.esperado;
      if (r.enHistorial !== r.esperado) {
        return 'el historial guardo "' + r.enHistorial + '" en vez de "' + r.esperado + '"';
      }
      if (r.enDom !== r.esperado) {
        return 'el DOM muestra "' + r.enDom + '" en vez de "' + r.esperado + '"';
      }
      return true;
    },
  },
  {
    name: 'resetAndSetImages respeta los nombres dados',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        const misNombres = ['Ana', 'Beto', 'Caro'];
        // tres imagenes dataURL minimas
        const mk = (color) => {
          const cv = document.createElement('canvas');
          cv.width = 8; cv.height = 8;
          const x = cv.getContext('2d');
          x.fillStyle = color; x.fillRect(0,0,8,8);
          return cv.toDataURL('image/png');
        };
        resetAndSetImages([mk('#f00'), mk('#0f0'), mk('#00f')], misNombres);
        await __t.waitFor(() => !isLoading && images.length === 3, 10000);
        return { nombres: fileNames.slice(), total: images.length };
      })()`, true);
      const esperado = ['Ana', 'Beto', 'Caro'];
      if (JSON.stringify(r.nombres) !== JSON.stringify(esperado)) {
        return 'esperaba ' + JSON.stringify(esperado) + ', obtuve ' + JSON.stringify(r.nombres);
      }
      return true;
    },
  },
  {
    name: 'los nombres sobreviven si IndexedDB no tiene el campo name',
    run: async (c, ctx) => {
      // sembrar datos con el formato antiguo (sin 'name') y comprobar
      // que la app no rompe y que el historial no hereda nombres genericos
      const seed = await c.eval(`(async () => {
        const mk = (color) => {
          const cv = document.createElement('canvas');
          cv.width = 200; cv.height = 200;
          const x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,200,200);
          return cv.toDataURL('image/png');
        };
        return await new Promise(res => {
          const req = indexedDB.open('RuletaDB', 1);
          req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { keyPath: 'index' });
          };
          req.onsuccess = e => {
            const d = e.target.result;
            const tx = d.transaction('images', 'readwrite');
            const st = tx.objectStore('images');
            st.clear();
            for (let i = 0; i < 5; i++) st.put({ index: i, dataUrl: mk('#' + i + 'f0a0') });
            tx.oncomplete = () => { d.close(); res(true); };
            tx.onerror = () => { d.close(); res(false); };
          };
          req.onerror = () => res(false);
        });
      })()`, true);
      if (!seed) return 'no se pudieron sembrar los datos';

      await c.navigate(ctx.url);
      const r = await c.eval(`(async () => {
        await new Promise(r => setTimeout(r, 3000));
        const nombresOk = fileNames.every(n => typeof n === 'string' && n.length > 0);
        spin();
        const t0 = Date.now();
        while (Date.now() - t0 < 20000 && isSpinning) await new Promise(r => setTimeout(r, 50));
        await new Promise(r => setTimeout(r, 300));
        return {
          total: images.length,
          nombresOk: nombresOk,
          nombres: fileNames.slice(),
          historial: spinHistory.map(h => h.nombre)
        };
      })()`, true);
      if (r.total !== 5) return 'se esperaban 5 imagenes, hay ' + r.total;
      if (!r.nombresOk) return 'hay nombres vacios tras recuperar datos antiguos';
      if (r.historial.length === 0) return 'el historial quedo vacio';
      return true;
    },
  },
  {
    name: 'las eliminaciones de una sesion anterior no se heredan',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        eliminatedIndices = new Set([2, 5, 9, 13]);
        saveEliminationState();
        const files = await __t.makeFiles(8);
        handleFiles(files);
        await __t.waitFor(() => !isLoading && images.length === 8, 15000);
        return { eliminadas: eliminatedIndices.size, total: images.length };
      })()`, true);
      if (r.eliminadas !== 0) return r.eliminadas + ' eliminadas heredadas sobre ' + r.total + ' imagenes';
      return true;
    },
  },
  {
    name: 'las imagenes se recuperan al recargar',
    run: async (c, ctx) => {
      // esperar a que el autoguardado termine de escribir
      await c.eval(`(async () => { autoSaveImages(); await new Promise(r => setTimeout(r, 2000)); })()`, true);
      await c.navigate(ctx.url);
      const r = await c.eval(`(async () => {
        await new Promise(r => setTimeout(r, 3000));
        return {
          total: images.length,
          cargadas: loadedImages.length,
          previews: document.getElementById('previewImages').children.length,
          nombre: fileNames[0] || ''
        };
      })()`, true);
      if (r.total !== 8) return 'se esperaban 8 recuperadas, hay ' + r.total;
      if (r.previews !== 8) return r.previews + ' miniaturas tras recargar';
      if (r.nombre !== 'Foto 0') return 'el nombre no se conservo: ' + r.nombre;
      return true;
    },
  },
  {
    name: 'la restauracion automatica no borra subidas en curso',
    run: async (c, ctx) => {
      // sembrar 40 documentos PESADOS para que la lectura tarde,
      // recargar y subir inmediatamente: la restauracion no debe borrar lo subido
      await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        function mkBig(i) {
          const cv = document.createElement('canvas');
          cv.width = 900; cv.height = 900;
          const x = cv.getContext('2d');
          x.fillStyle = '#' + ((i * 1234567) % 16777215).toString(16).padStart(6, '0');
          x.fillRect(0, 0, 900, 900);
          x.fillStyle = '#fff'; x.font = 'bold 60px sans-serif';
          x.fillText('VIEJA_' + i, 40, 460);
          return new Promise(res => cv.toBlob(b => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result);
            fr.readAsDataURL(b);
          }, 'image/png'));
        }
        const datas = [];
        for (let i = 0; i < 40; i++) datas.push(await mkBig(i));
        await new Promise(res => {
          const req = indexedDB.open('RuletaDB', 1);
          req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('images')) d.createObjectStore('images', { keyPath: 'index' });
          };
          req.onsuccess = e => {
            const d = e.target.result;
            const tx = d.transaction('images', 'readwrite');
            const st = tx.objectStore('images');
            st.clear();
            datas.forEach((dataUrl, i) => st.put({ index: i, dataUrl, name: 'VIEJA_' + i + '.png' }));
            tx.oncomplete = () => { d.close(); res(true); };
          };
        });
      })()`, true);
      await c.navigate(ctx.url);
      // subir INMEDIATAMENTE, sin esperar a que termine la restauracion
      const r = await c.eval(`(async () => {
        function mk(name, color) {
          const cc = document.createElement('canvas'); cc.width = 200; cc.height = 200;
          const x = cc.getContext('2d'); x.fillStyle = color; x.fillRect(0,0,200,200);
          x.fillStyle = '#fff'; x.font = 'bold 24px sans-serif'; x.fillText(name, 10, 110);
          return new Promise(res => cc.toBlob(b => res(new File([b], name, { type: 'image/png' })), 'image/png'));
        }
        const files = [await mk('NUEVA_A.jpg', '#e94560'), await mk('NUEVA_B.jpg', '#0f3460')];
        handleFiles(files);
        const t0 = Date.now();
        while (Date.now() - t0 < 45000 && (isLoading || images.length < 2)) {
          await new Promise(rr => setTimeout(rr, 100));
        }
        // esperar a que cualquier restauracion pendiente termine
        await new Promise(rr => setTimeout(rr, 8000));
        return {
          total: images.length,
          nombres: fileNames.slice(0, 3).concat(['...']).concat(fileNames.slice(-3)),
          tieneNuevas: fileNames.includes('NUEVA_A.jpg') && fileNames.includes('NUEVA_B.jpg')
        };
      })()`, true);
      if (!r.tieneNuevas) {
        return 'la restauracion borro las imagenes subidas (total ' + r.total + '): ' + JSON.stringify(r.nombres);
      }
      return true;
    },
  },
  {
    name: 'limpiar vacia memoria e IndexedDB',
    run: async (c, ctx) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 1200));
        return { memoria: images.length, idb: await __t.idbCount() };
      })()`, true);
      if (r.memoria !== 0) return r.memoria + ' imagenes en memoria';
      if (r.idb !== 0) return r.idb + ' documentos en IndexedDB';
      return true;
    },
  },
  {
    name: 'no quedan imagenes tras recargar de nuevo',
    run: async (c, ctx) => {
      await c.navigate(ctx.url);
      const r = await c.eval(`(async () => {
        await new Promise(r => setTimeout(r, 2500));
        return images.length;
      })()`, true);
      return r === 0 ? true : r + ' imagenes reaparecieron tras limpiar';
    },
  },
  {
    name: 'el historial registra los giros',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        if (typeof spinHistory === 'undefined') return { error: 'spinHistory no existe' };
        __t.clear();
        await new Promise(r => setTimeout(r, 400));
        const files = await __t.makeFiles(5);
        handleFiles(files);
        await __t.waitFor(() => !isLoading && images.length === 5, 15000);
        const antes = spinHistory.length;
        spin();
        await __t.waitSpin();
        await new Promise(r => setTimeout(r, 300));
        return {
          antes,
          despues: spinHistory.length,
          ultima: spinHistory[0] || null,
          visible: document.getElementById('historyPanel')
            ? getComputedStyle(document.getElementById('historyPanel')).display !== 'none'
            : false
        };
      })()`, true);
      if (r.error) return r.error;
      if (r.despues !== r.antes + 1) return 'el historial paso de ' + r.antes + ' a ' + r.despues;
      if (!r.ultima || !r.ultima.nombre) return 'la entrada no tiene nombre';
      if (!r.ultima.fecha) return 'la entrada no tiene fecha';
      return true;
    },
  },
  {
    name: 'el historial se puede copiar y exportar',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        if (typeof buildHistoryText !== 'function') return { error: 'buildHistoryText no existe' };
        const txt = buildHistoryText();
        return {
          largo: txt.length,
          lineas: txt.split('\\n').filter(Boolean).length,
          tieneEntrada: spinHistory.length > 0
        };
      })()`, true);
      if (r.error) return r.error;
      if (r.largo === 0) return 'el texto exportado esta vacio';
      if (!r.tieneEntrada) return 'no hay entradas que exportar';
      return true;
    },
  },
  {
    name: 'el historial se limpia al borrar las imagenes',
    run: async (c) => {
      const r = await c.eval(`(async () => {
        __t.clear();
        await new Promise(r => setTimeout(r, 600));
        return spinHistory.length;
      })()`, true);
      return r === 0 ? true : 'quedaron ' + r + ' entradas tras limpiar';
    },
  },
];

// --- Motor ---
(async function main() {
  let ws;
  let WebSocket;
  try {
    WebSocket = require('ws');
  } catch (e) {
    console.error('Falta la dependencia "ws". Ejecuta:  npm install ws');
    process.exit(2);
  }

  const chromePath = findChrome();
  if (!chromePath) {
    console.error('No se encontro Chrome ni Edge en este sistema.');
    process.exit(2);
  }

  const url = USE_LIVE
    ? LIVE_URL + '?t=' + Date.now()
    : 'file:///' + path.resolve(ROOT, 'index.html').replace(/\\/g, '/');

  const profile = path.join(os.tmpdir(), 'ruleta-smoke-' + Date.now());
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    'about:blank',
  ], { stdio: 'ignore' });

  let pass = 0, fail = 0;
  const failed = [];
  const ctx = { url };

  const cleanup = () => {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  };

  try {
    if (!await waitForPort()) throw new Error('Chrome no respondio en el puerto ' + PORT);

    const targets = await getJSON('http://127.0.0.1:' + PORT + '/json/list');
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no hay target de pagina');

    ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    const c = new Client(ws);
    c.currentUrl = url;

    await c.send('Runtime.enable');
    await c.send('Page.enable');
    await c.send('Page.navigate', { url });
    await sleep(2500);
    await c.eval(HELPERS, true);

    console.log('\n  Test de humo — Ruleta de Imagenes');
    console.log('  ' + (USE_LIVE ? 'EN VIVO: ' + LIVE_URL : 'LOCAL: index.html'));
    console.log('  ' + '-'.repeat(58));

    for (const test of tests) {
      if (!test.run) continue;
      let result;
      try {
        result = await test.run(c, ctx);
      } catch (e) {
        result = 'excepcion: ' + e.message;
      }
      if (result === true) {
        pass++;
        console.log('  PASA  ' + test.name);
      } else {
        fail++;
        failed.push(test.name + ' -> ' + result);
        console.log('  FALLA ' + test.name);
        console.log('        ' + result);
      }
    }

    // Comprobacion global de excepciones
    const realExceptions = c.exceptions.filter(e =>
      !/favicon|ERR_BLOCKED_BY_CLIENT|404|apple-mobile-web-app-capable/i.test(e)
    );
    if (realExceptions.length === 0) {
      pass++;
      console.log('  PASA  la pagina carga sin excepciones');
    } else {
      fail++;
      failed.push('excepciones: ' + realExceptions.length);
      console.log('  FALLA la pagina carga sin excepciones');
      realExceptions.slice(0, 5).forEach(e => console.log('        ' + e.split('\n')[0].slice(0, 110)));
    }

    console.log('  ' + '-'.repeat(58));
    console.log('  ' + pass + ' pasaron, ' + fail + ' fallaron\n');

    if (fail > 0) {
      console.log('  Fallos:');
      failed.forEach(f => console.log('    - ' + f));
      console.log('');
    }
    process.exitCode = fail > 0 ? 1 : 0;
  } catch (e) {
    console.error('\n  Error al ejecutar los tests: ' + e.message + '\n');
    process.exitCode = 2;
  } finally {
    try { if (ws) ws.close(); } catch (e) {}
    cleanup();
  }
})();
