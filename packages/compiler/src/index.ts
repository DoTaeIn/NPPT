/**
 * @marco/compiler — `.marco.md` → Lecture IR → single-file HTML deck.
 * Pipeline: parse → normalize → validate → lint → assets → render → fonts/CSS → emit.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { processAssets } from './assets.js';
import { type Diagnostic, hasErrors } from './diagnostics.js';
import { buildLectureData, emitDocument, readRuntime } from './emit.js';
import { buildStyles, type FontMode } from './fonts.js';
import type { Edition, Lecture, LintIssue, ThemeId } from './ir.js';
import { parseMarco } from './parse/index.js';
import { renderLecture } from './render/slides.js';
import { lintLecture, normalizeLecture, validateLecture } from '@marco/schema';
import { ENGINE_VERSION } from './version.js';

export { parseMarco, CONTAINERS, type ParseOptions, type ParseResult } from './parse/index.js';
export { renderLecture, renderSlide, footerText, type LectureRenderOptions } from './render/slides.js';
export { renderBlock, DEFAULT_VERDICT_LABELS, type AssetData, type RenderOptions } from './render/blocks.js';
export { renderInline, plainText, wrapTerms } from './render/inline.js';
export { iconSvg, iconHtml } from './render/icons.js';
export { processAssets, sniffImage, type AssetOptions, type AssetResult } from './assets.js';
export { buildStyles, usedChars, FONT_MODES, type FontMode, type StyleResult } from './fonts.js';
export { emitDocument, buildLectureData, scriptJson, noticeComment, type LectureData } from './emit.js';
export { formatDiagnostic, hasErrors, type Diagnostic } from './diagnostics.js';
export { ATTRIBUTION, ENGINE_NAME, ENGINE_VERSION } from './version.js';
export type { Lecture, Slide, LectureMeta } from './ir.js';

/** @deprecated use ENGINE_VERSION */
export const COMPILER_VERSION = ENGINE_VERSION;

export interface CompileOptions {
  /** Overrides front-matter `edition`. */
  edition?: Edition;
  /** Overrides front-matter `theme`. */
  theme?: ThemeId;
  /** Font handling (default `subset`). */
  fonts?: FontMode;
  /** Keep PNGs as PNG instead of converting many-colour PNGs to WebP. */
  keepPng?: boolean;
  /** Write the HTML here when the build succeeds. */
  outFile?: string;
  /** Advanced/testing: design-system dist directory and runtime bundle path. */
  designSystemDir?: string;
  runtimePath?: string;
  /** Advanced/testing: set false to embed images without sharp. */
  useSharp?: boolean;
}

export interface CompileResult {
  /** True when no errors stopped the build (html is then non-empty). */
  ok: boolean;
  html: string;
  lecture: Lecture;
  /** Parse (`format.*`) and validation (`schema.*`) messages. */
  diagnostics: Diagnostic[];
  /** `lintLecture()` issues (budgets, refs, time, ids). */
  lint: LintIssue[];
  /** Build warnings (`asset.*`, `font.*`, `icon.*`, `build.*`). */
  warnings: Diagnostic[];
  stats: { slides: number; bytes: number; fonts?: FontMode };
  /** 1-based source line of each slide header, keyed by slide id. */
  slideLines: Record<string, number>;
  outFile?: string;
}

export interface CheckResult {
  lecture: Lecture;
  diagnostics: Diagnostic[];
  lint: LintIssue[];
  /** 1-based source line of each slide header, keyed by slide id (for lint output). */
  slideLines: Record<string, number>;
}

/** Parse, normalize, validate and lint a source text without rendering. */
export function checkSource(
  text: string,
  options: { file?: string; edition?: Edition; theme?: ThemeId } = {},
): CheckResult {
  const parsed = parseMarco(text, options.file !== undefined ? { file: options.file } : {});
  const diagnostics = parsed.diagnostics;
  if (options.edition) parsed.lecture.meta.edition = options.edition;
  if (options.theme) parsed.lecture.meta.theme = options.theme;
  let lecture = parsed.lecture;
  try {
    lecture = normalizeLecture(parsed.lecture);
  } catch (e) {
    diagnostics.push({ level: 'error', code: 'schema.normalize', message: `정규화 실패: ${(e as Error).message}`, ...fileOf(options.file) });
  }
  const validation = validateLecture(lecture);
  if (!validation.ok) {
    for (const e of validation.errors) {
      // Map `/slides/N/...` back to the slide header line.
      const index = /^\/slides\/(\d+)/.exec(e.path)?.[1];
      const line = index !== undefined ? parsed.slideLines[Number(index)] : undefined;
      const slide = index !== undefined ? lecture.slides[Number(index)]?.id : undefined;
      diagnostics.push({
        level: 'error',
        code: 'schema.invalid',
        message: `${e.path || '/'}: ${e.message}`,
        ...fileOf(options.file),
        ...(line !== undefined ? { line } : {}),
        ...(slide !== undefined ? { slide } : {}),
      });
    }
  }
  let lint: LintIssue[] = [];
  try {
    lint = lintLecture(lecture);
  } catch (e) {
    diagnostics.push({ level: 'warn', code: 'schema.lint', message: `린트 실행 실패: ${(e as Error).message}`, ...fileOf(options.file) });
  }
  const slideLines: Record<string, number> = {};
  lecture.slides.forEach((s, i) => {
    const line = parsed.slideLines[i];
    if (line !== undefined && slideLines[s.id] === undefined) slideLines[s.id] = line;
  });
  return { lecture, diagnostics, lint, slideLines };
}

const fileOf = (file: string | undefined): { file?: string } => (file !== undefined ? { file } : {});

export async function compile(sourcePath: string, options: CompileOptions = {}): Promise<CompileResult> {
  const absolute = resolve(sourcePath);
  const text = await readFile(absolute, 'utf8');
  const checkOpts: { file?: string; edition?: Edition; theme?: ThemeId } = { file: sourcePath };
  if (options.edition) checkOpts.edition = options.edition;
  if (options.theme) checkOpts.theme = options.theme;
  const { lecture, diagnostics, lint, slideLines } = checkSource(text, checkOpts);
  const warnings: Diagnostic[] = [];
  const result: CompileResult = {
    ok: false,
    html: '',
    lecture,
    diagnostics,
    lint,
    warnings,
    slideLines,
    stats: { slides: lecture.slides.length, bytes: 0 },
  };
  if (hasErrors(diagnostics)) return result;

  const assets = await processAssets(lecture, {
    baseDir: dirname(absolute),
    keepPng: options.keepPng ?? false,
    ...(options.useSharp !== undefined ? { useSharp: options.useSharp } : {}),
  });
  warnings.push(...assets.warnings);

  const slidesHtml = renderLecture(lecture, { assets: assets.data, warn: (d) => warnings.push(d) });
  const data = buildLectureData(lecture);
  const runtime = readRuntime(options.runtimePath);
  if (runtime.warning) warnings.push(runtime.warning);

  // Everything the audience or presenter can see feeds the font subset.
  const runtimeText = runtime.js.replace(/[\x00-\x7f]+/g, '');
  const styles = await buildStyles({
    mode: options.fonts ?? 'subset',
    text: `${slidesHtml}\n${JSON.stringify(data)}\n${runtimeText}\n${lecture.meta.title}`,
    ...(options.designSystemDir !== undefined ? { designSystemDir: options.designSystemDir } : {}),
  });
  warnings.push(...styles.warnings);

  const html = emitDocument({ lecture, slidesHtml, css: styles.css, runtimeJs: runtime.js, data });
  result.ok = true;
  result.html = html;
  result.stats = { slides: lecture.slides.length, bytes: Buffer.byteLength(html), fonts: styles.mode };
  if (options.outFile) {
    await writeFile(options.outFile, html);
    result.outFile = options.outFile;
  }
  return result;
}
