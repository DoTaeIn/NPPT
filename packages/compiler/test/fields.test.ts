import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { compile, mergeNoteTime, parseMarco, processAssets, usedAssetIds } from '../src/index.js';
import type { Slide } from '../src/ir.js';

const PNG = fileURLToPath(new URL('./fixtures/assets/diagram.png', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'marco-fields-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const FM = `---
title: 테스트 강의
course: 보안시스템 운영 및 활용
week: 3
assets:
  cover-art: { path: assets/cover.png, alt: 출입문 일러스트 }
---
`;
/** Front matter is 7 lines, so the first body line is line 8. */
const parse = (body: string) => parseMarco(FM + body, { file: 'deck.marco.md' });
const slide = (body: string): Slide => {
  const s = parse(body).lecture.slides[0];
  if (!s) throw new Error('no slide');
  return s;
};
const codes = (body: string) => parse(body).diagnostics.map((d) => `${d.level}:${d.code}`);

describe('cover / hero / divider fields (format.md §4)', () => {
  it('maps kicker, tagline, meta, art and toc to the IR', () => {
    const s = slide(`# slide cover dark
title: 문을 여는 기술, 권한을 다루는 설계.
kicker: 보안시스템 운영 및 활용 · 3주차
tagline: PHYSICAL ACCESS × IDENTITY
subtitle: 장비가 어떻게 문을 제어하는지 이해한다.
meta: [2026학년도 2학기 · 5주차, 중앙대학교 산업보안학과]
art: cover-art
toc: 물리보안 · 출입통제 IAM
group: 표지 · 도입

:::pills
- ok: 인증
- warn: 인가
:::
`);
    expect(s).toEqual({
      id: 's-01',
      type: 'cover',
      title: '문을 여는 기술, 권한을 다루는 설계.',
      blocks: [
        {
          type: 'pills',
          items: [
            { tone: 'ok', text: '인증' },
            { tone: 'warn', text: '인가' },
          ],
        },
      ],
      dark: true,
      subtitle: '장비가 어떻게 문을 제어하는지 이해한다.',
      group: '표지 · 도입',
      kicker: '보안시스템 운영 및 활용 · 3주차',
      tagline: 'PHYSICAL ACCESS × IDENTITY',
      toc: '물리보안 · 출입통제 IAM',
      meta: ['2026학년도 2학기 · 5주차', '중앙대학교 산업보안학과'],
      art: 'cover-art',
    });
    // Cover body blocks are allowed now: no `format.body.ignored`.
    expect(parse(`# slide cover\ntitle: T\n\n본문 문단\n`).diagnostics).toEqual([]);
    expect(parse(`# slide divider\ntitle: T\n\n본문 문단\n`).diagnostics).toEqual([]);
  });

  it('reads meta as a flow list, a YAML block list, or a comma / · separated string', () => {
    const meta = (field: string) => slide(`# slide cover\ntitle: T\n${field}\n`).meta;
    expect(meta('meta: [a, "b, c", 3]')).toEqual(['a', 'b, c', '3']);
    expect(meta('meta:\n  - 2026학년도 2학기 · 5주차\n  - "중앙대학교, 산업보안학과"')).toEqual([
      '2026학년도 2학기 · 5주차',
      '중앙대학교, 산업보안학과',
    ]);
    expect(meta('meta: 2026학년도 2학기 · 5주차, 중앙대학교')).toEqual([
      '2026학년도 2학기 · 5주차',
      '중앙대학교',
    ]);
    expect(meta('meta: 2026-09-29 · 홍길동 · Curriculum v3')).toEqual([
      '2026-09-29',
      '홍길동',
      'Curriculum v3',
    ]);
    // An explicit empty list / kicker turns the cover defaults off and is kept.
    expect(meta('meta: []')).toEqual([]);
    expect(slide('# slide cover\ntitle: T\nkicker: ""\n').kicker).toBe('');
  });

  it('a block list after the fields does not swallow the body', () => {
    const s = slide(`# slide hero
title: T
meta:
  - 한 줄
  - 두 줄
refs:
  - S1
  - S2

- 본문 글머리
`);
    expect(s.meta).toEqual(['한 줄', '두 줄']);
    expect(s.refs).toEqual(['S1', 'S2']);
    expect(s.blocks).toEqual([{ type: 'bullets', items: ['본문 글머리'] }]);
  });

  it('art takes an asset id or registers a path like an image block', () => {
    const { lecture, diagnostics } = parse(`# slide cover
title: T
art: assets/Door Art.png

# slide hero art=cover-art
title: H

# slide divider
title: D
art: nope
`);
    expect(lecture.slides.map((s) => s.art)).toEqual(['door-art', 'cover-art', 'nope']);
    expect(lecture.assets['door-art']).toEqual({ path: 'assets/Door Art.png' });
    expect(diagnostics).toEqual([
      expect.objectContaining({ level: 'error', code: 'format.asset.unknown', line: 17 }),
    ]);
  });

  it('toc works on every slide type; title-slide fields warn elsewhere', () => {
    const { lecture, diagnostics } = parse(`# slide
title: 긴 제목
toc: 짧은 목차

# slide
title: B
kicker: 내용 슬라이드에는 없음
tagline: 없음
`);
    expect(lecture.slides[0]?.toc).toBe('짧은 목차');
    expect(diagnostics.map((d) => `${d.code}@${d.line}`)).toEqual([
      'format.field.type@14',
      'format.field.type@15',
    ]);
  });

  it('dark is a header flag for cover / hero / divider', () => {
    expect(slide('# slide hero dark alert\ntitle: T\n')).toMatchObject({
      type: 'hero',
      dark: true,
      alert: true,
    });
    expect(slide('# slide divider dark\ntitle: T\n').dark).toBe(true);
    // alert: hero and divider (red-toned variant).
    expect(codes('# slide divider alert\ntitle: T\n')).toEqual([]);
    expect(codes('# slide cover alert\ntitle: T\n')).toEqual(['warn:format.slide.alert']);
    expect(codes('# slide dark\ntitle: T\n')).toEqual(['warn:format.slide.dark']);
    expect(codes('# slide cover darkk\ntitle: T\n')).toEqual(['error:format.slide.token']);
    expect(parse('# slide cover darkk\ntitle: T\n').diagnostics[0]?.message).toContain("'dark'");
  });
});

describe('time: field and [시간] cue', () => {
  const noteTime = (body: string) => {
    const r = parse(body);
    return { time: r.lecture.slides[0]?.note?.time, codes: r.diagnostics.map((d) => d.code) };
  };

  it('keeps the richer [시간] value when the minutes match (no warning)', () => {
    expect(
      noteTime('# slide\ntitle: T\ntime: 2.5분\n\n## note\n[시간] 2.5분 · 10:00 – 12:30\n'),
    ).toEqual({
      time: { minutes: 2.5, from: '10:00', to: '12:30' },
      codes: [],
    });
    // The richer side can also be the field.
    expect(
      noteTime('# slide\ntitle: T\ntime: 2.5분 · 10:00 – 12:30\n\n## note\n[시간] 2.5분\n'),
    ).toEqual({ time: { minutes: 2.5, from: '10:00', to: '12:30' }, codes: [] });
    expect(
      noteTime('# slide\ntitle: T\ntime: 2분 · 0:00 – 2:00\n\n## note\n[시간] 2분 · 0:00 – 2:00\n'),
    ).toEqual({ time: { minutes: 2, from: '0:00', to: '2:00' }, codes: [] });
  });

  it('warns and uses time: when they conflict', () => {
    expect(
      noteTime('# slide\ntitle: T\ntime: 3분\n\n## note\n[시간] 2.5분 · 10:00 – 12:30\n'),
    ).toEqual({
      time: { minutes: 3 },
      codes: ['format.note.time'],
    });
    expect(
      noteTime('# slide\ntitle: T\ntime: 2분 · 0:00 – 2:00\n\n## note\n[시간] 2분 · 1:00 – 3:00\n'),
    ).toEqual({ time: { minutes: 2, from: '0:00', to: '2:00' }, codes: ['format.note.time'] });
  });

  it('mergeNoteTime', () => {
    expect(mergeNoteTime({ minutes: 2 }, { minutes: 2, remark: '실습' })).toEqual({
      minutes: 2,
      remark: '실습',
    });
    expect(mergeNoteTime({ minutes: 2, remark: 'a' }, { minutes: 2, remark: 'b' })).toBeUndefined();
    expect(mergeNoteTime({ minutes: 2 }, { minutes: 1 })).toBeUndefined();
  });
});

describe('compile with the title-slide fields', () => {
  it('validates against @marco/schema and embeds the art asset', async () => {
    const dir = join(tmp, 'cover');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    copyFileSync(PNG, join(dir, 'assets', 'cover.png'));
    const source = join(dir, 'lecture.marco.md');
    writeFileSync(
      source,
      `${FM}# slide cover dark
title: 문을 여는 기술, 권한을 다루는 설계.
kicker: 보안시스템 운영 및 활용 · 3주차
tagline: PHYSICAL ACCESS × IDENTITY
meta: [2026학년도 2학기, 중앙대학교 산업보안학과]
art: cover-art
toc: 표지

:::pills
- 인증
- 인가
:::

# slide hero
title: 들어가도 되는가?
art: assets/cover.png
`,
    );
    const r = await compile(source, { fonts: 'none', useSharp: false });
    expect(r.diagnostics).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.lecture.slides[0]).toMatchObject({
      dark: true,
      kicker: '보안시스템 운영 및 활용 · 3주차',
      tagline: 'PHYSICAL ACCESS × IDENTITY',
      meta: ['2026학년도 2학기', '중앙대학교 산업보안학과'],
      art: 'cover-art',
      toc: '표지',
    });
    // The path is already registered in the front matter, so the hero reuses that id.
    expect(r.lecture.slides[1]?.art).toBe('cover-art');
    expect(usedAssetIds(r.lecture)).toEqual(['cover-art']);
    const assets = await processAssets(r.lecture, { baseDir: dir, useSharp: false });
    expect(assets.data['cover-art']?.src).toMatch(/^data:image\/png;base64,/);
    expect(assets.warnings).toEqual([]);
  });
});
