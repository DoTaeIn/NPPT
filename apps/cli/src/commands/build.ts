import { existsSync, watch as fsWatch, type FSWatcher } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  compile,
  type CompileResult,
  type Edition,
  type FontMode,
  type ThemeId,
} from '@marco/compiler';
import {
  type CliIo,
  displayPath,
  formatBytes,
  paint,
  printDiagnostics,
  printLint,
} from '../output.js';

export interface BuildOptions {
  out?: string;
  edition?: Edition;
  theme?: ThemeId;
  fonts?: FontMode;
  keepPng?: boolean;
  strict?: boolean;
  verbose?: boolean;
}

/** `lecture.marco.md` → `lecture.html` next to the source. */
export function defaultOutFile(source: string): string {
  const name = basename(source)
    .replace(/(\.marco)?\.md$/i, '')
    .replace(/\.[^.]+$/, '');
  return join(dirname(source), `${name || 'lecture'}.html`);
}

const EDITION_LABEL: Record<Edition, string> = { instructor: '강의자용', student: '학생용' };

/** Build once and print everything. Returns the exit code. */
export async function runBuild(
  file: string,
  opts: BuildOptions,
  io: CliIo,
): Promise<{ code: number; result?: CompileResult }> {
  const source = resolve(io.cwd, file);
  if (!existsSync(source)) {
    io.err(`${paint(io, 'red', '오류')} 파일이 없습니다: ${file}`);
    return { code: 1 };
  }
  const outFile = opts.out ? resolve(io.cwd, opts.out) : defaultOutFile(source);
  const display = displayPath(io, source);
  let result: CompileResult;
  try {
    result = await compile(source, {
      outFile,
      ...(opts.edition ? { edition: opts.edition } : {}),
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.fonts ? { fonts: opts.fonts } : {}),
      ...(opts.keepPng ? { keepPng: true } : {}),
    });
  } catch (e) {
    io.err(`${paint(io, 'red', '오류')} 빌드 실패: ${(e as Error).message}`);
    return { code: 1 };
  }
  // Diagnostics carry the absolute path; show it relative to the working directory.
  const rel = (list: CompileResult['diagnostics']) =>
    list.map((d) => (d.file === source ? { ...d, file: display } : d));
  printDiagnostics(io, rel(result.diagnostics));
  printLint(io, result.lint, {
    lecture: result.lecture,
    file: display,
    slideLines: result.slideLines,
    verbose: opts.verbose ?? false,
  });
  printDiagnostics(io, rel(result.warnings));
  if (!result.ok) {
    io.err(paint(io, 'red', `✗ 빌드 중단 · ${display}의 오류를 고친 뒤 다시 실행하세요.`));
    return { code: 1, result };
  }
  const outDisplay = displayPath(io, outFile);
  io.out(
    `${paint(io, 'green', '✓')} ${paint(io, 'bold', outDisplay)} · ${formatBytes(result.stats.bytes)} · 슬라이드 ${result.stats.slides}장 · ${
      EDITION_LABEL[result.lecture.meta.edition]
    } · 글꼴 ${result.stats.fonts ?? '-'}`,
  );
  const lintErrors = result.lint.filter((l) => l.level === 'error').length;
  if (opts.strict && lintErrors) {
    io.err(paint(io, 'red', `✗ --strict: 린트 오류 ${lintErrors}건`));
    return { code: 1, result };
  }
  return { code: 0, result };
}

/**
 * Rebuild on changes to the source file or its image assets (fs.watch, debounced).
 * Resolves when `signal` aborts (or on SIGINT when no signal is given).
 */
export async function runWatch(
  file: string,
  opts: BuildOptions,
  io: CliIo,
  signal?: AbortSignal,
  debounceMs = 150,
): Promise<number> {
  const source = resolve(io.cwd, file);
  const first = await runBuild(file, opts, io);
  if (!first.result && first.code) return first.code;

  // Directories to watch → file names in them that trigger a rebuild.
  const targets = new Map<string, Set<string>>();
  const add = (path: string): void => {
    const dir = dirname(path);
    if (!existsSync(dir)) return;
    targets.set(dir, (targets.get(dir) ?? new Set()).add(basename(path)));
  };
  const collect = (result?: CompileResult): void => {
    targets.clear();
    add(source);
    for (const asset of Object.values(result?.lecture.assets ?? {})) {
      if (!/^[a-z][a-z0-9+.-]*:/i.test(asset.path)) add(resolve(dirname(source), asset.path));
    }
  };
  collect(first.result);

  let watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  let building = false;
  let again = false;
  const rewatch = (): void => {
    watchers.forEach((w) => w.close());
    watchers = [...targets].map(([dir, names]) =>
      fsWatch(dir, (_event, name) => {
        if (!name || names.has(basename(name.toString()))) schedule();
      }),
    );
  };
  const rebuild = async (): Promise<void> => {
    if (building) {
      again = true;
      return;
    }
    building = true;
    io.out(
      paint(io, 'dim', `— 변경 감지: 다시 빌드합니다 (${new Date().toLocaleTimeString('ko-KR')})`),
    );
    const next = await runBuild(file, opts, io);
    if (next.result) {
      collect(next.result);
      rewatch();
    }
    building = false;
    if (again) {
      again = false;
      schedule();
    }
  };
  const schedule = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), debounceMs);
  };
  rewatch();
  io.out(paint(io, 'cyan', `변경을 감시합니다: ${displayPath(io, source)} (끝내려면 Ctrl+C)`));

  await new Promise<void>((done) => {
    if (signal) {
      if (signal.aborted) done();
      else signal.addEventListener('abort', () => done(), { once: true });
    } else process.once('SIGINT', () => done());
  });
  clearTimeout(timer);
  watchers.forEach((w) => w.close());
  return 0;
}
