/**
 * Asset registry: images from the V20 `#lecture-data` JSON, `img[data-asset]` references and
 * `img[src="data:…"]` embedded directly in slides (v9.7).
 */
import type { Asset } from '@marco/schema';
import { decodeBase64, extensionFor, parseDataUri, sha256, type Payload, type PayloadTable } from './payloads.js';
import type { ImportedAsset } from './types.js';

interface AssetDraft {
  id: string;
  mime: string;
  bytes: Uint8Array;
  stripped: boolean;
  title?: string;
  credit?: string;
  source?: string;
  alt?: string;
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 4)
    .join('-');
}

export class AssetRegistry {
  private readonly drafts = new Map<string, AssetDraft>();
  private readonly byHash = new Map<string, string>();
  readonly referenced = new Set<string>();

  constructor(
    private readonly payloads: PayloadTable,
    private readonly assetDir: string,
  ) {}

  has(id: string): boolean {
    return this.drafts.has(id);
  }

  private payloadOf(uri: string): Payload | undefined {
    return this.payloads.lookup(uri) ?? parseDataUri(uri);
  }

  /** Register an asset whose payload is a (tokenised) data URI. Returns the id. */
  addDataUri(id: string, uri: string, meta: { title?: string; credit?: string; source?: string; alt?: string } = {}): string | undefined {
    const payload = this.payloadOf(uri);
    if (!payload) return undefined;
    const bytes = payload.stripped ? new Uint8Array() : decodeBase64(payload.base64);
    const draft: AssetDraft = { id, mime: payload.mime, bytes, stripped: payload.stripped };
    if (meta.title) draft.title = meta.title;
    if (meta.credit) draft.credit = meta.credit;
    if (meta.source) draft.source = meta.source;
    if (meta.alt) draft.alt = meta.alt;
    this.drafts.set(id, draft);
    if (!payload.stripped) this.byHash.set(sha256(bytes), id);
    return id;
  }

  /** Asset id for an `<img>`: `data-asset`, or a data URI registered on the fly. */
  fromImg(img: Element): string | undefined {
    const alt = img.getAttribute('alt')?.trim() || undefined;
    const named = img.getAttribute('data-asset') ?? img.closest('[data-zoom]')?.getAttribute('data-zoom') ?? undefined;
    if (named) {
      const draft = this.drafts.get(named);
      if (draft && alt && !draft.alt) draft.alt = alt;
      return named;
    }
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('data:')) return undefined;
    const payload = this.payloadOf(src);
    if (!payload) return undefined;
    if (!payload.stripped) {
      const existing = this.byHash.get(sha256(decodeBase64(payload.base64)));
      if (existing) return existing;
    }
    const base = slugify(alt ?? '') || `img-${this.drafts.size + 1}`;
    let id = base;
    for (let n = 2; this.drafts.has(id); n++) id = `${base}-${n}`;
    const meta: { title?: string; alt?: string } = {};
    if (alt) {
      meta.title = alt;
      meta.alt = alt;
    }
    return this.addDataUri(id, src, meta);
  }

  markReferenced(id: string): void {
    this.referenced.add(id);
  }

  path(id: string): string {
    const draft = this.drafts.get(id);
    const ext = draft ? extensionFor(draft.mime) : 'png';
    return `${this.assetDir}/${id}.${ext}`;
  }

  /** `Lecture.assets` map in registration order. */
  toLectureAssets(): Record<string, Asset> {
    const out: Record<string, Asset> = {};
    for (const d of this.drafts.values()) {
      const a: Asset = { path: this.path(d.id) };
      if (d.title) a.title = d.title;
      if (d.credit) a.credit = d.credit;
      if (d.source) a.source = d.source;
      if (d.alt) a.alt = d.alt;
      out[d.id] = a;
    }
    return out;
  }

  toImported(): ImportedAsset[] {
    return [...this.drafts.values()].map((d) => {
      const a: ImportedAsset = {
        id: d.id,
        fileName: `${d.id}.${extensionFor(d.mime)}`,
        bytes: d.bytes,
        mime: d.mime,
      };
      if (d.title) a.title = d.title;
      if (d.credit) a.credit = d.credit;
      if (d.source) a.source = d.source;
      if (d.stripped) a.stripped = true;
      return a;
    });
  }
}
