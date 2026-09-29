/**
 * Small text helpers shared by the validator, normalizer and linter.
 */

/** Number of characters as the budgets count them: code points, so a Korean syllable is 1. */
export function charCount(text: string): number {
  return Array.from(text).length;
}

/**
 * Text as the audience sees it: inline Markdown markers (`**b**`, `*em*`, `` `code` ``,
 * `[text](url)`) and simple inline HTML tags are removed before counting against a budget.
 */
export function visibleText(text: string): string {
  return text
    .replace(/<\/?(?:b|strong|em|i|u|code|a|abbr|span|small|sub|sup|mark|kbd)\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*([^*\s][^*]*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** Levenshtein distance (case-insensitive), used for "did you mean" hints. */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  const prev: number[] = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const up = prev[j] ?? 0;
      const left = prev[j - 1] ?? 0;
      prev[j] = Math.min(up + 1, left + 1, diag + (s[i - 1] === t[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[t.length] ?? 0;
}

/** Closest candidate within a small edit distance, or undefined when nothing is close. */
export function didYouMean(input: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === input) continue;
    const distance = editDistance(input, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best === undefined) return undefined;
  const limit = Math.min(2, Math.max(1, Math.floor(input.length / 2)));
  return bestDistance <= limit ? best : undefined;
}

/** Escape one JSON-pointer reference token (RFC 6901). */
export function pointerToken(token: string | number): string {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Build a JSON pointer from reference tokens. */
export function pointer(...tokens: (string | number)[]): string {
  return tokens.map((t) => '/' + pointerToken(t)).join('');
}
