// `#notes-panel`: presenter notes for the current slide, read from `#lecture-data` notes.
import { $, esc, h, inlineFmt, pad2, slideTitle } from '../dom';
import { noteFor, timeText } from '../data';
import { ICON } from '../icons';
import { CUE_LABEL } from '../labels';
import { fitCanvas } from '../layout';
import { S, listen, pub } from '../state';
import type { Cue } from '../types';
import { toast } from './toast';

let aside: HTMLElement | null = null;
let fontStep = 0;

export function cueHtml(c: Cue): string {
  const label = c.marker || CUE_LABEL[c.k] || '메모';
  const targets = c.focus?.targets || [];
  const attrs =
    (c.id ? ` data-cue-id="${esc(c.id)}"` : '') +
    (targets.length ? ` data-focus="${esc(targets.join(' '))}"` : '');
  const meta = `<span class="cue-k">${esc(label)}</span>${c.id ? `<span class="cue-id">${esc(c.id)}</span>` : ''}`;
  const wait = c.wait ? ` <span class="cue-wait">${ICON.clock}${esc(c.wait)}</span>` : '';
  const chips = targets.length
    ? `<div class="cue-targets">${targets.map((t) => `<span>@${esc(t)}</span>`).join('')}</div>`
    : '';
  return `<div class="cue k-${c.k.toLowerCase()}"${attrs}><div class="cue-meta">${meta}</div><div class="cue-t">${inlineFmt(c.t)}${wait}</div>${chips}</div>`;
}

/** Terms used on a slide: its `abbr.term` elements, expanded from `terms` or the title attribute. */
export function slideTerms(s: HTMLElement | undefined): Array<[string, string]> {
  if (!s) return [];
  const seen = new Map<string, string>();
  s.querySelectorAll<HTMLElement>('abbr.term').forEach((a) => {
    const k = a.textContent?.trim() || '';
    if (k && !seen.has(k)) seen.set(k, S.data.terms[k] || a.title || '');
  });
  return Array.from(seen.entries());
}

const minutesOf = (id: string): number => S.data.notes?.[id]?.time?.minutes || 0;

function render(): void {
  if (!aside || !S.notesOpen) return;
  const s = S.slides[S.cur];
  const n = S.slides.length;
  $('.panel-tag', aside)!.textContent = `발표 노트 · ${pad2(S.cur + 1)} / ${pad2(n)}`;
  $('.notes-title', aside)!.textContent = s ? slideTitle(s, S.cur) : '';
  const note = noteFor(S.data, s);

  const timeEl = $('.notes-time', aside)!;
  const total = S.slides.reduce((a, x) => a + minutesOf(x.id), 0);
  const upTo = S.slides.slice(0, S.cur + 1).reduce((a, x) => a + minutesOf(x.id), 0);
  const plan = typeof S.data.meta.duration === 'number' ? S.data.meta.duration : total;
  timeEl.hidden = !note?.time && !total;
  timeEl.innerHTML =
    (note?.time ? `${ICON.clock}<b>${esc(timeText(note.time))}</b>` : `${ICON.clock}<b>시간 배분 없음</b>`) +
    (total ? `<span class="notes-total">누적 ${+upTo.toFixed(2)}분 / ${+plan.toFixed(2)}분</span>` : '');

  let html = '';
  if (note && note.cues.length) html = note.cues.map(cueHtml).join('');
  else if (note?.raw) html = `<div class="cue k-memo"><div class="cue-t">${inlineFmt(note.raw)}</div></div>`;
  else html = '<p class="notes-empty">이 슬라이드에는 노트가 없습니다.</p>';
  const terms = slideTerms(s);
  if (terms.length) {
    html +=
      '<div class="notes-terms"><div class="nt-head">용어 · 약자</div><dl>' +
      terms.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') +
      '</dl></div>';
  }
  const bodyEl = $('.notes-body', aside)!;
  bodyEl.innerHTML = html;
  bodyEl.scrollTop = 0;

  const nx = S.slides[S.cur + 1];
  $('.notes-next', aside)!.innerHTML = nx
    ? `<span>다음</span>${pad2(S.cur + 2)} · ${esc(slideTitle(nx, S.cur + 1))}`
    : '<span>마지막 슬라이드</span>';
}

function focusTargets(cue: HTMLElement, on: boolean): void {
  const slide = S.slides[S.cur];
  const ids = (cue.dataset.focus || '').split(/\s+/).filter(Boolean);
  for (const id of ids) {
    let els: Element[] = [];
    const byId = document.getElementById(id.replace(/^#/, ''));
    if (byId) els = [byId];
    else if (slide) {
      try {
        els = Array.from(slide.querySelectorAll(id));
      } catch {
        els = [];
      }
    }
    els.forEach((e) => e.classList.toggle('marco-focus', on));
  }
}

function setFont(step: number): void {
  fontStep = Math.max(-2, Math.min(4, step));
  aside?.style.setProperty('--notes-fs', `${15 + fontStep * 2}px`);
}

export function buildNotes(): void {
  if (S.edition === 'student') return;
  aside = h(
    'aside',
    { id: 'notes-panel', 'aria-label': '발표 노트', 'aria-hidden': 'true' },
    `<div class="panel-head"><b class="panel-tag">발표 노트</b>` +
      `<button type="button" class="panel-btn" data-fs="-1" title="글자 작게" aria-label="글자 작게">가−</button>` +
      `<button type="button" class="panel-btn" data-fs="1" title="글자 크게" aria-label="글자 크게">가+</button>` +
      `<button type="button" class="panel-close" title="노트 닫기 (N)" aria-label="노트 닫기">${ICON.close}</button></div>` +
      `<h3 class="notes-title"></h3><div class="notes-time"></div><div class="notes-body"></div><div class="notes-next"></div>`,
  );
  document.body.append(aside);
  listen(aside, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.panel-close')) return toggleNotes(false);
    const fs = t.closest<HTMLElement>('[data-fs]');
    if (fs) setFont(fontStep + Number(fs.dataset.fs));
  });
  listen<MouseEvent>(aside, 'mouseover', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.cue[data-focus]');
    if (c) focusTargets(c, true);
  });
  listen<MouseEvent>(aside, 'mouseout', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('.cue[data-focus]');
    if (c && !c.contains(e.relatedTarget as Node | null)) focusTargets(c, false);
  });
  listen(document, 'marco:slidechange', () => {
    document.querySelectorAll('.marco-focus').forEach((e) => e.classList.remove('marco-focus'));
    render();
  });
}

export function toggleNotes(force?: boolean): void {
  if (S.edition === 'student' || !aside) {
    if (force !== false) toast('학생용 자료에는 발표 노트가 없습니다.');
    return;
  }
  const open = force ?? !S.notesOpen;
  S.notesOpen = open;
  document.body.classList.toggle('notes-open', open);
  aside.classList.toggle('open', open);
  aside.setAttribute('aria-hidden', String(!open));
  if (open) render();
  else if (aside.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  fitCanvas();
  pub('ui');
}

export function resetNotes(): void {
  aside = null;
  fontStep = 0;
}
