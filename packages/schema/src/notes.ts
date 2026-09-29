/**
 * Presenter note grammar (docs/spec/notes.md): the professor's `[대사] … [발문] … | 10초` script.
 *
 * `parseNote` turns authored note text into a `SlideNote`; `serializeNote` is its stable
 * inverse (used by the importer and by `marco` source writers). The runtime and compiler use
 * `MARKERS`, `CUE_LABELS` and `CANONICAL_MARKERS` for labels and marker lookup.
 */
import type { Cue, CueKind, NoteTime, SlideNote } from './types.js';

/** Every cue kind, in the order the handout and the notes panel list them. */
export const CUE_KINDS: readonly CueKind[] = Object.freeze([
  'SAY',
  'DO',
  'LOOK',
  'ASK',
  'HOP',
  'SQ',
  'SA',
  'NEXT',
  'TIP',
  'WAIT',
  'SCREEN',
  'VERIFY',
  'MEMO',
] as const);

/**
 * Marker text (inside `[…]`) → cue kind. Includes the aliases found in the v9.7 deck
 * (`[홉]`, `[학생 질문]`, `[강사 답변]`, `[검증 보충]`). Lookup ignores whitespace, so
 * `[예상 질문]` and `[학생질문]` also resolve. `[시간]` is not a cue (see `TIME_MARKER`).
 */
export const MARKERS: Record<string, CueKind> = Object.freeze({
  대사: 'SAY',
  조작: 'DO',
  주목: 'LOOK',
  발문: 'ASK',
  이동: 'HOP',
  홉: 'HOP',
  예상질문: 'SQ',
  '학생 질문': 'SQ',
  예상답변: 'SA',
  '강사 답변': 'SA',
  전환: 'NEXT',
  팁: 'TIP',
  대기: 'WAIT',
  화면: 'SCREEN',
  검증: 'VERIFY',
  '검증 보충': 'VERIFY',
  메모: 'MEMO',
});

/** The marker `serializeNote` writes for each kind when a cue carries no `marker`. */
export const CANONICAL_MARKERS: Record<CueKind, string> = Object.freeze({
  SAY: '대사',
  DO: '조작',
  LOOK: '주목',
  ASK: '발문',
  HOP: '이동',
  SQ: '예상질문',
  SA: '예상답변',
  NEXT: '전환',
  TIP: '팁',
  WAIT: '대기',
  SCREEN: '화면',
  VERIFY: '검증',
  MEMO: '메모',
});

/** Korean display labels for cue kinds (notes panel, handout, narration player). */
export const CUE_LABELS: Record<CueKind, string> = Object.freeze({
  SAY: '대사',
  DO: '조작',
  LOOK: '주목',
  ASK: '발문',
  HOP: '이동',
  SQ: '예상질문',
  SA: '예상답변',
  NEXT: '전환',
  TIP: '팁',
  WAIT: '대기',
  SCREEN: '화면',
  VERIFY: '검증',
  MEMO: '메모',
});

/** `[시간]` sets `note.time`; it is not a cue. */
export const TIME_MARKER = '시간';

/** Cue kinds whose text may name focus targets anywhere (`@s-06-b1`), per notes.md. */
const FOCUS_ANYWHERE: ReadonlySet<CueKind> = new Set<CueKind>(['LOOK', 'HOP']);

const squash = (name: string): string => name.replace(/\s+/g, '');
const MARKER_INDEX: ReadonlyMap<string, CueKind> = new Map(
  Object.entries(MARKERS).map(([marker, kind]) => [squash(marker), kind]),
);

/** Cue kind for a marker name (whitespace-insensitive), or undefined when unknown. */
export function markerKind(marker: string): CueKind | undefined {
  return MARKER_INDEX.get(squash(marker));
}

/** True when `marker` is a known cue marker or `[시간]`. */
export function isKnownMarker(marker: string): boolean {
  return markerKind(marker) !== undefined || squash(marker) === TIME_MARKER;
}

// ---------------------------------------------------------------------------
// Line grammar
// ---------------------------------------------------------------------------

const MARKER_LINE = /^[ \t]*\[([^[\]\n]{1,24})\][ \t]*(.*)$/;
const HEADING_LINE = /^[ \t]*#+(?:[ \t]|$)/;
const SEPARATOR_LINE = /^[ \t]*={3,}[ \t]*$/;
/** Bracketed key names such as `[F]`, `[N]`, `[Esc]`, `[→]` are keyboard hints, not markers. */
const KEY_HINT =
  /^(?:[A-Za-z0-9]|F\d{1,2}|Enter|Esc|Space|Tab|Shift|Ctrl|Alt|Cmd|Home|End|PgUp|PgDn|PageUp|PageDown|[←→↑↓+\-?/.,])$/i;
/** Shape of an unknown marker: a Hangul word (spaces/digits allowed) or an ASCII word. */
const UNKNOWN_MARKER = /^(?:\p{Script=Hangul}[\p{Script=Hangul}0-9 ]*|[A-Za-z][A-Za-z ]+)$/u;

const CUE_ID = /^\{\{[ \t]*([^{}\s]*)[ \t]*\}\}[ \t]*/;
const DURATION = String.raw`\d+(?:\.\d+)?[ \t]*(?:초|분|s|sec|secs|min|mins)`;
const TRAILING_WAIT = new RegExp(
  String.raw`[ \t]*\|[ \t]*(${DURATION}(?:[ \t]*[~–—-][ \t]*${DURATION})?)[ \t]*$`,
);
const FOCUS_TOKEN = /(^|[\s(])@([A-Za-z][\w-]*)/g;
const LEADING_FOCUS = /^@([A-Za-z][\w-]*)(?:[ \t]+|$)/;

const CLOCK = String.raw`(\d{1,3}:\d{2})`;
const RANGE = new RegExp(
  String.raw`^${CLOCK}[ \t]*[–—~-][ \t]*${CLOCK}(?:[ \t]*[·・,/][ \t]*(.*))?$`,
);
const MINUTES =
  /^(\d+(?:\.\d+)?)[ \t]*(?:분|min|mins|minutes|m)(?![A-Za-z])(?:[ \t]*(\d+)[ \t]*초)?(?:[ \t]*[·・,/]?[ \t]*(.*))?$/i;

interface OpenCue {
  kind: CueKind;
  marker?: string;
  lines: string[];
}

/**
 * Parse `[시간]` text: `2.5분 · 10:00 – 12:30`, `2분`, `2분 30초`, `10:00-12:30` (minutes from the range),
 * with an optional trailing remark (`· 끝나면 휴식 10분`). En dash, em dash, hyphen and `~`
 * are accepted between the clock times. Returns undefined when the text is not a time.
 */
export function parseNoteTime(text: string): NoteTime | undefined {
  const source = text.trim();
  const withMinutes = MINUTES.exec(source);
  if (withMinutes) {
    const seconds = withMinutes[2] ? Number(withMinutes[2]) / 60 : 0;
    const time: NoteTime = { minutes: Number(withMinutes[1]) + seconds };
    const rest = (withMinutes[3] ?? '').trim();
    if (rest) {
      const range = RANGE.exec(rest);
      if (range) {
        time.from = range[1];
        time.to = range[2];
        const remark = (range[3] ?? '').trim();
        if (remark) time.remark = remark;
      } else {
        time.remark = rest;
      }
    }
    return time;
  }
  const rangeOnly = RANGE.exec(source);
  if (rangeOnly && rangeOnly[1] && rangeOnly[2]) {
    const minutes = clockMinutes(rangeOnly[2]) - clockMinutes(rangeOnly[1]);
    if (minutes < 0) return undefined;
    const time: NoteTime = { minutes, from: rangeOnly[1], to: rangeOnly[2] };
    const remark = (rangeOnly[3] ?? '').trim();
    if (remark) time.remark = remark;
    return time;
  }
  return undefined;
}

function clockMinutes(clock: string): number {
  const [m = '0', s = '0'] = clock.split(':');
  return Number(m) + Number(s) / 60;
}

/** Format a NoteTime the way `[시간]` is written: `2.5분 · 10:00 – 12:30`. */
export function formatNoteTime(time: NoteTime): string {
  let out = `${formatNumber(time.minutes)}분`;
  if (time.from && time.to) out += ` · ${time.from} – ${time.to}`;
  if (time.remark) out += ` · ${time.remark}`;
  return out;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : String(value);
}

function isMarkerName(name: string): boolean {
  if (KEY_HINT.test(name)) return false;
  return isKnownMarker(name) || UNKNOWN_MARKER.test(name);
}

function buildCue(open: OpenCue): Cue {
  let text = open.lines
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');

  let id: string | undefined;
  const idMatch = CUE_ID.exec(text);
  if (idMatch) {
    const value = idMatch[1] ?? '';
    if (value !== '' && value.toLowerCase() !== 'auto') id = value;
    text = text.slice(idMatch[0].length);
  }

  let wait: string | undefined;
  const waitMatch = TRAILING_WAIT.exec(text);
  if (waitMatch) {
    wait = (waitMatch[1] ?? '').trim();
    text = text.slice(0, waitMatch.index);
  }

  const targets: string[] = [];
  const addTarget = (target: string): void => {
    if (!targets.includes(target)) targets.push(target);
  };
  // Leading @targets name focus targets on any cue kind (serializeNote writes them there).
  let lead = LEADING_FOCUS.exec(text);
  while (lead) {
    addTarget(lead[1] ?? '');
    text = text.slice(lead[0].length);
    lead = LEADING_FOCUS.exec(text);
  }
  if (FOCUS_ANYWHERE.has(open.kind)) {
    text = text.replace(FOCUS_TOKEN, (_match, before: string, target: string) => {
      addTarget(target);
      return before;
    });
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
      .join('\n');
  }

  const cue: Cue = { k: open.kind, t: text.trim() };
  if (id !== undefined) cue.id = id;
  if (targets.length) cue.focus = { targets };
  if (wait !== undefined) cue.wait = wait;
  if (open.marker !== undefined) cue.marker = open.marker;
  return cue;
}

/**
 * Parse presenter note text into cues (docs/spec/notes.md).
 *
 * - `[marker]` at the start of a line opens a cue that runs until the next marker, heading
 *   (`# 해설 1|P06 · …`) or `===` separator; blank lines are skipped, other lines continue it.
 * - `{{p06-c002}}` right after the marker is the cue id; `{{auto}}` means "assign at build".
 * - A trailing `| 10초` on any cue becomes `wait`.
 * - `@target` tokens become `focus.targets`: anywhere in LOOK/HOP cues, and at the start of
 *   the text (right after the id) in any cue.
 * - `[시간] …` sets `time`; unreadable time text is kept as a MEMO cue with marker "시간"
 *   (lint `note.time.invalid`).
 * - Text outside any cue (before the first marker, or after a heading/separator) is a MEMO.
 * - Unknown markers become MEMO cues that keep `marker` (lint `note.marker.unknown`).
 * - Bracketed key hints (`[F]`, `[Esc]`, `[→]`) at line start are text, not markers.
 *
 * The input is kept verbatim in `raw`.
 */
export function parseNote(raw: string): SlideNote {
  const cues: Cue[] = [];
  let time: NoteTime | undefined;
  let open: OpenCue | undefined;

  const flush = (): void => {
    if (open) cues.push(buildCue(open));
    open = undefined;
  };

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') continue;
    if (HEADING_LINE.test(line) || SEPARATOR_LINE.test(line)) {
      flush();
      continue;
    }
    const marker = MARKER_LINE.exec(line);
    const name = marker ? (marker[1] ?? '').trim().replace(/\s+/g, ' ') : '';
    if (marker && isMarkerName(name)) {
      flush();
      const rest = marker[2] ?? '';
      if (squash(name) === TIME_MARKER) {
        const parsed = time ? undefined : parseNoteTime(rest);
        if (parsed) time = parsed;
        else open = { kind: 'MEMO', marker: name, lines: [rest] };
        continue;
      }
      const kind = markerKind(name);
      if (kind === undefined) open = { kind: 'MEMO', marker: name, lines: [rest] };
      else if (CANONICAL_MARKERS[kind] === name) open = { kind, lines: [rest] };
      else open = { kind, marker: name, lines: [rest] };
      continue;
    }
    if (!open) open = { kind: 'MEMO', lines: [] };
    open.lines.push(line);
  }
  flush();

  const note: SlideNote = time ? { time, cues, raw } : { cues, raw };
  return note;
}

/** The marker a cue is written with: its own `marker` when that still means the same kind. */
function markerFor(cue: Cue): string {
  const marker = cue.marker;
  if (marker !== undefined && marker !== '') {
    const kind = markerKind(marker);
    if (kind === cue.k) return marker;
    if (cue.k === 'MEMO' && kind === undefined && isMarkerName(marker)) return marker;
  }
  return CANONICAL_MARKERS[cue.k] ?? CANONICAL_MARKERS.MEMO;
}

/** Serialize one cue as a note line: `[주목] {{p06-c001}} @s-06-b1 text | 10초`. */
export function serializeCue(cue: Cue): string {
  const head = [`[${markerFor(cue)}]`];
  if (cue.id) head.push(`{{${cue.id}}}`);
  for (const target of cue.focus?.targets ?? []) head.push(`@${target}`);
  const text = cue.t ?? '';
  let line = text ? `${head.join(' ')} ${text}` : head.join(' ');
  if (cue.wait) line += ` | ${cue.wait}`;
  return line;
}

/** Structural equality for JSON-like note data (key order and absent-vs-undefined ignored). */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => sameData(item, b[i]))
    );
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if (!sameData(left[key], right[key])) return false;
  return true;
}

export interface SerializeNoteOptions {
  /** Always write the canonical form, even when `note.raw` is still accurate. */
  canonical?: boolean;
}

/**
 * Inverse of `parseNote`. When `note.raw` still parses to exactly `note.time` and
 * `note.cues`, it is returned verbatim, so the professor's headings (`# 해설 1|P06 · …`),
 * `===` separators and blank lines survive an import → export round trip. Otherwise (or with
 * `{ canonical: true }`) the canonical form is written: `[시간]` first, then one cue per line.
 * Either way `parseNote(serializeNote(n))` reproduces `n.time` and `n.cues`, and
 * `serializeNote(parseNote(serializeNote(n))) === serializeNote(n)`.
 */
export function serializeNote(note: SlideNote, options: SerializeNoteOptions = {}): string {
  if (!options.canonical && typeof note.raw === 'string') {
    const reparsed = parseNote(note.raw);
    if (sameData(reparsed.time, note.time) && sameData(reparsed.cues, note.cues ?? [])) {
      return note.raw;
    }
  }
  const lines: string[] = [];
  if (note.time) lines.push(`[${TIME_MARKER}] ${formatNoteTime(note.time)}`);
  for (const cue of note.cues ?? []) lines.push(serializeCue(cue));
  return lines.join('\n');
}
