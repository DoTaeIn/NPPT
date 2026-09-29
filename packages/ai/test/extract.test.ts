import { describe, expect, it } from 'vitest';
import { extractMarcoSource, extractNote, findFencedBlocks } from '../src/extract.js';

const SLIDE = '# slide id=a\ntitle: 가는 가다\n\n:::takeaway 핵심\n문장이다.\n:::';

describe('extractMarcoSource', () => {
  it('takes the ````marco fence and drops the prose around it', () => {
    const reply = `네, 요청하신 슬라이드입니다.\n\n\`\`\`\`marco\n${SLIDE}\n\`\`\`\`\n\n필요하면 말씀해 주세요.`;
    expect(extractMarcoSource(reply)).toBe(SLIDE + '\n');
  });

  it('reads a ```marco fence that itself contains a ```bash code block', () => {
    const inner =
      '# slide id=cli\ntitle: 규칙을 확인한다\n\n```bash title="확인"\nshow rules\n```\n\n:::takeaway 정리\n본다.\n:::';
    const reply = `설명\n\`\`\`marco\n${inner}\n\`\`\`\n끝`;
    expect(extractMarcoSource(reply)).toBe(inner + '\n');
  });

  it('handles an unfenced reply with leading prose and a trailing sign-off', () => {
    const reply = `아래처럼 작성했습니다:\n\n${SLIDE}\n\n이상입니다. 수정이 필요하면 알려 주세요.`;
    expect(extractMarcoSource(reply)).toBe(SLIDE + '\n');
  });

  it('keeps an unfenced reply that is already pure source', () => {
    expect(extractMarcoSource(SLIDE)).toBe(SLIDE + '\n');
  });

  it('joins several fences that each hold slides, in order', () => {
    const second = '# slide id=b\ntitle: 나는 나다';
    const reply = `첫 부분:\n\`\`\`marco\n${SLIDE}\n\`\`\`\n둘째 부분:\n\`\`\`marco\n${second}\n\`\`\``;
    expect(extractMarcoSource(reply)).toBe(`${SLIDE}\n\n${second}\n`);
  });

  it('prefers the MARCO fence over other code in the reply', () => {
    const reply = `예시 명령:\n\`\`\`bash\nmarco build\n\`\`\`\n\n\`\`\`\`marco\n${SLIDE}\n\`\`\`\``;
    expect(extractMarcoSource(reply)).toBe(SLIDE + '\n');
  });

  it('keeps a truncated reply whose fence never closed', () => {
    expect(extractMarcoSource(`\`\`\`\`marco\n${SLIDE}\n# slide id=c\ntitle: 잘`)).toBe(
      `${SLIDE}\n# slide id=c\ntitle: 잘\n`,
    );
  });

  it('reads an outline fence and normalises CRLF', () => {
    const reply = '개요입니다.\r\n````outline\r\n01 | 표지 | 제목 | 의도 | 2\r\n````\r\n';
    expect(extractMarcoSource(reply)).toBe('01 | 표지 | 제목 | 의도 | 2\n');
  });

  it('finds top-level fenced blocks with their info strings', () => {
    const blocks = findFencedBlocks('```marco\nA\n```\ntext\n~~~\nB\n~~~');
    expect(blocks.map((b) => [b.info, b.content, b.closed])).toEqual([
      ['marco', 'A', true],
      ['', 'B', true],
    ]);
  });
});

describe('extractNote', () => {
  const note = '## note\n[시간] 2분\n[대사] 말한다.\n';
  it('accepts a bare note', () => {
    expect(extractNote('````marco\n' + note + '````')).toBe(note);
  });
  it('adds a missing `## note` line', () => {
    expect(extractNote('[시간] 2분\n[대사] 말한다.')).toBe(note);
  });
  it('keeps only the note of a whole slide', () => {
    expect(extractNote(`\`\`\`\`marco\n${SLIDE}\n\n${note}\`\`\`\``)).toBe(note);
  });
});
