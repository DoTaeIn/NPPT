import { describe, expect, it } from 'vitest';
import { normalizeLecture, validateLecture } from '../src/index.js';
import type { LectureInput } from '../src/index.js';
import { deepFreeze, lectureFixture } from './helpers.js';

const partial = (): LectureInput => ({
  meta: { title: ' 3주차 · 물리보안 ', course: '보안시스템 운영 및 활용', week: 3 },
  slides: [
    { type: 'cover', title: '표지' },
    {
      title: '  기본 원리  ',
      blocks: [
        { type: 'callout', body: ' 본문 ' } as never,
        { type: 'code', code: '  indented\n' },
        { type: 'widget', name: 'abac', params: { label: '  keep  ' } },
      ],
      note: {
        cues: [
          { k: 'SAY', t: ' 하나 ' },
          { k: 'SAY', t: '둘', id: 'auto' },
          { k: 'ASK', t: '셋', id: 'p02-c002' },
          { k: 'NEXT', t: '넷' },
        ],
      },
    },
    { id: 's-04', title: '명시적 id' },
    { type: 'references', note: { raw: '[대사] {{auto}} 참고 자료 안내\n[시간] 1분' } },
  ],
});

describe('normalizeLecture', () => {
  it('applies deck defaults', () => {
    const lecture = normalizeLecture(partial());
    expect(lecture.ir).toBe('0.1');
    expect(lecture.meta).toEqual({
      title: '3주차 · 물리보안',
      course: '보안시스템 운영 및 활용',
      week: 3,
      lang: 'ko',
      theme: 'v20-violet',
      edition: 'instructor',
      footer: '보안시스템 운영 및 활용 · 3주차',
    });
    expect([lecture.refs, lecture.videos, lecture.assets, lecture.terms]).toEqual([[], [], {}, {}]);
  });

  it('keeps explicit meta and skips the footer without course/week', () => {
    const lecture = normalizeLecture({
      meta: { title: 't', lang: 'en', theme: 'cau-navy', edition: 'student' },
      slides: [{ title: 'a' }],
    });
    expect(lecture.meta).toEqual({ title: 't', lang: 'en', theme: 'cau-navy', edition: 'student' });
  });

  it('assigns slide ids by position and defaults type, blocks and references title', () => {
    const { slides } = normalizeLecture(partial());
    expect(slides.map((s) => s.id)).toEqual(['s-01', 's-02', 's-04', 's-04-2']);
    expect(slides.map((s) => s.type)).toEqual(['cover', 'content', 'content', 'references']);
    expect(slides[0]?.blocks).toEqual([]);
    expect(slides[3]?.title).toBe('참고 자료');
    expect(Object.keys(slides[1] ?? {}).slice(0, 2)).toEqual(['id', 'type']);
  });

  it('pads slide ids to two digits and grows naturally past 99', () => {
    const slides = Array.from({ length: 101 }, (_, i) => ({ title: `슬라이드 ${i + 1}` }));
    const ids = normalizeLecture({ meta: { title: 't' }, slides }).slides.map((s) => s.id);
    expect([ids[0], ids[8], ids[9], ids[98], ids[99], ids[100]]).toEqual([
      's-01',
      's-09',
      's-10',
      's-99',
      's-100',
      's-101',
    ]);
  });

  it('assigns cue ids pNN-cKKK by position, skipping ids already taken', () => {
    const { slides } = normalizeLecture(partial());
    expect(slides[1]?.note?.cues.map((c) => c.id)).toEqual([
      'p02-c000',
      'p02-c001',
      'p02-c002',
      'p02-c003',
    ]);
    const clash = normalizeLecture({
      meta: { title: 't' },
      slides: [
        {
          title: 'a',
          note: {
            cues: [
              { k: 'SCREEN', t: 'x' },
              { k: 'SAY', t: 'y', id: 'p01-c000' },
            ],
          },
        },
      ],
    });
    expect(clash.slides[0]?.note?.cues.map((c) => c.id)).toEqual(['p01-c001', 'p01-c000']);
  });

  it('parses note.raw when cues are absent', () => {
    const note = normalizeLecture(partial()).slides[3]?.note;
    expect(note?.time).toEqual({ minutes: 1 });
    expect(note?.cues).toEqual([{ k: 'SAY', t: '참고 자료 안내', id: 'p04-c000' }]);
    expect(note?.raw).toBe('[대사] {{auto}} 참고 자료 안내\n[시간] 1분');
  });

  it('trims strings except code, html, raw and plugin params', () => {
    const blocks = normalizeLecture(partial()).slides[1]?.blocks ?? [];
    expect(blocks[0]).toEqual({ type: 'callout', body: '본문', kind: 'info' });
    expect(blocks[1]).toEqual({ type: 'code', code: '  indented\n' });
    expect(blocks[2]).toEqual({ type: 'widget', name: 'abac', params: { label: '  keep  ' } });
    expect(normalizeLecture(partial()).slides[1]?.note?.cues[0]?.t).toBe('하나');
  });

  it('drops empty URL fields that would fail the uri format', () => {
    const lecture = normalizeLecture({
      meta: { title: 't' },
      refs: [{ id: 'S01', title: 'x', url: ' ' }],
      assets: { campus: { path: 'assets/campus.png', source: '' } },
      slides: [{ title: 'a', refs: ['S01'] }],
    });
    expect(lecture.refs[0]).toEqual({ id: 'S01', title: 'x' });
    expect(lecture.assets.campus).toEqual({ path: 'assets/campus.png' });
  });

  it('is pure: frozen input, new output, input unchanged', () => {
    const input = deepFreeze(partial());
    const before = JSON.stringify(input);
    const output = normalizeLecture(input);
    expect(output).not.toBe(input);
    expect(output.slides[1]).not.toBe(input.slides[1]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('produces a valid lecture from partial input and is idempotent', () => {
    const once = normalizeLecture(partial());
    expect(validateLecture(once)).toMatchObject({ ok: true });
    expect(normalizeLecture(once)).toEqual(once);
    const excerpt = lectureFixture('week03-excerpt.json');
    expect(normalizeLecture(excerpt)).toEqual(excerpt);
  });

  it('keeps unknown properties so validation can report them', () => {
    const lecture = normalizeLecture({
      meta: { title: 't' },
      slides: [{ title: 'a', subtitel: 'x' } as never],
    });
    const result = validateLecture(lecture);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.path).toBe('/slides/0/subtitel');
  });

  it('rejects non-objects', () => {
    expect(() => normalizeLecture(null as never)).toThrow(TypeError);
  });
});
