import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkSource, lintIcons } from '@marco/compiler';
import { type CliIo, displayPath, paint, printDiagnostics, printLint } from '../output.js';

export interface LintOptions {
  json?: boolean;
  verbose?: boolean;
}

/** Parse → normalize → validate → lint (no rendering). Exit 1 on any error. */
export function runLint(file: string, opts: LintOptions, io: CliIo): number {
  const source = resolve(io.cwd, file);
  if (!existsSync(source)) {
    io.err(`${paint(io, 'red', '오류')} 파일이 없습니다: ${file}`);
    return 1;
  }
  const display = displayPath(io, source);
  const checked = checkSource(readFileSync(source, 'utf8'), { file: display });
  const lint = [...checked.lint, ...lintIcons(checked.lecture)];
  const errors =
    checked.diagnostics.filter((d) => d.level === 'error').length +
    lint.filter((l) => l.level === 'error').length;
  if (opts.json) {
    io.out(
      JSON.stringify(
        {
          file: display,
          ok: errors === 0,
          diagnostics: checked.diagnostics,
          lint,
          slideLines: checked.slideLines,
        },
        null,
        2,
      ),
    );
    return errors ? 1 : 0;
  }
  printDiagnostics(io, checked.diagnostics);
  printLint(io, lint, {
    lecture: checked.lecture,
    file: display,
    slideLines: checked.slideLines,
    verbose: opts.verbose ?? false,
  });
  return errors ? 1 : 0;
}
