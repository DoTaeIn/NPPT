/**
 * Slide body markup → IR blocks, following docs/spec/components.md §4 (legacy vocabulary →
 * component). Explicit rules come first, then a few structural heuristics (reported as such),
 * and anything else is kept verbatim as an `html` block and recorded in the report.
 */
import type {
  Block,
  CalloutBlock,
  CardsBlock,
  ChainBlock,
  CompareBlock,
  ImageBlock,
  PillsBlock,
  StepsBlock,
  TableBlock,
  TermsBlock,
  Tone,
  VerdictBlock,
  VideoBlock,
  WidgetBlock,
  Video,
} from '@marco/schema';
import type { AssetRegistry } from './assets.js';
import {
  childElements,
  classes,
  hasClass,
  isElement,
  isText,
  selectorOf,
  tagName,
  textOf,
} from './dom.js';
import { bump, inlineOf, type FormattingStats } from './inline.js';
import { stripTokens } from './payloads.js';
import type { ReportBuilder } from './report.js';
import type { LegacyFamily } from './types.js';

export interface MapContext {
  family: LegacyFamily;
  slideId: string;
  report: ReportBuilder;
  assets: AssetRegistry;
  /** Lecture-wide abbreviation map (filled from term strips). */
  terms: Record<string, string>;
  /** Known videos by YouTube id. */
  videos: Map<string, Video>;
  /** Refs found in the body (v9.7 `.source-links`), returned to the slide. */
  addRef: (url: string, title: string) => string;
  slideRefs: string[];
  inColumn: boolean;
}

const fmt = (ctx: MapContext): FormattingStats => ctx.report.formatting;
const inline = (ctx: MapContext, nodes: Node | Node[], skip?: (el: Element) => boolean): string =>
  inlineOf(nodes, skip ? { stats: fmt(ctx), skip } : { stats: fmt(ctx) });

type Rule = (el: Element, ctx: MapContext) => Block[] | null;

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'cite',
  'code',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'wbr',
  'dfn',
]);

function isInlineOnly(el: Element): boolean {
  for (const c of childElements(el)) {
    if (!INLINE_TAGS.has(tagName(c)) || !isInlineOnly(c)) return false;
  }
  return true;
}

function isIconOnly(el: Element): boolean {
  if (el.hasAttribute('data-lucide')) return true;
  if (textOf(el)) return false;
  const kids = childElements(el);
  return kids.length > 0 && kids.every(isIconOnly);
}

function hasMedia(el: Element): boolean {
  return !!el.querySelector('img, svg, video, iframe, canvas, input, select, textarea, output');
}

function isEmpty(el: Element): boolean {
  return !textOf(el) && !hasMedia(el);
}

const TONE_BY_CLASS: [RegExp, Tone][] = [
  [/^(navy|primary|violet|purple)$/, 'primary'],
  [/^(gray|grey|neutral|muted)$/, 'neutral'],
  [/^(ok|green|success|allow|recommended)$/, 'ok'],
  [/^(warn|yellow|amber|caution|conditional|part)$/, 'warn'],
  [/^(red|err|error|danger|drop|weak|alert)$/, 'danger'],
  [/^(blue|info|cyan)$/, 'info'],
];

function toneOf(el: Element): Tone | undefined {
  for (const c of classes(el)) {
    const m = /^tone-(neutral|primary|ok|warn|danger|info)$/.exec(c);
    if (m) return m[1] as Tone;
  }
  for (const c of classes(el)) for (const [re, tone] of TONE_BY_CLASS) if (re.test(c)) return tone;
  return undefined;
}

function iconOf(el: Element): string | undefined {
  return el.querySelector('i[data-lucide]')?.getAttribute('data-lucide') ?? undefined;
}

/** Children of an element with class-less wrapper divs expanded (for card-like articles). */
function flattenParts(el: Element): Element[] {
  const out: Element[] = [];
  for (const c of childElements(el)) {
    if ((tagName(c) === 'div' && classes(c).length === 0) || hasClass(c, 'grow', 'pentest-content'))
      out.push(...flattenParts(c));
    else out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// html fallback
// ---------------------------------------------------------------------------------------------

/** outerHTML with embedded images turned into `data-asset` references and other base64 removed. */
export function htmlOf(el: Element, ctx: MapContext): string {
  for (const img of Array.from(el.querySelectorAll('img[src^="data:"]'))) {
    const id = ctx.assets.fromImg(img);
    if (id) {
      img.removeAttribute('src');
      img.setAttribute('data-asset', id);
      ctx.assets.markReferenced(id);
      bump(fmt(ctx), 'embedded images in html blocks → data-asset');
    }
  }
  for (const img of Array.from(el.querySelectorAll('img[data-asset]'))) {
    const id = img.getAttribute('data-asset');
    if (id) ctx.assets.markReferenced(id);
  }
  return stripTokens(el.outerHTML);
}

export function fallback(
  el: Element,
  ctx: MapContext,
  reason: 'unmapped' | 'interactive' = 'unmapped',
): Block[] {
  if (isEmpty(el) && reason === 'unmapped') {
    ctx.report.addDropped(`empty element \`${selectorOf(el)}\``, ctx.slideId);
    return [];
  }
  ctx.report.addUnmapped(selectorOf(el), reason, ctx.slideId);
  return [{ type: 'html', html: htmlOf(el, ctx) }];
}

// ---------------------------------------------------------------------------------------------
// explicit rules (components.md §4)
// ---------------------------------------------------------------------------------------------

const SCAFFOLD_SKIP = new Set([
  's-progress',
  's-foot',
  'slide-tag-bottom',
  'zoom-badge',
  'slide-no',
  'slide-progress',
  'cover-logos',
  'flow-ar',
]);

const skipRule: Rule = (el, ctx) => {
  const name = tagName(el);
  if (name === 'script' || name === 'style' || name === 'template' || name === 'noscript')
    return [];
  if (name === 'hr' || name === 'br') return [];
  if (classes(el).some((c) => SCAFFOLD_SKIP.has(c))) return [];
  if (name === 'svg' && hasClass(el, 'hero-art')) {
    ctx.report.addDropped('hero illustration `svg.hero-art` (theme decoration)', ctx.slideId);
    return [];
  }
  if (isIconOnly(el)) {
    bump(fmt(ctx), 'decorative icons dropped');
    return [];
  }
  return null;
};

const simRule: Rule = (el, ctx) => {
  if (!el.hasAttribute('data-sim')) return null;
  const params: Record<string, unknown> = { sim: el.getAttribute('data-sim') ?? '' };
  for (const key of ['eyebrow', 'heading', 'terms']) {
    const v = el.getAttribute(`data-${key}`);
    if (v) params[key] = stripTokens(v);
  }
  if (el.innerHTML.trim()) params.html = htmlOf(el, ctx);
  ctx.report.addHeuristic(
    'network simulator → `widget sim` (Phase 3 plugin)',
    selectorOf(el),
    ctx.slideId,
  );
  const block: WidgetBlock = { type: 'widget', name: 'sim', params };
  return [block];
};

const sourceLinksRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'source-links', 'sv-ref')) return null;
  const links = Array.from(el.querySelectorAll('a[href]'));
  if (!links.length) return null;
  for (const a of links) ctx.slideRefs.push(ctx.addRef(a.getAttribute('href') ?? '', textOf(a)));
  ctx.report.addHeuristic('inline source links → slide `refs`', selectorOf(el), ctx.slideId);
  return [];
};

const chainRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'decision-chain')) return null;
  const items: ChainBlock['items'] = [];
  for (const art of childElements(el)) {
    const no = art.querySelector(':scope > span');
    const label = art.querySelector(':scope > b, :scope > strong, :scope > h3');
    const sub = art.querySelector(':scope > small, :scope > p');
    if (!label) return null;
    const item: ChainBlock['items'][number] = { label: inline(ctx, label) };
    if (no && textOf(no)) item.no = textOf(no);
    if (sub && textOf(sub)) item.sub = inline(ctx, sub);
    items.push(item);
  }
  if (!items.length) return null;
  if (hasClass(el, 'compact')) bump(fmt(ctx), 'chain variant `.compact` dropped');
  return [{ type: 'chain', items }];
};

function cardFrom(art: Element, ctx: MapContext): CardsBlock['items'][number] | null {
  const parts = flattenParts(art).filter((p) => {
    if (isEmpty(p)) {
      if (p.hasAttribute('aria-live') || p.id) bump(fmt(ctx), 'dynamic status regions dropped');
      return false;
    }
    return !isIconOnly(p);
  });
  const titleIdx = parts.findIndex((p) => /^h[2-5]$/.test(tagName(p)));
  if (titleIdx < 0) return null;
  const kickerParts = parts.slice(0, titleIdx);
  const bodyParts = parts.slice(titleIdx + 1);
  const title = inline(ctx, parts[titleIdx] as Element);
  if (!title) return null;
  const item: CardsBlock['items'][number] = { title };
  const kicker = kickerParts
    .map((p) => inline(ctx, p))
    .filter(Boolean)
    .join(' · ');
  if (kicker) item.kicker = kicker;
  const body = bodyParts
    .map((p) => inline(ctx, p))
    .filter(Boolean)
    .join(' ');
  if (body) item.body = body;
  const icon = iconOf(art);
  if (icon) item.icon = icon;
  const tone = toneOf(art);
  if (tone) item.tone = tone;
  return item;
}

function colsFor(n: number): 2 | 3 | 4 {
  if (n <= 2) return 2;
  if (n <= 4) return n as 3 | 4;
  return n <= 6 ? 3 : 4;
}

const cardsRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'v-cards')) return null;
  const colsClass = classes(el).find((c) => /^cols-\d$/.test(c));
  const n = colsClass ? Number(colsClass.slice(5)) : 0;
  const items: CardsBlock['items'] = [];
  for (const art of childElements(el)) {
    const kicker = art.querySelector('.v-kicker');
    const h = art.querySelector('h3, h4');
    if (!h) return null;
    const item: CardsBlock['items'][number] = { title: inline(ctx, h) };
    if (kicker && textOf(kicker)) item.kicker = inline(ctx, kicker);
    const body = Array.from(art.querySelectorAll(':scope > p, :scope > small'))
      .map((p) => inline(ctx, p))
      .filter(Boolean)
      .join(' ');
    if (body) item.body = body;
    const icon = iconOf(art);
    if (icon) item.icon = icon;
    const tone = toneOf(art);
    if (tone) item.tone = tone;
    items.push(item);
  }
  if (!items.length) return null;
  if (n < 2 || n > 4) {
    // One-column card stacks have no component yet (CardsBlock.cols is 2 | 3 | 4).
    return fallback(el, ctx);
  }
  return [{ type: 'cards', cols: n as 2 | 3 | 4, items }];
};

const takeawayRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'takeaway', 'fin')) return null;
  const labelEl = childElements(el).find((c) => ['b', 'strong'].includes(tagName(c)));
  const text = inline(ctx, el, labelEl ? (x) => x === labelEl : undefined);
  const label = labelEl ? inline(ctx, labelEl) : '';
  if (!text && !label) return [];
  if (!text) return [{ type: 'takeaway', text: label }];
  return [label ? { type: 'takeaway', label, text } : { type: 'takeaway', text }];
};

const termsRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'term-strip')) return null;
  const items: TermsBlock['items'] = [];
  for (const row of childElements(el)) {
    const abbr = row.querySelector('b, strong, dt');
    if (!abbr) return null;
    const en = row.querySelector('span, .tip-en');
    const ko = row.querySelector('em, .tip-ko, dd');
    const item: TermsBlock['items'][number] = { abbr: textOf(abbr), ko: ko ? inline(ctx, ko) : '' };
    if (en && textOf(en)) item.en = inline(ctx, en);
    items.push(item);
    const expansion = [en ? textOf(en) : '', ko ? textOf(ko) : ''].filter(Boolean).join(' ');
    const existing = ctx.terms[item.abbr];
    if (existing === undefined) ctx.terms[item.abbr] = expansion;
    else if (existing !== expansion) {
      ctx.report.warn(
        `Term \`${item.abbr}\` has two expansions; kept "${existing}", slide ${ctx.slideId} says "${expansion}".`,
      );
    }
  }
  return items.length ? [{ type: 'terms', items }] : null;
};

function rowsOf(table: Element): Element[] {
  const rows: Element[] = [];
  for (const c of childElements(table)) {
    const name = tagName(c);
    if (name === 'tr') rows.push(c);
    else if (name === 'thead' || name === 'tbody' || name === 'tfoot')
      rows.push(...childElements(c).filter((r) => tagName(r) === 'tr'));
  }
  return rows;
}

function alignOf(cell: Element): 'l' | 'c' | 'r' {
  const cls = classes(cell);
  const style = cell.getAttribute('style') ?? '';
  if (
    cls.includes('c') ||
    /text-align:\s*center/.test(style) ||
    cell.getAttribute('align') === 'center'
  )
    return 'c';
  if (
    cls.includes('r') ||
    /text-align:\s*right/.test(style) ||
    cell.getAttribute('align') === 'right'
  )
    return 'r';
  return 'l';
}

const tableRule: Rule = (el, ctx) => {
  if (tagName(el) !== 'table') return null;
  const rows = rowsOf(el);
  if (!rows.length) return null;
  for (const cell of Array.from(el.querySelectorAll('td, th'))) {
    if (
      Number(cell.getAttribute('colspan') ?? 1) > 1 ||
      Number(cell.getAttribute('rowspan') ?? 1) > 1
    ) {
      bump(fmt(ctx), 'tables with merged cells kept as html');
      return fallback(el, ctx);
    }
    if (cell.querySelector('table, ul, ol, img, svg')) return fallback(el, ctx);
  }
  const cellsOf = (tr: Element): Element[] =>
    childElements(tr).filter((c) => ['td', 'th'].includes(tagName(c)));
  const first = rows[0] as Element;
  const headRow =
    first.parentElement && tagName(first.parentElement) === 'thead'
      ? first
      : cellsOf(first).every((c) => tagName(c) === 'th')
        ? first
        : undefined;
  if (!headRow) bump(fmt(ctx), 'tables without a header row (first row promoted)');
  const headCells = cellsOf(first);
  const body = rows.slice(1);
  const width = Math.max(headCells.length, ...body.map((r) => cellsOf(r).length));
  const pad = (a: string[]): string[] => [
    ...a,
    ...Array<string>(Math.max(0, width - a.length)).fill(''),
  ];
  const block: TableBlock = {
    type: 'table',
    head: pad(headCells.map((c) => inline(ctx, c))),
    rows: body.map((r) => pad(cellsOf(r).map((c) => inline(ctx, c)))),
  };
  const align = pad(headCells.map(alignOf)).map((a) => (a || 'l') as 'l' | 'c' | 'r');
  if (align.some((a) => a !== 'l')) block.align = align;
  const caption = el.querySelector('caption');
  if (caption && textOf(caption)) block.caption = inline(ctx, caption);
  const extra = classes(el).filter((c) => !['v-table', 'u'].includes(c));
  if (extra.length) bump(fmt(ctx), 'table style variants dropped');
  const hot = body.filter((r) => classes(r).length > 0).length;
  if (hot) bump(fmt(ctx), 'table row highlights dropped', hot);
  if (el.querySelector('[style*="width"]')) bump(fmt(ctx), 'table column widths dropped');
  return [block];
};

const compareRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'compare-layout')) return null;
  const sides = childElements(el).filter((c) => hasClass(c, 'compare-side'));
  const mid = childElements(el).find((c) => hasClass(c, 'compare-mid'));
  if (sides.length !== 2) return null;
  const side = (s: Element): { head: string; cell: string } => {
    const h = s.querySelector('h2, h3');
    const kicker = s.querySelector(':scope > span');
    const head = [kicker ? textOf(kicker) : '', h ? inline(ctx, h) : '']
      .filter(Boolean)
      .join(' · ');
    const cell = inline(ctx, s, (x) => x === h || x === kicker);
    return { head, cell };
  };
  const [a, b] = [side(sides[0] as Element), side(sides[1] as Element)];
  const block: CompareBlock = {
    type: 'compare',
    left: a.head,
    right: b.head,
    rows: [{ label: mid ? inline(ctx, mid) : '', left: a.cell, right: b.cell }],
  };
  return [block];
};

function calloutKind(el: Element): CalloutBlock['kind'] {
  const cls = classes(el);
  if (cls.some((c) => /^(warn|warning|caution|part)$/.test(c))) return 'warn';
  if (cls.some((c) => /^(ok|success|allow)$/.test(c))) return 'ok';
  if (cls.some((c) => /^(err|error|danger|alert|drop)$/.test(c))) return 'danger';
  return 'info';
}

const calloutRule: Rule = (el, ctx) => {
  const name = tagName(el);
  if (!(
    hasClass(el, 'notice', 'help-card', 'callout', 'why') ||
    (name === 'div' && hasClass(el, 'key'))
  ))
    return null;
  if (el.querySelector('table, ul, ol, img, figure')) return null;
  const titleEl = el.querySelector(':scope > .callout-title, :scope > h3, :scope > h4');
  const body = inline(ctx, el, titleEl ? (x) => x === titleEl : undefined);
  if (el.querySelector(':scope > i[data-lucide]')) bump(fmt(ctx), 'callout icons dropped');
  const block: CalloutBlock = { type: 'callout', kind: calloutKind(el), body };
  if (titleEl && textOf(titleEl)) block.title = inline(ctx, titleEl);
  if (!block.body && !block.title) return [];
  if (!block.body) {
    block.body = block.title ?? '';
    delete block.title;
  }
  return [block];
};

/** v9.7 single `.card` (kicker `.k` + text) → callout. */
const cardRule: Rule = (el, ctx) => {
  if (!(hasClass(el, 'card') && tagName(el) === 'div')) return null;
  if (el.querySelector('table, ul, ol, img, figure, svg, .row, .card, button')) return null;
  const titleEl = el.querySelector(':scope > .k, :scope > h3, :scope > h4');
  const body = inline(ctx, el, titleEl ? (x) => x === titleEl : undefined);
  const kind = hasClass(el, 'warn')
    ? 'warn'
    : hasClass(el, 'ok')
      ? 'ok'
      : hasClass(el, 'err', 'red')
        ? 'danger'
        : 'info';
  const block: CalloutBlock = { type: 'callout', kind, body };
  if (titleEl && textOf(titleEl)) block.title = inline(ctx, titleEl);
  if (!body) return null;
  ctx.report.addHeuristic('single `.card` → callout', selectorOf(el), ctx.slideId);
  return [block];
};

function imageBlock(img: Element, ctx: MapContext, scope: Element): ImageBlock | null {
  const asset = ctx.assets.fromImg(img);
  if (!asset) return null;
  ctx.assets.markReferenced(asset);
  const block: ImageBlock = { type: 'image', asset };
  const caption = scope.querySelector('figcaption, .media-caption');
  if (caption && textOf(caption)) block.caption = inline(ctx, caption);
  if (scope.querySelector('.image-open, [data-zoom]') || hasClass(scope, 'image-open'))
    block.zoom = true;
  return block;
}

const figureRule: Rule = (el, ctx) => {
  const name = tagName(el);
  if (name === 'figure') {
    const imgs = el.querySelectorAll('img');
    if (imgs.length !== 1) return null;
    const other = childElements(el).filter(
      (c) => !['figcaption', 'img', 'button', 'a', 'picture'].includes(tagName(c)),
    );
    if (other.length) return null;
    const block = imageBlock(imgs[0] as Element, ctx, el);
    if (block && classes(el).some((c) => c !== 'v-figure'))
      bump(fmt(ctx), 'figure layout variants dropped');
    return block ? [block] : null;
  }
  if (name === 'img') {
    const block = imageBlock(el, ctx, el);
    return block ? [block] : null;
  }
  if (hasClass(el, 'image-open')) {
    const img = el.querySelector('img');
    const block = img ? imageBlock(img, ctx, el) : null;
    if (block) block.zoom = true;
    return block ? [block] : null;
  }
  return null;
};

function youtubeId(src: string): { id: string; start?: number } | undefined {
  const m =
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{6,})(?:.*?[?&](?:start|t)=(\d+))?/.exec(
      src,
    );
  if (!m?.[1]) return undefined;
  return m[2] ? { id: m[1], start: Number(m[2]) } : { id: m[1] };
}

const videoRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'video-reference', 'video-frame')) return null;
  const trigger = el.querySelector('[data-video]') ?? (el.hasAttribute('data-video') ? el : null);
  let id = trigger?.getAttribute('data-video') ?? undefined;
  let start = trigger?.getAttribute('data-start')
    ? Number(trigger.getAttribute('data-start'))
    : undefined;
  if (!id) {
    const yt = youtubeId(el.querySelector('iframe')?.getAttribute('src') ?? '');
    if (yt) {
      id = yt.id;
      start = yt.start;
    }
  }
  if (!id) return null;
  const block: VideoBlock = { type: 'video', video: id };
  if (start !== undefined && Number.isFinite(start)) block.start = start;
  const caption = el.querySelector('.media-caption');
  if (trigger && trigger !== el) {
    const label = textOf(trigger)
      .replace(/^[▶►]\s*/, '')
      .replace(/^영상\s*·\s*/, '')
      .trim();
    if (label) block.label = label;
  }
  if (caption && textOf(caption)) block.caption = inline(ctx, caption);
  if (!ctx.videos.has(id))
    ctx.report.warn(`Video \`${id}\` on ${ctx.slideId} is not in the deck's video list.`);
  return [block];
};

function pillItem(el: Element, ctx: MapContext): PillsBlock['items'][number] {
  const item: PillsBlock['items'][number] = { text: inline(ctx, el) };
  const tone = toneOf(el);
  if (tone) item.tone = tone;
  if (el.querySelector('i[data-lucide]')) bump(fmt(ctx), 'pill icons dropped');
  return item;
}

const pillsRule: Rule = (el, ctx) => {
  const kids = childElements(el);
  if (hasClass(el, 'cover-chips', 'pills', 'chips')) {
    const items = kids.map((k) => pillItem(k, ctx)).filter((i) => i.text);
    return items.length ? [{ type: 'pills', items }] : null;
  }
  if (hasClass(el, 'pill', 'chip') && isInlineOnly(el))
    return [{ type: 'pills', items: [pillItem(el, ctx)] }];
  if (kids.length && kids.every((k) => hasClass(k, 'pill', 'chip')) && !textOfDirect(el)) {
    return [{ type: 'pills', items: kids.map((k) => pillItem(k, ctx)) }];
  }
  return null;
};

function textOfDirect(el: Element): string {
  return Array.from(el.childNodes)
    .filter(isText)
    .map((t) => t.data)
    .join('')
    .trim();
}

const VERDICTS: Record<string, VerdictBlock['verdict']> = {
  allow: 'allow',
  drop: 'drop',
  ok: 'ok',
  hot: 'hot',
  info: 'info',
  part: 'hot',
};

const verdictRule: Rule = (el, ctx) => {
  if (!hasClass(el, 'verdict')) return null;
  const kind = classes(el)
    .map((c) => VERDICTS[c])
    .find(Boolean);
  if (!kind) return null;
  if (hasClass(el, 'part')) bump(fmt(ctx), 'verdict `.part` mapped to `hot`');
  return [{ type: 'verdict', verdict: kind, text: inline(ctx, el) }];
};

function stepItems(items: Element[], ctx: MapContext): StepsBlock['items'] | null {
  const out: StepsBlock['items'] = [];
  for (const li of items) {
    const parts = flattenParts(li).filter((p) => !hasClass(p, 'n') && !isIconOnly(p));
    const titleEl = parts.find(
      (p) => hasClass(p, 't') || ['b', 'strong', 'h3', 'h4'].includes(tagName(p)),
    );
    if (!titleEl) {
      const title = inline(ctx, li, (x) => hasClass(x, 'n'));
      if (!title) continue;
      out.push({ title });
      continue;
    }
    const rest = parts
      .filter((p) => p !== titleEl)
      .map((p) => inline(ctx, p))
      .filter(Boolean);
    const direct = textOfDirect(li);
    const item: StepsBlock['items'][number] = { title: inline(ctx, titleEl) };
    const body = [direct ? inline(ctx, Array.from(li.childNodes).filter(isText)) : '', ...rest]
      .filter(Boolean)
      .join(' · ');
    if (body) item.body = body;
    out.push(item);
  }
  return out.length ? out : null;
}

const stepsRule: Rule = (el, ctx) => {
  const agenda = hasClass(el, 'agenda');
  if (!(
    agenda ||
    (tagName(el) === 'ul' && hasClass(el, 'nlist')) ||
    hasClass(el, 'sv-steps') ||
    (tagName(el) === 'ol' && hasClass(el, 'steps'))
  )) {
    return null;
  }
  const items = stepItems(childElements(el), ctx);
  if (!items) return null;
  if (tagName(el) === 'ul' || agenda)
    ctx.report.addHeuristic('numbered list → steps', selectorOf(el), ctx.slideId);
  return [{ type: 'steps', items }];
};

const INTERACTIVE =
  'input, select, textarea, output, button[id], [data-apb], [data-jit-step], [data-exam], [data-solutions], [data-dd-go], [data-dd-close], button[data-source], button[data-media], [data-term]';

const interactiveRule: Rule = (el, ctx) => {
  if (el.matches(INTERACTIVE) || el.hasAttribute('aria-live') || el.querySelector(INTERACTIVE)) {
    return fallback(el, ctx, 'interactive');
  }
  return null;
};

// ---------------------------------------------------------------------------------------------
// plain HTML tags
// ---------------------------------------------------------------------------------------------

const tagRule: Rule = (el, ctx) => {
  const name = tagName(el);
  if (name === 'p' || name === 'small') {
    if (el.querySelector('img, table, ul, ol')) return null;
    const text = inline(ctx, el);
    if (!text) return [];
    const lead = hasClass(el, 'v-lead', 'lead', 's-sub');
    if (hasClass(el, 'fine'))
      bump(fmt(ctx), 'fine-print paragraphs (`p.fine`) as plain paragraphs');
    return [lead ? { type: 'paragraph', text, lead: true } : { type: 'paragraph', text }];
  }
  if (/^h[1-6]$/.test(name)) {
    const text = inline(ctx, el);
    return text ? [{ type: 'paragraph', text, lead: true }] : [];
  }
  if (name === 'ul') {
    const lis = childElements(el).filter((c) => tagName(c) === 'li');
    if (lis.length !== childElements(el).length) return null;
    if (el.querySelector('li ul, li ol')) bump(fmt(ctx), 'nested lists flattened');
    const items = lis.map((li) => inline(ctx, li)).filter(Boolean);
    return items.length ? [{ type: 'bullets', items }] : [];
  }
  if (name === 'ol') {
    const lis = childElements(el).filter((c) => tagName(c) === 'li');
    if (lis.length !== childElements(el).length) return null;
    const items = stepItems(lis, ctx);
    return items ? [{ type: 'steps', items }] : [];
  }
  if (name === 'blockquote') {
    const citeEl = el.querySelector('cite, footer');
    const text = inline(ctx, el, citeEl ? (x) => x === citeEl : undefined);
    if (!text) return [];
    const cite = citeEl ? textOf(citeEl).replace(/^[—–-]\s*/, '') : '';
    return [cite ? { type: 'quote', text, cite } : { type: 'quote', text }];
  }
  if (name === 'pre') {
    const code = el.querySelector('code') ?? el;
    const lang = /language-([\w+-]+)/.exec(code.getAttribute('class') ?? '')?.[1];
    const text = (code.textContent ?? '').replace(/\n$/, '');
    return [lang ? { type: 'code', code: text, lang } : { type: 'code', code: text }];
  }
  return null;
};

// ---------------------------------------------------------------------------------------------
// structural heuristics
// ---------------------------------------------------------------------------------------------

const WRAPPER_CLASSES = new Set(['stack', 'grow', 'slide-wrapper', 's-body', 'full', 'col']);

const wrapperRule: Rule = (el, ctx) => {
  const name = tagName(el);
  if (!['div', 'section', 'main', 'header', 'span'].includes(name)) return null;
  if (name === 'span' && isInlineOnly(el)) return null;
  const cls = classes(el);
  if (!cls.every((c) => WRAPPER_CLASSES.has(c))) return null;
  if (!childElements(el).length) return null;
  if (cls.length) ctx.report.addHeuristic('layout wrapper flattened', selectorOf(el), ctx.slideId);
  if (el.getAttribute('style')) bump(fmt(ctx), 'wrapper inline styles dropped');
  return mapChildren(el, ctx);
};

const GRID_BLOCKERS = 'figure, img, table, ul, ol, button, input, iframe, video, svg';

const articleGridRule: Rule = (el, ctx) => {
  const kids = childElements(el).filter((k) => !isIconOnly(k));
  if (kids.length < 2 || !kids.every((k) => tagName(k) === 'article')) return null;
  if (el.querySelector(GRID_BLOCKERS)) return null;
  if (classes(el).some((c) => /steps/.test(c))) {
    const items: StepsBlock['items'] = [];
    for (const k of kids) {
      const card = cardFrom(k, ctx);
      if (!card) return null;
      const step: StepsBlock['items'][number] = { title: card.title };
      if (card.body) step.body = card.body;
      items.push(step);
    }
    ctx.report.addHeuristic('numbered article list → steps', selectorOf(el), ctx.slideId);
    return [{ type: 'steps', items }];
  }
  const items: CardsBlock['items'] = [];
  for (const k of kids) {
    const card = cardFrom(k, ctx);
    if (!card) return null;
    items.push(card);
  }
  ctx.report.addHeuristic('article grid → cards', selectorOf(el), ctx.slideId);
  return [{ type: 'cards', cols: colsFor(items.length), items }];
};

const COLUMN_CLASSES = new Set(['split', 'gate-photos', 'bio-intro', 'row', 'two-col', 'columns']);

const columnsRule: Rule = (el, ctx) => {
  if (ctx.inColumn || !classes(el).some((c) => COLUMN_CLASSES.has(c))) return null;
  const kids = childElements(el).filter((k) => !isIconOnly(k) && !isEmpty(k));
  if (kids.length < 2 || kids.length > 3) return null;
  if (kids.some((k) => hasClass(k, 'pill', 'chip') || INLINE_TAGS.has(tagName(k)))) return null;
  const inner: MapContext = { ...ctx, inColumn: true };
  const columns = kids.map((k) => {
    const wrapper =
      (tagName(k) === 'div' && classes(k).every((c) => WRAPPER_CLASSES.has(c))) ||
      hasClass(k, 'col');
    return wrapper ? mapChildren(k, inner) : mapElement(k, inner);
  });
  if (columns.every((c) => c.length === 0)) return null;
  if (columns.every((c) => c.every((b) => b.type === 'html'))) return null;
  ctx.report.addHeuristic('side-by-side layout → columns', selectorOf(el), ctx.slideId);
  if (el.getAttribute('style')) bump(fmt(ctx), 'layout inline styles dropped');
  return [{ type: 'columns', cols: kids.length as 2 | 3, columns }];
};

const inlineDivRule: Rule = (el, ctx) => {
  if (!['div', 'span', 'section'].includes(tagName(el))) return null;
  if (!isInlineOnly(el)) return null;
  const text = inline(ctx, el);
  if (!text) return null;
  ctx.report.addHeuristic('text-only element → paragraph', selectorOf(el), ctx.slideId);
  return [{ type: 'paragraph', text }];
};

/** `div > p(b + text)…` — each labelled paragraph becomes a callout with the label as title. */
const labelledParagraphsRule: Rule = (el, ctx) => {
  const kids = childElements(el);
  if (!kids.length || !kids.every((k) => tagName(k) === 'p')) return null;
  const items: CalloutBlock[] = [];
  for (const p of kids) {
    const bolds = p.querySelectorAll('b, strong');
    const first = childElements(p)[0];
    if (bolds.length !== 1 || !first || !['b', 'strong'].includes(tagName(first))) return null;
    if (!textOf(p).startsWith(textOf(first))) return null;
    const body = inline(ctx, p, (x) => x === first);
    if (!body) return null;
    items.push({ type: 'callout', kind: 'info', title: inline(ctx, first), body });
  }
  ctx.report.addHeuristic('labelled paragraphs → callouts', selectorOf(el), ctx.slideId);
  return items;
};

/** A styled box holding only headings, paragraphs and lists: its content is flattened. */
const textBoxRule: Rule = (el, ctx) => {
  if (!['div', 'section', 'aside'].includes(tagName(el))) return null;
  const kids = childElements(el);
  if (kids.length < 2 || !kids.every((k) => /^(h[2-5]|p|ul|ol)$/.test(tagName(k)))) return null;
  if (textOfDirect(el)) return null;
  ctx.report.addHeuristic('text box flattened (box style dropped)', selectorOf(el), ctx.slideId);
  return mapChildren(el, ctx);
};

const RULES: Rule[] = [
  skipRule,
  simRule,
  sourceLinksRule,
  interactiveRule,
  chainRule,
  cardsRule,
  takeawayRule,
  termsRule,
  tableRule,
  compareRule,
  calloutRule,
  figureRule,
  videoRule,
  pillsRule,
  verdictRule,
  stepsRule,
  cardRule,
  tagRule,
  wrapperRule,
  articleGridRule,
  columnsRule,
  labelledParagraphsRule,
  textBoxRule,
  inlineDivRule,
];

export function mapElement(el: Element, ctx: MapContext): Block[] {
  for (const rule of RULES) {
    const out = rule(el, ctx);
    if (out) return out;
  }
  return fallback(el, ctx);
}

export function mapChildren(parent: Element, ctx: MapContext): Block[] {
  const blocks: Block[] = [];
  for (const node of Array.from(parent.childNodes)) {
    if (isElement(node)) blocks.push(...mapElement(node, ctx));
    else if (isText(node) && node.data.trim()) {
      ctx.report.addHeuristic(
        'loose text → paragraph',
        `${selectorOf(parent)} > #text`,
        ctx.slideId,
      );
      blocks.push({ type: 'paragraph', text: inline(ctx, node) });
    }
  }
  return blocks;
}
