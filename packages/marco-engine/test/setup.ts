/** Vitest global setup: assemble dist/ once, strictly, so every test file sees the same package. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const pkg = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(process.execPath, ['build.mjs', '--strict'], { cwd: pkg, stdio: 'inherit' });
}
