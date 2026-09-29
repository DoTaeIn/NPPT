import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // test/setup.ts assembles dist/ once (strict) before any test file reads it.
    globalSetup: ['test/setup.ts'],
    // test/pack.test.ts installs the tarball from the registry and runs the CLI.
    testTimeout: 120_000,
    hookTimeout: 600_000,
  },
});
