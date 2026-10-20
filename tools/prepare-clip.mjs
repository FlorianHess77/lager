// Bereitet die Fotoerkennung (MobileCLIP) vor – läuft auf GitHub (.github/workflows/fotoerkennung.yml).
//  1. lädt das Bild-Modell (ca. 12 MB) nach models/clip/
//  2. berechnet die Text-Fingerabdrücke für alle Begriffe aus tools/clip-vocab.mjs
//  3. schreibt eine kurze Übersicht nach models/clip/build-info.json
// Aufruf: node tools/prepare-clip.mjs <Ordner mit node_modules/@huggingface/transformers>
import { mkdirSync, writeFileSync } from 'node:fs';
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

// 3. Probe: ein Testfoto (Katzen) gegen ein paar Begriffe – zeigt, dass Bild- und Textteil zusammenpassen
try {
  const processor = await T.AutoProcessor.from_pretrained(MODEL);
  const vision = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });
  const img = await T.RawImage.read('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg');
  const v = (await vision(await processor(img))).image_embeds.normalize().tolist()[0];
  const top = embeds.map((e, i) => [CLIP_VOCAB[i][1], e.reduce((s, x, j) => s + x * v[j], 0)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  info.probeCats = top.map(([n, s]) => `${n} ${s.toFixed(3)}`);
} catch (e) { info.probeError = String(e?.message ?? e); }

Object.assign(info, { terms: CLIP_VOCAB.length, dim });
writeFileSync(join(OUT, 'build-info.json'), JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));
