/**
 * Outline lines (`10-개요.md` output): `번호 | 태그 | 제목 | 한 줄 의도 | 분`.
 *
 * `|` separates cells because `·` already appears inside tags and titles ("1부 · 3선 방어").
 * The slide type follows the professor's tag conventions from the V20 deck.
 */
import { extractMarcoSource } from './extract.js';
import { formatClock } from './source.js';
import type { OutlineItem, OutlineSlideType } from './types.js';

export interface ParsedOutline {
  items: OutlineItem[];
  /** Minutes from the `합계 | 150분` line, if present. */
  total?: number;
  /** Lines that looked like slide lines but could not be read. */
  errors: string[];
}

export function outlineSlideType(tag: string): OutlineSlideType {
  const t = tag.replace(/\s+/g, ' ').trim();
  if (t === '표지') return 'cover';
  if (/^\d+\s*부$/.test(t)) return 'divider';
  if (t === '마무리') return 'quote';
  if (t === '참고 자료' || t === '참고자료') return 'references';
  return 'content';
}

function parseNumber(cell: string): number | undefined {
  const m = /(\d+(?:\.\d+)?)/.exec(cell);
  return m ? Number(m[1]) : undefined;
}

/** Parse outline text (fenced or not). Clock times accumulate from 0:00 in outline order. */
export function parseOutline(text: string): ParsedOutline {
  const source = extractMarcoSource(text) || text;
  const items: OutlineItem[] = [];
  const errors: string[] = [];
  let total: number | undefined;
  let clock = 0;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line.includes('|')) continue;
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    const head = cells[0] ?? '';
    if (/^합계/.test(head)) {
      total = parseNumber(cells[1] ?? '');
      continue;
    }
    if (!/^\d+$/.test(head)) continue; // header row "번호 | 태그 | …" or prose
    const minutes = parseNumber(cells[cells.length - 1] ?? '');
    if (cells.length < 5 || minutes === undefined) {
      errors.push(line);
      continue;
    }
    const tag = cells[1]!;
    const item: OutlineItem = {
      no: Number(head),
      tag,
      title: cells[2]!,
      intent: cells.slice(3, -1).join(' | '),
      minutes,
      type: outlineSlideType(tag),
      from: formatClock(clock),
      to: formatClock(clock + minutes),
    };
    clock += minutes;
    items.push(item);
  }
  const parsed: ParsedOutline = { items, errors };
  if (total !== undefined) parsed.total = total;
  return parsed;
}

/** One outline line, the same shape the model writes. */
export function formatOutlineItem(item: OutlineItem): string {
  const no = String(item.no).padStart(2, '0');
  return `${no} | ${item.tag} | ${item.title} | ${item.intent} | ${item.minutes}`;
}

/** Sum of outline minutes. */
export function outlineMinutes(items: OutlineItem[]): number {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}
