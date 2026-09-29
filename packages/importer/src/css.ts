/**
 * A tiny index over the legacy deck's own `<style>` text, for layout facts the markup does not
 * carry: how many columns a grid has, how tall a thumbnail is. Selectors are matched exactly
 * (after whitespace normalisation); `@media` wrappers are ignored, the first rule wins.
 */
import { classes } from './dom.js';

export class CssIndex {
  private readonly rules: { selectors: string[]; body: string }[] = [];

  constructor(cssText: string) {
    const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = (m[1] ?? '')
        .split(',')
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      this.rules.push({ selectors, body: m[2] ?? '' });
    }
  }

  /** The first declared value of `prop` in a rule whose selector list contains `selector`. */
  value(selector: string, prop: string): string | undefined {
    const want = selector.replace(/\s+/g, ' ').trim();
    const re = new RegExp(`(?:^|;)\\s*${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+)`);
    for (const r of this.rules) {
      if (!r.selectors.includes(want)) continue;
      const m = re.exec(r.body);
      if (m?.[1]) return m[1].replace(/\s*!important\s*$/, '').trim();
    }
    return undefined;
  }

  /** A `px` length as a number (`215px` → 215). */
  px(selector: string, prop: string): number | undefined {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(this.value(selector, prop) ?? '');
    return m ? Number(m[1]) : undefined;
  }

  /** Column count of a grid element from `grid-template-columns` (compound class selector first). */
  gridColumns(el: Element): number | undefined {
    const cls = classes(el);
    const candidates = [cls.length > 1 ? `.${cls.join('.')}` : '', ...cls.map((c) => `.${c}`)];
    for (const sel of candidates) {
      if (!sel) continue;
      const v = this.value(sel, 'grid-template-columns');
      if (v) return trackCount(v);
    }
    return undefined;
  }
}

/** `repeat(4,1fr)` → 4, `1fr 1fr` → 2, `minmax(0,1fr) 2fr` → 2; auto-fill/fit → undefined. */
export function trackCount(value: string): number | undefined {
  const rep = /^repeat\(\s*(\d+)\s*,/.exec(value.trim());
  if (rep) return Number(rep[1]);
  if (/auto-(fill|fit)/.test(value)) return undefined;
  let depth = 0;
  let count = 0;
  let inToken = false;
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) inToken = false;
    else if (!inToken) {
      inToken = true;
      count++;
    }
  }
  return count || undefined;
}
