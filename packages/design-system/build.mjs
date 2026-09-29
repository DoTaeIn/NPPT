// Builds the design system CSS.
//   dist/marco.css          all CSS, fonts inlined as data URLs, minified
//   dist/marco.nofonts.css  the same without src/fonts.css (the compiler subsets fonts itself)
//   dist/fonts/*.woff2      the font files, plus fonts.json describing each @font-face
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');
const entry = join(src, 'marco.css');
const NOFONTS_BUDGET = 80 * 1024;

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'fonts'), { recursive: true });

const common = {
  entryPoints: [entry],
  bundle: true,
  minify: true,
  logLevel: 'warning',
  loader: { '.woff2': 'dataurl' },
};

// 1. Full bundle with embedded fonts.
await build({ ...common, outfile: join(dist, 'marco.css') });

// 2. Bundle without fonts: resolve the fonts.css import to an empty module.
const withoutFonts = {
  name: 'without-fonts',
  setup(b) {
    b.onResolve({ filter: /(^|\/)fonts\.css$/ }, (args) => ({ path: args.path, namespace: 'no-fonts' }));
    b.onLoad({ filter: /.*/, namespace: 'no-fonts' }, () => ({ contents: '', loader: 'css' }));
  },
};
await build({ ...common, outfile: join(dist, 'marco.nofonts.css'), plugins: [withoutFonts] });

// 3. Font files and a manifest the compiler can subset from.
const fontsCss = readFileSync(join(src, 'fonts.css'), 'utf8');
const faces = [...fontsCss.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => {
  const get = (prop) => body.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1].trim();
  return {
    family: get('font-family')?.replace(/['"]/g, ''),
    weight: get('font-weight'),
    style: get('font-style'),
    file: `fonts/${get('src')?.match(/fonts\/([^'")]+)/)?.[1]}`,
  };
});
for (const file of readdirSync(join(src, 'fonts'))) {
  if (file.endsWith('.woff2') || file === 'OFL.txt') {
    copyFileSync(join(src, 'fonts', file), join(dist, 'fonts', file));
  }
}
writeFileSync(join(dist, 'fonts', 'fonts.json'), `${JSON.stringify(faces, null, 2)}\n`);

// 4. Sanity checks and sizes.
const nofonts = readFileSync(join(dist, 'marco.nofonts.css'), 'utf8');
if (nofonts.includes('@font-face')) throw new Error('marco.nofonts.css still contains @font-face');
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
for (const file of ['marco.css', 'marco.nofonts.css']) {
  console.log(`dist/${file.padEnd(18)} ${kb(statSync(join(dist, file)).size).padStart(10)}`);
}
const fontBytes = faces.reduce((sum, f) => sum + statSync(join(dist, f.file)).size, 0);
console.log(`dist/fonts/ (${faces.length} faces) ${kb(fontBytes).padStart(10)}`);
if (Buffer.byteLength(nofonts) > NOFONTS_BUDGET) {
  throw new Error(`marco.nofonts.css is ${kb(Buffer.byteLength(nofonts))}, over the ${kb(NOFONTS_BUDGET)} budget`);
}
