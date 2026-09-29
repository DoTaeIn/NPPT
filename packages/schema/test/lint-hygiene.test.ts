/**
 * Lint codes added in the hygiene pass: per-column table cell budgets, `table.ragged`,
 * `content.todo`, `icon.unknown` (compiler-only) and the `budget.slide.dense` heuristic.
 */
import { describe, expect, it } from 'vitest';
import { BUDGETS, DENSITY, tableCellBudget } from '../src/budgets.js';
import { availableBodyHeight, estimateBlockHeight, stackHeight } from '../src/lint.js';
import { LINT_CODES, lintLecture, normalizeLecture, parseNote } from '../src/index.js';
import type { Block, Lecture, LintIssue, Slide } from '../src/index.js';
import { lectureFixture, makeLecture } from './helpers.js';

const content = (blocks: Block[], extra: Partial<Slide> = {}): Slide => ({
  id: 's-01',
  type: 'content',
  title: '제목',
  blocks,
  ...extra,
});
const lint = (slides: Slide[], extra: Partial<Lecture> = {}): LintIssue[] =>
  lintLecture(makeLecture(slides, extra));
const only = (issues: LintIssue[], code: string): LintIssue[] =>
  issues.filter((i) => i.code === code);

describe('LINT_CODES', () => {
  it('lists the new codes with their levels', () => {
    expect(LINT_CODES).toMatchObject({
      'budget.slide.dense': 'warn',
      'table.ragged': 'warn',
      'icon.unknown': 'warn',
      'content.todo': 'info',
    });
  });

  it('never emits icon.unknown itself (the compiler knows the icon set)', () => {
    const issues = lint([
      content([{ type: 'cards', cols: 2, items: [{ title: '카드', icon: 'no-such-icon' }] }]),
    ]);
    expect(issues).toEqual([]);
  });
});

describe('table cell budgets by column count', () => {
  it('keeps the scalar fallback and keys the budget by columns', () => {
    expect(BUDGETS.table.cell).toBe(40);
    expect(BUDGETS.table.cellByCols).toEqual({ 2: 40, 3: 30, 4: 20, 5: 16, 6: 12 });
    expect([1, 2, 3, 4, 5, 6, 7].map(tableCellBudget)).toEqual([40, 40, 30, 20, 16, 12, 12]);
  });

  const table = (cols: number, cell: string): Block => ({
    type: 'table',
    head: Array.from({ length: cols }, (_, i) => `h${i}`),
    rows: [Array.from({ length: cols }, (_, i) => (i === 1 ? cell : 'x'))],
  });

  it('warns on a 31-character cell in a three-column table only', () => {
    const cell = '가'.repeat(31);
    expect(lint([content([table(2, cell)])])).toEqual([]);
    expect(lint([content([table(3, cell)])])).toEqual([
      {
        level: 'warn',
        code: 'budget.table.cell',
        path: '/slides/0/blocks/0/rows/0/1',
        message: 'table.rows[0][1](cols=3): 31자 (허용 30자)',
        slide: 's-01',
      },
    ]);
  });

  it('applies the narrowest budget to header cells of a six-column table', () => {
    const issues = lint([
      content([{ type: 'table', head: ['열'.repeat(13), 'b', 'c', 'd', 'e', 'f'], rows: [] }]),
    ]);
    expect(issues.map((i) => [i.code, i.path, i.message])).toEqual([
      ['budget.table.cell', '/slides/0/blocks/0/head/0', 'table.head[0](cols=6): 13자 (허용 12자)'],
    ]);
  });
});

describe('table.ragged', () => {
  it('reports the first row whose cell count differs from the header, once per table', () => {
    const issues = lint([
      content([
        {
          type: 'table',
          head: ['a', 'b', 'c'],
          rows: [
            ['1', '2', '3'],
            ['1', '2'],
            ['1', '2', '3', '4'],
          ],
        },
      ]),
    ]);
    expect(issues).toEqual([
      {
        level: 'warn',
        code: 'table.ragged',
        path: '/slides/0/blocks/0/rows/1',
        message: 'table.rows[1]: 칸 2개 (머리글 3개) 외 1행',
        slide: 's-01',
      },
    ]);
  });

  it('is quiet for a rectangular table and checks tables inside columns', () => {
    const square: Block = { type: 'table', head: ['a', 'b'], rows: [['1', '2']] };
    expect(lint([content([square])])).toEqual([]);
    const nested = lint([
      content([
        {
          type: 'columns',
          cols: 2,
          columns: [[{ type: 'table', head: ['a', 'b'], rows: [['1']] }], [square]],
        },
      ]),
    ]);
    expect(nested.map((i) => [i.code, i.path, i.message])).toEqual([
      [
        'table.ragged',
        '/slides/0/blocks/0/columns/0/0/rows/0',
        'table.rows[0]: 칸 1개 (머리글 2개)',
      ],
    ]);
  });
});

describe('content.todo', () => {
  it('reports TODO markers in visible text and notes as info, one per field', () => {
    const note = parseNote(
      '[대사] 설명합니다.\n[검증 보충] TODO: 확인할 내용 — 권고 발표일\n[메모] 할 일 없음',
    );
    const issues = lint(
      [
        content(
          [
            { type: 'paragraph', text: '이미지 자리. TODO: 이미지 — 캠퍼스 배치도' },
            {
              type: 'cards',
              cols: 2,
              items: [
                { title: '카드', body: 'TODO: 수치 확인. 그리고 TODO： 출처' },
                { title: 'todo: 소문자는 표시가 아니다' },
              ],
            },
            { type: 'code', code: 'x = 1  # MYTODO: 코드 안의 다른 낱말' },
          ],
          { note, subtitle: 'TODO:부제' },
        ),
      ],
      { refs: [{ id: 'S01', title: 'TODO: 출처 필요 — 공식 문서' }] },
    );
    const todos = only(issues, 'content.todo');
    expect(todos.map((i) => [i.level, i.path, i.message, i.slide])).toEqual([
      [
        'info',
        '/slides/0/blocks/0/text',
        '확인할 TODO가 남아 있습니다: "TODO: 이미지 — 캠퍼스 배치도"',
        's-01',
      ],
      [
        'info',
        '/slides/0/blocks/1/items/0/body',
        '확인할 TODO가 남아 있습니다: "TODO: 수치 확인. 그리고 TODO： 출처" 외 1개',
        's-01',
      ],
      [
        'info',
        '/slides/0/note/cues/1/t',
        '확인할 TODO가 남아 있습니다: "TODO: 확인할 내용 — 권고 발표일"',
        's-01',
      ],
      ['info', '/slides/0/subtitle', '확인할 TODO가 남아 있습니다: "TODO:부제"', 's-01'],
      [
        'info',
        '/refs/0/title',
        '확인할 TODO가 남아 있습니다: "TODO: 출처 필요 — 공식 문서"',
        undefined,
      ],
    ]);
  });

  it('shortens long lines to 60 characters', () => {
    const issues = lint([
      content([{ type: 'paragraph', text: `TODO: ${'가'.repeat(80)}\n다음 줄` }]),
    ]);
    expect(only(issues, 'content.todo')[0]?.message).toBe(
      `확인할 TODO가 남아 있습니다: "TODO: ${'가'.repeat(54)}…"`,
    );
  });

  it('does not count ids, asset keys or the raw note twice', () => {
    const lecture = normalizeLecture({
      meta: { title: '덱' },
      slides: [{ id: 'todo-plan', title: '계획', note: { raw: '[메모] TODO: 녹화 여부' } }],
    });
    expect(only(lintLecture(lecture), 'content.todo').map((i) => i.path)).toEqual([
      '/slides/0/note/cues/0/t',
    ]);
  });
});

describe('budget.slide.dense', () => {
  it('estimates block heights from the documented table', () => {
    const d = DENSITY.block;
    const h = (block: Block): number => estimateBlockHeight(block);
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `t${i}` }));
    expect(h({ type: 'chain', items: [{ label: 'a' }] })).toBe(200);
    expect(h({ type: 'cards', cols: 2, items: items(3) })).toBe(2 * 200);
    expect(h({ type: 'cards', cols: 3, items: items(6) })).toBe(2 * 180);
    expect(h({ type: 'cards', cols: 4, items: items(4) })).toBe(180);
    expect(h({ type: 'takeaway', text: 't' })).toBe(90);
    expect(h({ type: 'table', head: ['a'], rows: [['1'], ['2'], ['3']] })).toBe(56 + 3 * 60);
    const row = { label: 'l', left: 'a', right: 'b' };
    expect(h({ type: 'compare', left: 'L', right: 'R', rows: [row, row] })).toBe(60 + 2 * 64);
    expect(h({ type: 'callout', kind: 'info', body: 'b' })).toBe(120);
    expect(h({ type: 'steps', items: items(4) })).toBe(4 * 64);
    expect(h({ type: 'bullets', items: ['a', 'b', 'c'] })).toBe(3 * 44);
    expect(h({ type: 'paragraph', text: '가'.repeat(90) })).toBe(44);
    expect(h({ type: 'paragraph', text: `**${'가'.repeat(91)}**` })).toBe(88);
    expect(h({ type: 'paragraph', text: '' })).toBe(44);
    expect(h({ type: 'image', asset: 'a' })).toBe(420);
    expect(h({ type: 'image', asset: 'a', height: 520 })).toBe(520);
    expect(h({ type: 'video', video: 'v' })).toBe(96);
    expect(h({ type: 'quote', text: 'q' })).toBe(140);
    expect(h({ type: 'code', code: 'a\nb\nc\n\n' })).toBe(3 * 36 + 60);
    expect(h({ type: 'pills', items: [{ text: 'p' }] })).toBe(56);
    expect(h({ type: 'verdict', verdict: 'allow', text: 't' })).toBe(72);
    const at = { at: 'D-1', title: 't' };
    expect(h({ type: 'timeline', items: [at, at, at] })).toBe(3 * 72);
    expect(h({ type: 'tiles', cols: 3, items: [{ label: 'a' }] })).toBe(160);
    const term = { abbr: 'A', ko: '가' };
    expect(h({ type: 'terms', items: [term, term, term] })).toBe(90);
    expect(h({ type: 'terms', items: [term, term, term, term] })).toBe(2 * 90);
    expect(h({ type: 'widget', name: 'abac' })).toBe(400);
    expect(h({ type: 'html', html: '<p>x</p>' })).toBe(200);
    expect(d.paragraphChars).toBe(90);
  });

  it('takes the tallest column and adds the gap between stacked blocks', () => {
    const takeaway: Block = { type: 'takeaway', text: 't' };
    const callout: Block = { type: 'callout', kind: 'info', body: 'b' };
    const columns: Block = {
      type: 'columns',
      cols: 2,
      columns: [[takeaway, takeaway], [callout]],
    };
    expect(estimateBlockHeight(columns)).toBe(90 + 28 + 90);
    expect(stackHeight([columns, callout])).toBe(208 + 28 + 120);
    expect(stackHeight([])).toBe(0);
  });

  it('gives 760px under the title, 629px with a subtitle and a question strip', () => {
    expect(availableBodyHeight({})).toBe(760);
    expect(availableBodyHeight({ subtitle: '부제' })).toBe(700);
    expect(availableBodyHeight({ question: '질문' })).toBe(689);
    expect(availableBodyHeight({ subtitle: '부제', question: '질문' })).toBe(629);
    expect(availableBodyHeight({ subtitle: ' ' })).toBe(760);
  });

  // Three blocks of 280 + 280 + h with two gaps: estimate = 616 + h.
  const stack = (last: number): Block[] => [
    { type: 'image', asset: 'a', height: 280 },
    { type: 'image', asset: 'a', height: 280 },
    { type: 'image', asset: 'a', height: last },
  ];
  const assets = { assets: { a: { path: 'assets/a.png' } } };

  it('warns only when the estimate exceeds the available height by more than 10%', () => {
    // 760 × 1.1 = 836 → 220 is at the limit, 221 is over.
    expect(lint([content(stack(220))], assets)).toEqual([]);
    expect(lint([content(stack(221))], assets)).toEqual([
      {
        level: 'warn',
        code: 'budget.slide.dense',
        path: '/slides/0/blocks',
        message:
          'slide.dense: 본문 높이 추정 837px (허용 760px, 10% 초과 · 가장 큰 블록 #1 image 280px)',
        slide: 's-01',
      },
    ]);
    const tight = { subtitle: '부제', question: '질문' };
    // 629 × 1.1 = 691.9: 691 passes, 692 warns.
    expect(only(lint([content(stack(75), tight)], assets), 'budget.slide.dense')).toEqual([]);
    expect(
      only(lint([content(stack(76), tight)], assets), 'budget.slide.dense').map((i) => i.message),
    ).toEqual([
      'slide.dense: 본문 높이 추정 692px (허용 629px, 10% 초과 · 가장 큰 블록 #1 image 280px)',
    ]);
  });

  it('checks content and hero slides only', () => {
    const blocks: Block[] = [
      { type: 'widget', name: 'a' },
      { type: 'widget', name: 'b' },
      { type: 'widget', name: 'c' },
    ];
    const types = ['content', 'hero', 'cover', 'divider', 'quote', 'references'] as const;
    const dense = types.filter(
      (type) => only(lint([content(blocks, { type })]), 'budget.slide.dense').length > 0,
    );
    expect(dense).toEqual(['content', 'hero']);
  });

  it('leaves the week 3 excerpt alone', () => {
    const issues = lintLecture(lectureFixture('week03-excerpt.json'));
    expect(only(issues, 'budget.slide.dense')).toEqual([]);
  });
});

describe('cover artwork', () => {
  it('reports an art id that is not in assets as asset.missing', () => {
    const cover = {
      id: 's-01',
      type: 'cover',
      title: '표지',
      blocks: [],
      art: 'hero-art',
    } as Slide;
    expect(lint([cover])).toEqual([
      {
        level: 'error',
        code: 'asset.missing',
        path: '/slides/0/art',
        message: 'assets에 없는 이미지: hero-art (art)',
        slide: 's-01',
      },
    ]);
    expect(lint([cover], { assets: { 'hero-art': { path: 'assets/hero.png' } } })).toEqual([]);
  });
});
