// `#pen-toolbar`: tools, 8 colours, size, undo, clear, laser and close.
import { $, $$, esc, h } from '../dom';
import { ICON, type IconName } from '../icons';
import { PEN_COLORS } from '../labels';
import { listen, sub } from '../state';
import { isLaserOn, toggleLaser } from './laser';
import { INK, clearInk, selectTool, setColor, setPen, setSize, undo, type Tool } from './pen';

const TOOL_UI: ReadonlyArray<[Tool, IconName, string]> = [
  ['pen', 'pen', '펜'],
  ['highlighter', 'highlighter', '형광펜'],
  ['eraser', 'eraser', '지우개 (E)'],
  ['text', 'text', '텍스트'],
  ['rect', 'rect', '사각형'],
  ['ellipse', 'ellipse', '원 · 타원'],
  ['line', 'line', '직선'],
  ['arrow', 'arrow', '화살표'],
];

let bar: HTMLElement | null = null;

const tb = (attr: string, icon: string, title: string, cls = 'tool-btn'): string =>
  `<button type="button" class="${cls}" ${attr} title="${esc(title)}" aria-label="${esc(title)}">${icon}</button>`;

export function buildToolbar(): void {
  const tools = TOOL_UI.map(([t, i, title]) => tb(`data-tool="${t}"`, ICON[i], title)).join('');
  const colors = PEN_COLORS.map(
    (c, i) =>
      `<button type="button" class="color-btn" data-color="${i}" style="background:${c.c}" title="${c.name} (${i + 1})" aria-label="${c.name} (${i + 1})"></button>`,
  ).join('');
  bar = h(
    'div',
    { id: 'pen-toolbar', role: 'toolbar', 'aria-label': '필기 도구', 'aria-hidden': 'true' },
    `<div class="pt-row">${tools}<span class="pt-sep"></span>${tb('data-act="laser"', ICON.laser, '레이저 포인터 (L)')}</div>` +
      `<div class="pt-row">${colors}<span class="pt-sep"></span>` +
      `<input id="pen-size" type="range" min="1" max="24" value="${INK.size}" aria-label="굵기"><output id="pen-size-v">${INK.size}</output>` +
      `<span class="pt-sep"></span>${tb('data-act="undo"', ICON.undo, '되돌리기 (Ctrl+Z)')}` +
      `${tb('data-act="clear"', ICON.trash, '모두 지우기 (C)', 'tool-btn danger')}` +
      `${tb('data-act="close"', ICON.close, '필기 끄기 (Esc)')}</div>`,
  );
  document.body.append(bar);
  listen(bar, 'click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.tool) selectTool(t.dataset.tool as Tool);
    else if (t.dataset.color) setColor(Number(t.dataset.color));
    else if (t.dataset.act === 'undo') undo();
    else if (t.dataset.act === 'clear') clearInk();
    else if (t.dataset.act === 'laser') toggleLaser();
    else if (t.dataset.act === 'close') {
      setPen(false);
      if (isLaserOn()) toggleLaser();
    }
  });
  const range = $<HTMLInputElement>('#pen-size', bar)!;
  listen(range, 'input', () => setSize(Number(range.value)));
  sub('ui', sync);
  sync();
}

function sync(): void {
  if (!bar) return;
  const open = INK.on || isLaserOn();
  bar.classList.toggle('open', open);
  bar.setAttribute('aria-hidden', String(!open));
  for (const b of $$('[data-tool]', bar)) b.classList.toggle('on', INK.on && b.dataset.tool === INK.tool);
  for (const b of $$('[data-color]', bar)) {
    b.classList.toggle('on', PEN_COLORS[Number(b.dataset.color)]?.c === INK.color);
  }
  $('[data-act="laser"]', bar)?.classList.toggle('on', isLaserOn());
  const range = $<HTMLInputElement>('#pen-size', bar);
  if (range && Number(range.value) !== INK.size) range.value = String(INK.size);
  const out = $('#pen-size-v', bar);
  if (out) out.textContent = String(INK.size);
}

export function resetToolbar(): void {
  bar = null;
}
