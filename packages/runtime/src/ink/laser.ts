// Laser pointer: a short fading trail on `#laser-canvas` that follows the pointer.
import { h } from '../dom';
import { CH, CW } from '../layout';
import { listen, pub } from '../state';

interface Pt {
  x: number;
  y: number;
  t: number;
}

const LIFE = 450;
let cv: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let on = false;
let pts: Pt[] = [];
let raf = 0;

export function initLaser(host: HTMLElement): void {
  cv = h('canvas', { id: 'laser-canvas', 'aria-hidden': 'true' });
  cv.width = CW;
  cv.height = CH;
  host.append(cv);
  ctx = cv.getContext('2d');
  listen<PointerEvent>(window, 'pointermove', (e) => {
    if (!on || !cv) return;
    const r = cv.getBoundingClientRect();
    const k = r.width ? CW / r.width : 1;
    pts.push({ x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, t: performance.now() });
    if (!raf) raf = requestAnimationFrame(frame);
  });
  listen(document, 'marco:slidechange', clear);
}

function clear(): void {
  pts = [];
  ctx?.clearRect(0, 0, CW, CH);
}

function frame(now: number): void {
  raf = 0;
  if (!ctx) return;
  pts = pts.filter((p) => now - p.t < LIFE);
  ctx.clearRect(0, 0, CW, CH);
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const age = (now - b.t) / LIFE;
    ctx.strokeStyle = `rgba(239,28,92,${(1 - age) * 0.85})`;
    ctx.lineWidth = 12 * (1 - age * 0.6);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const head = pts[pts.length - 1];
  if (head) {
    const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 18);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(239,28,92,.95)');
    g.addColorStop(1, 'rgba(239,28,92,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 18, 0, Math.PI * 2);
    ctx.fill();
    raf = requestAnimationFrame(frame);
  }
}

export const isLaserOn = (): boolean => on;

export function setLaser(v: boolean): void {
  if (v === on) return;
  on = v;
  document.body.classList.toggle('laser-on', on);
  if (on) pub('laser');
  else clear();
  pub('ui');
}

export const toggleLaser = (): void => setLaser(!on);

export function resetLaser(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  on = false;
  pts = [];
  cv = null;
  ctx = null;
}
