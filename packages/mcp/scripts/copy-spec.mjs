/**
 * Run by `build` after tsc: copies docs/spec/*.md into dist/spec/ so the built package carries the
 * specification files that marco_spec and marco://spec/{name} serve (src/resources.ts looks there
 * first, then in the monorepo's docs/spec/).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const from = fileURLToPath(new URL('../../../docs/spec/', import.meta.url));
const to = fileURLToPath(new URL('../dist/spec/', import.meta.url));
if (!existsSync(from)) {
  console.warn(`copy-spec: ${from} not found; dist/spec not refreshed`);
} else {
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from).filter((f) => f.endsWith('.md'));
  for (const f of files) copyFileSync(join(from, f), join(to, f));
  console.log(`copy-spec: ${files.length} spec files → dist/spec/`);
}
