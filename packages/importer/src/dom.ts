/**
 * Small DOM helpers that work on linkedom nodes (no global `Node` constructor in Node.js).
 */

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;

export function isElement(node: Node | null | undefined): node is Element {
  return !!node && node.nodeType === ELEMENT_NODE;
}

export function isText(node: Node | null | undefined): node is Text {
  return !!node && node.nodeType === TEXT_NODE;
}

export function tagName(el: Element): string {
  return el.tagName.toLowerCase();
}

export function classes(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

export function hasClass(el: Element, ...names: string[]): boolean {
  const list = classes(el);
  return names.some((n) => list.includes(n));
}

export function childElements(el: Element): Element[] {
  const out: Element[] = [];
  for (const node of Array.from(el.childNodes)) if (isElement(node)) out.push(node);
  return out;
}

/** `tag.class1.class2`, the key used in the import report. */
export function selectorOf(el: Element): string {
  const cls = classes(el);
  return cls.length ? `${tagName(el)}.${cls.join('.')}` : tagName(el);
}

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p',
  'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'label',
]);

export function isBlockTag(name: string): boolean {
  return BLOCK_TAGS.has(name);
}

const SKIP_TEXT_TAGS = new Set(['script', 'style', 'template', 'svg', 'noscript']);

/**
 * Visible text of a node: `<br>` and block boundaries become spaces, whitespace is collapsed.
 * Icons (`<i data-lucide>`) contribute nothing.
 */
export function textOf(node: Node): string {
  let out = '';
  const walk = (n: Node): void => {
    if (isText(n)) {
      out += n.data;
      return;
    }
    if (!isElement(n)) return;
    const name = tagName(n);
    if (SKIP_TEXT_TAGS.has(name)) return;
    if (name === 'br') {
      out += ' ';
      return;
    }
    const block = isBlockTag(name);
    if (block) out += ' ';
    for (const c of Array.from(n.childNodes)) walk(c);
    if (block) out += ' ';
  };
  walk(node);
  return out.replace(/\s+/g, ' ').trim();
}

/** True when the element (or a descendant) has visible text. */
export function hasText(el: Element): boolean {
  return textOf(el).length > 0;
}

/** Remove the element from its parent (linkedom supports `remove()`). */
export function detach(el: Element): void {
  el.remove();
}
