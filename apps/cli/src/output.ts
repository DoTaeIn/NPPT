/** Terminal output: colours, diagnostics, lint grouped by slide, sizes (messages in Korean). */
import { isAbsolute, relative } from 'node:path';
import { plainText, type Diagnostic, type Lecture, type LintIssue } from '@marco/compiler';

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  /** Emit ANSI colours. */
  color: boolean;
  /** Base directory for relative paths. */
  cwd: string;
}

export function defaultIo(): CliIo {
  const env = process.env;
  const color =
    env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0'
      ? true
      : env.NO_COLOR === undefined && process.stdout.isTTY === true && env.TERM !== 'dumb';
  return {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    color,
    cwd: process.cwd(),
  };
}

const STYLES = {
  red: [31, 39],
  yellow: [33, 39],
  green: [32, 39],
  cyan: [36, 39],
  dim: [2, 22],
  bold: [1, 22],
} as const;
export type Style = keyof typeof STYLES;

export function paint(io: CliIo, style: Style, text: string): string {
  if (!io.color) return text;
  const [open, close] = STYLES[style];
  return `\u001b[${open}m${text}\u001b[${close}m`;
}

const LEVEL: Record<Diagnostic['level'], { label: string; style: Style }> = {
  error: { label: '오류', style: 'red' },
  warn: { label: '경고', style: 'yellow' },
  info: { label: '정보', style: 'cyan' },
};

export function levelTag(io: CliIo, level: Diagnostic['level']): string {
  const l = LEVEL[level];
  return paint(io, l.style, l.label);
}

/** Path relative to the working directory, or absolute when it lies outside it. */
export function displayPath(io: CliIo, path: string): string {
  const rel = relative(io.cwd, path);
  return rel === '' ? path : rel.startsWith('..') || isAbsolute(rel) ? path : rel;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** `file:line  오류 [code] message` for parse/validation/build messages. */
export function printDiagnostics(io: CliIo, list: readonly Diagnostic[]): void {
  for (const d of list) {
    const loc = d.file ? `${d.file}${d.line ? `:${d.line}` : ''}` : '';
    const slide = d.slide && !d.line ? paint(io, 'dim', ` (${d.slide})`) : '';
    const line = `${loc ? `${paint(io, 'bold', loc)}  ` : ''}${levelTag(io, d.level)} ${paint(io, 'dim', `[${d.code}]`)} ${d.message}${slide}`;
    (d.level === 'error' ? io.err : io.out)(line);
  }
}

/** Info-level issues are shown only with --verbose, except the deck time summary. */
export function visibleLint(lint: readonly LintIssue[], verbose: boolean): LintIssue[] {
  return lint.filter((l) => verbose || l.level !== 'info' || l.code === 'time.total');
}

/** Lint issues grouped by slide (in slide order), deck-level issues last. */
export function printLint(
  io: CliIo,
  lint: readonly LintIssue[],
  opts: { lecture: Lecture; file: string; slideLines: Record<string, number>; verbose: boolean },
): void {
  const shown = visibleLint(lint, opts.verbose);
  const counts = { error: 0, warn: 0, info: 0 };
  for (const l of lint) counts[l.level]++;
  const summary = `린트 · 오류 ${counts.error} · 경고 ${counts.warn} · 정보 ${counts.info}`;
  if (!shown.length) {
    io.out(paint(io, counts.error ? 'red' : 'green', summary));
    return;
  }
  const bySlide = new Map<string, LintIssue[]>();
  const deck: LintIssue[] = [];
  for (const l of shown) {
    if (l.slide) bySlide.set(l.slide, [...(bySlide.get(l.slide) ?? []), l]);
    else deck.push(l);
  }
  const order = opts.lecture.slides.map((s) => s.id).filter((id) => bySlide.has(id));
  for (const id of bySlide.keys()) if (!order.includes(id)) order.push(id);
  const issueLine = (l: LintIssue): string =>
    `    ${levelTag(io, l.level)} ${paint(io, 'dim', l.code)}  ${l.message}`;
  for (const id of order) {
    const slide = opts.lecture.slides.find((s) => s.id === id);
    const index = slide ? opts.lecture.slides.indexOf(slide) + 1 : undefined;
    const line = opts.slideLines[id];
    const where = line ? `${opts.file}:${line}` : opts.file;
    io.out(
      `  ${paint(io, 'bold', id)}${index ? paint(io, 'dim', ` #${index}`) : ''} ${slide ? plainText(slide.title) : ''} ${paint(io, 'dim', `(${where})`)}`,
    );
    for (const l of bySlide.get(id) ?? []) io.out(issueLine(l));
  }
  if (deck.length) {
    io.out(`  ${paint(io, 'bold', '덱 전체')}`);
    for (const l of deck) io.out(issueLine(l));
  }
  const hidden = lint.length - shown.length;
  io.out(
    paint(io, counts.error ? 'red' : counts.warn ? 'yellow' : 'green', summary) +
      (hidden ? paint(io, 'dim', ` (정보 ${hidden}건은 --verbose로 표시)`) : ''),
  );
}
