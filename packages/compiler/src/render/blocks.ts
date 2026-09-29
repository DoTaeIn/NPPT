/**
 * Block renderers: IR block → the exact HTML skeleton of docs/spec/components.md §2.
 * Every block root carries `id="<slide id>-b<n>"` and `data-block="<type>"`; items carry
 * `id="<block id>-i<n>"`. Output is compact (no whitespace between elements) and deterministic.
 */
import type { Diagnostic } from '../diagnostics.js';
import type { Block, Lecture, Tone } from '../ir.js';
import { attrs, escapeHtml } from './html.js';
import { iconHtml } from './icons.js';
import { renderInline, plainText, type Terms } from './inline.js';

/** Processed image bytes for one asset (assets.ts). */
export interface AssetData {
  /** Data URI; absent when the file could not be read. */
  src?: string;
  width?: number;
  height?: number;
  mime?: string;
  bytes?: number;
}

export interface RenderOptions {
  /** Abbreviation → expansion for `<abbr class="term">` wrapping. Defaults to `lecture.terms`. */
  terms?: Terms;
  /** Processed images by asset id. */
  assets?: Record<string, AssetData>;
  /** Asset metadata, videos and terms (alt text, video titles, abbreviations). */
  lecture?: Partial<Pick<Lecture, 'assets' | 'videos' | 'terms'>>;
  /** Receives `icon.unknown` and similar render-time warnings. */
  warn?: (d: Diagnostic) => void;
  /** Slide id attached to warnings. */
  slideId?: string;
}

export const DEFAULT_VERDICT_LABELS = {
  allow: '허용',
  drop: '차단',
  ok: '정상',
  hot: '주의',
  info: '참고',
} as const;

const toneClass = (tone?: Tone): string => (tone ? ` tone-${tone}` : '');

function icon(name: string | undefined, opts: RenderOptions): string {
  if (!name) return '';
  const html = iconHtml(name);
  if (html) return html;
  const d: Diagnostic = {
    level: 'warn',
    code: 'icon.unknown',
    message: `알 수 없는 Lucide 아이콘 '${name}'은(는) 표시되지 않습니다.`,
  };
  if (opts.slideId) d.slide = opts.slideId;
  opts.warn?.(d);
  return '';
}

/** Render one block. `id` is the block id (`s-04-b2`). */
export function renderBlock(block: Block, id: string, opts: RenderOptions = {}): string {
  const terms = opts.terms ?? opts.lecture?.terms;
  const t = (text: string): string => renderInline(text, terms);
  const root = (cls: string, extra: [string, string | number | undefined][] = []): string =>
    attrs([['class', cls], ['id', id], ['data-block', block.type], ...extra]);
  const item = (n: number): string => ` id="${id}-i${n + 1}"`;

  switch (block.type) {
    case 'chain':
      return `<div${root('decision-chain')}>${block.items
        .map(
          (it, n) =>
            `<article${item(n)}><span>${escapeHtml(it.no ?? String(n + 1).padStart(2, '0'))}</span><b>${t(it.label)}</b>${
              it.sub ? `<small>${t(it.sub)}</small>` : ''
            }</article>`,
        )
        .join('')}</div>`;

    case 'cards':
      return `<div${root(`v-cards cols-${block.cols}`)}>${block.items
        .map(
          (it, n) =>
            `<article class="v-card${toneClass(it.tone)}"${item(n)}>${icon(it.icon, opts)}${
              it.kicker ? `<span class="v-kicker">${t(it.kicker)}</span>` : ''
            }<h3>${t(it.title)}</h3>${it.body ? `<p>${t(it.body)}</p>` : ''}</article>`,
        )
        .join('')}</div>`;

    case 'takeaway':
      return `<div${root('takeaway')}>${block.label ? `<b>${t(block.label)}</b>` : ''}<span>${t(block.text)}</span></div>`;

    case 'table': {
      const cls = (n: number): string => {
        const a = block.align?.[n];
        return a === 'c' || a === 'r' ? ` class="${a}"` : '';
      };
      // A header whose cells are all empty (label/trend rows) renders without <thead>.
      const head = block.head.some((h) => h.trim() !== '')
        ? block.head.map((h, n) => `<th${cls(n)}>${t(h)}</th>`).join('')
        : '';
      const rows = block.rows
        .map(
          (r, n) => `<tr${item(n)}>${r.map((c, k) => `<td${cls(k)}>${t(c)}</td>`).join('')}</tr>`,
        )
        .join('');
      return `<table${root('v-table')}>${block.caption ? `<caption>${t(block.caption)}</caption>` : ''}${
        head ? `<thead><tr>${head}</tr></thead>` : ''
      }<tbody>${rows}</tbody></table>`;
    }

    case 'compare':
      return `<div${root('compare')}><div class="compare-head"><span class="compare-label"></span><h3>${t(block.left)}</h3><h3>${t(
        block.right,
      )}</h3></div>${block.rows
        .map(
          (r, n) =>
            `<div class="compare-row"${item(n)}><span class="compare-label">${t(r.label)}</span><div class="compare-cell left">${t(
              r.left,
            )}</div><div class="compare-cell right">${t(r.right)}</div></div>`,
        )
        .join('')}</div>`;

    case 'callout':
      return `<aside${root(`callout callout-${block.kind}`)}>${
        block.title ? `<b class="callout-title">${t(block.title)}</b>` : ''
      }<p>${t(block.body)}</p></aside>`;

    case 'steps':
      return `<ol${root('steps')}>${block.items
        .map(
          (it, n) =>
            `<li${item(n)}><b>${t(it.title)}</b>${it.body ? `<span>${t(it.body)}</span>` : ''}</li>`,
        )
        .join('')}</ol>`;

    case 'bullets':
      return `<ul${root('bullets')}>${block.items.map((it, n) => `<li${item(n)}>${t(it)}</li>`).join('')}</ul>`;

    case 'columns':
      return `<div${root(`columns cols-${block.cols}`)}>${block.columns
        .map((col, n) => {
          const colId = `${id}-i${n + 1}`;
          return `<div class="col" id="${colId}">${col.map((b, k) => renderBlock(b, `${colId}-b${k + 1}`, opts)).join('')}</div>`;
        })
        .join('')}</div>`;

    case 'image': {
      const data = opts.assets?.[block.asset];
      const meta = opts.lecture?.assets?.[block.asset];
      const alt = meta?.alt ?? (meta?.title ? plainText(meta.title) : '');
      const img = `<img${attrs([
        ['src', data?.src],
        ['alt', alt],
        ['width', data?.width],
        ['height', data?.height],
      ])}>`;
      const zoom = block.zoom
        ? `<button class="image-open" data-asset="${escapeHtml(block.asset)}">이미지 확대 ↗</button>`
        : '';
      const caption = block.caption ? t(block.caption) : '';
      const figcaption =
        caption || zoom
          ? `<figcaption>${caption}${caption && zoom ? ' ' : ''}${zoom}</figcaption>`
          : '';
      return `<figure${root(`figure${block.fit ? ` fit-${block.fit}` : ''}`, [
        ['data-asset', block.asset],
        ['style', block.height !== undefined ? `--h:${block.height}px` : undefined],
      ])}>${img}${figcaption}</figure>`;
    }

    case 'video': {
      const video = opts.lecture?.videos?.find((v) => v.id === block.video);
      const label = block.label ?? video?.title;
      const start = block.start ?? video?.start;
      return `<div${root('video-reference')}><button${attrs([
        ['class', 'video-open'],
        ['data-video', block.video],
        ['data-start', start],
      ])}>${icon('play', opts)} 영상${label ? ` · ${t(label)}` : ''}</button>${
        block.caption ? `<p class="media-caption">${t(block.caption)}</p>` : ''
      }</div>`;
    }

    case 'quote':
      return `<blockquote${root('quote')}><p>${t(block.text)}</p>${block.cite ? `<cite>${t(block.cite)}</cite>` : ''}</blockquote>`;

    case 'code':
      return `<figure${root('code')}>${block.title ? `<figcaption>${escapeHtml(block.title)}</figcaption>` : ''}<pre><code${
        block.lang ? ` class="language-${escapeHtml(block.lang)}"` : ''
      }>${escapeHtml(block.code)}</code></pre></figure>`;

    case 'pills':
      return `<div${root('pills')}>${block.items
        .map((it, n) => `<span class="pill${toneClass(it.tone)}"${item(n)}>${t(it.text)}</span>`)
        .join('')}</div>`;

    case 'verdict':
      return `<div${root(`verdict verdict-${block.verdict}`)}><b>${t(
        block.label ?? DEFAULT_VERDICT_LABELS[block.verdict],
      )}</b><span>${t(block.text)}</span></div>`;

    case 'timeline':
      return `<ol${root('timeline')}>${block.items
        .map(
          (it, n) =>
            `<li${item(n)}><time>${t(it.at)}</time><b>${t(it.title)}</b>${it.body ? `<span>${t(it.body)}</span>` : ''}</li>`,
        )
        .join('')}</ol>`;

    case 'tiles':
      return `<div${root(`tiles cols-${block.cols}`)}>${block.items
        .map(
          (it, n) =>
            `<div class="tile${toneClass(it.tone)}"${item(n)}>${icon(it.icon, opts)}<b class="tile-label">${t(it.label)}</b>${
              it.value ? `<span class="tile-value">${t(it.value)}</span>` : ''
            }</div>`,
        )
        .join('')}</div>`;

    case 'terms':
      // The block defines the abbreviations, so its own text is not abbr-wrapped.
      return `<dl${root('terms')}>${block.items
        .map(
          (it, n) =>
            `<div class="term"${item(n)}><dt>${renderInline(it.abbr)}</dt><dd>${
              it.en ? `<i class="term-en">${renderInline(it.en)}</i>` : ''
            }<span class="term-ko">${renderInline(it.ko)}</span></dd></div>`,
        )
        .join('')}</dl>`;

    case 'paragraph':
      return `<p${root(block.lead ? 's-p lead' : 's-p')}>${t(block.text)}</p>`;

    case 'widget': {
      const params =
        block.params && Object.keys(block.params).length
          ? ` data-params='${JSON.stringify(block.params).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;')}'`
          : '';
      return `<div${root('widget', [['data-widget', block.name]])}${params}></div>`;
    }

    case 'html':
      return block.html;
  }
}
