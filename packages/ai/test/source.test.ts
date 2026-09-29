import { describe, expect, it } from 'vitest';
import {
  findSlide,
  formatClock,
  formatTimeRange,
  joinDeck,
  mergeNote,
  mergeNotes,
  parseSlideHeader,
  removeField,
  replaceSlide,
  slideField,
  splitDeck,
  splitNote,
} from '../src/source.js';

const DECK = `---
title: 3주차
refs:
  S13: { title: 'Axis Secure Entry' }
---

# slide cover
title: 물리보안 · 출입통제 IAM

# slide id=card-steps
tag: 기본 원리
title: 카드 인식과 통과는 다른 단계다
time: 3분

\`\`\`bash
# slide inside code is not a header
\`\`\`

## note
[대사] 옛 해설.

# slide
title: 세 번째
time: 2.5분
`;

describe('splitDeck / joinDeck', () => {
  it('splits front matter and slides, ignoring # slide inside code fences', () => {
    const parts = splitDeck(DECK);
    expect(parts.frontMatter).toMatch(/^---\ntitle: 3주차[\s\S]*---\n$/);
    expect(parts.slides.map((s) => [s.position, s.id, s.type])).toEqual([
      [1, 's-01', 'cover'],
      [2, 'card-steps', 'content'],
      [3, 's-03', 'content'],
    ]);
    expect(parts.slides[1]!.text).toContain('# slide inside code is not a header');
  });

  it('round-trips', () => {
    expect(joinDeck(splitDeck(DECK))).toBe(DECK);
  });

  it('parses header tokens', () => {
    expect(parseSlideHeader('# slide hero alert id=open')).toEqual({
      type: 'hero',
      alert: true,
      explicitId: 'open',
      attrs: { id: 'open' },
    });
  });
});

describe('slide lookup and edits', () => {
  it('finds slides by position, explicit id, default id and numeric string', () => {
    const parts = splitDeck(DECK);
    expect(findSlide(parts, 2)?.id).toBe('card-steps');
    expect(findSlide(parts, 'card-steps')?.position).toBe(2);
    expect(findSlide(parts, 's-03')?.position).toBe(3);
    expect(findSlide(parts, '1')?.type).toBe('cover');
    expect(findSlide(parts, 'nope')).toBeUndefined();
  });

  it('replaces exactly one slide', () => {
    const out = replaceSlide(DECK, 'card-steps', '# slide id=card-steps\ntitle: 새 제목이다\n');
    const parts = splitDeck(out);
    expect(parts.slides).toHaveLength(3);
    expect(slideField(parts.slides[1]!.text, 'title')).toBe('새 제목이다');
    expect(parts.slides[0]!.text).toBe(splitDeck(DECK).slides[0]!.text);
    expect(() => replaceSlide(DECK, 9, '# slide\ntitle: x')).toThrow(/not found/);
  });

  it('replaces an existing note and adds a missing one', () => {
    const slide = splitDeck(DECK).slides[1]!.text;
    expect(splitNote(slide).note).toBe('## note\n[대사] 옛 해설.\n');
    const merged = mergeNote(slide, '[대사] 새 해설.');
    expect(merged).toContain('## note\n[대사] 새 해설.\n');
    expect(merged).not.toContain('옛 해설');
    expect(mergeNote('# slide\ntitle: x\n', '## note\n[대사] y')).toBe(
      '# slide\ntitle: x\n\n## note\n[대사] y\n',
    );
  });

  it('drops the time: field when the merged note carries [시간]', () => {
    const slide = splitDeck(DECK).slides[1]!.text;
    const timed = mergeNote(slide, '[시간] 3분 · 6:00 – 9:00\n[대사] 해설.');
    expect(slideField(timed, 'time')).toBeUndefined();
    expect(slideField(timed, 'title')).toBe('카드 인식과 통과는 다른 단계다');
    expect(slideField(mergeNote(slide, '[대사] 해설.'), 'time')).toBe('3분');
    expect(removeField('# slide\ntitle: a\ntime: 2분\n\ntime: body text', 'time')).toBe(
      '# slide\ntitle: a\n\ntime: body text',
    );
  });

  it('merges a multi-slide notes reply by id and by unique header', () => {
    const reply =
      '# slide cover\n\n## note\n[대사] 표지 해설.\n\n# slide id=card-steps\n\n## note\n[대사] 단계 해설.\n\n# slide id=missing\n\n## note\n[대사] x\n';
    const { source, merged, unmatched } = mergeNotes(DECK, reply);
    expect(merged).toEqual(['s-01', 'card-steps']);
    expect(unmatched).toEqual(['# slide id=missing']);
    const parts = splitDeck(source);
    expect(splitNote(parts.slides[0]!.text).note).toContain('표지 해설');
    expect(splitNote(parts.slides[1]!.text).note).toContain('단계 해설');
  });

  it('merges a bare note into a named slide', () => {
    const { source } = mergeNotes(DECK, '[대사] 세 번째 해설.', 3);
    expect(splitNote(splitDeck(source).slides[2]!.text).note).toBe(
      '## note\n[대사] 세 번째 해설.\n',
    );
  });
});

describe('time helpers', () => {
  it('formats the lecture clock like the week-5 script', () => {
    expect(formatClock(12.5)).toBe('12:30');
    expect(formatClock(94)).toBe('94:00');
    expect(formatTimeRange(2.5, 10)).toBe('2.5분 · 10:00 – 12:30');
  });
});
