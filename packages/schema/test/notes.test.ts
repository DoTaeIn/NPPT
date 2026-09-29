import { describe, expect, it } from 'vitest';
import {
  CUE_KINDS,
  CUE_LABELS,
  MARKERS,
  parseNote,
  parseNoteTime,
  serializeNote,
} from '../src/index.js';
import type { CueKind, SlideNote } from '../src/index.js';
import { fixtureText } from './helpers.js';

/** parseNote without `raw`, for comparisons. */
const parsed = (raw: string): Omit<SlideNote, 'raw'> => {
  const { raw: _raw, ...rest } = parseNote(raw);
  void _raw;
  return rest;
};

const SPEC_EXAMPLE = [
  '[시간] 2.5분 · 10:00 – 12:30',
  '[화면] 왼쪽 팩트 표, 오른쪽 빨간 CVE 카드, 아래 공격 체인 4단계.',
  '[대사] {{p06-c000}} 좋은 수사관은 추리보다 사실부터 모읍니다. …',
  '[주목] @s-06-b1 왼쪽 표 4행을 위에서부터 짚는다.',
  '[발문] 이 네 단계 중 방화벽 룰이 직접 관여하는 단계는? | 10초',
  '[전환] 다음 슬라이드에서 규칙 순서를 본다.',
].join('\n');

describe('MARKERS and CUE_LABELS', () => {
  it('labels every cue kind in Korean', () => {
    expect(Object.keys(CUE_LABELS)).toEqual([...CUE_KINDS]);
    expect(CUE_LABELS).toEqual({
      SAY: '대사',
      DO: '조작',
      LOOK: '주목',
      ASK: '발문',
      HOP: '이동',
      SQ: '예상질문',
      SA: '예상답변',
      NEXT: '전환',
      TIP: '팁',
      WAIT: '대기',
      SCREEN: '화면',
      VERIFY: '검증',
      MEMO: '메모',
    });
  });

  it('maps every marker of notes.md plus the v9.7 aliases', () => {
    expect(MARKERS).toMatchObject({
      대사: 'SAY',
      조작: 'DO',
      주목: 'LOOK',
      발문: 'ASK',
      이동: 'HOP',
      예상질문: 'SQ',
      예상답변: 'SA',
      전환: 'NEXT',
      팁: 'TIP',
      대기: 'WAIT',
      화면: 'SCREEN',
      검증: 'VERIFY',
      '검증 보충': 'VERIFY',
      메모: 'MEMO',
      홉: 'HOP',
      '학생 질문': 'SQ',
      '강사 답변': 'SA',
    });
  });
});

describe('parseNote', () => {
  it('parses the notes.md example exactly', () => {
    expect(parseNote(SPEC_EXAMPLE)).toEqual({
      time: { minutes: 2.5, from: '10:00', to: '12:30' },
      cues: [
        { k: 'SCREEN', t: '왼쪽 팩트 표, 오른쪽 빨간 CVE 카드, 아래 공격 체인 4단계.' },
        { k: 'SAY', t: '좋은 수사관은 추리보다 사실부터 모읍니다. …', id: 'p06-c000' },
        { k: 'LOOK', t: '왼쪽 표 4행을 위에서부터 짚는다.', focus: { targets: ['s-06-b1'] } },
        { k: 'ASK', t: '이 네 단계 중 방화벽 룰이 직접 관여하는 단계는?', wait: '10초' },
        { k: 'NEXT', t: '다음 슬라이드에서 규칙 순서를 본다.' },
      ],
      raw: SPEC_EXAMPLE,
    });
  });

  it.each<[string, CueKind, string | undefined]>([
    ['대사', 'SAY', undefined],
    ['조작', 'DO', undefined],
    ['주목', 'LOOK', undefined],
    ['발문', 'ASK', undefined],
    ['이동', 'HOP', undefined],
    ['홉', 'HOP', '홉'],
    ['예상질문', 'SQ', undefined],
    ['학생 질문', 'SQ', '학생 질문'],
    ['예상답변', 'SA', undefined],
    ['강사 답변', 'SA', '강사 답변'],
    ['전환', 'NEXT', undefined],
    ['팁', 'TIP', undefined],
    ['대기', 'WAIT', undefined],
    ['화면', 'SCREEN', undefined],
    ['검증', 'VERIFY', undefined],
    ['검증 보충', 'VERIFY', '검증 보충'],
    ['메모', 'MEMO', undefined],
  ])('[%s] → %s', (marker, kind, kept) => {
    const [cue] = parseNote(`[${marker}] 본문`).cues;
    expect(cue?.k).toBe(kind);
    expect(cue?.t).toBe('본문');
    expect(cue?.marker).toBe(kept);
  });

  it('matches markers regardless of inner whitespace and keeps the authored form', () => {
    expect(parseNote('[예상 질문] 왜요?').cues[0]).toEqual({
      k: 'SQ',
      t: '왜요?',
      marker: '예상 질문',
    });
  });

  it('reads cue ids and treats {{auto}} as "assign at build"', () => {
    const { cues } = parseNote(
      '[대사] {{p06-c002}} 하나\n[대사] {{auto}} 둘\n[대사] {{ AUTO }} 셋\n[대사] 넷',
    );
    expect(cues.map((c) => c.id)).toEqual(['p06-c002', undefined, undefined, undefined]);
    expect(cues.map((c) => c.t)).toEqual(['하나', '둘', '셋', '넷']);
  });

  it('takes a trailing | wait on any cue kind, but only when it is a duration', () => {
    const { cues } = parseNote(
      '[대사] 잠깐 생각해 보세요 | 5초\n[대기] 교실을 돈다 | 10 min\n[조작] show rules | grep 99\n[발문] 옆 사람과 이야기 | 30초~1분',
    );
    expect(cues.map((c) => c.wait)).toEqual(['5초', '10 min', undefined, '30초~1분']);
    expect(cues[2]?.t).toBe('show rules | grep 99');
  });

  it('extracts @targets anywhere in LOOK/HOP cues and only leading ones elsewhere', () => {
    const { cues } = parseNote(
      [
        '[주목] 왼쪽 표 @s-06-b1 와 오른쪽 카드 @s-06-b2-i1 를 짚는다.',
        '[이동] @s-06-b3',
        '[대사] @s-06-b1 이 표를 보세요. 메일은 admin@example.com, 명령은 @echo off.',
      ].join('\n'),
    );
    expect(cues[0]).toEqual({
      k: 'LOOK',
      t: '왼쪽 표 와 오른쪽 카드 를 짚는다.',
      focus: { targets: ['s-06-b1', 's-06-b2-i1'] },
    });
    expect(cues[1]).toEqual({ k: 'HOP', t: '', focus: { targets: ['s-06-b3'] } });
    expect(cues[2]).toEqual({
      k: 'SAY',
      t: '이 표를 보세요. 메일은 admin@example.com, 명령은 @echo off.',
      focus: { targets: ['s-06-b1'] },
    });
  });

  it.each<[string, ReturnType<typeof parseNoteTime>]>([
    ['2분', { minutes: 2 }],
    ['2.5분 · 10:00 – 12:30', { minutes: 2.5, from: '10:00', to: '12:30' }],
    ['2.5분 · 10:00-12:30', { minutes: 2.5, from: '10:00', to: '12:30' }],
    ['2.5 분, 10:00 — 12:30', { minutes: 2.5, from: '10:00', to: '12:30' }],
    ['0.5분 · 149:30 – 150:00', { minutes: 0.5, from: '149:30', to: '150:00' }],
    [
      '4분 · 64:30 – 68:30 · 끝나면 휴식 10분',
      { minutes: 4, from: '64:30', to: '68:30', remark: '끝나면 휴식 10분' },
    ],
    ['10:00 – 12:30', { minutes: 2.5, from: '10:00', to: '12:30' }],
    ['3 min', { minutes: 3 }],
    ['2분 30초 · 10:00 – 12:30', { minutes: 2.5, from: '10:00', to: '12:30' }],
    ['약 2분쯤', undefined],
  ])('[시간] %s', (text, expected) => {
    expect(parseNoteTime(text)).toEqual(expected);
    expect(parseNote(`[시간] ${text}`).time).toEqual(expected);
  });

  it('keeps an unreadable [시간] as a MEMO cue with marker "시간"', () => {
    expect(parsed('[시간] 약 2분쯤')).toEqual({
      cues: [{ k: 'MEMO', t: '약 2분쯤', marker: '시간' }],
    });
  });

  it('ignores headings, separators and blank lines but keeps them in raw', () => {
    const raw =
      '# 해설 1|P06 · 해설 1–8\n\n[대사] 첫 줄\n이어지는 줄\n\n둘째 문단\n===\n# 해설 2|P06 · 해설 9–16\n[전환] 끝';
    const note = parseNote(raw);
    expect(note.raw).toBe(raw);
    expect(note.cues).toEqual([
      { k: 'SAY', t: '첫 줄\n이어지는 줄\n둘째 문단' },
      { k: 'NEXT', t: '끝' },
    ]);
  });

  it('turns text before the first marker (and after a separator) into MEMO cues', () => {
    expect(parsed('수업 전에 확인할 것\n[대사] 시작합니다\n===\n구분선 뒤 메모').cues).toEqual([
      { k: 'MEMO', t: '수업 전에 확인할 것' },
      { k: 'SAY', t: '시작합니다' },
      { k: 'MEMO', t: '구분선 뒤 메모' },
    ]);
  });

  it('keeps unknown markers as MEMO with the marker, and key hints as text', () => {
    const { cues } = parseNote(
      '[설명] 보충 설명\n[대사] 전체화면은\n[F] 키를 누른다.\n[Esc]로 닫는다.',
    );
    expect(cues).toEqual([
      { k: 'MEMO', t: '보충 설명', marker: '설명' },
      { k: 'SAY', t: '전체화면은\n[F] 키를 누른다.\n[Esc]로 닫는다.' },
    ]);
  });

  it('handles CRLF input and marker-only lines', () => {
    expect(parsed('[대사]\r\n다음 줄의 대사\r\n[대기]').cues).toEqual([
      { k: 'SAY', t: '다음 줄의 대사' },
      { k: 'WAIT', t: '' },
    ]);
  });

  it('returns no cues for an empty note', () => {
    expect(parseNote('')).toEqual({ cues: [], raw: '' });
  });
});

describe('parseNote on the real week 5 P17 note (253 lines)', () => {
  const raw = fixtureText('week05-p17.note.txt');
  const note = parseNote(raw);
  const count = (kind: CueKind): number => note.cues.filter((c) => c.k === kind).length;

  it('reads the time budget', () => {
    expect(note.time).toEqual({ minutes: 6.5, from: '49:30', to: '56:00' });
  });

  it('counts cues by kind', () => {
    expect(raw.split('\n').length).toBeGreaterThanOrEqual(250);
    expect(note.cues).toHaveLength(98);
    expect(count('HOP')).toBe(54);
    expect(count('SAY')).toBe(23);
    expect(count('DO')).toBe(8);
    expect(count('LOOK')).toBe(5);
    expect(count('SQ')).toBe(2);
    expect(count('SA')).toBe(2);
    expect(count('ASK')).toBe(2);
    expect(count('SCREEN')).toBe(1);
    expect(count('NEXT')).toBe(1);
    expect(count('MEMO')).toBe(0);
  });

  it('keeps ids, waits and alias markers', () => {
    expect(note.cues.filter((c) => c.id).length).toBe(97);
    expect(note.cues.filter((c) => c.wait).map((c) => c.wait)).toEqual(['5초', '5초']);
    expect(note.cues[1]).toMatchObject({ k: 'SAY', id: 'p17-c000' });
    expect(note.cues.at(-1)).toMatchObject({ k: 'NEXT', id: 'p17-c102' });
    expect(new Set(note.cues.filter((c) => c.k === 'HOP').map((c) => c.marker))).toEqual(
      new Set(['홉']),
    );
    expect(note.cues.every((c) => !c.t.startsWith('{{') && !c.t.includes('\n#'))).toBe(true);
    expect(note.raw).toBe(raw);
  });

  it('round-trips through serializeNote (verbatim raw and canonical form)', () => {
    expect(serializeNote(note)).toBe(raw);
    const canonical = serializeNote(note, { canonical: true });
    expect(canonical.split('\n')).toHaveLength(99);
    expect(parsed(canonical)).toEqual(parsed(raw));
  });
});

describe('serializeNote', () => {
  it('writes [시간] first and one cue per line', () => {
    expect(serializeNote(parsed(SPEC_EXAMPLE) as SlideNote)).toBe(
      [
        '[시간] 2.5분 · 10:00 – 12:30',
        '[화면] 왼쪽 팩트 표, 오른쪽 빨간 CVE 카드, 아래 공격 체인 4단계.',
        '[대사] {{p06-c000}} 좋은 수사관은 추리보다 사실부터 모읍니다. …',
        '[주목] @s-06-b1 왼쪽 표 4행을 위에서부터 짚는다.',
        '[발문] 이 네 단계 중 방화벽 룰이 직접 관여하는 단계는? | 10초',
        '[전환] 다음 슬라이드에서 규칙 순서를 본다.',
      ].join('\n'),
    );
  });

  it('round-trips every feature and is stable', () => {
    const note: SlideNote = {
      time: { minutes: 4, from: '64:30', to: '68:30', remark: '끝나면 휴식 10분' },
      cues: [
        { k: 'MEMO', t: '마커 없는 메모' },
        { k: 'VERIFY', t: '보충', marker: '검증 보충' },
        {
          k: 'SAY',
          t: '여러 줄\n대사',
          id: 'p01-c001',
          focus: { targets: ['s-01-b1'] },
          wait: '5초',
        },
        { k: 'HOP', t: '', id: 'p01-c002', focus: { targets: ['s-01-b2', 's-01-b2-i1'] } },
        { k: 'MEMO', t: '알 수 없는 표시', marker: '설명' },
        { k: 'SQ', t: '질문', marker: '학생 질문' },
        { k: 'TIP', t: '팁 본문' },
      ],
    };
    const text = serializeNote(note);
    expect(parsed(text)).toEqual(note);
    expect(serializeNote(parseNote(text))).toBe(text);
  });

  it('returns raw verbatim while it matches the cues, and the canonical form once they change', () => {
    const raw =
      '# 해설 1|P06 · 해설 1–8\n\n[대사] {{p06-c000}} 첫 대사\n\n===\n\n[전환] {{p06-c001}} 다음';
    const note = parseNote(raw);
    expect(serializeNote(note)).toBe(raw);
    const edited: SlideNote = {
      ...note,
      cues: [...note.cues, { k: 'TIP', t: '추가', id: 'p06-c002' }],
    };
    expect(serializeNote(edited)).toBe(
      '[대사] {{p06-c000}} 첫 대사\n[전환] {{p06-c001}} 다음\n[팁] {{p06-c002}} 추가',
    );
  });

  it('falls back to the canonical marker when a marker contradicts the kind', () => {
    expect(serializeNote({ cues: [{ k: 'ASK', t: '질문', marker: '대사' }] })).toBe('[발문] 질문');
  });
});
