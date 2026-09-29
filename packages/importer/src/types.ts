import type { BlockType, CueKind, Lecture, ValidationError } from '@marco/schema';

/** Legacy deck families the importer understands (PLAN.md §2). */
export type LegacyFamily = 'v20' | 'v97';

export interface ImportOptions {
  /** `auto` (default) detects `v20-slide` sections vs `data-group` sections. */
  family?: 'auto' | LegacyFamily;
  /** Folder (relative to the source file) that asset paths point into. Default `assets`. */
  assetDir?: string;
  /** Name of the input file, recorded in the report. */
  sourceName?: string;
}

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
  /** Slides whose visible heading differs from `data-title` (heading kept as `subtitle`). */
  titleMismatches: { slide: string; title: string; heading: string }[];
  validation: ValidationError[];
  notes: NoteStats;
  assets: { total: number; referenced: number; stripped: number; bytes: number };
  refs: number;
  videos: number;
  terms: number;
  data: { quiz?: number; sims?: number; terminals?: number; script?: number };
  warnings: string[];
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
