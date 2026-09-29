import { describe, expect, it } from 'vitest';
import { parseMarco } from '../src/index.js';
import type { Block, Slide } from '../src/ir.js';

const FM = `---
title: 테스트 강의
course: 보안시스템 운영 및 활용
week: 3
---
`;
/** Front matter is 5 lines, so the first body line is line 6. */
const parse = (body: string, fm = FM) => parseMarco(fm + body, { file: 'deck.marco.md' });
const firstSlide = (body: string): Slide => {
  const s = parse(body).lecture.slides[0];
  if (!s) throw new Error('no slide');
  return s;
};
const blocksOf = (body: string): Block[] => firstSlide(`# slide\ntitle: T\n\n${body}`).blocks;
const errors = (body: string, fm = FM) => parse(body, fm).diagnostics.filter((d) => d.level === 'error');
const codes = (body: string, fm = FM) => parse(body, fm).diagnostics.map((d) => d.code);

describe('front matter', () => {
  it('reads meta, refs, videos, assets and terms', () => {
    const { lecture, diagnostics } = parseMarco(
      `---
title: 3주차 · IAM
course: 보안
week: 3
date: 2026-09-29
presenter: 홍길동
theme: cau-navy
edition: student
footer: 사용자 푸터
duration: 90
refs:
  S13: { title: "ISO 27001", url: "https://iso.org", kind: standard }
  S02: 제목만 있는 출처
videos:
  abc123: { title: 영상, start: "1:02:03", credit: 채널 }
assets:
  campus: { path: assets/campus.png, title: 캠퍼스, credit: 학교 }
  logo: assets/logo.png
terms:
  LPR: License Plate Recognition 차량번호 인식
---
# slide
title: A
`,
      { file: 'x.md' },
    );
    expect(diagnostics).toEqual([]);
    expect(lecture.meta).toEqual({
      title: '3주차 · IAM',
      course: '보안',
      week: 3,
      date: '2026-09-29',
      presenter: '홍길동',
      theme: 'cau-navy',
      edition: 'student',
      footer: '사용자 푸터',
      duration: 90,
      lang: 'ko',
    });
    expect(lecture.refs).toEqual([
      { id: 'S13', title: 'ISO 27001', url: 'https://iso.org', kind: 'standard' },
      { id: 'S02', title: '제목만 있는 출처' },
    ]);
    expect(lecture.videos).toEqual([{ id: 'abc123', title: '영상', start: 3723, credit: '채널' }]);
    expect(lecture.assets).toEqual({
      campus: { path: 'assets/campus.png', title: '캠퍼스', credit: '학교' },
      logo: { path: 'assets/logo.png' },
    });
    expect(lecture.terms).toEqual({ LPR: 'License Plate Recognition 차량번호 인식' });
  });

  it('reports a missing title, bad enums and unknown keys with lines', () => {
    const { diagnostics } = parseMarco('---\ncourse: x\ntheme: purple\nfoo: 1\n---\n# slide\ntitle: A\n', { file: 'f.md' });
    expect(diagnostics).toEqual([
      expect.objectContaining({ level: 'warn', code: 'format.frontmatter.unknown', line: 4, file: 'f.md' }),
      expect.objectContaining({ level: 'error', code: 'format.meta.title', line: 2 }),
      expect.objectContaining({ level: 'error', code: 'format.meta.invalid', line: 3 }),
    ]);
  });

  it('reports YAML syntax errors at their line', () => {
    const d = errors('# slide\ntitle: A\n', '---\ntitle: A\nrefs: [unclosed\n---\n');
    expect(d[0]).toMatchObject({ code: 'format.frontmatter.yaml', line: 3 });
  });

  it('requires front matter and at least one slide', () => {
    expect(parseMarco('# slide\ntitle: A\n').diagnostics.map((d) => d.code)).toContain('format.frontmatter.missing');
    expect(codes('')).toContain('format.slide.none');
  });
});

describe('slide header', () => {
  it('parses type, alert and key=value tokens', () => {
    const s = firstSlide('# slide hero alert id=intro tag=도입\ntitle: 질문\n');
    expect(s).toMatchObject({ id: 'intro', type: 'hero', alert: true, tag: '도입', title: '질문' });
  });

  it('defaults ids to s-NN by position and type to content', () => {
    const { lecture } = parse('# slide\ntitle: A\n\n# slide divider\ntitle: B\n\n# slide id=x\ntitle: C\n');
    expect(lecture.slides.map((s) => [s.id, s.type])).toEqual([
      ['s-01', 'content'],
      ['s-02', 'divider'],
      ['x', 'content'],
    ]);
  });

  it('rejects unknown tokens with file:line and a hint', () => {
    const d = errors('# slide\ntitle: A\n\n# slide hreo\ntitle: B\n');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: 'format.slide.token', line: 9, file: 'deck.marco.md', slide: 's-02' });
    expect(d[0]?.message).toContain("'hero'");
  });

  it('rejects two types, bad ids and malformed headers', () => {
    expect(codes('# slide cover divider\ntitle: A\n')).toContain('format.slide.token');
    expect(codes('# slide id=1abc\ntitle: A\n')).toContain('format.slide.id');
    expect(codes('# slide\ntitle: A\n\n# Slide\ntitle: B\n')).toContain('format.slide.header');
  });

  it('does not split slides inside fenced code', () => {
    const { lecture } = parse('# slide\ntitle: A\n\n```md\n# slide\ntitle: not a slide\n```\n');
    expect(lecture.slides).toHaveLength(1);
    expect(lecture.slides[0]?.blocks[0]).toEqual({ type: 'code', lang: 'md', code: '# slide\ntitle: not a slide' });
  });

  it('reports content before the first slide', () => {
    expect(errors('stray text\n# slide\ntitle: A\n')[0]).toMatchObject({ code: 'format.slide.orphan', line: 6 });
  });
});

describe('slide fields', () => {
  it('reads all fields until the first blank line', () => {
    const s = firstSlide(`# slide
title: 인증: 인가는 다르다
tag: 기본 원리
group: 1부
question: "왜 다를까?"
subtitle: 부제
refs: [S13, S14]
layout: wide
time: 2.5분 · 10:00 – 12:30

본문 문단
`);
    expect(s).toMatchObject({
      title: '인증: 인가는 다르다',
      tag: '기본 원리',
      group: '1부',
      question: '왜 다를까?',
      subtitle: '부제',
      refs: ['S13', 'S14'],
      layout: 'wide',
      note: { cues: [], time: { minutes: 2.5, from: '10:00', to: '12:30' } },
      blocks: [{ type: 'paragraph', text: '본문 문단' }],
    });
  });

  it('keeps leading zeros and reads type-specific fields', () => {
    const { lecture } = parse(
      '# slide divider\nno: 01\ntitle: 1부\n\n# slide quote\ntitle: 인용문\ncite: 누군가\n\n# slide references\nonly: [S1, S2]\n',
    );
    expect(lecture.slides.map((s) => [s.no, s.cite, s.only, s.title])).toEqual([
      ['01', undefined, undefined, '1부'],
      [undefined, '누군가', undefined, '인용문'],
      [undefined, undefined, ['S1', 'S2'], '참고 자료'],
    ]);
  });

  it('parses a note: | block scalar', () => {
    const s = firstSlide('# slide\ntitle: A\nnote: |\n  [대사] 안녕하세요.\n\n  [발문] 질문? | 10초\n\n본문\n');
    expect(s.note?.cues).toEqual([
      expect.objectContaining({ k: 'SAY', t: '안녕하세요.' }),
      expect.objectContaining({ k: 'ASK', t: '질문?', wait: '10초' }),
    ]);
    expect(s.blocks).toEqual([{ type: 'paragraph', text: '본문' }]);
  });

  it('reports unknown fields at their line', () => {
    const d = errors('# slide\ntitle: A\ntittle: B\n');
    expect(d).toEqual([expect.objectContaining({ code: 'format.field.unknown', line: 8, slide: 's-01' })]);
  });

  it('requires a title except on references and cover slides', () => {
    expect(errors('# slide\n\n본문\n')[0]).toMatchObject({ code: 'format.field.title', line: 6 });
    expect(firstSlide('# slide cover\n').title).toBe('테스트 강의');
    expect(errors('# slide references\n')).toEqual([]);
  });

  it('reports an invalid time', () => {
    expect(codes('# slide\ntitle: A\ntime: 곧\n')).toContain('format.field.time');
  });
});

describe('notes', () => {
  it('parses a ## note section and keeps the raw text', () => {
    const s = firstSlide(`# slide
title: A

본문

## note
[시간] 2.5분 · 10:00 – 12:30
[화면] 표와 카드.
[대사] {{p01-c007}} 사실부터 모읍니다.
[주목] @s-01-b1 표를 짚는다.
`);
    expect(s.blocks).toEqual([{ type: 'paragraph', text: '본문' }]);
    expect(s.note?.time).toEqual({ minutes: 2.5, from: '10:00', to: '12:30' });
    expect(s.note?.cues.map((c) => c.k)).toEqual(['SCREEN', 'SAY', 'LOOK']);
    expect(s.note?.cues[1]?.id).toBe('p01-c007');
    expect(s.note?.cues[2]?.focus).toEqual({ targets: ['s-01-b1'] });
    expect(s.note?.raw).toContain('[화면] 표와 카드.');
  });

  it('ends the note at the next slide', () => {
    const { lecture } = parse('# slide\ntitle: A\n\n## note\n[대사] 하나\n# slide\ntitle: B\n\n본문 B\n');
    expect(lecture.slides[0]?.note?.cues).toHaveLength(1);
    expect(lecture.slides[1]?.blocks).toEqual([{ type: 'paragraph', text: '본문 B' }]);
  });

  it('accepts a PLAN-style trailing note: | with a warning', () => {
    const { lecture, diagnostics } = parse('# slide\ntitle: A\n\n본문\n\nnote: |\n  [대사] 뒤에 쓴 노트\n');
    expect(lecture.slides[0]?.note?.cues[0]).toMatchObject({ k: 'SAY', t: '뒤에 쓴 노트' });
    expect(diagnostics.map((d) => d.code)).toEqual(['format.note.position']);
  });
});

describe('markdown body', () => {
  it('maps paragraphs, lead headings, bullets and ordered steps', () => {
    expect(
      blocksOf(`### 핵심 문장
첫 줄
이어지는 줄

- 하나
- **둘**

1. **자격 제시** 카드를 댄다
2. **인증** — 확인한다
3. 제목만
`),
    ).toEqual([
      { type: 'paragraph', text: '핵심 문장', lead: true },
      { type: 'paragraph', text: '첫 줄 이어지는 줄' },
      { type: 'bullets', items: ['하나', '**둘**'] },
      {
        type: 'steps',
        items: [{ title: '자격 제시', body: '카드를 댄다' }, { title: '인증', body: '확인한다' }, { title: '제목만' }],
      },
    ]);
  });

  it('maps GFM tables with alignment', () => {
    expect(blocksOf('| 구역 | 대상 | 역할 |\n|:--|:-:|--:|\n| a | b | c |\n')).toEqual([
      { type: 'table', head: ['구역', '대상', '역할'], rows: [['a', 'b', 'c']], align: ['l', 'c', 'r'] },
    ]);
    expect(blocksOf('| a | b |\n|---|---|\n| 1 | 2 |\n')[0]).not.toHaveProperty('align');
  });

  it('maps quotes with a cite line and fenced code with a title', () => {
    expect(blocksOf('> 첫 줄\n> 둘째 줄\n> — 출처\n\n```bash title="설치 예"\nnpm i\n```\n')).toEqual([
      { type: 'quote', text: '첫 줄 둘째 줄', cite: '출처' },
      { type: 'code', lang: 'bash', title: '설치 예', code: 'npm i' },
    ]);
  });

  it('turns a sole image paragraph into an image block with an auto asset id', () => {
    const { lecture } = parse('# slide\ntitle: A\n\n![캠퍼스 전경](<assets/Campus Map.png> "캡션")\n\n![](assets/campus-map.jpg)\n');
    expect(lecture.slides[0]?.blocks).toEqual([
      { type: 'image', asset: 'campus-map', caption: '캡션' },
      { type: 'image', asset: 'campus-map-2' },
    ]);
    expect(lecture.assets).toEqual({
      'campus-map': { path: 'assets/Campus Map.png', alt: '캠퍼스 전경' },
      'campus-map-2': { path: 'assets/campus-map.jpg' },
    });
  });

  it('reuses front-matter assets by id or path', () => {
    const fm = `---\ntitle: T\nassets:\n  campus: { path: assets/campus.png }\n---\n`;
    const { lecture, diagnostics } = parse('# slide\ntitle: A\n\n![a](assets/campus.png)\n\n![b](campus)\n', fm);
    expect(diagnostics).toEqual([]);
    expect(lecture.slides[0]?.blocks).toEqual([
      { type: 'image', asset: 'campus' },
      { type: 'image', asset: 'campus' },
    ]);
    expect(lecture.assets.campus).toEqual({ path: 'assets/campus.png', alt: 'a' });
  });

  it('rejects # and ## headings in a body', () => {
    expect(errors('# slide\ntitle: A\n\n## 소제목\n')[0]).toMatchObject({ code: 'format.heading.level', line: 9 });
  });
});

describe('containers', () => {
  it('chain: pipe rows with explicit, omitted and inferred numbers', () => {
    expect(blocksOf(':::chain\n01 | 자격 제시 | 카드를 댄다\n인증 | 확인\n03 | 인가\n실제 통과\n:::\n')).toEqual([
      {
        type: 'chain',
        items: [
          { no: '01', label: '자격 제시', sub: '카드를 댄다' },
          { label: '인증', sub: '확인' },
          { no: '03', label: '인가' },
          { label: '실제 통과' },
        ],
      },
    ]);
  });

  it('cards: YAML items with colons, continuation lines, tone and icon', () => {
    expect(
      blocksOf(`:::cards cols=3
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 예: 문센서와 통과 감지는
    별도로 확인한다.
  tone: warn
  icon: shield
- title: "따옴표: 제목"
:::`),
    ).toEqual([
      {
        type: 'cards',
        cols: 3,
        items: [
          {
            kicker: '허용됐지만 안 들어감',
            title: '허용 신호 ≠ 실제 입실',
            body: '예: 문센서와 통과 감지는 별도로 확인한다.',
            icon: 'shield',
            tone: 'warn',
          },
          { title: '따옴표: 제목' },
        ],
      },
    ]);
  });

  it('cards: cols default from the item count; invalid cols and tone are errors', () => {
    const cols = (n: number) =>
      (blocksOf(`:::cards\n${Array.from({ length: n }, (_, i) => `- title: 카드 ${i}`).join('\n')}\n:::\n`)[0] as { cols: number }).cols;
    expect([1, 2, 3, 4, 5, 6, 7].map(cols)).toEqual([2, 2, 3, 2, 3, 3, 4]);
    expect(codes('# slide\ntitle: T\n\n:::cards cols=5\n- title: a\n:::\n')).toContain('format.attr.invalid');
    expect(errors('# slide\ntitle: T\n\n:::cards\n- title: a\n  tone: pink\n:::\n')[0]).toMatchObject({ code: 'format.item.tone', line: 10 });
  });

  it('cards: pipe rows map kicker | title | body', () => {
    expect(blocksOf(':::cards\n키커 | 제목 | 본문\n제목만\n:::\n')).toEqual([
      { type: 'cards', cols: 2, items: [{ kicker: '키커', title: '제목', body: '본문' }, { title: '제목만' }] },
    ]);
  });

  it('takeaway, callout and verdict read a positional label', () => {
    expect(
      blocksOf(`:::takeaway 핵심 구분
인증은 자격 확인,
인가는 허용 판단이다.
:::

:::callout warn 정전 시 주의
UPS가 락에 전원을 공급한다.
:::

:::callout
기본 종류는 info.
:::

:::verdict allow 통과
조건을 모두 만족한다.
:::

:::verdict hot
주의가 필요하다.
:::`),
    ).toEqual([
      { type: 'takeaway', label: '핵심 구분', text: '인증은 자격 확인, 인가는 허용 판단이다.' },
      { type: 'callout', kind: 'warn', title: '정전 시 주의', body: 'UPS가 락에 전원을 공급한다.' },
      { type: 'callout', kind: 'info', body: '기본 종류는 info.' },
      { type: 'verdict', verdict: 'allow', label: '통과', text: '조건을 모두 만족한다.' },
      { type: 'verdict', verdict: 'hot', text: '주의가 필요하다.' },
    ]);
  });

  it('verdict needs a kind; text containers need text', () => {
    expect(codes('# slide\ntitle: T\n\n:::verdict\n텍스트\n:::\n')).toContain('format.attr.invalid');
    expect(codes('# slide\ntitle: T\n\n:::takeaway 라벨\n:::\n')).toContain('format.container.empty');
  });

  it('table wraps one GFM table and adds a caption', () => {
    expect(blocksOf(':::table caption="표 1 · 구역"\n| a | b |\n|---|---|\n| 1 | 2 |\n:::\n')).toEqual([
      { type: 'table', head: ['a', 'b'], rows: [['1', '2']], caption: '표 1 · 구역' },
    ]);
    expect(codes('# slide\ntitle: T\n\n:::table\n그냥 문단\n:::\n')).toContain('format.table.missing');
  });

  it('compare reads quoted attributes and pipe rows', () => {
    expect(blocksOf(':::compare left="스피드게이트" right=맨트랩\n작동 | 통로를 연다 | 두 문 사이\n:::\n')).toEqual([
      {
        type: 'compare',
        left: '스피드게이트',
        right: '맨트랩',
        rows: [{ label: '작동', left: '통로를 연다', right: '두 문 사이' }],
      },
    ]);
    expect(codes('# slide\ntitle: T\n\n:::compare\na | b | c\n:::\n')).toContain('format.attr.missing');
  });

  it('steps accepts YAML items and pipe rows', () => {
    expect(blocksOf(':::steps\n- title: 인사 종료\n  body: 기준일\n- title: 회수\n:::\n\n:::steps\n확인 | 현장에서\n:::\n')).toEqual([
      { type: 'steps', items: [{ title: '인사 종료', body: '기준일' }, { title: '회수' }] },
      { type: 'steps', items: [{ title: '확인', body: '현장에서' }] },
    ]);
  });

  it('columns nest blocks one level deep inside :::col', () => {
    expect(
      blocksOf(`:::columns cols=2
:::col
- 왼쪽 항목

:::takeaway 요점
왼쪽 결론
:::
:::
:::col
오른쪽 문단
:::
:::`),
    ).toEqual([
      {
        type: 'columns',
        cols: 2,
        columns: [
          [
            { type: 'bullets', items: ['왼쪽 항목'] },
            { type: 'takeaway', label: '요점', text: '왼쪽 결론' },
          ],
          [{ type: 'paragraph', text: '오른쪽 문단' }],
        ],
      },
    ]);
  });

  it('columns reject deeper nesting, stray cols and other containers inside', () => {
    expect(codes('# slide\ntitle: T\n\n:::col\nx\n:::\n')).toContain('format.container.nesting');
    expect(codes('# slide\ntitle: T\n\n:::takeaway\n:::cards\n- title: a\n:::\n:::\n')).toContain('format.container.nesting');
    expect(codes('# slide\ntitle: T\n\n:::columns\n:::col\n:::columns\n:::\n:::\n:::\n')).toContain('format.container.nesting');
    expect(codes('# slide\ntitle: T\n\n:::columns\n:::col\n하나\n:::\n:::\n')).toContain('format.columns.count');
  });

  it('image container reads asset, caption, zoom, fit and height', () => {
    const fm = `---\ntitle: T\nassets:\n  campus: { path: assets/campus.png }\n---\n`;
    const s = parse('# slide\ntitle: A\n\n:::image asset=campus caption="전경" zoom fit=cover height=520px\n:::\n', fm).lecture.slides[0];
    expect(s?.blocks).toEqual([{ type: 'image', asset: 'campus', caption: '전경', zoom: true, fit: 'cover', height: 520 }]);
  });

  it('video reads start as seconds or mm:ss and registers unknown videos', () => {
    const { lecture } = parse('# slide\ntitle: A\n\n:::video id=XyZ_123 start=07:21 label="시연" caption="설명"\n:::\n');
    expect(lecture.slides[0]?.blocks).toEqual([{ type: 'video', video: 'XyZ_123', start: 441, label: '시연', caption: '설명' }]);
    expect(lecture.videos).toEqual([{ id: 'XyZ_123', title: '시연', start: 441 }]);
  });

  it('pills accept tone shorthand, plain items and pipe rows', () => {
    expect(blocksOf(':::pills\n- ok: 인증 성공\n- 동반 통과\n- Note: 콜론이 있는 문장\n:::\n\n:::pills\nwarn | 주의\n그냥\n:::\n')).toEqual([
      { type: 'pills', items: [{ tone: 'ok', text: '인증 성공' }, { text: '동반 통과' }, { text: 'Note: 콜론이 있는 문장' }] },
      { type: 'pills', items: [{ tone: 'warn', text: '주의' }, { text: '그냥' }] },
    ]);
  });

  it('timeline, tiles and terms', () => {
    const { lecture } = parse(`# slide
title: A

:::timeline
09:00 | 퇴사 확정 | 인사 반영
09:10 | 권한 회수
:::

:::tiles cols=3
- icon: id-card
  label: 소유
  value: 카드
  tone: primary
shield | 지식 | PIN
:::

:::terms
LPR | License Plate Recognition | 차량번호 인식
PIN | 개인 식별 번호
:::
`);
    const [timeline, tiles, terms] = lecture.slides[0]?.blocks ?? [];
    expect(timeline).toEqual({
      type: 'timeline',
      items: [
        { at: '09:00', title: '퇴사 확정', body: '인사 반영' },
        { at: '09:10', title: '권한 회수' },
      ],
    });
    // Mixed YAML/pipe content is an item syntax error; the YAML part still parses.
    expect(tiles).toMatchObject({ type: 'tiles', cols: 3 });
    expect(terms).toEqual({
      type: 'terms',
      items: [
        { abbr: 'LPR', en: 'License Plate Recognition', ko: '차량번호 인식' },
        { abbr: 'PIN', ko: '개인 식별 번호' },
      ],
    });
    expect(lecture.terms).toEqual({ LPR: 'License Plate Recognition 차량번호 인식', PIN: '개인 식별 번호' });
  });

  it('widget reads a name, typed params and a YAML body', () => {
    expect(blocksOf(':::widget abac role=engineer level=3 label="a b" strict\nrules:\n  - allow\n:::\n')).toEqual([
      { type: 'widget', name: 'abac', params: { role: 'engineer', level: 3, label: 'a b', strict: true, rules: ['allow'] } },
    ]);
  });

  it('html keeps its body verbatim', () => {
    expect(blocksOf(':::html\n<div class="x">\n  <b>굵게</b>\n</div>\n:::\n')).toEqual([
      { type: 'html', html: '<div class="x">\n  <b>굵게</b>\n</div>' },
    ]);
  });

  it('raw slides keep their body as HTML', () => {
    const s = firstSlide('# slide raw\ntitle: 직접\n\n<div class="slide-wrapper">x</div>\n\n## note\n[대사] 노트\n');
    expect(s.html).toBe('<div class="slide-wrapper">x</div>');
    expect(s.blocks).toEqual([]);
    expect(s.note?.cues).toHaveLength(1);
  });
});

describe('container errors carry file:line', () => {
  it('unknown container with a suggestion', () => {
    const d = errors('# slide\ntitle: A\n\n:::card\n- title: x\n:::\n');
    expect(d).toEqual([expect.objectContaining({ code: 'format.container.unknown', line: 9, file: 'deck.marco.md', slide: 's-01' })]);
    expect(d[0]?.message).toContain(':::cards');
  });

  it('unclosed containers and stray closers', () => {
    expect(errors('# slide\ntitle: A\n\n:::takeaway\n텍스트\n')[0]).toMatchObject({ code: 'format.container.unclosed', line: 9 });
    expect(errors('# slide\ntitle: A\n\n본문\n:::\n')[0]).toMatchObject({ code: 'format.container.stray', line: 10 });
  });

  it('item syntax and cell count errors point at the item line', () => {
    expect(errors('# slide\ntitle: A\n\n:::cards\n- title: a\nbroken\n:::\n')[0]).toMatchObject({ code: 'format.item.syntax', line: 11 });
    expect(errors('# slide\ntitle: A\n\n:::compare left=a right=b\n\n하나 | 둘 | 셋 | 넷\n:::\n')[0]).toMatchObject({
      code: 'format.item.cells',
      line: 11,
    });
    expect(errors('# slide\ntitle: A\n\n:::cards\n- kicker: 제목 없음\n:::\n')[0]).toMatchObject({ code: 'format.item.missing', line: 10 });
  });

  it('normalises CRLF input', () => {
    const { lecture, diagnostics } = parseMarco('---\r\ntitle: T\r\n---\r\n# slide\r\ntitle: A\r\n\r\n:::chain\r\n01 | 하나\r\n:::\r\n');
    expect(diagnostics).toEqual([]);
    expect(lecture.slides[0]?.blocks).toEqual([{ type: 'chain', items: [{ no: '01', label: '하나' }] }]);
  });
});
