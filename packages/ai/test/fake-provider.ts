import type { ChatMessage, CompleteOptions, Provider } from '../src/types.js';

export interface FakeCall {
  messages: ChatMessage[];
  opts: CompleteOptions | undefined;
}

/** Test double: records every call and answers with `reply(messages, index)`. No network. */
export class FakeProvider implements Provider {
  readonly name = 'fake';
  readonly calls: FakeCall[] = [];

  constructor(private readonly reply: (messages: ChatMessage[], index: number) => string) {}

  async complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string> {
    this.calls.push({ messages, opts });
    return this.reply(messages, this.calls.length - 1);
  }
}

export function userText(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
}

/** An outline of `n` slides: cover, two part dividers, content, closing quote, references. */
export function makeOutline(n: number, minutes = 3): string {
  const lines = ['````outline', '번호 | 태그 | 제목 | 한 줄 의도 | 분'];
  for (let i = 1; i <= n; i++) {
    const no = String(i).padStart(2, '0');
    let tag = `1부 · 주제${i}`;
    if (i === 1) tag = '표지';
    else if (i === 2) tag = '1부';
    else if (i === Math.ceil(n / 2)) tag = '2부';
    else if (i === n - 1) tag = '마무리';
    else if (i === n) tag = '참고 자료';
    lines.push(`${no} | ${tag} | 슬라이드 ${i} 제목은 주장 한 문장이다 | 의도 ${i} | ${minutes}`);
  }
  lines.push(`합계 | ${n * minutes}분`, '````');
  return lines.join('\n');
}
