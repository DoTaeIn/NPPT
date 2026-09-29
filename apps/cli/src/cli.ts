/**
 * `marco` command line: new | build | watch | lint | pdf | import | ai | mcp.
 * `runCli(argv, io)` is the testable entry point; it returns the exit code instead of exiting.
 */
import { Command, CommanderError, Option } from 'commander';
import {
  ENGINE_VERSION,
  FONT_MODES,
  type Edition,
  type FontMode,
  type ThemeId,
} from '@marco/compiler';
import { addAiCommands } from './commands/ai.js';
import { type BuildOptions, runBuild, runWatch } from './commands/build.js';
import { IMPORT_FAMILIES, type ImportFamily, runImportCommand } from './commands/import.js';
import { runLint } from './commands/lint.js';
import { runMcpCommand } from './commands/mcp.js';
import { runNew } from './commands/new.js';
import { PDF_MODES, type PdfMode, type PdfOptions, runPdf } from './commands/pdf.js';
import { type CliIo, defaultIo, paint } from './output.js';

const THEMES: readonly ThemeId[] = ['v20-violet', 'cau-navy'];
const EDITIONS: readonly Edition[] = ['student', 'instructor'];

interface RawBuildOptions {
  out?: string;
  edition?: Edition;
  theme?: ThemeId;
  fonts?: FontMode;
  keepPng?: boolean;
  strict?: boolean;
  verbose?: boolean;
}

function buildOptions(o: RawBuildOptions): BuildOptions {
  const out: BuildOptions = {};
  if (o.out) out.out = o.out;
  if (o.edition) out.edition = o.edition;
  if (o.theme) out.theme = o.theme;
  if (o.fonts) out.fonts = o.fonts;
  if (o.keepPng) out.keepPng = true;
  if (o.strict) out.strict = true;
  if (o.verbose) out.verbose = true;
  return out;
}

function addBuildOptions(cmd: Command): Command {
  return cmd
    .option('-o, --out <file>', '출력 HTML 경로 (기본: 원본 옆 <이름>.html)')
    .addOption(
      new Option('--edition <edition>', '판본 (머리말 edition보다 우선)').choices(EDITIONS),
    )
    .addOption(new Option('--theme <theme>', '테마 (머리말 theme보다 우선)').choices(THEMES))
    .addOption(
      new Option('--fonts <mode>', '글꼴: embed 전체 포함 · subset 사용 글자만 · none 시스템 글꼴')
        .choices(FONT_MODES)
        .default('subset'),
    )
    .option('--keep-png', '색이 많은 PNG도 WebP로 바꾸지 않고 PNG로 유지')
    .option('--strict', '린트 오류가 있으면 종료 코드 1')
    .option('--verbose', '정보 수준 린트까지 모두 표시');
}

export function createProgram(io: CliIo, setExit: (code: number) => void): Command {
  const program = new Command();
  program
    .name('marco')
    .description(
      'MARCO Engine — .marco.md 강의 원고를 한 파일짜리 1920×1080 HTML 덱으로 빌드합니다.',
    )
    .version(ENGINE_VERSION, '-v, --version', '버전 표시')
    .helpOption('-h, --help', '도움말 표시')
    .helpCommand('help [command]', '명령 도움말')
    .configureOutput({
      writeOut: (s) => io.out(s.replace(/\n$/, '')),
      writeErr: (s) => io.err(s.replace(/\n$/, '')),
    })
    .exitOverride()
    .showSuggestionAfterError();

  program
    .command('new')
    .description('새 강의 폴더와 시작용 lecture.marco.md를 만듭니다')
    .argument('<dir>', '만들 폴더')
    .option('--title <title>', '강의 제목')
    .addOption(new Option('--theme <theme>', '테마').choices(THEMES))
    .option('--course <course>', '과목명')
    .option('--week <week>', '주차 (숫자)')
    .option('--force', '이미 있는 lecture.marco.md를 덮어씀')
    .action(
      (
        dir: string,
        o: { title?: string; theme?: ThemeId; course?: string; week?: string; force?: boolean },
      ) => {
        setExit(runNew(dir, o, io));
      },
    );

  addBuildOptions(
    program
      .command('build')
      .description('원고를 HTML 덱으로 빌드합니다')
      .argument('<file>', '.marco.md 원고'),
  ).action(async (file: string, o: RawBuildOptions) => {
    setExit((await runBuild(file, buildOptions(o), io)).code);
  });

  addBuildOptions(
    program
      .command('watch')
      .description('원고·이미지·사이드카 JSON이 바뀔 때마다 다시 빌드합니다')
      .argument('<file>', '.marco.md 원고'),
  ).action(async (file: string, o: RawBuildOptions) => {
    setExit(await runWatch(file, buildOptions(o), io));
  });

  program
    .command('lint')
    .description('원고를 검사합니다 (형식 오류, 글자 예산, 출처, 시간 배분)')
    .argument('<file>', '.marco.md 원고')
    .option('--json', 'JSON으로 출력')
    .option('--verbose', '정보 수준 린트까지 모두 표시')
    .action((file: string, o: { json?: boolean; verbose?: boolean }) => {
      setExit(runLint(file, o, io));
    });

  program
    .command('pdf')
    .description('덱을 PDF로 저장합니다 (Chromium 필요; 원고를 주면 먼저 빌드)')
    .argument('<file>', '.marco.md 원고 또는 빌드한 .html')
    .addOption(
      new Option('--mode <mode>', 'lecture: 슬라이드 한 장당 1920×1080 한 쪽 · handout: A4 유인물')
        .choices(PDF_MODES)
        .default('lecture'),
    )
    .option('-o, --out <file>', 'PDF 경로 (기본: 입력 옆 <이름>.pdf, 유인물은 <이름>.handout.pdf)')
    .addOption(new Option('--edition <edition>', '원고를 빌드할 때의 판본').choices(EDITIONS))
    .addOption(new Option('--theme <theme>', '원고를 빌드할 때의 테마').choices(THEMES))
    .addOption(
      new Option('--fonts <mode>', '원고를 빌드할 때의 글꼴 처리')
        .choices(FONT_MODES)
        .default('subset'),
    )
    .option('--keep-png', '원고를 빌드할 때 PNG 유지')
    .option('--timeout <sec>', '런타임 준비를 기다리는 최대 초', '60')
    .action(
      async (
        file: string,
        o: {
          mode: PdfMode;
          out?: string;
          edition?: Edition;
          theme?: ThemeId;
          fonts?: FontMode;
          keepPng?: boolean;
          timeout: string;
        },
      ) => {
        const timeout = Number(o.timeout);
        const opts: PdfOptions = { mode: o.mode };
        if (o.out) opts.out = o.out;
        if (o.edition) opts.edition = o.edition;
        if (o.theme) opts.theme = o.theme;
        if (o.fonts) opts.fonts = o.fonts;
        if (o.keepPng) opts.keepPng = true;
        if (Number.isFinite(timeout) && timeout > 0) opts.timeoutMs = timeout * 1000;
        setExit(await runPdf(file, opts, io));
      },
    );

  program
    .command('import')
    .description('기존 한 파일짜리 HTML 덱(V20 · v9.7)을 .marco.md 원고와 이미지로 바꿉니다')
    .argument('<legacy.html>', '가져올 HTML 덱')
    .argument('<outDir>', '출력 폴더 (lecture.marco.md, assets/, IMPORT-REPORT.md …)')
    .addOption(
      new Option('--family <family>', '덱 계열 (auto: 자동 판별)')
        .choices(IMPORT_FAMILIES)
        .default('auto'),
    )
    .option('--keep-source', '이미 있는 lecture.marco.md는 그대로 두고 나머지만 다시 씀')
    .option('--asset-dir <dir>', '이미지 폴더 이름', 'assets')
    .action(
      async (
        input: string,
        outDir: string,
        o: { family: ImportFamily; keepSource?: boolean; assetDir?: string },
      ) => {
        setExit(
          (
            await runImportCommand(
              input,
              outDir,
              {
                family: o.family,
                ...(o.keepSource ? { keepSource: true } : {}),
                ...(o.assetDir ? { assetDir: o.assetDir } : {}),
              },
              io,
            )
          ).code,
        );
      },
    );

  addAiCommands(program, io, setExit);

  program
    .command('mcp')
    .description('AI 앱(Claude Desktop·Claude Code·Cursor 등)용 MCP 서버를 stdio로 실행합니다')
    .option('--root <dir>', '도구가 읽고 쓸 수 있는 폴더 (기본: 현재 폴더)')
    .option('--allow-write', '루트 안에 파일 쓰기 허용 (기본값)')
    .option('--read-only', '파일을 쓰지 않음 (새 강의·저장·가져오기 거부, 빌드는 검사만)')
    .action(async (o: { root?: string; readOnly?: boolean }) => {
      setExit(await runMcpCommand(o, io));
    });

  return program;
}

/** Run the CLI with `argv` (without `node` and the script path). Resolves to the exit code. */
export async function runCli(argv: string[], io: CliIo = defaultIo()): Promise<number> {
  let code = 0;
  const program = createProgram(io, (c) => {
    code = c;
  });
  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (e) {
    if (e instanceof CommanderError) {
      // --help / --version / missing command end here with exitCode 0 or 1.
      return e.exitCode;
    }
    io.err(`${paint(io, 'red', '오류')} ${(e as Error).message}`);
    return 1;
  }
  return code;
}
