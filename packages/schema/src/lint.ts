/**
 * Lecture linter: budgets (docs/spec/components.md), slide density, references, ids, notes,
 * leftover `TODO:` markers and time.
 *
 * Runs on a normalized, validated lecture but tolerates missing arrays. Issues are ordered
 * by slide position (deck-level issues last); messages are Korean for the professor and
 * the AI repair loop, codes are stable identifiers (docs/spec/ir.md).
 */
import { BUDGETS, DENSITY, tableCellBudget } from './budgets.js';
import { CUE_LABELS, TIME_MARKER, isKnownMarker } from './notes.js';
import { slideIdFor } from './normalize.js';
import { charCount, pointer, visibleText } from './text.js';
import type { Block, Lecture, LintIssue, Slide } from './types.js';

type Level = LintIssue['level'];

/**
 * Lint codes and their levels. Budget codes are `budget.<block>.<field>` (all `warn`);
 * `budget.slide.dense` is listed on its own because it is a height estimate, not a character
 * count. `icon.unknown` is reported by the compiler, which knows the icon set; `lintLecture`
 * never emits it, but tools share this table.
 */
export const LINT_CODES = Object.freeze({
  'budget.*': 'warn',
  'budget.slide.dense': 'warn',
  'ref.missing': 'error',
  'ref.unused': 'info',
  'asset.missing': 'error',
  'video.missing': 'error',
  'slide.id.duplicate': 'error',
  'slide.title.missing': 'error',
  'columns.nested': 'error',
  'columns.count': 'warn',
  'table.ragged': 'warn',
  'icon.unknown': 'warn',
  'quiz.ans.range': 'error',
  'note.marker.unknown': 'warn',
  'note.time.invalid': 'warn',
  'note.cues.over': 'warn',
  'note.cue.long': 'warn',
  'note.cue.id.duplicate': 'warn',
  'term.unused': 'info',
  'content.todo': 'info',
  'time.total': 'info',
} as const satisfies Record<string, Level>);

interface Ranked extends LintIssue {
  rank: number;
}

type Emit = (level: Level, code: string, path: string, message: string) => void;

/** Map with numeric keys (cols) → budget, tolerant of unexpected keys. */
const byCols = (table: Readonly<Record<number, number>>, cols: unknown): number | undefined =>
  typeof cols === 'number' ? table[cols] : undefined;

class BudgetChecker {
  constructor(private readonly emit: Emit) {}

  text(value: unknown, max: number | undefined, code: string, label: string, path: string): void {
    if (typeof value !== 'string' || max === undefined) return;
    const length = charCount(visibleText(value));
    if (length > max) this.emit('warn', code, path, `${label}: ${length}자 (허용 ${max}자)`);
  }

  count(
    list: unknown,
    max: number | undefined,
    code: string,
    label: string,
    path: string,
    unit = '개',
  ): void {
    if (!Array.isArray(list) || max === undefined) return;
    if (list.length > max) {
      this.emit('warn', code, path, `${label}: ${list.length}${unit} (허용 ${max}${unit})`);
    }
  }
}

const itemsOf = <T>(list: T[] | undefined): T[] => (Array.isArray(list) ? list : []);

function lintBlock(
  block: Block,
  path: string,
  emit: Emit,
  budget: BudgetChecker,
  ctx: { assets: Record<string, unknown>; videos: ReadonlySet<string> },
  insideColumns: boolean,
): void {
  const at = (...tokens: (string | number)[]): string => path + pointer(...tokens);
  switch (block.type) {
    case 'chain': {
      const b = BUDGETS.chain;
      budget.count(block.items, b.maxItems, 'budget.chain.items', 'chain.items', at('items'));
      itemsOf(block.items).forEach((item, i) => {
        budget.text(
          item.label,
          b.label,
          'budget.chain.label',
          `chain[${i}].label`,
          at('items', i, 'label'),
        );
        budget.text(item.sub, b.sub, 'budget.chain.sub', `chain[${i}].sub`, at('items', i, 'sub'));
      });
      break;
    }
    case 'cards': {
      const b = BUDGETS.cards;
      const body = byCols(b.body, block.cols);
      budget.count(
        block.items,
        byCols(b.maxItems, block.cols),
        'budget.cards.items',
        `cards.items(cols=${block.cols})`,
        at('items'),
      );
      itemsOf(block.items).forEach((item, i) => {
        budget.text(
          item.kicker,
          b.kicker,
          'budget.cards.kicker',
          `cards[${i}].kicker`,
          at('items', i, 'kicker'),
        );
        budget.text(
          item.title,
          b.title,
          'budget.cards.title',
          `cards[${i}].title`,
          at('items', i, 'title'),
        );
        budget.text(
          item.body,
          body,
          'budget.cards.body',
          `cards[${i}].body`,
          at('items', i, 'body'),
        );
      });
      break;
    }
    case 'takeaway': {
      const b = BUDGETS.takeaway;
      budget.text(block.label, b.label, 'budget.takeaway.label', 'takeaway.label', at('label'));
      budget.text(block.text, b.text, 'budget.takeaway.text', 'takeaway.text', at('text'));
      break;
    }
    case 'table': {
      const b = BUDGETS.table;
      const head = itemsOf(block.head);
      const rows = itemsOf(block.rows);
      const widest = Math.max(head.length, ...rows.map((row) => itemsOf(row).length));
      if (widest > b.maxCols) {
        emit(
          'warn',
          'budget.table.cols',
          at('head'),
          `table.cols: ${widest}열 (허용 ${b.maxCols}열)`,
        );
      }
      budget.count(rows, b.maxRows, 'budget.table.rows', 'table.rows', at('rows'), '행');
      // One issue per table: the first ragged row, and how many more there are.
      const ragged = rows.flatMap((row, r) =>
        head.length && itemsOf(row).length !== head.length ? [r] : [],
      );
      const first = ragged[0];
      if (first !== undefined) {
        const more = ragged.length > 1 ? ` 외 ${ragged.length - 1}행` : '';
        emit(
          'warn',
          'table.ragged',
          at('rows', first),
          `table.rows[${first}]: 칸 ${itemsOf(rows[first]).length}개 (머리글 ${head.length}개)${more}`,
        );
      }
      const cell = tableCellBudget(widest);
      head.forEach((text, c) =>
        budget.text(
          text,
          cell,
          'budget.table.cell',
          `table.head[${c}](cols=${widest})`,
          at('head', c),
        ),
      );
      rows.forEach((row, r) =>
        itemsOf(row).forEach((text, c) =>
          budget.text(
            text,
            cell,
            'budget.table.cell',
            `table.rows[${r}][${c}](cols=${widest})`,
            at('rows', r, c),
          ),
        ),
      );
      break;
    }
    case 'compare': {
      const b = BUDGETS.compare;
      budget.count(block.rows, b.maxRows, 'budget.compare.items', 'compare.rows', at('rows'), '행');
      itemsOf(block.rows).forEach((row, i) => {
        budget.text(
          row.label,
          b.label,
          'budget.compare.label',
          `compare[${i}].label`,
          at('rows', i, 'label'),
        );
        budget.text(
          row.left,
          b.cell,
          'budget.compare.cell',
          `compare[${i}].left`,
          at('rows', i, 'left'),
        );
        budget.text(
          row.right,
          b.cell,
          'budget.compare.cell',
          `compare[${i}].right`,
          at('rows', i, 'right'),
        );
      });
      break;
    }
    case 'callout': {
      const b = BUDGETS.callout;
      budget.text(block.title, b.title, 'budget.callout.title', 'callout.title', at('title'));
      budget.text(block.body, b.body, 'budget.callout.body', 'callout.body', at('body'));
      break;
    }
    case 'steps': {
      const b = BUDGETS.steps;
      budget.count(block.items, b.maxItems, 'budget.steps.items', 'steps.items', at('items'));
      itemsOf(block.items).forEach((item, i) => {
        budget.text(
          item.title,
          b.title,
          'budget.steps.title',
          `steps[${i}].title`,
          at('items', i, 'title'),
        );
        budget.text(
          item.body,
          b.body,
          'budget.steps.body',
          `steps[${i}].body`,
          at('items', i, 'body'),
        );
      });
      break;
    }
    case 'bullets': {
      const b = BUDGETS.bullets;
      budget.count(block.items, b.maxItems, 'budget.bullets.items', 'bullets.items', at('items'));
      itemsOf(block.items).forEach((item, i) =>
        budget.text(item, b.item, 'budget.bullets.item', `bullets[${i}]`, at('items', i)),
      );
      break;
    }
    case 'columns': {
      if (insideColumns) {
        emit(
          'error',
          'columns.nested',
          path,
          'columns 안에 columns를 넣을 수 없습니다 (한 단계만 허용)',
        );
      }
      const columns = itemsOf(block.columns);
      if (typeof block.cols === 'number' && columns.length !== block.cols) {
        emit(
          'warn',
          'columns.count',
          at('columns'),
          `columns cols=${block.cols}인데 열이 ${columns.length}개입니다`,
        );
      }
      columns.forEach((column, c) =>
        itemsOf(column).forEach((child, j) =>
          lintBlock(child, at('columns', c, j), emit, budget, ctx, true),
        ),
      );
      break;
    }
    case 'image': {
      if (typeof block.asset === 'string' && !Object.hasOwn(ctx.assets, block.asset)) {
        emit('error', 'asset.missing', at('asset'), `assets에 없는 이미지: ${block.asset}`);
      }
      budget.text(
        block.caption,
        BUDGETS.image.caption,
        'budget.image.caption',
        'image.caption',
        at('caption'),
      );
      break;
    }
    case 'video': {
      if (typeof block.video === 'string' && !ctx.videos.has(block.video)) {
        emit('error', 'video.missing', at('video'), `videos에 없는 영상: ${block.video}`);
      }
      budget.text(
        block.label,
        BUDGETS.video.label,
        'budget.video.label',
        'video.label',
        at('label'),
      );
      budget.text(
        block.caption,
        BUDGETS.video.caption,
        'budget.video.caption',
        'video.caption',
        at('caption'),
      );
      break;
    }
    case 'quote': {
      const b = BUDGETS.quote;
      budget.text(block.text, b.text, 'budget.quote.text', 'quote.text', at('text'));
      budget.text(block.cite, b.cite, 'budget.quote.cite', 'quote.cite', at('cite'));
      break;
    }
    case 'code': {
      const b = BUDGETS.code;
      if (typeof block.code !== 'string') break;
      const lines = block.code.replace(/\n+$/, '').split('\n');
      budget.count(lines, b.maxLines, 'budget.code.lines', 'code.lines', at('code'), '줄');
      let longest = -1;
      lines.forEach((line, i) => {
        if (longest < 0 || charCount(line) > charCount(lines[longest] ?? '')) longest = i;
      });
      const width = charCount(lines[longest] ?? '');
      if (width > b.maxCols) {
        emit(
          'warn',
          'budget.code.cols',
          at('code'),
          `code.lines[${longest}]: ${width}자 (허용 ${b.maxCols}자)`,
        );
      }
      break;
    }
    case 'pills': {
      const b = BUDGETS.pills;
      budget.count(block.items, b.maxItems, 'budget.pills.items', 'pills.items', at('items'));
      itemsOf(block.items).forEach((item, i) =>
        budget.text(
          item.text,
          b.text,
          'budget.pills.text',
          `pills[${i}].text`,
          at('items', i, 'text'),
        ),
      );
      break;
    }
    case 'verdict': {
      const b = BUDGETS.verdict;
      budget.text(block.label, b.label, 'budget.verdict.label', 'verdict.label', at('label'));
      budget.text(block.text, b.text, 'budget.verdict.text', 'verdict.text', at('text'));
      break;
    }
    case 'timeline': {
      const b = BUDGETS.timeline;
      budget.count(block.items, b.maxItems, 'budget.timeline.items', 'timeline.items', at('items'));
      itemsOf(block.items).forEach((item, i) => {
        budget.text(item.at, b.at, 'budget.timeline.at', `timeline[${i}].at`, at('items', i, 'at'));
        budget.text(
          item.title,
          b.title,
          'budget.timeline.title',
          `timeline[${i}].title`,
          at('items', i, 'title'),
        );
        budget.text(
          item.body,
          b.body,
          'budget.timeline.body',
          `timeline[${i}].body`,
          at('items', i, 'body'),
        );
      });
      break;
    }
    case 'tiles': {
      const b = BUDGETS.tiles;
      budget.count(
        block.items,
        byCols(b.maxItems, block.cols),
        'budget.tiles.items',
        `tiles.items(cols=${block.cols})`,
        at('items'),
      );
      itemsOf(block.items).forEach((item, i) => {
        budget.text(
          item.label,
          b.label,
          'budget.tiles.label',
          `tiles[${i}].label`,
          at('items', i, 'label'),
        );
        budget.text(
          item.value,
          b.value,
          'budget.tiles.value',
          `tiles[${i}].value`,
          at('items', i, 'value'),
        );
      });
      break;
    }
    case 'terms': {
      const b = BUDGETS.terms;
      budget.count(block.items, b.maxItems, 'budget.terms.items', 'terms.items', at('items'));
      itemsOf(block.items).forEach((item, i) => {
        budget.text(
          item.abbr,
          b.abbr,
          'budget.terms.abbr',
          `terms[${i}].abbr`,
          at('items', i, 'abbr'),
        );
        budget.text(item.en, b.en, 'budget.terms.en', `terms[${i}].en`, at('items', i, 'en'));
        budget.text(item.ko, b.ko, 'budget.terms.ko', `terms[${i}].ko`, at('items', i, 'ko'));
      });
      break;
    }
    case 'paragraph': {
      const b = BUDGETS.paragraph;
      if (block.lead)
        budget.text(block.text, b.lead, 'budget.paragraph.lead', 'paragraph(lead)', at('text'));
      else budget.text(block.text, b.text, 'budget.paragraph.text', 'paragraph', at('text'));
      break;
    }
    case 'widget':
    case 'html':
      break;
  }
}

/** Keys whose string values are identifiers or markup options, not audience text. */
const NON_TEXT_KEYS: ReadonlySet<string> = new Set([
  'id',
  'type',
  'refs',
  'only',
  'asset',
  'video',
  'icon',
  'tone',
  'kind',
  'layout',
  'fit',
  'align',
  'name',
  'params',
  'k',
  'focus',
  'marker',
  'raw',
  'wait',
  'verdict',
  'art',
  'dark',
]);

function collectText(value: unknown, out: string[], key?: string): void {
  if (key !== undefined && NON_TEXT_KEYS.has(key)) return;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectText(item, out, key);
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) collectText(v, out, k);
  }
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Slide density (budget.slide.dense)
// ---------------------------------------------------------------------------

/**
 * Estimated rendered height of one block in canvas px, from `DENSITY.block`
 * (docs/spec/ir.md §5.1). A planning heuristic, not a layout engine.
 */
export function estimateBlockHeight(block: Block): number {
  const d = DENSITY.block;
  const count = (list: unknown): number => (Array.isArray(list) ? list.length : 0);
  switch (block.type) {
    case 'chain':
      return d.chain;
    case 'cards': {
      const cols = typeof block.cols === 'number' && block.cols > 0 ? block.cols : 2;
      const row = byCols(d.cardsRow, cols) ?? d.cardsRow[2];
      return Math.ceil(count(block.items) / cols) * row;
    }
    case 'takeaway':
      return d.takeaway;
    case 'table':
      return d.tableHead + count(block.rows) * d.tableRow;
    case 'compare':
      return d.compareHead + count(block.rows) * d.compareRow;
    case 'callout':
      return d.callout;
    case 'steps':
      return count(block.items) * d.stepsItem;
    case 'bullets':
      return count(block.items) * d.bulletsItem;
    case 'paragraph': {
      const chars = typeof block.text === 'string' ? charCount(visibleText(block.text)) : 0;
      return Math.max(1, Math.ceil(chars / d.paragraphChars)) * d.paragraphLine;
    }
    case 'image':
      return typeof block.height === 'number' && block.height > 0 ? block.height : d.image;
    case 'video':
      return d.video;
    case 'quote':
      return d.quote;
    case 'code': {
      const lines =
        typeof block.code === 'string' ? block.code.replace(/\n+$/, '').split('\n') : [];
      return lines.length * d.codeLine + d.code;
    }
    case 'pills':
      return d.pills;
    case 'verdict':
      return d.verdict;
    case 'timeline':
      return count(block.items) * d.timelineItem;
    case 'tiles':
      return d.tiles;
    case 'terms':
      return Math.ceil(count(block.items) / d.termsPerRow) * d.termsRow;
    case 'columns':
      return Math.max(0, ...itemsOf(block.columns).map((column) => stackHeight(itemsOf(column))));
    case 'widget':
      return d.widget;
    case 'html':
      return d.html;
    default:
      return 0;
  }
}

/** Estimated height of blocks stacked in a column: their heights plus `DENSITY.gap` between. */
export function stackHeight(blocks: readonly Block[]): number {
  if (!blocks.length) return 0;
  const sum = blocks.reduce((total, block) => total + estimateBlockHeight(block), 0);
  return sum + DENSITY.gap * (blocks.length - 1);
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

/** Body height available on a slide: `DENSITY.body` minus the subtitle and question strip. */
export function availableBodyHeight(slide: Pick<Slide, 'subtitle' | 'question'>): number {
  return (
    DENSITY.body -
    (hasText(slide.subtitle) ? DENSITY.subtitle : 0) -
    (hasText(slide.question) ? DENSITY.question : 0)
  );
}

function lintDensity(slide: Slide, base: string, emit: Emit): void {
  if (!(DENSITY.slideTypes as readonly string[]).includes(slide.type)) return;
  const blocks = itemsOf(slide.blocks);
  const estimate = stackHeight(blocks);
  const available = availableBodyHeight(slide);
  if (estimate <= available * (1 + DENSITY.tolerance)) return;
  let largest = 0;
  blocks.forEach((block, i) => {
    if (estimateBlockHeight(block) > estimateBlockHeight(blocks[largest] ?? block)) largest = i;
  });
  const top = blocks[largest];
  const over = Math.round((estimate / available - 1) * 100);
  const hint = top
    ? ` · 가장 큰 블록 #${largest + 1} ${top.type} ${estimateBlockHeight(top)}px`
    : '';
  emit(
    'warn',
    'budget.slide.dense',
    `${base}/blocks`,
    `slide.dense: 본문 높이 추정 ${estimate}px (허용 ${available}px, ${over}% 초과${hint})`,
  );
}

// ---------------------------------------------------------------------------
// Leftover TODO markers (content.todo)
// ---------------------------------------------------------------------------

const TODO_MARKER = /(?<![A-Za-z0-9_])TODO[ \t]*[:：]/;

interface TodoHit {
  path: string;
  text: string;
}

/** Collect text fields (NON_TEXT_KEYS skipped, so `note.raw` is not counted twice) with TODO. */
function findTodos(value: unknown, path: string, out: TodoHit[], key?: string): void {
  if (key !== undefined && NON_TEXT_KEYS.has(key)) return;
  if (typeof value === 'string') {
    if (TODO_MARKER.test(value)) out.push({ path, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => findTodos(item, path + pointer(i), out, key));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) findTodos(v, path + pointer(k), out, k);
  }
}

function todoMessage(text: string): string {
  const matches = [...text.matchAll(new RegExp(TODO_MARKER.source, 'g'))];
  const start = matches[0]?.index ?? 0;
  const line = text.slice(start).split('\n')[0]?.trim() ?? '';
  const chars = Array.from(line);
  const snippet = chars.length > 60 ? `${chars.slice(0, 60).join('')}…` : line;
  const more = matches.length > 1 ? ` 외 ${matches.length - 1}개` : '';
  return `확인할 TODO가 남아 있습니다: "${snippet}"${more}`;
}

function lintTodos(value: unknown, path: string, emit: Emit): void {
  const hits: TodoHit[] = [];
  findTodos(value, path, hits);
  for (const hit of hits) emit('info', 'content.todo', hit.path, todoMessage(hit.text));
}

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Lint a lecture. See docs/spec/ir.md for the code list. Pure; never throws on a lecture
 * that passed `validateLecture`.
 */
export function lintLecture(lecture: Lecture): LintIssue[] {
  const issues: Ranked[] = [];
  const slides: Slide[] = itemsOf(lecture.slides);
  const refs = itemsOf(lecture.refs);
  const refIds = new Set(refs.map((r) => r.id));
  const ctx = {
    assets: (lecture.assets ?? {}) as Record<string, unknown>,
    videos: new Set(itemsOf(lecture.videos).map((v) => v.id)),
  };
  const cited = new Set<string>();
  const slidePositions = new Map<string, number>();
  const cueIds = new Set<string>();
  let totalMinutes = 0;
  let timedSlides = 0;

  slides.forEach((slide, index) => {
    const slideId =
      typeof slide.id === 'string' && slide.id !== '' ? slide.id : slideIdFor(index + 1);
    const base = pointer('slides', index);
    const emit: Emit = (level, code, path, message) =>
      issues.push({ level, code, path, message, slide: slideId, rank: index });
    const budget = new BudgetChecker(emit);

    if (typeof slide.id === 'string' && slide.id !== '') {
      const first = slidePositions.get(slide.id);
      if (first !== undefined) {
        emit(
          'error',
          'slide.id.duplicate',
          `${base}/id`,
          `중복된 슬라이드 id: ${slide.id} (${first + 1}번 슬라이드와 같음)`,
        );
      } else {
        slidePositions.set(slide.id, index);
      }
    }

    if (typeof slide.title !== 'string' || slide.title.trim() === '') {
      emit('error', 'slide.title.missing', `${base}/title`, '슬라이드 제목(title)이 비어 있습니다');
    } else if (slide.type !== 'raw') {
      const max = slide.type === 'quote' ? BUDGETS.quote.text : BUDGETS.slide.title;
      budget.text(slide.title, max, 'budget.slide.title', 'title', `${base}/title`);
    }
    budget.text(
      slide.subtitle,
      BUDGETS.slide.subtitle,
      'budget.slide.subtitle',
      'subtitle',
      `${base}/subtitle`,
    );
    budget.text(slide.tag, BUDGETS.slide.tag, 'budget.slide.tag', 'tag', `${base}/tag`);
    budget.text(
      slide.question,
      BUDGETS.slide.question,
      'budget.slide.question',
      'question',
      `${base}/question`,
    );
    if (slide.type === 'quote') {
      budget.text(slide.cite, BUDGETS.quote.cite, 'budget.quote.cite', 'cite', `${base}/cite`);
    }

    itemsOf(slide.refs).forEach((id, i) => {
      cited.add(id);
      if (!refIds.has(id))
        emit('error', 'ref.missing', `${base}/refs/${i}`, `refs에 없는 참고 출처: ${id}`);
    });
    itemsOf(slide.only).forEach((id, i) => {
      if (!refIds.has(id))
        emit('error', 'ref.missing', `${base}/only/${i}`, `refs에 없는 참고 출처: ${id}`);
    });

    // cover / hero / divider artwork is an asset id, like an image block's `asset`.
    const art: unknown = (slide as { art?: unknown }).art;
    if (typeof art === 'string' && !Object.hasOwn(ctx.assets, art)) {
      emit('error', 'asset.missing', `${base}/art`, `assets에 없는 이미지: ${art} (art)`);
    }

    itemsOf(slide.blocks).forEach((block, i) =>
      lintBlock(block, `${base}/blocks/${i}`, emit, budget, ctx, false),
    );
    lintDensity(slide, base, emit);
    lintTodos(slide, base, emit);

    const note = slide.note;
    if (!note) return;
    if (note.time && typeof note.time.minutes === 'number') {
      totalMinutes += note.time.minutes;
      timedSlides++;
    }
    const cues = itemsOf(note.cues);
    const max = BUDGETS.note.cuesPerSlide;
    if (cues.length > max) {
      emit(
        'warn',
        'note.cues.over',
        `${base}/note/cues`,
        `노트 큐 ${cues.length}개 (허용 ${max}개)`,
      );
    }
    cues.forEach((cue, i) => {
      const at = `${base}/note/cues/${i}`;
      if (cue.marker !== undefined && cue.marker.replace(/\s+/g, '') === TIME_MARKER) {
        emit(
          'warn',
          'note.time.invalid',
          at,
          `[시간]을 해석할 수 없거나 중복입니다: "${cue.t}" (예: 2.5분 · 10:00 – 12:30)`,
        );
      } else if (cue.marker !== undefined && !isKnownMarker(cue.marker)) {
        emit(
          'warn',
          'note.marker.unknown',
          at,
          `알 수 없는 노트 표시 [${cue.marker}] → 메모로 처리했습니다`,
        );
      }
      if (typeof cue.t === 'string') {
        const length = charCount(visibleText(cue.t));
        if (length > BUDGETS.note.cueText) {
          const label = CUE_LABELS[cue.k] ?? cue.k;
          emit(
            'warn',
            'note.cue.long',
            `${at}/t`,
            `cues[${i}] ${label}: ${length}자 (허용 ${BUDGETS.note.cueText}자)`,
          );
        }
      }
      if (typeof cue.id === 'string' && cue.id !== '') {
        if (cueIds.has(cue.id))
          emit('warn', 'note.cue.id.duplicate', `${at}/id`, `중복된 큐 id: ${cue.id}`);
        cueIds.add(cue.id);
      }
    });
  });

  const deck: Emit = (level, code, path, message) =>
    issues.push({ level, code, path, message, rank: Number.POSITIVE_INFINITY });

  itemsOf(lecture.quiz).forEach((item, i) => {
    itemsOf(item.refs).forEach((id, j) => {
      cited.add(id);
      if (!refIds.has(id))
        deck(
          'error',
          'ref.missing',
          `/quiz/${i}/refs/${j}`,
          `refs에 없는 참고 출처: ${id} (퀴즈 ${item.id})`,
        );
    });
    const options = itemsOf(item.opts).length;
    if (
      typeof item.ans === 'number' &&
      (!Number.isInteger(item.ans) || item.ans < 0 || item.ans >= options)
    ) {
      deck(
        'error',
        'quiz.ans.range',
        `/quiz/${i}/ans`,
        `퀴즈 ${item.id} 정답 번호 ${item.ans}가 보기 범위(0–${options - 1})를 벗어납니다`,
      );
    }
  });

  refs.forEach((r, i) => {
    if (!cited.has(r.id))
      deck(
        'info',
        'ref.unused',
        `/refs/${i}`,
        `어느 슬라이드에서도 인용하지 않은 참고 출처: ${r.id}`,
      );
  });

  const terms = Object.keys(lecture.terms ?? {});
  if (terms.length) {
    const corpus: string[] = [];
    collectText(lecture.meta?.title, corpus);
    collectText(slides, corpus);
    collectText(lecture.quiz, corpus);
    const text = corpus.join('\n');
    for (const term of terms) {
      const used = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(term)}(?![A-Za-z0-9_])`).test(text);
      if (!used)
        deck('info', 'term.unused', pointer('terms', term), `본문에 쓰이지 않은 용어: ${term}`);
    }
  }

  for (const key of ['meta', 'refs', 'videos', 'assets', 'terms', 'quiz'] as const) {
    lintTodos(lecture[key], pointer(key), deck);
  }

  const duration = lecture.meta?.duration;
  if (timedSlides > 0 || typeof duration === 'number') {
    const total = round(totalMinutes);
    const counted = `슬라이드 ${slides.length}개 중 ${timedSlides}개에 [시간]`;
    if (typeof duration === 'number' && total > duration) {
      deck(
        'warn',
        'time.total',
        '/slides',
        `노트 [시간] 합계 ${total}분 > 강의 시간 ${duration}분 (${round(total - duration)}분 초과, ${counted})`,
      );
    } else if (typeof duration === 'number') {
      deck(
        'info',
        'time.total',
        '/slides',
        `노트 [시간] 합계 ${total}분 / 강의 시간 ${duration}분 (${counted})`,
      );
    } else {
      deck('info', 'time.total', '/slides', `노트 [시간] 합계 ${total}분 (${counted})`);
    }
  }

  return issues
    .map((issue, order) => ({ issue, order }))
    .sort((a, b) => a.issue.rank - b.issue.rank || a.order - b.order)
    .map(({ issue: { level, code, path, message, slide } }): LintIssue =>
      slide === undefined ? { level, code, path, message } : { level, code, path, message, slide },
    );
}
