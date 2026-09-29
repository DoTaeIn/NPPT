/**
 * Import a legacy deck:  pnpm --filter @marco/importer exec tsx scripts/import.ts <in.html> <outDir> [--keep-source]
 *
 * Writes lecture.marco.md, assets/<id>.<ext>, assets.manifest.json and IMPORT-REPORT.md into outDir.
 * `--keep-source` refreshes everything except lecture.marco.md (for hand-polished examples).
 */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { runImport } from '../src/index.js';

// Piping into `head` closes stdout early; that is not an import failure.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [input, outDir] = args.filter((a) => !a.startsWith('--'));
if (!input || !outDir) {
  console.error('usage: tsx scripts/import.ts <deck.html> <outDir> [--keep-source]');
  process.exit(2);
}
// `pnpm --filter … exec` runs in the package directory, so relative paths that do not exist there
// are resolved from the workspace root (the directory holding pnpm-workspace.yaml).
function workspaceRoot(from: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}
const root = workspaceRoot(process.cwd());
const base = isAbsolute(input) || existsSync(resolve(input)) || !root ? process.cwd() : root;
const { result, files } = await runImport(resolve(base, input), resolve(base, outDir), {
  writeSource: !flags.has('--keep-source'),
});
const r = result.report;
console.log(
  `${r.family}: ${r.slideCount} slides, ${r.mappedBlocks + r.fallbackBlocks} blocks, ${r.mappedPercent}% mapped, ` +
    `${r.fallbackBlocks} html fallback, ${result.assets.length} assets, ${r.validation.length} validation error(s)`,
);
for (const f of files) console.log(`  wrote ${f}`);
