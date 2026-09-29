// Version and the mandatory MARCO Attribution (LICENSE, Additional Condition; PLAN.md §15).

declare const __MARCO_RUNTIME_VERSION__: string;

/** Runtime version, injected from package.json by build.mjs and vitest.config.ts. */
export const RUNTIME_VERSION: string =
  typeof __MARCO_RUNTIME_VERSION__ === 'string' ? __MARCO_RUNTIME_VERSION__ : '0.0.0-dev';

export const ATTRIBUTION_URL = 'https://github.com/DoTaeIn/Marco';
export const ATTRIBUTION_LEAD = 'Powered by MARCO — Created by DoTaeIn, Original project:';
/** The Attribution line, verbatim. The help overlay always shows it; there is no option to remove it. */
export const ATTRIBUTION = `${ATTRIBUTION_LEAD} ${ATTRIBUTION_URL}`;
