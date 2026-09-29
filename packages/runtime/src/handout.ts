// Handout (A4 portrait): per slide a scaled thumbnail and the full note, then the terms list.
import { noteFor, timeText } from './data';
import { esc, h, inlineFmt, pad2, slideTitle } from './dom';
import { CUE_LABEL } from './labels';
import { CH, CW } from './layout';
import { S } from './state';

/** Thumbnail width in CSS px: A4 (210 mm) minus 2 × 12 mm margins ≈ 703 px. */
export const SHOT_W = 700;

function noteHtml(s: HTMLElement): string {
  if (S.edition === 'student') {
    return '<div class="ho-note ho-blank"><span class="ho-blank-label">메모</span></div>';
  }
  const note = noteFor(S.data, s);
  let html = '';
  if (note?.time) html += `<p class="ho-time">⏱ ${esc(timeText(note.time))}</p>`;
  if (note?.cues.length) {
    html += note.cues
      .map(
        (c) =>
          `<p class="ho-cue k-${c.k.toLowerCase()}"><b class="ho-k">[${esc(c.marker || CUE_LABEL[c.k])}]</b> ${inlineFmt(c.t)}${c.wait ? ` <i>(${esc(c.wait)})</i>` : ''}</p>`,
      )
      .join('');
  } else if (note?.raw) html += `<p class="ho-cue">${inlineFmt(note.raw)}</p>`;
  else html += '<p class="ho-empty">등록된 노트가 없습니다.</p>';
  return `<div class="ho-note">${html}</div>`;
}

export function removeHandout(): void {
  document.getElementById('handout')?.remove();
}

export function buildHandout(): HTMLElement {
  removeHandout();
  const host = h('div', { id: 'handout', 'aria-hidden': 'true' });
  const k = SHOT_W / CW;
  const n = S.slides.length;
  const deck = S.data.meta.title || document.title;
  S.slides.forEach((s, i) => {
    const page = h(
      'section',
      { class: 'ho-page', 'data-index': i },
      `<header class="ho-head"><span class="ho-no">${pad2(i + 1)} / ${pad2(n)}</span>` +
        `<span class="ho-title">${esc(slideTitle(s, i))}</span><span class="ho-deck">${esc(deck)}</span></header>`,
    );
    const shot = h('div', { class: 'ho-shot' });
    shot.style.width = `${SHOT_W}px`;
    shot.style.height = `${Math.round(CH * k)}px`;
    const clone = s.cloneNode(true) as HTMLElement;
    clone.classList.add('active');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    clone.querySelectorAll('.slide-no,.slide-progress,.ink-text').forEach((e) => e.remove());
    clone.setAttribute('aria-hidden', 'true');
    clone.style.transform = `scale(${+k.toFixed(5)})`;
    shot.append(clone);
    page.append(shot);
    page.insertAdjacentHTML('beforeend', noteHtml(s));
    host.append(page);
  });
  const terms = Object.keys(S.data.terms).sort((a, b) => a.localeCompare(b));
  if (terms.length) {
    host.append(
      h(
        'section',
        { class: 'ho-page ho-terms' },
        `<header class="ho-head"><span class="ho-title">용어 · 약자</span><span class="ho-deck">${esc(deck)}</span></header>` +
          `<dl>${terms.map((t) => `<dt>${esc(t)}</dt><dd>${esc(S.data.terms[t])}</dd>`).join('')}</dl>`,
      ),
    );
  }
  document.body.append(host);
  return host;
}
