/**
 * @marco/compiler — `.marco.md` → Lecture IR → single-file HTML deck.
 * Pipeline: parse → normalize → validate → lint → assets → render → fonts/CSS → emit.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { processAssets } from './assets.js';
import { type Diagnostic, hasErrors } from './diagnostics.js';
import { buildLectureData, emitDocument, readRuntime, usesWidgets } from './emit.js';
import { buildStyles, type FontMode } from './fonts.js';
import { inlineHtmlAssets } from './html-images.js';
import type { Edition, Lecture, LintIssue, ThemeId } from './ir.js';
import { parseMarco } from './parse/index.js';
import { renderLecture } from './render/slides.js';
import { assetRootsIn, type RuntimeBundle } from './resolve.js';
import { loadSidecars } from './sidecars.js';
import { lintLecture, normalizeLecture, validateLecture } from '@marco/schema';
import { ENGINE_VERSION } from './version.js';

export {
  parseMarco,
  mergeNoteTime,
  CONTAINERS,
  SIDECAR_KEYS,
  type ParseOptions,
  type ParseResult,
  type SidecarKey,
  type SidecarRef,
} from './parse/index.js';
export { loadSidecars, type SidecarResult } from './sidecars.js';
export {
  scanImages,
  resolveHtmlImages,
  inlineHtmlAssets,
  htmlAssetIds,
  type HtmlImage,
} from './html-images.js';
export {
  renderLecture,
  renderSlide,
  footerText,
  type LectureRenderOptions,
} from './render/slides.js';
export {
  renderBlock,
  DEFAULT_VERDICT_LABELS,
  type AssetData,
  type RenderOptions,
} from './render/blocks.js';
export { renderInline, plainText, wrapTerms } from './render/inline.js';
export { iconSvg, iconHtml, lintIcons } from './render/icons.js';
export {
  processAssets,
  sniffImage,
  usedAssetIds,
  type AssetOptions,
  type AssetResult,
} from './assets.js';
export { buildStyles, usedChars, FONT_MODES, type FontMode, type StyleResult } from './fonts.js';
export {
  emitDocument,
  buildLectureData,
  scriptJson,
  noticeComment,
  readRuntime,
  usesWidgets,
  missingRuntimePlaceholder,
  type LectureData,
  type RuntimeScript,
} from './emit.js';
export {
  runtimeBundlePath,
  runtimeDistDir,
  designSystemDistDir,
  readRuntimeManifest,
  setAssetRoots,
  getAssetRoots,
  assetRootsIn,
  RUNTIME_BUNDLE_FILES,
  type AssetRoots,
  type RuntimeBundle,
  type RuntimeManifest,
} from './resolve.js';
export { formatDiagnostic, hasErrors, type Diagnostic } from './diagnostics.js';
export { ATTRIBUTION, ENGINE_NAME, ENGINE_VERSION } from './version.js';
export type {
  Lecture,
  Slide,
  SlideTitleFields,
  LectureMeta,
  LintIssue,
  Edition,
  ThemeId,
} from './ir.js';

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
  /** Advanced/testing: design-system dist directory. */
  designSystemDir?: string;
  /** Advanced/testing: inline exactly this runtime file, whatever the deck uses. */
  runtimePath?: string;
  /** Advanced/testing: runtime dist directory (manifest.json + bundles) to choose from. */
  runtimeDir?: string;
  /** Advanced/testing: set false to embed images without sharp. */
  useSharp?: boolean;
  /**
   * Advanced: a packaged assets directory holding `runtime/` (runtime dist) and `css/`
   * (design-system dist), as shipped by the `marco-engine` npm package. `runtimeDir` and
   * `designSystemDir` still win. For a process-wide default use `setAssetRoots()`.
   */
  assetsDir?: string;
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
  /** `runtime`: the inlined bundle, `all` (with plugins) when the deck has widgets, else `core`. */
  stats: { slides: number; bytes: number; fonts?: FontMode; runtime?: RuntimeBundle };
  /** 1-based source line of each slide header, keyed by slide id. */
  slideLines: Record<string, number>;
  /** Absolute paths of other files the source pulled in (sidecar JSON), for watchers. */
  inputs: string[];
  outFile?: string;
}

export interface CheckResult {
  lecture: Lecture;
  diagnostics: Diagnostic[];
  lint: LintIssue[];
  /** 1-based source line of each slide header, keyed by slide id (for lint output). */
  slideLines: Record<string, number>;
  /** Absolute paths of sidecar JSON files read (`sims: sims.json`). */
  inputs: string[];
}

export interface CheckOptions {
  /** File name for diagnostics; also locates sidecar files when `baseDir` is not given. */
  file?: string;
  /** Directory that sidecar paths (`sims: sims.json`) are relative to. Default: the file's directory, else the working directory. */
  baseDir?: string;
  edition?: Edition;
  theme?: ThemeId;
}

/** Parse, load sidecars, normalize, validate and lint a source text without rendering. */
export function checkSource(text: string, options: CheckOptions = {}): CheckResult {
  const parsed = parseMarco(text, options.file !== undefined ? { file: options.file } : {});
  const diagnostics = parsed.diagnostics;
  const baseDir =
    options.baseDir ??
    (options.file !== undefined ? dirname(resolve(options.file)) : process.cwd());
  const sidecars = loadSidecars(parsed.lecture, parsed.sidecars, {
    baseDir,
    ...fileOf(options.file),
  });
  diagnostics.push(...sidecars.diagnostics);
  if (options.edition) parsed.lecture.meta.edition = options.edition;
  if (options.theme) parsed.lecture.meta.theme = options.theme;
  let lecture = parsed.lecture;
  try {
    lecture = normalizeLecture(parsed.lecture);
  } catch (e) {
    diagnostics.push({
      level: 'error',
      code: 'schema.normalize',
      message: `정규화 실패: ${(e as Error).message}`,
      ...fileOf(options.file),
    });
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
    diagnostics.push({
      level: 'warn',
      code: 'schema.lint',
      message: `린트 실행 실패: ${(e as Error).message}`,
      ...fileOf(options.file),
    });
  }
  const slideLines: Record<string, number> = {};
  lecture.slides.forEach((s, i) => {
    const line = parsed.slideLines[i];
    if (line !== undefined && slideLines[s.id] === undefined) slideLines[s.id] = line;
  });
  return { lecture, diagnostics, lint, slideLines, inputs: sidecars.files };
}

const fileOf = (file: string | undefined): { file?: string } =>
  file !== undefined ? { file } : {};

export async function compile(
  sourcePath: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const absolute = resolve(sourcePath);
  const text = await readFile(absolute, 'utf8');
  const checkOpts: CheckOptions = { file: sourcePath, baseDir: dirname(absolute) };
  if (options.edition) checkOpts.edition = options.edition;
  if (options.theme) checkOpts.theme = options.theme;
  const { lecture, diagnostics, lint, slideLines, inputs } = checkSource(text, checkOpts);
  const warnings: Diagnostic[] = [];
  const result: CompileResult = {
    ok: false,
    html: '',
    lecture,
    diagnostics,
    lint,
    warnings,
    slideLines,
    inputs,
    stats: { slides: lecture.slides.length, bytes: 0 },
  };
  if (hasErrors(diagnostics)) return result;

  const assets = await processAssets(lecture, {
    baseDir: dirname(absolute),
    keepPng: options.keepPng ?? false,
    ...(options.useSharp !== undefined ? { useSharp: options.useSharp } : {}),
  });
  warnings.push(...assets.warnings);

  // `<img data-asset>` / `src="assets/…"` in html blocks and raw slides get the data URI too.
  const slidesHtml = renderLecture(inlineHtmlAssets(lecture, assets.data), {
    assets: assets.data,
    warn: (d) => warnings.push(d),
  });
  const data = buildLectureData(lecture);
  // runtime.md §7: decks with any [data-widget] get the bundle with every plugin.
  const bundle = usesWidgets(slidesHtml) ? 'all' : 'core';
  const packaged = options.assetsDir !== undefined ? assetRootsIn(options.assetsDir) : undefined;
  const designSystemDir = options.designSystemDir ?? packaged?.designSystemDir;
  const runtime = readRuntime(
    options.runtimePath,
    bundle,
    options.runtimeDir ?? packaged?.runtimeDir,
  );
  if (runtime.warning) warnings.push(runtime.warning);

  // Everything the audience or presenter can see feeds the font subset.
  const runtimeText = [...new Set(runtime.js)]
    .filter((ch) => (ch.codePointAt(0) ?? 0) > 0x7f)
    .join('');
  const styles = await buildStyles({
    mode: options.fonts ?? 'subset',
    text: `${slidesHtml}\n${JSON.stringify(data)}\n${runtimeText}\n${lecture.meta.title}`,
    ...(designSystemDir !== undefined ? { designSystemDir } : {}),
  });
  warnings.push(...styles.warnings);

  const html = emitDocument({ lecture, slidesHtml, css: styles.css, runtimeJs: runtime.js, data });
  result.ok = true;
  result.html = html;
  result.stats = {
    slides: lecture.slides.length,
    bytes: Buffer.byteLength(html),
    fonts: styles.mode,
    runtime: runtime.bundle,
  };
  if (options.outFile) {
    await writeFile(options.outFile, html);
    result.outFile = options.outFile;
  }
  return result;
}
