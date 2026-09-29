/**
 * Output formatting that matches the repository's Prettier settings (printWidth 100), so the
 * files `runImport` writes (IMPORT-REPORT.md, assets.manifest.json, sims.json) are exactly the
 * importer's output and Prettier leaves them unchanged:
 *
 * - Markdown tables are aligned the way Prettier aligns them (column width = display width,
 *   East Asian wide characters count 2).
 * - JSON is printed the way Prettier prints `.json`: objects expanded, arrays on one line when
 *   they fit and hold no object, number arrays filled, arrays of ≥2 multi-element arrays broken.
 */

const PRINT_WIDTH = 100;

// East Asian Wide (W) and Fullwidth (F) ranges (Unicode 15, as used by Prettier's string width).
const WIDE: [number, number][] = [
  [0x1100, 0x115f],
  [0x231a, 0x231b],
  [0x2329, 0x232a],
  [0x23e9, 0x23ec],
  [0x23f0, 0x23f0],
  [0x23f3, 0x23f3],
  [0x25fd, 0x25fe],
  [0x2614, 0x2615],
  [0x2648, 0x2653],
  [0x267f, 0x267f],
  [0x2693, 0x2693],
  [0x26a1, 0x26a1],
  [0x26aa, 0x26ab],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26ce, 0x26ce],
  [0x26d4, 0x26d4],
  [0x26ea, 0x26ea],
  [0x26f2, 0x26f3],
  [0x26f5, 0x26f5],
  [0x26fa, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2705, 0x2705],
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2795, 0x2797],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x16fe0, 0x16fe4],
  [0x17000, 0x18cd5],
  [0x1b000, 0x1b2fb],
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f200, 0x1f251],
  [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f7e0, 0x1f7eb],
  [0x1f90c, 0x1f9ff],
  [0x1fa70, 0x1faff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

function isWide(cp: number): boolean {
  let lo = 0;
  let hi = WIDE.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = WIDE[mid] as [number, number];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Display width of a string (Prettier's `getStringWidth` for text without emoji sequences). */
export function stringWidth(text: string): number {
  if (!/[^\x20-\x7e]/.test(text)) return text.length;
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) continue;
    if (cp >= 0x300 && cp <= 0x36f) continue;
    if (cp >= 0xfe00 && cp <= 0xfe0f) continue;
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}

// ---------------------------------------------------------------------------------------------
// Markdown tables
// ---------------------------------------------------------------------------------------------

function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string;
    if (ch === '\\' && i + 1 < body.length) {
      cur += ch + (body[i + 1] as string);
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

type Align = 'none' | 'left' | 'right' | 'center';

function alignOf(cell: string): Align | undefined {
  const m = /^(:?)-+(:?)$/.exec(cell.trim());
  if (!m) return undefined;
  if (m[1] && m[2]) return 'center';
  if (m[2]) return 'right';
  if (m[1]) return 'left';
  return 'none';
}

function formatTable(lines: string[]): string[] {
  const rows = lines.map(splitRow);
  const aligns = (rows[1] ?? []).map((c) => alignOf(c) ?? 'none');
  const body = [rows[0] ?? [], ...rows.slice(2)];
  const cols = aligns.length;
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(3, ...body.map((r) => stringWidth(r[i] ?? ''))),
  );
  const row = (r: string[]): string =>
    `| ${widths
      .map((w, i) => {
        const text = r[i] ?? '';
        const spaces = w - stringWidth(text);
        const align = aligns[i];
        const before = align === 'right' ? spaces : align === 'center' ? Math.floor(spaces / 2) : 0;
        return `${' '.repeat(before)}${text}${' '.repeat(spaces - before)}`;
      })
      .join(' | ')} |`;
  const rule = `| ${widths
    .map((w, i) => {
      const a = aligns[i];
      const first = a === 'center' || a === 'left' ? ':' : '-';
      const last = a === 'center' || a === 'right' ? ':' : '-';
      return `${first}${'-'.repeat(w - 2)}${last}`;
    })
    .join(' | ')} |`;
  return [row(body[0] ?? []), rule, ...body.slice(1).map(row)];
}

/** Align every GFM table in a Markdown document the way Prettier does. */
export function alignMarkdownTables(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length;) {
    const isRow = (l: string | undefined): boolean => !!l && /^\s*\|/.test(l);
    if (
      isRow(lines[i]) &&
      lines[i + 1] !== undefined &&
      splitRow(lines[i + 1] as string).every((c) => alignOf(c))
    ) {
      let j = i;
      while (j < lines.length && isRow(lines[j])) j++;
      out.push(...formatTable(lines.slice(i, j)));
      i = j;
    } else out.push(lines[i++] as string);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Prettier breaks an array of ≥2 arrays (or objects) that each have ≥2 entries. */
function mustBreak(arr: unknown[]): boolean {
  return (
    arr.length > 1 &&
    arr.every((v, i) => {
      const next = arr[i + 1];
      if (!Array.isArray(v) && !isObject(v)) return false;
      if (next !== undefined && Array.isArray(next) !== Array.isArray(v)) return false;
      return (Array.isArray(v) ? v.length : Object.keys(v).length) > 1;
    })
  );
}

/** One-line form, or null when the value always breaks (a non-empty object inside). */
function flat(v: unknown): string | null {
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (mustBreak(v)) return null;
    const items = v.map(flat);
    if (items.some((x) => x === null)) return null;
    return `[${items.join(', ')}]`;
  }
  if (isObject(v)) return Object.keys(v).length ? null : '{}';
  return JSON.stringify(v) ?? 'null';
}

function fmt(v: unknown, indent: number, col: number, tail: number): string {
  const pad = (n: number): string => ' '.repeat(n);
  if (isObject(v)) {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) return '{}';
    const inner = entries.map(([k, x], i) => {
      const key = `${JSON.stringify(k)}: `;
      const last = i === entries.length - 1;
      return `${pad(indent + 2)}${key}${fmt(x, indent + 2, indent + 2 + stringWidth(key), last ? 0 : 1)}${last ? '' : ','}`;
    });
    return `{\n${inner.join('\n')}\n${pad(indent)}}`;
  }
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const one = flat(v);
    if (one !== null && col + stringWidth(one) + tail <= PRINT_WIDTH) return one;
    if (v.every((x) => typeof x === 'number')) {
      // Prettier `fill`s number arrays: as many per line as fit. Each item carries its comma
      // (the last has none), so a line is full when the next item and its comma pass the width.
      const parts = v.map((x, i) => `${JSON.stringify(x)}${i < v.length - 1 ? ',' : ''}`);
      const lines: string[] = [];
      let line = parts[0] as string;
      let pos = indent + 2 + stringWidth(line);
      for (const p of parts.slice(1)) {
        if (pos + 1 + stringWidth(p) <= PRINT_WIDTH) {
          line += ` ${p}`;
          pos += 1 + stringWidth(p);
        } else {
          lines.push(line);
          line = p;
          pos = indent + 2 + stringWidth(p);
        }
      }
      lines.push(line);
      return `[\n${lines.map((l) => pad(indent + 2) + l).join('\n')}\n${pad(indent)}]`;
    }
    const inner = v.map((x, i) => {
      const last = i === v.length - 1;
      return `${pad(indent + 2)}${fmt(x, indent + 2, indent + 2, last ? 0 : 1)}${last ? '' : ','}`;
    });
    return `[\n${inner.join('\n')}\n${pad(indent)}]`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** JSON text as Prettier formats a `.json` file, with a final newline. */
export function formatJson(value: unknown): string {
  return `${fmt(value, 0, 0, 0)}\n`;
}
