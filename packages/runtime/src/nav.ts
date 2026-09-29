// Slide navigation: exactly one `.active` slide, slide number and progress bar, events.
import { clamp, h, pad2 } from './dom';
import { S, listen } from './state';
import type { SlideChangeDetail } from './types';

function decorate(s: HTMLElement, i: number, n: number, progress: boolean): void {
  s.querySelectorAll(':scope > .slide-no, :scope > .slide-progress').forEach((e) => e.remove());
  s.append(h('div', { class: 'slide-no' }, `${pad2(i + 1)} / ${pad2(n)}`));
  if (progress) {
    const pr = h('div', { class: 'slide-progress' });
    pr.style.width = `${+(((i + 1) / n) * 100).toFixed(2)}%`;
    s.append(pr);
  }
}

/** Removes slide numbers from every slide and decorates the active one. */
export function decorateActive(): void {
  const n = S.slides.length;
  S.slides.forEach((s, k) => {
    if (k === S.cur) decorate(s, k, n, true);
    else
      s.querySelectorAll(':scope > .slide-no, :scope > .slide-progress').forEach((e) => e.remove());
  });
}

/** Print: every slide carries its number (lecture mode prints all slides). */
export function numberAllSlides(): void {
  const n = S.slides.length;
  S.slides.forEach((s, k) => decorate(s, k, n, k === S.cur));
}

export function go(i: number, force = false): void {
  const n = S.slides.length;
  if (!n) return;
  const idx = clamp(Math.round(Number.isFinite(i) ? i : 0), 0, n - 1);
  const target = S.slides[idx];
  if (!target) return;
  if (!force && idx === S.cur && target.classList.contains('active')) return;
  S.slides.forEach((s, k) => s.classList.toggle('active', k === idx));
  S.cur = idx;
  decorateActive();
  try {
    const hash = `#${target.id || idx + 1}`;
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
  } catch {
    /* history API unavailable (sandboxed frame) */
  }
  const detail: SlideChangeDetail = { index: idx, id: target.id };
  document.dispatchEvent(new CustomEvent<SlideChangeDetail>('marco:slidechange', { detail }));
}

export const next = (): void => go(S.cur + 1);
export const prev = (): void => go(S.cur - 1);

export function indexOfId(id: string): number {
  const key = id.replace(/^#/, '');
  return S.slides.findIndex((s) => s.id === key);
}

export function goId(id: string): void {
  const i = indexOfId(String(id));
  if (i >= 0) go(i);
}

/** Slide index from `#12` (1-based number) or `#s-12` (slide id); -1 when none. */
export function indexFromHash(hash: string): number {
  const v = decodeURIComponent(hash.replace(/^#/, ''));
  if (!v) return -1;
  if (/^\d+$/.test(v)) return clamp(Number(v) - 1, 0, S.slides.length - 1);
  return indexOfId(v);
}

export function initNav(): void {
  listen(window, 'hashchange', () => {
    const i = indexFromHash(location.hash);
    if (i >= 0) go(i);
  });
}

/** Subscribes to slide changes for the runtime's lifetime. */
export function onSlideChange(fn: (d: SlideChangeDetail) => void): void {
  listen<CustomEvent<SlideChangeDetail>>(document, 'marco:slidechange', (e) => fn(e.detail));
}
