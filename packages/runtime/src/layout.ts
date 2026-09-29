// Fixed 1920×1080 canvas scaled into the free viewport area (docs/spec/runtime.md §2).
import { h } from './dom';
import { S, listen, pub } from './state';

export const CW = 1920;
export const CH = 1080;
export const NOTES_W = 420;
export const TOC_W = 280;

export interface Fit {
  scale: number;
  left: number;
  top: number;
}

/** Pure layout math: open panels shrink the free width (notes on the right, TOC on the left). */
export function computeFit(vw: number, vh: number, notesOpen: boolean, tocOpen: boolean): Fit {
  const right = notesOpen ? NOTES_W : 0;
  const left = tocOpen ? TOC_W : 0;
  const w = Math.max(320, vw - right - left);
  const hgt = Math.max(240, vh);
  const scale = Math.min(w / CW, hgt / CH);
  return {
    scale,
    left: Math.round(left + (w - CW * scale) / 2),
    top: Math.round((hgt - CH * scale) / 2),
  };
}

export function fitCanvas(): void {
  const c = S.canvas;
  if (!c) return;
  const f = computeFit(window.innerWidth, window.innerHeight, S.notesOpen, S.tocOpen);
  S.scale = f.scale;
  c.style.left = `${f.left}px`;
  c.style.top = `${f.top}px`;
  c.style.transform = `scale(${+f.scale.toFixed(5)})`;
  document.documentElement.style.setProperty('--marco-scale', String(+f.scale.toFixed(5)));
  pub('fit');
}

/**
 * Finds `#stage > #canvas` and the slides. When a legacy or hand-written page lacks them, wraps
 * the slides in a new stage so the runtime can still scale them.
 */
export function ensureStage(): void {
  let canvas = document.getElementById('canvas');
  let slides = canvas ? Array.from(canvas.querySelectorAll<HTMLElement>(':scope > section.slide')) : [];
  if (!slides.length) slides = Array.from(document.querySelectorAll<HTMLElement>('section.slide'));
  if (!canvas) {
    const stage = h('div', { id: 'stage' });
    canvas = h('div', { id: 'canvas' });
    stage.append(canvas);
    (slides[0]?.parentElement || document.body).prepend(stage);
    canvas.append(...slides);
  }
  let stage = document.getElementById('stage');
  if (!stage) {
    stage = h('div', { id: 'stage' });
    canvas.before(stage);
    stage.append(canvas);
  }
  S.stage = stage;
  S.canvas = canvas;
  S.slides = slides;
}

export function initLayout(): void {
  listen(window, 'resize', fitCanvas);
  listen(document, 'fullscreenchange', () => {
    document.body.classList.toggle('fs-active', !!document.fullscreenElement);
    fitCanvas();
  });
  fitCanvas();
}

export function toggleFullscreen(): void {
  const d = document as Document & { webkitExitFullscreen?: () => void };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
      else el.webkitRequestFullscreen?.();
    } else if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
    else d.webkitExitFullscreen?.();
  } catch {
    /* fullscreen not allowed here */
  }
}
