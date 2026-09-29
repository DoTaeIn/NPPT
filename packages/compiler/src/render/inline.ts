/**
 * Text pipeline for every text field (components.md "Rendering rules"):
 * escape → inline Markdown (`**b**`, `*em*`, `` `code` ``, links) → wrap `terms` abbreviations
 * in `<abbr class="term" title="…">` (whole word, never inside tags, `<code>` or another abbr).
 */
import markdownIt, { type Token } from 'markdown-it';
import { escapeAttr, escapeHtml } from './html.js';

const md = markdownIt('commonmark', { html: false, linkify: false, typographer: false });
md.disable(['image']);
md.renderer.rules.strong_open = () => '<b>';
md.renderer.rules.strong_close = () => '</b>';
md.renderer.rules.softbreak = () => ' ';
md.renderer.rules.hardbreak = () => '<br>';
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const tok = tokens[idx];
  if (tok) {
    const href = String(tok.attrGet('href') ?? '');
    if (/^(https?:|mailto:)/i.test(href) || href.startsWith('//')) {
      tok.attrSet('target', '_blank');
      tok.attrSet('rel', 'noopener noreferrer');
    }
  }
  return self.renderToken(tokens, idx, options);
};

export type Terms = Record<string, string>;

/** Inline Markdown → HTML, then abbreviation wrapping. */
export function renderInline(text: string, terms?: Terms): string {
  const html = md.renderInline(text);
  return terms ? wrapTerms(html, terms) : html;
}

/** Visible text of an inline Markdown string (for `data-title`, `<title>` and alt text). */
export function plainText(text: string): string {
  const tokens = md.parseInline(text, {});
  const out: string[] = [];
  const visit = (list: Token[] | null): void => {
    for (const t of list ?? []) {
      if (t.type === 'text' || t.type === 'code_inline') out.push(t.content);
      else if (t.type === 'softbreak' || t.type === 'hardbreak') out.push(' ');
      if (t.children) visit(t.children);
    }
  };
  for (const t of tokens) visit(t.children);
  return out.join('').replace(/\s+/g, ' ').trim();
}

interface TermMatcher {
  re: RegExp;
  byHtml: Map<string, string>;
}
const matchers = new WeakMap<Terms, TermMatcher | null>();

function matcherFor(terms: Terms): TermMatcher | null {
  const cached = matchers.get(terms);
  if (cached !== undefined) return cached;
  const keys = Object.keys(terms).filter((k) => k.trim() !== '');
  if (!keys.length) {
    matchers.set(terms, null);
    return null;
  }
  const byHtml = new Map<string, string>();
  for (const k of keys) byHtml.set(escapeHtml(k), terms[k] ?? '');
  // Longest first so "MFA-2" wins over "MFA"; entities are matched first and kept intact.
  const alternatives = [...byHtml.keys()]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(&[#A-Za-z0-9]+;)|(?<![A-Za-z0-9_])(${alternatives.join('|')})(?![A-Za-z0-9_])`, 'g');
  const m = { re, byHtml };
  matchers.set(terms, m);
  return m;
}

/** Wrap known abbreviations in text nodes of `html` (not in tags, `<code>`, or existing `<abbr>`). */
export function wrapTerms(html: string, terms: Terms): string {
  const m = matcherFor(terms);
  if (!m) return html;
  let code = 0;
  let abbr = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        const tag = /^<\s*(\/?)\s*([A-Za-z0-9]+)/.exec(part);
        const name = tag?.[2]?.toLowerCase();
        const delta = tag?.[1] ? -1 : 1;
        if (name === 'code') code = Math.max(0, code + delta);
        else if (name === 'abbr') abbr = Math.max(0, abbr + delta);
        return part;
      }
      if (code || abbr || part === '') return part;
      return part.replace(m.re, (whole, entity: string | undefined, term: string | undefined) => {
        if (entity !== undefined || term === undefined) return whole;
        return `<abbr class="term" title="${escapeAttr(m.byHtml.get(term) ?? '')}">${term}</abbr>`;
      });
    })
    .join('');
}
