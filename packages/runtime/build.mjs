// Bundles the browser runtime. The compiler inlines one of:
//   dist/marco-runtime.js      core only (decks without widgets)
//   dist/marco-runtime.all.js  core + every bundled plugin (decks with any widget)
// and can instead append a single plugin bundle after the core:
//   dist/plugins/<name>.js     standalone IIFE that registers itself on window.MARCO
// dist/manifest.json lists them, with the widget names marco-runtime.all.js provides.
import { build } from 'esbuild';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const LIMIT = 120 * 1024; // hard limit for the core (docs/spec/runtime.md §9)
const TARGET = 70 * 1024;

const dist = join(root, 'dist');
rmSync(join(dist, 'plugins'), { recursive: true, force: true });
mkdirSync(join(dist, 'plugins'), { recursive: true });
const common = {
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

// Every src/plugins/<name>/entry.ts becomes dist/plugins/<name>.js.
const pluginDir = join(root, 'src/plugins');
const plugins = readdirSync(pluginDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(pluginDir, d.name, 'entry.ts')))
  .map((d) => d.name)
  .sort();

const outputs = [
  { entry: 'src/main.ts', out: 'marco-runtime.js', core: true },
  { entry: 'src/main-all.ts', out: 'marco-runtime.all.js' },
  ...plugins.map((n) => ({ entry: `src/plugins/${n}/entry.ts`, out: `plugins/${n}.js` })),
];

for (const o of outputs) {
  await build({
    ...common,
    entryPoints: [join(root, o.entry)],
    outfile: join(dist, o.out),
    minify: true,
  });
}
await build({
  ...common,
  entryPoints: [join(root, 'src/main.ts')],
  outfile: join(dist, 'marco-runtime.debug.js'),
  minify: false,
  sourcemap: 'inline',
});

// Bundles are inlined into <script> elements, so they must not contain sequences that end or
// confuse the script element.
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = false;
for (const o of outputs) {
  const file = join(dist, o.out);
  const code = readFileSync(file, 'utf8');
  for (const bad of ['</script', '<!--']) {
    if (code.toLowerCase().includes(bad)) {
      console.error(`${o.out} contains "${bad}", which breaks inline embedding`);
      failed = true;
    }
  }
  const size = statSync(file).size;
  const limits = o.core ? ` (limit ${kb(LIMIT)}, target ${kb(TARGET)})` : '';
  console.log(
    `${o.out} v${pkg.version}: ${kb(size)} minified, ${kb(gzipSync(code).length)} gzip${limits}`,
  );
  if (o.core && size > LIMIT) {
    console.error('Runtime core bundle exceeds the 120 KB limit');
    failed = true;
  } else if (o.core && size > TARGET) console.warn('Runtime core bundle is above the 70 KB target');
}
if (failed) process.exit(1);

writeFileSync(
  join(dist, 'manifest.json'),
  `${JSON.stringify(
    {
      version: pkg.version,
      core: 'marco-runtime.js',
      all: 'marco-runtime.all.js',
      plugins: Object.fromEntries(plugins.map((n) => [n, `plugins/${n}.js`])),
    },
    null,
    2,
  )}\n`,
);
