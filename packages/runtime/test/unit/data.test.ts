import { describe, expect, it, vi } from 'vitest';
import { detectEdition, emptyData, normalizeData, readLectureJson, timeText } from '../../src/data';
import { loadFixture } from './helpers';

describe('lecture data', () => {
  it('parses the fixture #lecture-data', () => {
    loadFixture();
    const raw = readLectureJson(document);
    const d = normalizeData(raw, detectEdition(document, raw), document.title);
    expect(d.ir).toBe('0.1');
    expect(d.engine).toEqual({ name: 'MARCO Engine', version: '0.1.0' });
    expect(d.meta.title).toBe('물리보안 · 출입통제 IAM');
    expect(d.refs.map((r) => r.id)).toEqual(['S04', 'S13', 'S30']);
    expect(d.refs[2]?.note).toBe('SP 800-162');
    expect(d.videos[0]).toMatchObject({ id: 'tTAISQqmxWQ', start: 441 });
    expect(d.assets.campus?.title).toBe('사옥의 3선 방어 개념도');
    expect(d.slideRefs['s-02']).toEqual(['S04', 'S13']);
    expect(d.terms.PACS).toContain('Physical Access Control System');
    const n = d.notes?.['s-02'];
    expect(n?.time).toEqual({ minutes: 2.5, from: '01:00', to: '03:30' });
    expect(n?.cues.map((c) => c.k)).toEqual(['SCREEN', 'SAY', 'LOOK', 'ASK', 'SQ', 'SA', 'NEXT']);
    expect(n?.cues[2]?.focus).toEqual({ targets: ['s-02-b1'] });
    expect(n?.cues[3]?.wait).toBe('10초');
    expect(d.notes?.['s-03']?.cues[4]).toMatchObject({ k: 'VERIFY', marker: '검증 보충' });
  });

  it('falls back to empty data when #lecture-data is missing', () => {
    document.body.innerHTML = '<div id="stage"></div>';
    expect(readLectureJson(document)).toEqual({});
    const d = normalizeData({}, 'instructor', '제목');
    expect(d).toMatchObject({ refs: [], videos: [], assets: {}, slideRefs: {}, terms: {} });
    expect(d.meta.title).toBe('제목');
    expect(normalizeData(null, 'instructor').refs).toEqual([]);
  });

  it('warns and continues on invalid JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.body.innerHTML = '<script id="lecture-data" type="application/json">{ nope</script>';
    expect(readLectureJson(document)).toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it('is tolerant of malformed fields and keeps plugin data', () => {
    const d = normalizeData(
      {
        refs: [{ id: 'A' }, null, { title: 'no id' }, 'x'],
        videos: [{ id: 'abcdefghijk', start: '30' }, { title: 'x' }],
        assets: { a: { title: 1, credit: 'c' }, b: 'bad' },
        slideRefs: { 's-01': ['A', 2, null], 's-02': 'bad' },
        terms: { X: 'ex', Y: 3, Z: null },
        notes: {
          's-01': { cues: [{ k: 'NOPE', t: '?' }, { k: 'SAY' }, { k: 'SAY', t: 'ok', focus: { targets: 'bad' } }] },
          's-02': '평문 노트',
          's-03': 5,
        },
        quiz: [{ id: 'Q01' }],
        sims: { a: 1 },
        custom: { keep: true },
      },
      'instructor',
    );
    expect(d.refs).toEqual([{ id: 'A', title: 'A' }]);
    expect(d.videos).toEqual([{ id: 'abcdefghijk', title: 'abcdefghijk', start: 30 }]);
    expect(d.assets).toEqual({ a: { credit: 'c' }, b: {} });
    expect(d.slideRefs).toEqual({ 's-01': ['A', '2'], 's-02': [] });
    expect(d.terms).toEqual({ X: 'ex', Y: '3' });
    expect(d.notes?.['s-01']?.cues).toEqual([{ k: 'MEMO', t: '?' }, { k: 'SAY', t: 'ok' }]);
    expect(d.notes?.['s-02']).toEqual({ cues: [], raw: '평문 노트' });
    expect(d.notes?.['s-03']).toBeUndefined();
    expect(d.quiz).toEqual([{ id: 'Q01' }]);
    expect(d.sims).toEqual({ a: 1 });
    expect(d.custom).toEqual({ keep: true });
  });

  it('drops notes in the student edition', () => {
    const d = normalizeData({ notes: { 's-01': { cues: [{ k: 'SAY', t: 'x' }] } } }, 'student');
    expect(d.notes).toBeUndefined();
  });

  it('detects the edition from html[data-edition], then meta.edition', () => {
    document.documentElement.setAttribute('data-edition', 'student');
    expect(detectEdition(document, {})).toBe('student');
    document.documentElement.removeAttribute('data-edition');
    expect(detectEdition(document, { meta: { edition: 'student' } })).toBe('student');
    expect(detectEdition(document, {})).toBe('instructor');
  });

  it('formats the time budget', () => {
    expect(timeText({ minutes: 2.5, from: '10:00', to: '12:30' })).toBe('2.5분 · 10:00 – 12:30');
    expect(timeText({ minutes: 4, remark: '끝나면 휴식' })).toBe('4분 · 끝나면 휴식');
    expect(emptyData().engine.name).toBe('MARCO Engine');
  });
});
