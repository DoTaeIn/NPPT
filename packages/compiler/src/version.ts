import { readFileSync } from 'node:fs';

/**
 * Engine identity embedded in every deck (NOTICE comment and `#lecture-data.engine`).
 * The version is read from packages/compiler/package.json; this module sits one level below
 * the package root both as `src/version.ts` and as `dist/version.js`.
 */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const ENGINE_NAME = 'MARCO Engine';
export const ENGINE_VERSION: string = readVersion();
export const ENGINE_REPO = 'https://github.com/DoTaeIn/NPPT';
/** Required verbatim by the MARCO Engine License (PLAN.md §15, runtime.md §3). */
export const ATTRIBUTION =
  'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco';
