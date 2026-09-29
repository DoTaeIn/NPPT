/**
 * Import a legacy deck:
 *   pnpm --filter @marco/importer exec tsx scripts/import.ts <in.html> <outDir> [--config <file>] [--no-config] [--keep-source]
 *
 * Writes lecture.marco.md, assets/<id>.<ext>, assets.manifest.json, IMPORT-REPORT.md (and data
 * sidecars such as sims.json) into outDir. `outDir/import.config.json` is applied when present
 * (stable slide ids, overrides, notes mode, load-time corrections); `--config` names another
 * file, `--no-config` ignores it. `--keep-source` refreshes everything except lecture.marco.md.
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
const configAt = args.indexOf('--config');
const configArg = configAt >= 0 ? args[configAt + 1] : undefined;
const rest = configAt >= 0 ? args.filter((_a, i) => i !== configAt && i !== configAt + 1) : args;
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const [input, outDir] = rest.filter((a) => !a.startsWith('--'));
if (!input || !outDir || (configAt >= 0 && !configArg)) {
  console.error(
    'usage: tsx scripts/import.ts <deck.html> <outDir> [--config <file>] [--no-config] [--keep-source]',
  );
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
  ...(flags.has('--no-config')
    ? { config: false as const }
    : configArg
      ? { config: resolve(base, configArg) }
      : {}),
});
const r = result.report;
console.log(
  `${r.family}: ${r.slideCount} slides, ${r.mappedBlocks + r.fallbackBlocks} blocks, ${r.mappedPercent}% mapped, ` +
    `${r.fallbackBlocks} html fallback, ${result.assets.length} assets, ${r.validation.length} validation error(s)`,
);
if (r.config)
  console.log(`  config ${r.config.source}: ${r.config.applied.length} rule(s) applied`);
if (r.corrections)
  console.log(
    `  corrections ran: ${r.corrections.ran.join(', ') || 'none'}${r.corrections.errors.length ? ` (${r.corrections.errors.length} error(s))` : ''}`,
  );
for (const f of files) console.log(`  wrote ${f}`);
