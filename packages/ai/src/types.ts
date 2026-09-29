/**
 * Public types of the MARCO authoring pipeline (PLAN.md §9).
 *
 * The pipeline is vendor-neutral: anything that can turn a list of chat messages into a reply
 * string is a {@link Provider}. The same prompts are pasted by hand in chat mode
 * (see `ManualProvider`) or sent to an API (see `OpenAICompatibleProvider`).
 */
import type { LintIssue } from '@marco/schema';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompleteOptions {
  /** Short label for logs and prompt file names, e.g. "slides-07-12". */
  label?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface Provider {
  readonly name: string;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
}

/**
 * Size accounting for one pipeline run. `chars` is prompt + reply characters; divide by 2.5 for
 * a rough token estimate on Korean-heavy text (see `estimateTokens`).
 */
export interface Usage {
  calls: number;
  chars: number;
  promptChars: number;
  replyChars: number;
}

/** Input of the outline step (`10-개요.md`). */
export interface OutlineRequest {
  course: string;
  week?: number | string;
  topic: string;
  /** Lecture length in minutes, e.g. 150. */
  duration: number;
  /** Who the students are, e.g. "산업보안학과 2학년, 네트워크 기초 수강". */
  audience?: string;
  /** Anything the outline must cover: cases, labs, readings. */
  request?: string;
}

export type OutlineSlideType = 'cover' | 'divider' | 'quote' | 'references' | 'content';

/** One parsed outline line: `번호 | 태그 | 제목 | 한 줄 의도 | 분`. */
export interface OutlineItem {
  no: number;
  tag: string;
  title: string;
  intent: string;
  minutes: number;
  type: OutlineSlideType;
  /** Lecture clock at the start and end of the slide, e.g. "10:00" and "12:30". */
  from: string;
  to: string;
}

/** Input of the slide-writing step (`20-슬라이드.md`). */
export interface SlideBatchRequest {
  /** The outline text as returned by the outline step (fenced or not). */
  outline: string;
  /** 1-based inclusive slide numbers to write; default: the whole outline. */
  range?: [number, number];
  /** Slides per call; default 6. */
  batchSize?: number;
  /** Citable refs, e.g. "S13: Axis Secure Entry" lines or the front matter `refs:` YAML. */
  refs?: string;
  /** Deck front matter (with its `---` lines) to put in front of the returned slides. */
  frontMatter?: string;
  /** Extra instructions for every batch. */
  request?: string;
}

/** Input of the notes step (`30-해설.md`); one call per slide. */
export interface NotesRequest {
  /** Whole deck source; notes are merged into it. */
  deck: string;
  /** 1-based slide positions or slide ids; default: every slide. */
  slides?: (number | string)[];
  /** Outline text, used for `[시간]` ranges; otherwise each slide's `time:` field is used. */
  outline?: string;
  /** Spoken characters per minute; default 350 (the kit's value). */
  charsPerMinute?: number;
  /** Extra instructions for every slide. */
  request?: string;
}

/** Input of the revise step (`40-수정.md`). */
export interface ReviseRequest {
  /** Whole deck source; the revised slide replaces the original in it. */
  deck: string;
  /** 1-based slide position or slide id. */
  slide: number | string;
  /** What to change, in the professor's words. */
  request: string;
  /** `marco lint` output for this slide, as issues or as pasted text. */
  lint?: LintIssue[] | string;
}

/** Input of the validate-repair loop: lint issues for a deck, repaired slide by slide. */
export interface RepairRequest {
  deck: string;
  issues: LintIssue[];
  /** Only repair issues at or above this level; default "warn". */
  minLevel?: LintIssue['level'];
}

export interface PipelineOptions {
  /** Passed to every `Provider.complete` call. */
  complete?: Omit<CompleteOptions, 'label'>;
  /** Progress callback: one event per provider call. */
  onProgress?: (event: ProgressEvent) => void;
}

export interface ProgressEvent {
  step: 'outline' | 'slides' | 'notes' | 'revise' | 'repair';
  label: string;
  index: number;
  total: number;
}

export interface RunResult {
  /** Resulting MARCO source (outline text for runOutline, deck source otherwise). */
  source: string;
  usage: Usage;
  /** Non-fatal problems, e.g. a batch returned fewer slides than asked. */
  warnings: string[];
}
