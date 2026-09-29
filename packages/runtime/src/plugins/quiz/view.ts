// HTML fragments shared by the cards dialog and the exam form. Quiz text is plain text with the
// same inline marks as notes (`**bold**`, `` `code` ``), always escaped.
import { esc, inlineFmt } from '../../dom';
import type { Item } from './model';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

/** ① ② ③ … for option `i`. */
export const mark = (i: number): string => CIRCLED[i] ?? String(i + 1);

export const txt = (s: unknown): string => inlineFmt(String(s ?? ''));

/** Option index for a digit key (`1` → 0), else -1. */
export function digitIndex(e: KeyboardEvent): number {
  if (e.ctrlKey || e.metaKey || e.altKey) return -1;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code) || /^([1-9])$/.exec(e.key);
  return m ? Number(m[1]) - 1 : -1;
}

/**
 * Option buttons. `picked` is the chosen index; with `reveal` the correct option and a wrong pick
 * are marked and the buttons are inert.
 */
export function optsHtml(it: Item, picked: number | undefined, reveal: boolean): string {
  const opts = it.opts.map((o, i) => {
    const right = reveal && i === it.ans;
    const wrong = reveal && i === picked && i !== it.ans;
    const cls = `mq-opt${right ? ' is-answer' : ''}${wrong ? ' is-wrong' : ''}`;
    const tag = right ? '정답' : reveal && i === picked ? '내 답' : '';
    return (
      `<button type="button" class="${cls}" data-i="${i}" aria-pressed="${i === picked}"` +
      `${reveal ? ' aria-disabled="true"' : ''}><span class="mq-mark">${mark(i)}</span>` +
      `<span class="mq-otext">${txt(o)}</span>${tag ? `<span class="mq-tag">${tag}</span>` : ''}</button>`
    );
  });
  return `<div class="mq-opts" role="group" aria-label="보기">${opts.join('')}</div>`;
}

/** `참고 S13` chips; ids found in `refs` are buttons that open the sources dialog. */
export function refsHtml(ids: readonly string[], known: (id: string) => boolean): string {
  if (!ids.length) return '';
  const chips = ids.map((id) =>
    known(id)
      ? `<button type="button" class="mq-ref" data-ref="${esc(id)}" title="출처 보기">참고 ${esc(id)}</button>`
      : `<span class="mq-ref is-plain">참고 ${esc(id)}</span>`,
  );
  return `<div class="mq-refs">${chips.join('')}</div>`;
}

export type Verdict = 'ok' | 'wrong' | 'blank';

export const verdictOf = (it: Item, picked: number | undefined): Verdict =>
  picked === undefined ? 'blank' : picked === it.ans ? 'ok' : 'wrong';

/** Verdict line, explanation and refs. */
export function feedbackHtml(
  it: Item,
  picked: number | undefined,
  known: (id: string) => boolean,
): string {
  const v = verdictOf(it, picked);
  const text =
    v === 'ok'
      ? `✓ 정답입니다 · ${mark(it.ans)}`
      : v === 'wrong'
        ? `✗ 오답입니다 · 내 답 ${mark(picked!)} · 정답 ${mark(it.ans)}`
        : `– 응답하지 않았습니다 · 정답 ${mark(it.ans)}`;
  return (
    `<div class="mq-feedback"><p class="mq-verdict is-${v}" role="status">${text}</p>` +
    (it.exp ? `<div class="mq-exp"><span class="mq-exp-k">해설</span> ${txt(it.exp)}</div>` : '') +
    refsHtml(it.refs || [], known) +
    '</div>'
  );
}

export const EMPTY_HTML =
  '<p class="mq-empty">표시할 문항이 없습니다. #lecture-data의 quiz와 위젯의 area·ids 값을 확인하세요.</p>';
