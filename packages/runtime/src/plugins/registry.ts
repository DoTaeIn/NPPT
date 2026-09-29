// Widget plugins: `registerPlugin(plugin)` (or `registerPlugin(name, plugin)`) mounts every
// `[data-widget=name]` element once, at init or immediately when registered later. Plugins are
// separate IIFEs (dist/plugins/<name>.js) or part of dist/marco-runtime.all.js.
import { closeDialog, openDialog } from '../chrome/dialog';
import { esc, h } from '../dom';
import { openRefs } from '../media';
import { go, goId } from '../nav';
import { S } from '../state';
import type { MarcoPlugin, Plugin, PluginCtx, WidgetParams } from '../types';
import { RUNTIME_VERSION } from '../version';

/** Plugins built into dist/marco-runtime.all.js (kept in sync with plugins/bundled.ts by a test). */
export const BUNDLED_PLUGINS: readonly string[] = ['quiz'];

const registry = new Map<string, MarcoPlugin>();
let mounted = new Map<HTMLElement, MarcoPlugin>();

export function registerPlugin(a: string | Plugin, b?: MarcoPlugin): void {
  const name = typeof a === 'string' ? a : a?.name;
  const plugin = typeof a === 'string' ? b : a;
  if (!name || typeof plugin?.mount !== 'function') {
    console.warn('[MARCO] registerPlugin({ name, mount }) needs a name and a mount function.');
    return;
  }
  registry.set(name, plugin);
  if (S.ready) mountWidgets(document, name);
}

export const hasPlugin = (name: string): boolean => registry.has(name);

/** `data-params` as a JSON object; anything else (absent, invalid, array, scalar) gives `{}`. */
export function parseParams(el: HTMLElement): WidgetParams {
  const raw = el.dataset.params;
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as WidgetParams;
  } catch {
    /* reported below */
  }
  console.warn(`[MARCO] data-params of widget "${el.dataset.widget}" is not a JSON object.`);
  return {};
}

function registerStyles(name: string, css: string): void {
  const id = `marco-plugin-${name}`;
  if (document.getElementById(id)) return;
  const s = h('style', { id, 'data-marco-plugin': name });
  s.textContent = css;
  document.head.append(s);
}

function makeCtx(el: HTMLElement, name: string): PluginCtx {
  const slide = el.closest<HTMLElement>('section.slide');
  const on = <T>(type: string, fn: (d: T) => void): (() => void) => {
    const t = `marco:${type}`;
    const handler = (e: Event): void => fn((e as CustomEvent<T>).detail);
    document.addEventListener(t, handler, { signal: S.ac.signal });
    return () => document.removeEventListener(t, handler);
  };
  return {
    name,
    data: S.data,
    edition: S.edition,
    runtimeVersion: RUNTIME_VERSION,
    slide,
    slideId: slide?.id || '',
    slideIndex: slide ? S.slides.indexOf(slide) : -1,
    go,
    goId,
    onSlideChange: (fn) => on('slidechange', fn),
    openDialog: (title, body, opts) =>
      openDialog(
        title,
        body,
        typeof opts === 'string' ? opts : { ...opts, kind: opts?.kind || 'widget' },
      ),
    closeDialog,
    openSources: (ids) => openRefs(ids.map(String)),
    registerStyles: (css) => registerStyles(name, css),
    events: {
      on,
      emit: (type, detail) =>
        el.dispatchEvent(new CustomEvent(`marco:${name}:${type}`, { detail, bubbles: true })),
    },
    signal: S.ac.signal,
  };
}

function placeholder(el: HTMLElement, name: string, failed: boolean): void {
  el.classList.add('widget-missing');
  el.querySelector(':scope > .widget-placeholder')?.remove();
  const why = failed
    ? '위젯을 표시하는 중 오류가 발생했습니다.'
    : !name
      ? 'data-widget에 플러그인 이름이 없습니다.'
      : BUNDLED_PLUGINS.includes(name)
        ? `이 덱에 '${name}' 플러그인이 포함되지 않았습니다. marco-runtime.all.js(또는 plugins/${name}.js)를 넣어 빌드하면 표시됩니다.`
        : `'${name}' 플러그인이 없습니다. marco-runtime.all.js에도 포함되지 않은 위젯입니다.`;
  el.append(
    h(
      'div',
      { class: 'widget-placeholder', role: 'note' },
      `<b>위젯 · ${esc(name || '이름 없음')}</b><span>${esc(why)}</span>`,
    ),
  );
}

/** Mounts `[data-widget]` elements (optionally only those named `only`); unknown names get a placeholder. */
export function mountWidgets(root: ParentNode = document, only?: string): void {
  root.querySelectorAll<HTMLElement>('[data-widget]').forEach((el) => {
    const name = el.dataset.widget || '';
    if ((only && name !== only) || mounted.has(el) || el.closest('#handout')) return;
    const plugin = registry.get(name);
    if (!plugin) {
      if (!el.querySelector(':scope > .widget-placeholder')) placeholder(el, name, false);
      return;
    }
    el.querySelector(':scope > .widget-placeholder')?.remove();
    el.classList.remove('widget-missing');
    mounted.set(el, plugin);
    try {
      plugin.mount(el, parseParams(el), makeCtx(el, name));
      el.dataset.mounted = name;
    } catch (err) {
      console.error(`[MARCO] plugin "${name}" failed to mount.`, err);
      mounted.delete(el);
      placeholder(el, name, true);
    }
  });
}

/** Calls `unmount(el)` for every mounted widget (runtime teardown). */
export function unmountWidgets(): void {
  mounted.forEach((plugin, el) => {
    try {
      plugin.unmount?.(el);
    } catch (err) {
      console.error('[MARCO] plugin unmount failed.', err);
    }
    delete el.dataset.mounted;
  });
  mounted = new Map();
}

export function resetPlugins(): void {
  unmountWidgets();
  registry.clear();
  document.querySelectorAll('style[data-marco-plugin]').forEach((s) => s.remove());
}
