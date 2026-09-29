/**
 * Extract JSON-compatible data assigned in inline scripts, e.g. `window.QUIZ={…};`.
 * Only literals that parse with JSON.parse are returned: the deck's code is never evaluated.
 */

/** End index (exclusive) of the balanced `{…}`/`[…]` literal starting at `start`, or -1. */
export function literalEnd(src: string, start: number): number {
  const open = src[start];
  if (open !== '{' && open !== '[') return -1;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export interface ExtractedData {
  value: unknown;
  /** Byte length of the literal text. */
  size: number;
}

/** First `window.<name> = <JSON literal>` in `src` that parses as JSON. */
export function extractWindowData(src: string, name: string): ExtractedData | undefined {
  const re = new RegExp(`window\\.${name}\\s*=\\s*`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const start = m.index + m[0].length;
    const end = literalEnd(src, start);
    if (end < 0) continue;
    const text = src.slice(start, end);
    try {
      return { value: JSON.parse(text) as unknown, size: text.length };
    } catch {
      // not JSON (e.g. a code comment or an object with functions) → try the next assignment
    }
  }
  return undefined;
}
