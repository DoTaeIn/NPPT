// Placeholder build: bundles src/marco.css (and themes) into dist/. Replaced by the design-system package work.
import { build } from 'esbuild';
import { mkdirSync, existsSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
if (existsSync('src/marco.css')) {
  await build({ entryPoints: ['src/marco.css'], bundle: true, minify: true, outfile: 'dist/marco.css', loader: { '.woff2': 'dataurl' } });
}
