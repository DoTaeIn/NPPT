/**
 * The single-file document (docs/spec/runtime.md §1): NOTICE comment with the Attribution,
 * inline CSS, `#stage > #canvas > section.slide…`, `#lecture-data` JSON, the runtime bundle.
 */
import { readFileSync } from 'node:fs';
import type { Diagnostic } from './diagnostics.js';
import type { Lecture, QuizItem, Ref, SlideNote, Video } from './ir.js';
import { escapeAttr, escapeHtml } from './render/html.js';
import { plainText } from './render/inline.js';
import { runtimeBundlePath } from './resolve.js';
import { ATTRIBUTION, ENGINE_NAME, ENGINE_REPO, ENGINE_VERSION } from './version.js';

export interface LectureData {
  ir: string;
  engine: { name: string; version: string };
  meta: Lecture['meta'];
  refs: Ref[];
  videos: Video[];
  assets: Record<string, { title?: string; credit?: string; source?: string; alt?: string }>;
  slideRefs: Record<string, string[]>;
  terms: Record<string, string>;
  notes?: Record<string, SlideNote>;
  quiz?: QuizItem[];
  sims?: Record<string, unknown>;
  terminals?: Record<string, unknown>;
}

/** `#lecture-data` payload. Notes are omitted in the student edition; `raw` note text is not embedded. */
export function buildLectureData(lecture: Lecture): LectureData {
  const assets: LectureData['assets'] = {};
  for (const [id, a] of Object.entries(lecture.assets)) {
    const meta: LectureData['assets'][string] = {};
    if (a.title !== undefined) meta.title = a.title;
    if (a.credit !== undefined) meta.credit = a.credit;
    if (a.source !== undefined) meta.source = a.source;
    if (a.alt !== undefined) meta.alt = a.alt;
    assets[id] = meta;
  }
  const slideRefs: Record<string, string[]> = {};
  for (const s of lecture.slides) if (s.refs?.length) slideRefs[s.id] = [...s.refs];
  const data: LectureData = {
    ir: lecture.ir,
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    meta: lecture.meta,
    refs: lecture.refs,
    videos: lecture.videos,
    assets,
    slideRefs,
    terms: lecture.terms,
  };
  if (lecture.meta.edition !== 'student') {
    const notes: Record<string, SlideNote> = {};
    for (const s of lecture.slides) {
      if (!s.note) continue;
      const { raw: _raw, ...note } = s.note;
      notes[s.id] = note;
    }
    data.notes = notes;
  }
  if (lecture.quiz !== undefined) data.quiz = lecture.quiz;
  if (lecture.sims !== undefined) data.sims = lecture.sims;
  if (lecture.terminals !== undefined) data.terminals = lecture.terminals;
  return data;
}

/** JSON safe inside `<script type="application/json">` (no `</script`, `<!--`, U+2028/9). */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const MISSING_RUNTIME_PLACEHOLDER =
  '/* MARCO PLACEHOLDER: @marco/runtime dist/marco-runtime.js was not found. Build it with `pnpm --filter @marco/runtime build`. */';

export function readRuntime(path = runtimeBundlePath()): { js: string; warning?: Diagnostic } {
  try {
    if (path) return { js: readFileSync(path, 'utf8') };
  } catch {
    /* reported below */
  }
  return {
    js: MISSING_RUNTIME_PLACEHOLDER,
    warning: {
      level: 'warn',
      code: 'build.runtime.missing',
      message: '런타임 번들(@marco/runtime/dist/marco-runtime.js)이 없어 자리표시자를 넣었습니다.',
    },
  };
}

export function noticeComment(): string {
  return [
    '<!--',
    `  Built with ${ENGINE_NAME} v${ENGINE_VERSION} (${ENGINE_REPO})`,
    `  ${ATTRIBUTION}`,
    '  Engine: MARCO Engine License 1.0. Lecture content © its author. Third-party notices: see NOTICE in the engine repository.',
    '-->',
  ].join('\n');
}

export interface EmitInput {
  lecture: Lecture;
  /** `<section class="slide">…` markup from renderLecture. */
  slidesHtml: string;
  css: string;
  runtimeJs: string;
  data?: LectureData;
}

export function emitDocument(input: EmitInput): string {
  const { lecture } = input;
  const meta = lecture.meta;
  const data = input.data ?? buildLectureData(lecture);
  return [
    '<!doctype html>',
    `<html lang="${escapeAttr(meta.lang)}" data-theme="${escapeAttr(meta.theme)}" data-edition="${escapeAttr(meta.edition)}">`,
    '<head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(plainText(meta.title))}</title>`,
    noticeComment(),
    `<style>\n${input.css.replace(/<\/style/gi, '<\\/style')}\n</style>`,
    '</head>',
    '<body>',
    '<div id="stage"><div id="canvas">',
    input.slidesHtml,
    '</div></div>',
    `<script id="lecture-data" type="application/json">${scriptJson(data)}</script>`,
    `<script>\n${input.runtimeJs.replace(/<\/script/gi, '<\\/script')}\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
