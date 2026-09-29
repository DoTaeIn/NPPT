// Runtime bootstrap: parse data, inject chrome and CSS, wire events, show the first slide.
import { createApi } from './api';
import { CHROME_CSS } from './chrome.css';
import { buildDialog, closeDialog, resetDialog } from './chrome/dialog';
import { buildDock, resetDock } from './chrome/dock';
import { buildHelp, resetHelp, toggleHelp } from './chrome/help';
import { buildNotes, resetNotes, toggleNotes } from './chrome/notes';
import { buildSearch, isSearchOpen, resetSearch, toggleSearch } from './chrome/search';
import { buildToast, resetToast } from './chrome/toast';
import { buildToc, resetToc, toggleToc } from './chrome/toc';
import { detectEdition, normalizeData, readLectureJson } from './data';
import { h } from './dom';
import { initLaser, resetLaser } from './ink/laser';
import { INK, initPen, resetPen, togglePen } from './ink/pen';
import { buildToolbar, resetToolbar } from './ink/toolbar';
import { initKeys } from './keys';
import { ensureStage, initLayout, toggleFullscreen } from './layout';
import { openMediaCredits, openSources, initMedia } from './media';
import { go, indexFromHash, initNav } from './nav';
import { mountWidgets, resetPlugins, unmountWidgets } from './plugins/registry';
import { initPrint, print } from './print';
import { S, resetState } from './state';
import type { MarcoApi } from './types';

const CHROME_IDS = [
  'marco-chrome',
  'nav-dock',
  'toc-sidebar',
  'notes-panel',
  'search',
  'help',
  'dialog',
  'pen-toolbar',
  'pen-canvas',
  'laser-canvas',
  'marco-toast',
  'handout',
  'page-size',
];

function api(): MarcoApi {
  if (!window.MARCO) window.MARCO = createApi();
  return window.MARCO;
}

/** Initialises the runtime once per document; later calls return the existing API. */
export function init(): MarcoApi {
  const marco = api();
  if (S.ready) return marco;

  const raw = readLectureJson();
  S.edition = detectEdition(document, raw);
  document.documentElement.setAttribute('data-edition', S.edition);
  S.data = normalizeData(raw, S.edition, document.title);
  ensureStage();

  if (!document.getElementById('marco-chrome')) {
    document.head.append(h('style', { id: 'marco-chrome' }, CHROME_CSS));
  }
  initLayout();
  initNav();
  buildDock({
    prev: () => go(S.cur - 1),
    next: () => go(S.cur + 1),
    toc: () => toggleToc(),
    notes: () => toggleNotes(),
    search: toggleSearch,
    pen: togglePen,
    print: () => print('lecture'),
    handout: () => print('handout'),
    full: toggleFullscreen,
    help: () => toggleHelp(),
    penOn: () => INK.on,
    searchOpen: isSearchOpen,
  });
  buildToc();
  buildNotes();
  buildSearch();
  buildDialog();
  buildHelp({ allSources: () => openSources('all'), mediaCredits: openMediaCredits });
  if (S.canvas) {
    initPen(S.canvas);
    initLaser(S.canvas);
  }
  buildToolbar();
  buildToast();
  initMedia();
  initPrint();
  initKeys();

  S.ready = true;
  mountWidgets();
  const start = indexFromHash(location.hash);
  S.cur = start >= 0 ? start : 0;
  go(S.cur, true);
  document.documentElement.setAttribute('data-marco', 'ready');
  document.dispatchEvent(new CustomEvent('marco:ready'));
  return marco;
}

/** Tears everything down (used by tests; a deck never calls it). */
export function dispose(): void {
  unmountWidgets();
  closeDialog();
  resetState();
  for (const id of CHROME_IDS) document.getElementById(id)?.remove();
  document
    .querySelectorAll('.ink-text,.slide-no,.slide-progress,.widget-placeholder')
    .forEach((e) => e.remove());
  document.body?.classList.remove(
    'notes-open',
    'toc-open',
    'pen-on',
    'laser-on',
    'dialog-open',
    'print-lecture',
    'handout-mode',
    'fs-active',
  );
  document.documentElement.removeAttribute('data-marco');
  resetDock();
  resetToc();
  resetNotes();
  resetSearch();
  resetHelp();
  resetDialog();
  resetToast();
  resetPen();
  resetLaser();
  resetToolbar();
  resetPlugins();
  delete window.MARCO;
}
