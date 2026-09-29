// Small DOM helpers shared by all modules.

type Attrs = Record<string, string | number | boolean | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? '' : String(v));
  }
  if (html) e.innerHTML = html;
  return e;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const ENT: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (v: unknown): string =>
  String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (c) => ENT[c] || c);

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Title used by TOC, search, notes and handout. */
export function slideTitle(s: Element, i: number): string {
  const d = (s as HTMLElement).dataset?.title?.trim();
  if (d) return d;
  const hd = s.querySelector('h1,h2')?.textContent?.replace(/\s+/g, ' ').trim();
  return hd || `슬라이드 ${i + 1}`;
}

/** Allows http(s), mailto and relative URLs; anything else (e.g. `javascript:`) becomes empty. */
export function safeUrl(u: unknown): string {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s) return '';
  if (/^(https?:|mailto:)/i.test(s)) return s;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? '' : s;
}

/** Escapes plain note text and applies `**bold**`, `` `code` `` and line breaks. */
export function inlineFmt(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/** True when a key event should be left to a text field. */
export function isTyping(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null;
  if (!e || !e.tagName) return false;
  return e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName);
}

export function linkHtml(url: unknown, label: string): string {
  const u = safeUrl(url);
  return u
    ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : `<span>${label}</span>`;
}
