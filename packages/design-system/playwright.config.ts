import { defineConfig } from '@playwright/test';

// Renders gallery/index.html (file://) against dist/marco.css; run `pnpm build` first.
// Screenshots and PDFs land in test-results/ (gitignored).
export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results/playwright',
  reporter: [['list']],
  timeout: 180_000,
  use: {
    browserName: 'chromium',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  },
});
