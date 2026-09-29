/**
 * ManualProvider: the chat-window "provider". Each call writes the prompt to a file, tells the
 * professor what to paste where, and waits until the chat reply has been saved to the matching
 * reply file. Re-running a command reuses replies whose prompt did not change, so an interrupted
 * run resumes where it stopped.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage, CompleteOptions, Provider } from '../types.js';

export interface ManualProviderOptions {
  /** Folder for `kit.md`, `NN-label.prompt.md` and `NN-label.reply.md`. Default `.marco/ai`. */
  dir?: string;
  /** Instructions for the professor. Default: write to stderr. */
  log?: (line: string) => void;
  /** Resolves once the reply file is ready. Default: poll the file every `pollMs`. */
  waitForReply?: (replyPath: string, promptPath: string) => Promise<void>;
  /** Poll interval of the default wait; default 1000 ms. */
  pollMs?: number;
  /** Give up after this long (default 0 = wait until the reply appears or the user presses Ctrl+C). */
  timeoutMs?: number;
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

function slug(label: string | undefined): string {
  const s = (label ?? 'prompt').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
  return s || 'prompt';
}

/** Wait until the file exists, is non-empty and its size stopped changing. */
export async function pollForFile(file: string, pollMs = 1000, timeoutMs = 0): Promise<void> {
  const started = Date.now();
  let lastSize = -1;
  for (;;) {
    try {
      const { size } = await stat(file);
      if (size > 0 && size === lastSize) return;
      lastSize = size;
    } catch {
      lastSize = -1;
    }
    if (timeoutMs > 0 && Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${file}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** The non-system messages as one pasteable text. */
export function renderManualPrompt(messages: ChatMessage[]): string {
  return (
    messages
      .filter((m) => m.role !== 'system')
      .map((m) => (m.role === 'assistant' ? `(앞선 답)\n${m.content}` : m.content))
      .join('\n\n')
      .trim() + '\n'
  );
}

export class ManualProvider implements Provider {
  readonly name = 'manual';
  private counter = 0;
  private kitWritten: string | undefined;

  constructor(private readonly options: ManualProviderOptions = {}) {}

  get dir(): string {
    return this.options.dir ?? path.join('.marco', 'ai');
  }

  private log(line: string): void {
    (this.options.log ?? ((l: string) => process.stderr.write(l + '\n')))(line);
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const dir = this.dir;
    await mkdir(dir, { recursive: true });
    this.counter += 1;

    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    if (system && system !== this.kitWritten) {
      const kitPath = path.join(dir, 'kit.md');
      await writeFile(kitPath, system, 'utf8');
      this.kitWritten = system;
      this.log(`[MARCO] 새 채팅이면 먼저 ${kitPath} 전체를 붙여 넣고 "준비됨"을 확인하세요.`);
    }

    const stem = `${String(this.counter).padStart(2, '0')}-${slug(opts.label)}`;
    const promptPath = path.join(dir, `${stem}.prompt.md`);
    const replyPath = path.join(dir, `${stem}.reply.md`);
    const prompt = renderManualPrompt(messages);

    const previous = await readIfExists(promptPath);
    if (previous !== undefined && previous !== prompt && (await exists(replyPath))) {
      await rename(replyPath, `${replyPath}.old`); // the prompt changed: the old reply is stale
    }
    await writeFile(promptPath, prompt, 'utf8');

    if (!(await exists(replyPath))) {
      this.log(`[MARCO] ${this.counter}. ${promptPath} 내용을 채팅창에 붙여 넣으세요.`);
      this.log(`[MARCO]    답 전체를 ${replyPath} 에 저장하면 계속합니다. (중단: Ctrl+C)`);
      const wait =
        this.options.waitForReply ??
        ((reply: string) => pollForFile(reply, this.options.pollMs, this.options.timeoutMs));
      await wait(replyPath, promptPath);
    }
    return readFile(replyPath, 'utf8');
  }
}
