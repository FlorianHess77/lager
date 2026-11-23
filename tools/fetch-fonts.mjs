// Holt die beiden Schriften (Fontsource, OFL-Lizenz) und legt sie unter fonts/ ab,
// damit die App ohne Google Fonts startet – auch ohne Internet.
// Läuft auf GitHub (.github/workflows/schriften.yml): node tools/fetch-fonts.mjs <Ordner mit node_modules>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const NM = join(process.argv[2], 'node_modules');
const SUBSETS = /-(latin|latin-ext)-/; // Deutsch braucht nur Latin (+ Ext für Sonderfälle)
const SRC = [
  { pkg: '@fontsource-variable/bricolage-grotesque', css: ['full.css', 'index.css'], family: 'Bricolage Grotesque' },
  { pkg: '@fontsource/atkinson-hyperlegible', css: ['400.css', '700.css', '400-italic.css'], family: 'Atkinson Hyperlegible' },
];
rmSync('fonts', { recursive: true, force: true });
mkdirSync('fonts', { recursive: true });
let out = '/* Selbst gehostete Schriften (SIL Open Font License) – erzeugt von tools/fetch-fonts.mjs */\n';
const files = new Set();
for (const s of SRC) {
  let used = null;
  for (const c of s.css) {
    let css; try { css = readFileSync(join(NM, s.pkg, c), 'utf8'); } catch { continue; }
    const blocks = css.match(/(\/\*[^*]*\*\/\s*)?@font-face\s*{[^}]*}/g) || [];
    const keep = blocks.filter(b => SUBSETS.test(b));
    if (!keep.length) continue;
    for (let b of keep) {
      b = b.replace(/font-family:\s*'[^']*'/, `font-family: '${s.family}'`);
      b = b.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, ''); // nur woff2
      b = b.replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => { files.add([s.pkg, f]); return `url(${f})`; });
      out += b.trim() + '\n';
    }
    used = c;
    if (c === 'full.css') break; // volle Achsen (Breite, optische Größe) reichen
  }
  if (!used) throw new Error(`Keine passenden Schriftschnitte in ${s.pkg}`);
  copyFileSync(join(NM, s.pkg, 'LICENSE'), join('fonts', `LICENSE-${s.family.replace(/\s+/g, '-')}.txt`));
}
for (const [pkg, f] of files) copyFileSync(join(NM, pkg, 'files', f), join('fonts', f));
writeFileSync('fonts/fonts.css', out);
console.log(out); console.log([...files].map(x => x[1]).join('\n'));
