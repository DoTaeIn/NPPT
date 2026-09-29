import type { Diagnostic } from '../diagnostics.js';
import type { Lecture } from '../ir.js';

/** Front-matter keys whose value may be a JSON file path instead of inline data. */
export const SIDECAR_KEYS = ['quiz', 'sims', 'terminals'] as const;
export type SidecarKey = (typeof SIDECAR_KEYS)[number];

/** `sims: sims.json` in the front matter: loaded by `loadSidecars` (the parser reads no files). */
export interface SidecarRef {
  key: SidecarKey;
  /** Path as written, relative to the source file. */
  path: string;
  /** 1-based file line of the key. */
  line: number;
}

/** Shared state while parsing one source file. */
export interface ParseContext {
  file: string;
  lecture: Lecture;
  diagnostics: Diagnostic[];
  /** Id of the slide being parsed (for diagnostics). */
  slide?: string;
  /** Front-matter data given as file paths. */
  sidecars: SidecarRef[];
  /** `<img data-asset>` ids seen in html blocks / raw slides, checked once all slides are parsed. */
  htmlAssets: { id: string; line: number | undefined; slide: string | undefined }[];
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
