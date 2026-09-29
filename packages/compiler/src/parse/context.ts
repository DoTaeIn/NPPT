import type { Diagnostic } from '../diagnostics.js';
import type { Lecture } from '../ir.js';

/** Shared state while parsing one source file. */
export interface ParseContext {
  file: string;
  lecture: Lecture;
  diagnostics: Diagnostic[];
  /** Id of the slide being parsed (for diagnostics). */
  slide?: string;
}

export function report(
  ctx: ParseContext,
  level: Diagnostic['level'],
  code: string,
  message: string,
  line?: number,
): void {
  const d: Diagnostic = { level, code, message, file: ctx.file };
  if (line !== undefined) d.line = line;
  if (ctx.slide) d.slide = ctx.slide;
  ctx.diagnostics.push(d);
}
