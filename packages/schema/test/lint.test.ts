import { describe, expect, it } from 'vitest';
import { LINT_CODES, lintLecture, normalizeLecture } from '../src/index.js';
import type { Cue, Lecture, LintIssue } from '../src/index.js';
import { lectureFixture, makeLecture } from './helpers.js';

const codes = (issues: LintIssue[]): string[] => issues.map((i) => i.code);
const one = (issues: LintIssue[], code: string): LintIssue => {
  const found = issues.filter((i) => i.code === code);
  expect(found, code).toHaveLength(1);
  return found[0] as LintIssue;
};

const NOT_HERE: ReadonlySet<string> = new Set(['columns.count', 'icon.unknown']);

/** A lecture in which every non-budget lint code (and the density check) fires exactly once. */
function everyCode(): Lecture {
  const cues: Cue[] = Array.from({ length: 31 }, (_, i) => ({ k: 'SAY', t: `큐 ${i}` }));
  cues[0] = { k: 'MEMO', t: '알 수 없는 표시', marker: '설명' };
  cues[1] = { k: 'SAY', t: '가'.repeat(601) };
  cues[2] = { k: 'MEMO', t: '약 2분쯤', marker: '시간' };
  cues[3] = { k: 'SAY', t: '중복 id', id: 'p04-c001' };
  cues[4] = { k: 'SAY', t: '중복 id', id: 'p04-c001' };
  return makeLecture(
    [
      { id: 's-01', type: 'content', title: ' ', refs: ['S99', 'S01'], blocks: [] },
      {
        id: 's-01',
        type: 'content',
        title: '에셋과 영상',
        blocks: [
          { type: 'image', asset: 'nope' },
          { type: 'video', video: 'nope' },
        ],
      },
      {
        id: 's-03',
        type: 'content',
        title: '열 안의 열',
        blocks: [
          {
            type: 'columns',
            cols: 2,
            columns: [[{ type: 'columns', cols: 2, columns: [[], []] }], []],
          },
          { type: 'table', head: ['항목', '값'], rows: [['한 칸뿐']] },
          { type: 'paragraph', text: 'TODO: 출처 필요 — 사례 발생일' },
          { type: 'code', code: Array.from({ length: 12 }, () => 'x').join('\n') },
          { type: 'widget', name: 'abac' },
        ],
      },
      {
        id: 's-04',
        type: 'content',
        title: '노트',
        blocks: [],
        note: { time: { minutes: 10 }, cues },
      },
    ],
    {
      meta: {
        title: '테스트',
        lang: 'ko',
        theme: 'v20-violet',
        edition: 'instructor',
        duration: 5,
      },
      refs: [
        { id: 'S01', title: '인용됨' },
        { id: 'S02', title: '미사용' },
      ],
      terms: { LPR: 'License Plate Recognition 차량번호 인식' },
      quiz: [{ id: 'Q01', q: '정답은?', opts: ['가', '나'], ans: 2 }],
    },
  );
}

describe('lintLecture', () => {
  it('finds nothing in the minimal fixture', () => {
    expect(lintLecture(lectureFixture('minimal.json'))).toEqual([]);
  });

  it('finds only information in the week 3 excerpt', () => {
    const issues = lintLecture(lectureFixture('week03-excerpt.json'));
    expect(issues.filter((i) => i.level !== 'info')).toEqual([]);
    expect(codes(issues)).toEqual(['ref.unused', 'ref.unused', 'time.total']);
    expect(issues[2]?.message).toBe(
      '노트 [시간] 합계 8.5분 / 강의 시간 75분 (슬라이드 5개 중 4개에 [시간])',
    );
  });

  it('reports budgets with actual vs allowed characters', () => {
    const issues = lintLecture(lectureFixture('invalid-over-budget.json'));
    expect(codes(issues)).toEqual([
      'budget.slide.title',
      'budget.chain.items',
      'budget.cards.body',
    ]);
    expect(issues.every((i) => i.level === 'warn' && i.slide === 's-01')).toBe(true);
    expect(issues[2]).toEqual({
      level: 'warn',
      code: 'budget.cards.body',
      path: '/slides/0/blocks/1/items/1/body',
      message: 'cards[1].body: 104자 (허용 90자)',
      slide: 's-01',
    });
    expect(issues[1]?.message).toBe('chain.items: 7개 (허용 6개)');
    expect(issues[0]?.message).toBe('title: 47자 (허용 34자)');
  });

  it('fires every non-budget code exactly once in the targeted fixture', () => {
    const issues = lintLecture(everyCode());
    // columns.count has its own test; icon.unknown is reported by the compiler only.
    const expected = Object.keys(LINT_CODES).filter(
      (c) => (!c.startsWith('budget.') || c === 'budget.slide.dense') && !NOT_HERE.has(c),
    );
    expect([...codes(issues)].sort()).toEqual([...expected].sort());
    for (const code of expected) {
      expect(one(issues, code).level).toBe(
        code === 'time.total' ? 'warn' : LINT_CODES[code as keyof typeof LINT_CODES],
      );
    }
  });

  it('attaches slide ids and paths, and orders issues by slide position', () => {
    const issues = lintLecture(everyCode());
    expect(one(issues, 'ref.missing')).toMatchObject({
      slide: 's-01',
      path: '/slides/0/refs/0',
      message: 'refs에 없는 참고 출처: S99',
    });
    expect(one(issues, 'slide.title.missing')).toMatchObject({
      slide: 's-01',
      path: '/slides/0/title',
    });
    expect(one(issues, 'slide.id.duplicate')).toMatchObject({
      level: 'error',
      path: '/slides/1/id',
      message: '중복된 슬라이드 id: s-01 (1번 슬라이드와 같음)',
    });
    expect(one(issues, 'asset.missing').path).toBe('/slides/1/blocks/0/asset');
    expect(one(issues, 'video.missing').path).toBe('/slides/1/blocks/1/video');
    expect(one(issues, 'columns.nested').path).toBe('/slides/2/blocks/0/columns/0/0');
    expect(one(issues, 'note.marker.unknown').message).toBe(
      '알 수 없는 노트 표시 [설명] → 메모로 처리했습니다',
    );
    expect(one(issues, 'note.cues.over').message).toBe('노트 큐 31개 (허용 30개)');
    expect(one(issues, 'note.cue.long')).toMatchObject({
      path: '/slides/3/note/cues/1/t',
      message: 'cues[1] 대사: 601자 (허용 600자)',
    });
    expect(one(issues, 'term.unused')).toMatchObject({ level: 'info', path: '/terms/LPR' });
    expect(one(issues, 'time.total').message).toMatch(
      /^노트 \[시간\] 합계 10분 > 강의 시간 5분 \(5분 초과/,
    );
    expect(one(issues, 'ref.unused').path).toBe('/refs/1');
    expect('slide' in one(issues, 'ref.unused')).toBe(false);

    const positions = issues.map((i) => (i.slide ? Number(i.path.split('/')[2]) : Infinity));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(issues.at(-1)?.slide).toBeUndefined();
  });

  it('reports a columns count mismatch', () => {
    const lecture = makeLecture([
      {
        id: 's-01',
        type: 'content',
        title: 't',
        blocks: [{ type: 'columns', cols: 3, columns: [[], []] }],
      },
    ]);
    expect(lintLecture(lecture)).toEqual([
      {
        level: 'warn',
        code: 'columns.count',
        path: '/slides/0/blocks/0/columns',
        message: 'columns cols=3인데 열이 2개입니다',
        slide: 's-01',
      },
    ]);
  });

  it('checks budgets inside columns and counts visible text only', () => {
    const lecture = makeLecture([
      {
        id: 's-01',
        type: 'content',
        title: '**굵게** 쓴 제목은 표시되는 글자만 센다 `code`',
        blocks: [
          {
            type: 'columns',
            cols: 2,
            columns: [
              [{ type: 'bullets', items: ['가'.repeat(61)] }],
              [{ type: 'paragraph', text: '나'.repeat(91), lead: true }],
            ],
          },
        ],
      },
    ]);
    expect(lintLecture(lecture).map((i) => [i.code, i.path, i.message])).toEqual([
      [
        'budget.bullets.item',
        '/slides/0/blocks/0/columns/0/0/items/0',
        'bullets[0]: 61자 (허용 60자)',
      ],
      [
        'budget.paragraph.lead',
        '/slides/0/blocks/0/columns/1/0/text',
        'paragraph(lead): 91자 (허용 90자)',
      ],
    ]);
  });

  it('checks table, code and tiles budgets', () => {
    const lecture = makeLecture([
      {
        id: 't',
        type: 'content',
        title: '표',
        blocks: [
          {
            type: 'table',
            head: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
            rows: Array.from({ length: 9 }, () => Array.from({ length: 7 }, () => 'x')),
          },
          {
            type: 'code',
            code: Array.from({ length: 13 }, (_, i) => (i === 4 ? 'y'.repeat(81) : 'x')).join('\n'),
          },
          { type: 'tiles', cols: 2, items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] },
        ],
      },
    ]);
    expect(lintLecture(lecture).map((i) => i.message)).toEqual([
      'table.cols: 7열 (허용 6열)',
      'table.rows: 9행 (허용 8행)',
      'code.lines: 13줄 (허용 12줄)',
      'code.lines[4]: 81자 (허용 80자)',
      'tiles.items(cols=2): 3개 (허용 2개)',
      'slide.dense: 본문 높이 추정 1340px (허용 760px, 76% 초과 · 가장 큰 블록 #1 table 596px)',
    ]);
  });

  it('treats a term followed by a Korean particle as used', () => {
    const lecture = makeLecture(
      [{ id: 's-01', type: 'content', title: 'IAM은 신원 관리다', blocks: [] }],
      { terms: { IAM: 'Identity and Access Management' } },
    );
    expect(lintLecture(lecture)).toEqual([]);
  });

  it('sums note time without a duration as info, and skips it when no slide has time', () => {
    const timed = makeLecture([
      {
        id: 'a',
        type: 'content',
        title: 'a',
        blocks: [],
        note: { time: { minutes: 2.5 }, cues: [] },
      },
      {
        id: 'b',
        type: 'content',
        title: 'b',
        blocks: [],
        note: { time: { minutes: 0.1 }, cues: [] },
      },
    ]);
    expect(lintLecture(timed)).toEqual([
      {
        level: 'info',
        code: 'time.total',
        path: '/slides',
        message: '노트 [시간] 합계 2.6분 (슬라이드 2개 중 2개에 [시간])',
      },
    ]);
    expect(
      lintLecture(makeLecture([{ id: 'a', type: 'content', title: 'a', blocks: [] }])),
    ).toEqual([]);
  });

  it('lints normalized partial input without throwing', () => {
    const lecture = normalizeLecture({ meta: { title: 't' }, slides: [{}, { title: 'b' }] });
    expect(codes(lintLecture(lecture))).toEqual(['slide.title.missing']);
  });
});
