/**
 * MARCO Lecture IR v0.1 — the canonical intermediate representation.
 *
 * Contract shared by compiler, importer, AI pipeline and runtime (via the embedded
 * `#lecture-data` JSON). Changes must be additive; see docs/spec/format.md and
 * docs/spec/components.md for the source grammar and the HTML each block renders to.
 */

export const IR_VERSION = '0.1' as const;

export type ThemeId = 'v20-violet' | 'cau-navy';
export type Edition = 'student' | 'instructor';
export type Tone = 'neutral' | 'primary' | 'ok' | 'warn' | 'danger' | 'info';

export interface LectureMeta {
  title: string;
  course?: string;
  week?: number;
  date?: string;
  presenter?: string;
  lang: 'ko' | 'en';
  theme: ThemeId;
  edition: Edition;
  version?: string;
  /** Footer tag on every slide. Default: `${course} · ${week}주차`. */
  footer?: string;
  /** Planned lecture length in minutes (front matter `duration`); lint compares it with the sum of `[시간]`. */
  duration?: number;
}

export interface Ref {
  id: string; // e.g. "S13"
  title: string;
  url?: string;
  kind?: 'standard' | 'law' | 'paper' | 'vendor' | 'article' | 'video' | 'other';
  note?: string;
}

export interface Video {
  id: string; // YouTube id
  title: string;
  start?: number; // seconds
  credit?: string;
}

export interface Asset {
  path: string; // relative to the source file, e.g. "assets/campus.png"
  title?: string;
  credit?: string;
  source?: string; // URL of the original
  alt?: string;
  width?: number;
  height?: number;
}

/** Cue kinds. Marker → kind mapping is in docs/spec/notes.md. */
export type CueKind =
  | 'SAY' // [대사]
  | 'DO' // [조작]
  | 'LOOK' // [주목]
  | 'ASK' // [발문]
  | 'HOP' // [이동]  focus hop without speech
  | 'SQ' // [예상질문]
  | 'SA' // [예상답변]
  | 'NEXT' // [전환]
  | 'TIP' // [팁]
  | 'WAIT' // [대기]
  | 'SCREEN' // [화면]
  | 'VERIFY' // [검증] / [검증 보충]
  | 'MEMO'; // [메모] and any unknown marker

export interface Cue {
  k: CueKind;
  t: string;
  /** Stable id, e.g. "p04-c002". Assigned at build when absent. */
  id?: string;
  /** Element ids/selectors on the slide to highlight while this cue is active. */
  focus?: { targets: string[] };
  /** Trailing wait hint, e.g. "10초" from `[발문] … | 10초`. */
  wait?: string;
  /**
   * Marker text as authored when it is not the canonical marker for `k`: an alias such as
   * "검증 보충", "학생 질문" or "홉", or an unknown marker kept as MEMO (lint `note.marker.unknown`).
   * Absent for canonical markers and for text before the first marker.
   */
  marker?: string;
}

export interface NoteTime {
  minutes: number;
  from?: string; // "10:00"
  to?: string; // "12:30"
  /** Trailing remark after the range, e.g. "끝나면 휴식 10분" in `[시간] 4분 · 64:30 – 68:30 · 끝나면 휴식 10분`. */
  remark?: string;
}

export interface SlideNote {
  time?: NoteTime;
  cues: Cue[];
  /** Original note text as authored (kept for round-trips and the handout). */
  raw?: string;
}

export type SlideType = 'cover' | 'divider' | 'quote' | 'hero' | 'content' | 'references' | 'raw';

export interface Slide {
  /** Stable id used for anchors, refs and revisions. Default "s-01", "s-02", … */
  id: string;
  type: SlideType;
  /** Eyebrow text, e.g. "1부 · 3선 방어". */
  tag?: string;
  /** TOC grouping, e.g. "표지 · 도입". */
  group?: string;
  title: string;
  subtitle?: string;
  /** Guiding question strip under the title (hero slides in v9.7). */
  question?: string;
  alert?: boolean;
  /** Ref ids cited on this slide → "참고 출처" button. */
  refs?: string[];
  layout?: 'default' | 'wide';
  blocks: Block[];
  note?: SlideNote;
  /** type === 'raw' only: hand-written slide HTML. */
  html?: string;
  /** type === 'divider' only: section number shown large, e.g. "01". */
  no?: string;
  /** type === 'quote' only: attribution under the quote (the quote itself is `title`). */
  cite?: string;
  /** type === 'references' only: ref ids to list (default: all of `Lecture.refs`). */
  only?: string[];
}

// ----------------------------------------------------------------------------
// Blocks (see docs/spec/components.md for source syntax, HTML skeleton, budgets)
// ----------------------------------------------------------------------------

export interface ChainBlock {
  type: 'chain';
  items: { no?: string; label: string; sub?: string }[];
}
export interface CardsBlock {
  type: 'cards';
  cols: 2 | 3 | 4;
  items: { kicker?: string; title: string; body?: string; icon?: string; tone?: Tone }[];
}
export interface TakeawayBlock {
  type: 'takeaway';
  label?: string;
  text: string;
}
export interface TableBlock {
  type: 'table';
  head: string[];
  rows: string[][];
  caption?: string;
  align?: ('l' | 'c' | 'r')[];
}
export interface CompareBlock {
  type: 'compare';
  left: string;
  right: string;
  rows: { label: string; left: string; right: string }[];
}
export interface CalloutBlock {
  type: 'callout';
  kind: 'info' | 'warn' | 'ok' | 'danger';
  title?: string;
  body: string; // inline markdown
}
export interface StepsBlock {
  type: 'steps';
  items: { title: string; body?: string }[];
}
export interface BulletsBlock {
  type: 'bullets';
  items: string[]; // inline markdown
}
export interface ColumnsBlock {
  type: 'columns';
  cols: 2 | 3;
  columns: Block[][];
}
export interface ImageBlock {
  type: 'image';
  asset: string; // key into Lecture.assets
  caption?: string;
  zoom?: boolean;
  fit?: 'contain' | 'cover';
  height?: number; // px on the 1920x1080 canvas
}
export interface VideoBlock {
  type: 'video';
  video: string; // key into Lecture.videos
  start?: number;
  label?: string;
  caption?: string;
}
export interface QuoteBlock {
  type: 'quote';
  text: string;
  cite?: string;
}
export interface CodeBlock {
  type: 'code';
  lang?: string;
  code: string;
  title?: string;
}
export interface PillsBlock {
  type: 'pills';
  items: { tone?: Tone; text: string }[];
}
export interface VerdictBlock {
  type: 'verdict';
  verdict: 'allow' | 'drop' | 'ok' | 'hot' | 'info';
  label?: string;
  text: string;
}
export interface TimelineBlock {
  type: 'timeline';
  items: { at: string; title: string; body?: string }[];
}
export interface TilesBlock {
  type: 'tiles';
  cols: 2 | 3 | 4 | 5;
  items: { icon?: string; label: string; value?: string; tone?: Tone }[];
}
export interface TermsBlock {
  type: 'terms';
  items: { abbr: string; en?: string; ko: string }[];
}
export interface ParagraphBlock {
  type: 'paragraph';
  text: string; // inline markdown
  lead?: boolean;
}
export interface WidgetBlock {
  type: 'widget';
  name: string; // runtime plugin name, e.g. "abac", "quiz", "sim"
  params?: Record<string, unknown>;
}
export interface HtmlBlock {
  type: 'html';
  html: string;
}

export type Block =
  | ChainBlock
  | CardsBlock
  | TakeawayBlock
  | TableBlock
  | CompareBlock
  | CalloutBlock
  | StepsBlock
  | BulletsBlock
  | ColumnsBlock
  | ImageBlock
  | VideoBlock
  | QuoteBlock
  | CodeBlock
  | PillsBlock
  | VerdictBlock
  | TimelineBlock
  | TilesBlock
  | TermsBlock
  | ParagraphBlock
  | WidgetBlock
  | HtmlBlock;

export type BlockType = Block['type'];

export interface QuizItem {
  id: string; // "Q01"
  area?: number;
  areaName?: string;
  key?: string;
  q: string;
  opts: string[];
  ans: number; // index into opts
  exp?: string;
  refs?: string[];
}

export interface Lecture {
  ir: typeof IR_VERSION;
  meta: LectureMeta;
  refs: Ref[];
  videos: Video[];
  assets: Record<string, Asset>;
  /** Abbreviation → expansion, e.g. LPR → "License Plate Recognition 차량번호 인식". */
  terms: Record<string, string>;
  slides: Slide[];
  quiz?: QuizItem[];
  /** Phase 3 plugin data (network sims, terminals). Schemas TBD; see PLAN.md §12. */
  sims?: Record<string, unknown>;
  terminals?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Validation / lint result shapes (implemented in validate.ts / lint.ts)
// ----------------------------------------------------------------------------

export interface ValidationError {
  path: string; // JSON pointer, e.g. "/slides/3/blocks/1/items/0/body"
  message: string;
}
export type ValidationResult =
  { ok: true; lecture: Lecture } | { ok: false; errors: ValidationError[] };

export interface LintIssue {
  level: 'error' | 'warn' | 'info';
  code: string; // e.g. "budget.cards.body", "ref.missing", "slide.id.duplicate", "time.total"
  path: string;
  message: string;
  /** Slide id for grouping in CLI output and AI repair loops. */
  slide?: string;
}
