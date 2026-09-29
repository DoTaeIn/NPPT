import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ThemeId } from '@marco/compiler';
import { type CliIo, displayPath, paint } from '../output.js';

export interface NewOptions {
  title?: string;
  theme?: ThemeId;
  course?: string;
  week?: string;
  force?: boolean;
  /** Date written into the front matter (default: today, YYYY-MM-DD). */
  date?: string;
}

/** apps/cli/templates (one level above both src/ and dist/). */
const TEMPLATES = new URL('../../templates/', import.meta.url);

const readTemplate = (name: string): string => readFileSync(new URL(name, TEMPLATES), 'utf8');

/** Fill only the known placeholders (the note grammar also uses `{{…}}`, e.g. `{{auto}}`). */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{\{(title|course|week|theme|date)\}\}/g,
    (whole, key: string) => values[key] ?? whole,
  );
}

export function runNew(dir: string, opts: NewOptions, io: CliIo): number {
  const target = resolve(io.cwd, dir);
  const file = join(target, 'lecture.marco.md');
  if (existsSync(file) && !opts.force) {
    io.err(
      `${paint(io, 'red', '오류')} 이미 있습니다: ${displayPath(io, file)} (덮어쓰려면 --force)`,
    );
    return 1;
  }
  const week = opts.week ?? '1';
  if (!/^\d+$/.test(week)) {
    io.err(`${paint(io, 'red', '오류')} --week는 숫자여야 합니다: ${week}`);
    return 1;
  }
  const values = {
    // JSON strings are valid YAML double-quoted scalars, so any title is safe.
    title: JSON.stringify(opts.title ?? `${week}주차 · 강의 제목`),
    course: JSON.stringify(opts.course ?? '과목명'),
    week,
    theme: opts.theme ?? 'v20-violet',
    date: opts.date ?? new Date().toISOString().slice(0, 10),
  };
  mkdirSync(join(target, 'assets'), { recursive: true });
  writeFileSync(file, fillTemplate(readTemplate('lecture.marco.md'), values));
  const readme = join(target, 'assets', 'README.md');
  if (!existsSync(readme) || opts.force) writeFileSync(readme, readTemplate('assets/README.md'));
  const shown = displayPath(io, file);
  io.out(`${paint(io, 'green', '✓')} 새 강의를 만들었습니다: ${paint(io, 'bold', shown)}`);
  io.out(`  이미지는 ${displayPath(io, join(target, 'assets'))}/ 에 넣습니다.`);
  io.out(
    `  다음: ${paint(io, 'cyan', `marco build ${shown}`)}  ·  ${paint(io, 'cyan', `marco lint ${shown}`)}`,
  );
  return 0;
}
