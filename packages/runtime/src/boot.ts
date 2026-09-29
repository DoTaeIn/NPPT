// Creates `window.MARCO` once, registers plugins (the bundled ones of marco-runtime.all.js and any
// queued in `window.MARCO_PLUGINS` by plugin bundles that ran before the core) and starts the
// runtime on DOMContentLoaded, or immediately when the document is already parsed.
import { createApi } from './api';
import { init } from './init';
import type { Plugin } from './types';

export function boot(plugins: readonly Plugin[] = []): void {
  const fresh = !window.MARCO;
  const marco = (window.MARCO ||= createApi());
  for (const p of [...(window.MARCO_PLUGINS?.splice(0) || []), ...plugins]) marco.registerPlugin(p);
  if (!fresh) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    init();
  }
}
