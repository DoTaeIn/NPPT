// Cards mode: a grid of question cards; a card opens the question in the runtime dialog, the
// first pick is graded (verdict, explanation, refs) and the card keeps a state mark.
import { esc, h, pad2 } from '../../dom';
import type { PluginCtx } from '../../types';
import { areaLabel, type Item } from './model';
import { EMPTY_HTML, digitIndex, feedbackHtml, mark, optsHtml, txt, verdictOf } from './view';

export interface Instance {
  destroy(): void;
}

/** 2×2 for four cards, then up to five columns. */
const columns = (n: number): number => (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5);

export function mountCards(el: HTMLElement, items: Item[], ctx: PluginCtx): Instance {
  const answers = new Map<string, number>();
  const known = (id: string): boolean => ctx.data.refs.some((r) => r.id === id);
  const root = h('div', { class: 'mq mq-cards' });
  el.append(root);

  const stateText = (it: Item): string => {
    const v = verdictOf(it, answers.get(it.id));
    return v === 'ok'
      ? `✓ 정답 · ${mark(it.ans)}`
      : v === 'wrong'
        ? `✗ 오답 · 정답 ${mark(it.ans)}`
        : '풀어 보기 ›';
  };

  /** Updates card `i` (state mark) and the status line. */
  function paint(i = -1): void {
    const it = items[i];
    const card = root.querySelector<HTMLElement>(`.mq-card[data-i="${i}"]`);
    if (it && card) {
      const v = verdictOf(it, answers.get(it.id));
      if (v === 'blank') delete card.dataset.state;
      else card.dataset.state = v;
      card.querySelector('.mq-state')!.textContent = stateText(it);
    }
    const done = items.filter((x) => answers.has(x.id));
    const right = done.filter((x) => answers.get(x.id) === x.ans).length;
    root.querySelector('.mq-status')!.innerHTML =
      `푼 문항 <b>${done.length}</b> / ${items.length} · 정답 <b>${right}</b>`;
  }

  root.innerHTML = items.length
    ? `<div class="mq-grid${items.length > 6 ? ' is-dense' : ''}" style="--mq-cols:${columns(items.length)}">${items
        .map(
          (it, i) =>
            `<button type="button" class="mq-card" data-q="${esc(it.id)}" data-i="${i}" title="${esc(areaLabel(it))}">` +
            `<span class="mq-head"><span class="mq-no">${pad2(it.no)}</span>` +
            `<span class="mq-area">${esc(areaLabel(it))}</span></span>` +
            `<b class="mq-key">${txt(it.key || it.q)}</b>` +
            (it.key ? `<span class="mq-qt">${txt(it.q)}</span>` : '') +
            `<span class="mq-state">${stateText(it)}</span></button>`,
        )
        .join('')}</div><p class="mq-status" aria-live="polite"></p>`
    : EMPTY_HTML;
  if (items.length) paint();

  function open(i: number): void {
    const it = items[i];
    if (!it) return;
    const box = h('div', { class: 'mq-dlg' });
    const draw = (): void => {
      const picked = answers.get(it.id);
      const done = picked !== undefined;
      box.innerHTML =
        `<p class="mq-q">${txt(it.q)}</p>${optsHtml(it, picked, done)}` +
        (done
          ? feedbackHtml(it, picked, known)
          : `<p class="mq-hint">보기를 누르거나 숫자 키 1–${Math.min(9, it.opts.length)}로 답하세요.</p>`) +
        `<div class="mq-actions">${done ? '<button type="button" class="mq-btn mq-again">다시 풀기</button>' : ''}` +
        `${i + 1 < items.length ? '<button type="button" class="mq-btn primary mq-next">다음 문항 ›</button>' : ''}</div>`;
    };
    const pick = (k: number): void => {
      if (answers.has(it.id) || k < 0 || k >= it.opts.length) return;
      answers.set(it.id, k);
      draw();
      paint(i);
      box.querySelector<HTMLElement>(`.mq-opt[data-i="${k}"]`)?.focus();
      ctx.events.emit('answer', { id: it.id, pick: k, correct: k === it.ans });
    };
    box.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button');
      if (!b) return;
      if (b.classList.contains('mq-opt')) pick(Number(b.dataset.i));
      else if (b.classList.contains('mq-ref')) ctx.openSources([b.dataset.ref || '']);
      else if (b.classList.contains('mq-next')) open(i + 1);
      else if (b.classList.contains('mq-again')) {
        answers.delete(it.id);
        draw();
        paint(i);
        box.querySelector<HTMLElement>('.mq-opt')?.focus();
      }
    });
    draw();
    const area = areaLabel(it);
    ctx.openDialog(`${pad2(it.no)}번${area ? ` · ${area}` : ''}`, box, {
      kind: 'quiz',
      onKey(e) {
        const k = digitIndex(e);
        if (k < 0 || k >= it.opts.length || answers.has(it.id)) return false;
        pick(k);
        return true;
      },
    });
  }

  root.addEventListener('click', (e) => {
    const card = (e.target as Element).closest<HTMLElement>('.mq-card');
    if (card) open(Number(card.dataset.i));
  });

  return { destroy: () => root.remove() };
}
