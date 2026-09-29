// Widget plugins (Phase 3): `registerPlugin(name, {mount})` mounts every `[data-widget=name]`.
import { closeDialog, openDialog } from './chrome/dialog';
import { esc, h } from './dom';
import { go, goId } from './nav';
import { S } from './state';
import type { MarcoPlugin, PluginCtx, SlideChangeDetail } from './types';
import { RUNTIME_VERSION } from './version';

const registry = new Map<string, MarcoPlugin>();
let mounted = new WeakSet<HTMLElement>();

export function registerPlugin(name: string, plugin: MarcoPlugin): void {
  if (!name || typeof plugin?.mount !== 'function') {
    console.warn('[MARCO] registerPlugin(name, { mount }) needs a name and a mount function.');
    return;
  }
  registry.set(name, plugin);
  if (S.ready) mountWidgets(document, name);
}

export const hasPlugin = (name: string): boolean => registry.has(name);

function parseParams(el: HTMLElement): unknown {
  const raw = el.dataset.params;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    console.warn(`[MARCO] data-params of widget "${el.dataset.widget}" is not valid JSON.`);
    return {};
  }
}

function makeCtx(el: HTMLElement): PluginCtx {
  const slide = el.closest<HTMLElement>('section.slide');
  return {
    data: S.data,
    edition: S.edition,
    runtimeVersion: RUNTIME_VERSION,
    slide,
    slideIndex: slide ? S.slides.indexOf(slide) : -1,
    go,
    goId,
    onSlideChange(fn: (d: SlideChangeDetail) => void) {
      const handler = (e: Event): void => fn((e as CustomEvent<SlideChangeDetail>).detail);
      document.addEventListener('marco:slidechange', handler, { signal: S.ac.signal });
      return () => document.removeEventListener('marco:slidechange', handler);
    },
    openDialog: (title: string, body: string | Node) => openDialog(title, body, 'widget'),
    closeDialog,
  };
}

function placeholder(el: HTMLElement, name: string, failed: boolean): void {
  el.classList.add('widget-missing');
  el.querySelector(':scope > .widget-placeholder')?.remove();
  el.append(
    h(
      'div',
      { class: 'widget-placeholder', role: 'note' },
      `<b>위젯 · ${esc(name || '이름 없음')}</b><span>${failed ? '위젯을 표시하는 중 오류가 발생했습니다.' : '이 덱에 포함되지 않은 위젯입니다.'}</span>`,
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
    mounted.add(el);
    try {
      plugin.mount(el, parseParams(el), makeCtx(el));
      el.dataset.mounted = name;
    } catch (err) {
      console.error(`[MARCO] plugin "${name}" failed to mount.`, err);
      placeholder(el, name, true);
    }
  });
}

export function resetPlugins(): void {
  registry.clear();
  mounted = new WeakSet();
}
