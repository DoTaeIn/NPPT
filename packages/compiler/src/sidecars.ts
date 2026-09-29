/**
 * Front-matter data kept in JSON files next to the source (`quiz: quiz.json`, `sims: sims.json`,
 * `terminals: terminals.json`), as the importer writes them for payloads too large to inline.
 * Paths are relative to the source file; a missing or unreadable file is an error.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { Diagnostic } from './diagnostics.js';
import type { Lecture, QuizItem } from './ir.js';
import type { SidecarRef } from './parse/context.js';

export interface SidecarResult {
  diagnostics: Diagnostic[];
  /** Absolute paths of the files read (for `marco watch`). */
  files: string[];
}

/** Read every sidecar into `lecture` (mutates it). */
export function loadSidecars(
  lecture: Lecture,
  refs: readonly SidecarRef[],
  opts: { baseDir: string; file?: string },
): SidecarResult {
  const diagnostics: Diagnostic[] = [];
  const files: string[] = [];
  const error = (ref: SidecarRef, code: string, message: string): void => {
    diagnostics.push({
      level: 'error',
      code,
      message,
      ...(opts.file !== undefined ? { file: opts.file } : {}),
      line: ref.line,
    });
  };
  for (const ref of refs) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref.path) && !/^[a-z]:[\\/]/i.test(ref.path)) {
      error(
        ref,
        'format.sidecar.remote',
        `${ref.key}: 원격 주소는 읽지 않습니다. 원고 옆의 JSON 파일 경로를 쓰세요: ${ref.path}`,
      );
      continue;
    }
    const path = isAbsolute(ref.path) ? ref.path : resolve(opts.baseDir, ref.path);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      error(
        ref,
        'format.sidecar.missing',
        `${ref.key}: JSON 파일을 찾을 수 없습니다: ${ref.path} (원고 파일 기준 상대 경로)`,
      );
      continue;
    }
    files.push(path);
    let value: unknown;
    try {
      value = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (e) {
      error(
        ref,
        'format.sidecar.json',
        `${ref.key}: ${ref.path}의 JSON 오류: ${(e as Error).message.split('\n')[0] ?? ''}`,
      );
      continue;
    }
    if (ref.key === 'quiz') {
      if (Array.isArray(value)) lecture.quiz = value as QuizItem[];
      else error(ref, 'format.sidecar.shape', `quiz: ${ref.path}는 JSON 배열이어야 합니다.`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lecture[ref.key] = value as Record<string, unknown>;
    } else {
      error(ref, 'format.sidecar.shape', `${ref.key}: ${ref.path}는 JSON 객체({ … })여야 합니다.`);
    }
  }
  return { diagnostics, files };
}
