/**
 * Defaults and deterministic ids for the Lecture IR.
 *
 * The compiler, importer and AI pipeline produce partial lectures (no `ir`, no slide ids,
 * `{{auto}}` cue ids, …); `normalizeLecture` fills them in so the result can be validated,
 * linted and rendered. It never mutates its input.
 */
import { parseNote } from './notes.js';
import { IR_VERSION } from './types.js';
import type { Block, Cue, Lecture, LectureMeta, Slide, SlideNote, SlideType } from './types.js';

/** A note before normalization: `cues` may be absent when only `raw` text is known. */
export type SlideNoteInput = Omit<SlideNote, 'cues'> & { cues?: Cue[] };

/** A slide before normalization: `id`, `type`, `title` and `blocks` may be absent. */
export type SlideInput = Omit<Slide, 'id' | 'type' | 'title' | 'blocks' | 'note'> & {
  id?: string;
  type?: SlideType;
  title?: string;
  blocks?: Block[];
  note?: SlideNoteInput;
};

/** A lecture before normalization: every field `normalizeLecture` can default may be absent. */
export type LectureInput = Omit<Partial<Lecture>, 'meta' | 'slides'> & {
  meta: Omit<LectureMeta, 'lang' | 'theme' | 'edition'> &
    Partial<Pick<LectureMeta, 'lang' | 'theme' | 'edition'>>;
  slides: SlideInput[];
};

export const DEFAULT_META = Object.freeze({
  lang: 'ko',
  theme: 'v20-violet',
  edition: 'instructor',
} as const satisfies Pick<LectureMeta, 'lang' | 'theme' | 'edition'>);

/** Title given to a `references` slide that has none. */
export const DEFAULT_REFERENCES_TITLE = '참고 자료';

export interface NormalizeOptions {
  /**
   * Write the cover defaults into every `cover` slide that lacks them: `kicker` =
   * `${course} · ${week}주차` (`coverKicker`) and `meta` = `[date, presenter]` (`coverMeta`).
   * Off by default: renderers apply the same defaults when the fields are absent, so the IR
   * (and any source serialized from it) keeps only what the author wrote.
   */
  coverDefaults?: boolean;
}

const nonEmptyText = (value: unknown): value is string | number =>
  (typeof value === 'string' && value.trim() !== '') ||
  (typeof value === 'number' && Number.isFinite(value));

/**
 * Default cover kicker: `${course} · ${week}주차`, or whichever part exists; `undefined` when
 * neither does (components.md §1).
 */
export function coverKicker(
  meta: Partial<Pick<LectureMeta, 'course' | 'week'>>,
): string | undefined {
  const parts: string[] = [];
  if (nonEmptyText(meta.course)) parts.push(String(meta.course).trim());
  if (nonEmptyText(meta.week)) parts.push(`${String(meta.week).trim()}주차`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Default cover meta lines: `[date, presenter]` without the missing ones; `undefined` when empty. */
export function coverMeta(
  meta: Partial<Pick<LectureMeta, 'date' | 'presenter'>>,
): string[] | undefined {
  const lines = [meta.date, meta.presenter].filter(nonEmptyText).map((line) => String(line).trim());
  return lines.length ? lines : undefined;
}

/** String fields whose whitespace is significant: never trimmed. */
const VERBATIM_KEYS: ReadonlySet<string> = new Set(['code', 'html', 'raw']);
/** Plugin payloads: cloned as-is (no trimming, no defaults). */
const OPAQUE_KEYS: ReadonlySet<string> = new Set(['params', 'sims', 'terminals']);

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Zero-padded 1-based position: 2 digits (`01`), naturally 3 from 100 on. */
export function padPosition(position: number, width = 2): string {
  return String(position).padStart(width, '0');
}

/** Default slide id for a 1-based position: `s-01`, `s-02`, … `s-100`. */
export function slideIdFor(position: number): string {
  return `s-${padPosition(position)}`;
}

/** Default cue id for a 1-based slide position and 0-based cue index: `p04-c002`. */
export function cueIdFor(slidePosition: number, cueIndex: number): string {
  return `p${padPosition(slidePosition)}-c${padPosition(cueIndex, 3)}`;
}

function cloneValue(value: unknown, key: string | undefined, trim: boolean): unknown {
  if (typeof value === 'string')
    return trim && !VERBATIM_KEYS.has(key ?? '') ? value.trim() : value;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item, key, trim));
  if (isRecord(value)) {
    const keepAsIs = !trim || (key !== undefined && OPAQUE_KEYS.has(key));
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v, k, !keepAsIs);
    return out;
  }
  return value;
}

const isMissingId = (id: unknown): boolean =>
  id === undefined ||
  id === null ||
  id === '' ||
  (typeof id === 'string' && id.toLowerCase() === 'auto');

function uniqueId(candidate: string, used: Set<string>): string {
  let id = candidate;
  for (let n = 2; used.has(id); n++) id = `${candidate}-${n}`;
  used.add(id);
  return id;
}

function normalizeBlocks(blocks: unknown): void {
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (block.type === 'callout' && block.kind === undefined) block.kind = 'info';
    if (block.type === 'columns' && Array.isArray(block.columns)) {
      for (const column of block.columns) normalizeBlocks(column);
    }
  }
}

function applyCoverDefaults(slide: Json, meta: Json): void {
  if (slide.kicker === undefined) {
    const kicker = coverKicker(meta as Partial<LectureMeta>);
    if (kicker !== undefined) slide.kicker = kicker;
  }
  if (slide.meta === undefined) {
    const lines = coverMeta(meta as Partial<LectureMeta>);
    if (lines !== undefined) slide.meta = lines;
  }
}

function normalizeNote(note: Json): void {
  if (!Array.isArray(note.cues)) {
    if (typeof note.raw === 'string') {
      const parsed = parseNote(note.raw);
      note.cues = parsed.cues;
      if (note.time === undefined && parsed.time) note.time = parsed.time;
    } else {
      note.cues = [];
    }
  }
}

/**
 * Apply IR defaults and assign missing ids. Pure: returns a new object.
 *
 * - `ir` = "0.1"; `meta.lang` "ko", `meta.theme` "v20-violet", `meta.edition` "instructor";
 *   `meta.footer` = `${course} · ${week}주차` when both exist and no footer is given.
 * - `refs`, `videos` → `[]`; `assets`, `terms` → `{}`; `slide.type` → "content";
 *   `slide.blocks` → `[]`; a `references` slide without title → "참고 자료";
 *   `callout.kind` → "info"; `note.cues` → parsed from `note.raw`, else `[]`.
 * - Slide ids `s-NN` by 1-based position; if an explicit id already uses that value the
 *   auto id gets a suffix (`s-03-2`). Explicit duplicates are left for lint.
 * - Cue ids `pNN-cKKK` (NN slide position, KKK 0-based cue index); `{{auto}}`/"auto" counts
 *   as missing; an index already used by an explicit id moves to the next free index.
 * - All strings are trimmed except `code`, `html` and `note.raw`; `params`, `sims` and
 *   `terminals` are copied verbatim. Empty `refs[].url` and `assets.*.source` are dropped.
 * - Unknown properties are kept, so `validateLecture` can still report them.
 * - With `{ coverDefaults: true }`, cover slides without `kicker`/`meta` get `coverKicker(meta)`
 *   and `coverMeta(meta)` (only when those are non-empty). An explicit value, even `""` or `[]`,
 *   is kept.
 */
export function normalizeLecture(input: LectureInput, options: NormalizeOptions = {}): Lecture {
  if (!isRecord(input)) throw new TypeError('normalizeLecture: input must be an object');
  const src = cloneValue(input, undefined, true) as Json;

  const meta: Json = isRecord(src.meta) ? src.meta : {};
  for (const [key, value] of Object.entries(DEFAULT_META)) {
    if (meta[key] === undefined) meta[key] = value;
  }
  const { course, week } = meta;
  if (
    meta.footer === undefined &&
    typeof course === 'string' &&
    course !== '' &&
    (typeof week === 'number' || (typeof week === 'string' && week !== ''))
  ) {
    meta.footer = `${course} · ${week}주차`;
  }

  const refs = src.refs ?? [];
  if (Array.isArray(refs)) {
    for (const ref of refs) if (isRecord(ref) && ref.url === '') delete ref.url;
  }
  const assets = src.assets ?? {};
  if (isRecord(assets)) {
    for (const asset of Object.values(assets)) {
      if (isRecord(asset) && asset.source === '') delete asset.source;
    }
  }

  const slides: unknown[] = Array.isArray(src.slides) ? src.slides : [];
  const usedSlideIds = new Set<string>();
  const usedCueIds = new Set<string>();
  for (const slide of slides) {
    if (!isRecord(slide)) continue;
    if (!isMissingId(slide.id) && typeof slide.id === 'string') usedSlideIds.add(slide.id);
    const note = slide.note;
    if (isRecord(note)) {
      normalizeNote(note);
      for (const cue of note.cues as unknown[]) {
        if (isRecord(cue) && !isMissingId(cue.id) && typeof cue.id === 'string')
          usedCueIds.add(cue.id);
      }
    }
  }

  slides.forEach((original, index) => {
    if (!isRecord(original)) return;
    const position = index + 1;
    // Rebuild with id and type first so emitted JSON reads naturally.
    const slide: Json = { id: undefined, type: undefined, ...original };
    if (isMissingId(slide.id)) slide.id = uniqueId(slideIdFor(position), usedSlideIds);
    if (slide.type === undefined) slide.type = 'content';
    slides[index] = slide;
    if (slide.type === 'references' && (slide.title === undefined || slide.title === '')) {
      slide.title = DEFAULT_REFERENCES_TITLE;
    }
    if (slide.blocks === undefined) slide.blocks = [];
    normalizeBlocks(slide.blocks);
    if (options.coverDefaults && slide.type === 'cover') applyCoverDefaults(slide, meta);
    const note = slide.note;
    if (!isRecord(note) || !Array.isArray(note.cues)) return;
    note.cues.forEach((cue: unknown, cueIndex: number) => {
      if (!isRecord(cue) || !isMissingId(cue.id)) return;
      let next = cueIndex;
      let id = cueIdFor(position, next);
      while (usedCueIds.has(id)) id = cueIdFor(position, ++next);
      usedCueIds.add(id);
      cue.id = id;
    });
  });

  const out: Json = {
    ir: src.ir ?? IR_VERSION,
    meta,
    refs,
    videos: src.videos ?? [],
    assets,
    terms: src.terms ?? {},
    // A non-array `slides` is kept as-is so validation reports it.
    slides: Array.isArray(src.slides) ? slides : (src.slides ?? []),
  };
  for (const [key, value] of Object.entries(src)) if (!(key in out)) out[key] = value;
  return out as unknown as Lecture;
}
