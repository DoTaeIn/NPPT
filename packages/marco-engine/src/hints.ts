/**
 * npm-specific guidance the workspace CLI cannot give. `marco pdf` loads Playwright lazily and,
 * when it is missing, prints the monorepo hint (`pnpm exec playwright install chromium`). The npm
 * package declares Playwright as an optional peer, so add how to get it with npm / npx.
 */
import { createRequire } from 'node:module';

const PLAYWRIGHT_MODULES = ['@playwright/test', 'playwright', 'playwright-core'];

/** True when one of the modules `marco pdf` tries can be resolved from this package. */
export function playwrightAvailable(): boolean {
  const require = createRequire(import.meta.url);
  return PLAYWRIGHT_MODULES.some((spec) => {
    try {
      require.resolve(spec);
      return true;
    } catch {
      return false;
    }
  });
}

export const PLAYWRIGHT_HINT = [
  'Playwright 설치 (npm):',
  '  전역 설치: npm i -g marco-engine playwright && npx playwright install chromium',
  '  npx 사용:  npx playwright install chromium && npx -p marco-engine -p playwright marco pdf <파일>',
];

/** For `marco pdf`: when it fails and Playwright cannot be resolved, print the npm hint on exit. */
export function explainMissingPlaywright(argv: readonly string[]): void {
  if (argv[0] !== 'pdf') return;
  process.once('exit', (code) => {
    if (code === 0 || playwrightAvailable()) return;
    process.stderr.write(`${PLAYWRIGHT_HINT.join('\n')}\n`);
  });
}
