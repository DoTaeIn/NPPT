// Handout (A4 portrait): per slide a scaled thumbnail and the full note, then the terms list.
// DOM shared with the design system's print.css:
//   <div id="handout">
//     <article class="ho-page" data-slide="s-04">
//       <header class="ho-head"><span class="ho-no">04</span><h2 class="ho-title">…</h2><span class="ho-tag">deck</span></header>
//       <div class="ho-shot"><section class="slide active …">clone, ids removed</section></div>
//       <div class="ho-note"><p class="ho-time">…</p><ol class="ho-cues">
//         <li class="ho-cue" data-kind="SAY"><b class="ho-marker">대사</b><div class="ho-text">…</div></li></ol></div>
//     </article>
//     <section class="ho-terms"><h2>용어 · 약자</h2><dl><div><dt>LPR</dt><dd>…</dd></div></dl></section>
//   </div>
// The thumbnail scale comes from CSS (--ho-w / --ho-scale); an empty .ho-note prints ruled lines.
import { noteFor, timeText } from './data';
import { esc, h, inlineFmt, pad2, slideTitle } from './dom';
import { CUE_LABEL } from './labels';
import { S } from './state';
import type { Cue } from './types';

const cueItem = (c: Pick<Cue, 'k' | 't' | 'marker' | 'wait'>): string =>
  `<li class="ho-cue" data-kind="${c.k}"><b class="ho-marker">${esc(c.marker || CUE_LABEL[c.k])}</b>` +
  `<div class="ho-text">${inlineFmt(c.t)}${c.wait ? ` <span class="ho-wait">(${esc(c.wait)})</span>` : ''}</div></li>`;

/** Note block; empty (ruled space) in the student edition and for slides without notes. */
function noteHtml(s: HTMLElement): string {
  const note = S.edition === 'student' ? undefined : noteFor(S.data, s);
  let html = note?.time ? `<p class="ho-time">${esc(timeText(note.time))}</p>` : '';
  if (note?.cues.length) html += `<ol class="ho-cues">${note.cues.map(cueItem).join('')}</ol>`;
  else if (note?.raw) html += `<ol class="ho-cues">${cueItem({ k: 'MEMO', t: note.raw })}</ol>`;
  return `<div class="ho-note">${html}</div>`;
}

export function removeHandout(): void {
  document.getElementById('handout')?.remove();
}

export function buildHandout(): HTMLElement {
  removeHandout();
  const host = h('div', { id: 'handout', 'aria-hidden': 'true' });
  const deck = S.data.meta.title || document.title;
  S.slides.forEach((s, i) => {
    const page = h(
      'article',
      { class: 'ho-page', 'data-slide': s.id || String(i + 1) },
      `<header class="ho-head"><span class="ho-no">${pad2(i + 1)}</span>` +
        `<h2 class="ho-title">${esc(slideTitle(s, i))}</h2><span class="ho-tag">${esc(deck)}</span></header>`,
    );
    const shot = h('div', { class: 'ho-shot' });
    const clone = s.cloneNode(true) as HTMLElement;
    clone.classList.add('active');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    clone.querySelectorAll('.slide-no,.slide-progress,.ink-text').forEach((e) => e.remove());
    clone.setAttribute('aria-hidden', 'true');
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
        { class: 'ho-terms' },
        '<h2>용어 · 약자</h2><dl>' +
          terms
            .map((t) => `<div><dt>${esc(t)}</dt><dd>${esc(S.data.terms[t])}</dd></div>`)
            .join('') +
          '</dl>',
      ),
    );
  }
  document.body.append(host);
  return host;
}
