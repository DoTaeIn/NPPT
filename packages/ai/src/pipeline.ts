/**
 * The authoring pipeline of PLAN.md §9: outline → slides (in batches) → notes (per slide) →
 * revise / repair (one slide). Every step returns MARCO source plus a usage record, and sends
 * the same system prompt so provider prompt caching applies.
 */
import type { LintIssue } from '@marco/schema';
import type {
  ChatMessage,
  NotesRequest,
  OutlineItem,
  OutlineRequest,
  PipelineOptions,
  ProgressEvent,
  Provider,
  RepairRequest,
  ReviseRequest,
  RunResult,
  SlideBatchRequest,
  Usage,
} from './types.js';
import {
  buildNotesPrompt,
  buildOutlinePrompt,
  buildRepairPrompt,
  buildRevisePrompt,
  buildSlidesPrompt,
  DEFAULT_CHARS_PER_MINUTE,
} from './prompts.js';
import { extractMarcoSource, extractNote } from './extract.js';
import { outlineMinutes, parseOutline } from './outline.js';
import {
  findSlide,
  formatTimeRange,
  joinDeck,
  mergeNote,
  parseMinutes,
  slideField,
  splitDeck,
  splitNote,
  type DeckParts,
  type SlideChunk,
} from './source.js';

export const DEFAULT_BATCH_SIZE = 6;

export function emptyUsage(): Usage {
  return { calls: 0, chars: 0, promptChars: 0, replyChars: 0 };
}

function charCount(text: string): number {
  return [...text].length;
}

/** Add one call to a usage record. */
export function recordUsage(usage: Usage, messages: ChatMessage[], reply: string): void {
  const prompt = messages.reduce((sum, m) => sum + charCount(m.content), 0);
  const out = charCount(reply);
  usage.calls += 1;
  usage.promptChars += prompt;
  usage.replyChars += out;
  usage.chars += prompt + out;
}

async function call(
  provider: Provider,
  messages: ChatMessage[],
  usage: Usage,
  event: ProgressEvent,
  opts: PipelineOptions,
): Promise<string> {
  opts.onProgress?.(event);
  const reply = await provider.complete(messages, { ...opts.complete, label: event.label });
  recordUsage(usage, messages, reply);
  return reply;
}

/** Split `items` into consecutive batches of at most `size`. */
export function batch<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------------------------

export interface OutlineResult extends RunResult {
  outline: OutlineItem[];
}

/** Step 2: one call → outline lines (`번호 | 태그 | 제목 | 한 줄 의도 | 분`). */
export async function runOutline(
  provider: Provider,
  req: OutlineRequest,
  opts: PipelineOptions = {},
): Promise<OutlineResult> {
  const usage = emptyUsage();
  const reply = await call(
    provider,
    buildOutlinePrompt(req),
    usage,
    { step: 'outline', label: 'outline', index: 1, total: 1 },
    opts,
  );
  const source = extractMarcoSource(reply);
  const parsed = parseOutline(source);
  const warnings = parsed.errors.map((line) => `unreadable outline line: ${line}`);
  const count = parsed.items.length;
  if (count < 30 || count > 45) warnings.push(`outline has ${count} slides (expected 30–45)`);
  const minutes = outlineMinutes(parsed.items);
  if (Math.abs(minutes - req.duration) > 0.01) {
    warnings.push(`outline minutes add up to ${minutes}, lecture is ${req.duration}`);
  }
  return { source, outline: parsed.items, usage, warnings };
}

// ---------------------------------------------------------------------------------------------

export interface SlidesResult extends RunResult {
  /** The generated slides only (no front matter). */
  slides: string;
  /** Number of provider calls made for slides. */
  batches: number;
}

/** Step 3: slide bodies in batches of `batchSize` (default 6) outline lines per call. */
export async function runSlides(
  provider: Provider,
  req: SlideBatchRequest,
  opts: PipelineOptions = {},
): Promise<SlidesResult> {
  const usage = emptyUsage();
  const warnings: string[] = [];
  const { items } = parseOutline(req.outline);
  if (items.length === 0) throw new Error('outline has no slide lines');
  const [from, to] = req.range ?? [items[0]!.no, items[items.length - 1]!.no];
  const selected = items.filter((item) => item.no >= from && item.no <= to);
  const groups = batch(selected, req.batchSize ?? DEFAULT_BATCH_SIZE);
  const chunks: string[] = [];
  for (const [i, group] of groups.entries()) {
    const range: [number, number] = [group[0]!.no, group[group.length - 1]!.no];
    const messages = buildSlidesPrompt({
      outline: req.outline,
      range,
      refs: req.refs,
      request: req.request,
    });
    const label = `slides-${pad2(range[0])}-${pad2(range[1])}`;
    const reply = await call(
      provider,
      messages,
      usage,
      { step: 'slides', label, index: i + 1, total: groups.length },
      opts,
    );
    const source = extractMarcoSource(reply);
    const got = splitDeck(source).slides.length;
    if (got !== group.length) {
      warnings.push(`${label}: expected ${group.length} slides, got ${got}`);
    }
    chunks.push(source.trim());
  }
  const slides = chunks.filter(Boolean).join('\n\n') + '\n';
  const source = req.frontMatter ? `${req.frontMatter.trim()}\n\n${slides}` : slides;
  return { source, slides, batches: groups.length, usage, warnings };
}

// ---------------------------------------------------------------------------------------------

/** `[시간]` strings per slide position, from the outline or from the slides' `time:` fields. */
export function slideTimes(parts: DeckParts, outline?: string): Map<number, string> {
  const times = new Map<number, string>();
  if (outline) {
    for (const item of parseOutline(outline).items) {
      times.set(item.no, `${item.minutes}분 · ${item.from} – ${item.to}`);
    }
    return times;
  }
  let clock = 0;
  let known = true;
  for (const slide of parts.slides) {
    const minutes = parseMinutes(slideField(slide.text, 'time'));
    if (minutes === undefined) {
      known = false;
      continue;
    }
    times.set(slide.position, known ? formatTimeRange(minutes, clock) : `${minutes}분`);
    clock += minutes;
  }
  return times;
}

function resolveSlides(parts: DeckParts, refs: (number | string)[] | undefined): SlideChunk[] {
  if (!refs) return parts.slides;
  return refs.map((ref) => {
    const slide = findSlide(parts, ref);
    if (!slide) throw new Error(`slide ${String(ref)} not found`);
    return slide;
  });
}

function titleOf(slide: SlideChunk | undefined): string | undefined {
  return slide ? (slideField(slide.text, 'title') ?? slide.header) : undefined;
}

/** Step 4: one call per slide → `## note`, merged into the deck. */
export async function runNotes(
  provider: Provider,
  req: NotesRequest,
  opts: PipelineOptions = {},
): Promise<RunResult> {
  const usage = emptyUsage();
  const warnings: string[] = [];
  const parts = splitDeck(req.deck);
  const targets = resolveSlides(parts, req.slides);
  const times = slideTimes(parts, req.outline);
  for (const [i, slide] of targets.entries()) {
    const messages = buildNotesPrompt({
      slide: splitNote(slide.text).body,
      time: times.get(slide.position),
      prevTitle: titleOf(parts.slides[slide.position - 2]),
      nextTitle: titleOf(parts.slides[slide.position]),
      charsPerMinute: req.charsPerMinute ?? DEFAULT_CHARS_PER_MINUTE,
      request: req.request,
    });
    const label = `notes-${pad2(slide.position)}`;
    const reply = await call(
      provider,
      messages,
      usage,
      { step: 'notes', label, index: i + 1, total: targets.length },
      opts,
    );
    const note = extractNote(reply);
    if (!/^\[[^\]\n]+\]/m.test(note)) {
      warnings.push(`${label}: reply has no [marker] lines; slide ${slide.id} left unchanged`);
      continue;
    }
    slide.text = mergeNote(slide.text, note);
  }
  return { source: joinDeck(parts), usage, warnings };
}

// ---------------------------------------------------------------------------------------------

/** 1-based slide position named by a lint path such as `/slides/3/blocks/1`. */
function slideIndexOfIssue(issue: LintIssue): number | undefined {
  const m = /^\/slides\/(\d+)(\/|$)/.exec(issue.path);
  return m ? Number(m[1]) + 1 : undefined;
}

/** Lint issues that belong to one slide (by `slide` id or a `/slides/N/…` path). */
export function issuesForSlide(issues: LintIssue[], slide: SlideChunk): LintIssue[] {
  return issues.filter(
    (issue) => issue.slide === slide.id || slideIndexOfIssue(issue) === slide.position,
  );
}

export interface ReviseResult extends RunResult {
  /** The revised slide alone. */
  slide: string;
}

function takeOneSlide(reply: string, label: string, warnings: string[]): string {
  const source = extractMarcoSource(reply);
  const slides = splitDeck(source).slides;
  if (slides.length === 0) throw new Error(`${label}: reply has no "# slide" line`);
  if (slides.length > 1)
    warnings.push(`${label}: reply had ${slides.length} slides; kept the first`);
  return slides[0]!.text;
}

/** Step 6: revise one slide; the deck is returned with only that slide replaced. */
export async function runRevise(
  provider: Provider,
  req: ReviseRequest,
  opts: PipelineOptions = {},
): Promise<ReviseResult> {
  const usage = emptyUsage();
  const warnings: string[] = [];
  const parts = splitDeck(req.deck);
  const slide = findSlide(parts, req.slide);
  if (!slide) throw new Error(`slide ${String(req.slide)} not found`);
  const lint = Array.isArray(req.lint) ? issuesForSlide(req.lint, slide) : req.lint;
  const label = `revise-${slide.id}`;
  const reply = await call(
    provider,
    buildRevisePrompt({ slide: slide.text, request: req.request, lint }),
    usage,
    { step: 'revise', label, index: 1, total: 1 },
    opts,
  );
  slide.text = takeOneSlide(reply, label, warnings);
  return { source: joinDeck(parts), slide: slide.text, usage, warnings };
}

const LEVELS: LintIssue['level'][] = ['info', 'warn', 'error'];

export interface RepairResult extends RunResult {
  /** Ids of slides sent back for repair. */
  repaired: string[];
}

/** Validate-repair loop: every slide with lint issues is sent back once, with only its issues. */
export async function runRepair(
  provider: Provider,
  req: RepairRequest,
  opts: PipelineOptions = {},
): Promise<RepairResult> {
  const usage = emptyUsage();
  const warnings: string[] = [];
  const parts = splitDeck(req.deck);
  const min = LEVELS.indexOf(req.minLevel ?? 'warn');
  const relevant = req.issues.filter((i) => LEVELS.indexOf(i.level) >= min);
  const bySlide = new Map<SlideChunk, LintIssue[]>();
  for (const issue of relevant) {
    const slide =
      (issue.slide ? findSlide(parts, issue.slide) : undefined) ??
      parts.slides[(slideIndexOfIssue(issue) ?? 0) - 1];
    if (!slide) {
      warnings.push(`no slide for ${issue.code} at ${issue.path || '(deck)'}`);
      continue;
    }
    bySlide.set(slide, [...(bySlide.get(slide) ?? []), issue]);
  }
  const repaired: string[] = [];
  let index = 0;
  for (const [slide, issues] of bySlide) {
    index += 1;
    const label = `repair-${slide.id}`;
    const reply = await call(
      provider,
      buildRepairPrompt(issues, slide.text),
      usage,
      { step: 'repair', label, index, total: bySlide.size },
      opts,
    );
    slide.text = takeOneSlide(reply, label, warnings);
    repaired.push(slide.id);
  }
  return { source: joinDeck(parts), repaired, usage, warnings };
}
