/**
 * Fotoerkennung – Seite: schneidet das Foto zu und schickt es an den Hintergrund-Prozess
 * (recognize-worker.js). Geht das nicht, läuft dieselbe Erkennung direkt in der Seite.
 */
const SIZE = 256;
const TIMEOUT = 4 * 60 * 1000;
let worker = null, workerBroken = false, inline = null, seq = 0;
const pending = new Map();

function startWorker() {
  if (worker || workerBroken) return worker;
  try {
    worker = new Worker(new URL('./recognize-worker.js', import.meta.url), { type: 'module' });
  } catch { workerBroken = true; return null; }
  worker.onmessage = e => {
    const { id, type } = e.data; const p = pending.get(id); if (!p) return;
    if (type === 'progress') { p.onProgress?.(e.data.info); return; }
    pending.delete(id); clearTimeout(p.timer);
    if (type === 'done') p.resolve({ ...e.data.result, via: 'worker' });
    else p.reject(Object.assign(new Error(e.data.error), { code: e.data.code }));
  };
  // Worker lässt sich gar nicht starten (z. B. alter Browser) → alles direkt in der Seite wiederholen
  worker.onerror = ev => {
    ev.preventDefault?.();
    workerBroken = true; worker.terminate(); worker = null;
    for (const [, p] of pending) { clearTimeout(p.timer); p.retryInline(); }
    pending.clear();
  };
  return worker;
}

async function runInline(type, crops, onProgress) {
  const mod = await import('./recognize-engine.js');
  inline ??= mod.createEngine(onProgress).catch(e => { inline = null; throw e; });
  const en = await inline;
  const meta = { dtype: en.dtype, loadMs: en.loadMs, errors: en.errors, terms: en.vocab.items.length };
  if (type === 'warm') return { meta, via: 'inline' };
  if (type !== 'embed') onProgress?.({ step: 'run', msg: 'Erkenne …' });
  const want = type === 'embed' ? { list: false, vecs: true } : type === 'query' ? { vecs: true } : {};
  return { ...(await mod.classify(en, crops, type === 'query' ? 5 : 3, want)), meta, via: 'inline' };
}

function call(type, crops, onProgress) {
  const w = startWorker();
  if (!w) return runInline(type, crops, onProgress);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error('Zeitüberschreitung – das Laden dauert zu lange. Im WLAN nochmal versuchen.'), { code: 'timeout' })); }, TIMEOUT);
    pending.set(id, { resolve, reject, onProgress, timer, retryInline: () => runInline(type, crops, onProgress).then(resolve, reject) });
    const transfer = (crops || []).map(c => c.data.buffer);
    w.postMessage({ id, type, crops }, transfer);
  });
}

async function cropsOf(blob, single = false) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(blob));
  const w = bmp.width, h = bmp.height, m = Math.min(w, h);
  // ganzes Bild (quadratisch, Mitte) und ein engerer Ausschnitt – das Ding liegt meist in der Mitte
  const boxes = [[(w - m) / 2, (h - m) / 2, m], [(w - m * .62) / 2, (h - m * .62) / 2, m * .62]].slice(0, single ? 1 : 2);
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const out = boxes.map(([sx, sy, s]) => { ctx.drawImage(bmp, sx, sy, s, s, 0, 0, SIZE, SIZE); return { data: ctx.getImageData(0, 0, SIZE, SIZE).data, w: SIZE, h: SIZE }; });
  bmp.close?.();
  return out;
}

/** Modell im Hintergrund laden (ohne Foto). */
export const warmUp = onProgress => call('warm', [], onProgress);

/** Bild-Fingerabdruck eines (quadratischen) Vorschaubilds: Float32Array, normiert */
export async function embed(blob, onProgress) {
  const res = await call('embed', await cropsOf(blob, true), onProgress);
  return res.vecs[0];
}

/** Suchfoto: Fingerabdrücke (ganzes Bild + Mitte) und Namensvorschläge */
export async function query(blob, onProgress) {
  return call('query', await cropsOf(blob), onProgress);
}

/** Vorschläge für ein Foto (Blob): { list: [{ name, cat, p }], ms, meta, via } */
export async function suggest(blob, onProgress) {
  const crops = await cropsOf(blob);
  return call('suggest', crops, onProgress);
}
