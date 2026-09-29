import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ManualProvider, renderManualPrompt } from '../src/providers/manual.js';
import {
  buildChatCompletionRequest,
  chatCompletionsUrl,
  openAICompatibleFromEnv,
  readChatCompletion,
} from '../src/providers/openai-compatible.js';
import type { ChatMessage } from '../src/types.js';

const dir = mkdtempSync(path.join(tmpdir(), 'marco-manual-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const messages = (user: string): ChatMessage[] => [
  { role: 'system', content: '# MARCO 작성 안내\n규칙' },
  { role: 'user', content: user },
];

describe('ManualProvider', () => {
  it('writes the kit once, writes the prompt, and returns the saved reply', async () => {
    const log: string[] = [];
    const waited: string[] = [];
    const provider = new ManualProvider({
      dir,
      log: (l) => log.push(l),
      waitForReply: async (replyPath) => {
        waited.push(replyPath);
        writeFileSync(replyPath, `답 ${waited.length}`);
      },
    });
    expect(await provider.complete(messages('첫 요청'), { label: 'slides-01-06' })).toBe('답 1');
    expect(await provider.complete(messages('둘째 요청'), { label: 'slides 07/12' })).toBe('답 2');
    expect(readFileSync(path.join(dir, 'kit.md'), 'utf8')).toBe('# MARCO 작성 안내\n규칙');
    expect(readFileSync(path.join(dir, '01-slides-01-06.prompt.md'), 'utf8')).toBe('첫 요청\n');
    expect(existsSync(path.join(dir, '02-slides-07-12.prompt.md'))).toBe(true);
    expect(log.filter((l) => l.includes('kit.md'))).toHaveLength(1);
    expect(waited).toHaveLength(2);
  });

  it('reuses a saved reply when the prompt is unchanged and sets aside a stale one', async () => {
    const waited: string[] = [];
    const provider = () =>
      new ManualProvider({
        dir,
        log: () => {},
        waitForReply: async (replyPath) => {
          waited.push(replyPath);
          writeFileSync(replyPath, '새 답');
        },
      });
    expect(await provider().complete(messages('첫 요청'), { label: 'slides-01-06' })).toBe('답 1');
    expect(waited).toHaveLength(0);
    expect(await provider().complete(messages('바뀐 요청'), { label: 'slides-01-06' })).toBe(
      '새 답',
    );
    expect(readFileSync(path.join(dir, '01-slides-01-06.reply.md.old'), 'utf8')).toBe('답 1');
  });

  it('renders only non-system messages for pasting', () => {
    expect(
      renderManualPrompt([
        { role: 'system', content: 'S' },
        { role: 'user', content: 'U' },
        { role: 'assistant', content: 'A' },
      ]),
    ).toBe('U\n\n(앞선 답)\nA\n');
  });
});

describe('OpenAI-compatible adapter (request shaping only, no network)', () => {
  it('builds the endpoint URL from a base URL', () => {
    expect(chatCompletionsUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(chatCompletionsUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(chatCompletionsUrl('http://localhost:11434')).toBe(
      'http://localhost:11434/v1/chat/completions',
    );
    expect(chatCompletionsUrl('https://example.com/v1beta/openai/')).toBe(
      'https://example.com/v1beta/openai/chat/completions',
    );
    expect(chatCompletionsUrl('https://x.test/v1/chat/completions')).toBe(
      'https://x.test/v1/chat/completions',
    );
  });

  it('shapes the request body and headers', () => {
    const { url, init } = buildChatCompletionRequest(
      { baseUrl: 'https://api.example/v1', model: 'm', apiKey: 'k', temperature: 0.2 },
      messages('요청'),
      { maxTokens: 4000 },
    );
    expect(url).toBe('https://api.example/v1/chat/completions');
    expect(init.headers['authorization']).toBe('Bearer k');
    expect(JSON.parse(init.body)).toEqual({
      model: 'm',
      messages: messages('요청'),
      temperature: 0.2,
      max_tokens: 4000,
    });
    const local = buildChatCompletionRequest(
      { baseUrl: 'http://localhost:1234', model: 'm' },
      messages('x'),
    );
    expect(local.init.headers['authorization']).toBeUndefined();
  });

  it('reads string and part-array content, and reports errors', () => {
    expect(readChatCompletion({ choices: [{ message: { content: '답' } }] })).toBe('답');
    expect(
      readChatCompletion({
        choices: [{ message: { content: [{ type: 'text', text: '가' }, { text: '나' }] } }],
      }),
    ).toBe('가나');
    expect(() => readChatCompletion({ error: { message: 'bad key' } })).toThrow(/bad key/);
  });

  it('is configured from MARCO_AI_* variables', () => {
    const p = openAICompatibleFromEnv({
      MARCO_AI_BASE_URL: 'http://localhost:11434',
      MARCO_AI_MODEL: 'qwen',
    });
    expect(p.name).toBe('openai-compatible:qwen');
    expect(() => openAICompatibleFromEnv({ MARCO_AI_MODEL: 'x' })).toThrow(/MARCO_AI_BASE_URL/);
  });
});
