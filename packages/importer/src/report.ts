/**
 * Import report: collection during the import, and Markdown rendering (IMPORT-REPORT.md).
 */
import { CANONICAL_MARKERS, isKnownMarker } from '@marco/schema';
import type { Block, BlockType, Lecture, ValidationError } from '@marco/schema';
import type {
  DroppedEntry,
  HeuristicEntry,
  ImportReport,
  LegacyFamily,
  NoteStats,
  UnmappedEntry,
} from './types.js';
import { alignMarkdownTables } from './format.js';
import { plainText, type FormattingStats } from './inline.js';

function addTo<T extends { count: number; slides: string[] }>(
  map: Map<string, T>,
  key: string,
  make: () => T,
  slide: string,
): void {
  let entry = map.get(key);
  if (!entry) {
    entry = make();
    map.set(key, entry);
  }
  entry.count++;
  if (!entry.slides.includes(slide)) entry.slides.push(slide);
}

export class ReportBuilder {
  readonly unmapped = new Map<string, UnmappedEntry>();
  readonly heuristics = new Map<string, HeuristicEntry>();
  readonly dropped = new Map<string, DroppedEntry>();
  readonly formatting: FormattingStats = {};
  readonly titleMismatches: ImportReport['titleMismatches'] = [];
  readonly warnings: string[] = [];
  noteSplit?: { split: number; total: number };

  addUnmapped(selector: string, reason: UnmappedEntry['reason'], slide: string): void {
    addTo(
      this.unmapped,
      `${reason}|${selector}`,
      () => ({ selector, reason, count: 0, slides: [] }),
      slide,
    );
  }

  addHeuristic(rule: string, selector: string, slide: string): void {
    addTo(
      this.heuristics,
      `${rule}|${selector}`,
      () => ({ rule, selector, count: 0, slides: [] }),
      slide,
    );
  }

  addDropped(what: string, slide: string): void {
    addTo(this.dropped, what, () => ({ what, count: 0, slides: [] }), slide);
  }

  warn(message: string): void {
    if (!this.warnings.includes(message)) this.warnings.push(message);
  }
}

export function walkBlocks(blocks: Block[], visit: (b: Block) => void): void {
  for (const b of blocks) {
    visit(b);
    if (b.type === 'columns') for (const col of b.columns) walkBlocks(col, visit);
  }
}

export function countBlocks(lecture: Lecture): {
  byType: Partial<Record<BlockType, number>>;
  mapped: number;
  fallback: number;
} {
  const byType: Partial<Record<BlockType, number>> = {};
  let mapped = 0;
  let fallback = 0;
  for (const slide of lecture.slides) {
    walkBlocks(slide.blocks, (b) => {
      byType[b.type] = (byType[b.type] ?? 0) + 1;
      if (b.type === 'html') fallback++;
      else if (b.type !== 'columns') mapped++;
    });
  }
  return { byType, mapped, fallback };
}

export function noteStats(lecture: Lecture): NoteStats {
  const stats: NoteStats = {
    slidesWithNotes: 0,
    cues: 0,
    byKind: {},
    markers: {},
    unknownMarkers: {},
    explicitCueIds: 0,
    timedSlides: 0,
    totalMinutes: 0,
    chars: 0,
  };
  for (const slide of lecture.slides) {
    const note = slide.note;
    if (!note || (!note.cues.length && !note.raw)) continue;
    stats.slidesWithNotes++;
    stats.chars += Array.from(note.raw ?? '').length;
    if (note.time) {
      stats.timedSlides++;
      stats.totalMinutes += note.time.minutes;
    }
    for (const cue of note.cues) {
      stats.cues++;
      stats.byKind[cue.k] = (stats.byKind[cue.k] ?? 0) + 1;
      if (cue.id) stats.explicitCueIds++;
      const marker = cue.marker ?? CANONICAL_MARKERS[cue.k];
      stats.markers[marker] = (stats.markers[marker] ?? 0) + 1;
      if (!isKnownMarker(marker))
        stats.unknownMarkers[marker] = (stats.unknownMarkers[marker] ?? 0) + 1;
    }
    if (note.time) stats.markers['시간'] = (stats.markers['시간'] ?? 0) + 1;
  }
  stats.totalMinutes = Math.round(stats.totalMinutes * 100) / 100;
  return stats;
}

function sorted<T extends { count: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count);
}

export function finishReport(
  b: ReportBuilder,
  lecture: Lecture,
  family: LegacyFamily,
  extra: Pick<ImportReport, 'assets' | 'data'> & {
    sourceName?: string;
    validation: ValidationError[];
    schemaPending?: string[];
  },
): ImportReport {
  const counts = countBlocks(lecture);
  const total = counts.mapped + counts.fallback;
  const slidesByType: Record<string, number> = {};
  for (const s of lecture.slides) slidesByType[s.type] = (slidesByType[s.type] ?? 0) + 1;
  const report: ImportReport = {
    family,
    slideCount: lecture.slides.length,
    slidesByType,
    blocksByType: counts.byType,
    mappedBlocks: counts.mapped,
    fallbackBlocks: counts.fallback,
    mappedPercent: total ? Math.round((counts.mapped / total) * 1000) / 10 : 100,
    unmapped: sorted([...b.unmapped.values()]),
    heuristics: sorted([...b.heuristics.values()]),
    dropped: sorted([...b.dropped.values()]),
    formatting: Object.fromEntries(
      Object.entries(b.formatting).sort(([x], [y]) => x.localeCompare(y)),
    ),
    titleMismatches: b.titleMismatches,
    validation: extra.validation,
    schemaPending: extra.schemaPending ?? [],
    notes: noteStats(lecture),
    assets: extra.assets,
    refs: lecture.refs.length,
    videos: lecture.videos.length,
    terms: Object.keys(lecture.terms).length,
    data: extra.data,
    warnings: b.warnings,
  };
  if (extra.sourceName) report.sourceName = extra.sourceName;
  if (b.noteSplit) report.noteSplit = b.noteSplit;
  return report;
}

// ---------------------------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------------------------

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function slideList(slides: string[]): string {
  return slides.length > 12
    ? `${slides.slice(0, 12).join(', ')} … (+${slides.length - 12})`
    : slides.join(', ');
}

export function renderReport(r: ImportReport, extraSections: string[] = []): string {
  const L: string[] = [];
  const familyName = r.family === 'v20' ? 'V20 (week 3 family)' : 'v9.7 (week 5 family)';
  L.push('# Import report', '');
  L.push('Generated by `@marco/importer` (`importLegacyDeck`). Regenerate with');
  L.push('`pnpm --filter @marco/importer exec tsx scripts/import.ts <deck.html> <outDir>`.', '');
  L.push('## Summary', '');
  L.push('| | |', '|---|---|');
  if (r.sourceName) L.push(`| Source | \`${cell(r.sourceName)}\` |`);
  L.push(`| Family | ${familyName} |`);
  L.push(
    `| Slides | ${r.slideCount} (${Object.entries(r.slidesByType)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}) |`,
  );
  L.push(
    `| Blocks | ${r.mappedBlocks + r.fallbackBlocks} (mapped ${r.mappedBlocks}, \`html\` fallback ${r.fallbackBlocks}) |`,
  );
  L.push(`| Mapped | **${r.mappedPercent}%** |`);
  L.push(
    `| Assets | ${r.assets.total} (${r.assets.referenced} referenced by blocks, ${r.assets.stripped} without payload, ${r.assets.bytes} bytes) |`,
  );
  L.push(`| Refs · videos · terms | ${r.refs} · ${r.videos} · ${r.terms} |`);
  const data = Object.entries(r.data).filter(([, v]) => v !== undefined);
  if (data.length) L.push(`| Data | ${data.map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  L.push(`| Validation | ${r.validation.length ? `${r.validation.length} error(s)` : 'ok'} |`, '');

  L.push('## Blocks by type', '');
  L.push('| Block | Count |', '|---|---:|');
  for (const [k, v] of Object.entries(r.blocksByType).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)))
    L.push(`| ${k} | ${v} |`);
  L.push('');

  L.push('## Unmapped markup (kept as `html` blocks)', '');
  if (!r.unmapped.length) L.push('None.', '');
  else {
    L.push(
      '`interactive` = script-driven controls that need a Phase 3 widget; `unmapped` = no component yet.',
      '',
    );
    L.push('| Element | Reason | Count | Slides |', '|---|---|---:|---|');
    for (const u of r.unmapped)
      L.push(`| \`${cell(u.selector)}\` | ${u.reason} | ${u.count} | ${slideList(u.slides)} |`);
    L.push('');
  }

  L.push('## Heuristic mappings', '');
  if (!r.heuristics.length) L.push('None.', '');
  else {
    L.push(
      'Mapped by a structural rule rather than an explicit components.md §4 entry; review these.',
      '',
    );
    L.push('| Rule | Element | Count | Slides |', '|---|---|---:|---|');
    for (const h of r.heuristics)
      L.push(`| ${cell(h.rule)} | \`${cell(h.selector)}\` | ${h.count} | ${slideList(h.slides)} |`);
    L.push('');
  }

  L.push('## Dropped scaffold and decoration', '');
  if (!r.dropped.length) L.push('None.', '');
  else {
    L.push('| What | Count | Slides |', '|---|---:|---|');
    for (const d of r.dropped) L.push(`| ${cell(d.what)} | ${d.count} | ${slideList(d.slides)} |`);
    L.push('');
  }

  L.push('## Formatting the source format cannot express', '');
  const fmt = Object.entries(r.formatting);
  if (!fmt.length) L.push('None.', '');
  else {
    L.push('Text is kept; only the styling below was flattened.', '');
    L.push('| Formatting | Count |', '|---|---:|');
    for (const [k, v] of fmt) L.push(`| ${cell(k)} | ${v} |`);
    L.push('');
  }

  L.push('## Title vs. TOC label', '');
  if (!r.titleMismatches.length)
    L.push('`data-title` matches the visible heading on every slide.', '');
  else {
    L.push(
      '`title` is the visible heading; the legacy `data-title` (TOC label) differs and is kept as `toc`.',
      '',
    );
    L.push('| Slide | `title` (visible heading) | `toc` (`data-title`) |', '|---|---|---|');
    for (const t of r.titleMismatches)
      L.push(`| ${t.slide} | ${cell(plainText(t.heading))} | ${cell(t.title)} |`);
    L.push('');
  }

  L.push('## Validation', '');
  if (!r.validation.length) L.push('`validateLecture` reported no errors.', '');
  else {
    L.push('| Path | Message |', '|---|---|');
    for (const e of r.validation) L.push(`| \`${cell(e.path)}\` | ${cell(e.message)} |`);
    L.push('');
  }
  if (r.schemaPending.length)
    L.push(
      `The installed \`@marco/schema\` does not know ${r.schemaPending.map((f) => `\`${f}\``).join(', ')} yet; they were left out of the validated copy (the source keeps them).`,
      '',
    );

  const n = r.notes;
  L.push('## Notes', '');
  L.push('| | |', '|---|---|');
  L.push(`| Slides with notes | ${n.slidesWithNotes} / ${r.slideCount} |`);
  L.push(
    `| Cues | ${n.cues} (${Object.entries(n.byKind)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}) |`,
  );
  if (r.noteSplit)
    L.push(
      `| Prose notes split per block | ${r.noteSplit.split} / ${r.noteSplit.total} (one \`[대사]\` cue per block, \`@<block id>\` focus) |`,
    );
  L.push(`| Explicit cue ids | ${n.explicitCueIds} |`);
  L.push(`| Slides with \`[시간]\` | ${n.timedSlides} (total ${n.totalMinutes} min) |`);
  L.push(`| Characters | ${n.chars} |`);
  const markers = Object.entries(n.markers).sort((a, b) => b[1] - a[1]);
  if (markers.length)
    L.push(
      `| Markers as authored (\`[메모]\` includes unmarked text) | ${markers.map(([k, v]) => `\`[${k}]\` ${v}`).join(', ')} |`,
    );
  const unknown = Object.entries(n.unknownMarkers);
  L.push(
    `| Unknown markers | ${unknown.length ? unknown.map(([k, v]) => `\`[${k}]\` ${v}`).join(', ') : 'none'} |`,
    '',
  );

  if (Object.values(r.data).some((v) => v !== undefined)) {
    L.push('## Plugin data', '');
    L.push('| Deck data | Imported as | Status |', '|---|---|---|');
    if (r.data.quiz !== undefined) {
      L.push(
        `| \`window.QUIZ\` | \`lecture.quiz\` (${r.data.quiz} × QuizItem) → front matter \`quiz:\` list | complete; the quiz/exam plugin is Phase 3 |`,
      );
    }
    if (r.data.sims !== undefined) {
      const fixed = r.corrections?.changed.sims;
      L.push(
        `| \`window.SIMS\` | \`lecture.sims\` (${r.data.sims} entries, passed through) → sidecar \`sims.json\`, front matter \`sims: sims.json\` | ${fixed ? 'load-time corrections applied (see below)' : 'base literal only; load-time corrections not applied'}; schema TBD (PLAN.md §12) |`,
      );
    }
    if (r.data.terminals !== undefined) {
      L.push(
        `| \`window.TERMS\` | \`lecture.terminals\` (${r.data.terminals} entries) | ${r.data.terminals ? 'passed through' : 'empty in this deck (the terminal plugin is defined but unused)'} |`,
      );
    }
    if (r.data.script !== undefined) {
      L.push(
        `| \`window.SCRIPT\` | not imported (${r.data.script} slides of cues) | \`data-note\` is the source of truth; its \`{q, i}\` focus selectors need mapping to block ids |`,
      );
    }
    L.push('');
  }

  if (r.config) {
    const c = r.config;
    L.push('## Import config', '');
    L.push(
      `Applied \`${c.source}\`. Notes: ${c.notes === 'split' ? '`split` (per-block cues)' : `\`${c.notes}\``}.`,
      '',
    );
    if (c.applied.length) {
      L.push('| Rule | Slide | Id | Fields set |', '|---|---|---|---|');
      for (const a of c.applied)
        L.push(
          `| ${cell(a.rule)} | ${a.slide} | ${a.id ? `\`${a.id}\`` : ''} | ${a.fields.map((f) => `\`${f}\``).join(', ')} |`,
        );
      L.push('');
    }
    if (c.unmatched.length) L.push(`Rules that matched no slide: ${c.unmatched.join('; ')}.`, '');
    if (c.droppedRefs.length) L.push(`Refs dropped: ${c.droppedRefs.join(', ')}.`, '');
    if (c.assets.length) L.push(`Asset metadata overridden: ${c.assets.join(', ')}.`, '');
  }

  if (r.corrections) {
    const k = r.corrections;
    L.push('## Load-time corrections', '');
    L.push(
      'The deck rewrites its own data and text after loading. These scripts were run over the parsed deck before mapping (`corrections` in the import config), so the source holds what the audience sees.',
      '',
    );
    L.push('| | |', '|---|---|');
    L.push(`| Ran (document order) | ${k.ran.map((x) => `\`${x}\``).join(', ') || 'none'} |`);
    if (k.missing.length)
      L.push(`| Not found | ${k.missing.map((x) => `\`${x}\``).join(', ')} |`);
    L.push(`| \`window.SIMS\` changed | ${k.changed.sims ? 'yes' : 'no'} |`);
    L.push(`| Quiz items changed | ${k.changed.quiz} |`);
    L.push(`| Slides whose notes changed | ${k.changed.notes} |`);
    L.push(`| Slides whose visible text changed | ${k.changed.slideText} |`);
    L.push(`| Slides whose TOC/question/simulator attributes changed | ${k.changed.attributes} |`);
    L.push(`| Script errors | ${k.errors.length ? k.errors.map(cell).join('; ') : 'none'} |`);
    L.push(`| Script audit errors | ${k.audit.length ? k.audit.map(cell).join('; ') : 'none'} |`, '');
  }

  if (r.warnings.length) {
    L.push('## Warnings', '');
    for (const w of r.warnings) L.push(`- ${w}`);
    L.push('');
  }
  for (const s of extraSections) L.push(s.trimEnd(), '');
  return (
    alignMarkdownTables(
      L.join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd(),
    ) + '\n'
  );
}
