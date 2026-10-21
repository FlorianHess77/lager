/**
 * Kern der Fotoerkennung (MobileCLIP über Transformers.js) – läuft im Hintergrund-Worker
 * (recognize-worker.js) und, falls Worker nicht gehen, direkt in der Seite.
 * Modell und Fingerabdrücke legt .github/workflows/fotoerkennung.yml unter models/clip/ ab.
 */
const ROOT = new URL('./', import.meta.url);
const L = p => new URL(p, ROOT).href;
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';

const fail = (msg, code) => Object.assign(new Error(msg), { code });
async function exists(url) { try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; } }

export async function createEngine(report = () => {}) {
  const t0 = Date.now();
  report({ step: 'vocab', msg: 'Lade Wortschatz …' });
  let vocab, emb;
  try {
    const vr = await fetch(L('models/clip/vocab.json'));
    if (!vr.ok) throw fail(`Wortschatz fehlt (HTTP ${vr.status})`, 'missing');
    vocab = await vr.json();
    const er = await fetch(L('models/clip/text-embeds.bin'));
    if (!er.ok) throw fail(`Fingerabdrücke fehlen (HTTP ${er.status})`, 'missing');
    emb = new Float32Array(await er.arrayBuffer());
  } catch (e) { if (e.code) throw e; throw fail('Keine Verbindung – beim ersten Mal braucht die Fotoerkennung Internet.', 'offline'); }
  if (emb.length !== vocab.items.length * vocab.dim) throw fail('Fingerabdrücke passen nicht zum Wortschatz', 'broken');

  report({ step: 'lib', msg: 'Lade Erkennungs-Programm …' });
  let T;
  try { T = await import(L('vendor/transformers/transformers.min.js')); }
  catch { T = await import(CDN); }
  T.env.allowLocalModels = true;
  T.env.allowRemoteModels = false;
  T.env.localModelPath = L('models/clip/');
  const wasm = T.env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1; // GitHub Pages erlaubt keine Threads
    wasm.proxy = false;
    if (await exists(L('vendor/ort/ort-wasm-simd-threaded.jsep.wasm'))) wasm.wasmPaths = L('vendor/ort/');
  }

  // Download-Fortschritt der Modelldatei anzeigen
  const progress_callback = p => {
    if (p?.status === 'progress' && /\.onnx$/.test(p.file || '') && p.total > 1e6) {
      report({ step: 'model', msg: `Lade Modell … ${Math.round(p.progress || 0)} %`, pct: p.progress });
    }
  };
  report({ step: 'model', msg: 'Lade Modell …' });
  const processor = await T.AutoProcessor.from_pretrained(vocab.model);
  const probeImg = new T.RawImage(new Uint8ClampedArray(64 * 64 * 4).fill(128), 64, 64, 4);
  const tryLoad = async dtype => {
    const m = await T.CLIPVisionModelWithProjection.from_pretrained(vocab.model, { dtype, device: 'wasm', progress_callback });
    report({ step: 'probe', msg: 'Prüfe Modell …' });
    await m(await processor(probeImg)); // Probelauf: fällt hier auf, wenn das Gerät die Variante nicht kann
    return m;
  };
  const errors = {};
  let model = null, dtype = vocab.dtype || 'fp16';
  try { model = await tryLoad(dtype); }
  catch (e) {
    errors[dtype] = String(e?.message ?? e).slice(0, 300);
    // Ersatz: genaueste Variante (fp32) direkt von Hugging Face
    report({ step: 'model', msg: 'Lade Ersatz-Modell …' });
    T.env.allowRemoteModels = true;
    dtype = 'fp32';
    try { model = await tryLoad(dtype); }
    catch (e2) { errors[dtype] = String(e2?.message ?? e2).slice(0, 300); throw fail(`Modell läuft auf diesem Gerät nicht: ${Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | ')}`, 'model'); }
  }
  return { T, processor, model, emb, vocab, dtype, errors, loadMs: Date.now() - t0 };
}

async function embedOne(engine, c) {
  const { T, processor, model } = engine;
  const img = new T.RawImage(new Uint8ClampedArray(c.data), c.w, c.h, 4);
  const { image_embeds } = await model(await processor(img));
  const v = Float32Array.from(image_embeds.normalize().data);
  image_embeds.dispose?.();
  return v;
}

function rank(engine, vecs, k = 3) {
  const { emb, vocab } = engine;
  const items = vocab.items, D = vocab.dim, scale = vocab.scale || 100;
  const acc = new Float32Array(items.length);
  for (const v of vecs) {
    const logits = new Float32Array(items.length); let max = -Infinity;
    for (let i = 0; i < items.length; i++) { let d = 0; const o = i * D; for (let j = 0; j < D; j++) d += emb[o + j] * v[j]; logits[i] = d * scale; if (logits[i] > max) max = logits[i]; }
    let sum = 0; for (let i = 0; i < logits.length; i++) { logits[i] = Math.exp(logits[i] - max); sum += logits[i]; }
    for (let i = 0; i < logits.length; i++) acc[i] += logits[i] / sum / vecs.length;
  }
  // gleiche Namen (mehrere Beschreibungen) zusammenzählen
  const by = new Map();
  items.forEach((it, i) => { const x = by.get(it.name) || { name: it.name, cat: it.cat, p: 0 }; x.p += acc[i]; by.set(it.name, x); });
  const all = [...by.values()].sort((a, b) => b.p - a.p);
  return all.filter((x, i) => i === 0 || x.p >= Math.max(0.03, all[0].p * 0.12)).slice(0, k)
    .map(x => ({ ...x, p: Math.round(x.p * 1000) / 1000 }));
}

/**
 * crops: [{ data: Uint8ClampedArray (RGBA), w, h }] – Bildausschnitte, die Seite schneidet sie zu.
 * Liefert { list: [{ name, cat, p }], ms } und mit want.vecs zusätzlich die Bild-Fingerabdrücke.
 */
export async function classify(engine, crops, k = 3, want = {}) {
  const t0 = Date.now();
  const vecs = [];
  for (const c of crops) vecs.push(await embedOne(engine, c));
  const out = { ms: Date.now() - t0 };
  if (want.list !== false) out.list = rank(engine, vecs, k);
  if (want.vecs) out.vecs = vecs;
  out.ms = Date.now() - t0;
  return out;
}
