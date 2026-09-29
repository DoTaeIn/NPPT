/**
 * V20 prose notes → one `[대사]` cue per block.
 *
 * A V20 `data-note` is the slide's visible text run together (the deck read it aloud). The
 * splitter finds each block's text in the note, in order, and cuts the note at those points, so
 * every cue carries `@<block id>` (components.md: `<slide id>-b<n>`, cards and steps per item
 * `-i<m>`, blocks inside columns `-b<n>-i<col>-b<k>`). Joined with spaces, the cue texts are the
 * original note. Text before the first matched block (the heading) is a cue without a target.
 */
import { parseNote } from '@marco/schema';
import type { Block, Cue, SlideNote } from '@marco/schema';
import { sourceText } from './blocks.js';
import { plainText } from './inline.js';

export interface Segment {
  target: string;
  text: string;
}

const join = (parts: (string | undefined)[]): string => parts.filter(Boolean).join(' ');

/** The text a block shows, as plain text (inline Markdown removed). */
export function blockText(b: Block): string {
  const p = (s: string | undefined): string => (s ? plainText(s) : '');
  switch (b.type) {
    case 'paragraph':
      return p(b.text);
    case 'bullets':
      return join(b.items.map(p));
    case 'steps':
      return join(b.items.flatMap((i) => [p(i.title), p(i.body)]));
    case 'chain':
      return join(b.items.flatMap((i) => [i.no, p(i.label), p(i.sub)]));
    case 'cards':
      return join(b.items.flatMap((i) => [p(i.kicker), p(i.title), p(i.body)]));
    case 'takeaway':
      return join([p(b.label), p(b.text)]);
    case 'table':
      return join([p(b.caption), ...b.head.map(p), ...b.rows.flat().map(p)]);
    case 'compare':
      return join([
        p(b.left),
        p(b.right),
        ...b.rows.flatMap((r) => [p(r.label), p(r.left), p(r.right)]),
      ]);
    case 'callout':
      return join([p(b.title), p(b.body)]);
    case 'image':
      return p(b.caption);
    case 'video':
      return join([p(b.label), p(b.caption)]);
    case 'quote':
      return join([p(b.text), p(b.cite)]);
    case 'code':
      return b.code;
    case 'pills':
      return join(b.items.map((i) => p(i.text)));
    case 'verdict':
      return join([p(b.label), p(b.text)]);
    case 'timeline':
      return join(b.items.flatMap((i) => [i.at, p(i.title), p(i.body)]));
    case 'tiles':
      return join(b.items.flatMap((i) => [p(i.label), p(i.value)]));
    case 'terms':
      return join(b.items.flatMap((i) => [i.abbr, i.en, i.ko]));
    case 'columns':
      return join(b.columns.flat().map(blockText));
    case 'widget':
      return '';
    case 'html':
      return sourceText.get(b) ?? b.html.replace(/<[^>]*>/g, ' ');
  }
}

function segmentsOf(b: Block, id: string, out: Segment[]): void {
  if (b.type === 'cards' || b.type === 'steps') {
    b.items.forEach((_item, n) => {
      const one = { ...b, items: [b.items[n]] } as Block;
      out.push({ target: `${id}-i${n + 1}`, text: blockText(one) });
    });
    return;
  }
  if (b.type === 'columns') {
    b.columns.forEach((col, c) =>
      col.forEach((nb, k) => segmentsOf(nb, `${id}-i${c + 1}-b${k + 1}`, out)),
    );
    return;
  }
  out.push({ target: id, text: sourceText.get(b) ?? blockText(b) });
}

/** Focus targets and texts of a slide's blocks, in reading order. */
export function blockSegments(blocks: Block[], slideId: string): Segment[] {
  const out: Segment[] = [];
  blocks.forEach((b, i) => segmentsOf(b, `${slideId}-b${i + 1}`, out));
  return out;
}

/** Letters and digits only (lower-cased), with each key char's index in the original text. */
function keyOf(text: string): { key: string; pos: number[] } {
  let key = '';
  const pos: number[] = [];
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(cp);
    if (/[\p{L}\p{N}]/u.test(ch)) {
      const lower = ch.toLowerCase();
      for (let k = 0; k < lower.length; k++) pos.push(i);
      key += lower;
    }
    i += ch.length;
  }
  return { key, pos };
}

/** Cut points: `[offset in note, target]` for each block found in order. */
export function splitPoints(note: string, segments: Segment[]): { at: number; target: string }[] {
  const { key, pos } = keyOf(note);
  const points: { at: number; target: string }[] = [];
  let cursor = 0;
  let last = 0;
  for (const seg of segments) {
    const sk = keyOf(seg.text).key;
    if (sk.length < 4) continue;
    const probe = sk.slice(0, 24);
    let hit = key.indexOf(probe, cursor);
    let len = probe.length;
    if (hit < 0 && sk.length > 24) {
      hit = key.indexOf(sk.slice(0, 12), cursor);
      len = 12;
    }
    if (hit < 0) continue;
    if (key.startsWith(sk, hit)) len = sk.length;
    // Snap back to the start of the word (a segment may begin with punctuation: “, ①, ( …).
    let at = pos[hit] ?? 0;
    while (at > last && !/\s/.test(note[at - 1] ?? ' ')) at--;
    if (points.length && at <= (points[points.length - 1]?.at ?? -1)) continue;
    points.push({ at, target: seg.target });
    last = at;
    cursor = hit + len;
  }
  return points;
}

/**
 * Split a V20 prose note into per-block `[대사]` cues. Returns undefined when nothing matched
 * or the result would not survive a parse round trip (the caller then keeps one prose cue).
 */
export function splitProseNote(
  prose: string,
  blocks: Block[],
  slideId: string,
): SlideNote | undefined {
  const note = prose.replace(/\s+/g, ' ').trim();
  if (!note) return undefined;
  const points = splitPoints(note, blockSegments(blocks, slideId));
  if (!points.length) return undefined;
  const cues: { target?: string; text: string }[] = [];
  const lead = note.slice(0, points[0]?.at ?? 0).trim();
  // Leading text (usually the heading) is its own cue; bare symbols (▶, ↗) join the first cue.
  if (lead && keyOf(lead).key) cues.push({ text: lead });
  else if (points[0]) points[0].at = 0;
  points.forEach((pt, i) => {
    const text = note.slice(pt.at, points[i + 1]?.at ?? note.length).trim();
    if (text) cues.push({ target: pt.target, text });
  });
  if (cues.length === 1 && !cues[0]?.target) return undefined;
  const raw = cues
    .map((c) => (c.target ? `[대사] @${c.target} ${c.text}` : `[대사] ${c.text}`))
    .join('\n');
  const parsed = parseNote(raw);
  const ok =
    parsed.cues.length === cues.length &&
    parsed.cues.every((c: Cue, i) => {
      const want = cues[i];
      const targets = c.focus?.targets ?? [];
      return (
        c.k === 'SAY' &&
        c.t === want?.text &&
        (want.target ? targets.length === 1 && targets[0] === want.target : !targets.length)
      );
    }) &&
    cues.map((c) => c.text).join(' ') === note;
  return ok ? parsed : undefined;
}
