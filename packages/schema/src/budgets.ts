/**
 * Character budgets per component field (Korean characters count as 1).
 * Single source for the linter, the prompt kit and the design system. See docs/spec/components.md.
 */
export const BUDGETS = {
  slide: { title: 34, subtitle: 60, tag: 16, question: 70 },
  chain: { maxItems: 6, label: 10, sub: 22 },
  cards: { maxItems: { 2: 4, 3: 6, 4: 8 }, kicker: 16, title: 24, body: { 2: 90, 3: 60, 4: 40 } },
  takeaway: { label: 8, text: 70 },
  /**
   * `cellByCols` is the per-cell budget by column count (the design system's recommendation);
   * `cell` is the scalar fallback (one-column tables, and callers that expect a number). Use
   * `tableCellBudget(cols)` rather than reading either directly.
   */
  table: {
    maxCols: 6,
    maxRows: 8,
    cell: 40,
    cellByCols: { 2: 40, 3: 30, 4: 20, 5: 16, 6: 12 },
  },
  compare: { maxRows: 6, label: 10, cell: 60 },
  callout: { title: 20, body: 160 },
  steps: { maxItems: 6, title: 24, body: 70 },
  bullets: { maxItems: 6, item: 60 },
  quote: { text: 120, cite: 40 },
  pills: { maxItems: 8, text: 16 },
  verdict: { label: 8, text: 80 },
  timeline: { maxItems: 6, at: 12, title: 20, body: 50 },
  tiles: { maxItems: { 2: 2, 3: 3, 4: 4, 5: 5 }, label: 14, value: 12 },
  terms: { maxItems: 6, abbr: 8, en: 40, ko: 24 },
  paragraph: { text: 220, lead: 90 },
  image: { caption: 60 },
  video: { label: 40, caption: 60 },
  code: { maxLines: 12, maxCols: 80 },
  note: { cuesPerSlide: 30, cueText: 600 },
} as const;

/**
 * Per-cell character budget of a table with `cols` columns: `cellByCols[cols]`, the scalar
 * `cell` for one column, and the narrowest budget beyond the largest listed column count
 * (such a table also gets `budget.table.cols`).
 */
export function tableCellBudget(cols: number): number {
  const table: Readonly<Record<number, number>> = BUDGETS.table.cellByCols;
  const listed = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const first = listed[0] ?? 0;
  const last = listed[listed.length - 1] ?? 0;
  if (!Number.isFinite(cols) || cols < first) return BUDGETS.table.cell;
  if (cols > last) return table[last] ?? BUDGETS.table.cell;
  return table[Math.floor(cols)] ?? BUDGETS.table.cell;
}

/**
 * Slide-density heuristic (lint `budget.slide.dense`): estimated block heights in canvas px,
 * from the design system's measurements of a content slide. Tune these here; docs/spec/ir.md
 * §5.1 documents the table.
 */
export const DENSITY = {
  /** Body height under eyebrow + title. */
  body: 760,
  /** Taken by the subtitle (`.s-sub`) and by the question strip (`.s-q`): 760 − 60 − 71 = 629. */
  subtitle: 60,
  question: 71,
  /** `.s-body` gap between blocks (also between blocks inside one column). */
  gap: 28,
  /** Warn when the estimate exceeds the available height by more than this fraction. */
  tolerance: 0.1,
  /** Slide types the heuristic applies to (the others have their own layouts). */
  slideTypes: ['content', 'hero'],
  block: {
    chain: 200,
    /** Per row of cards (rows = ceil(items / cols)), by `cols`. */
    cardsRow: { 2: 200, 3: 180, 4: 180 },
    takeaway: 90,
    tableHead: 56,
    tableRow: 60,
    compareHead: 60,
    compareRow: 64,
    callout: 120,
    stepsItem: 64,
    bulletsItem: 44,
    /** One paragraph line per `paragraphChars` visible characters (at least one line). */
    paragraphLine: 44,
    paragraphChars: 90,
    /** Unless the block sets `height`. */
    image: 420,
    video: 96,
    quote: 140,
    codeLine: 36,
    /** Code frame (caption bar and padding) on top of the lines. */
    code: 60,
    pills: 56,
    verdict: 72,
    timelineItem: 72,
    /** Tiles are one row. */
    tiles: 160,
    /** Per row of the terms grid (`termsPerRow` terms per row at full body width). */
    termsRow: 90,
    termsPerRow: 3,
    widget: 400,
    html: 200,
  },
} as const;
