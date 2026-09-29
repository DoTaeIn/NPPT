import type { CliIo } from '../src/index.js';

export type CapturedIo = CliIo & { stdout: string[]; stderr: string[]; text(): string };

/** A CliIo that records output lines (no colours, empty environment unless given). */
export function capture(cwd: string, env: Record<string, string | undefined> = {}): CapturedIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (l) => stdout.push(l),
    err: (l) => stderr.push(l),
    color: false,
    cwd,
    env,
    text: () => [...stdout, ...stderr].join('\n'),
  };
}
