/**
 * `marco` command line: new | build | watch | lint | import | ai.
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
import { type BuildOptions, runBuild, runWatch } from './commands/build.js';
import { runLint } from './commands/lint.js';
import { runNew } from './commands/new.js';
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
      .description('원고와 이미지가 바뀔 때마다 다시 빌드합니다')
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
    .command('import')
    .description('기존 HTML 덱을 .marco.md로 변환합니다 (준비 중)')
    .argument('[args...]')
    .allowUnknownOption()
    .action(() => {
      io.out(
        `${paint(io, 'yellow', '준비 중')} marco import는 @marco/importer 패키지와 함께 제공됩니다.`,
      );
    });

  program
    .command('ai')
    .description('AI로 개요·슬라이드·노트를 작성하고 고칩니다 (준비 중)')
    .argument('[args...]')
    .allowUnknownOption()
    .action(() => {
      io.out(`${paint(io, 'yellow', '준비 중')} marco ai는 @marco/ai 패키지와 함께 제공됩니다.`);
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
