/**
 * `<img>` tags inside author HTML (`:::html` blocks and `raw` slides). They reference images the
 * same two ways image blocks do: `data-asset="<id>"` (an id from the front matter `assets`) or a
 * local `src="assets/x.png"` path, which the parser registers as an asset. At build time
 * `inlineHtmlAssets` fills in the optimised data URI and the intrinsic width/height.
 */
import type { Asset, Block, Lecture } from './ir.js';
import type { AssetData } from './render/blocks.js';
import { escapeAttr } from './render/html.js';
import { plainText } from './render/inline.js';

interface Attr {
  name: string;
  value?: string;
  /** Offsets of the whole `name="value"` text inside the tag. */
  start: number;
  end: number;
}

export interface HtmlImage {
  /** Offsets of the tag in the scanned HTML. */
  start: number;
  end: number;
  tag: string;
  /** `data-asset` value, when present and non-empty. */
  asset?: string;
  /** Decoded `src` value, when present. */
  src?: string;
  alt?: string;
  attrs: Attr[];
}

/** An `<img …>` tag; quoted attribute values may contain `>`. */
const IMG_TAG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  '#39': "'",
};

function decode(value: string): string {
  return value.replace(/&(#?\w+);/g, (whole, name: string) => {
    if (ENTITIES[name] !== undefined) return ENTITIES[name];
    const code = /^#x([0-9a-f]+)$/i.exec(name)?.[1] ?? /^#(\d+)$/.exec(name)?.[1];
    if (code === undefined) return whole;
    const n = parseInt(code, name.startsWith('#x') || name.startsWith('#X') ? 16 : 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
  });
}

/** Every `<img>` tag of `html`, in document order. */
export function scanImages(html: string): HtmlImage[] {
  const out: HtmlImage[] = [];
  for (const m of html.matchAll(IMG_TAG)) {
    const tag = m[0];
    const start = m.index;
    const attrs: Attr[] = [];
    const body = 4; // length of "<img"
    const inner = tag.slice(body, tag.length - 1);
    for (const a of inner.matchAll(ATTR)) {
      const raw = a[2] ?? a[3] ?? a[4];
      attrs.push({
        name: (a[1] ?? '').toLowerCase(),
        ...(raw !== undefined ? { value: decode(raw) } : {}),
        start: body + a.index,
        end: body + a.index + a[0].length,
      });
    }
    const get = (name: string): string | undefined => attrs.find((a) => a.name === name)?.value;
    const asset = get('data-asset')?.trim();
    const src = get('src')?.trim();
    const alt = get('alt');
    out.push({
      start,
      end: start + tag.length,
      tag,
      attrs,
      ...(asset ? { asset } : {}),
      ...(src !== undefined ? { src } : {}),
      ...(alt !== undefined ? { alt } : {}),
    });
  }
  return out;
}

/** True for a relative or absolute file path (not `data:`, `http:`, `//host`, `#frag` or empty). */
export function isLocalPath(src: string | undefined): src is string {
  if (!src) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//') && !src.startsWith('#');
}

const normPath = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '');

/** Asset id whose `path` is `path` (`./` and `\` insensitive). */
export function assetIdForPath(
  assets: Record<string, Pick<Asset, 'path'>>,
  path: string,
): string | undefined {
  const wanted = normPath(path);
  return Object.keys(assets).find((id) => normPath(assets[id]?.path ?? '') === wanted);
}

/** The asset an `<img>` refers to: `data-asset` first, then a local `src` registered by path. */
export function imageAssetId(
  img: HtmlImage,
  assets: Record<string, Pick<Asset, 'path'>>,
): string | undefined {
  if (img.asset !== undefined) return img.asset;
  return isLocalPath(img.src) ? assetIdForPath(assets, img.src) : undefined;
}

/** Asset ids referenced by the `<img>` tags of `html` that exist in `assets`, in order. */
export function htmlAssetIds(html: string, assets: Record<string, Pick<Asset, 'path'>>): string[] {
  const ids: string[] = [];
  for (const img of scanImages(html)) {
    const id = imageAssetId(img, assets);
    if (id !== undefined && Object.hasOwn(assets, id) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Fill `src` (data URI), `width`, `height` and a missing `alt` of every `<img>` that refers to a
 * processed asset. Tags that refer to nothing known are left untouched (the parser warned).
 */
export function resolveHtmlImages(
  html: string,
  data: Record<string, AssetData>,
  assets: Record<string, Asset>,
): string {
  const images = scanImages(html);
  if (!images.length) return html;
  let out = '';
  let last = 0;
  for (const img of images) {
    const id = imageAssetId(img, assets);
    const d = id !== undefined ? data[id] : undefined;
    if (id === undefined || !d?.src) continue;
    const meta = assets[id];
    const has = (name: string): boolean => img.attrs.some((a) => a.name === name);
    // Attribute text after `<img` without the old src; everything else stays as written.
    const body = img.tag.slice(0, img.tag.length - 1);
    let inner = '';
    let pos = 4;
    for (const a of img.attrs) {
      if (a.name !== 'src') continue;
      inner += body.slice(pos, a.start).replace(/\s+$/, '');
      pos = a.end;
    }
    inner += body.slice(pos);
    const selfClose = /\/\s*$/.test(inner);
    inner = inner.replace(/\s*\/?\s*$/, '');
    const add: string[] = [` src="${escapeAttr(d.src)}"`];
    if (!has('width') && !has('height') && d.width && d.height)
      add.push(` width="${d.width}" height="${d.height}"`);
    if (!has('alt')) {
      const alt = meta?.alt ?? (meta?.title ? plainText(meta.title) : undefined);
      if (alt) add.push(` alt="${escapeAttr(alt)}"`);
    }
    out += html.slice(last, img.start) + `<img${inner}${add.join('')}${selfClose ? ' />' : '>'}`;
    last = img.end;
  }
  return out + html.slice(last);
}

/**
 * A copy of `lecture` whose `html` blocks (also inside `columns`) and `raw` slides carry the
 * processed images. Slides and blocks without `<img>` tags are shared, not copied.
 */
export function inlineHtmlAssets(lecture: Lecture, data: Record<string, AssetData>): Lecture {
  const fix = (html: string): string => resolveHtmlImages(html, data, lecture.assets);
  const blocks = (list: Block[]): Block[] => {
    let changed = false;
    const next = list.map((b): Block => {
      if (b.type === 'html') {
        const html = fix(b.html);
        if (html === b.html) return b;
        changed = true;
        return { ...b, html };
      }
      if (b.type === 'columns') {
        const columns = b.columns.map(blocks);
        if (columns.every((c, i) => c === b.columns[i])) return b;
        changed = true;
        return { ...b, columns };
      }
      return b;
    });
    return changed ? next : list;
  };
  const slides = lecture.slides.map((s) => {
    const nextBlocks = blocks(s.blocks);
    const html = s.html !== undefined ? fix(s.html) : undefined;
    if (nextBlocks === s.blocks && html === s.html) return s;
    return { ...s, blocks: nextBlocks, ...(html !== undefined ? { html } : {}) };
  });
  return slides.every((s, i) => s === lecture.slides[i]) ? lecture : { ...lecture, slides };
}
