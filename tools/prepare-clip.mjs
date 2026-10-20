// Bereitet die Fotoerkennung (MobileCLIP) vor – läuft auf GitHub (.github/workflows/fotoerkennung.yml).
//  1. lädt das Bild-Modell (ca. 12 MB) nach models/clip/
//  2. berechnet die Text-Fingerabdrücke für alle Begriffe aus tools/clip-vocab.mjs
//  3. schreibt eine kurze Übersicht nach models/clip/build-info.json
// Aufruf: node tools/prepare-clip.mjs <Ordner mit node_modules/@huggingface/transformers>
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLIP_VOCAB, CLIP_TEMPLATES } from './clip-vocab.mjs';

const MODEL = 'Xenova/mobileclip_s0';
const OUT = 'models/clip';
const req = createRequire(join(process.argv[2], 'index.js'));
const mod = await import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
const T = mod.AutoTokenizer ? mod : mod.default;
const info = { builtAt: new Date().toISOString(), model: MODEL };

// 1. Bild-Modell für den Browser
const dir = join(OUT, MODEL);
mkdirSync(join(dir, 'onnx'), { recursive: true });
for (const f of ['config.json', 'preprocessor_config.json', 'onnx/vision_model_quantized.onnx']) {
  const res = await fetch(`https://huggingface.co/${MODEL}/resolve/main/${f}`);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  writeFileSync(join(dir, f), Buffer.from(await res.arrayBuffer()));
}

// 2. Text-Fingerabdrücke (Mittelwert über mehrere Satzvorlagen)
const tokenizer = await T.AutoTokenizer.from_pretrained(MODEL);
const textModel = await T.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' });
let dim = 0;
const embeds = [];
for (const [term] of CLIP_VOCAB) {
  const prompts = CLIP_TEMPLATES.map(t => t.replace('{}', term));
  const { text_embeds } = await textModel(tokenizer(prompts, { padding: 'max_length', truncation: true }));
  const rows = text_embeds.normalize().tolist();
  dim = rows[0].length;
  const mean = new Array(dim).fill(0);
  for (const r of rows) r.forEach((v, i) => { mean[i] += v / rows.length; });
  const n = Math.hypot(...mean);
  embeds.push(mean.map(v => v / n));
}
const flat = new Float32Array(embeds.length * dim);
embeds.forEach((e, i) => flat.set(e, i * dim));
writeFileSync(join(OUT, 'text-embeds.bin'), Buffer.from(flat.buffer));
writeFileSync(join(OUT, 'vocab.json'), JSON.stringify({ model: MODEL, dim, scale: 100, dtype: 'q8', items: CLIP_VOCAB.map(([term, name, cat]) => ({ term, name, cat })) }));

// 3. Varianten des Bild-Modells mit einem Testfoto vergleichen und die mit der klarsten Zuordnung nehmen.
//    Testfoto: zwei Katzen auf einer Decke mit zwei Fernbedienungen.
const FILES = { q8: 'vision_model_quantized.onnx', fp16: 'vision_model_fp16.onnx', fp32: 'vision_model.onnx' };
info.eval = {};
let best = { dtype: 'q8', score: -1 };
try {
  const processor = await T.AutoProcessor.from_pretrained(MODEL);
  const img = await T.RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg');
  const probe = async (texts) => (await textModel(tokenizer(texts, { padding: 'max_length', truncation: true }))).text_embeds.normalize().tolist();
  const [cats, dogs, car] = await probe(['a photo of cats', 'a photo of a dog', 'a photo of a car']);
  const remoteIdx = CLIP_VOCAB.findIndex(v => v[1] === 'Fernbedienung');
  for (const dtype of ['q8', 'fp16', 'fp32']) {
    try {
      if (dtype !== 'q8') {
        const res = await fetch(`https://huggingface.co/${MODEL}/resolve/main/onnx/${FILES[dtype]}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(join(dir, 'onnx', FILES[dtype]), Buffer.from(await res.arrayBuffer()));
      }
      const vision = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype });
      const v = (await vision(await processor(img))).image_embeds.normalize().tolist()[0];
      const dot = e => e.reduce((s, x, j) => s + x * v[j], 0);
      const ranked = embeds.map((e, i) => [i, dot(e)]).sort((a, b) => b[1] - a[1]);
      const margin = dot(cats) - Math.max(dot(dogs), dot(car));
      info.eval[dtype] = { cats: +dot(cats).toFixed(3), margin: +margin.toFixed(3), remoteRank: ranked.findIndex(([i]) => i === remoteIdx) + 1, top: ranked.slice(0, 4).map(([i, s]) => `${CLIP_VOCAB[i][1]} ${s.toFixed(3)}`) };
      if (margin > best.score + 0.005) best = { dtype, score: margin }; // kleinere Variante gewinnt bei Gleichstand
    } catch (e) { info.eval[dtype] = `Fehler: ${e?.message ?? e}`; }
  }
} catch (e) { info.evalError = String(e?.message ?? e); }
// nur die gewählte Variante behalten (spart Speicher im Repo)
for (const [d, f] of Object.entries(FILES)) if (d !== best.dtype) rmSync(join(dir, 'onnx', f), { force: true });
info.dtype = best.dtype;
writeFileSync(join(OUT, 'vocab.json'), JSON.stringify({ model: MODEL, dim, scale: 100, dtype: best.dtype, items: CLIP_VOCAB.map(([term, name, cat]) => ({ term, name, cat })) }));

Object.assign(info, { terms: CLIP_VOCAB.length, dim });
writeFileSync(join(OUT, 'build-info.json'), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));
