/**
 * Pull MARCO source out of a chat reply.
 *
 * The kit asks for exactly one ````marco fence, but chat assistants add prose, split the answer
 * over several fences, use three backticks around content that itself holds ``` code blocks,
 * or forget the fence entirely. This module takes all of that in its stride.
 */
import { normalizeNewlines, splitDeck, splitNote, normalizeNote } from './source.js';

export interface FencedBlock {
  info: string;
  content: string;
  /** false when the reply ended before the closing fence (truncated answer). */
  closed: boolean;
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
/** A line that can only come from MARCO source or an outline. */
const MARCO_LINE =
  /^(---\s*$|# slide(\s|$)|## note\s*$|:::|\[[^\]\n]{1,12}\]|\d{1,3}\s*\|\s*\S|[a-z]+:\s)/m;
const START_LINE = /^(---\s*$|# slide(\s|$)|## note\s*$|\[[^\]\n]{1,12}\]|\d{1,3}\s*\|\s*\S)/;
/** Typical chat sign-offs that follow an unfenced answer. */
const SIGN_OFF =
  /^(이상|필요하|원하시|추가로|참고로|혹시|도움이|다른 |더 필요|수정이 필요|let me know|i hope|hope this|feel free)/i;

/**
 * Top-level fenced blocks of a Markdown reply. Tolerant nesting: inside an open fence, a fence
 * line with an info string (```bash) opens a nested block, so a ```marco answer that contains a
 * ```bash code block is still read as one block.
 */
export function findFencedBlocks(text: string): FencedBlock[] {
  const lines = normalizeNewlines(text).split('\n');
  const blocks: FencedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_RE.exec(lines[i]!);
    if (!open || (open[1]![0] === '`' && open[2]!.includes('`'))) {
      i++;
      continue;
    }
    const stack = [open[1]!];
    const body: string[] = [];
    let j = i + 1;
    let closed = false;
    for (; j < lines.length; j++) {
      const line = lines[j]!;
      const f = FENCE_RE.exec(line);
      if (f) {
        const marker = f[1]!;
        const info = f[2]!.trim();
        const top = stack[stack.length - 1]!;
        if (info === '' && marker[0] === top[0] && marker.length >= top.length) {
          stack.pop();
          if (stack.length === 0) {
            closed = true;
            break;
          }
        } else if (info !== '' && !(marker[0] === '`' && info.includes('`'))) {
          stack.push(marker);
        }
      }
      body.push(line);
    }
    blocks.push({ info: open[2]!.trim(), content: body.join('\n'), closed });
    i = closed ? j + 1 : lines.length;
  }
  return blocks;
}

function tidy(text: string): string {
  const trimmed = text.replace(/^\s*\n/, '').replace(/\s+$/, '');
  return trimmed ? trimmed + '\n' : '';
}

function infoRank(info: string): number {
  const lang = info.split(/\s+/)[0]!.toLowerCase();
  if (lang === 'marco' || lang === 'marco.md') return 3;
  if (lang === 'outline') return 2;
  if (lang === '' || lang === 'md' || lang === 'markdown' || lang === 'text' || lang === 'txt')
    return 1;
  return 0;
}

/** Strip prose before the first MARCO-looking line and chat sign-offs after the answer. */
function stripProse(text: string): string {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => START_LINE.test(l));
  if (first < 0) return text;
  const kept = lines.slice(first);
  while (kept.length) {
    const last = kept[kept.length - 1]!.trim();
    if (last === '' || (SIGN_OFF.test(last) && !MARCO_LINE.test(last))) kept.pop();
    else break;
  }
  return kept.join('\n');
}

/**
 * Return the MARCO source (or outline) contained in a chat reply, ending with one newline.
 *
 * - One fenced block: its content.
 * - Several fenced blocks that each hold `# slide` lines: all of them, in order.
 * - Otherwise the best-looking block (```marco beats ```outline beats plain fences).
 * - No fence: the reply minus leading prose and trailing sign-offs.
 */
export function extractMarcoSource(reply: string): string {
  const text = normalizeNewlines(reply);
  const blocks = findFencedBlocks(text);
  const useful = blocks.filter((b) => MARCO_LINE.test(b.content));
  if (useful.length) {
    const withSlides = useful.filter((b) => /^# slide(\s|$)/m.test(b.content));
    if (withSlides.length > 1) return tidy(withSlides.map((b) => b.content.trim()).join('\n\n'));
    const best = [...useful].sort(
      (a, b) => infoRank(b.info) - infoRank(a.info) || b.content.length - a.content.length,
    )[0]!;
    return tidy(best.content);
  }
  if (blocks.length) {
    const largest = [...blocks].sort((a, b) => b.content.length - a.content.length)[0]!;
    return tidy(largest.content);
  }
  return tidy(stripProse(text));
}

/**
 * Pull a `## note` section out of a notes reply. Accepts a bare note, a note that forgot the
 * `## note` line, or a whole slide (then only its note is kept).
 */
export function extractNote(reply: string): string {
  const source = extractMarcoSource(reply);
  const deck = splitDeck(source);
  if (deck.slides.length) {
    const { note } = splitNote(deck.slides[0]!.text);
    return note ?? '';
  }
  const idx = source.search(/^## note\s*$/m);
  return normalizeNote(idx >= 0 ? source.slice(idx) : source);
}
