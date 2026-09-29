import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: { __MARCO_RUNTIME_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['test/unit/setup.ts'],
  },
});
