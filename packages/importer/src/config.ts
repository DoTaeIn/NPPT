/**
 * Per-deck import configuration (`import.config.json` next to the imported example).
 *
 * The importer is deterministic; everything a human would otherwise hand-edit after an import
 * (stable slide ids, a better cover line, a ref to leave out) lives here, so an example can be
 * regenerated from the legacy deck at any time and still carry its polish.
 *
 * ```json
 * {
 *   "notes": "split",
 *   "slides": [
 *     { "at": 1, "id": "cover" },
 *     { "legacyTitle": "사원증이 유효하면, 들어가도 되는가?", "id": "intro" },
 *     { "at": 5, "id": "part-1", "set": { "toc": "1부 · 인증과 하드웨어" } }
 *   ],
 *   "cover": { "kicker": "보안시스템 운영 및 활용 · 3주차" },
 *   "assets": { "campus": { "credit": "imagegen 생성" } },
 *   "dropRefs": ["R03"],
 *   "corrections": ["correctAttackFlows", "applyCorrections97"]
 * }
 * ```
 */
import type { Asset, SlideType } from '@marco/schema';
import type { LegacyFamily } from './types.js';

/** How V20 prose notes (`data-note`) become cues. v9.7 notes are structured and kept verbatim. */
export type NotesMode = 'split' | 'prose';

/** Slide fields a config may set (after the import, before serialization). */
export interface SlideOverrides {
  title?: string;
  subtitle?: string;
  toc?: string;
  tag?: string;
  group?: string;
  question?: string;
  kicker?: string;
  tagline?: string;
  meta?: string[];
  art?: string;
  dark?: boolean;
  layout?: 'default' | 'wide';
}

/** One slide rule: select by 1-based position (`at`) or by the legacy `data-title`. */
export interface SlideRule {
  at?: number;
  legacyTitle?: string;
  /** Stable slide id (`[A-Za-z][\w-]*`), replacing the positional `s-NN`. */
  id?: string;
  set?: SlideOverrides;
}

export interface ImportConfig {
  /** Force the legacy family (default: detected). */
  family?: LegacyFamily;
  /** V20 notes: `split` (default) = one `[대사]` cue per block with `@<block id>`; `prose` = one cue. */
  notes?: NotesMode;
  slides?: SlideRule[];
  /** Overrides for the first slide (the cover or opening hero); same keys as `slides[].set`. */
  cover?: SlideOverrides;
  /** Asset metadata overrides by asset id. */
  assets?: Record<string, Pick<Asset, 'title' | 'credit' | 'source' | 'alt'>>;
  /** Ref ids removed from the front matter and from every slide's `refs` / `only`. */
  dropRefs?: string[];
  /**
   * Load-time correction scripts of the legacy deck to run before mapping, by IIFE function
   * name (`(function applyCorrections97(){…})()`) or `<script id>`. They run in document order
   * in a `node:vm` context over the parsed DOM and the deck's `window.SIMS/QUIZ/SCRIPT` data.
   * This executes the deck's own code, so it is opt-in per deck.
   */
  corrections?: string[];
}

export class ImportConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid import config:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ImportConfigError';
  }
}

const SLIDE_ID = /^[A-Za-z][\w-]*$/;
const OVERRIDE_STRINGS = [
  'title',
  'subtitle',
  'toc',
  'tag',
  'group',
  'question',
  'kicker',
  'tagline',
  'art',
] as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  where: string,
  problems: string[],
): void {
  for (const key of Object.keys(value)) {
    if (key.startsWith('$')) continue; // `$schema`, `$comment`
    if (!allowed.includes(key))
      problems.push(`${where}: unknown key \`${key}\` (allowed: ${allowed.join(', ')})`);
  }
}

function checkOverrides(value: unknown, where: string, problems: string[]): SlideOverrides {
  if (!isRecord(value)) {
    problems.push(`${where}: must be an object`);
    return {};
  }
  checkKeys(value, [...OVERRIDE_STRINGS, 'meta', 'dark', 'layout'], where, problems);
  const out: SlideOverrides = {};
  for (const key of OVERRIDE_STRINGS) {
    const v = value[key];
    if (v === undefined) continue;
    if (typeof v !== 'string') problems.push(`${where}.${key}: must be a string`);
    else out[key] = v;
  }
  if (value.meta !== undefined) {
    if (!Array.isArray(value.meta) || !value.meta.every((m) => typeof m === 'string'))
      problems.push(`${where}.meta: must be a list of strings`);
    else out.meta = value.meta as string[];
  }
  if (value.dark !== undefined) {
    if (typeof value.dark !== 'boolean') problems.push(`${where}.dark: must be true or false`);
    else out.dark = value.dark;
  }
  if (value.layout !== undefined) {
    if (value.layout !== 'default' && value.layout !== 'wide')
      problems.push(`${where}.layout: must be "default" or "wide"`);
    else out.layout = value.layout;
  }
  return out;
}

/** Validate a parsed `import.config.json`; throws `ImportConfigError` listing every problem. */
export function parseImportConfig(input: unknown): ImportConfig {
  const problems: string[] = [];
  if (!isRecord(input)) throw new ImportConfigError(['the config must be a JSON object']);
  checkKeys(
    input,
    ['family', 'notes', 'slides', 'cover', 'assets', 'dropRefs', 'corrections'],
    'config',
    problems,
  );
  const config: ImportConfig = {};
  if (input.family !== undefined) {
    if (input.family !== 'v20' && input.family !== 'v97')
      problems.push('config.family: must be "v20" or "v97"');
    else config.family = input.family;
  }
  if (input.notes !== undefined) {
    if (input.notes !== 'split' && input.notes !== 'prose')
      problems.push('config.notes: must be "split" or "prose"');
    else config.notes = input.notes;
  }
  if (input.slides !== undefined) {
    if (!Array.isArray(input.slides)) problems.push('config.slides: must be a list');
    else {
      const ids = new Set<string>();
      config.slides = input.slides.map((raw, i): SlideRule => {
        const where = `config.slides[${i}]`;
        if (!isRecord(raw)) {
          problems.push(`${where}: must be an object`);
          return {};
        }
        checkKeys(raw, ['at', 'legacyTitle', 'id', 'set'], where, problems);
        const rule: SlideRule = {};
        const hasAt = raw.at !== undefined;
        const hasTitle = raw.legacyTitle !== undefined;
        if (hasAt === hasTitle)
          problems.push(`${where}: give exactly one of \`at\` (position) or \`legacyTitle\``);
        if (hasAt) {
          if (typeof raw.at !== 'number' || !Number.isInteger(raw.at) || raw.at < 1)
            problems.push(`${where}.at: must be a 1-based slide position`);
          else rule.at = raw.at;
        }
        if (hasTitle) {
          if (typeof raw.legacyTitle !== 'string' || !raw.legacyTitle.trim())
            problems.push(`${where}.legacyTitle: must be a non-empty string`);
          else rule.legacyTitle = raw.legacyTitle;
        }
        if (raw.id !== undefined) {
          if (typeof raw.id !== 'string' || !SLIDE_ID.test(raw.id))
            problems.push(`${where}.id: must match ${SLIDE_ID.source}`);
          else if (/^s-\d+$/.test(raw.id))
            problems.push(`${where}.id: \`${raw.id}\` looks like a positional id; pick a name`);
          else if (ids.has(raw.id)) problems.push(`${where}.id: \`${raw.id}\` is used twice`);
          else {
            ids.add(raw.id);
            rule.id = raw.id;
          }
        }
        if (raw.set !== undefined) rule.set = checkOverrides(raw.set, `${where}.set`, problems);
        return rule;
      });
    }
  }
  if (input.cover !== undefined) config.cover = checkOverrides(input.cover, 'config.cover', problems);
  if (input.assets !== undefined) {
    if (!isRecord(input.assets)) problems.push('config.assets: must be an object');
    else {
      config.assets = {};
      for (const [id, raw] of Object.entries(input.assets)) {
        const where = `config.assets.${id}`;
        if (!isRecord(raw)) {
          problems.push(`${where}: must be an object`);
          continue;
        }
        checkKeys(raw, ['title', 'credit', 'source', 'alt'], where, problems);
        const meta: Pick<Asset, 'title' | 'credit' | 'source' | 'alt'> = {};
        for (const key of ['title', 'credit', 'source', 'alt'] as const) {
          const v = raw[key];
          if (v === undefined) continue;
          if (typeof v !== 'string') problems.push(`${where}.${key}: must be a string`);
          else meta[key] = v;
        }
        config.assets[id] = meta;
      }
    }
  }
  for (const key of ['dropRefs', 'corrections'] as const) {
    const v = input[key];
    if (v === undefined) continue;
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.trim()))
      problems.push(`config.${key}: must be a list of non-empty strings`);
    else config[key] = v as string[];
  }
  if (problems.length) throw new ImportConfigError(problems);
  return config;
}

/** Slide types whose cover fields (`kicker`, `tagline`, `meta`, `art`, `dark`) are rendered. */
export const TITLE_SLIDE_TYPES: readonly SlideType[] = ['cover', 'hero', 'divider'];
