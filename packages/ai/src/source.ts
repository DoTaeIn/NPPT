/**
 * Light-weight, line-based helpers over MARCO source text (docs/spec/format.md §1, §3, §6).
 *
 * The pipeline only needs to cut a deck into slides, find one, replace one and attach a
 * `## note`; it never needs the full IR, so this stays independent of the compiler.
 */
import type { SlideType } from '@marco/schema';

export const SLIDE_TYPES: readonly SlideType[] = [
  'cover',
  'divider',
  'quote',
  'hero',
  'content',
  'references',
  'raw',
];

export interface SlideChunk {
  /** 1-based position in the deck. */
  position: number;
  /** The `# slide …` header line. */
  header: string;
  /** `id=` from the header, if any. */
  explicitId?: string;
  /** Effective id: the explicit id or `s-NN` by position (format.md §7). */
  id: string;
  type: SlideType;
  /** Header line through the end of the slide (notes included), ending with one "\n". */
  text: string;
}

export interface DeckParts {
  /** Front matter including both `---` lines and a trailing newline, or "". */
  frontMatter: string;
  /** Text between the front matter and the first slide (usually blank). */
  preamble: string;
  slides: SlideChunk[];
}

const HEADER_RE = /^# slide(?:\s|$)/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const NOTE_RE = /^## note\s*$/;

export function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** Tracks fenced code blocks line by line so `# slide` inside code is not a header. */
class FenceTracker {
  private open: string | null = null;

  /** Feed one line; returns true when the line is inside (or opens/closes) a fence. */
  feed(line: string): boolean {
    const m = FENCE_RE.exec(line);
    if (this.open) {
      if (
        m &&
        m[2]!.trim() === '' &&
        m[1]![0] === this.open[0] &&
        m[1]!.length >= this.open.length
      ) {
        this.open = null;
      }
      return true;
    }
    if (m && !(m[1]![0] === '`' && m[2]!.includes('`'))) {
      this.open = m[1]!;
      return true;
    }
    return false;
  }
}

export interface SlideHeader {
  type: SlideType;
  explicitId?: string;
  alert: boolean;
  attrs: Record<string, string>;
}

export function parseSlideHeader(line: string): SlideHeader {
  const tokens = line
    .replace(/^# slide/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const header: SlideHeader = { type: 'content', alert: false, attrs: {} };
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq > 0) {
      const key = token.slice(0, eq);
      const value = token.slice(eq + 1).replace(/^["']|["']$/g, '');
      header.attrs[key] = value;
      if (key === 'id') header.explicitId = value;
    } else if (token === 'alert') {
      header.alert = true;
    } else if ((SLIDE_TYPES as readonly string[]).includes(token)) {
      header.type = token as SlideType;
    }
  }
  return header;
}

export function defaultSlideId(position: number): string {
  return `s-${String(position).padStart(2, '0')}`;
}

function finish(lines: string[]): string {
  return lines.join('\n').replace(/\s+$/, '') + '\n';
}

/** Cut MARCO source into front matter, preamble and slides. */
export function splitDeck(source: string): DeckParts {
  const lines = normalizeNewlines(source).split('\n');
  let start = 0;
  let frontMatter = '';
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && (l.trim() === '---' || l.trim() === '...'));
    if (end > 0) {
      frontMatter = lines.slice(0, end + 1).join('\n') + '\n';
      start = end + 1;
    }
  }
  const fences = new FenceTracker();
  const preamble: string[] = [];
  const chunks: { header: string; lines: string[] }[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    const inFence = fences.feed(line);
    if (!inFence && HEADER_RE.test(line)) {
      chunks.push({ header: line.trimEnd(), lines: [line.trimEnd()] });
    } else if (chunks.length) {
      chunks[chunks.length - 1]!.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  const slides = chunks.map((chunk, i): SlideChunk => {
    const parsed = parseSlideHeader(chunk.header);
    const position = i + 1;
    const slide: SlideChunk = {
      position,
      header: chunk.header,
      id: parsed.explicitId ?? defaultSlideId(position),
      type: parsed.type,
      text: finish(chunk.lines),
    };
    if (parsed.explicitId) slide.explicitId = parsed.explicitId;
    return slide;
  });
  const pre = preamble.join('\n').trim();
  return { frontMatter, preamble: pre ? pre + '\n' : '', slides };
}

/** Inverse of {@link splitDeck}: slides separated by one blank line, final newline. */
export function joinDeck(parts: DeckParts): string {
  const head = [parts.frontMatter.trimEnd(), parts.preamble.trimEnd()].filter(Boolean);
  const body = parts.slides.map((s) => s.text.trimEnd());
  return [...head, ...body].join('\n\n') + '\n';
}

/** Find a slide by 1-based position, explicit id, default id (`s-04`) or numeric string. */
export function findSlide(parts: DeckParts, ref: number | string): SlideChunk | undefined {
  if (typeof ref === 'number') return parts.slides[ref - 1];
  const key = ref.trim();
  return (
    parts.slides.find((s) => s.explicitId === key) ??
    parts.slides.find((s) => s.id === key) ??
    (/^\d+$/.test(key) ? parts.slides[Number(key) - 1] : undefined)
  );
}

/** Replace one slide in a deck and return the new deck source. Throws when not found. */
export function replaceSlide(deck: string, ref: number | string, slideText: string): string {
  const parts = splitDeck(deck);
  const target = findSlide(parts, ref);
  if (!target) throw new Error(`slide ${String(ref)} not found`);
  target.text = finish(normalizeNewlines(slideText).split('\n'));
  return joinDeck(parts);
}

/** Split one slide's text into its body and its `## note` section (note keeps the `## note` line). */
export function splitNote(slideText: string): { body: string; note?: string } {
  const lines = normalizeNewlines(slideText).split('\n');
  const fences = new FenceTracker();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!fences.feed(line) && NOTE_RE.test(line)) {
      const note = lines.slice(i).join('\n').trim();
      return { body: finish(lines.slice(0, i)), note: note + '\n' };
    }
  }
  return { body: finish(lines) };
}

/** Make sure a note starts with the `## note` line. */
export function normalizeNote(noteText: string): string {
  // Tolerate "## note[시간] …" (heading glued to the first cue) from a sloppy reply.
  const text = normalizeNewlines(noteText)
    .trim()
    .replace(/^## note[ \t]*(?=\[)/, '## note\n');
  return (NOTE_RE.test(text.split('\n')[0] ?? '') ? text : `## note\n${text}`) + '\n';
}

/** Remove one `key: value` line from a slide's field block (the lines right under the header). */
export function removeField(slideText: string, key: string): string {
  const lines = normalizeNewlines(slideText).split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') break;
    if (new RegExp(`^${key}:(\\s|$)`).test(line)) {
      lines.splice(i, 1);
      break;
    }
  }
  return lines.join('\n');
}

/**
 * Replace (or add) the `## note` section of one slide. When the note carries `[시간]`, the
 * slide's `time:` field is dropped: the note now owns the timing, and the compiler would
 * otherwise prefer a differing `time:` value (warning `format.note.time`).
 */
export function mergeNote(slideText: string, noteText: string): string {
  const note = normalizeNote(noteText);
  let { body } = splitNote(slideText);
  if (/^\[시간\]/m.test(note)) body = removeField(body, 'time');
  return `${body.trimEnd()}\n\n${note}`;
}

/** Read a `key: value` field from a slide's field block (the lines right under the header). */
export function slideField(slideText: string, key: string): string | undefined {
  const lines = normalizeNewlines(slideText).split('\n').slice(1);
  for (const line of lines) {
    if (line.trim() === '') break;
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m && m[1] === key) return m[2]!.trim();
  }
  return undefined;
}

/** Minutes from a `time:` value or `[시간]` text such as "2.5분 · 10:00 – 12:30". */
export function parseMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /(\d+(?:\.\d+)?)\s*분?/.exec(value);
  return m ? Number(m[1]) : undefined;
}

/** Lecture clock "m:ss" for a minute offset, e.g. 12.5 → "12:30". */
export function formatClock(minutes: number): string {
  const total = Math.round(minutes * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Time budget string as used by `[시간]`: "2.5분 · 10:00 – 12:30". */
export function formatTimeRange(minutes: number, from: number): string {
  return `${minutes}분 · ${formatClock(from)} – ${formatClock(from + minutes)}`;
}

export interface MergeNotesResult {
  source: string;
  /** Ids of slides that received a note. */
  merged: string[];
  /** Header lines from the reply that matched no slide. */
  unmatched: string[];
}

/**
 * Merge a notes reply into a deck. The reply is either a bare `## note` section (then `target`
 * names the slide) or several `# slide …` header lines each followed by `## note` (chat mode,
 * `30-해설.md` with several slides). Slides are matched by explicit id, then by an identical,
 * unique header line.
 */
export function mergeNotes(
  deck: string,
  reply: string,
  target?: number | string,
): MergeNotesResult {
  const parts = splitDeck(deck);
  const incoming = splitDeck(reply);
  const merged: string[] = [];
  const unmatched: string[] = [];
  if (incoming.slides.length === 0) {
    if (target === undefined) throw new Error('reply has no "# slide" line; pass the target slide');
    const slide = findSlide(parts, target);
    if (!slide) throw new Error(`slide ${String(target)} not found`);
    slide.text = mergeNote(slide.text, reply);
    return { source: joinDeck(parts), merged: [slide.id], unmatched };
  }
  for (const chunk of incoming.slides) {
    const { note } = splitNote(chunk.text);
    if (!note) continue;
    const byId = chunk.explicitId
      ? parts.slides.find((s) => s.explicitId === chunk.explicitId)
      : undefined;
    const sameHeader = parts.slides.filter((s) => s.header.trim() === chunk.header.trim());
    const slide = byId ?? (sameHeader.length === 1 ? sameHeader[0] : undefined);
    if (!slide) {
      unmatched.push(chunk.header);
      continue;
    }
    slide.text = mergeNote(slide.text, note);
    merged.push(slide.id);
  }
  return { source: joinDeck(parts), merged, unmatched };
}
