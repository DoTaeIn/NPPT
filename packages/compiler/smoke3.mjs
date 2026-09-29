import { compile } from './dist/index.js';
for (const edition of ['instructor', 'student']) {
  const r = await compile('test/fixtures/sample.marco.md', { fonts: 'none', edition });
  const m = r.html.match(/<script id="lecture-data" type="application\/json">(.*?)<\/script>/s);
  const data = JSON.parse(m[1]);
  console.log(edition, Object.keys(data), r.stats, r.warnings.map(w => w.code));
  if (edition === 'instructor') console.log(JSON.stringify({ ...data, meta: data.meta, notes: data.notes }, null, 1).slice(0, 3500));
}
