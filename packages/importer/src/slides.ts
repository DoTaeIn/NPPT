/**
 * Slide scaffolds for the two legacy families: which elements carry the title, eyebrow,
 * question, footer and refs, and where the body starts. Body content goes through blocks.ts.
 *
 * Titles: `title` is the heading the audience sees; the legacy `data-title` (the TOC label) is
 * kept as `toc` when it differs. Cover, hero and divider slides fill the v0.2 fields `kicker`,
 * `tagline`, `meta` and `art` (components.md §1).
 */
import type { Block, SlideType } from '@marco/schema';
import { fallback, mapChildren, mapElement, type MapContext } from './blocks.js';
import { childElements, classes, hasClass, isElement, isText, tagName, textOf } from './dom.js';
import { inlineOf, plainText } from './inline.js';

export { plainText };
import type { ImportedSlide } from './types.js';

export interface SlideDraft {
  type: SlideType;
  alert?: boolean;
  /** Legacy `data-title` (TOC label). */
  title: string;
  /** Visible on-slide heading; becomes `title` (with `data-title` as `toc` when different). */
  heading?: string;
  /** Explicit TOC label (e.g. a quote slide, whose title is the quote). */
  toc?: string;
  subtitle?: string;
  tag?: string;
  group?: string;
  question?: string;
  no?: string;
  cite?: string;
  kicker?: string;
  tagline?: string;
  meta?: string[];
  art?: string;
  only?: string[];
  refs: string[];
  blocks: Block[];
  footer?: string;
  /** V20 divider/cover data-tag (TOC prefix, e.g. "1부"). */
  groupLabel?: string;
}

const inline = (ctx: MapContext, el: Element | Node[], skip?: (e: Element) => boolean): string =>
  inlineOf(el, skip ? { stats: ctx.report.formatting, skip } : { stats: ctx.report.formatting });

function footerText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const b of Array.from(clone.querySelectorAll('button, .no, .slide-no'))) b.remove();
  return textOf(clone)
    .replace(/^[·\s]+/, '')
    .trim();
}

/** Ref ids in a "참고 출처 S04 · S30 ↗" button. */
export function refIdsFromButton(text: string): string[] {
  return [...text.matchAll(/\b([A-Z]{1,3}\d{1,3})\b/g)].map((m) => m[1] as string);
}

/** Lines of a meta strip: each text node and each child element is one line. */
function metaLines(el: Element, ctx: MapContext): string[] {
  const lines: string[] = [];
  let pending: Node[] = [];
  const flush = (): void => {
    const text = pending.length ? inline(ctx, pending) : '';
    if (text) lines.push(text);
    pending = [];
  };
  for (const node of Array.from(el.childNodes)) {
    if (isElement(node) && !['b', 'strong', 'em', 'i', 'code', 'a'].includes(tagName(node))) {
      flush();
      const text = inline(ctx, node);
      if (text) lines.push(text);
    } else if (isElement(node) || isText(node)) pending.push(node);
  }
  flush();
  return lines;
}

/** The single `<img>` asset of an artwork container, registered and marked referenced. */
function artAsset(el: Element, ctx: MapContext): string | undefined {
  const imgs = tagName(el) === 'img' ? [el] : Array.from(el.querySelectorAll('img'));
  if (imgs.length !== 1) return undefined;
  if (textOf(el)) return undefined;
  const id = ctx.assets.fromImg(imgs[0] as Element);
  if (id) ctx.assets.markReferenced(id);
  return id;
}

// ---------------------------------------------------------------------------------------------
// V20 (week 3)
// ---------------------------------------------------------------------------------------------

export function v20Slide(
  section: Element,
  ctx: MapContext,
  slideRefs: string[] | undefined,
): SlideDraft {
  const cls = classes(section);
  const type: SlideType = cls.includes('cover')
    ? 'cover'
    : cls.includes('divider')
      ? 'divider'
      : cls.includes('quote-slide')
        ? 'quote'
        : 'content';
  const d: SlideDraft = {
    type,
    title: section.getAttribute('data-title')?.trim() ?? '',
    refs: [],
    blocks: [],
  };
  const tag = section.getAttribute('data-tag')?.trim();
  if (tag) d.tag = tag;

  const bottom = section.querySelector('.slide-tag-bottom');
  if (bottom) {
    d.footer = footerText(bottom);
    const button = bottom.querySelector('.source-link');
    if (!slideRefs?.length && button) d.refs.push(...refIdsFromButton(textOf(button)));
  }
  if (slideRefs?.length) d.refs.push(...slideRefs);

  if (type === 'cover' || type === 'divider') {
    // Cover and divider scaffolds do not show an eyebrow; V20 used data-tag only in the TOC.
    // A divider's tag becomes the TOC `group` of the slides that follow it (see import.ts).
    if (d.tag) {
      if (type === 'cover')
        ctx.report.addDropped(`cover TOC prefix (\`data-tag="${d.tag}"\`)`, ctx.slideId);
      d.groupLabel = d.tag;
      delete d.tag;
    }
  }

  if (type === 'cover') {
    for (const child of childElements(section)) {
      if (hasClass(child, 'slide-tag-bottom')) continue;
      if (hasClass(child, 'v-cover-art')) {
        const art = artAsset(child, ctx);
        if (art && !d.art) d.art = art;
        else d.blocks.push(...mapChildren(child, ctx));
        continue;
      }
      if (hasClass(child, 'v-cover-content')) {
        for (const c of childElements(child)) {
          if (hasClass(c, 'cover-eyebrow')) d.kicker = inline(ctx, c);
          else if (hasClass(c, 'cover-en')) d.tagline = inline(ctx, c);
          else if (hasClass(c, 'cover-tagline')) d.subtitle = inline(ctx, c);
          else if (tagName(c) === 'h1' && !d.heading) d.heading = inline(ctx, c);
          else if (hasClass(c, 'cover-meta')) d.meta = metaLines(c, ctx);
          else d.blocks.push(...mapElement(c, ctx));
        }
        continue;
      }
      d.blocks.push(...mapElement(child, ctx));
    }
    return d;
  }

  if (type === 'divider') {
    const content = section.querySelector('.div-content') ?? section;
    const walk = (parent: Element): void => {
      for (const c of childElements(parent)) {
        if (hasClass(c, 'slide-tag-bottom')) continue;
        if (hasClass(c, 'big-num')) d.no = textOf(c);
        else if (hasClass(c, 'div-eyebrow')) d.kicker = inline(ctx, c);
        else if (/^h[12]$/.test(tagName(c)) && !d.heading) d.heading = inline(ctx, c);
        else if (hasClass(c, 'div-desc') && !d.subtitle) d.subtitle = inline(ctx, c);
        else if (tagName(c) === 'div' && classes(c).length === 0) walk(c);
        else d.blocks.push(...mapElement(c, ctx));
      }
    };
    walk(content);
    return d;
  }

  if (type === 'quote') {
    // IR quote slide: `title` is the quote itself (rendered big), `tag` the eyebrow above it,
    // `toc` the legacy TOC label.
    if (d.tag) {
      ctx.report.addDropped(`quote slide TOC prefix (\`data-tag="${d.tag}"\`)`, ctx.slideId);
      delete d.tag;
    }
    const ending = section.querySelector('.ending') ?? section;
    let quote = '';
    for (const c of childElements(ending)) {
      if (hasClass(c, 'slide-tag-bottom')) continue;
      if (!quote && (tagName(c) === 'h2' || tagName(c) === 'blockquote')) quote = inline(ctx, c);
      else if (tagName(c) === 'cite') d.cite = textOf(c).replace(/^[—–-]\s*/, '');
      else if (!d.tag && !quote && hasClass(c, 'v-kicker', 'eyebrow')) d.tag = inline(ctx, c);
      else d.blocks.push(...mapElement(c, ctx));
    }
    if (quote) {
      if (d.title && d.title !== quote) d.toc = d.title;
      d.heading = quote;
    }
    return d;
  }

  const wrapper = section.querySelector(':scope > .slide-wrapper') ?? section;
  const references = wrapper.querySelector('.final-references');
  if (references) d.type = 'references';
  for (const c of childElements(wrapper)) {
    if (hasClass(c, 'slide-tag-bottom')) continue;
    if (hasClass(c, 'eyebrow')) {
      d.tag ??= textOf(c);
      continue;
    }
    if (hasClass(c, 'section-title') || (tagName(c) === 'h2' && !d.heading)) {
      d.heading = inline(ctx, c);
      continue;
    }
    if (hasClass(c, 's-body')) {
      for (const b of childElements(c)) {
        if (b === references) d.only = referenceIds(b, ctx);
        else d.blocks.push(...mapElement(b, ctx));
      }
      continue;
    }
    d.blocks.push(...mapElement(c, ctx));
  }
  return d;
}

/** V20 `.final-references`: grouped `a[data-reference-id]` lists → ref ids in display order. */
function referenceIds(el: Element, ctx: MapContext): string[] {
  const ids: string[] = [];
  const groups: string[] = [];
  for (const article of childElements(el)) {
    const h = article.querySelector('h3, h4');
    if (h) groups.push(textOf(h));
    for (const a of Array.from(article.querySelectorAll('a'))) {
      const id =
        a.getAttribute('data-reference-id') ??
        refIdsFromButton(textOf(a.querySelector('small') ?? a))[0];
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  if (groups.length)
    ctx.report.addDropped(
      `reference group headings (${groups.map((g) => `\`${g}\``).join(', ')}; the list keeps their order)`,
      ctx.slideId,
    );
  ctx.report.addHeuristic(
    'grouped reference list → `references` slide (`only`)',
    'div.final-references',
    ctx.slideId,
  );
  return ids;
}

// ---------------------------------------------------------------------------------------------
// v9.7 (week 5)
// ---------------------------------------------------------------------------------------------

export function v97Slide(section: Element, ctx: MapContext): SlideDraft {
  const cls = classes(section);
  const hero = cls.includes('hero');
  // v9.7 `.hero` sections with the `.div-wrap` layout (big numeral, eyebrow, title, lead) are
  // section openers: MARCO dividers (components.md §1, `no: "!"` + `alert` for the case study).
  const divider = hero && !!section.querySelector(':scope > .div-wrap');
  const d: SlideDraft = {
    type: divider ? 'divider' : hero ? 'hero' : 'content',
    title: section.getAttribute('data-title')?.trim() ?? '',
    refs: [],
    blocks: [],
  };
  if (cls.includes('alert')) d.alert = true;
  const group = section.getAttribute('data-group')?.trim();
  if (group) d.group = group;
  const q = section.getAttribute('data-q')?.trim();
  if (q) d.question = q;

  const eyebrowOf = (el: Element): string =>
    childElements(el)
      .filter((s) => !hasClass(s, 'hq'))
      .map((s) => textOf(s))
      .filter(Boolean)
      .join(' · ') || textOf(el);

  for (const c of childElements(section)) {
    if (hasClass(c, 's-progress')) continue;
    if (hasClass(c, 's-foot')) {
      const brand = c.querySelector('.brand') ?? c;
      d.footer = footerText(brand);
      continue;
    }
    if (hasClass(c, 's-q')) {
      const text = c.querySelector('.q-text');
      if (text && !d.question) d.question = textOf(text);
      continue;
    }
    if (tagName(c) === 'svg' && hasClass(c, 'hero-art')) {
      // Inline illustration → an SVG asset shown as `art` (the theme places it like `.hero-art`).
      const art = ctx.inlineSvg?.(c, section.getAttribute('data-title')?.trim() ?? '');
      if (art) {
        d.art = art;
        ctx.report.addHeuristic('inline hero illustration → SVG asset (`art`)', 'svg.hero-art', ctx.slideId);
      } else d.blocks.push(...fallback(c, ctx));
      continue;
    }
    if (hasClass(c, 's-head')) {
      for (const h of childElements(c)) {
        if (hasClass(h, 's-eyebrow')) {
          d.tag ??= eyebrowOf(h);
          const hq = h.querySelector('.hq');
          if (hq && !d.question) d.question = inline(ctx, hq, (x) => tagName(x) === 'b');
        } else if (hasClass(h, 's-title') || /^h[12]$/.test(tagName(h))) d.heading = inline(ctx, h);
        else d.blocks.push(...mapElement(h, ctx));
      }
      continue;
    }
    if (hasClass(c, 's-body')) {
      d.blocks.push(...mapChildren(c, ctx));
      continue;
    }
    if (hasClass(c, 'simfull')) {
      const eyebrow = c.getAttribute('data-eyebrow')?.trim();
      if (eyebrow) d.tag ??= eyebrow;
      d.blocks.push(...mapElement(c, ctx));
      continue;
    }
    if (hasClass(c, 'cover-wrap')) {
      for (const h of childElements(c)) {
        if (hasClass(h, 'cover-logos'))
          ctx.report.addDropped('cover logos (theme decoration)', ctx.slideId);
        else if (hasClass(h, 'cover-badge')) d.tag ??= inline(ctx, h);
        else if (hasClass(h, 'cover-title') || tagName(h) === 'h1') d.heading = inline(ctx, h);
        else if (hasClass(h, 'cover-sub')) d.subtitle = inline(ctx, h);
        else if (hasClass(h, 'cover-meta')) d.meta = metaLines(h, ctx);
        else if (hasClass(h, 'cover-q')) {
          if (!d.question) d.question = inline(ctx, h, (x) => tagName(x) === 'span');
        } else if (hasClass(h, 'cover-art') || tagName(h) === 'img') {
          const art = artAsset(h, ctx);
          if (art) d.art = art;
          else d.blocks.push(...mapElement(h, ctx));
        } else d.blocks.push(...mapElement(h, ctx));
      }
      continue;
    }
    if (hasClass(c, 'div-wrap')) {
      const walk = (parent: Element): void => {
        for (const h of childElements(parent)) {
          if (hasClass(h, 'div-num')) {
            const no = textOf(h);
            if (no) d.no = no;
          } else if (hasClass(h, 'div-eyebrow')) d.kicker ??= inline(ctx, h);
          else if (hasClass(h, 'div-title') || /^h[12]$/.test(tagName(h)))
            d.heading = inline(ctx, h);
          else if (hasClass(h, 'grow') || (tagName(h) === 'div' && classes(h).length === 0))
            walk(h);
          else if (hasClass(h, 'div-desc') && !d.subtitle) d.subtitle = inline(ctx, h);
          else if (hasClass(h, 'quote-src')) (d.meta ??= []).push(inline(ctx, h));
          else d.blocks.push(...mapElement(h, ctx));
        }
      };
      walk(c);
      continue;
    }
    d.blocks.push(...mapElement(c, ctx));
  }
  if (d.no && d.type !== 'divider') {
    ctx.report.addDropped(
      `hero numeral \`${d.no}\` (\`.div-num\`; only dividers have \`no\`)`,
      ctx.slideId,
    );
    delete d.no;
  }
  return d;
}

/**
 * Draft → IR slide. `title` is the visible heading; `data-title` becomes `toc` when it says
 * something else (the heading is never repeated as a subtitle).
 */
export function finishSlide(d: SlideDraft, id: string, ctx: MapContext): ImportedSlide {
  const legacy = d.title;
  const heading = d.heading;
  const slide: ImportedSlide = { id, type: d.type, title: heading || legacy || '', blocks: d.blocks };
  if (d.toc) slide.toc = d.toc;
  else if (heading && legacy && plainText(heading) !== legacy) {
    slide.toc = legacy;
    ctx.report.titleMismatches.push({ slide: id, title: legacy, heading });
  }
  if (d.subtitle && plainText(d.subtitle) !== plainText(slide.title)) slide.subtitle = d.subtitle;
  if (d.tag) slide.tag = d.tag;
  if (d.group) slide.group = d.group;
  if (d.question) slide.question = d.question;
  if (d.alert) slide.alert = true;
  if (d.kicker) slide.kicker = d.kicker;
  if (d.tagline) slide.tagline = d.tagline;
  if (d.meta?.length) slide.meta = d.meta;
  if (d.art) slide.art = d.art;
  const refs = [...new Set(d.refs)];
  if (refs.length) slide.refs = refs;
  if (d.no) slide.no = d.no;
  if (d.cite) slide.cite = d.cite;
  if (d.only?.length) slide.only = d.only;
  return slide;
}
