// Quiz plugin: params, selection and scoring, cards-mode dialog flow, exam flow and timer expiry.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispose } from '../../src/init';
import { quizPlugin } from '../../src/plugins/quiz';
import {
  normalizeItems,
  parseQuizParams,
  scoreExam,
  selectItems,
  type Item,
} from '../../src/plugins/quiz/model';
import type { MarcoApi } from '../../src/types';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();
afterEach(() => {
  vi.useRealTimers();
});

const $$ = (sel: string): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(sel));
const click = (el: Element | null | undefined): void => {
  if (!el) throw new Error('element not found');
  (el as HTMLElement).click();
};

/** Boots the fixture with the quiz plugin registered; `params` replaces a widget's data-params. */
function bootQuiz(cards?: object, exam?: object): MarcoApi {
  const m = boot(undefined, (h) =>
    h
      .replace(
        `data-params='{"mode":"cards"}'`,
        `data-params='${JSON.stringify(cards ?? { mode: 'cards' })}'`,
      )
      .replace(
        `data-params='{"mode":"exam","minutes":10}'`,
        `data-params='${JSON.stringify(exam ?? { mode: 'exam', minutes: 10 })}'`,
      ),
  );
  m.registerPlugin(quizPlugin);
  m.goId('s-06');
  return m;
}

const cards = (): HTMLElement => $('#s-06-b1')!;
const exam = (): HTMLElement => $('#s-06-b2')!;
const dialog = (): HTMLElement => $('#dialog')!;

describe('quiz model', () => {
  it('parses params tolerantly (compiler key=value strings or YAML arrays)', () => {
    expect(parseQuizParams({})).toEqual({ mode: 'cards', minutes: 15, shuffle: false });
    expect(parseQuizParams(null)).toEqual({ mode: 'cards', minutes: 15, shuffle: false });
    expect(
      parseQuizParams({ mode: 'exam', area: '2', ids: 'Q01, Q03', minutes: '20', shuffle: 'true' }),
    ).toEqual({ mode: 'exam', area: 2, ids: ['Q01', 'Q03'], minutes: 20, shuffle: true });
    expect(parseQuizParams({ mode: 'bogus', ids: ['Q02', 7, null], minutes: 0 })).toEqual({
      mode: 'cards',
      ids: ['Q02', '7'],
      minutes: 15,
      shuffle: false,
    });
    expect(parseQuizParams({ minutes: 999 }).minutes).toBe(180);
    expect(parseQuizParams({ minutes: 0.2 }).minutes).toBe(1);
  });

  it('skips invalid items and selects by ids (in order), then area, else all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const items = normalizeItems([
      { id: 'A', area: 1, q: 'a?', opts: ['x', 'y'], ans: 0 },
      { id: 'B', area: '2', q: 'b?', opts: ['x', 'y', 'z'], ans: 2, refs: ['S04'] },
      { id: 'bad', q: 'no options', opts: ['x'], ans: 0 },
      { id: 'bad2', q: 'ans out of range', opts: ['x', 'y'], ans: 5 },
      { q: 'no id', opts: ['x', 'y'], ans: 1 },
    ]);
    expect(items.map((i) => [i.id, i.no, i.area])).toEqual([
      ['A', 1, 1],
      ['B', 2, 2],
      ['Q5', 5, undefined],
    ]);
    expect(warn).toHaveBeenCalledTimes(2);
    const base = parseQuizParams({});
    expect(selectItems(items, { ...base, ids: ['B', 'nope', 'A'] }).map((i) => i.id)).toEqual([
      'B',
      'A',
    ]);
    expect(selectItems(items, { ...base, area: 2 }).map((i) => i.id)).toEqual(['B']);
    expect(selectItems(items, base)).toHaveLength(3);
  });

  it('scores by area', () => {
    const items = normalizeItems([
      { id: 'Q1', area: 2, areaName: '정책', q: '?', opts: ['a', 'b'], ans: 0 },
      { id: 'Q2', area: 1, areaName: '위치', q: '?', opts: ['a', 'b'], ans: 1 },
      { id: 'Q3', area: 1, areaName: '위치', q: '?', opts: ['a', 'b'], ans: 1 },
      { id: 'Q4', area: 2, areaName: '정책', q: '?', opts: ['a', 'b'], ans: 1 },
    ]) as Item[];
    const r = scoreExam(
      items,
      new Map([
        ['Q1', 0],
        ['Q2', 1],
        ['Q3', 0],
      ]),
    );
    expect(r).toMatchObject({
      correct: 2,
      total: 4,
      answered: 3,
      score: 50,
      grade: '보완 필요 (C)',
    });
    expect(r.areas).toEqual([
      { area: 1, name: '영역 1 · 위치', correct: 1, total: 2 },
      { area: 2, name: '영역 2 · 정책', correct: 1, total: 2 },
    ]);
  });
});

describe('quiz plugin · cards mode', () => {
  it('renders one card per question with number, area name, key term and styles once', () => {
    bootQuiz();
    const list = $$('#s-06-b1 .mq-card');
    expect(list).toHaveLength(4);
    expect(list.map((c) => c.querySelector('.mq-no')?.textContent)).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
    expect(list[0]!.querySelector('.mq-area')?.textContent).toBe('영역 1 · 인증');
    expect(list[2]!.querySelector('.mq-key')?.textContent).toBe('ABAC');
    expect($('#s-06-b1 .mq-status')?.textContent).toBe('푼 문항 0 / 4 · 정답 0');
    expect(cards().classList.contains('mq-host')).toBe(true);
    expect($$('style#marco-plugin-quiz')).toHaveLength(1);
    expect($('#marco-plugin-quiz')?.textContent).toContain('var(--primary');
  });

  it('card → dialog → pick → verdict, explanation, refs and a card state mark', () => {
    bootQuiz();
    const answered = vi.fn();
    document.addEventListener('marco:quiz:answer', (e) => answered((e as CustomEvent).detail));
    click($('#s-06-b1 .mq-card[data-i="0"]'));
    expect(dialog().hidden).toBe(false);
    expect(dialog().dataset.kind).toBe('quiz');
    expect($('#dialog-title')?.textContent).toBe('01번 · 영역 1 · 인증');
    expect($('#dialog .mq-q')?.textContent).toContain('카드와 연결하는 대상은?');
    expect($$('#dialog .mq-opt')).toHaveLength(4);
    expect($('#dialog .mq-verdict')).toBeNull();

    click($('#dialog .mq-opt[data-i="1"]'));
    expect($('#dialog .mq-verdict')?.textContent).toBe('✓ 정답입니다 · ②');
    expect($('#dialog .mq-opt.is-answer')?.dataset.i).toBe('1');
    expect($('#dialog .mq-exp')?.innerHTML).toContain('<b>사람</b>');
    expect(answered).toHaveBeenCalledWith({ id: 'Q01', pick: 1, correct: true });
    const card = $('#s-06-b1 .mq-card[data-i="0"]')!;
    expect(card.dataset.state).toBe('ok');
    expect(card.querySelector('.mq-state')?.textContent).toBe('✓ 정답 · ②');
    // The first pick counts.
    click($('#dialog .mq-opt[data-i="2"]'));
    expect(card.dataset.state).toBe('ok');

    // Refs: known ids are buttons that open the sources dialog.
    const refs = $$('#dialog .mq-ref');
    expect(refs.map((r) => r.textContent)).toEqual(['참고 S04']);
    click(refs[0]);
    expect(dialog().dataset.kind).toBe('sources');
    expect($('#dialog-body')?.textContent).toContain('S04 · NIST PACS · PIV');
  });

  it('number keys pick in the open dialog; Esc closes; keys go back to the runtime', () => {
    const m = bootQuiz();
    click($('#s-06-b1 .mq-card[data-i="1"]'));
    expect(press('3').defaultPrevented).toBe(true);
    expect($('#dialog .mq-verdict')?.textContent).toBe('✗ 오답입니다 · 내 답 ③ · 정답 ①');
    expect($('#dialog .mq-opt.is-wrong')?.dataset.i).toBe('2');
    expect($('#s-06-b1 .mq-card[data-i="1"]')?.dataset.state).toBe('wrong');
    expect($('#s-06-b1 .mq-status')?.textContent).toBe('푼 문항 1 / 4 · 정답 0');
    // Unknown ref ids are plain chips.
    expect($$('#dialog .mq-ref').map((r) => `${r.tagName}:${r.textContent}`)).toEqual([
      'BUTTON:참고 S13',
      'SPAN:참고 X99',
    ]);
    // Out of range and repeated digits are ignored.
    expect(press('1').defaultPrevented).toBe(false);
    expect(press('9').defaultPrevented).toBe(false);
    press('Escape');
    expect(dialog().hidden).toBe(true);
    press('ArrowLeft');
    expect(m.cur).toBe(4);
  });

  it('다음 문항 and 다시 풀기 inside the dialog', () => {
    bootQuiz();
    click($('#s-06-b1 .mq-card[data-i="2"]'));
    press('3');
    expect($('#s-06-b1 .mq-card[data-i="2"]')?.dataset.state).toBe('ok');
    click($('#dialog .mq-again'));
    expect($('#dialog .mq-verdict')).toBeNull();
    expect($('#s-06-b1 .mq-card[data-i="2"]')?.dataset.state).toBeUndefined();
    click($('#dialog .mq-next'));
    expect($('#dialog-title')?.textContent).toBe('04번 · 영역 2 · 인가 정책');
    expect($('#dialog .mq-next')).toBeNull();
    press('4');
    expect($('#dialog .mq-verdict')?.textContent).toBe('✓ 정답입니다 · ④');
    expect($('#dialog .mq-refs')).toBeNull();
  });

  it('selects by area or ids and can shuffle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    bootQuiz({ mode: 'cards', area: 2 }, { mode: 'exam', ids: 'Q04,Q01', shuffle: true });
    expect($$('#s-06-b1 .mq-card .mq-no').map((n) => n.textContent)).toEqual(['03', '04']);
    click($('#s-06-b2 .mq-begin'));
    // Fisher–Yates with random() = 0 rotates [Q04, Q01] to [Q01, Q04].
    expect($$('#s-06-b2 .mq-item').map((n) => n.dataset.q)).toEqual(['Q01', 'Q04']);
  });

  it('shows a message instead of cards when nothing is selected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    bootQuiz({ mode: 'cards', ids: ['NOPE'] });
    expect($('#s-06-b1 .mq-empty')?.textContent).toContain('표시할 문항이 없습니다');
    expect(warn).toHaveBeenCalled();
  });
});

describe('quiz plugin · exam mode', () => {
  it('start → answer → submit → per-area summary → review → 다시 풀기', () => {
    bootQuiz();
    const submitted = vi.fn();
    document.addEventListener('marco:quiz:submit', (e) => submitted((e as CustomEvent).detail));
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('idle');
    expect($('#s-06-b2 .mq-min-val')?.textContent).toBe('10분');
    expect($('#s-06-b2 .mq-meta')?.textContent).toContain('문항당 25점');
    click($('#s-06-b2 .mq-min[data-d="1"]'));
    expect($('#s-06-b2 .mq-min-val')?.textContent).toBe('11분');
    click($('#s-06-b2 .mq-min[data-d="-1"]'));

    click($('#s-06-b2 .mq-begin'));
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('running');
    expect($('#s-06-b2 .mq-timer')?.textContent).toBe('10:00');
    expect($$('#s-06-b2 .mq-item')).toHaveLength(4);
    expect($('#s-06-b2 .mq-item .mq-verdict')).toBeNull();
    const pick = (q: string, i: number): void =>
      click($(`#s-06-b2 .mq-item[data-q="${q}"] .mq-opt[data-i="${i}"]`));
    pick('Q01', 0); // wrong, then changed
    pick('Q01', 1); // right
    pick('Q02', 0); // right
    pick('Q03', 1); // wrong
    expect($('#s-06-b2 .mq-count')?.textContent).toBe('3');
    expect(
      $$('#s-06-b2 .mq-item[data-q="Q01"] .mq-opt').map((o) => o.getAttribute('aria-pressed')),
    ).toEqual(['false', 'true', 'false', 'false']);

    click($('#s-06-b2 .mq-submit'));
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({ score: 50, correct: 2, total: 4, answered: 3, auto: false }),
    );
    expect(dialog().hidden).toBe(false);
    expect($('#dialog-title')?.textContent).toBe('채점 결과');
    expect($('#dialog .mq-score')?.textContent).toBe('50/ 100점');
    expect($('#dialog .mq-grade')?.textContent).toContain('보완 필요 (C) · 정답 2 / 4 · 응답 3');
    const rows = $$('#dialog .mq-areas tbody tr').map((r) =>
      Array.from(r.children).map((c) => c.textContent),
    );
    expect(rows).toEqual([
      ['영역 1 · 인증', '2 / 2', '100%'],
      ['영역 2 · 인가 정책', '0 / 2', '0%'],
    ]);
    expect($('#dialog .mq-weak')?.textContent).toContain('영역 2 · 인가 정책');
    expect($('#dialog .mq-note')).toBeNull();

    // Review: answers, verdicts and explanations in the slide.
    click($('#dialog .mq-review'));
    expect(dialog().hidden).toBe(true);
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('review');
    expect($$('#s-06-b2 .mq-item').map((i) => i.dataset.state)).toEqual([
      'ok',
      'ok',
      'wrong',
      'blank',
    ]);
    expect($('#s-06-b2 .mq-item[data-q="Q03"] .mq-opt.is-answer')?.dataset.i).toBe('2');
    expect($('#s-06-b2 .mq-item[data-q="Q03"] .mq-opt.is-wrong')?.dataset.i).toBe('1');
    expect($('#s-06-b2 .mq-item[data-q="Q04"] .mq-verdict')?.textContent).toContain(
      '응답하지 않았습니다',
    );
    expect($('#s-06-b2 .mq-item[data-q="Q04"] .mq-exp')?.textContent).toContain('Fail-secure');
    expect($('#s-06-b2 .mq-total')?.textContent).toBe('50점');
    // Picking is off in review.
    click($('#s-06-b2 .mq-item[data-q="Q04"] .mq-opt[data-i="3"]'));
    expect($('#s-06-b2 .mq-item[data-q="Q04"]')?.dataset.state).toBe('blank');
    click($('#s-06-b2 .mq-item[data-q="Q03"] .mq-ref'));
    expect($('#dialog-body')?.textContent).toContain('S30 · NIST ABAC');
    press('Escape');

    click($('#s-06-b2 .mq-summary'));
    expect($('#dialog-title')?.textContent).toBe('채점 결과');
    click($('#dialog .mq-retry'));
    expect(dialog().hidden).toBe(true);
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('idle');
    click($('#s-06-b2 .mq-begin'));
    expect($('#s-06-b2 .mq-count')?.textContent).toBe('0');
  });

  it('counts down and auto-submits when the time runs out', () => {
    vi.useFakeTimers();
    bootQuiz(undefined, { mode: 'exam', minutes: 2 });
    const submitted = vi.fn();
    document.addEventListener('marco:quiz:submit', (e) => submitted((e as CustomEvent).detail));
    click($('#s-06-b2 .mq-begin'));
    click($('#s-06-b2 .mq-item[data-q="Q03"] .mq-opt[data-i="2"]'));
    vi.advanceTimersByTime(30_000);
    expect($('#s-06-b2 .mq-timer')?.textContent).toBe('01:30');
    expect($('#s-06-b2 .mq-timer')?.classList.contains('is-warn')).toBe(false);
    vi.advanceTimersByTime(40_000);
    expect($('#s-06-b2 .mq-timer')?.textContent).toBe('00:50');
    expect($('#s-06-b2 .mq-timer')?.classList.contains('is-warn')).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50_000);
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({ auto: true, score: 25, seconds: 120 });
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('review');
    expect($('#dialog .mq-note')?.textContent).toBe('시간이 종료되어 자동 제출되었습니다.');
    expect($('#dialog .mq-grade')?.textContent).toContain('소요 02:00');
    vi.advanceTimersByTime(60_000);
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('a time-out on another slide updates the form without opening the dialog', () => {
    vi.useFakeTimers();
    const m = bootQuiz(undefined, { mode: 'exam', minutes: 1 });
    click($('#s-06-b2 .mq-begin'));
    m.go(0);
    vi.advanceTimersByTime(61_000);
    expect(exam().querySelector('.mq-exam')?.getAttribute('data-phase')).toBe('review');
    expect(dialog().hidden).toBe(true);
  });

  it('stops the timer when the runtime is torn down', () => {
    vi.useFakeTimers();
    bootQuiz(undefined, { mode: 'exam', minutes: 1 });
    const submitted = vi.fn();
    document.addEventListener('marco:quiz:submit', submitted);
    click($('#s-06-b2 .mq-begin'));
    const widget = exam();
    dispose();
    expect(widget.querySelector('.mq')).toBeNull();
    expect(widget.classList.contains('mq-host')).toBe(false);
    vi.advanceTimersByTime(120_000);
    expect(submitted).not.toHaveBeenCalled();
    document.removeEventListener('marco:quiz:submit', submitted);
  });
});
