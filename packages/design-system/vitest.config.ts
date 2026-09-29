import { defineConfig } from 'vitest/config';

// Unit tests only; test/*.spec.ts are Playwright tests (playwright.config.ts).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
