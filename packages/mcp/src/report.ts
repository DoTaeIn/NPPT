/**
 * Shapes compiler diagnostics and lint issues for tool results: structured (grouped by slide,
 * each with a `repair_hint`) and as compact text for clients that only show text content.
 */
import { plainText, type Diagnostic, type Lecture, type LintIssue } from '@marco/compiler';
import { AUTHOR_CODES, repairHint } from './hints.js';

export type Level = 'error' | 'warn' | 'info';

export interface DiagnosticOut {
  level: Level;
  code: string;
  message: string;
  /** 1-based line in the source the tool checked. */
  line?: number;
  slide?: string;
  repair_hint: string;
}

export interface IssueOut {
  level: Level;
  code: string;
  message: string;
  /** JSON pointer into the Lecture IR (e.g. `/slides/3/blocks/1/items/0/body`). */
  path: string;
  /** Source line of the slide header (lint has no finer position). */
  line?: number;
  repair_hint: string;
  /** True for issues the author should check rather than the model (docs/spec/ir.md §6). */
  for_author?: boolean;
}

export interface SlideIssues {
  /** Slide id, or null for deck-level issues (front matter, totals). */
  slide: string | null;
  /** 1-based slide position. */
  index?: number;
  title?: string;
  /** 1-based source line of the `# slide` header. */
  line?: number;
  issues: IssueOut[];
}

export interface Counts {
  errors: number;
  warnings: number;
  infos: number;
}

/** Diagnostics with hints; `lineOffset` maps lines of a wrapped source back to the caller's text. */
export function shapeDiagnostics(list: readonly Diagnostic[], lineOffset = 0): DiagnosticOut[] {
  return list.map((d) => {
    const out: DiagnosticOut = {
      level: d.level,
      code: d.code,
      message: d.message,
      repair_hint: repairHint(d),
    };
    if (d.line !== undefined) {
      const line = d.line - lineOffset;
      if (line >= 1) out.line = line;
    }
    if (d.slide !== undefined) out.slide = d.slide;
    return out;
  });
}

/** Lint issues grouped by slide in deck order; deck-level issues last (slide: null). */
export function groupLint(
  lint: readonly LintIssue[],
  lecture: Lecture,
  slideLines: Record<string, number>,
  lineOffset = 0,
): SlideIssues[] {
  const bySlide = new Map<string | null, IssueOut[]>();
  for (const l of lint) {
    const key = l.slide ?? null;
    const line = l.slide !== undefined ? slideLines[l.slide] : undefined;
    const issue: IssueOut = {
      level: l.level,
      code: l.code,
      message: l.message,
      path: l.path,
      repair_hint: repairHint(l),
    };
    if (line !== undefined && line - lineOffset >= 1) issue.line = line - lineOffset;
    if (AUTHOR_CODES.has(l.code)) issue.for_author = true;
    bySlide.set(key, [...(bySlide.get(key) ?? []), issue]);
  }
  const groups: SlideIssues[] = [];
  lecture.slides.forEach((slide, i) => {
    const issues = bySlide.get(slide.id);
    if (!issues) return;
    bySlide.delete(slide.id);
    const group: SlideIssues = { slide: slide.id, index: i + 1, issues };
    const title = plainText(slide.title ?? '').trim();
    if (title) group.title = title;
    const line = slideLines[slide.id];
    if (line !== undefined && line - lineOffset >= 1) group.line = line - lineOffset;
    groups.push(group);
  });
  for (const [slide, issues] of bySlide) {
    if (slide !== null) groups.push({ slide, issues });
  }
  const deck = bySlide.get(null);
  if (deck) groups.push({ slide: null, issues: deck });
  return groups;
}

export function countLevels(
  diagnostics: readonly { level: Level }[],
  groups: readonly SlideIssues[],
): Counts {
  const counts: Counts = { errors: 0, warnings: 0, infos: 0 };
  const add = (level: Level): void => {
    if (level === 'error') counts.errors++;
    else if (level === 'warn') counts.warnings++;
    else counts.infos++;
  };
  diagnostics.forEach((d) => add(d.level));
  groups.forEach((g) => g.issues.forEach((i) => add(i.level)));
  return counts;
}

export const countsText = (c: Counts): string =>
  `${c.errors} error${c.errors === 1 ? '' : 's'} · ${c.warnings} warning${c.warnings === 1 ? '' : 's'} · ${c.infos} info`;

/** Diagnostics as text lines (with hints). */
export function diagnosticsText(title: string, list: readonly DiagnosticOut[]): string[] {
  if (!list.length) return [];
  const lines = [title];
  for (const d of list) {
    const where = d.line !== undefined ? `line ${d.line} · ` : d.slide ? `${d.slide} · ` : '';
    lines.push(`  ${where}${d.level} ${d.code} · ${d.message}`);
    lines.push(`    hint: ${d.repair_hint}`);
  }
  return lines;
}

/** Lint groups as text lines (with hints). */
export function lintText(groups: readonly SlideIssues[]): string[] {
  if (!groups.length) return [];
  const lines = ['Lint by slide:'];
  for (const g of groups) {
    const head =
      g.slide === null
        ? '  deck (front matter / totals)'
        : `  ${g.slide}${g.index ? ` #${g.index}` : ''}${g.title ? ` "${g.title}"` : ''}${g.line ? ` (line ${g.line})` : ''}`;
    lines.push(head);
    for (const i of g.issues) {
      lines.push(
        `    ${i.level} ${i.code} · ${i.message}${i.for_author ? ' [for the author]' : ''}`,
      );
      lines.push(`      hint: ${i.repair_hint}`);
    }
  }
  return lines;
}

/** What the AI should do next, from the issues found. */
export function nextStep(
  diagnostics: readonly DiagnosticOut[],
  groups: readonly SlideIssues[],
  rebuildWith = 'marco_build',
): string {
  if (diagnostics.some((d) => d.level === 'error')) {
    return `Fix the diagnostics first (format/schema errors stop the build; each has a line and a hint), then call ${rebuildWith} again.`;
  }
  const toFix = groups.filter(
    (g) => g.slide !== null && g.issues.some((i) => i.level !== 'info' && !i.for_author),
  );
  const author = groups.some((g) => g.issues.some((i) => i.for_author || i.level === 'info'));
  const parts: string[] = [];
  if (toFix.length) {
    const ids = toFix.map((g) => g.slide).join(', ');
    parts.push(
      `Fix the error/warn issues on ${toFix.length === 1 ? 'slide' : 'slides'} ${ids} (follow each hint and leave the other slides alone; marco_replace_slide edits one slide in place), then call ${rebuildWith} again. Stop when no error/warn remains or after 3 rounds.`,
    );
  } else if (groups.some((g) => g.issues.some((i) => i.level === 'error'))) {
    parts.push(`Fix the deck-level errors (front matter), then call ${rebuildWith} again.`);
  } else {
    parts.push('No errors or warnings to repair.');
  }
  if (author) {
    parts.push(
      'Info items (content.todo, ref.unused, term.unused, time.total) are for the author: list them for the user instead of inventing facts.',
    );
  }
  return parts.join(' ');
}
