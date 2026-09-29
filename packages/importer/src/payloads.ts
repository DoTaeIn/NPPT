/**
 * Base64 payload handling. The input HTML is tokenised before DOM parsing: every
 * `data:<mime>;base64,<payload>` is replaced by `data:<mime>;base64,@@B64_<n>@@` and the payloads
 * are kept in a table. This keeps the DOM small (the V20 deck is 10 MB, mostly images), lets the
 * same code handle the originals and the `*.stripped.html` copies, and makes "remove base64
 * from html blocks" a string replacement.
 */
import { createHash } from 'node:crypto';

const DATA_URI =
  /data:([a-z0-9.+/-]+(?:;[a-z0-9=.+-]+)*?);base64,([A-Za-z0-9+/=]+(?:[\r\n]+[A-Za-z0-9+/=]+)*|<STRIPPED>|&lt;STRIPPED&gt;)/gi;
const TOKEN = /data:([a-z0-9.+/-]+);base64,@@B64_(\d+)@@/gi;

export interface Payload {
  mime: string;
  /** Base64 text without whitespace; empty when the input was stripped. */
  base64: string;
  stripped: boolean;
}

export class PayloadTable {
  readonly items: Payload[] = [];

  /** Replace all base64 data URIs in `html` with tokens. */
  tokenize(html: string): string {
    return html.replace(DATA_URI, (_m, mimeParams: string, payload: string) => {
      const mime = (mimeParams.split(';')[0] ?? '').toLowerCase();
      const stripped = payload === '<STRIPPED>' || payload === '&lt;STRIPPED&gt;';
      this.items.push({ mime, base64: stripped ? '' : payload.replace(/\s+/g, ''), stripped });
      return `data:${mime};base64,@@B64_${this.items.length - 1}@@`;
    });
  }

  /** The payload a tokenised data URI refers to. */
  lookup(uri: string): Payload | undefined {
    TOKEN.lastIndex = 0;
    const m = TOKEN.exec(uri);
    if (!m) return undefined;
    return this.items[Number(m[2])];
  }
}

/** Replace every payload token in `text` with `<STRIPPED>` (for html blocks). */
export function stripTokens(text: string): string {
  return text.replace(TOKEN, (_m, mime: string) => `data:${mime};base64,<STRIPPED>`);
}

export function hasToken(text: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(text);
}

export function decodeBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'video/mp4': 'mp4',
  'font/woff2': 'woff2',
};

export function extensionFor(mime: string): string {
  return EXT[mime] ?? ((mime.split('/')[1] ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin');
}

/** Parse a data URI that is not tokenised (e.g. in fixtures that bypass tokenize()). */
export function parseDataUri(uri: string): Payload | undefined {
  const m = /^data:([a-z0-9.+/-]+)(?:;[^,]*)?;base64,(.*)$/is.exec(uri.trim());
  if (!m) return undefined;
  const mime = (m[1] ?? '').toLowerCase();
  const body = m[2] ?? '';
  const stripped = body === '<STRIPPED>';
  return { mime, base64: stripped ? '' : body.replace(/\s+/g, ''), stripped };
}
