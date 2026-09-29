// MARCO runtime entry (dist/marco-runtime.js): bundled to one IIFE and inlined into every deck.
// `window.MARCO` exists as soon as this script runs so plugin bundles concatenated after the core
// can register; the runtime itself starts on DOMContentLoaded (or immediately when already parsed).
import { boot } from './boot';

boot();
