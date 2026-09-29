/** Small string helpers shared by the parser modules. */

export function firstWord(s: string): string {
  return s.trim().split(/\s+/, 1)[0] ?? '';
}

/** Collapse soft line breaks of a Markdown paragraph into single spaces. */
export function joinLines(s: string): string {
  return s.replace(/[ \t]*\n[ \t]*/g, ' ').trim();
}

/** Split a pipe row `a | b | c` (supports `\|` escapes and optional outer pipes). */
export function splitPipes(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (c === '|') {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  cells.push(cur);
  const trimmed = line.trim();
  if (trimmed.startsWith('|') && cells.length > 1 && cells[0]?.trim() === '') cells.shift();
  if (
    trimmed.endsWith('|') &&
    !trimmed.endsWith('\\|') &&
    cells.length > 1 &&
    cells[cells.length - 1]?.trim() === ''
  )
    cells.pop();
  return cells.map((c) => c.trim());
}

/** `120`, `2:00`, `1:04:51`, `90s` → seconds; undefined when not a time. */
export function parseSeconds(value: string | number): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
  const v = value.trim();
  if (/^\d+(\.\d+)?s?$/.test(v)) return Number(v.replace(/s$/, ''));
  const m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(v);
  if (!m) return undefined;
  const parts = [m[1], m[2], m[3]].filter((p): p is string => p !== undefined).map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Asset id from a file name: `assets/Campus Map.png` → `campus-map`. */
export function assetIdFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path;
  const stem = base.replace(/\.[^.]+$/, '');
  const id = stem
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return id || 'image';
}

/** `[S13, S14]`, `S13, S14` or `S13` → `['S13', 'S14']`. */
export function parseIdList(value: string): string[] {
  return value
    .trim()
    .replace(/^\[|\]$/g, '')
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s !== '');
}

export function isInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/** Closest candidate within a small edit distance ("did you mean"). */
export function didYouMean(input: string, candidates: readonly string[]): string | undefined {
  const dist = (a: string, b: string): number => {
    const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0] ?? 0;
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const up = prev[j] ?? 0;
        prev[j] = Math.min(up + 1, (prev[j - 1] ?? 0) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = up;
      }
    }
    return prev[b.length] ?? 0;
  };
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = dist(input.toLowerCase(), c.toLowerCase());
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best !== undefined && bestD <= Math.min(2, Math.max(1, Math.floor(input.length / 2)))
    ? best
    : undefined;
}

/** `**제목** 설명` → `{ title: '제목', body: '설명' }` (the bold run is the title). */
export function splitBoldTitle(text: string): { title: string; body?: string } {
  const m = /^(?:\*\*(.+?)\*\*|__(.+?)__)\s*(.*)$/s.exec(text.trim());
  if (!m) return { title: text.trim() };
  const title = (m[1] ?? m[2] ?? '').trim();
  const body = (m[3] ?? '').replace(/^[—–:·-]\s*/, '').trim();
  return body ? { title, body } : { title };
}
