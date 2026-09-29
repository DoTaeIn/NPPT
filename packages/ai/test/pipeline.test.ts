import type { LintIssue } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import {
  batch,
  runNotes,
  runOutline,
  runRepair,
  runRevise,
  runSlides,
  slideTimes,
} from '../src/pipeline.js';
import { splitDeck, splitNote, slideField } from '../src/source.js';
import type { ProgressEvent } from '../src/types.js';
import { FakeProvider, makeOutline, userText } from './fake-provider.js';

/** Answers a slides prompt with one slide per outline line listed under "## 이번 범위". */
function slidesReply(user: string): string {
  const range = user.slice(user.indexOf('## 이번 범위'));
  const nos = [...range.matchAll(/^(\d\d) \| /gm)].map((m) => m[1]!);
  const body = nos.map(
    (no) => `# slide id=s${no}\ntitle: 슬라이드 ${no}\ntime: 3분\n\n본문 ${no}이다.`,
  );
  return `여기 있습니다.\n\n\`\`\`\`marco\n${body.join('\n\n')}\n\`\`\`\``;
}

describe('runSlides', () => {
  it('splits 40 outline slides into 7 calls of at most 6 (batchSize default 6)', async () => {
    const fake = new FakeProvider((msgs) => slidesReply(userText(msgs)));
    const events: ProgressEvent[] = [];
    const result = await runSlides(
      fake,
      { outline: makeOutline(40), frontMatter: '---\ntitle: 6주차\n---' },
      { onProgress: (e) => events.push(e) },
    );
    expect(fake.calls).toHaveLength(7);
    expect(result.batches).toBe(7);
    expect(result.usage.calls).toBe(7);
    expect(result.usage.chars).toBe(result.usage.promptChars + result.usage.replyChars);
    expect(result.warnings).toEqual([]);
    const deck = splitDeck(result.source);
    expect(deck.frontMatter).toBe('---\ntitle: 6주차\n---\n');
    expect(deck.slides.map((s) => s.id)).toEqual(
      Array.from({ length: 40 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`),
    );
    expect(fake.calls.map((c) => c.opts?.label)).toEqual([
      'slides-01-06',
      'slides-07-12',
      'slides-13-18',
      'slides-19-24',
      'slides-25-30',
      'slides-31-36',
      'slides-37-40',
    ]);
    expect(events.map((e) => `${e.index}/${e.total}`)).toEqual([
      '1/7',
      '2/7',
      '3/7',
      '4/7',
      '5/7',
      '6/7',
      '7/7',
    ]);
    const systems = new Set(fake.calls.map((c) => c.messages[0]!.content));
    expect(systems.size).toBe(1);
  });

  it('honours batchSize and range, and warns when a batch comes back short', async () => {
    const fake = new FakeProvider((_msgs, i) =>
      i === 0 ? '```marco\n# slide id=x\ntitle: 하나뿐이다\n```' : slidesReply(userText(_msgs)),
    );
    const result = await runSlides(fake, {
      outline: makeOutline(40),
      range: [7, 16],
      batchSize: 4,
    });
    expect(fake.calls).toHaveLength(3);
    expect(result.warnings).toEqual(['slides-07-10: expected 4 slides, got 1']);
  });

  it('batches generically', () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('runOutline', () => {
  it('returns the outline text, parsed items and sanity warnings', async () => {
    const fake = new FakeProvider(() => `개요입니다.\n${makeOutline(12, 5)}`);
    const result = await runOutline(fake, {
      course: '보안',
      week: 6,
      topic: 'IDS/IPS',
      duration: 150,
    });
    expect(result.outline).toHaveLength(12);
    expect(result.source.startsWith('번호 | 태그')).toBe(true);
    expect(result.warnings).toEqual([
      'outline has 12 slides (expected 30–45)',
      'outline minutes add up to 60, lecture is 150',
    ]);
    expect(userText(fake.calls[0]!.messages)).toContain('주제: IDS/IPS');
  });
});

const DECK = `---
title: 6주차
---

# slide cover
title: IDS와 IPS
time: 2분

# slide id=detect
tag: 1부 · 탐지
title: 탐지는 알림이고 차단은 판단이다
time: 2.5분

:::takeaway 핵심 구분
탐지와 차단은 다르다.
:::

## note
[대사] 옛 해설.

# slide id=rules
title: 규칙은 위에서부터 읽힌다
time: 3분
`;

describe('runNotes', () => {
  it('makes one call per slide and merges each `## note`', async () => {
    const fake = new FakeProvider((msgs) => {
      const time = /## 시간\n(.+)/.exec(userText(msgs))?.[1];
      return `\`\`\`\`marco\n## note\n[시간] ${time}\n[대사] 새 해설이에요.\n\`\`\`\``;
    });
    const result = await runNotes(fake, { deck: DECK });
    expect(fake.calls).toHaveLength(3);
    expect(result.usage.calls).toBe(3);
    const slides = splitDeck(result.source).slides;
    expect(splitNote(slides[0]!.text).note).toBe(
      '## note\n[시간] 2분 · 0:00 – 2:00\n[대사] 새 해설이에요.\n',
    );
    expect(splitNote(slides[1]!.text).note).toContain('[시간] 2.5분 · 2:00 – 4:30');
    expect(slideField(slides[1]!.text, 'time')).toBeUndefined(); // the note now owns the timing
    expect(result.source).not.toContain('옛 해설');
    const second = userText(fake.calls[1]!.messages);
    expect(second).toContain('앞: IDS와 IPS');
    expect(second).toContain('뒤: 규칙은 위에서부터 읽힌다');
    expect(second).not.toContain('옛 해설'); // the old note is not sent back
  });

  it('writes notes for chosen slides only, with outline times', async () => {
    const fake = new FakeProvider(() => '[대사] 해설.');
    const outline =
      '01 | 표지 | IDS와 IPS | 연다 | 2\n02 | 1부 · 탐지 | 탐지 | 본다 | 4\n03 | 1부 · 규칙 | 규칙 | 본다 | 3';
    const result = await runNotes(fake, { deck: DECK, slides: ['rules'], outline });
    expect(fake.calls).toHaveLength(1);
    expect(userText(fake.calls[0]!.messages)).toContain('3분 · 6:00 – 9:00');
    const rules = splitDeck(result.source).slides[2]!.text;
    expect(splitNote(rules).note).toBe('## note\n[대사] 해설.\n');
    expect(slideField(rules, 'time')).toBe('3분'); // no [시간] in the note: time: stays
  });

  it('computes [시간] from `time:` fields', () => {
    const times = slideTimes(splitDeck(DECK));
    expect([...times.values()]).toEqual([
      '2분 · 0:00 – 2:00',
      '2.5분 · 2:00 – 4:30',
      '3분 · 4:30 – 7:30',
    ]);
  });
});

describe('runRevise and runRepair', () => {
  const issues: LintIssue[] = [
    {
      level: 'warn',
      code: 'budget.takeaway.text',
      path: '/slides/1/blocks/0/text',
      message: 'takeaway.text: 80자 (허용 70자)',
      slide: 'detect',
    },
    {
      level: 'warn',
      code: 'budget.slide.title',
      path: '/slides/2/title',
      message: 'title: 40자 (허용 34자)',
    },
    { level: 'info', code: 'time.total', path: '/slides', message: '노트 [시간] 합계 7.5분' },
    {
      level: 'info',
      code: 'content.todo',
      path: '/slides/1/blocks/0/text',
      message: '확인할 TODO가 남아 있습니다: "TODO: 출처 필요"',
      slide: 'detect',
    },
  ];

  it('revises one slide and leaves the rest of the deck untouched', async () => {
    const fake = new FakeProvider(
      () =>
        '````marco\n# slide id=detect\ntag: 1부 · 탐지\ntitle: 탐지는 알리고 차단은 막는다\n````',
    );
    const result = await runRevise(fake, {
      deck: DECK,
      slide: 2,
      request: '제목을 줄인다',
      lint: issues,
    });
    const slides = splitDeck(result.source).slides;
    expect(slideField(slides[1]!.text, 'title')).toBe('탐지는 알리고 차단은 막는다');
    expect(slides[0]!.text).toBe(splitDeck(DECK).slides[0]!.text);
    expect(slides[2]!.text).toBe(splitDeck(DECK).slides[2]!.text);
    const user = userText(fake.calls[0]!.messages);
    expect(user).toContain('budget.takeaway.text');
    expect(user).not.toContain('budget.slide.title'); // issues of other slides are filtered out
    expect(user).not.toContain('content.todo'); // info stays with the author
  });

  it('refuses a reply without a slide', async () => {
    const fake = new FakeProvider(() => '죄송합니다.');
    await expect(runRevise(fake, { deck: DECK, slide: 'detect', request: 'x' })).rejects.toThrow(
      /no "# slide"/,
    );
  });

  it('repairs each slide with issues once, by slide id or path', async () => {
    const fake = new FakeProvider((msgs) => {
      const id = /# slide id=(\S+)/.exec(userText(msgs))?.[1];
      return `\`\`\`\`marco\n# slide id=${id}\ntitle: 고쳤다\n\`\`\`\``;
    });
    const result = await runRepair(fake, { deck: DECK, issues });
    expect(result.repaired).toEqual(['detect', 'rules']);
    expect(fake.calls).toHaveLength(2);
    expect(userText(fake.calls[0]!.messages)).toContain('린트 결과의 문제만 고친다');
    const slides = splitDeck(result.source).slides;
    expect(slideField(slides[1]!.text, 'title')).toBe('고쳤다');
    expect(slideField(slides[2]!.text, 'title')).toBe('고쳤다');
  });
});
