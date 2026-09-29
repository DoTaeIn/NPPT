// Registration used by a standalone plugin bundle (dist/plugins/<name>.js): register on
// `window.MARCO` when the core already ran, else queue in `window.MARCO_PLUGINS` for the core.
import type { Plugin } from '../types';

export function definePlugin(plugin: Plugin): void {
  if (window.MARCO) window.MARCO.registerPlugin(plugin);
  else (window.MARCO_PLUGINS ||= []).push(plugin);
}
