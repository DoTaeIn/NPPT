/**
 * Composite legacy layouts mapped onto existing components (second pass, components.md §4):
 * numbered flow cards, label rows, generation comparisons, product and photo grids, video
 * cards, step strips and the V20 reference footer.
 *
 * Rules are function declarations (hoisted), because blocks.ts lists them in its rule table
 * while this module imports blocks.ts helpers.
 */
import type {
  Block,
  CardsBlock,
  ChainBlock,
  ImageBlock,
  TableBlock,
  TilesBlock,
  VideoBlock,
} from '@marco/schema';
import {
  bumpFmt,
  cardCols,
  inline,
  isEmpty,
  isIconOnly,
  isInlineOnly,
  mapElement,
  sourceText,
  textOfDirect,
  type MapContext,
} from './blocks.js';
import { childElements, classes, hasClass, selectorOf, tagName, textOf } from './dom.js';
import { plainText } from './inline.js';

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/** Text-bearing leaves in document order: inline-only elements, icons and empties skipped. */
export function textLeaves(el: Element): Element[] {
  const out: Element[] = [];
  const walk = (e: Element): void => {
    for (const c of childElements(e)) {
      if (isIconOnly(c) || isEmpty(c)) continue;
      if (isInlineOnly(c)) out.push(c);
      else walk(c);
    }
  };
  walk(el);
  return out;
}

const isArrow = (el: Element): boolean =>
  hasClass(el, 'flow-ar', 'arr', 'sa', 'garr', 'dd-fa') || isIconOnly(el);

/**
 * Lay out one group of blocks per item side by side: `columns` rows of up to 3 (4 items → 2 × 2),
 * or plain blocks in sequence when already inside a column (columns do not nest).
 */
function gridOf(cells: Block[][], ctx: MapContext): Block[] {
  if (ctx.inColumn || cells.length < 2) return cells.flat();
  const per = cells.length === 4 ? 2 : Math.min(3, cells.length);
  const out: Block[] = [];
  for (let i = 0; i < cells.length; i += per) {
    const row = cells.slice(i, i + per);
    if (row.length === 1) out.push(...(row[0] ?? []));
    else out.push({ type: 'columns', cols: row.length as 2 | 3, columns: row });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// numbered flow cards: `.row > .card(number badge, kicker, title, text)` and `.flow > .st`
// ---------------------------------------------------------------------------------------------

interface FlowItem {
  no: string;
  label: string;
  title: string;
  body: string;
  hot: boolean;
}

function flowItem(card: Element, ctx: MapContext): FlowItem | null {
  if (isInlineOnly(card)) return null;
  const leaves = textLeaves(card);
  const first = leaves[0];
  if (!first) return null;
  const no = textOf(first);
  if (!/^\d{1,2}$/.test(no)) return null;
  const rest = leaves.slice(1);
  const t = rest.findIndex(
    (l) => ['b', 'strong', 'h3', 'h4', 'h5'].includes(tagName(l)) || hasClass(l, 't'),
  );
  if (t < 0) return null;
  const text = (els: Element[]): string =>
    els
      .map((l) => inline(ctx, l))
      .filter(Boolean)
      .join(' · ');
  const title = inline(ctx, rest[t] as Element);
  if (!title) return null;
  return {
    no,
    label: text(rest.slice(0, t)),
    title,
    body: text(rest.slice(t + 1)),
    hot: hasClass(card, 'hot'),
  };
}

export function flowCardsRule(el: Element, ctx: MapContext): Block[] | null {
  // Numbered lists (`ol`, `.agenda`, `.architecture-steps`) are steps; see blocks.ts.
  if (isInlineOnly(el) || ['ol', 'ul'].includes(tagName(el))) return null;
  if (classes(el).some((c) => /steps|agenda/.test(c))) return null;
  const kids = childElements(el).filter((k) => !isArrow(k));
  if (kids.length < 2 || kids.length > 8) return null;
  const items: FlowItem[] = [];
  for (const k of kids) {
    const item = flowItem(k, ctx);
    if (!item) return null;
    items.push(item);
  }
  const short = items.every(
    (i) =>
      !i.label &&
      Array.from(plainText(i.title)).length <= 10 &&
      Array.from(plainText(i.body)).length <= 22,
  );
  if (short && items.length <= 6) {
    ctx.report.addHeuristic('numbered flow → chain', selectorOf(el), ctx.slideId);
    const chain: ChainBlock['items'] = items.map((i) =>
      i.body ? { no: i.no, label: i.title, sub: i.body } : { no: i.no, label: i.title },
    );
    return [{ type: 'chain', items: chain }];
  }
  ctx.report.addHeuristic(
    'numbered flow cards → cards (number in the kicker)',
    selectorOf(el),
    ctx.slideId,
  );
  if (items.some((i) => i.hot)) bumpFmt(ctx, 'highlighted flow step → tone primary');
  const cards: CardsBlock['items'] = items.map((i) => {
    const card: CardsBlock['items'][number] = {
      kicker: i.label ? `${i.no} · ${i.label}` : i.no,
      title: i.title,
    };
    if (i.body) card.body = i.body;
    if (i.hot) card.tone = 'primary';
    return card;
  });
  return [{ type: 'cards', cols: cardCols(el, cards.length, ctx), items: cards }];
}

// ---------------------------------------------------------------------------------------------
// label rows: `.col > .row(pill → card)`, `.card > .k + .row(b + span)`, `.col > .trow`
// ---------------------------------------------------------------------------------------------

/** Cells of one label row, or null when a part is not plain inline text. */
function rowCells(row: Element, ctx: MapContext): string[] | null {
  const cells: string[] = [];
  for (const c of childElements(row)) {
    if (isArrow(c) || isEmpty(c)) continue;
    const kids = childElements(c);
    if (
      !isInlineOnly(c) ||
      (kids.length >= 2 && !textOfDirect(c) && ['div', 'span'].includes(tagName(c)))
    ) {
      // A text group (`.tt > b + span`): one cell per part; anything block-level fails.
      if (!kids.every((k) => isInlineOnly(k))) {
        if (kids.length === 1 && isInlineOnly(kids[0] as Element)) {
          cells.push(inline(ctx, c));
          continue;
        }
        return null;
      }
      const parts: string[] = [];
      for (const k of kids) {
        if (isIconOnly(k) || isEmpty(k)) continue;
        // A link appended to a text part (v9.4 source links) stays in that cell.
        if (tagName(k) === 'a' && parts.length) parts[parts.length - 1] += ` ${inline(ctx, [k])}`;
        else parts.push(inline(ctx, k));
      }
      cells.push(...parts);
      continue;
    }
    cells.push(inline(ctx, c));
  }
  if (textOfDirect(row)) return null;
  return cells;
}

export function labelRowsRule(el: Element, ctx: MapContext): Block[] | null {
  let kids = childElements(el).filter((k) => !isIconOnly(k) && !isEmpty(k));
  let caption: string | undefined;
  const head = kids[0];
  if (head && (hasClass(head, 'k') || /^h[3-5]$/.test(tagName(head)))) {
    caption = inline(ctx, head);
    kids = kids.slice(1);
  }
  if (kids.length < 2) return null;
  const kind = hasClass(kids[0] as Element, 'trow') ? 'trow' : 'row';
  if (!kids.every((k) => hasClass(k, kind))) return null;
  const rows: string[][] = [];
  for (const k of kids) {
    const cells = rowCells(k, ctx);
    if (!cells) return null;
    rows.push(cells);
  }
  const width = rows[0]?.length ?? 0;
  if (width < 2 || width > 6 || !rows.every((r) => r.length === width)) return null;
  ctx.report.addHeuristic(
    `label rows (\`.${kind}\`) → table without header`,
    selectorOf(el),
    ctx.slideId,
  );
  if (el.querySelector('.pill, .card, .tn'))
    bumpFmt(ctx, 'row chips and cards flattened into table cells');
  const block: TableBlock = { type: 'table', head: Array<string>(width).fill(''), rows };
  if (caption) block.caption = caption;
  return [block];
}

// ---------------------------------------------------------------------------------------------
// generation comparison: `.gevo > .gcol + .garr + .gcol …` → table (one column per generation)
// ---------------------------------------------------------------------------------------------

interface GenRow {
  key: string;
  label: string;
  value: string;
}

function generationColumn(col: Element, ctx: MapContext): { head: string; rows: GenRow[] } {
  let head = '';
  const rows: GenRow[] = [];
  let pending: string | undefined;
  for (const c of childElements(col)) {
    if (isIconOnly(c)) continue;
    const cls = classes(c)[0] ?? tagName(c);
    if (hasClass(c, 'ghd')) {
      const parts = ['.gg', '.gn']
        .map((s) => c.querySelector(s))
        .filter((x): x is Element => !!x)
        .map((x) => inline(ctx, x));
      head = parts.length ? parts.join(' · ') : inline(ctx, c);
      continue;
    }
    if (hasClass(c, 'gsec')) {
      pending = inline(ctx, c);
      continue;
    }
    if (hasClass(c, 'gmet')) {
      for (const m of childElements(c)) {
        const label = m.querySelector('span');
        const meter = Array.from(m.querySelectorAll('em > i'))
          .map((i) => (hasClass(i, 'on') ? '●' : '○'))
          .join('');
        rows.push({
          key: `gmet|${label ? textOf(label) : ''}`,
          label: label ? inline(ctx, label) : '',
          value: meter,
        });
      }
      continue;
    }
    let value: string;
    if (hasClass(c, 'glay')) {
      value = childElements(c)
        .filter((l) => hasClass(l, 'on'))
        .map((l) =>
          childElements(l)
            .filter((x) => !isIconOnly(x))
            .map((x) => textOf(x))
            .join(' '),
        )
        .join(' · ');
    } else value = inline(ctx, c);
    if (hasClass(c, 'gex') && classes(c).length > 1) bumpFmt(ctx, 'verdict tones dropped');
    rows.push({ key: `${cls}|${pending ?? ''}`, label: pending ?? '', value });
    pending = undefined;
  }
  return { head, rows };
}

export function generationTableRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'gevo')) return null;
  const cols = childElements(el).filter((c) => hasClass(c, 'gcol'));
  if (cols.length < 2 || cols.length > 5) return null;
  const parsed = cols.map((c) => generationColumn(c, ctx));
  const keys = parsed[0]?.rows.map((r) => r.key).join('\n');
  if (!parsed.every((p) => p.rows.map((r) => r.key).join('\n') === keys)) return null;
  const rows: string[][] = (parsed[0]?.rows ?? []).map((r, i) => [
    r.label,
    ...parsed.map((p) => p.rows[i]?.value ?? ''),
  ]);
  // `.garr` between two generations says what the next one adds.
  const arrows: string[] = [];
  let seen = 0;
  for (const c of childElements(el)) {
    if (hasClass(c, 'gcol')) seen++;
    else if (hasClass(c, 'garr')) arrows[seen] = inline(ctx, c);
  }
  if (arrows.some(Boolean)) rows.splice(1, 0, ['', ...parsed.map((_p, i) => arrows[i] ?? '')]);
  ctx.report.addHeuristic('generation comparison → table', selectorOf(el), ctx.slideId);
  bumpFmt(ctx, 'layer diagrams and meters as text (`●○`)');
  return [{ type: 'table', head: ['', ...parsed.map((p) => p.head)], rows }];
}

// ---------------------------------------------------------------------------------------------
// product cards: `.pgrid > .pcard(photo, vendor, name, features, latest, photo credit)` → cards
// ---------------------------------------------------------------------------------------------

export function productGridRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'pgrid')) return null;
  const cards = childElements(el);
  if (!cards.length || !cards.every((c) => hasClass(c, 'pcard'))) return null;
  const items: CardsBlock['items'] = [];
  for (const card of cards) {
    const name = card.querySelector('.pn');
    if (!name) return null;
    const vendor = card.querySelector('.pv');
    const item: CardsBlock['items'][number] = { title: inline(ctx, name) };
    if (vendor) {
      const kicker = childElements(vendor)
        .map((x) => inline(ctx, x))
        .filter(Boolean)
        .join(' · ');
      if (kicker) item.kicker = kicker;
    }
    const features = Array.from(card.querySelectorAll('.pf > li')).map((li) => inline(ctx, li));
    const latest = card.querySelector('.pl');
    const body = [...features, latest ? inline(ctx, latest) : ''].filter(Boolean).join(' · ');
    if (body) item.body = body;
    items.push(item);
    const img = card.querySelector('.ph img');
    if (img) {
      const id = ctx.assets.fromImg(img);
      const credit = card.querySelector('.ps');
      if (id && credit && textOf(credit)) ctx.assets.annotate(id, { credit: textOf(credit) });
      ctx.report.addDropped(
        'product photos in `.pgrid` cards (`cards` has no image; the assets stay in the front matter)',
        ctx.slideId,
      );
    }
  }
  ctx.report.addHeuristic('product cards → cards (photo dropped)', selectorOf(el), ctx.slideId);
  return [{ type: 'cards', cols: cardCols(el, items.length, ctx), items }];
}

// ---------------------------------------------------------------------------------------------
// V20 photo cards: `.equipment-grid > article(figure, h3, small, p, b)` → columns of image + text
// ---------------------------------------------------------------------------------------------

export function equipmentGridRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'equipment-grid')) return null;
  const arts = childElements(el);
  if (!arts.length || !arts.every((a) => tagName(a) === 'article')) return null;
  const height = ctx.css?.px(`.${classes(el)[0] ?? ''} .image-open`, 'height');
  const cells: Block[][] = [];
  for (const art of arts) {
    const img = art.querySelector('img');
    const asset = img ? ctx.assets.fromImg(img) : undefined;
    if (!asset) return null;
    ctx.assets.markReferenced(asset);
    const image: ImageBlock = { type: 'image', asset };
    if (art.querySelector('.image-open, [data-zoom]')) image.zoom = true;
    if (height) image.height = height;
    const caption = art.querySelector('figcaption');
    const h = art.querySelector(':scope > h3, :scope > h4');
    if (caption && textOf(caption) && (!h || textOf(caption) !== textOf(h)))
      image.caption = inline(ctx, caption);
    const parts: string[] = [];
    if (h) parts.push(`**${inline(ctx, h)}**`);
    const small = art.querySelector(':scope > small');
    if (small && textOf(small)) parts[parts.length - 1] += ` · ${inline(ctx, small)}`;
    for (const p of Array.from(art.querySelectorAll(':scope > p'))) parts.push(inline(ctx, p));
    const check = art.querySelector(':scope > b, :scope > strong');
    if (check && textOf(check)) parts.push(`**${inline(ctx, check)}**`);
    const figure = img?.closest('figure') ?? img;
    if (figure) sourceText.set(image, textOf(figure));
    const cell: Block[] = [image];
    const text = parts.filter(Boolean).join(' ');
    if (text) cell.push({ type: 'paragraph', text });
    cells.push(cell);
  }
  ctx.report.addHeuristic('photo cards → columns (image + paragraph)', selectorOf(el), ctx.slideId);
  return gridOf(cells, ctx);
}

// ---------------------------------------------------------------------------------------------
// V20 video cards: `.pentest-videos > article(poster[data-video], date, h3, title, …)` → video
// ---------------------------------------------------------------------------------------------

export function videoCardsRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'pentest-videos')) return null;
  const arts = childElements(el);
  if (!arts.length || !arts.every((a) => tagName(a) === 'article')) return null;
  const cells: Block[][] = [];
  for (const art of arts) {
    const trigger = art.querySelector('[data-video]');
    const id = trigger?.getAttribute('data-video');
    if (!trigger || !id) return null;
    const video: VideoBlock = { type: 'video', video: id };
    const start = Number(trigger.getAttribute('data-start'));
    if (trigger.hasAttribute('data-start') && Number.isFinite(start)) video.start = start;
    const h = art.querySelector('h3, h4');
    if (h && textOf(h)) video.label = inline(ctx, h);
    const title = art.querySelector('.pentest-title');
    if (title && textOf(title)) video.caption = inline(ctx, title);
    if (!ctx.videos.has(id))
      ctx.report.warn(`Video \`${id}\` on ${ctx.slideId} is not in the deck's video list.`);
    const metaEls = ['.pentest-date', '.pentest-speakers', '.pentest-range']
      .map((s) => art.querySelector(s))
      .filter((x): x is Element => !!x && !!textOf(x));
    const meta = metaEls.map((x) => inline(ctx, x)).join(' · ');
    // V20 notes read the card top to bottom (date, heading, title, speakers, range): the video
    // cue covers all of it, the meta line gets no cue of its own.
    const head = [metaEls[0], h, title, ...metaEls.slice(1)].filter((x): x is Element => !!x);
    sourceText.set(video, head.map((x) => textOf(x)).join(' '));
    const cell: Block[] = [video];
    if (meta) {
      const line: Block = { type: 'paragraph', text: meta };
      sourceText.set(line, '');
      cell.push(line);
    }
    const lesson = art.querySelector('.pentest-lesson');
    if (lesson && textOf(lesson)) cell.push({ type: 'paragraph', text: inline(ctx, lesson) });
    cells.push(cell);
    if (art.querySelector('img'))
      ctx.report.addDropped(
        'video card thumbnails (`video` shows no poster; the assets stay in the front matter)',
        ctx.slideId,
      );
    if (art.querySelector('button.action'))
      ctx.report.addDropped(
        'video card play buttons (the `video` block is the button)',
        ctx.slideId,
      );
  }
  ctx.report.addHeuristic('video cards → video blocks', selectorOf(el), ctx.slideId);
  return gridOf(cells, ctx);
}

// ---------------------------------------------------------------------------------------------
// step strip: `.strip > .sn(.l) + .sa + .sn …` → chain (labels only)
// ---------------------------------------------------------------------------------------------

export function stripRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'strip')) return null;
  const nodes = childElements(el).filter((c) => hasClass(c, 'sn'));
  if (nodes.length < 2 || nodes.length > 5) return null;
  const items: TilesBlock['items'] = [];
  for (const n of nodes) {
    const label = n.querySelector('.l') ?? n;
    const text = inline(ctx, label);
    if (!text) return null;
    const item: TilesBlock['items'][number] = { label: text };
    const icon = n.querySelector('i[data-lucide]')?.getAttribute('data-lucide');
    if (icon) item.icon = icon;
    items.push(item);
  }
  ctx.report.addHeuristic('step strip → tiles (icon + label)', selectorOf(el), ctx.slideId);
  if (el.getAttribute('style') || el.querySelector('[style]'))
    bumpFmt(ctx, 'strip emphasis (current step, fading) dropped');
  return [{ type: 'tiles', cols: items.length as TilesBlock['cols'], items }];
}

// ---------------------------------------------------------------------------------------------
// V20 reference footer: `.reference-footer > p + button[data-media]`
// ---------------------------------------------------------------------------------------------

export function referenceFooterRule(el: Element, ctx: MapContext): Block[] | null {
  if (!hasClass(el, 'reference-footer')) return null;
  const blocks: Block[] = [];
  for (const c of childElements(el)) {
    if (tagName(c) === 'button' && c.hasAttribute('data-media')) {
      ctx.report.addDropped(
        'media-credit button (the runtime help dialog lists image and video credits)',
        ctx.slideId,
      );
      continue;
    }
    if (tagName(c) !== 'p') return null;
    blocks.push(...mapElement(c, ctx));
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// v9.x quiz: exam launcher `[data-exam]` and review cards `.qcard[data-q]` → `widget quiz`
// ---------------------------------------------------------------------------------------------

/** `[data-exam]` → `:::widget quiz mode=exam minutes=N` (the deck's own default time limit). */
export function quizExamRule(el: Element, ctx: MapContext): Block[] | null {
  if (!el.hasAttribute('data-exam')) return null;
  const params: Record<string, unknown> = { mode: 'exam', minutes: ctx.quiz?.minutes ?? 15 };
  ctx.report.addHeuristic('exam launcher → `widget quiz mode=exam`', selectorOf(el), ctx.slideId);
  if (textOf(el))
    ctx.report.addDropped(
      'exam launcher text (the quiz widget draws its own start screen)',
      ctx.slideId,
    );
  return [{ type: 'widget', name: 'quiz', params }];
}

/** A grid of `.qcard[data-q]` review cards → `:::widget quiz mode=cards` (+ `area` / `ids`). */
export function quizCardsRule(el: Element, ctx: MapContext): Block[] | null {
  const kids = childElements(el);
  if (!kids.length || !kids.every((k) => hasClass(k, 'qcard') && k.hasAttribute('data-q')))
    return null;
  const ids = kids.map((k) => k.getAttribute('data-q') ?? '');
  const params: Record<string, unknown> = { mode: 'cards' };
  const all = ctx.quiz?.ids ?? [];
  const areas = new Set(ids.map((id) => ctx.quiz?.area[id]));
  const inArea = (a: number | undefined): string[] => all.filter((id) => ctx.quiz?.area[id] === a);
  const [area] = [...areas];
  if (ids.join(',') === all.join(',')) {
    // every item: no filter
  } else if (areas.size === 1 && area !== undefined && ids.join(',') === inArea(area).join(','))
    params.area = area;
  else params.ids = ids.join(',');
  ctx.report.addHeuristic(
    'quiz review cards → `widget quiz mode=cards`',
    selectorOf(el),
    ctx.slideId,
  );
  return [{ type: 'widget', name: 'quiz', params }];
}

/**
 * A container that holds a quiz launcher next to other controls (`.diag-actions`): its children
 * are mapped one by one, so the launcher becomes a widget and the rest keeps its own mapping.
 */
export function quizContainerRule(el: Element, ctx: MapContext): Block[] | null {
  const kids = childElements(el);
  if (!kids.some((k) => k.hasAttribute('data-exam'))) return null;
  return kids.flatMap((k) => mapElement(k, ctx));
}
