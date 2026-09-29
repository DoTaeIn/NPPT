// Ink on `#pen-canvas`: pen, highlighter, eraser, text and shapes, stored as vectors per slide so
// that returning to a slide restores its ink and a resize redraws it sharply.
import { h } from '../dom';
import { PEN_COLORS } from '../labels';
import { CH, CW } from '../layout';
import { S, listen, pub, sub } from '../state';
import { setLaser } from './laser';

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'rect' | 'ellipse' | 'line' | 'arrow';
export const TOOLS: ReadonlyArray<Tool> = ['pen', 'highlighter', 'eraser', 'text', 'rect', 'ellipse', 'line', 'arrow'];
const SHAPES = new Set<Tool>(['rect', 'ellipse', 'line', 'arrow']);

export interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  /** Flat x,y pairs in canvas (1920×1080) coordinates; shapes use [x0, y0, x1, y1]. */
  pts: number[];
  text?: string;
}

export const INK = { on: false, tool: 'pen' as Tool, color: PEN_COLORS[0]!.c, size: 4 };
const FONT = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const store = new Map<number, Stroke[]>();
let cv: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let snap: HTMLCanvasElement | null = null;
let ratio = 1;
let active: Stroke | null = null;
let textBox: HTMLInputElement | null = null;

export const textSize = (size: number): number => 18 + size * 4;
export const strokesOf = (i: number = S.cur): Stroke[] => store.get(i) || [];

export function initPen(host: HTMLElement): void {
  cv = h('canvas', { id: 'pen-canvas', 'aria-hidden': 'true' });
  host.append(cv);
  ctx = cv.getContext('2d');
  sizeBacking(true);
  listen<PointerEvent>(cv, 'pointerdown', down);
  listen<PointerEvent>(cv, 'pointermove', move);
  listen<PointerEvent>(cv, 'pointerup', up);
  listen<PointerEvent>(cv, 'pointercancel', up);
  listen<PointerEvent>(cv, 'lostpointercapture', up);
  listen(document, 'marco:slidechange', () => {
    commitText();
    active = null;
    redraw();
  });
  sub('fit', () => sizeBacking(false));
  sub('modal', () => setPen(false));
  sub('print', () => setPen(false));
  sub('laser', () => setPen(false));
}

/** Backing-store resolution follows the on-screen scale (capped at 2×) to keep memory modest. */
function sizeBacking(force: boolean): void {
  if (!cv) return;
  const want = Math.min(2, Math.max(1, Math.ceil((window.devicePixelRatio || 1) * S.scale * 4) / 4));
  if (!force && want === ratio) return;
  ratio = want;
  cv.width = Math.round(CW * ratio);
  cv.height = Math.round(CH * ratio);
  redraw();
}

function pt(e: { clientX: number; clientY: number }): [number, number] {
  const r = cv!.getBoundingClientRect();
  const k = r.width ? CW / r.width : 1;
  return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
}

function down(e: PointerEvent): void {
  if (!INK.on || e.button > 0) return;
  e.preventDefault();
  const [x, y] = pt(e);
  if (INK.tool === 'text') {
    startText(x, y);
    return;
  }
  commitText();
  active = { tool: INK.tool, color: INK.color, size: INK.size, pts: [x, y] };
  if (ctx && cv) {
    snap = snap || document.createElement('canvas');
    snap.width = cv.width;
    snap.height = cv.height;
    snap.getContext('2d')?.drawImage(cv, 0, 0);
  }
  try {
    cv?.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic events have no capturable pointer */
  }
  paintActive();
}

function move(e: PointerEvent): void {
  if (!active) return;
  e.preventDefault();
  const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  for (const p of list.length ? list : [e]) {
    const [x, y] = pt(p);
    if (SHAPES.has(active.tool)) active.pts = [active.pts[0]!, active.pts[1]!, x, y];
    else active.pts.push(x, y);
  }
  paintActive();
}

function up(): void {
  if (!active) return;
  const s = active;
  active = null;
  snap = null;
  const p = s.pts;
  const tiny = SHAPES.has(s.tool) && (p.length < 4 || Math.hypot(p[2]! - p[0]!, p[3]! - p[1]!) < 3);
  if (!tiny) push(s);
  redraw();
}

function push(s: Stroke): void {
  const list = store.get(S.cur) || [];
  list.push(s);
  store.set(S.cur, list);
  pub('ink');
}

function paintActive(): void {
  if (!ctx || !cv || !active) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (snap) ctx.drawImage(snap, 0, 0);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawStroke(ctx, active);
}

export function redraw(): void {
  if (!ctx || !cv) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  for (const s of strokesOf()) drawStroke(ctx, s);
}

export function drawStroke(c: CanvasRenderingContext2D, s: Stroke): void {
  const p = (i: number): number => s.pts[i] ?? 0;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  c.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1;
  c.strokeStyle = c.fillStyle = s.tool === 'eraser' ? '#000' : s.color;
  c.lineWidth = s.tool === 'highlighter' ? s.size * 4 : s.tool === 'eraser' ? s.size * 6 : s.size;
  c.beginPath();
  if (s.tool === 'text') {
    c.font = `600 ${textSize(s.size)}px ${FONT}`;
    c.textBaseline = 'top';
    c.fillText(s.text || '', p(0), p(1));
  } else if (s.tool === 'rect') {
    c.strokeRect(p(0), p(1), p(2) - p(0), p(3) - p(1));
  } else if (s.tool === 'ellipse') {
    c.ellipse((p(0) + p(2)) / 2, (p(1) + p(3)) / 2, Math.abs(p(2) - p(0)) / 2, Math.abs(p(3) - p(1)) / 2, 0, 0, Math.PI * 2);
    c.stroke();
  } else if (s.tool === 'line' || s.tool === 'arrow') {
    c.moveTo(p(0), p(1));
    c.lineTo(p(2), p(3));
    if (s.tool === 'arrow') {
      const a = Math.atan2(p(3) - p(1), p(2) - p(0));
      const head = Math.max(14, s.size * 3.5);
      for (const d of [-Math.PI / 6, Math.PI / 6]) {
        c.moveTo(p(2), p(3));
        c.lineTo(p(2) - head * Math.cos(a + d), p(3) - head * Math.sin(a + d));
      }
    }
    c.stroke();
  } else {
    // Freehand: quadratic curves through midpoints for a smooth line; a single point is a dot.
    const n = s.pts.length / 2;
    c.moveTo(p(0), p(1));
    if (n === 1) c.lineTo(p(0) + 0.01, p(1));
    for (let i = 1; i < n - 1; i++) {
      c.quadraticCurveTo(p(2 * i), p(2 * i + 1), (p(2 * i) + p(2 * i + 2)) / 2, (p(2 * i + 1) + p(2 * i + 3)) / 2);
    }
    if (n > 1) c.lineTo(p(2 * n - 2), p(2 * n - 1));
    c.stroke();
  }
  c.restore();
}

function startText(x: number, y: number): void {
  commitText();
  const host = S.canvas;
  if (!host) return;
  const box = h('input', { type: 'text', class: 'ink-text', 'aria-label': '필기 텍스트' });
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.color = INK.color;
  box.style.fontSize = `${textSize(INK.size)}px`;
  box.dataset.x = String(x);
  box.dataset.y = String(y);
  host.append(box);
  textBox = box;
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Enter') commitText();
    else if (e.key === 'Escape') cancelText();
  });
  box.addEventListener('blur', () => commitText());
  setTimeout(() => box.focus(), 0);
}

function commitText(): void {
  const box = textBox;
  if (!box) return;
  textBox = null;
  const text = box.value.trim();
  if (text) {
    push({ tool: 'text', color: box.style.color || INK.color, size: INK.size, pts: [Number(box.dataset.x), Number(box.dataset.y)], text });
  }
  box.remove();
  redraw();
}

function cancelText(): void {
  const box = textBox;
  textBox = null;
  box?.remove();
}

export function setPen(on: boolean): void {
  if (on === INK.on) return;
  INK.on = on;
  if (on) setLaser(false);
  else {
    commitText();
    active = null;
  }
  document.body.classList.toggle('pen-on', on);
  pub('ui');
}

export const togglePen = (): void => setPen(!INK.on);

export function selectTool(t: Tool): void {
  INK.tool = t;
  setPen(true);
  pub('ui');
}

/** Selects pen colour `i` (0–7); leaves the eraser for the pen. */
export function setColor(i: number): void {
  const c = PEN_COLORS[i];
  if (!c) return;
  INK.color = c.c;
  if (INK.tool === 'eraser') INK.tool = 'pen';
  pub('ui');
}

export function setSize(n: number): void {
  INK.size = Math.max(1, Math.min(24, Math.round(n) || 1));
  pub('ui');
}

export function undo(): void {
  const list = store.get(S.cur);
  if (!list?.length) return;
  list.pop();
  redraw();
  pub('ink');
}

export function clearInk(): void {
  cancelText();
  store.delete(S.cur);
  redraw();
  pub('ink');
}

export function resetPen(): void {
  store.clear();
  Object.assign(INK, { on: false, tool: 'pen', color: PEN_COLORS[0]!.c, size: 4 });
  cv = ctx = null;
  snap = null;
  active = null;
  textBox = null;
  ratio = 1;
}
