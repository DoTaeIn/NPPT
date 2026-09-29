/** HTML escaping for text content and attribute values. */
const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => TEXT_ESCAPES[c] ?? c);
}

/** Attribute value for a double-quoted attribute. */
export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/** `name="value"` pairs, skipping undefined values; order is preserved. */
export function attrs(pairs: [string, string | number | undefined][]): string {
  return pairs
    .filter((p): p is [string, string | number] => p[1] !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
}

/** Only http(s), mailto and in-page anchors are emitted as links. */
export function safeUrl(url: string): string | undefined {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u) || u.startsWith('#')) return u;
  return undefined;
}
