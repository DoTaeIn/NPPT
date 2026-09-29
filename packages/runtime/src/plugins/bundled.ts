// The plugins compiled into dist/marco-runtime.all.js. Keep `BUNDLED_PLUGINS` in registry.ts (the
// names the core's placeholder mentions) in sync; a unit test checks it.
import type { Plugin } from '../types';
import { quizPlugin } from './quiz';

export const BUNDLED: readonly Plugin[] = [quizPlugin];
