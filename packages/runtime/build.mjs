// Bundles the browser runtime to a single IIFE; the compiler inlines dist/marco-runtime.js into every deck.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
const common = { entryPoints: ['src/main.ts'], bundle: true, format: 'iife', target: ['es2020'], platform: 'browser', legalComments: 'none' };
await build({ ...common, outfile: 'dist/marco-runtime.js', minify: true });
await build({ ...common, outfile: 'dist/marco-runtime.debug.js', minify: false, sourcemap: 'inline' });
