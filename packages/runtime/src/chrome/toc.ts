// `#toc-sidebar`: slide list grouped by `data-group`, active tracking, click to jump.
import { $, $$, esc, h, pad2, slideTitle } from '../dom';
import { ICON } from '../icons';
import { fitCanvas } from '../layout';
import { go } from '../nav';
import { S, listen, pub, pushOverlay, removeOverlay } from '../state';

let aside: HTMLElement | null = null;

export function buildToc(): void {
  let html = '';
  let last: string | null = null;
  let open = false;
  S.slides.forEach((s, i) => {
    const g = s.dataset.group?.trim() || '';
    if (g !== last) {
      if (open) html += '</div>';
      html += `<div class="toc-group${g ? '' : ' toc-ungrouped'}">`;
      if (g) html += `<div class="toc-group-head">${esc(g)}</div>`;
      open = true;
      last = g;
    }
    const kind = s.dataset.type || (s.classList.contains('divider') ? 'divider' : '');
    html +=
      `<button type="button" class="toc-item${kind ? ` toc-${esc(kind)}` : ''}" data-index="${i}">` +
      `<span class="toc-num">${pad2(i + 1)}</span><span class="toc-title">${esc(slideTitle(s, i))}</span></button>`;
  });
  if (open) html += '</div>';

  aside = h(
    'aside',
    { id: 'toc-sidebar', 'aria-label': '목차', 'aria-hidden': 'true' },
    `<div class="panel-head"><b class="panel-tag">목차</b><span class="toc-count">${S.slides.length}장</span>` +
      `<button type="button" class="panel-close" title="목차 닫기 (M)" aria-label="목차 닫기">${ICON.close}</button></div>` +
      `<nav class="toc-list">${html}</nav>`,
  );
  document.body.append(aside);
  listen(aside, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.panel-close')) return toggleToc(false);
    const item = t.closest<HTMLElement>('.toc-item');
    if (!item) return;
    go(Number(item.dataset.index));
    if (window.innerWidth < 1100) toggleToc(false);
  });
  listen(document, 'marco:slidechange', syncToc);
  syncToc();
}

function syncToc(): void {
  if (!aside) return;
  for (const b of $$('.toc-item', aside)) {
    const on = Number(b.dataset.index) === S.cur;
    b.classList.toggle('active', on);
    if (on) {
      b.setAttribute('aria-current', 'true');
      if (S.tocOpen) b.scrollIntoView?.({ block: 'nearest' });
    } else b.removeAttribute('aria-current');
  }
}

export function toggleToc(force?: boolean): void {
  if (!aside) return;
  const open = force ?? !S.tocOpen;
  S.tocOpen = open;
  document.body.classList.toggle('toc-open', open);
  aside.classList.toggle('open', open);
  aside.setAttribute('aria-hidden', String(!open));
  if (open) {
    pushOverlay('toc', () => toggleToc(false));
    syncToc();
  } else {
    removeOverlay('toc');
    if (aside.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }
  fitCanvas();
  pub('ui');
}

export function resetToc(): void {
  aside = null;
}
