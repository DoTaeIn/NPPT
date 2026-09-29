// Short status message at the bottom of the screen.
import { h } from '../dom';

let el: HTMLElement | null = null;
let timer = 0;

export function buildToast(): void {
  el = h('div', { id: 'marco-toast', role: 'status', 'aria-live': 'polite' });
  document.body.append(el);
}

export function toast(msg: string): void {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove('on'), 1600);
}

export function resetToast(): void {
  window.clearTimeout(timer);
  el = null;
}
