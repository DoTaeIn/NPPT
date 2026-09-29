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

/** Options for `openDialog` (a plain string is the `kind`). */
export interface DialogOptions {
  /** `#dialog[data-kind]`; plugins default to `widget`. */
  kind?: string;
  /**
   * Keys that reach the open dialog (the runtime has already handled `Esc`, Ctrl/⌘ shortcuts and
   * Space/Enter on a focused button). Return true when handled; the event is then prevented.
   */
  onKey?(e: KeyboardEvent): boolean | void;
  /** Called once when this dialog closes or another dialog replaces it. */
  onClose?(): void;
}

/** Parsed `data-params` of a widget element (`{}` when absent or not a JSON object). */
export type WidgetParams = Record<string, unknown>;

/** Plugin-scoped events. */
export interface PluginEvents {
  /** Listens to `marco:<type>` on document (`slidechange`, `ready`, or `<plugin>:<event>`); returns an unsubscribe. */
  on<T = unknown>(type: string, fn: (detail: T) => void): () => void;
  /** Dispatches `marco:<plugin>:<type>` from the widget element (bubbles to document). */
  emit(type: string, detail?: unknown): void;
}

/** Context handed to a plugin's `mount()`, one per widget element. */
export interface PluginCtx {
  /** The plugin (widget) name. */
  name: string;
  data: LectureData;
  edition: Edition;
  runtimeVersion: string;
  /** The slide that contains the widget element (null when outside a slide). */
  slide: HTMLElement | null;
  /** `slide.id`, or '' when outside a slide. */
  slideId: string;
  slideIndex: number;
  go(i: number): void;
  goId(id: string): void;
  /** Subscribes to slide changes; returns an unsubscribe function. */
  onSlideChange(fn: (detail: SlideChangeDetail) => void): () => void;
  /** Opens the runtime's `#dialog`; the third argument is the kind or {@link DialogOptions}. */
  openDialog(title: string, body: string | Node, opts?: string | DialogOptions): void;
  closeDialog(): void;
  /** Opens the sources dialog for these `refs` ids. */
  openSources(ids: string[]): void;
  /** Injects `<style id="marco-plugin-<name>">` once per plugin (later calls are ignored). */
  registerStyles(css: string): void;
  events: PluginEvents;
  /** Aborted when the runtime is torn down; use it for listeners on document/window. */
  signal: AbortSignal;
}

/** A widget plugin: mounts every `[data-widget="<name>"]` element. */
export interface Plugin {
  name: string;
  mount(el: HTMLElement, params: WidgetParams, ctx: PluginCtx): void;
  /** Called with the element when the runtime is torn down; stop timers and listeners here. */
  unmount?(el: HTMLElement): void;
}

/** Shape accepted by `registerPlugin(name, plugin)`, where the name comes from the first argument. */
export type MarcoPlugin = Omit<Plugin, 'name'> & { name?: string };

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
  registerPlugin(plugin: Plugin): void;
  registerPlugin(name: string, plugin: MarcoPlugin): void;
  readonly data: LectureData;
  about(): string;
}

declare global {
  interface Window {
    MARCO?: MarcoApi;
    /** Plugins whose bundle ran before the core; the core registers them when it starts. */
    MARCO_PLUGINS?: Plugin[];
  }
}
