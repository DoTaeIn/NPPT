import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { lectureSchema, normalizeLecture, validateLecture } from '../src/index.js';
import type { LectureInput, Slide } from '../src/index.js';
import { coverKicker, coverMeta } from '../src/normalize.js';
import { deepFreeze, makeLecture } from './helpers.js';

const schemaFile = JSON.parse(
  readFileSync(new URL('../lecture.schema.json', import.meta.url), 'utf8'),
) as { $defs: { Slide: { properties: Record<string, { type?: string }> } } };

const cover: Slide = {
  id: 's-01',
  type: 'cover',
  title: '문을 여는 기술, 권한을 다루는 설계.',
  toc: '물리보안 · 출입통제 IAM',
  kicker: '보안시스템 운영 및 활용 · 3주차',
  tagline: 'PHYSICAL ACCESS × IDENTITY',
  subtitle: '장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.',
  meta: ['중앙대학교 산업보안학과', 'Curriculum v3 · V20'],
  art: 'campus',
  blocks: [{ type: 'pills', items: [{ text: '인증 · 통신 · 피난 · 권한' }] }],
};

describe('cover / hero / divider fields (components.md §1)', () => {
  it('are optional Slide properties in lecture.schema.json', () => {
    const props = schemaFile.$defs.Slide.properties;
    expect(props.kicker?.type).toBe('string');
    expect(props.tagline?.type).toBe('string');
    expect(props.meta?.type).toBe('array');
    expect(props.art?.type).toBe('string');
    expect(props.toc?.type).toBe('string');
    expect(props.dark?.type).toBe('boolean');
    const required = (lectureSchema.$defs as Record<string, { required?: string[] }>).Slide
      ?.required;
    expect(required).toEqual(['id', 'type', 'title', 'blocks']);
  });

  it('validate on cover, hero and divider slides', () => {
    const lecture = makeLecture(
      [
        cover,
        {
          id: 's-02',
          type: 'hero',
          alert: true,
          dark: true,
          title: '방화벽 운영 및 실무',
          tag: 'WEEK 05',
          meta: ['2026학년도 2학기 · 5주차', '중앙대학교 산업보안학과'],
          question: '방화벽은 무엇을 기억해야 할까?',
          art: 'campus',
          blocks: [],
        },
        { id: 's-03', type: 'divider', no: '01', kicker: '1부', title: '인증', blocks: [] },
        { id: 's-04', type: 'content', title: '긴 제목', toc: '짧은 제목', blocks: [] },
      ],
      { assets: { campus: { path: 'assets/campus.png' } } },
    );
    expect(validateLecture(lecture)).toMatchObject({ ok: true });
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormatsModule.default(ajv, ['uri']);
    expect(ajv.compile(schemaFile)(lecture)).toBe(true);
  });

  it('reject wrong shapes', () => {
    const bad = (extra: Record<string, unknown>) =>
      validateLecture(makeLecture([{ ...cover, ...extra } as Slide]));
    for (const extra of [
      { meta: '중앙대학교' },
      { meta: [1] },
      { dark: 'yes' },
      { art: '' },
      { kicker: 3 },
      { toc: false },
    ]) {
      const result = bad(extra);
      expect(result.ok, JSON.stringify(extra)).toBe(false);
    }
  });
});

describe('cover defaults', () => {
  it('coverKicker: course · week주차, either part alone, or nothing', () => {
    expect(coverKicker({ course: '보안시스템 운영 및 활용', week: 3 })).toBe(
      '보안시스템 운영 및 활용 · 3주차',
    );
    expect(coverKicker({ course: '보안시스템' })).toBe('보안시스템');
    expect(coverKicker({ week: 0 })).toBe('0주차');
    expect(coverKicker({ course: ' ' })).toBeUndefined();
    expect(coverKicker({})).toBeUndefined();
  });

  it('coverMeta: [date, presenter] without the missing ones', () => {
    expect(coverMeta({ date: '2026-09-29', presenter: '홍길동' })).toEqual([
      '2026-09-29',
      '홍길동',
    ]);
    expect(coverMeta({ presenter: '홍길동' })).toEqual(['홍길동']);
    expect(coverMeta({ date: '' })).toBeUndefined();
  });

  const input = (): LectureInput => ({
    meta: { title: 't', course: '보안시스템 운영 및 활용', week: 3, date: '2026-09-29' },
    slides: [
      { type: 'cover', title: '표지' },
      { type: 'cover', title: '명시', kicker: '', meta: [] },
      { type: 'hero', title: '히어로' },
      { type: 'divider', title: '간지' },
    ],
  });

  it('are not written into the IR by default', () => {
    const { slides } = normalizeLecture(input());
    for (const slide of slides) {
      expect(slide.kicker === undefined || slide.kicker === '').toBe(true);
      expect(slide.meta === undefined || slide.meta.length === 0).toBe(true);
    }
  });

  it('fill absent cover kicker/meta with { coverDefaults: true }, keeping explicit values', () => {
    const frozen = deepFreeze(input());
    const before = JSON.stringify(frozen);
    const lecture = normalizeLecture(frozen, { coverDefaults: true });
    expect(JSON.stringify(frozen)).toBe(before);
    const [first, explicit, hero, divider] = lecture.slides;
    expect(first?.kicker).toBe('보안시스템 운영 및 활용 · 3주차');
    expect(first?.meta).toEqual(['2026-09-29']);
    expect(explicit?.kicker).toBe('');
    expect(explicit?.meta).toEqual([]);
    expect(hero?.kicker).toBeUndefined();
    expect(divider?.meta).toBeUndefined();
    expect(validateLecture(lecture)).toMatchObject({ ok: true });
    expect(normalizeLecture(lecture, { coverDefaults: true })).toEqual(lecture);
  });

  it('add nothing when the deck has no course, week, date or presenter', () => {
    const lecture = normalizeLecture(
      { meta: { title: 't' }, slides: [{ type: 'cover', title: '표지' }] },
      { coverDefaults: true },
    );
    expect(lecture.slides[0]).not.toHaveProperty('kicker');
    expect(lecture.slides[0]).not.toHaveProperty('meta');
  });
});
