/**
 * `marco ai …` wires the @marco/ai authoring pipeline (packages/ai/README.md, "CLI wiring").
 *
 * Provider: `ManualProvider` by default. Every call writes `NN-label.prompt.md` into `.marco/ai/`,
 * prints where it is, and waits until the professor saves the chat answer as
 * `NN-label.reply.md`, so no network is needed. The OpenAI-compatible adapter is used when
 * `MARCO_AI_BASE_URL` and `MARCO_AI_MODEL` are set (or with `--provider api`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { type Command, Option } from 'commander';
import {
  buildKit,
  estimateTokens,
  ManualProvider,
  mergeNotes,
  openAICompatibleFromEnv,
  parseOutline,
  runNotes,
  runOutline,
  runRepair,
  runRevise,
  runSlides,
  systemPrompt,
  type PipelineOptions,
  type Provider,
  type RunResult,
} from '@marco/ai';
import { checkSource, type LintIssue } from '@marco/compiler';
import { type CliIo, displayPath, paint } from '../output.js';

export type ProviderMode = 'auto' | 'manual' | 'api';
export const PROVIDER_MODES: readonly ProviderMode[] = ['auto', 'manual', 'api'];

/** Options shared by every command that calls a model. */
export interface ProviderOptions {
  /** `auto` (default): api when MARCO_AI_BASE_URL and MARCO_AI_MODEL are set, else manual. */
  provider?: ProviderMode;
  /** Manual mode: folder for kit.md and the prompt / reply files (default `.marco/ai`). */
  dir?: string;
  /** Manual mode: stop waiting for a reply file after this many seconds (default 0 = wait). */
  timeout?: string;
  /** Manual mode: reply-file poll interval in ms (default 1000). */
  poll?: string;
}

/** A failure with a message for the professor (printed as `오류 …`, exit code 1). */
export class AiCommandError extends Error {}

const DEFAULT_DECK = 'lecture.marco.md';
const DEFAULT_OUTLINE = 'outline.txt';

function nonNegative(value: string | undefined, what: string): number {
  if (value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new AiCommandError(`${what}은(는) 0 이상의 숫자여야 합니다: ${value}`);
  return n;
}

/** The provider for this run; prints which one is used. */
export function makeProvider(o: ProviderOptions, io: CliIo): Provider {
  const env = io.env ?? process.env;
  const mode = o.provider ?? 'auto';
  const configured = Boolean(env.MARCO_AI_BASE_URL && env.MARCO_AI_MODEL);
  if (mode === 'api' || (mode === 'auto' && configured)) {
    if (!configured)
      throw new AiCommandError(
        'API 모드에는 MARCO_AI_BASE_URL과 MARCO_AI_MODEL 환경 변수가 필요합니다 (키가 필요한 서버는 MARCO_AI_API_KEY도). 네트워크 없이 쓰려면 --provider manual.',
      );
    const provider = openAICompatibleFromEnv(env);
    io.out(`${paint(io, 'cyan', 'API')} ${provider.name} · ${env.MARCO_AI_BASE_URL ?? ''}`);
    return provider;
  }
  const dir = resolve(io.cwd, o.dir ?? join('.marco', 'ai'));
  const shown = displayPath(io, dir);
  const timeoutMs = nonNegative(o.timeout, '--timeout') * 1000;
  const pollMs = nonNegative(o.poll, '--poll');
  io.out(
    `${paint(io, 'cyan', '수동 모드')} 프롬프트를 ${shown}/ 에 씁니다. 채팅창에 붙여 넣고, 답 전체를 같은 번호의 .reply.md 파일로 저장하면 이어서 진행합니다.`,
  );
  return new ManualProvider({
    dir,
    log: (line) => io.out(line.split(dir).join(shown)),
    ...(timeoutMs > 0 ? { timeoutMs } : {}),
    ...(pollMs > 0 ? { pollMs } : {}),
  });
}

function pipelineOptions(io: CliIo): PipelineOptions {
  return {
    onProgress: (e) => io.out(paint(io, 'dim', `[${e.index}/${e.total}] ${e.label}`)),
  };
}

function readInput(io: CliIo, file: string, what: string): { path: string; text: string } {
  const path = resolve(io.cwd, file);
  if (!existsSync(path)) throw new AiCommandError(`${what} 파일이 없습니다: ${file}`);
  return { path, text: readFileSync(path, 'utf8') };
}

/** Refuse to overwrite before any model call is made. */
function assertWritable(io: CliIo, file: string, force: boolean | undefined): string {
  const path = resolve(io.cwd, file);
  if (existsSync(path) && !force)
    throw new AiCommandError(`이미 있습니다: ${displayPath(io, path)} (덮어쓰려면 --force)`);
  return path;
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
}

/** Write an edited deck; editing in place keeps the previous version as `<file>.bak`. */
function writeDeck(
  io: CliIo,
  deck: { path: string; text: string },
  out: string | undefined,
  text: string,
): string {
  const path = out ? resolve(io.cwd, out) : deck.path;
  let backup = '';
  if (path === deck.path) {
    writeFileSync(`${path}.bak`, deck.text);
    backup = ` (이전 내용: ${displayPath(io, `${path}.bak`)})`;
  }
  writeText(path, text);
  io.out(`${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, path))}${backup}`);
  return path;
}

function printRun(io: CliIo, r: RunResult): void {
  for (const w of r.warnings) io.out(`${paint(io, 'yellow', '경고')} ${w}`);
  const u = r.usage;
  io.out(
    paint(
      io,
      'dim',
      `호출 ${u.calls}회 · 프롬프트 ${u.promptChars}자 + 답 ${u.replyChars}자 (약 ${estimateTokens(u.chars)} 토큰 · 글자 수 ÷ 2.5 추정)`,
    ),
  );
}

/** Lint issues of a deck plus slide-level parse diagnostics, as the repair loop expects them. */
export function deckIssues(text: string, file: string): LintIssue[] {
  const checked = checkSource(text, { file, baseDir: dirname(file) });
  const fromParse: LintIssue[] = checked.diagnostics
    .filter((d) => d.slide !== undefined && d.level !== 'info')
    .map((d) => ({
      level: d.level,
      code: d.code,
      path: '',
      message: d.message,
      ...(d.slide !== undefined ? { slide: d.slide } : {}),
    }));
  return [...fromParse, ...checked.lint];
}

function printLintSummary(io: CliIo, path: string, text: string): void {
  const checked = checkSource(text, { file: path, baseDir: dirname(path) });
  const count = (level: 'error' | 'warn'): number =>
    checked.diagnostics.filter((d) => d.level === level).length +
    checked.lint.filter((l) => l.level === level).length;
  const errors = count('error');
  io.out(
    `  ${paint(io, errors ? 'red' : 'green', `린트 · 오류 ${errors} · 경고 ${count('warn')}`)} — 자세히: ${paint(
      io,
      'cyan',
      `marco lint ${displayPath(io, path)}`,
    )}`,
  );
}

/** `7-12` → [7, 12]; `7` → [7, 7]. */
export function parseRange(value: string): [number, number] {
  const m = /^\s*(\d+)\s*(?:[-–~]\s*(\d+))?\s*$/.exec(value);
  if (!m) throw new AiCommandError(`--range는 '7-12' 형식이어야 합니다: ${value}`);
  const from = Number(m[1]);
  const to = m[2] !== undefined ? Number(m[2]) : from;
  if (to < from) throw new AiCommandError(`--range의 끝이 시작보다 앞섭니다: ${value}`);
  return [from, to];
}

/** `1-43`, `1,3,5-7`, `s-04,cover` → slide positions (numbers) and ids (strings). */
export function parseSlideList(value: string): (number | string)[] {
  const out: (number | string)[] = [];
  for (const part of value.split(',').map((p) => p.trim())) {
    if (!part) continue;
    const range = /^(\d+)\s*[-–~]\s*(\d+)$/.exec(part);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      if (b < a) throw new AiCommandError(`--slides 범위의 끝이 시작보다 앞섭니다: ${part}`);
      for (let n = a; n <= b; n++) out.push(n);
    } else out.push(/^\d+$/.test(part) ? Number(part) : part);
  }
  if (!out.length) throw new AiCommandError(`--slides가 비어 있습니다: ${value}`);
  return out;
}

/** Text between the `---` lines of a source (with them), or undefined. */
function frontMatterBlock(text: string): string | undefined {
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  if (lines[0]?.trim() !== '---') return undefined;
  const end = lines.findIndex((l, i) => i > 0 && (l.trim() === '---' || l.trim() === '...'));
  return end > 0 ? lines.slice(0, end + 1).join('\n') : undefined;
}

/** The `refs:` block of a front matter, verbatim (key line plus its indented lines). */
function refsBlock(frontMatter: string): string | undefined {
  const lines = frontMatter.split('\n');
  const start = lines.findIndex((l) => /^refs\s*:/.test(l));
  if (start < 0) return undefined;
  let end = start + 1;
  while (end < lines.length && (/^\s+\S/.test(lines[end] ?? '') || lines[end]?.trim() === ''))
    end++;
  while (end > start + 1 && lines[end - 1]?.trim() === '') end--;
  return lines.slice(start, end).join('\n');
}

const yamlString = (s: string): string => JSON.stringify(s);

// ---------------------------------------------------------------------------------------------

interface KitOptions {
  out?: string;
  print?: boolean;
}

async function aiKit(o: KitOptions, io: CliIo): Promise<number> {
  if (o.print) {
    io.out(systemPrompt().replace(/\n$/, ''));
    return 0;
  }
  const outDir = resolve(io.cwd, o.out ?? join('.marco', 'ai', 'kit'));
  const report = await buildKit({ outDir, syncCheatsheet: false });
  const k = report.kit;
  io.out(
    `${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, report.kitPath))} · ${k.chars.toLocaleString('en-US')}자 (예시 제외 ${k.charsWithoutExamples.toLocaleString('en-US')}자) · 약 ${k.tokens.toLocaleString('en-US')} 토큰`,
  );
  io.out(
    `  과제 프롬프트 ${report.files.length}개도 ${displayPath(io, outDir)}/ 에 복사했습니다 (10-개요, 20-슬라이드, 30-해설, 40-수정 …).`,
  );
  io.out(
    `  새 채팅마다 ${displayPath(io, report.kitPath)} 전체를 먼저 붙여 넣은 뒤 과제 프롬프트를 붙여 넣습니다.`,
  );
  return 0;
}

interface OutlineOptions extends ProviderOptions {
  course: string;
  week?: string;
  duration: string;
  audience?: string;
  request?: string;
  out?: string;
  force?: boolean;
}

async function aiOutline(topic: string, o: OutlineOptions, io: CliIo): Promise<number> {
  const duration = Number(o.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new AiCommandError(`--duration은 분 단위 숫자여야 합니다: ${o.duration}`);
  const out = assertWritable(io, o.out ?? DEFAULT_OUTLINE, o.force);
  const provider = makeProvider(o, io);
  const r = await runOutline(
    provider,
    {
      course: o.course,
      topic,
      duration,
      ...(o.week !== undefined ? { week: /^\d+$/.test(o.week) ? Number(o.week) : o.week } : {}),
      ...(o.audience ? { audience: o.audience } : {}),
      ...(o.request ? { request: o.request } : {}),
    },
    pipelineOptions(io),
  );
  writeText(out, r.source);
  const minutes = r.outline.reduce((sum, item) => sum + item.minutes, 0);
  io.out(
    `${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, out))} · 슬라이드 ${r.outline.length}장 · ${minutes}분`,
  );
  printRun(io, r);
  io.out(`  다음: ${paint(io, 'cyan', `marco ai slides --outline ${displayPath(io, out)}`)}`);
  return 0;
}

interface SlidesOptions extends ProviderOptions {
  outline?: string;
  batch?: string;
  range?: string;
  refs?: string;
  frontMatter?: string;
  request?: string;
  out?: string;
  force?: boolean;
}

async function aiSlides(o: SlidesOptions, io: CliIo): Promise<number> {
  const outline = readInput(io, o.outline ?? DEFAULT_OUTLINE, '개요');
  const items = parseOutline(outline.text).items;
  if (!items.length)
    throw new AiCommandError(
      `${displayPath(io, outline.path)}에 '번호 | 태그 | 제목 | 의도 | 분' 줄이 없습니다.`,
    );
  const batchSize = o.batch !== undefined ? Number(o.batch) : undefined;
  if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1))
    throw new AiCommandError(`--batch는 1 이상의 정수여야 합니다: ${o.batch}`);
  const range = o.range !== undefined ? parseRange(o.range) : undefined;

  // Front matter: --front-matter file (a deck or a bare block), else a minimal one.
  let frontMatter: string;
  if (o.frontMatter) {
    const fm = readInput(io, o.frontMatter, '머리말');
    frontMatter = frontMatterBlock(fm.text) ?? `---\n${fm.text.trim()}\n---`;
  } else {
    const cover = items.find((i) => i.type === 'cover') ?? items[0];
    frontMatter = `---\ntitle: ${yamlString(cover?.title ?? 'TODO: 강의 제목')}\n---`;
  }
  // Citable refs: the `refs:` block of --refs when it is a deck (it is then also copied into
  // a front matter that has none), the whole --refs file otherwise, else the front matter's.
  let refs = refsBlock(frontMatter);
  if (o.refs) {
    const file = readInput(io, o.refs, '출처');
    const fm = frontMatterBlock(file.text);
    const block = fm !== undefined ? refsBlock(fm) : undefined;
    if (block !== undefined && refs === undefined)
      frontMatter = frontMatter.replace(/\n(---|\.\.\.)$/, `\n${block}\n$1`);
    refs = block ?? (fm === undefined ? file.text.trim() : undefined);
  }

  const out = assertWritable(io, o.out ?? DEFAULT_DECK, o.force);
  const provider = makeProvider(o, io);
  const r = await runSlides(
    provider,
    {
      outline: outline.text,
      frontMatter,
      ...(batchSize !== undefined ? { batchSize } : {}),
      ...(range ? { range } : {}),
      ...(refs ? { refs } : {}),
      ...(o.request ? { request: o.request } : {}),
    },
    pipelineOptions(io),
  );
  writeText(out, r.source);
  io.out(
    `${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, out))} · 호출 ${r.batches}회로 슬라이드를 썼습니다.`,
  );
  printRun(io, r);
  if (!o.frontMatter)
    io.out(`  머리말(title, course, week, refs …)을 확인해 채우세요: ${displayPath(io, out)}`);
  printLintSummary(io, out, r.source);
  io.out(
    `  다음: ${paint(io, 'cyan', `marco ai notes --deck ${displayPath(io, out)} --outline ${displayPath(io, outline.path)}`)}`,
  );
  return 0;
}

interface NotesOptions extends ProviderOptions {
  deck?: string;
  slides?: string;
  outline?: string;
  cpm?: string;
  request?: string;
  out?: string;
}

async function aiNotes(o: NotesOptions, io: CliIo): Promise<number> {
  const deck = readInput(io, o.deck ?? DEFAULT_DECK, '원고');
  const outline = o.outline ? readInput(io, o.outline, '개요').text : undefined;
  const cpm = o.cpm !== undefined ? Number(o.cpm) : undefined;
  if (cpm !== undefined && (!Number.isFinite(cpm) || cpm <= 0))
    throw new AiCommandError(`--cpm은 1분에 말하는 글자 수여야 합니다: ${o.cpm}`);
  const provider = makeProvider(o, io);
  const r = await runNotes(
    provider,
    {
      deck: deck.text,
      ...(o.slides ? { slides: parseSlideList(o.slides) } : {}),
      ...(outline !== undefined ? { outline } : {}),
      ...(cpm !== undefined ? { charsPerMinute: cpm } : {}),
      ...(o.request ? { request: o.request } : {}),
    },
    pipelineOptions(io),
  );
  const path = writeDeck(io, deck, o.out, r.source);
  printRun(io, r);
  printLintSummary(io, path, r.source);
  return 0;
}

interface ReviseOptions extends ProviderOptions {
  deck?: string;
  out?: string;
}

async function aiRevise(
  slide: string,
  request: string,
  o: ReviseOptions,
  io: CliIo,
): Promise<number> {
  const deck = readInput(io, o.deck ?? DEFAULT_DECK, '원고');
  const provider = makeProvider(o, io);
  const r = await runRevise(
    provider,
    {
      deck: deck.text,
      slide: /^\d+$/.test(slide) ? Number(slide) : slide,
      request,
      lint: deckIssues(deck.text, deck.path),
    },
    pipelineOptions(io),
  );
  const path = writeDeck(io, deck, o.out, r.source);
  printRun(io, r);
  printLintSummary(io, path, r.source);
  return 0;
}

interface RepairOptions extends ProviderOptions {
  deck?: string;
  level?: 'error' | 'warn' | 'info';
  out?: string;
}

async function aiRepair(o: RepairOptions, io: CliIo): Promise<number> {
  const deck = readInput(io, o.deck ?? DEFAULT_DECK, '원고');
  const issues = deckIssues(deck.text, deck.path);
  const levels = ['info', 'warn', 'error'];
  const min = levels.indexOf(o.level ?? 'warn');
  if (!issues.some((i) => levels.indexOf(i.level) >= min)) {
    io.out(`${paint(io, 'green', '✓')} 고칠 린트 항목이 없습니다: ${displayPath(io, deck.path)}`);
    return 0;
  }
  const provider = makeProvider(o, io);
  const r = await runRepair(
    provider,
    { deck: deck.text, issues, minLevel: o.level ?? 'warn' },
    pipelineOptions(io),
  );
  const path = writeDeck(io, deck, o.out, r.source);
  io.out(`  다시 쓴 슬라이드: ${r.repaired.join(', ') || '없음'}`);
  printRun(io, r);
  printLintSummary(io, path, r.source);
  return 0;
}

interface MergeOptions {
  deck?: string;
  slide?: string;
  out?: string;
}

function aiMergeNotes(replyFile: string, o: MergeOptions, io: CliIo): number {
  const deck = readInput(io, o.deck ?? DEFAULT_DECK, '원고');
  const reply = readInput(io, replyFile, '답');
  const target =
    o.slide === undefined ? undefined : /^\d+$/.test(o.slide) ? Number(o.slide) : o.slide;
  let merged: ReturnType<typeof mergeNotes>;
  try {
    merged = mergeNotes(deck.text, reply.text, target);
  } catch (e) {
    const msg = (e as Error).message;
    throw new AiCommandError(
      /no "# slide" line/.test(msg)
        ? `답에 '# slide' 줄이 없습니다. 어느 슬라이드의 노트인지 --slide <번호|id>로 알려 주세요.`
        : msg,
    );
  }
  if (!merged.merged.length) {
    io.err(
      `${paint(io, 'red', '오류')} 합칠 노트를 찾지 못했습니다 (원고와 맞는 '# slide' 머리줄 없음).`,
    );
    for (const h of merged.unmatched) io.err(`  ${h}`);
    return 1;
  }
  const path = writeDeck(io, deck, o.out, merged.source);
  io.out(`  노트를 합친 슬라이드: ${merged.merged.join(', ')}`);
  for (const h of merged.unmatched)
    io.out(`${paint(io, 'yellow', '경고')} 원고에서 찾지 못한 머리줄: ${h}`);
  printLintSummary(io, path, merged.source);
  return 0;
}

// ---------------------------------------------------------------------------------------------

function providerOptions(cmd: Command): Command {
  return cmd
    .addOption(
      new Option('--provider <mode>', 'auto: 환경 변수가 있으면 api, 없으면 manual')
        .choices(PROVIDER_MODES)
        .default('auto'),
    )
    .option('--dir <dir>', '수동 모드: 프롬프트·답 파일 폴더', '.marco/ai')
    .option('--timeout <sec>', '수동 모드: 답 파일을 기다리는 최대 초 (0 = 계속 기다림)', '0')
    .addOption(new Option('--poll <ms>', '수동 모드: 답 파일 확인 간격(ms)').hideHelp());
}

/** Register `marco ai <step>` subcommands on `program`. */
export function addAiCommands(program: Command, io: CliIo, setExit: (code: number) => void): void {
  const run =
    <A extends unknown[]>(fn: (...args: A) => Promise<number> | number) =>
    async (...args: A): Promise<void> => {
      try {
        setExit(await fn(...args));
      } catch (e) {
        const message = (e as Error).message;
        const waited = /^timed out waiting for (.+)$/.exec(message)?.[1];
        io.err(
          `${paint(io, 'red', '오류')} ${
            waited
              ? `답 파일을 기다리는 시간이 지났습니다: ${displayPath(io, waited)}. 답을 저장한 뒤 같은 명령을 다시 실행하면 저장된 답을 이어서 씁니다.`
              : message
          }`,
        );
        setExit(1);
      }
    };

  const ai = program
    .command('ai')
    .description('AI로 개요·슬라이드·해설을 쓰고 고칩니다 (채팅창 붙여 넣기 또는 API)');

  ai.command('kit')
    .description('채팅창에 붙여 넣을 작성 안내(키트)와 과제 프롬프트를 만듭니다')
    .option('-o, --out <dir>', '출력 폴더', '.marco/ai/kit')
    .option('--print', '키트 본문을 표준 출력으로 내보냄')
    .action(run((o: KitOptions) => aiKit(o, io)));

  providerOptions(
    ai
      .command('outline')
      .description('주제로 강의 개요(번호 | 태그 | 제목 | 의도 | 분)를 만듭니다')
      .argument('<topic>', '강의 주제')
      .requiredOption('--course <course>', '과목명 (필수)')
      .option('--week <week>', '주차')
      .option('--duration <min>', '강의 시간(분)', '150')
      .option('--audience <text>', '수강생 설명')
      .option('--request <text>', '추가 요청')
      .option('-o, --out <file>', '개요 파일', DEFAULT_OUTLINE)
      .option('--force', '이미 있는 파일을 덮어씀'),
  ).action(run((topic: string, o: OutlineOptions) => aiOutline(topic, o, io)));

  providerOptions(
    ai
      .command('slides')
      .description('개요로 슬라이드를 묶음 단위로 씁니다')
      .option('--outline <file>', '개요 파일', DEFAULT_OUTLINE)
      .option('--batch <n>', '한 번에 쓸 슬라이드 수', '6')
      .option('--range <from-to>', '쓸 슬라이드 범위, 예: 7-12')
      .option('--refs <file>', '인용할 출처 (원고의 머리말 refs: 또는 출처 목록 파일)')
      .option('--front-matter <file>', '결과 앞에 붙일 머리말 (원고 또는 YAML 파일)')
      .option('--request <text>', '묶음마다 덧붙일 요청')
      .option('-o, --out <file>', '출력 원고', DEFAULT_DECK)
      .option('--force', '이미 있는 파일을 덮어씀'),
  ).action(run((o: SlidesOptions) => aiSlides(o, io)));

  providerOptions(
    ai
      .command('notes')
      .description('슬라이드마다 해설(## note)을 써서 원고에 합칩니다')
      .option('--deck <file>', '원고', DEFAULT_DECK)
      .option('--slides <list>', '대상 슬라이드, 예: 1-43 또는 3,5,s-07 (기본: 전체)')
      .option('--outline <file>', '[시간] 범위를 가져올 개요 파일')
      .option('--cpm <n>', '1분에 말하는 글자 수 (기본 350)')
      .option('--request <text>', '슬라이드마다 덧붙일 요청')
      .option('-o, --out <file>', '결과 원고 (기본: 원고를 고치고 .bak을 남김)'),
  ).action(run((o: NotesOptions) => aiNotes(o, io)));

  providerOptions(
    ai
      .command('revise')
      .description('슬라이드 하나를 요청대로 고칩니다 (그 슬라이드의 린트 결과 포함)')
      .argument('<slide>', '슬라이드 번호 또는 id')
      .argument('<request>', '고칠 내용')
      .option('--deck <file>', '원고', DEFAULT_DECK)
      .option('-o, --out <file>', '결과 원고 (기본: 원고를 고치고 .bak을 남김)'),
  ).action(
    run((slide: string, request: string, o: ReviseOptions) => aiRevise(slide, request, o, io)),
  );

  providerOptions(
    ai
      .command('repair')
      .description('린트 문제가 있는 슬라이드를 하나씩 AI에게 고치게 합니다')
      .option('--deck <file>', '원고', DEFAULT_DECK)
      .addOption(
        new Option('--level <level>', '이 수준 이상의 문제만')
          .choices(['error', 'warn', 'info'])
          .default('warn'),
      )
      .option('-o, --out <file>', '결과 원고 (기본: 원고를 고치고 .bak을 남김)'),
  ).action(run((o: RepairOptions) => aiRepair(o, io)));

  ai.command('merge-notes')
    .description('채팅창에서 받은 해설 답(## note)을 원고에 합칩니다 (모델 호출 없음)')
    .argument('<reply>', '답 파일')
    .option('--deck <file>', '원고', DEFAULT_DECK)
    .option('--slide <slide>', "답에 '# slide' 줄이 없을 때 대상 슬라이드 번호 또는 id")
    .option('-o, --out <file>', '결과 원고 (기본: 원고를 고치고 .bak을 남김)')
    .action(run((reply: string, o: MergeOptions) => aiMergeNotes(reply, o, io)));
}
