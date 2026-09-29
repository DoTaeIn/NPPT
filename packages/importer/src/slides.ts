/**
 * Slide scaffolds for the two legacy families: which elements carry the title, eyebrow,
 * question, footer and refs, and where the body starts. Body content goes through blocks.ts.
 */
import type { Block, Slide, SlideType } from '@marco/schema';
import { mapChildren, mapElement, type MapContext } from './blocks.js';
import { childElements, classes, hasClass, tagName, textOf } from './dom.js';
import { inlineOf } from './inline.js';

export interface SlideDraft {
  type: SlideType;
  alert?: boolean;
  title: string;
  /** Visible on-slide heading, when different from the title. */
  heading?: string;
  subtitle?: string;
  tag?: string;
  group?: string;
  question?: string;
  no?: string;
  cite?: string;
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

  const dropCourseLine = (el: Element): void => {
    const text = textOf(el);
    if (d.footer && text === d.footer)
      ctx.report.addDropped('course · week line (same as the footer)', ctx.slideId);
    else d.blocks.push({ type: 'paragraph', text: inline(ctx, el) });
  };

  if (type === 'cover' || type === 'divider') {
    // Cover and divider scaffolds do not show an eyebrow; V20 used data-tag only in the TOC.
    // A divider's tag becomes the TOC `group` of the slides that follow it (see import.ts).
    if (d.tag) {
      if (type === 'cover') ctx.report.addDropped(`cover TOC tag (\`${d.tag}\`)`, ctx.slideId);
      d.groupLabel = d.tag;
      delete d.tag;
    }
  }

  if (type === 'cover') {
    for (const child of childElements(section)) {
      if (hasClass(child, 'slide-tag-bottom')) continue;
      if (hasClass(child, 'v-cover-art')) {
        d.blocks.push(...mapChildren(child, ctx));
        continue;
      }
      if (hasClass(child, 'v-cover-content')) {
        for (const c of childElements(child)) {
          if (hasClass(c, 'cover-eyebrow')) dropCourseLine(c);
          else if (hasClass(c, 'cover-tagline')) d.subtitle = inline(ctx, c);
          else if (tagName(c) === 'h1')
            d.blocks.push({ type: 'paragraph', text: inline(ctx, c), lead: true });
          else if (hasClass(c, 'cover-meta'))
            d.blocks.push({ type: 'paragraph', text: inline(ctx, c) });
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
        else if (hasClass(c, 'div-eyebrow')) dropCourseLine(c);
        else if (/^h[12]$/.test(tagName(c))) d.subtitle = inline(ctx, c);
        else if (hasClass(c, 'div-desc'))
          d.blocks.push({ type: 'paragraph', text: inline(ctx, c) });
        else if (tagName(c) === 'div' && classes(c).length === 0) walk(c);
        else d.blocks.push(...mapElement(c, ctx));
      }
    };
    walk(content);
    return d;
  }

  if (type === 'quote') {
    // IR quote slide: `title` is the quote itself (rendered big), `tag` the eyebrow above it.
    // V20's data-title / data-tag are TOC-only labels here and have no IR field.
    const tocLabel = [d.tag, d.title].filter(Boolean).join(' · ');
    delete d.tag;
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
      if (tocLabel)
        ctx.report.addDropped(
          `TOC label of a quote slide (\`${tocLabel}\`; the quote is the title)`,
          ctx.slideId,
        );
      d.title = quote;
    }
    return d;
  }

  const wrapper = section.querySelector(':scope > .slide-wrapper') ?? section;
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
      d.blocks.push(...mapChildren(c, ctx));
      continue;
    }
    d.blocks.push(...mapElement(c, ctx));
  }
  return d;
}

// ---------------------------------------------------------------------------------------------
// v9.7 (week 5)
// ---------------------------------------------------------------------------------------------

export function v97Slide(section: Element, ctx: MapContext): SlideDraft {
  const cls = classes(section);
  const d: SlideDraft = {
    type: cls.includes('hero') ? 'hero' : 'content',
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
        else if (hasClass(h, 'cover-badge')) d.tag ??= textOf(h);
        else if (hasClass(h, 'cover-title') || tagName(h) === 'h1') d.heading = inline(ctx, h);
        else if (hasClass(h, 'cover-sub')) d.subtitle = inline(ctx, h);
        else if (hasClass(h, 'cover-meta')) {
          const parts = childElements(h)
            .map((s) => inline(ctx, s))
            .filter(Boolean);
          d.blocks.push({ type: 'paragraph', text: parts.join(' · ') || inline(ctx, h) });
        } else if (hasClass(h, 'cover-q')) {
          if (!d.question) d.question = inline(ctx, h, (x) => tagName(x) === 'span');
        } else d.blocks.push(...mapElement(h, ctx));
      }
      continue;
    }
    if (hasClass(c, 'div-wrap')) {
      const walk = (parent: Element): void => {
        for (const h of childElements(parent)) {
          if (hasClass(h, 'div-num')) {
            const no = textOf(h);
            if (/^\d+$/.test(no)) d.no = no;
            else ctx.report.addDropped(`hero marker \`${no}\` (\`.div-num\`)`, ctx.slideId);
          } else if (hasClass(h, 'div-eyebrow')) d.tag ??= textOf(h);
          else if (hasClass(h, 'div-title') || /^h[12]$/.test(tagName(h)))
            d.heading = inline(ctx, h);
          else if (hasClass(h, 'grow') || (tagName(h) === 'div' && classes(h).length === 0))
            walk(h);
          else if (hasClass(h, 'div-desc', 'quote-src'))
            d.blocks.push({ type: 'paragraph', text: inline(ctx, h) });
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

/** Inline Markdown → plain text (for comparing a heading with `data-title`). */
export function plainText(md: string): string {
  const kept: string[] = [];
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([\\`*_<[~])/g, (_m, c: string) => `\uE010${kept.push(c) - 1}\uE011`)
    .replace(/\*\*|\*|`/g, '')
    .replace(/\uE010(\d+)\uE011/g, (_m, i: string) => kept[Number(i)] ?? '')
    .trim();
}

/** Draft → IR slide; the heading becomes the subtitle when it differs from `data-title`. */
export function finishSlide(d: SlideDraft, id: string, ctx: MapContext): Slide {
  const slide: Slide = { id, type: d.type, title: d.title || d.heading || '', blocks: d.blocks };
  if (d.heading && d.title && d.heading !== d.title) {
    if (plainText(d.heading) !== d.title) {
      ctx.report.titleMismatches.push({ slide: id, title: d.title, heading: d.heading });
      if (!d.subtitle) d.subtitle = d.heading;
      else d.blocks.unshift({ type: 'paragraph', text: d.heading, lead: true });
    }
  }
  if (d.subtitle) slide.subtitle = d.subtitle;
  if (d.tag) slide.tag = d.tag;
  if (d.group) slide.group = d.group;
  if (d.question) slide.question = d.question;
  if (d.alert) slide.alert = true;
  const refs = [...new Set(d.refs)];
  if (refs.length) slide.refs = refs;
  if (d.no) slide.no = d.no;
  if (d.cite) slide.cite = d.cite;
  return slide;
}
