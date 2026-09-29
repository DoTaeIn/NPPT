import { compile, formatDiagnostic, schemaShims } from './dist/index.js';
const r = await compile('test/fixtures/sample.marco.md', { fonts: 'subset' });
console.log('ok', r.ok, r.stats, schemaShims);
for (const d of [...r.diagnostics, ...r.warnings]) console.log(formatDiagnostic(d), d.slide ?? '');
for (const l of r.lint) console.log('lint', l.level, l.code, l.slide, l.message);
const i = r.html.indexOf('<div id="canvas">');
console.log(r.html.slice(0, 1200));
console.log(r.html.slice(i, i + 9000));
