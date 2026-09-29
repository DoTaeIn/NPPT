// Bundles the browser runtime to a single IIFE; the compiler inlines dist/marco-runtime.js into every deck.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const LIMIT = 120 * 1024; // hard limit (docs/spec/runtime.md §9)
const TARGET = 70 * 1024;

mkdirSync(join(root, 'dist'), { recursive: true });
const common = {
  entryPoints: [join(root, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  legalComments: 'none',
  // Keep Korean UI strings as UTF-8 instead of \uXXXX escapes (decks are always UTF-8).
  charset: 'utf8',
  define: { __MARCO_RUNTIME_VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
};
const min = join(root, 'dist/marco-runtime.js');
await build({ ...common, outfile: min, minify: true });
await build({
  ...common,
  outfile: join(root, 'dist/marco-runtime.debug.js'),
  minify: false,
  sourcemap: 'inline',
});

// The bundle is inlined into a <script> element, so it must not contain sequences that end or
// confuse the script element.
const code = readFileSync(min, 'utf8');
for (const bad of ['</script', '<!--']) {
  if (code.toLowerCase().includes(bad)) {
    console.error(`marco-runtime.js contains "${bad}", which breaks inline embedding`);
    process.exit(1);
  }
}
const size = statSync(min).size;
const gz = gzipSync(code).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `marco-runtime.js v${pkg.version}: ${kb(size)} minified, ${kb(gz)} gzip (limit ${kb(LIMIT)}, target ${kb(TARGET)})`,
);
if (size > LIMIT) {
  console.error('Runtime bundle exceeds the 120 KB limit');
  process.exit(1);
}
if (size > TARGET) console.warn('Runtime bundle is above the 70 KB target');
