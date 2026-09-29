// `#search`: `/` opens; matches slide titles, body text and note text; Enter jumps.
import { $, esc, h, pad2, slideTitle } from '../dom';
import { noteFor } from '../data';
import { ICON } from '../icons';
import { go } from '../nav';
import { S, listen, pub, pushOverlay, removeOverlay } from '../state';

interface Entry {
  i: number;
  title: string;
  body: string;
  note: string;
}
export interface Hit {
  i: number;
  title: string;
  where: '번호' | '제목' | '본문' | '노트';
  snippet: string;
  score: number;
}

let root: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let list: HTMLElement | null = null;
let hits: Hit[] = [];
let sel = 0;
let index: Entry[] | null = null;

const INLINE =
  /^(A|ABBR|B|BDI|BDO|CITE|CODE|DFN|EM|I|KBD|MARK|Q|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|U|VAR)$/;
const SKIP = '.slide-no,.slide-progress,.widget-placeholder,script,style,svg';

/** Inline unless the tag is a block, or CSS made it one (e.g. a span inside a flex column). */
function isInline(e: Element): boolean {
  if (!INLINE.test(e.tagName)) return false;
  try {
    const d = getComputedStyle(e).display;
    return !d || d.startsWith('inline') || d === 'contents';
  } catch {
    return true;
  }
}

function blockOf(n: Node): Element | null {
  let e = n.parentElement;
  while (e && isInline(e)) e = e.parentElement;
  return e;
}

/** Visible text of a slide with spaces between blocks (textContent would glue them together). */
export function slideText(s: Element): string {
  const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let out = '';
  let prev: Element | null = null;
  while (w.nextNode()) {
    const n = w.currentNode;
    const b = blockOf(n);
    if (prev && b !== prev) out += ' ';
    out += n.nodeValue || '';
    prev = b;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function buildIndex(): Entry[] {
  return S.slides.map((s, i) => {
    const note = noteFor(S.data, s);
    const noteText = note
      ? note.cues.length
        ? note.cues.map((c) => c.t).join(' ')
        : note.raw || ''
      : '';
    return { i, title: slideTitle(s, i), body: slideText(s), note: noteText.replace(/\s+/g, ' ') };
  });
}

function snippet(text: string, at: number, len: number): string {
  const a = Math.max(0, at - 30);
  const b = Math.min(text.length, at + len + 90);
  return (a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '');
}

/** Ranked matches for a query (title > body > note; a bare number matches the slide number). */
export function searchSlides(query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Hit[] = [];
  if (!index) index = buildIndex();
  for (const e of index) {
    const t = e.title.toLowerCase();
    const bi = e.body.toLowerCase().indexOf(q);
    const ni = e.note.toLowerCase().indexOf(q);
    let hit: Hit | null = null;
    if (/^\d+$/.test(q) && Number(q) === e.i + 1) {
      hit = { i: e.i, title: e.title, where: '번호', snippet: snippet(e.body, 0, 0), score: 10 };
    } else if (t.includes(q)) {
      const s = bi >= 0 ? snippet(e.body, bi, q.length) : snippet(e.body, 0, 0);
      hit = { i: e.i, title: e.title, where: '제목', snippet: s, score: 3 };
    } else if (bi >= 0) {
      hit = {
        i: e.i,
        title: e.title,
        where: '본문',
        snippet: snippet(e.body, bi, q.length),
        score: 2,
      };
    } else if (ni >= 0) {
      hit = {
        i: e.i,
        title: e.title,
        where: '노트',
        snippet: snippet(e.note, ni, q.length),
        score: 1,
      };
    }
    if (hit) out.push(hit);
  }
  return out.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 40);
}

function mark(text: string, q: string): string {
  if (!q) return esc(text);
  const lower = text.toLowerCase();
  let out = '';
  let from = 0;
  for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, at + q.length)) {
    out += esc(text.slice(from, at)) + `<mark>${esc(text.slice(at, at + q.length))}</mark>`;
    from = at + q.length;
  }
  return out + esc(text.slice(from));
}

function render(): void {
  if (!list || !input) return;
  const q = input.value.trim();
  hits = searchSlides(q);
  sel = 0;
  const lq = q.toLowerCase();
  if (!q) {
    list.innerHTML =
      '<p class="sr-hint">제목 · 본문 · 발표 노트에서 찾습니다. 숫자를 입력하면 해당 번호의 슬라이드를 찾습니다.</p>';
    return;
  }
  if (!hits.length) {
    list.innerHTML = `<p class="sr-hint">“${esc(q)}”와 일치하는 슬라이드가 없습니다.</p>`;
    return;
  }
  list.innerHTML =
    `<div class="sr-head">검색 결과 <b>${hits.length}</b>건</div>` +
    hits
      .map(
        (r, k) =>
          `<button type="button" class="sr${k === 0 ? ' sel' : ''}" role="option" data-index="${r.i}" aria-selected="${k === 0}">` +
          `<span class="sr-no">${pad2(r.i + 1)}</span><span class="sr-main"><b class="sr-title">${mark(r.title, lq)}</b>` +
          `<span class="sr-snip">${mark(r.snippet, lq)}</span></span><span class="sr-where">${r.where}</span></button>`,
      )
      .join('');
}

function select(k: number): void {
  if (!list || !hits.length) return;
  sel = (k + hits.length) % hits.length;
  list.querySelectorAll<HTMLElement>('.sr').forEach((b, j) => {
    b.classList.toggle('sel', j === sel);
    b.setAttribute('aria-selected', String(j === sel));
    if (j === sel) b.scrollIntoView?.({ block: 'nearest' });
  });
}

function choose(i: number | undefined): void {
  if (i === undefined) return;
  closeSearch();
  go(i);
}

export function buildSearch(): void {
  root = h(
    'div',
    { id: 'search', role: 'dialog', 'aria-label': '슬라이드 검색', hidden: true },
    `<div class="search-box">${ICON.search}<input id="search-input" type="search" autocomplete="off" spellcheck="false" ` +
      `placeholder="슬라이드 검색 · 제목 · 본문 · 노트 · 번호" aria-label="슬라이드 검색"><kbd>Esc</kbd></div>` +
      '<div class="search-results" role="listbox"></div>',
  );
  document.body.append(root);
  input = $<HTMLInputElement>('#search-input', root);
  list = $('.search-results', root);
  listen(input!, 'input', render);
  listen<KeyboardEvent>(input!, 'keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(sel + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(hits[sel]?.i);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  });
  listen(list!, 'click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.sr');
    if (b) choose(Number(b.dataset.index));
  });
  listen(
    document,
    'pointerdown',
    (e) => {
      const t = e.target as HTMLElement;
      if (isSearchOpen() && !t.closest?.('#search,#nav-search')) closeSearch();
    },
    { capture: true },
  );
}

export const isSearchOpen = (): boolean => !!root && !root.hidden;

export function openSearch(): void {
  if (!root || !input) return;
  root.hidden = false;
  input.value = '';
  index = null; // slide text may have changed (widgets), so re-index on every open
  render();
  pushOverlay('search', closeSearch);
  input.focus();
  pub('ui');
}

export function closeSearch(): void {
  removeOverlay('search');
  if (!root || root.hidden) return;
  root.hidden = true;
  input?.blur();
  pub('ui');
}

export const toggleSearch = (): void => (isSearchOpen() ? closeSearch() : openSearch());

export function resetSearch(): void {
  root = input = list = null;
  hits = [];
  sel = 0;
  index = null;
}
