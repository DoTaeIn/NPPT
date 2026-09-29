// Loads a fixture deck into the jsdom document (without running its <script src>).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, vi } from 'vitest';
import { dispose, init } from '../../src/init';
import type { MarcoApi } from '../../src/types';

export function fixtureHtml(name = 'minimal-deck.html'): string {
  return readFileSync(join(import.meta.dirname, '..', 'fixtures', name), 'utf8');
}

export function loadFixture(name = 'minimal-deck.html', mutate?: (html: string) => string): void {
  let html = fixtureHtml(name);
  if (mutate) html = mutate(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script[src]').forEach((s) => s.remove());
  const root = document.documentElement;
  for (const a of Array.from(root.attributes)) root.removeAttribute(a.name);
  for (const a of Array.from(doc.documentElement.attributes)) root.setAttribute(a.name, a.value);
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  document.body.className = '';
  document.title = doc.title;
}

/** Loads a fixture and initialises the runtime. */
export function boot(name?: string, mutate?: (html: string) => string): MarcoApi {
  history.replaceState(null, '', '/');
  loadFixture(name, mutate);
  return init();
}

export function press(
  key: string,
  opts: KeyboardEventInit = {},
  target: EventTarget = document.body,
): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(e);
  return e;
}

export const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

/** Registers dispose() after every test in the calling file. */
export function autoDispose(): void {
  afterEach(() => {
    dispose();
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });
}
