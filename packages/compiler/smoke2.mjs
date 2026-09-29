import { compile } from './dist/index.js';
const r = await compile('test/fixtures/sample.marco.md', { fonts: 'none' });
const i = r.html.indexOf('<section class="slide" id="s-08"');
const j = r.html.indexOf('<script id="lecture-data"');
console.log(r.html.slice(i, j).replace(/<svg.*?<\/svg>/g, '<svg…/>'));
const data = JSON.parse(r.html.slice(j).match(/<script id="lecture-data" type="application\/json">(.*?)<\/script>/s)[1]);
console.log(JSON.stringify(data, null, 1).slice(0, 4000));
console.log(r.html.slice(r.html.lastIndexOf('<script>')));
