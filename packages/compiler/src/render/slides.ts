/**
 * Slide scaffolds (components.md §1): content, cover, divider, quote, hero, references, raw.
 * `renderLecture` returns the `<section class="slide">` elements for `#canvas`, in order.
 */
import type { Lecture, Slide } from '../ir.js';
import { renderBlock, type RenderOptions } from './blocks.js';
import { attrs, escapeHtml, safeUrl } from './html.js';
import { plainText, renderInline } from './inline.js';

export type LectureRenderOptions = Omit<RenderOptions, 'lecture' | 'slideId'>;

const SLIDE_CLASS: Record<Slide['type'], string> = {
  content: 'slide',
  cover: 'slide cover',
  divider: 'slide divider',
  quote: 'slide quote-slide',
  hero: 'slide hero',
  references: 'slide references',
  raw: 'slide raw',
};

/** `meta.footer`, else `${course} · ${week}주차` (either part may be missing). */
export function footerText(lecture: Pick<Lecture, 'meta'>): string {
  const { footer, course, week } = lecture.meta;
  if (footer !== undefined) return footer;
  return [course ?? '', week !== undefined ? `${week}주차` : ''].filter((s) => s !== '').join(' · ');
}

export function renderLecture(lecture: Lecture, opts: LectureRenderOptions = {}): string {
  let dividers = 0;
  return lecture.slides
    .map((slide) => {
      if (slide.type === 'divider') dividers++;
      return renderSlide(slide, lecture, { ...opts, dividerNo: dividers });
    })
    .join('\n');
}

export function renderSlide(
  slide: Slide,
  lecture: Lecture,
  opts: LectureRenderOptions & { dividerNo?: number } = {},
): string {
  const ro: RenderOptions = { ...opts, lecture, slideId: slide.id };
  const terms = ro.terms ?? lecture.terms;
  const t = (text: string): string => renderInline(text, terms);
  const cls = SLIDE_CLASS[slide.type] + (slide.type === 'hero' && slide.alert ? ' alert' : '');
  const open = `<section${attrs([
    ['class', cls],
    ['id', slide.id],
    ['data-type', slide.type],
    ['data-title', plainText(slide.title)],
    ['data-tag', slide.tag !== undefined ? plainText(slide.tag) : undefined],
    ['data-group', slide.group !== undefined ? plainText(slide.group) : undefined],
  ])}>`;
  const blocks = (): string =>
    slide.blocks.map((b, n) => renderBlock(b, `${slide.id}-b${n + 1}`, ro)).join('\n');
  const body = (): string =>
    `<div class="s-body${slide.layout === 'wide' ? ' layout-wide' : ''}">\n${blocks()}${slide.blocks.length ? '\n' : ''}</div>`;
  const footer = (): string => {
    const text = footerText(lecture);
    const refs = slide.refs?.length
      ? `<button class="source-link" data-source="${escapeHtml(slide.id)}">참고 출처 ${slide.refs
          .map(escapeHtml)
          .join(' · ')} ↗</button>`
      : '';
    if (!refs && !text) return '';
    return `\n<footer class="slide-tag-bottom">${refs}${refs && text ? ' · ' : ''}${escapeHtml(text)}</footer>`;
  };
  const head = (titleTag: 'h1' | 'h2', titleClass: string, eyebrow = slide.tag): string =>
    `<header class="s-head">${eyebrow ? `<div class="eyebrow">${t(eyebrow)}</div>` : ''}<${titleTag} class="${titleClass}">${t(
      slide.title,
    )}</${titleTag}>${slide.subtitle ? `<p class="s-sub">${t(slide.subtitle)}</p>` : ''}${
      slide.question
        ? `<div class="s-q"><span class="q-tag">질문</span><span class="q-text">${t(slide.question)}</span></div>`
        : ''
    }</header>`;

  switch (slide.type) {
    case 'content':
    case 'hero':
      return `${open}\n<div class="slide-wrapper">\n${
        slide.type === 'hero' ? head('h1', 'hero-title') : head('h2', 'section-title')
      }\n${body()}\n</div>${footer()}\n</section>`;

    case 'cover': {
      const meta = lecture.meta;
      const kicker = [meta.course, meta.week !== undefined ? `${meta.week}주차` : undefined]
        .filter((s): s is string => !!s)
        .join(' · ');
      const metaSpans = [meta.date, meta.presenter]
        .filter((s): s is string => !!s)
        .map((s) => `<span>${escapeHtml(s)}</span>`)
        .join('');
      return `${open}\n<div class="slide-wrapper">${kicker ? `<div class="cover-kicker">${escapeHtml(kicker)}</div>` : ''}<h1 class="cover-title">${t(
        slide.title,
      )}</h1>${slide.subtitle ? `<p class="cover-sub">${t(slide.subtitle)}</p>` : ''}${
        metaSpans ? `<div class="cover-meta">${metaSpans}</div>` : ''
      }<div class="cover-brand"></div></div>\n</section>`;
    }

    case 'divider': {
      const no = slide.no ?? String(opts.dividerNo ?? 1).padStart(2, '0');
      return `${open}\n<div class="slide-wrapper"><div class="divider-no">${escapeHtml(no)}</div><h2 class="divider-title">${t(
        slide.title,
      )}</h2>${slide.subtitle ? `<p class="divider-lead">${t(slide.subtitle)}</p>` : ''}</div>\n</section>`;
    }

    case 'quote': {
      const cite = slide.cite ?? slide.subtitle;
      return `${open}\n<div class="slide-wrapper">${slide.tag ? `<div class="eyebrow">${t(slide.tag)}</div>` : ''}<blockquote class="quote big"><p>${t(
        slide.title,
      )}</p>${cite ? `<cite>${t(cite)}</cite>` : ''}</blockquote>${slide.blocks.length ? `\n${body()}` : ''}</div>${
        slide.refs?.length ? footer() : ''
      }\n</section>`;
    }

    case 'references': {
      const wanted = slide.only?.length ? slide.only : lecture.refs.map((r) => r.id);
      const items = wanted
        .map((refId) => lecture.refs.find((r) => r.id === refId))
        .filter((r): r is NonNullable<typeof r> => r !== undefined)
        .map((ref, n) => {
          const url = ref.url ? safeUrl(ref.url) : undefined;
          const title = url
            ? `<a${attrs([
                ['class', 'r-title'],
                ['href', url],
                ['target', '_blank'],
                ['rel', 'noopener noreferrer'],
              ])}>${t(ref.title)}</a>`
            : `<span class="r-title">${t(ref.title)}</span>`;
          return `<li id="${escapeHtml(slide.id)}-r${n + 1}"><span class="r-no">${escapeHtml(ref.id)}</span>${title}${
            ref.note ? `<span class="r-snippet">${t(ref.note)}</span>` : ''
          }</li>`;
        })
        .join('\n');
      return `${open}\n<div class="slide-wrapper">\n${head('h2', 'section-title', slide.tag ?? '참고 자료')}\n<ol class="reference-list">\n${items}${
        items ? '\n' : ''
      }</ol>${slide.blocks.length ? `\n${body()}` : ''}\n</div>${footer()}\n</section>`;
    }

    case 'raw':
      return `${open}\n${slide.html ?? ''}\n</section>`;
  }
}
