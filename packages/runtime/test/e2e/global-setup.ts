import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Build the bundle the fixtures load (`../../dist/marco-runtime.js`).
export default function globalSetup(): void {
  execFileSync(process.execPath, [join(import.meta.dirname, '..', '..', 'build.mjs')], {
    stdio: 'inherit',
  });
}
