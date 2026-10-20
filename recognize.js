/**
 * Fotoerkennung mit MobileCLIP (über Transformers.js) – läuft komplett am Gerät.
 * Vergleicht das Foto mit dem Wortschatz aus tools/clip-vocab.mjs und liefert Namensvorschläge.
 * Modell und Fingerabdrücke legt .github/workflows/fotoerkennung.yml unter models/clip/ ab.
 */
const ROOT = new URL('./', import.meta.url);
const L = p => new URL(p, ROOT).href;
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';
const SIZE = 256;
let engine = null;

async function exists(url) { try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; } }

async function load(progress) {
  const vr = await fetch(L('models/clip/vocab.json'));
  if (!vr.ok) { const e = new Error('Fotoerkennung noch nicht bereit'); e.code = 'missing'; throw e; }
  const vocab = await vr.json();
  const er = await fetch(L('models/clip/text-embeds.bin'));
  if (!er.ok) { const e = new Error('Fingerabdrücke fehlen'); e.code = 'missing'; throw e; }
  const emb = new Float32Array(await er.arrayBuffer());
  if (emb.length !== vocab.items.length * vocab.dim) throw new Error('Fingerabdrücke passen nicht zum Wortschatz');
  progress?.('Lade Fotoerkennung …');
  let T;
  try { T = await import(L('vendor/transformers/transformers.min.js')); } catch { T = await import(CDN); }
  T.env.allowLocalModels = true;
  T.env.allowRemoteModels = false;
  T.env.localModelPath = L('models/clip/');
  const wasm = T.env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1; // GitHub Pages erlaubt keine Threads
    if (await exists(L('vendor/ort/ort-wasm-simd-threaded.jsep.wasm')) || await exists(L('vendor/ort/ort-wasm-simd-threaded.wasm'))) wasm.wasmPaths = L('vendor/ort/');
  }
  const processor = await T.AutoProcessor.from_pretrained(vocab.model);
  // Probelauf, damit ein Gerät, das die Variante nicht ausführen kann, auf fp32 (direkt von Hugging Face) ausweicht
  const probe = async m => { await m(await processor(new T.RawImage(new Uint8ClampedArray(64 * 64 * 4).fill(128), 64, 64, 4))); return m; };
  let model;
  try { model = await probe(await T.CLIPVisionModelWithProjection.from_pretrained(vocab.model, { dtype: vocab.dtype || 'fp16', device: 'wasm' })); }
  catch {
    progress?.('Lade Fotoerkennung (Ersatz) …');
    T.env.allowRemoteModels = true;
    model = await probe(await T.CLIPVisionModelWithProjection.from_pretrained(vocab.model, { dtype: 'fp32', device: 'wasm' }));
  }
  return { T, processor, model, emb, vocab };
}

export function warmUp(progress) {
  engine ??= load(progress).catch(e => { engine = null; throw e; });
  return engine;
}

/** Liefert bis zu k Vorschläge [{ name, cat, p }] für ein Foto (Blob). */
export async function suggest(blob, progress, k = 3) {
  const { T, processor, model, emb, vocab } = await warmUp(progress);
  progress?.('Erkenne …');
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height, m = Math.min(w, h);
  // ganzes Bild (quadratisch, Mitte) und ein engerer Ausschnitt – das Ding liegt meist in der Mitte
  const crops = [[(w - m) / 2, (h - m) / 2, m], [(w - m * .62) / 2, (h - m * .62) / 2, m * .62]];
  const items = vocab.items, D = vocab.dim, scale = vocab.scale || 100;
  const acc = new Float32Array(items.length);
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  for (const [sx, sy, s] of crops) {
    ctx.drawImage(bmp, sx, sy, s, s, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    const img = new T.RawImage(new Uint8ClampedArray(data), SIZE, SIZE, 4);
    const { image_embeds } = await model(await processor(img));
    const v = image_embeds.normalize().data;
    const logits = new Float32Array(items.length); let max = -Infinity;
    for (let i = 0; i < items.length; i++) { let d = 0; const o = i * D; for (let j = 0; j < D; j++) d += emb[o + j] * v[j]; logits[i] = d * scale; if (logits[i] > max) max = logits[i]; }
    let sum = 0; for (let i = 0; i < logits.length; i++) { logits[i] = Math.exp(logits[i] - max); sum += logits[i]; }
    for (let i = 0; i < logits.length; i++) acc[i] += logits[i] / sum / crops.length;
    image_embeds.dispose?.();
  }
  bmp.close?.();
  const by = new Map();
  items.forEach((it, i) => { const x = by.get(it.name) || { name: it.name, cat: it.cat, p: 0 }; x.p += acc[i]; by.set(it.name, x); });
  const list = [...by.values()].sort((a, b) => b.p - a.p);
  if (!list.length || list[0].p < 0.06) return [];
  return list.filter(x => x.p >= Math.max(0.04, list[0].p * 0.15)).slice(0, k);
}
