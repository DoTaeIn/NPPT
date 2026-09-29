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
  return [course ?? '', week !== undefined ? `${week}주차` : '']
    .filter((s) => s !== '')
    .join(' · ');
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

/** Default cover kicker: `${course} · ${week}주차` (either part may be missing). */
export function coverKickerText(lecture: Pick<Lecture, 'meta'>): string {
  const { course, week } = lecture.meta;
  return [course?.trim() ?? '', week !== undefined ? `${week}주차` : '']
    .filter((s) => s !== '')
    .join(' · ');
}

/** Default cover meta lines: `[date, presenter]` without the missing ones. */
export function coverMetaLines(lecture: Pick<Lecture, 'meta'>): string[] {
  return [lecture.meta.date, lecture.meta.presenter]
    .map((s) => s?.trim() ?? '')
    .filter((s) => s !== '');
}

export function renderSlide(
  slide: Slide,
  lecture: Lecture,
  opts: LectureRenderOptions & { dividerNo?: number } = {},
): string {
  const ro: RenderOptions = { ...opts, lecture, slideId: slide.id };
  const terms = ro.terms ?? lecture.terms;
  const t = (text: string): string => renderInline(text, terms);
  const alert = slide.alert && (slide.type === 'hero' || slide.type === 'divider');
  const cls = `${SLIDE_CLASS[slide.type]}${alert ? ' alert' : ''}${slide.dark ? ' dark' : ''}`;
  const toc = slide.toc !== undefined && slide.toc.trim() !== '' ? slide.toc : slide.title;
  const open = `<section${attrs([
    ['class', cls],
    ['id', slide.id],
    ['data-type', slide.type],
    ['data-title', plainText(toc)],
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
  const question = (): string =>
    slide.question
      ? `<div class="s-q"><span class="q-tag">질문</span><span class="q-text">${t(slide.question)}</span></div>`
      : '';
  const head = (titleTag: 'h1' | 'h2', titleClass: string, eyebrow = slide.tag): string =>
    `<header class="s-head">${eyebrow ? `<div class="eyebrow">${t(eyebrow)}</div>` : ''}<${titleTag} class="${titleClass}">${t(
      slide.title,
    )}</${titleTag}>${slide.subtitle ? `<p class="s-sub">${t(slide.subtitle)}</p>` : ''}${question()}</header>`;

  // Title-slide fields (components.md §1): cover, hero and divider. Author text is inline
  // Markdown; the cover defaults come from front matter and are escaped as plain text.
  const div = (cls: string, html: string): string =>
    html ? `<div class="${cls}">${html}</div>` : '';
  const inline = (text: string | undefined): string => (text?.trim() ? t(text) : '');
  const metaLines = (lines: string[]): string => {
    const spans = lines.filter((line) => line !== '').map((line) => `<span>${line}</span>`);
    return spans.length ? `<div class="cover-meta">${spans.join('')}</div>` : '';
  };
  const slideMeta = (): string[] => (slide.meta ?? []).map(inline);
  const titleBody = (): string => (slide.blocks.length ? body() : '');
  const art = (): string => {
    if (!slide.art) return '';
    const data = ro.assets?.[slide.art];
    const asset = lecture.assets?.[slide.art];
    const alt = asset?.alt ?? (asset?.title ? plainText(asset.title) : '');
    return `<figure${attrs([
      ['class', 'cover-art'],
      ['data-asset', slide.art],
    ])}><img${attrs([
      ['src', data?.src],
      ['alt', alt],
      ['width', data?.width],
      ['height', data?.height],
    ])}></figure>`;
  };
  const wrapper = `<div class="slide-wrapper${slide.art ? ' has-art' : ''}">`;

  switch (slide.type) {
    case 'content':
      return `${open}\n<div class="slide-wrapper">\n${head('h2', 'section-title')}\n${body()}\n</div>${footer()}\n</section>`;

    case 'hero': {
      const heroHead = `<header class="s-head">${div('hero-kicker', inline(slide.kicker))}${
        slide.tag ? `<div class="eyebrow">${t(slide.tag)}</div>` : ''
      }<h1 class="hero-title">${t(slide.title)}</h1>${div('cover-tagline', inline(slide.tagline))}${
        slide.subtitle ? `<p class="s-sub">${t(slide.subtitle)}</p>` : ''
      }${metaLines(slideMeta())}${question()}</header>`;
      const main = `${heroHead}\n${body()}`;
      return `${open}\n${wrapper}\n${
        slide.art ? `<div class="cover-main">\n${main}\n</div>${art()}` : main
      }\n</div>${footer()}\n</section>`;
    }

    case 'cover': {
      const kicker =
        slide.kicker !== undefined ? inline(slide.kicker) : escapeHtml(coverKickerText(lecture));
      const meta = slide.meta !== undefined ? slideMeta() : coverMetaLines(lecture).map(escapeHtml);
      return `${open}\n${wrapper}<div class="cover-main">${div('cover-kicker', kicker)}<h1 class="cover-title">${t(
        slide.title,
      )}</h1>${div('cover-tagline', inline(slide.tagline))}${
        slide.subtitle ? `<p class="cover-sub">${t(slide.subtitle)}</p>` : ''
      }${question()}${titleBody()}${metaLines(meta)}</div>${art()}<div class="cover-brand"></div></div>\n</section>`;
    }

    case 'divider': {
      const no = slide.no ?? String(opts.dividerNo ?? 1).padStart(2, '0');
      return `${open}\n${wrapper}<div class="cover-main"><div class="divider-no">${escapeHtml(no)}</div>${div(
        'cover-kicker',
        inline(slide.kicker),
      )}<h2 class="divider-title">${t(slide.title)}</h2>${div('cover-tagline', inline(slide.tagline))}${
        slide.subtitle ? `<p class="divider-lead">${t(slide.subtitle)}</p>` : ''
      }${question()}${titleBody()}${metaLines(slideMeta())}</div>${art()}</div>${
        slide.refs?.length ? footer() : ''
      }\n</section>`;
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
