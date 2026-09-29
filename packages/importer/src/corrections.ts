/**
 * Load-time correction scripts of a legacy deck (v9.x "fact corrections"): named IIFEs such as
 * `(function applyCorrections97(){…})()` or `<script id="v90-script-remap">` that rewrite
 * `window.SIMS`, `window.QUIZ`, `window.SCRIPT`, slide text and `data-note` after the page loads.
 *
 * The importer normally never runs deck code. A per-deck config can opt in to specific scripts by
 * name; they then run, in document order, in a `node:vm` context whose globals are the parsed DOM
 * (linkedom), `NodeFilter` and the deck's JSON data. What they change is reported.
 */
import vm from 'node:vm';
import type { CorrectionsReport } from './types.js';

// ---------------------------------------------------------------------------------------------
// a small JavaScript scanner (strings, template literals, comments, regex literals)
// ---------------------------------------------------------------------------------------------

const REGEX_BEFORE =
  /[(,=:[!&|?{};+\-*%<>~^]$|(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await)$/;

/** Index just past the `}` that closes the `{` at `open`, or -1. */
export function matchBrace(src: string, open: number): number {
  let depth = 0;
  const templates: number[] = []; // brace depth at which each `${` of a template literal opened
  let i = open;
  const len = src.length;
  const skipString = (q: string): void => {
    for (i++; i < len && src[i] !== q; i++) if (src[i] === '\\') i++;
  };
  const skipTemplate = (): boolean => {
    // at the first char after "`" (or after the `}` closing a `${`); returns true on `${`
    for (; i < len; i++) {
      const ch = src[i];
      if (ch === '\\') i++;
      else if (ch === '`') return false;
      else if (ch === '$' && src[i + 1] === '{') {
        i++;
        return true;
      }
    }
    return false;
  };
  for (; i < len; i++) {
    const ch = src[i] as string;
    if (ch === '"' || ch === "'") skipString(ch);
    else if (ch === '`') {
      i++;
      if (skipTemplate()) {
        templates.push(depth);
        depth++;
      }
    } else if (ch === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++;
    } else if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? len : end + 1;
    } else if (ch === '/') {
      const before = src.slice(Math.max(0, i - 12), i).replace(/\s+$/, '');
      if (REGEX_BEFORE.test(before) || before === '') {
        let inClass = false;
        for (i++; i < len; i++) {
          const c = src[i];
          if (c === '\\') i++;
          else if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) break;
          else if (c === '\n') break;
        }
      }
    } else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (templates.length && templates[templates.length - 1] === depth) {
        templates.pop();
        i++;
        if (skipTemplate()) {
          templates.push(depth);
          depth++;
        }
        continue;
      }
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Source of `(function NAME(){…})();` in `src` (with its invocation), and its offset. */
export function iifeSource(src: string, name: string): { code: string; at: number } | undefined {
  const re = new RegExp(`\\(\\s*function\\s+${name}\\s*\\(`, 'g');
  const m = re.exec(src);
  if (!m) return undefined;
  const open = src.indexOf('{', m.index + m[0].length);
  if (open < 0) return undefined;
  const close = matchBrace(src, open);
  if (close < 0) return undefined;
  const tail = /^\s*\)\s*\(\s*\)\s*;?|^\s*\(\s*\)\s*\)\s*;?/.exec(src.slice(close));
  if (!tail) return undefined;
  return { code: src.slice(m.index, close + tail[0].length), at: m.index };
}

// ---------------------------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------------------------

export interface CorrectionData {
  SIMS?: unknown;
  QUIZ?: unknown;
  SCRIPT?: unknown;
}

export interface CorrectionResult extends CorrectionData {
  report: CorrectionsReport;
}

function tableRows(table: Element): Element[] {
  const rows: Element[] = [];
  for (const c of Array.from(table.children)) {
    const n = c.tagName.toLowerCase();
    if (n === 'tr') rows.push(c);
    else if (['thead', 'tbody', 'tfoot'].includes(n))
      rows.push(...Array.from(c.children).filter((r) => r.tagName.toLowerCase() === 'tr'));
  }
  return rows;
}

/** linkedom has no `HTMLTableElement.rows` / `HTMLTableRowElement.cells`; add them per element. */
function polyfillTables(document: Document): void {
  for (const table of Array.from(document.querySelectorAll('table'))) {
    if (!('rows' in table))
      Object.defineProperty(table, 'rows', { get: () => tableRows(table), configurable: true });
  }
  for (const tr of Array.from(document.querySelectorAll('tr'))) {
    if (!('cells' in tr))
      Object.defineProperty(tr, 'cells', {
        get: (): Element[] =>
          Array.from((tr as Element).children).filter((c) =>
            ['td', 'th'].includes(c.tagName.toLowerCase()),
          ),
        configurable: true,
      });
  }
}

interface SlideState {
  note: string;
  text: string;
  attrs: string;
}

function slideStates(document: Document): SlideState[] {
  return Array.from(document.querySelectorAll('section.slide')).map((s) => ({
    note: s.getAttribute('data-note') ?? '',
    text: s.textContent ?? '',
    attrs: ['data-title', 'data-q', 'data-heading', 'data-terms', 'data-eyebrow']
      .map(
        (a) =>
          `${a}=${s.getAttribute(a) ?? ''}|${Array.from(s.querySelectorAll(`[${a}]`))
            .map((e) => e.getAttribute(a))
            .join('|')}`,
      )
      .join('\n'),
  }));
}

/**
 * Run the named correction scripts found in the deck's `<script>` elements, in document order.
 * `data` is the deck's parsed `window.*` JSON; the corrected copies are returned.
 */
export function runCorrections(
  document: Document,
  names: string[],
  data: CorrectionData,
  opts: { timeoutMs?: number } = {},
): CorrectionResult {
  const report: CorrectionsReport = {
    requested: [...names],
    ran: [],
    missing: [],
    errors: [],
    changed: { sims: false, quiz: 0, notes: 0, slideText: 0, attributes: 0 },
    audit: [],
  };
  const found: { name: string; code: string; order: number }[] = [];
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const name of names) {
    let hit: { name: string; code: string; order: number } | undefined;
    scripts.forEach((script, k) => {
      if (hit) return;
      const src = script.textContent ?? '';
      if (script.getAttribute('id') === name) hit = { name, code: src, order: k * 1e9 };
      else {
        const iife = iifeSource(src, name);
        if (iife) hit = { name, code: iife.code, order: k * 1e9 + iife.at };
      }
    });
    if (hit) found.push(hit);
    else report.missing.push(name);
  }
  found.sort((a, b) => a.order - b.order);
  if (!found.length) return { ...data, report };

  polyfillTables(document);
  const before = slideStates(document);
  const context = vm.createContext({
    document,
    NodeFilter: { SHOW_ALL: 0xffffffff, SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
  });
  const run = (code: string): unknown =>
    vm.runInContext(code, context, { timeout: opts.timeoutMs ?? 10_000 });
  // The v9.x deck engine exposes its slides as `window.DECK.slides`; the patches use it.
  run(
    "var window = globalThis; var self = globalThis; window.DECK = { slides: Array.from(document.querySelectorAll('section.slide')), cur: 0 };",
  );
  for (const key of ['SIMS', 'QUIZ', 'SCRIPT'] as const) {
    if (data[key] === undefined) continue;
    context.__json = JSON.stringify(data[key]);
    run(`window.${key} = JSON.parse(__json); delete window.__json;`);
  }
  for (const { name, code } of found) {
    try {
      run(code);
      report.ran.push(name);
    } catch (e) {
      report.ran.push(name);
      report.errors.push(`${name}: ${(e as Error).message ?? String(e)}`);
    }
  }
  const read = (key: string): unknown => {
    const json = run(`JSON.stringify(window.${key})`) as string | undefined;
    return json === undefined ? undefined : (JSON.parse(json) as unknown);
  };
  const out: CorrectionResult = { report };
  for (const key of ['SIMS', 'QUIZ', 'SCRIPT'] as const) {
    if (data[key] === undefined) continue;
    out[key] = read(key);
  }
  report.changed.sims = JSON.stringify(out.SIMS) !== JSON.stringify(data.SIMS);
  if (data.QUIZ && typeof data.QUIZ === 'object') {
    const a = data.QUIZ as Record<string, unknown>;
    const b = (out.QUIZ ?? {}) as Record<string, unknown>;
    report.changed.quiz = Object.keys(a).filter(
      (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
    ).length;
  }
  const after = slideStates(document);
  before.forEach((b, i) => {
    const a = after[i];
    if (!a) return;
    if (a.note !== b.note) report.changed.notes++;
    if (a.text !== b.text) report.changed.slideText++;
    if (a.attrs !== b.attrs) report.changed.attributes++;
  });
  // Audit logs the v9.5 / v9.7 patches keep about themselves.
  for (const key of ['NARRATION95', 'AUDIT97']) {
    const audit = read(key) as { errors?: unknown[] } | undefined;
    if (audit && Array.isArray(audit.errors))
      report.audit.push(...audit.errors.map((e) => `${key}: ${String(e)}`));
  }
  return out;
}
