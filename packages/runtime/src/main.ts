// MARCO runtime entry: bundled to one IIFE (dist/marco-runtime.js) and inlined into every deck.
// `window.MARCO` exists as soon as this script runs so plugin bundles concatenated after the core
// can register; the runtime itself starts on DOMContentLoaded (or immediately when already parsed).
import { createApi } from './api';
import { init } from './init';

if (!window.MARCO) {
  window.MARCO = createApi();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    init();
  }
}
