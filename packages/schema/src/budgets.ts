/**
 * Character budgets per component field (Korean characters count as 1).
 * Single source for the linter, the prompt kit and the design system. See docs/spec/components.md.
 */
export const BUDGETS = {
  slide: { title: 34, subtitle: 60, tag: 16, question: 70 },
  chain: { maxItems: 6, label: 10, sub: 22 },
  cards: { maxItems: { 2: 4, 3: 6, 4: 8 }, kicker: 16, title: 24, body: { 2: 90, 3: 60, 4: 40 } },
  takeaway: { label: 8, text: 70 },
  table: { maxCols: 6, maxRows: 8, cell: 40 },
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
  note: { cuesPerSlide: 30, cueText: 600 },
} as const;
