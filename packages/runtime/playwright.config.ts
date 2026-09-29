import { defineConfig, devices } from '@playwright/test';

// E2E tests open the fixture decks via file:// (no server), exactly like a professor opening a
// built deck. The global setup rebuilds dist/marco-runtime.js first.
export default defineConfig({
  testDir: 'test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : 'list',
  use: { viewport: { width: 1600, height: 900 } },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
  ],
});
