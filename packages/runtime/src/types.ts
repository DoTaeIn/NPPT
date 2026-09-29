// Runtime-side types. Schema types are imported type-only; the runtime never depends on
// @marco/schema at run time (the bundle has no dependencies).
import type {
  Asset,
  Cue,
  CueKind,
  Edition,
  LectureMeta,
  NoteTime,
  QuizItem,
  Ref,
  SlideNote,
  Video,
} from '@marco/schema';

export type { Cue, CueKind, Edition, NoteTime, Ref, SlideNote, Video };

/** Asset metadata carried in `#lecture-data`; the image bytes live in the slide's `<img src>`. */
export type AssetMeta = Pick<Asset, 'title' | 'credit' | 'source' | 'alt'>;

/** Parsed `#lecture-data` (docs/spec/runtime.md §1). */
export interface LectureData {
  ir: string;
  engine: { name: string; version: string };
  meta: Partial<LectureMeta>;
  refs: Ref[];
  videos: Video[];
  assets: Record<string, AssetMeta>;
  slideRefs: Record<string, string[]>;
  terms: Record<string, string>;
  /** Omitted in the student edition. */
  notes?: Record<string, SlideNote>;
  quiz?: QuizItem[];
  sims?: Record<string, unknown>;
  terminals?: Record<string, unknown>;
  /** Any other top-level key is kept as-is for plugins. */
  [key: string]: unknown;
}

export type PrintMode = 'lecture' | 'handout';

export interface SlideChangeDetail {
  index: number;
  id: string;
}

/** Context handed to a plugin's `mount()`. */
export interface PluginCtx {
  data: LectureData;
  edition: Edition;
  runtimeVersion: string;
  /** The slide that contains the widget element (null when outside a slide). */
  slide: HTMLElement | null;
  slideIndex: number;
  go(i: number): void;
  goId(id: string): void;
  /** Subscribes to slide changes; returns an unsubscribe function. */
  onSlideChange(fn: (detail: SlideChangeDetail) => void): () => void;
  openDialog(title: string, body: string | Node): void;
  closeDialog(): void;
}

export interface MarcoPlugin {
  mount(el: HTMLElement, params: unknown, ctx: PluginCtx): void;
}

/** `window.MARCO` (docs/spec/runtime.md §7). */
export interface MarcoApi {
  readonly version: string;
  readonly slides: HTMLElement[];
  readonly cur: number;
  go(i: number): void;
  next(): void;
  prev(): void;
  goId(id: string): void;
  toggleNotes(): void;
  toggleToc(): void;
  toggleHelp(): void;
  toggleFullscreen(): void;
  print(mode: PrintMode): void;
  registerPlugin(name: string, plugin: MarcoPlugin): void;
  readonly data: LectureData;
  about(): string;
}

declare global {
  interface Window {
    MARCO?: MarcoApi;
  }
}
