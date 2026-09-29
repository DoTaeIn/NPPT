/**
 * DOM inline content → MARCO inline Markdown (`**b**`, `*em*`, `` `code` ``, `[text](url)`).
 *
 * The source format has no line-break or colour syntax for text fields, so `<br>` becomes a
 * space and styling spans keep only their text. Everything flattened is counted in
 * `FormattingStats` so the import report can say what was lost.
 */
import { isElement, isText, tagName, isBlockTag } from './dom.js';

export type FormattingStats = Record<string, number>;

export function bump(stats: FormattingStats | undefined, key: string, by = 1): void {
  if (!stats) return;
  stats[key] = (stats[key] ?? 0) + by;
}

// Private-use sentinels for emphasis delimiters; resolved after the whole string is known so
// that CommonMark flanking rules can be checked against the real neighbours.
const S_OPEN = '';
const S_CLOSE = '';
const E_OPEN = '';
const E_CLOSE = '';

const PUNCT = /[\p{P}\p{S}]/u;
const SPACE = /\s/u;
const WORD = /[\p{L}\p{N}]/u;

/** Escape characters that would otherwise start inline Markdown. */
export function escapeInline(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    const prev = text[i - 1];
    const next = text[i + 1];
    if (ch === '\\' || ch === '*' || ch === '`') out += '\\' + ch;
    else if (ch === '_' && !(prev && WORD.test(prev) && next && WORD.test(next))) out += '\\_';
    else if (ch === '<' && next && /[A-Za-z/!?]/.test(next)) out += '\\<';
    else if (ch === '~' && (next === '~' || prev === '~')) out += '\\~';
    else if (ch === '[' && text.indexOf('](', i) > i) out += '\\[';
    else out += ch;
  }
  return out;
}

function codeSpan(raw: string): string {
  const text = raw.replace(/\s+/g, ' ');
  if (!text.trim()) return '';
  let fence = '`';
  while (text.includes(fence)) fence += '`';
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function linkTarget(href: string): string {
  return /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href;
}

export interface InlineOptions {
  stats?: FormattingStats;
  /** Elements to leave out (e.g. the label `<b>` of a takeaway). */
  skip?: (el: Element) => boolean;
}

function isIcon(el: Element): boolean {
  return el.hasAttribute('data-lucide') || (tagName(el) === 'i' && !el.textContent?.trim());
}

function build(nodes: Node[], opts: InlineOptions): string {
  const stats = opts.stats;
  let out = '';
  const walk = (n: Node): void => {
    if (isText(n)) {
      out += escapeInline(n.data);
      return;
    }
    if (!isElement(n)) return;
    if (opts.skip?.(n)) return;
    const name = tagName(n);
    const kids = (): void => {
      for (const c of Array.from(n.childNodes)) walk(c);
    };
    switch (name) {
      case 'script':
      case 'style':
      case 'template':
      case 'noscript':
        return;
      case 'svg':
        if (n.textContent?.trim()) bump(stats, 'svg text dropped');
        return;
      case 'br':
        out += ' ';
        bump(stats, 'line breaks flattened');
        return;
      case 'img':
        bump(stats, 'inline images dropped');
        return;
      case 'input':
      case 'select':
      case 'textarea':
        bump(stats, 'form controls dropped');
        return;
      case 'i':
        if (isIcon(n)) {
          if (n.hasAttribute('data-lucide')) bump(stats, 'inline icons dropped');
          return;
        }
        out += E_OPEN;
        kids();
        out += E_CLOSE;
        return;
      case 'em':
      case 'cite':
      case 'dfn':
        out += E_OPEN;
        kids();
        out += E_CLOSE;
        return;
      case 'b':
      case 'strong':
        out += S_OPEN;
        kids();
        out += S_CLOSE;
        return;
      case 'small':
        // Rendered as its own line in both decks (sub-labels under a bold name).
        out += ' ';
        kids();
        return;
      case 'code':
      case 'kbd':
      case 'samp':
        out += codeSpan(n.textContent ?? '');
        return;
      case 'a': {
        const href = n.getAttribute('href');
        if (href && !href.startsWith('javascript:') && href !== '#') {
          const start = out.length;
          kids();
          const label = out.slice(start);
          out =
            out.slice(0, start) + (label.trim() ? `[${label.trim()}](${linkTarget(href)})` : '');
        } else kids();
        return;
      }
      default: {
        const cls = n.getAttribute('class') ?? '';
        if (/\b(verdict|pill|chip|card-rating|badge|gm)\b/.test(cls))
          bump(stats, 'coloured chips flattened');
        if (isBlockTag(name)) {
          out += ' ';
          kids();
          out += ' ';
        } else kids();
      }
    }
  };
  for (const node of nodes) walk(node);
  return out;
}

function flankingOk(s: string, open: number, close: number, len: number): boolean {
  const before = open > 0 ? s[open - 1] : undefined;
  const first = s[open + len];
  const last = s[close - 1];
  const after = s[close + len];
  if (!first || !last) return false;
  const isSpace = (c: string | undefined): boolean => c === undefined || SPACE.test(c);
  const isPunct = (c: string | undefined): boolean => c !== undefined && PUNCT.test(c);
  const leftFlanking = !isSpace(first) && (!isPunct(first) || isSpace(before) || isPunct(before));
  const rightFlanking = !isSpace(last) && (!isPunct(last) || isSpace(after) || isPunct(after));
  return leftFlanking && rightFlanking;
}

function resolveEmphasis(input: string, stats: FormattingStats | undefined): string {
  let s = input;
  // Move whitespace outside the delimiters and drop empty pairs.
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    s = s
      .replace(/([])(\s+)/g, '$2$1')
      .replace(/(\s+)([])/g, '$2$1')
      .replace(/|/g, '');
    if (s === before) break;
  }
  const pair = /([^-]*)|([^-]*)/;
  for (let m = pair.exec(s); m; m = pair.exec(s)) {
    const strong = m[1] !== undefined;
    const inner = (strong ? m[1] : m[2]) ?? '';
    const delim = strong ? '**' : '*';
    const open = m.index;
    const close = open + 1 + inner.length;
    // Check flanking with the real delimiter width in place.
    const probe = s.slice(0, open) + delim + inner + delim + s.slice(close + 1);
    const ok =
      inner.length > 0 && flankingOk(probe, open, open + delim.length + inner.length, delim.length);
    if (!ok && inner.length > 0)
      bump(stats, strong ? 'bold dropped (flanking)' : 'emphasis dropped (flanking)');
    s = s.slice(0, open) + (ok ? delim + inner + delim : inner) + s.slice(close + 1);
  }
  return s.replace(/[-]/g, '');
}

/** Inline Markdown for the given nodes (or the children of an element). */
export function inlineOf(nodes: Node | Node[], opts: InlineOptions = {}): string {
  const list = Array.isArray(nodes)
    ? nodes
    : isElement(nodes)
      ? Array.from(nodes.childNodes)
      : [nodes];
  const raw = build(list, opts).replace(/\s+/g, ' ');
  return resolveEmphasis(raw, opts.stats).replace(/\s+/g, ' ').trim();
}

/** Inline Markdown → plain text (links keep their label, emphasis and code marks are removed). */
export function plainText(md: string): string {
  const kept: string[] = [];
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([\\`*_<[~])/g, (_m, c: string) => `\uE010${kept.push(c) - 1}\uE011`)
    .replace(/\*\*|\*|`/g, '')
    .replace(/\uE010(\d+)\uE011/g, (_m, i: string) => kept[Number(i)] ?? '')
    .trim();
}
