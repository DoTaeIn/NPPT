import type { Block } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import { blockSegments, splitProseNote } from '../src/index.js';

const cards: Block = {
  type: 'cards',
  cols: 2,
  items: [
    { kicker: '인증', title: '누구의 자격인가', body: '카드가 유효한지 확인한다.' },
    { kicker: '인가', title: '지금 열어도 되는가', body: '역할과 시간 조건을 판단한다.' },
  ],
};
const lead: Block = { type: 'paragraph', text: '협력사 점검원의 **카드는 정상**이다.', lead: true };
const takeaway: Block = { type: 'takeaway', label: '판단', text: '교육이 만료되면 거부한다.' };

describe('blockSegments', () => {
  it('gives one target per block, per card/step item and per block inside columns', () => {
    const columns: Block = {
      type: 'columns',
      cols: 2,
      columns: [[{ type: 'image', asset: 'x', caption: '개념도 그림 설명' }], [takeaway]],
    };
    expect(blockSegments([lead, cards, columns], 'intro').map((s) => s.target)).toEqual([
      'intro-b1',
      'intro-b2-i1',
      'intro-b2-i2',
      'intro-b3-i1-b1',
      'intro-b3-i2-b1',
    ]);
  });
});

describe('splitProseNote', () => {
  const prose =
    '협력사 점검원의 카드는 정상이다. 인증 누구의 자격인가 카드가 유효한지 확인한다. 인가 지금 열어도 되는가 역할과 시간 조건을 판단한다. 판단 교육이 만료되면 거부한다.';

  it('cuts the note at each block and rejoins to the original text', () => {
    const note = splitProseNote(prose, [lead, cards, takeaway], 'intro')!;
    expect(note.cues.map((c) => [c.focus?.targets, c.t])).toEqual([
      [['intro-b1'], '협력사 점검원의 카드는 정상이다.'],
      [['intro-b2-i1'], '인증 누구의 자격인가 카드가 유효한지 확인한다.'],
      [['intro-b2-i2'], '인가 지금 열어도 되는가 역할과 시간 조건을 판단한다.'],
      [['intro-b3'], '판단 교육이 만료되면 거부한다.'],
    ]);
    expect(note.cues.map((c) => c.t).join(' ')).toBe(prose);
    expect(note.raw?.split('\n')[0]).toBe('[대사] @intro-b1 협력사 점검원의 카드는 정상이다.');
  });

  it('keeps leading text (the heading) as a cue without a target; bare symbols join the first cue', () => {
    const withHeading = splitProseNote(`제목 줄 ${prose}`, [lead, cards, takeaway], 's-02')!;
    expect(withHeading.cues[0]).toMatchObject({ k: 'SAY', t: '제목 줄' });
    expect(withHeading.cues[0]?.focus).toBeUndefined();
    const withSymbol = splitProseNote(`▶ ${prose}`, [lead, cards, takeaway], 's-02')!;
    expect(withSymbol.cues[0]?.t).toBe('▶ 협력사 점검원의 카드는 정상이다.');
  });

  it('absorbs a block that is not in the note into the previous cue', () => {
    const extra: Block = { type: 'paragraph', text: '노트에 없는 문단이다.' };
    const note = splitProseNote(prose, [lead, extra, cards, takeaway], 's-02')!;
    expect(note.cues.map((c) => c.focus?.targets?.[0])).toEqual([
      's-02-b1',
      's-02-b3-i1',
      's-02-b3-i2',
      's-02-b4',
    ]);
  });

  it('returns undefined when the note is not the slide text', () => {
    expect(
      splitProseNote('출입통제의 기술과 운영을 함께 다룬다.', [cards], 'cover'),
    ).toBeUndefined();
    expect(splitProseNote('', [cards], 'cover')).toBeUndefined();
  });
});
