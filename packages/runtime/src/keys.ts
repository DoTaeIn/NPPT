// Keyboard map (docs/spec/runtime.md §4) and touch swipe navigation.
import { isDialogOpen } from './chrome/dialog';
import { isHelpOpen, toggleHelp } from './chrome/help';
import { toggleNotes } from './chrome/notes';
import { openSearch } from './chrome/search';
import { toggleToc } from './chrome/toc';
import { isTyping } from './dom';
import { isLaserOn, setLaser, toggleLaser } from './ink/laser';
import { INK, clearInk, selectTool, setColor, setPen, togglePen, undo } from './ink/pen';
import { toggleFullscreen } from './layout';
import { go, next, prev } from './nav';
import { print } from './print';
import { S, listen } from './state';

/** Esc: close the topmost overlay, else exit pen / laser. Returns true when something closed. */
export function closeTop(): boolean {
  const top = S.overlays[S.overlays.length - 1];
  if (top) {
    top.close();
    return true;
  }
  if (INK.on) {
    setPen(false);
    return true;
  }
  if (isLaserOn()) {
    setLaser(false);
    return true;
  }
  return false;
}

/** Letter keys still work with a Korean IME active: map by physical key when `key` is not ASCII. */
function normKey(e: KeyboardEvent): string {
  const k = e.key;
  if ((k === 'Process' || (k.length === 1 && k.charCodeAt(0) > 127)) && /^Key[A-Z]$/.test(e.code)) {
    return e.code.slice(3).toLowerCase();
  }
  return k.length === 1 ? k.toLowerCase() : k;
}

export function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || isTyping(e.target)) return;
  const k = normKey(e);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && k === 'p') {
    e.preventDefault();
    print(e.shiftKey ? 'handout' : 'lecture');
    return;
  }
  if (mod && !e.shiftKey && k === 'z' && INK.on) {
    e.preventDefault();
    undo();
    return;
  }
  if (mod || e.altKey) return;
  if (k === 'Escape') {
    if (closeTop()) e.preventDefault();
    return;
  }
  // Let a focused button handle its own activation keys.
  const t = e.target as HTMLElement | null;
  if ((k === ' ' || k === 'Enter') && t?.closest?.('button,a,[role="button"],summary')) return;
  // Modal overlays swallow everything but their own toggle key.
  if (isDialogOpen()) return;
  if (isHelpOpen() && k !== '?' && k !== 'h') return;

  let handled = true;
  switch (k) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'PageDown':
      next();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      prev();
      break;
    case 'Home':
      go(0);
      break;
    case 'End':
      go(S.slides.length - 1);
      break;
    case 'f':
      toggleFullscreen();
      break;
    case 'n':
      toggleNotes();
      break;
    case 'm':
      toggleToc();
      break;
    case '/':
      openSearch();
      break;
    case '?':
    case 'h':
      toggleHelp();
      break;
    case 'p':
      togglePen();
      break;
    case 'l':
      toggleLaser();
      break;
    case 'e':
      selectTool('eraser');
      break;
    case 'c':
      clearInk();
      break;
    default:
      if (/^[1-8]$/.test(k)) setColor(Number(k) - 1);
      else handled = false;
  }
  if (handled) e.preventDefault();
}

export function initKeys(): void {
  listen<KeyboardEvent>(document, 'keydown', onKey);
  // Horizontal swipe on touch screens (not while drawing).
  let x0 = -1;
  let y0 = 0;
  const stage = S.stage || document.body;
  listen<PointerEvent>(stage, 'pointerdown', (e) => {
    x0 = e.pointerType === 'touch' && !INK.on ? e.clientX : -1;
    y0 = e.clientY;
  });
  listen<PointerEvent>(stage, 'pointerup', (e) => {
    if (x0 < 0) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = -1;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else prev();
    }
  });
}
