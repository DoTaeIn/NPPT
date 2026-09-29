// `#nav-dock`: navigation dock (bottom-left, clear of the right-aligned slide footer) that hides
// itself when the pointer is idle.
import { $, h, pad2 } from '../dom';
import { ICON } from '../icons';
import { S, listen, sub } from '../state';

export interface DockActions {
  prev(): void;
  next(): void;
  toc(): void;
  notes(): void;
  search(): void;
  pen(): void;
  print(): void;
  handout(): void;
  full(): void;
  help(): void;
  penOn(): boolean;
  searchOpen(): boolean;
}

const IDLE_MS = 2500;
let dock: HTMLElement | null = null;
let timer = 0;

const btn = (id: string, icon: string, title: string, hidden = false): string =>
  `<button type="button" id="${id}" class="dock-btn" title="${title}" aria-label="${title}"${hidden ? ' hidden' : ''}>${icon}</button>`;

export function buildDock(a: DockActions): void {
  const student = S.edition === 'student';
  dock = h(
    'nav',
    { id: 'nav-dock', 'aria-label': '발표 조작' },
    btn('nav-prev', ICON.prev, '이전 슬라이드 (←)') +
      '<span id="nav-count" aria-live="polite"></span>' +
      btn('nav-next', ICON.next, '다음 슬라이드 (→)') +
      '<span class="dock-sep"></span>' +
      btn('nav-toc', ICON.toc, '목차 (M)') +
      btn('nav-notes', ICON.notes, '발표 노트 (N)', student) +
      btn('nav-search', ICON.search, '검색 (/)') +
      btn('nav-pen', ICON.pen, '펜 (P)') +
      '<span class="dock-sep"></span>' +
      btn('nav-print', ICON.print, '강의용 인쇄 (Ctrl+P)') +
      btn('nav-handout', ICON.handout, '해설서 인쇄 (Ctrl+Shift+P)') +
      btn('nav-full', ICON.full, '전체화면 (F)') +
      btn('nav-help', ICON.help, '도움말 (?)'),
  );
  document.body.append(dock);
  const wire = (id: string, fn: () => void): void => {
    const b = $(`#${id}`, dock!);
    if (b) listen(b, 'click', fn);
  };
  wire('nav-prev', a.prev);
  wire('nav-next', a.next);
  wire('nav-toc', a.toc);
  wire('nav-notes', a.notes);
  wire('nav-search', a.search);
  wire('nav-pen', a.pen);
  wire('nav-print', a.print);
  wire('nav-handout', a.handout);
  wire('nav-full', a.full);
  wire('nav-help', a.help);

  const sync = (): void => {
    if (!dock) return;
    const n = S.slides.length;
    $('#nav-count', dock)!.textContent = n ? `${pad2(S.cur + 1)} / ${pad2(n)}` : '00 / 00';
    $<HTMLButtonElement>('#nav-prev', dock)!.disabled = S.cur <= 0;
    $<HTMLButtonElement>('#nav-next', dock)!.disabled = S.cur >= n - 1;
    const on = (id: string, v: boolean): void => {
      const b = $(`#${id}`, dock!);
      b?.classList.toggle('on', v);
      b?.setAttribute('aria-pressed', String(v));
    };
    on('nav-toc', S.tocOpen);
    on('nav-notes', S.notesOpen);
    on('nav-pen', a.penOn());
    on('nav-search', a.searchOpen());
  };
  sub('ui', sync);
  listen(document, 'marco:slidechange', sync);
  listen(document, 'fullscreenchange', sync);
  sync();

  // Auto-hide: visible while the pointer moves or rests on the dock, hidden after IDLE_MS.
  listen(document, 'pointermove', wake);
  listen(dock, 'focusin', wake);
  wake();
}

function wake(): void {
  if (!dock) return;
  dock.classList.remove('idle');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (!dock) return;
    if (isBusy(dock)) wake();
    else dock.classList.add('idle');
  }, IDLE_MS);
}

/** True while the pointer rests on the dock or a dock button has focus. */
function isBusy(el: HTMLElement): boolean {
  try {
    return el.matches(':hover') || el.matches(':focus-within');
  } catch {
    return false;
  }
}

export function resetDock(): void {
  window.clearTimeout(timer);
  dock = null;
}
