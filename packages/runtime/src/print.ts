// Two print modes (docs/spec/runtime.md §5): lecture (1920×1080 per page) and handout (A4).
import { h } from './dom';
import { buildHandout, removeHandout } from './handout';
import { decorateActive, numberAllSlides } from './nav';
import { listen, pub } from './state';
import type { PrintMode } from './types';

const PAGE: Record<PrintMode, string> = {
  lecture: '@media print{@page{size:1920px 1080px;margin:0}}',
  handout: '@media print{@page{size:A4 portrait;margin:0}}',
};
let mode: PrintMode | null = null;

export function setPageSize(m: PrintMode): void {
  let st = document.getElementById('page-size');
  if (!st) {
    st = h('style', { id: 'page-size' });
    document.head.append(st);
  }
  st.textContent = PAGE[m];
}

export const printMode = (): PrintMode | null => mode;

/** Applies body class, @page size and (handout) builds `#handout`. */
export function preparePrint(m: PrintMode): void {
  mode = m;
  pub('print');
  const b = document.body.classList;
  b.toggle('print-lecture', m === 'lecture');
  b.toggle('handout-mode', m === 'handout');
  setPageSize(m);
  if (m === 'handout') buildHandout();
  else {
    removeHandout();
    numberAllSlides();
  }
  void document.documentElement.getBoundingClientRect();
}

/** Undoes preparePrint(); runs on `afterprint`. */
export function finishPrint(): void {
  mode = null;
  document.body.classList.remove('print-lecture', 'handout-mode');
  removeHandout();
  setPageSize('lecture');
  decorateActive();
}

function imagesReady(root: HTMLElement, maxMs: number): Promise<void> {
  const waits = Array.from(root.querySelectorAll('img')).map((img) =>
    typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve(),
  );
  return Promise.race([
    Promise.all(waits).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, maxMs)),
  ]);
}

export function print(m: PrintMode): void {
  const target: PrintMode = m === 'handout' ? 'handout' : 'lecture';
  preparePrint(target);
  const run = (): void => {
    try {
      window.print();
    } catch {
      /* printing unavailable */
    }
  };
  const host = document.getElementById('handout');
  if (target === 'handout' && host) void imagesReady(host, 1500).then(run);
  else run();
}

export function initPrint(): void {
  setPageSize('lecture');
  // Browser-menu printing (no runtime shortcut) prints in lecture mode.
  listen(window, 'beforeprint', () => {
    if (!mode) preparePrint('lecture');
  });
  listen(window, 'afterprint', finishPrint);
}
