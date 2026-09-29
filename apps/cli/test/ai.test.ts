import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { systemPrompt } from '@marco/ai';
import { afterAll, describe, expect, it } from 'vitest';
import { makeProvider, parseRange, parseSlideList, runCli } from '../src/index.js';
import { capture } from './helpers.js';

const root = mkdtempSync(join(tmpdir(), 'marco-ai-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const waitFor = async (pred: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !pred(); i++) await new Promise((r) => setTimeout(r, 25));
};

const OUTLINE_REPLY = `개요입니다.

\`\`\`\`outline
번호 | 태그 | 제목 | 한 줄 의도 | 분
01 | 표지 | 출입통제 IAM | 오늘 다룰 범위 | 2
02 | 도입 | 카드가 유효하면 들어가도 되는가 | 인증과 인가를 구분한다 | 6
03 | 참고 자료 | 참고 자료 | 출처 | 2
\`\`\`\`
`;

const SLIDES_REPLY = `\`\`\`marco
# slide cover
title: 출입통제 IAM
subtitle: 문과 권한을 함께 본다

# slide id=intro
tag: 도입
title: 카드가 유효하면 들어가도 되는가
time: 6분

:::takeaway 핵심
인증은 자격 확인, 인가는 허용 판단이다.
:::

# slide references
title: 참고 자료
\`\`\`
`;

describe('marco ai kit', () => {
  it('writes the pasteable kit and the task prompts', async () => {
    const io = capture(root);
    expect(await runCli(['ai', 'kit'], io)).toBe(0);
    const kit = join(root, '.marco', 'ai', 'kit', 'MARCO-작성-안내.md');
    expect(readFileSync(kit, 'utf8')).toBe(systemPrompt());
    for (const f of ['10-개요.md', '20-슬라이드.md', '30-해설.md', '40-수정.md'])
      expect(existsSync(join(root, '.marco', 'ai', 'kit', f))).toBe(true);
    expect(io.stdout[0]).toMatch(
      /^✓ \.marco\/ai\/kit\/MARCO-작성-안내\.md · [\d,]+자 \(예시 제외 [\d,]+자\) · 약 [\d,]+ 토큰$/,
    );
    expect(io.stderr).toEqual([]);
  });

  it('--print writes the kit to stdout; -o picks the folder', async () => {
    const io = capture(root);
    expect(await runCli(['ai', 'kit', '--print'], io)).toBe(0);
    expect(`${io.stdout.join('\n')}\n`).toBe(systemPrompt());
    expect(await runCli(['ai', 'kit', '-o', 'kit-here'], capture(root))).toBe(0);
    expect(existsSync(join(root, 'kit-here', 'MARCO-작성-안내.md'))).toBe(true);
  });
});

describe('marco ai with the manual provider (no network)', () => {
  const dir = join(root, 'deck');
  const ai = join(dir, '.marco', 'ai');
  mkdirSync(dir, { recursive: true });
  const deckPath = join(dir, 'lecture.marco.md');

  it('outline prints where the prompt is, waits for the reply file, writes outline.txt', async () => {
    const io = capture(dir);
    const run = runCli(
      [
        'ai',
        'outline',
        '물리보안과 출입통제',
        '--course',
        '보안시스템 운영 및 활용',
        '--week',
        '3',
        '--duration',
        '10',
        '--poll',
        '20',
      ],
      io,
    );
    await waitFor(() => existsSync(join(ai, '01-outline.prompt.md')));
    expect(readFileSync(join(ai, '01-outline.prompt.md'), 'utf8')).toContain('물리보안과 출입통제');
    writeFileSync(join(ai, '01-outline.reply.md'), OUTLINE_REPLY);
    expect(await run).toBe(0);
    const text = io.text();
    expect(text).toContain('수동 모드 프롬프트를 .marco/ai/ 에 씁니다.');
    expect(text).toContain('[MARCO] 새 채팅이면 먼저 .marco/ai/kit.md 전체를 붙여 넣고');
    expect(text).toContain(
      '[MARCO] 1. .marco/ai/01-outline.prompt.md 내용을 채팅창에 붙여 넣으세요.',
    );
    expect(text).toContain('답 전체를 .marco/ai/01-outline.reply.md 에 저장하면 계속합니다.');
    expect(text).toContain('✓ outline.txt · 슬라이드 3장 · 10분');
    expect(text).toContain('경고 outline has 3 slides (expected 30–45)');
    expect(text).toMatch(/호출 1회 · 프롬프트 \d+자 \+ 답 \d+자/);
    expect(readFileSync(join(dir, 'outline.txt'), 'utf8')).toContain(
      '02 | 도입 | 카드가 유효하면 들어가도 되는가 | 인증과 인가를 구분한다 | 6',
    );
    expect(readFileSync(join(ai, 'kit.md'), 'utf8')).toBe(systemPrompt());
  });

  it('slides writes the deck (a saved reply is reused without waiting)', async () => {
    writeFileSync(join(ai, '01-slides-01-03.reply.md'), SLIDES_REPLY);
    const io = capture(dir);
    expect(await runCli(['ai', 'slides'], io)).toBe(0);
    const deck = readFileSync(deckPath, 'utf8');
    expect(deck.startsWith('---\ntitle: "출입통제 IAM"\n---\n\n# slide cover\n')).toBe(true);
    expect(deck).toContain('# slide id=intro\n');
    expect(io.text()).toContain('✓ lecture.marco.md · 호출 1회로 슬라이드를 썼습니다.');
    expect(io.text()).toMatch(/린트 · 오류 0 · 경고 \d+ — 자세히: marco lint lecture\.marco\.md/);
    // Never overwrite a deck without --force, and fail before any model call.
    const again = capture(dir);
    expect(await runCli(['ai', 'slides'], again)).toBe(1);
    expect(again.stderr).toEqual(['오류 이미 있습니다: lecture.marco.md (덮어쓰려면 --force)']);
  });

  it('notes writes one prompt per slide and merges the replies, keeping a .bak', async () => {
    const before = readFileSync(deckPath, 'utf8');
    writeFileSync(
      join(ai, '01-notes-02.reply.md'),
      '## note\n[대사] 카드가 읽혔다고 끝이 아닙니다.\n',
    );
    writeFileSync(join(ai, '02-notes-03.reply.md'), '[대사] 출처는 여기 있습니다.\n');
    const io = capture(dir);
    expect(await runCli(['ai', 'notes', '--slides', '2-3', '--cpm', '300'], io)).toBe(0);
    const deck = readFileSync(deckPath, 'utf8');
    expect(deck).toContain('## note\n[대사] 카드가 읽혔다고 끝이 아닙니다.');
    expect(deck).toContain('[대사] 출처는 여기 있습니다.');
    expect(readFileSync(`${deckPath}.bak`, 'utf8')).toBe(before);
    expect(readFileSync(join(ai, '01-notes-02.prompt.md'), 'utf8')).toContain('1분에 약 300자');
    expect(io.text()).toContain('✓ lecture.marco.md (이전 내용: lecture.marco.md.bak)');
    expect(io.text()).toContain('[1/2] notes-02');
  });

  it('revise sends one slide with its lint issues and replaces it', async () => {
    writeFileSync(
      join(ai, '01-revise-intro.reply.md'),
      '```marco\n# slide id=intro\ntag: 도입\ntitle: 카드가 유효해도 들어가면 안 되는 때\nquestion: 교육이 만료되었다면?\ntime: 6분\n```\n',
    );
    const io = capture(dir);
    expect(
      await runCli(['ai', 'revise', 'intro', '질문 줄을 추가해 줘', '-o', 'revised.marco.md'], io),
    ).toBe(0);
    const revised = readFileSync(join(dir, 'revised.marco.md'), 'utf8');
    expect(revised).toContain('question: 교육이 만료되었다면?');
    expect(revised).toContain('# slide cover\n');
    expect(readFileSync(join(ai, '01-revise-intro.prompt.md'), 'utf8')).toContain(
      '질문 줄을 추가해 줘',
    );
    expect(io.text()).toContain('✓ revised.marco.md');
  });

  it('merge-notes merges a pasted chat reply without calling a model', async () => {
    writeFileSync(join(dir, 'reply.md'), '# slide id=intro\n## note\n[대사] 합쳐진 해설입니다.\n');
    const io = capture(dir);
    expect(await runCli(['ai', 'merge-notes', 'reply.md'], io)).toBe(0);
    expect(readFileSync(deckPath, 'utf8')).toContain('[대사] 합쳐진 해설입니다.');
    expect(io.text()).toContain('  노트를 합친 슬라이드: intro');

    writeFileSync(join(dir, 'bare.md'), '## note\n[대사] 번호로 지정한 해설.\n');
    const bare = capture(dir);
    expect(await runCli(['ai', 'merge-notes', 'bare.md'], bare)).toBe(1);
    expect(bare.stderr[0]).toContain('--slide <번호|id>');
    expect(await runCli(['ai', 'merge-notes', 'bare.md', '--slide', '1'], capture(dir))).toBe(0);
    expect(readFileSync(deckPath, 'utf8')).toContain('[대사] 번호로 지정한 해설.');
  });

  it('repair sends only slides with lint issues', async () => {
    const clean = join(dir, 'clean.marco.md');
    writeFileSync(clean, '---\ntitle: 깨끗한 덱\n---\n# slide\ntitle: 짧은 제목\n\n본문 한 줄.\n');
    const none = capture(dir);
    expect(await runCli(['ai', 'repair', '--deck', 'clean.marco.md'], none)).toBe(0);
    expect(none.stdout).toEqual(['✓ 고칠 린트 항목이 없습니다: clean.marco.md']);

    const long = '길다'.repeat(40);
    writeFileSync(
      join(dir, 'long.marco.md'),
      `---\ntitle: 긴 덱\n---\n# slide\ntitle: 괜찮은 제목\n\n# slide\ntitle: ${long}\n`,
    );
    writeFileSync(join(ai, '01-repair-s-02.reply.md'), '# slide\ntitle: 줄인 제목\n');
    const io = capture(dir);
    expect(await runCli(['ai', 'repair', '--deck', 'long.marco.md'], io)).toBe(0);
    expect(readFileSync(join(dir, 'long.marco.md'), 'utf8')).toContain('title: 줄인 제목');
    expect(readFileSync(join(ai, '01-repair-s-02.prompt.md'), 'utf8')).toContain(
      'budget.slide.title',
    );
    expect(io.text()).toContain('  다시 쓴 슬라이드: s-02');
  });

  it('--timeout gives up with a resume hint', async () => {
    const io = capture(dir);
    const code = await runCli(
      [
        'ai',
        'outline',
        '주제',
        '--course',
        '과목',
        '-o',
        'late.txt',
        '--timeout',
        '0.2',
        '--poll',
        '20',
        '--dir',
        'late',
      ],
      io,
    );
    expect(code).toBe(1);
    expect(io.stderr.at(-1)).toBe(
      '오류 답 파일을 기다리는 시간이 지났습니다: late/01-outline.reply.md. 답을 저장한 뒤 같은 명령을 다시 실행하면 저장된 답을 이어서 씁니다.',
    );
    expect(existsSync(join(dir, 'late.txt'))).toBe(false);
  });
});

describe('provider selection', () => {
  it('auto uses the OpenAI-compatible adapter only when both variables are set', () => {
    const env = { MARCO_AI_BASE_URL: 'http://localhost:11434', MARCO_AI_MODEL: 'qwen' };
    expect(makeProvider({}, capture(root, env)).name).toBe('openai-compatible:qwen');
    expect(makeProvider({ provider: 'manual' }, capture(root, env)).name).toBe('manual');
    expect(makeProvider({}, capture(root, { MARCO_AI_MODEL: 'qwen' })).name).toBe('manual');
  });

  it('--provider api without configuration is a clear error, not a network call', async () => {
    const io = capture(root);
    expect(
      await runCli(['ai', 'outline', '주제', '--course', '과목', '--provider', 'api'], io),
    ).toBe(1);
    expect(io.stderr[0]).toContain('MARCO_AI_BASE_URL과 MARCO_AI_MODEL 환경 변수가 필요합니다');
  });

  it('missing inputs and bad ranges', async () => {
    const io = capture(root);
    expect(await runCli(['ai', 'slides', '--outline', 'none.txt'], io)).toBe(1);
    expect(io.stderr[0]).toBe('오류 개요 파일이 없습니다: none.txt');
    expect(await runCli(['ai', 'notes', '--deck', 'none.marco.md'], capture(root))).toBe(1);
    expect(await runCli(['ai', 'outline', '주제'], capture(root))).toBe(1); // --course is required
    expect(parseRange('7-12')).toEqual([7, 12]);
    expect(parseRange('7')).toEqual([7, 7]);
    expect(() => parseRange('12-7')).toThrow();
    expect(parseSlideList('1-3,5,s-07,cover')).toEqual([1, 2, 3, 5, 's-07', 'cover']);
    expect(() => parseSlideList(',')).toThrow();
  });
});
