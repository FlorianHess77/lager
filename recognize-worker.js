// Hintergrund-Prozess für die Fotoerkennung: Laden und Rechnen blockieren so nicht die App.
import { createEngine, classify } from './recognize-engine.js';

let engine = null;
self.onmessage = async e => {
  const { id, type, crops } = e.data || {};
  const report = info => self.postMessage({ id, type: 'progress', info });
  try {
    engine ??= createEngine(report).catch(err => { engine = null; throw err; });
    const en = await engine;
    const meta = { dtype: en.dtype, loadMs: en.loadMs, errors: en.errors, terms: en.vocab.items.length };
    if (type === 'warm') { self.postMessage({ id, type: 'done', result: { meta } }); return; }
    report({ step: 'run', msg: 'Erkenne …' });
    const res = await classify(en, crops);
    self.postMessage({ id, type: 'done', result: { ...res, meta } });
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String(err?.message ?? err), code: err?.code || '' });
  }
};
