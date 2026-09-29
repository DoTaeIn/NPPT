import type { BlockType, CueKind, Lecture, Slide, ValidationError } from '@marco/schema';
import type { ImportConfig } from './config.js';

/** Legacy deck families the importer understands (PLAN.md §2). */
export type LegacyFamily = 'v20' | 'v97';

export interface ImportOptions {
  /** `auto` (default) detects `v20-slide` sections vs `data-group` sections. */
  family?: 'auto' | LegacyFamily;
  /** Folder (relative to the source file) that asset paths point into. Default `assets`. */
  assetDir?: string;
  /** Name of the input file, recorded in the report. */
  sourceName?: string;
  /** Per-deck config (`import.config.json`): stable ids, overrides, notes mode, corrections. */
  config?: ImportConfig;
  /** Where `config` came from, recorded in the report (default `inline`). */
  configSource?: string;
}

/**
 * An IR slide with the v0.2 cover/hero/divider fields (`toc`, `kicker`, `tagline`, `meta`,
 * `art`, `dark`; format.md §4). Additive: identical to `Slide` once `@marco/schema` ships them.
 */
export type ImportedSlide = Slide & {
  toc?: string;
  kicker?: string;
  tagline?: string;
  meta?: string[];
  art?: string;
  dark?: boolean;
};

export interface ImportedAsset {
  id: string;
  fileName: string;
  /** Decoded bytes; empty when the input had the payload stripped (`<STRIPPED>`). */
  bytes: Uint8Array;
  mime: string;
  title?: string;
  credit?: string;
  source?: string;
  /** True when the input carried no payload for this asset. */
  stripped?: boolean;
}

/** An element the importer could not map to a component; kept as an `html` block. */
export interface UnmappedEntry {
  /** `tag.class1.class2` of the element. */
  selector: string;
  /** `unmapped` (no rule) or `interactive` (script-driven controls → Phase 3 widget). */
  reason: 'unmapped' | 'interactive';
  count: number;
  slides: string[];
}

/** A mapping made by a heuristic rather than an explicit components.md §4 rule. */
export interface HeuristicEntry {
  rule: string;
  selector: string;
  count: number;
  slides: string[];
}

/** Scaffold or decorative markup that was intentionally not carried into the source. */
export interface DroppedEntry {
  what: string;
  count: number;
  slides: string[];
}

export interface NoteStats {
  slidesWithNotes: number;
  cues: number;
  byKind: Partial<Record<CueKind, number>>;
  /** Markers as authored → count (after alias resolution), e.g. `홉` → 230. */
  markers: Record<string, number>;
  /** Markers the note grammar does not know (kept as MEMO). */
  unknownMarkers: Record<string, number>;
  explicitCueIds: number;
  timedSlides: number;
  totalMinutes: number;
  chars: number;
}

export interface ImportReport {
  family: LegacyFamily;
  sourceName?: string;
  slideCount: number;
  slidesByType: Record<string, number>;
  /** Every block, including blocks nested in `columns`. */
  blocksByType: Partial<Record<BlockType, number>>;
  /** Blocks other than `html` (columns containers not counted, their children are). */
  mappedBlocks: number;
  /** `html` fallback blocks. */
  fallbackBlocks: number;
  /** mapped / (mapped + fallback), 0–100, one decimal. */
  mappedPercent: number;
  unmapped: UnmappedEntry[];
  heuristics: HeuristicEntry[];
  dropped: DroppedEntry[];
  /** Formatting that the source format cannot express and was flattened. */
  formatting: Record<string, number>;
  /** Slides whose visible heading (now `title`) differs from `data-title` (kept as `toc`). */
  titleMismatches: { slide: string; title: string; heading: string }[];
  /** V20: slides whose prose note was split into per-block cues. */
  noteSplit?: { split: number; total: number };
  /** What the per-deck config did (absent without a config). */
  config?: ConfigReport;
  /** Load-time correction scripts run before mapping (absent when none were requested). */
  corrections?: CorrectionsReport;
  /**
   * Fields the installed `@marco/schema` does not know yet (they were removed from the copy that
   * `validateLecture` checked; the source still carries them).
   */
  schemaPending: string[];
  validation: ValidationError[];
  notes: NoteStats;
  assets: { total: number; referenced: number; stripped: number; bytes: number };
  refs: number;
  videos: number;
  terms: number;
  data: { quiz?: number; sims?: number; terminals?: number; script?: number };
  warnings: string[];
}

export interface ConfigReport {
  /** `import.config.json` path or `inline`. */
  source: string;
  notes: 'split' | 'prose' | 'verbatim';
  /** Slide rules that matched: rule description → slide id. */
  applied: { rule: string; slide: string; id?: string; fields: string[] }[];
  /** Rules that matched no slide. */
  unmatched: string[];
  droppedRefs: string[];
  assets: string[];
}

export interface CorrectionsReport {
  requested: string[];
  /** Scripts found and run, in document order. */
  ran: string[];
  missing: string[];
  /** Exceptions thrown by a script (it ran up to that point). */
  errors: string[];
  /** Counts of what changed. */
  changed: {
    sims: boolean;
    quiz: number;
    notes: number;
    slideText: number;
    attributes: number;
  };
  /** Entries a script recorded in its own audit log (e.g. `window.AUDIT97.errors`). */
  audit: string[];
}

export interface ImportResult {
  lecture: Lecture;
  /** The `.marco.md` source (serializeMarco(lecture)). */
  source: string;
  assets: ImportedAsset[];
  report: ImportReport;
  /**
   * Data too large for inline front matter, written next to the source by `runImport` and
   * referenced from the front matter by path (e.g. `sims.json` → `window.SIMS`).
   */
  sidecars: Record<string, unknown>;
}
