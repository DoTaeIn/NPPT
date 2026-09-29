/**
 * Slide body: Markdown (CommonMark + GFM tables) and `:::` containers → IR blocks
 * (format.md §5, components.md §2). markdown-it produces the token stream; containers are
 * registered with markdown-it-container. Item containers read their raw source lines through
 * `token.map`, so the item grammar (YAML list / pipe rows) is independent of Markdown.
 */
import markdownIt, { type MarkdownIt, type Token } from 'markdown-it';
import container from 'markdown-it-container';
import { parse as parseYaml } from 'yaml';
import type {
  Block,
  CalloutBlock,
  CardsBlock,
  ChainBlock,
  CodeBlock,
  ColumnsBlock,
  CompareBlock,
  ImageBlock,
  PillsBlock,
  StepsBlock,
  TableBlock,
  TermsBlock,
  TilesBlock,
  TimelineBlock,
  Tone,
  VerdictBlock,
  VideoBlock,
  WidgetBlock,
} from '../ir.js';
import { CALLOUT_KINDS, TONES, VERDICTS } from '../ir.js';
import {
  type ContainerAttrSpec,
  type ParsedAttrs,
  parseContainerAttrs,
  tokenizeAttrs,
} from './attrs.js';
import { type ParseContext, report } from './context.js';
import { type ParsedItem, parseItems } from './items.js';
import {
  assetIdFromPath,
  didYouMean,
  firstWord,
  isInteger,
  joinLines,
  parseSeconds,
  splitBoldTitle,
} from './text.js';

export const CONTAINERS = [
  'chain',
  'cards',
  'takeaway',
  'table',
  'compare',
  'callout',
  'steps',
  'columns',
  'col',
  'image',
  'video',
  'pills',
  'verdict',
  'timeline',
  'tiles',
  'terms',
  'widget',
  'html',
] as const;
type ContainerName = (typeof CONTAINERS)[number];
const KNOWN = new Set<string>(CONTAINERS);
const isContainerName = (s: string): s is ContainerName => KNOWN.has(s);

const SPECS: Record<ContainerName, ContainerAttrSpec> = {
  chain: { keys: [] },
  cards: { keys: ['cols'] },
  takeaway: { keys: ['label'], label: true },
  table: { keys: ['caption'] },
  compare: { keys: ['left', 'right'] },
  callout: { keys: ['kind', 'title'], flags: CALLOUT_KINDS, label: true },
  steps: { keys: [] },
  columns: { keys: ['cols'] },
  col: { keys: [] },
  image: { keys: ['asset', 'src', 'caption', 'fit', 'height', 'zoom', 'alt'], flags: ['zoom'] },
  video: { keys: ['id', 'start', 'label', 'caption'] },
  pills: { keys: [] },
  verdict: { keys: ['verdict', 'label'], flags: VERDICTS, label: true },
  timeline: { keys: [] },
  tiles: { keys: ['cols'] },
  terms: { keys: [] },
  widget: { keys: [], label: true },
  html: { keys: [] },
};

/**
 * Marker lengths the pre-pass rewrites containers to, so markdown-it-container can nest
 * `:::columns` → `:::col` → block containers although authors write `:::` everywhere.
 */
const MARKER_LEN: Partial<Record<string, number>> = { columns: 5, col: 4 };

let bodyMd: MarkdownIt | undefined;
export function getBodyMarkdown(): MarkdownIt {
  if (bodyMd) return bodyMd;
  const md = markdownIt({ html: false, linkify: false, typographer: false });
  // @types/markdown-it-container targets the CJS typings of markdown-it; the runtime shape matches.
  const plugin = container as unknown as (
    md: MarkdownIt,
    name: string,
    opts: { validate(params: string): boolean },
  ) => void;
  for (const name of CONTAINERS) {
    md.use(plugin, name, { validate: (params: string) => firstWord(params) === name });
  }
  // Catch-all so unknown containers are consumed as one unit (reported by the pre-pass).
  md.use(plugin, 'unknown', {
    validate: (params: string) => {
      const word = firstWord(params);
      return word !== '' && !KNOWN.has(word);
    },
  });
  bodyMd = md;
  return md;
}

interface BodyEnv {
  /** Original body lines (container content is read from here). */
  lines: string[];
  /** 1-based file line of `lines[0]`. */
  offset: number;
  ctx: ParseContext;
}

/** Parse one slide body. `firstLine` is the 1-based file line of `lines[0]`. */
export function parseBody(lines: string[], firstLine: number, ctx: ParseContext): Block[] {
  if (lines.every((l) => l.trim() === '')) return [];
  const source = preprocess(lines, firstLine, ctx);
  const tokens = getBodyMarkdown().parse(source.join('\n'), {});
  return walk(tokens, 0, tokens.length, { lines, offset: firstLine, ctx });
}

// ---------------------------------------------------------------------------
// Pre-pass: container structure checks and marker rewriting (line count preserved)
// ---------------------------------------------------------------------------

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const CONTAINER_LINE = /^(\s{0,3})(:{3,})(.*)$/;

function preprocess(lines: string[], firstLine: number, ctx: ParseContext): string[] {
  const out = lines.slice();
  const stack: { name: string; line: number }[] = [];
  let fence: { ch: string; len: number } | undefined;
  lines.forEach((line, i) => {
    const lineNo = firstLine + i;
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (close?.[1] && close[1][0] === fence.ch && close[1].length >= fence.len) fence = undefined;
      return;
    }
    const f = FENCE_OPEN.exec(line);
    if (f?.[1]) {
      fence = { ch: f[1][0] ?? '`', len: f[1].length };
      return;
    }
    const m = CONTAINER_LINE.exec(line);
    if (!m) return;
    const indent = m[1] ?? '';
    const rest = (m[3] ?? '').trim();
    if (rest === '') {
      const top = stack.pop();
      if (!top) {
        report(
          ctx,
          'error',
          'format.container.stray',
          '여는 :::name 없이 닫는 ::: 가 있습니다.',
          lineNo,
        );
        out[i] = '';
        return;
      }
      out[i] = indent + ':'.repeat(MARKER_LEN[top.name] ?? 3);
      return;
    }
    const name = firstWord(rest);
    const parent = stack[stack.length - 1];
    if (!KNOWN.has(name)) {
      const hint = didYouMean(name, CONTAINERS);
      report(
        ctx,
        'error',
        'format.container.unknown',
        `알 수 없는 컨테이너 ':::${name}'${hint ? ` (':::${hint}'을(를) 의도했나요?)` : ''}.`,
        lineNo,
      );
    } else if (name === 'col' && parent?.name !== 'columns') {
      report(
        ctx,
        'error',
        'format.container.nesting',
        ':::col은 :::columns 안에서만 쓸 수 있습니다.',
        lineNo,
      );
    } else if (parent) {
      if (parent.name === 'columns' && name !== 'col') {
        report(
          ctx,
          'error',
          'format.container.nesting',
          `:::columns 안에는 :::col만 올 수 있습니다 (':::${name}').`,
          lineNo,
        );
      } else if (parent.name === 'col' && (name === 'columns' || name === 'col')) {
        report(
          ctx,
          'error',
          'format.container.nesting',
          '컨테이너는 :::columns → :::col 한 단계까지만 중첩할 수 있습니다.',
          lineNo,
        );
      } else if (parent.name !== 'col' && parent.name !== 'columns') {
        report(
          ctx,
          'error',
          'format.container.nesting',
          `:::${parent.name} 안에는 다른 컨테이너를 넣을 수 없습니다 (':::${name}').`,
          lineNo,
        );
      }
    }
    stack.push({ name, line: lineNo });
    out[i] = indent + ':'.repeat(MARKER_LEN[name] ?? 3) + (m[3] ?? '');
  });
  for (const open of stack) {
    report(
      ctx,
      'error',
      'format.container.unclosed',
      `:::${open.name} 컨테이너가 닫히지 않았습니다 (닫는 ::: 필요).`,
      open.line,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Token walker
// ---------------------------------------------------------------------------

function tokenAt(tokens: Token[], i: number): Token {
  const t = tokens[i];
  if (!t) throw new Error(`token ${i} out of range`);
  return t;
}

function closeIndex(tokens: Token[], open: number): number {
  const level = tokenAt(tokens, open).level;
  for (let j = open + 1; j < tokens.length; j++) {
    const t = tokenAt(tokens, j);
    if (t.level === level && t.nesting === -1) return j;
  }
  return tokens.length - 1;
}

function lineOf(tok: Token, env: BodyEnv): number | undefined {
  return tok.map ? env.offset + tok.map[0] : undefined;
}

function walk(tokens: Token[], start: number, end: number, env: BodyEnv): Block[] {
  const blocks: Block[] = [];
  let i = start;
  while (i < end) {
    const tok = tokenAt(tokens, i);
    const line = lineOf(tok, env);
    if (tok.nesting === 1 && tok.type.startsWith('container_')) {
      const close = closeIndex(tokens, i);
      const block = buildContainer(tokens, i, close, env);
      if (block) blocks.push(block);
      i = close + 1;
      continue;
    }
    switch (tok.type) {
      case 'paragraph_open': {
        const block = paragraphBlock(tokens[i + 1], line, env);
        if (block) blocks.push(block);
        i = closeIndex(tokens, i) + 1;
        break;
      }
      case 'heading_open': {
        const inline = tokens[i + 1];
        const text = inline?.type === 'inline' ? joinLines(inline.content) : '';
        if (tok.markup === '-' || tok.markup === '=') {
          // Setext heading: a paragraph followed by `---`/`===` is kept as a paragraph.
          report(
            env.ctx,
            'warn',
            'format.hr.ignored',
            "문단 바로 아래의 '---'/'==='는 무시됩니다 (구분선은 쓰지 않습니다).",
            line,
          );
          if (text) blocks.push({ type: 'paragraph', text });
        } else {
          if (tok.tag === 'h1' || tok.tag === 'h2') {
            report(
              env.ctx,
              'error',
              'format.heading.level',
              `본문 제목은 '###'을 씁니다 ('${tok.markup}'는 슬라이드·노트 구분과 겹칩니다).`,
              line,
            );
          }
          if (text) blocks.push({ type: 'paragraph', text, lead: true });
        }
        i = closeIndex(tokens, i) + 1;
        break;
      }
      case 'bullet_list_open': {
        const close = closeIndex(tokens, i);
        const items = listItems(tokens, i, close, env);
        blocks.push({ type: 'bullets', items: items.map((it) => it.text) });
        i = close + 1;
        break;
      }
      case 'ordered_list_open': {
        const close = closeIndex(tokens, i);
        const items = listItems(tokens, i, close, env);
        blocks.push({ type: 'steps', items: items.map((it) => splitBoldTitle(it.text)) });
        i = close + 1;
        break;
      }
      case 'table_open': {
        const close = closeIndex(tokens, i);
        blocks.push(tableBlock(tokens, i, close));
        i = close + 1;
        break;
      }
      case 'blockquote_open': {
        const close = closeIndex(tokens, i);
        const block = quoteBlock(tokens, i, close);
        if (block) blocks.push(block);
        i = close + 1;
        break;
      }
      case 'fence':
      case 'code_block':
        blocks.push(codeBlock(tok));
        i++;
        break;
      case 'hr':
        report(env.ctx, 'warn', 'format.hr.ignored', "본문의 구분선('---')은 무시됩니다.", line);
        i++;
        break;
      default:
        i++;
    }
  }
  return blocks;
}

function paragraphBlock(
  inline: Token | undefined,
  line: number | undefined,
  env: BodyEnv,
): Block | undefined {
  if (!inline || inline.type !== 'inline') return undefined;
  const kids = (inline.children ?? []).filter(
    (k) => !((k.type === 'text' && k.content.trim() === '') || k.type === 'softbreak'),
  );
  const only = kids[0];
  if (kids.length === 1 && only?.type === 'image') {
    const src = getBodyMarkdown().normalizeLinkText(String(only.attrGet('src') ?? ''));
    const block: ImageBlock = {
      type: 'image',
      asset: resolveImageAsset(src, only.content, line, env.ctx),
    };
    const caption = only.attrGet('title');
    if (caption !== null && caption !== '') block.caption = String(caption);
    return block;
  }
  if (kids.some((k) => k.type === 'image')) {
    report(
      env.ctx,
      'warn',
      'format.image.inline',
      '이미지는 문단에 단독으로 써야 image 블록이 됩니다. 문장 속 이미지는 텍스트로 남습니다.',
      line,
    );
  }
  const text = joinLines(inline.content);
  return text ? { type: 'paragraph', text } : undefined;
}

function listItems(tokens: Token[], open: number, close: number, env: BodyEnv): { text: string }[] {
  const items: { text: string }[] = [];
  const itemLevel = tokenAt(tokens, open).level + 1;
  for (let j = open + 1; j < close; j++) {
    const t = tokenAt(tokens, j);
    if (t.type !== 'list_item_open' || t.level !== itemLevel) continue;
    const itemClose = closeIndex(tokens, j);
    const parts: string[] = [];
    let nested = false;
    for (let k = j + 1; k < itemClose; k++) {
      const u = tokenAt(tokens, k);
      if (u.type === 'inline' && u.level === itemLevel + 2) parts.push(joinLines(u.content));
      else if (u.nesting === 1 && u.level === itemLevel + 1 && u.type !== 'paragraph_open')
        nested = true;
    }
    if (nested) {
      report(
        env.ctx,
        'warn',
        'format.list.nested',
        '중첩 목록과 목록 안의 블록은 지원하지 않아 무시됩니다.',
        lineOf(t, env),
      );
    }
    items.push({ text: parts.join(' ') });
    j = itemClose;
  }
  return items;
}

function tableBlock(tokens: Token[], open: number, close: number): TableBlock {
  const head: string[] = [];
  const align: ('l' | 'c' | 'r')[] = [];
  const rows: string[][] = [];
  let row: string[] | undefined;
  let inHead = false;
  for (let j = open + 1; j < close; j++) {
    const t = tokenAt(tokens, j);
    if (t.type === 'thead_open') inHead = true;
    else if (t.type === 'thead_close') inHead = false;
    else if (t.type === 'tr_open') row = [];
    else if (t.type === 'tr_close') {
      if (!inHead && row) rows.push(row);
      row = undefined;
    } else if (t.type === 'th_open' || t.type === 'td_open') {
      const inline = tokens[j + 1];
      const text = inline?.type === 'inline' ? inline.content.trim() : '';
      if (inHead) {
        head.push(text);
        const style = String(t.attrGet('style') ?? '');
        align.push(/center/.test(style) ? 'c' : /right/.test(style) ? 'r' : 'l');
      } else row?.push(text);
    }
  }
  const block: TableBlock = { type: 'table', head, rows };
  if (align.some((a) => a !== 'l')) block.align = align;
  return block;
}

const CITE_LINE = /^(?:—|―|–|--)\s*(.+)$/;

function quoteBlock(tokens: Token[], open: number, close: number): Block | undefined {
  const lines: string[] = [];
  for (let j = open + 1; j < close; j++) {
    const t = tokenAt(tokens, j);
    if (t.type === 'inline')
      lines.push(
        ...t.content
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      );
  }
  if (!lines.length) return undefined;
  let cite: string | undefined;
  const last = lines[lines.length - 1] ?? '';
  const m = CITE_LINE.exec(last);
  if (m?.[1] && lines.length > 1) {
    cite = m[1].trim();
    lines.pop();
  }
  const block: Block = { type: 'quote', text: lines.join(' ') };
  if (cite) block.cite = cite;
  return block;
}

function codeBlock(tok: Token): CodeBlock {
  const block: CodeBlock = { type: 'code', code: tok.content.replace(/\n$/, '') };
  if (tok.type === 'fence') {
    const attrs = tokenizeAttrs(tok.info.trim());
    const lang = attrs.find((a) => a.key === undefined && !a.quoted)?.value;
    const title = attrs.find((a) => a.key === 'title')?.value;
    if (lang) block.lang = lang;
    if (title) block.title = title;
  }
  return block;
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

interface ContainerCtx {
  name: ContainerName;
  attrs: ParsedAttrs;
  /** Raw content lines (between the ::: lines). */
  lines: string[];
  /** 1-based file line of lines[0]. */
  firstLine: number;
  /** 1-based file line of the opening ::: line. */
  line: number;
  env: BodyEnv;
}

function buildContainer(
  tokens: Token[],
  open: number,
  close: number,
  env: BodyEnv,
): Block | undefined {
  const tok = tokenAt(tokens, open);
  const params = tok.info.trim();
  const name = firstWord(params);
  if (!isContainerName(name)) return undefined; // reported by the pre-pass
  const map = tok.map ?? [0, 0];
  const line = env.offset + map[0];
  const rest = params.slice(name.length);
  const attrs = parseContainerAttrs(rest, SPECS[name]);
  if (name !== 'widget') {
    for (const u of attrs.unknown) {
      report(
        env.ctx,
        'warn',
        'format.attr.unknown',
        `:::${name}에서 알 수 없는 속성 '${u}'는 무시됩니다.`,
        line,
      );
    }
  }
  const c: ContainerCtx = {
    name,
    attrs,
    lines: env.lines.slice(map[0] + 1, map[1]),
    firstLine: env.offset + map[0] + 1,
    line,
    env,
  };
  switch (name) {
    case 'chain':
      return chainBlock(c);
    case 'cards':
      return cardsBlock(c);
    case 'takeaway':
      return textContainer(
        c,
        (text, label) => ({ type: 'takeaway', text, ...(label ? { label } : {}) }),
        c.attrs.label ?? c.attrs.attrs.label,
      );
    case 'callout':
      return calloutBlock(c);
    case 'verdict':
      return verdictBlock(c);
    case 'table':
      return tableContainer(tokens, open, close, c);
    case 'compare':
      return compareBlock(c);
    case 'steps':
      return stepsBlock(c);
    case 'columns':
      return columnsBlock(tokens, open, close, c);
    case 'col':
      return undefined; // handled by columns; stray cols are reported by the pre-pass
    case 'image':
      return imageContainer(c);
    case 'video':
      return videoBlock(c);
    case 'pills':
      return pillsBlock(c);
    case 'timeline':
      return timelineBlock(c);
    case 'tiles':
      return tilesBlock(c);
    case 'terms':
      return termsBlock(c);
    case 'widget':
      return widgetBlock(c, rest);
    case 'html':
      return htmlBlock(c);
  }
}

function err(c: ContainerCtx, code: string, message: string, line = c.line): void {
  report(c.env.ctx, 'error', code, message, line);
}

function contentText(c: ContainerCtx): string {
  return c.lines
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join(' ');
}

function textContainer(
  c: ContainerCtx,
  make: (text: string, label?: string) => Block,
  label?: string,
): Block | undefined {
  const text = contentText(c);
  if (!text) {
    err(c, 'format.container.empty', `:::${c.name}에 본문 텍스트가 필요합니다.`);
    return undefined;
  }
  return make(text, label);
}

function calloutBlock(c: ContainerCtx): CalloutBlock | undefined {
  const kinds = [...c.attrs.flags, ...(c.attrs.attrs.kind ? [c.attrs.attrs.kind] : [])];
  const kind = kinds[kinds.length - 1] ?? 'info';
  if (!CALLOUT_KINDS.includes(kind as CalloutBlock['kind'])) {
    err(
      c,
      'format.attr.invalid',
      `callout 종류는 ${CALLOUT_KINDS.join(' | ')} 중 하나여야 합니다: ${kind}`,
    );
    return undefined;
  }
  const title = c.attrs.label ?? c.attrs.attrs.title;
  const body = contentText(c);
  if (!body) {
    err(c, 'format.container.empty', ':::callout에 본문 텍스트가 필요합니다.');
    return undefined;
  }
  return { type: 'callout', kind: kind as CalloutBlock['kind'], ...(title ? { title } : {}), body };
}

function verdictBlock(c: ContainerCtx): VerdictBlock | undefined {
  const kinds = [...c.attrs.flags, ...(c.attrs.attrs.verdict ? [c.attrs.attrs.verdict] : [])];
  const verdict = kinds[kinds.length - 1];
  if (!verdict || !VERDICTS.includes(verdict as VerdictBlock['verdict'])) {
    err(
      c,
      'format.attr.invalid',
      `:::verdict 다음에 ${VERDICTS.join(' | ')} 중 하나를 써야 합니다.`,
    );
    return undefined;
  }
  const label = c.attrs.label ?? c.attrs.attrs.label;
  const text = contentText(c);
  if (!text) {
    err(c, 'format.container.empty', ':::verdict에 본문 텍스트가 필요합니다.');
    return undefined;
  }
  return {
    type: 'verdict',
    verdict: verdict as VerdictBlock['verdict'],
    ...(label ? { label } : {}),
    text,
  };
}

// --- item containers --------------------------------------------------------

interface ItemSpec {
  keys: readonly string[];
  required: readonly string[];
  /** Pipe row cells → fields; undefined when the cell count is not accepted. */
  positional: (cells: string[]) => Record<string, string> | undefined;
  /** Bare `- text` item → fields; undefined when scalars are not accepted. */
  scalar?: (text: string) => Record<string, string>;
  /** Single-key map item such as `- ok: text` (pills). */
  shorthand?: (key: string, value: string) => Record<string, string> | undefined;
  /** Human description of the pipe row shape for error messages. */
  rowHint: string;
}

interface Item {
  fields: Record<string, string>;
  line: number;
}

function readItems(c: ContainerCtx, spec: ItemSpec): Item[] {
  const { items, issues } = parseItems(c.lines, c.firstLine);
  for (const issue of issues) err(c, 'format.item.syntax', issue.message, issue.line);
  const out: Item[] = [];
  for (const item of items) {
    const fields = itemFields(item, spec, c);
    if (!fields) continue;
    const missing = spec.required.filter((k) => !fields[k]);
    if (missing.length) {
      err(
        c,
        'format.item.missing',
        `:::${c.name} 항목에 ${missing.join(', ')}이(가) 필요합니다.`,
        item.line,
      );
      continue;
    }
    out.push({ fields, line: item.line });
  }
  if (!out.length && !issues.length)
    err(c, 'format.container.empty', `:::${c.name}에 항목이 없습니다.`);
  return out;
}

function itemFields(
  item: ParsedItem,
  spec: ItemSpec,
  c: ContainerCtx,
): Record<string, string> | undefined {
  if (item.kind === 'row') {
    const fields = spec.positional(item.cells);
    if (!fields)
      err(
        c,
        'format.item.cells',
        `:::${c.name} 행은 '${spec.rowHint}' 형식이어야 합니다 (칸 ${item.cells.length}개).`,
        item.line,
      );
    return fields;
  }
  if (item.kind === 'scalar') {
    if (!spec.scalar) {
      err(c, 'format.item.syntax', `:::${c.name} 항목은 key: value 형식이어야 합니다.`, item.line);
      return undefined;
    }
    return spec.scalar(item.text);
  }
  if (item.keys.length === 1 && spec.shorthand) {
    const key = item.keys[0] ?? '';
    const short = spec.shorthand(key, item.fields[key] ?? '');
    if (short) return short;
    if (!spec.keys.includes(key) && spec.scalar) return spec.scalar(item.raw);
  }
  for (const key of item.keys) {
    if (!spec.keys.includes(key)) {
      report(
        c.env.ctx,
        'warn',
        'format.item.key',
        `:::${c.name} 항목의 알 수 없는 키 '${key}'는 무시됩니다 (허용: ${spec.keys.join(', ')}).`,
        item.line,
      );
    }
  }
  const fields: Record<string, string> = {};
  for (const key of spec.keys)
    if (item.fields[key] !== undefined && item.fields[key] !== '') fields[key] = item.fields[key];
  return fields;
}

const pick = (keys: string[], cells: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  keys.forEach((k, i) => {
    const v = cells[i];
    if (v !== undefined && v !== '') out[k] = v;
  });
  return out;
};

function tone(c: ContainerCtx, item: Item): Tone | undefined {
  const t = item.fields.tone;
  if (t === undefined) return undefined;
  if (TONES.includes(t as Tone)) return t as Tone;
  err(c, 'format.item.tone', `tone은 ${TONES.join(' | ')} 중 하나여야 합니다: ${t}`, item.line);
  return undefined;
}

function colsAttr(
  c: ContainerCtx,
  allowed: readonly number[],
  fallback: number,
): number | undefined {
  const raw = c.attrs.attrs.cols;
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!isInteger(raw) || !allowed.includes(n)) {
    err(
      c,
      'format.attr.invalid',
      `:::${c.name}의 cols는 ${allowed.join(', ')} 중 하나여야 합니다: ${raw}`,
    );
    return undefined;
  }
  return n;
}

function chainBlock(c: ContainerCtx): ChainBlock | undefined {
  const items = readItems(c, {
    keys: ['no', 'label', 'sub'],
    required: ['label'],
    rowHint: '01 | 라벨 | 부제',
    positional: (cells) => {
      if (cells.length >= 3)
        return pick(
          ['no', 'label', 'sub'],
          [cells[0] ?? '', cells[1] ?? '', cells.slice(2).join(' | ')],
        );
      if (cells.length === 2)
        return /^\d{1,3}[.)]?$/.test(cells[0] ?? '')
          ? pick(['no', 'label'], cells)
          : pick(['label', 'sub'], cells);
      return pick(['label'], cells);
    },
    scalar: (text) => ({ label: text }),
  });
  if (!items.length) return undefined;
  return {
    type: 'chain',
    items: items.map(({ fields: f }) => ({
      ...(f.no ? { no: f.no } : {}),
      label: f.label ?? '',
      ...(f.sub ? { sub: f.sub } : {}),
    })),
  };
}

function cardsBlock(c: ContainerCtx): CardsBlock | undefined {
  const items = readItems(c, {
    keys: ['kicker', 'title', 'body', 'icon', 'tone'],
    required: ['title'],
    rowHint: '키커 | 제목 | 본문',
    positional: (cells) =>
      cells.length === 1
        ? pick(['title'], cells)
        : cells.length === 2
          ? pick(['title', 'body'], cells)
          : cells.length === 3
            ? pick(['kicker', 'title', 'body'], cells)
            : undefined,
    scalar: (text) => ({ title: text }),
  });
  if (!items.length) return undefined;
  const n = items.length;
  const fallback = n <= 2 ? 2 : n === 3 ? 3 : n === 4 ? 2 : n <= 6 ? 3 : 4;
  const cols = colsAttr(c, [2, 3, 4], fallback);
  if (cols === undefined) return undefined;
  return {
    type: 'cards',
    cols: cols as CardsBlock['cols'],
    items: items.map((item) => {
      const f = item.fields;
      const t = tone(c, item);
      return {
        ...(f.kicker ? { kicker: f.kicker } : {}),
        title: f.title ?? '',
        ...(f.body ? { body: f.body } : {}),
        ...(f.icon ? { icon: f.icon } : {}),
        ...(t ? { tone: t } : {}),
      };
    }),
  };
}

function compareBlock(c: ContainerCtx): CompareBlock | undefined {
  const left = c.attrs.attrs.left;
  const right = c.attrs.attrs.right;
  if (!left || !right) {
    err(c, 'format.attr.missing', ':::compare에는 left="…" right="…" 속성이 필요합니다.');
  }
  const items = readItems(c, {
    keys: ['label', 'left', 'right'],
    required: ['left', 'right'],
    rowHint: '항목 | 왼쪽 | 오른쪽',
    positional: (cells) =>
      cells.length === 3
        ? pick(['label', 'left', 'right'], cells)
        : cells.length === 2
          ? pick(['left', 'right'], cells)
          : undefined,
  });
  if (!items.length || !left || !right) return undefined;
  return {
    type: 'compare',
    left,
    right,
    rows: items.map(({ fields: f }) => ({
      label: f.label ?? '',
      left: f.left ?? '',
      right: f.right ?? '',
    })),
  };
}

function stepsBlock(c: ContainerCtx): StepsBlock | undefined {
  const items = readItems(c, {
    keys: ['title', 'body'],
    required: ['title'],
    rowHint: '제목 | 설명',
    positional: (cells) =>
      cells.length === 1
        ? splitFields(splitBoldTitle(cells[0] ?? ''))
        : cells.length === 2
          ? pick(['title', 'body'], cells)
          : undefined,
    scalar: (text) => splitFields(splitBoldTitle(text)),
  });
  if (!items.length) return undefined;
  return {
    type: 'steps',
    items: items.map(({ fields: f }) => ({
      title: f.title ?? '',
      ...(f.body ? { body: f.body } : {}),
    })),
  };
}

function splitFields(s: { title: string; body?: string }): Record<string, string> {
  return s.body ? { title: s.title, body: s.body } : { title: s.title };
}

function pillsBlock(c: ContainerCtx): PillsBlock | undefined {
  const isTone = (s: string): boolean => TONES.includes(s as Tone);
  const items = readItems(c, {
    keys: ['text', 'tone'],
    required: ['text'],
    rowHint: '톤 | 텍스트',
    positional: (cells) =>
      cells.length === 1
        ? pick(['text'], cells)
        : cells.length === 2
          ? pick(['tone', 'text'], cells)
          : undefined,
    scalar: (text) => ({ text }),
    shorthand: (key, value) => (isTone(key) ? { tone: key, text: value } : undefined),
  });
  if (!items.length) return undefined;
  return {
    type: 'pills',
    items: items.map((item) => {
      const t = tone(c, item);
      return { ...(t ? { tone: t } : {}), text: item.fields.text ?? '' };
    }),
  };
}

function timelineBlock(c: ContainerCtx): TimelineBlock | undefined {
  const items = readItems(c, {
    keys: ['at', 'title', 'body'],
    required: ['at', 'title'],
    rowHint: '시점 | 제목 | 설명',
    positional: (cells) =>
      cells.length === 3
        ? pick(['at', 'title', 'body'], cells)
        : cells.length === 2
          ? pick(['at', 'title'], cells)
          : undefined,
  });
  if (!items.length) return undefined;
  return {
    type: 'timeline',
    items: items.map(({ fields: f }) => ({
      at: f.at ?? '',
      title: f.title ?? '',
      ...(f.body ? { body: f.body } : {}),
    })),
  };
}

function tilesBlock(c: ContainerCtx): TilesBlock | undefined {
  const items = readItems(c, {
    keys: ['icon', 'label', 'value', 'tone'],
    required: ['label'],
    rowHint: '아이콘 | 라벨 | 값',
    positional: (cells) =>
      cells.length === 1
        ? pick(['label'], cells)
        : cells.length === 2
          ? pick(['label', 'value'], cells)
          : cells.length === 3
            ? pick(['icon', 'label', 'value'], cells)
            : cells.length === 4
              ? pick(['icon', 'label', 'value', 'tone'], cells)
              : undefined,
    scalar: (text) => ({ label: text }),
  });
  if (!items.length) return undefined;
  const cols = colsAttr(c, [2, 3, 4, 5], Math.min(5, Math.max(2, items.length)));
  if (cols === undefined) return undefined;
  return {
    type: 'tiles',
    cols: cols as TilesBlock['cols'],
    items: items.map((item) => {
      const f = item.fields;
      const t = tone(c, item);
      return {
        ...(f.icon ? { icon: f.icon } : {}),
        label: f.label ?? '',
        ...(f.value ? { value: f.value } : {}),
        ...(t ? { tone: t } : {}),
      };
    }),
  };
}

function termsBlock(c: ContainerCtx): TermsBlock | undefined {
  const items = readItems(c, {
    keys: ['abbr', 'en', 'ko'],
    required: ['abbr', 'ko'],
    rowHint: '약어 | English | 한국어',
    positional: (cells) =>
      cells.length === 3
        ? pick(['abbr', 'en', 'ko'], cells)
        : cells.length === 2
          ? pick(['abbr', 'ko'], cells)
          : undefined,
  });
  if (!items.length) return undefined;
  const terms = c.env.ctx.lecture.terms;
  const block: TermsBlock = {
    type: 'terms',
    items: items.map(({ fields: f }) => ({
      abbr: f.abbr ?? '',
      ...(f.en ? { en: f.en } : {}),
      ko: f.ko ?? '',
    })),
  };
  // Terms defined on a slide also feed the deck-wide abbreviation tooltips.
  for (const item of block.items) {
    if (terms[item.abbr] === undefined)
      terms[item.abbr] = [item.en, item.ko].filter(Boolean).join(' ');
  }
  return block;
}

// --- structural containers --------------------------------------------------

function tableContainer(
  tokens: Token[],
  open: number,
  close: number,
  c: ContainerCtx,
): TableBlock | undefined {
  let table: TableBlock | undefined;
  for (let j = open + 1; j < close; j++) {
    const t = tokenAt(tokens, j);
    if (t.type === 'table_open') {
      const end = closeIndex(tokens, j);
      if (table)
        report(
          c.env.ctx,
          'warn',
          'format.table.extra',
          ':::table 안의 두 번째 표는 무시됩니다.',
          c.line,
        );
      else table = tableBlock(tokens, j, end);
      j = end;
    }
  }
  if (!table) {
    err(c, 'format.table.missing', ':::table 안에 GFM 표(| a | b | + 구분선)가 필요합니다.');
    return undefined;
  }
  if (c.attrs.attrs.caption) table.caption = c.attrs.attrs.caption;
  return table;
}

function columnsBlock(
  tokens: Token[],
  open: number,
  close: number,
  c: ContainerCtx,
): ColumnsBlock | undefined {
  const columns: Block[][] = [];
  const level = tokenAt(tokens, open).level + 1;
  for (let j = open + 1; j < close; j++) {
    const t = tokenAt(tokens, j);
    if (t.level !== level) continue;
    if (t.type === 'container_col_open') {
      const end = closeIndex(tokens, j);
      columns.push(walk(tokens, j + 1, end, c.env));
      j = end;
    } else if (t.nesting !== -1) {
      report(
        c.env.ctx,
        'warn',
        'format.columns.content',
        ':::columns 안의 :::col 밖 내용은 무시됩니다.',
        lineOf(t, c.env) ?? c.line,
      );
      if (t.nesting === 1) j = closeIndex(tokens, j);
    }
  }
  if (columns.length < 2 || columns.length > 3) {
    err(
      c,
      'format.columns.count',
      `:::columns에는 :::col이 2개 또는 3개 필요합니다 (현재 ${columns.length}개).`,
    );
    return undefined;
  }
  const cols = colsAttr(c, [2, 3], columns.length);
  if (cols === undefined) return undefined;
  if (cols !== columns.length) {
    report(
      c.env.ctx,
      'warn',
      'format.columns.count',
      `cols=${cols}이지만 :::col은 ${columns.length}개입니다.`,
      c.line,
    );
  }
  return { type: 'columns', cols: columns.length as ColumnsBlock['cols'], columns };
}

function imageContainer(c: ContainerCtx): ImageBlock | undefined {
  const a = c.attrs.attrs;
  const ref = a.asset ?? a.src;
  if (!ref) {
    err(c, 'format.attr.missing', ':::image에는 asset=<id 또는 경로> 속성이 필요합니다.');
    return undefined;
  }
  const block: ImageBlock = {
    type: 'image',
    asset: resolveImageAsset(ref, a.alt ?? '', c.line, c.env.ctx),
  };
  if (a.caption) block.caption = a.caption;
  if (c.attrs.flags.includes('zoom') || a.zoom === 'true') block.zoom = true;
  else if (a.zoom === 'false') block.zoom = false;
  if (a.fit !== undefined) {
    if (a.fit === 'contain' || a.fit === 'cover') block.fit = a.fit;
    else err(c, 'format.attr.invalid', `fit은 contain 또는 cover여야 합니다: ${a.fit}`);
  }
  if (a.height !== undefined) {
    const h = Number(a.height.replace(/px$/, ''));
    if (Number.isFinite(h) && h > 0) block.height = h;
    else err(c, 'format.attr.invalid', `height는 px 숫자여야 합니다: ${a.height}`);
  }
  const body = contentText(c);
  if (body && !block.caption) block.caption = body;
  return block;
}

function videoBlock(c: ContainerCtx): VideoBlock | undefined {
  const a = c.attrs.attrs;
  if (!a.id) {
    err(c, 'format.attr.missing', ':::video에는 id=<YouTube id> 속성이 필요합니다.');
    return undefined;
  }
  const block: VideoBlock = { type: 'video', video: a.id };
  if (a.start !== undefined) {
    const start = parseSeconds(a.start);
    if (start === undefined)
      err(c, 'format.attr.invalid', `start는 초 또는 mm:ss여야 합니다: ${a.start}`);
    else block.start = start;
  }
  if (a.label) block.label = a.label;
  const caption = a.caption ?? (contentText(c) || undefined);
  if (caption) block.caption = caption;
  const videos = c.env.ctx.lecture.videos;
  if (!videos.some((v) => v.id === a.id)) {
    videos.push({
      id: a.id,
      title: a.label ?? a.caption ?? a.id,
      ...(block.start !== undefined ? { start: block.start } : {}),
    });
  }
  return block;
}

function coerce(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function widgetBlock(c: ContainerCtx, rest: string): WidgetBlock | undefined {
  const tokens = tokenizeAttrs(rest);
  const nameTok = tokens.find((t) => t.key === undefined);
  if (!nameTok) {
    err(c, 'format.attr.missing', ':::widget 다음에 위젯 이름이 필요합니다 (예: :::widget abac).');
    return undefined;
  }
  const params: Record<string, unknown> = {};
  for (const t of tokens) {
    if (t === nameTok) continue;
    if (t.key !== undefined) params[t.key] = t.quoted ? t.value : coerce(t.value);
    else params[t.value] = true;
  }
  const body = c.lines.join('\n').trim();
  if (body) {
    try {
      const data: unknown = parseYaml(body);
      if (data && typeof data === 'object' && !Array.isArray(data)) Object.assign(params, data);
      else
        err(
          c,
          'format.widget.params',
          ':::widget 본문은 key: value YAML 맵이어야 합니다.',
          c.firstLine,
        );
    } catch (e) {
      err(
        c,
        'format.widget.params',
        `:::widget 본문 YAML 오류: ${(e as Error).message.split('\n')[0]}`,
        c.firstLine,
      );
    }
  }
  const block: WidgetBlock = { type: 'widget', name: nameTok.value };
  if (Object.keys(params).length) block.params = params;
  return block;
}

function htmlBlock(c: ContainerCtx): Block | undefined {
  const lines = c.lines.slice();
  while (lines.length && lines[0]?.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]?.trim() === '') lines.pop();
  if (!lines.length) {
    err(c, 'format.container.empty', ':::html이 비어 있습니다.');
    return undefined;
  }
  return { type: 'html', html: lines.join('\n') };
}

// --- assets -------------------------------------------------------------------

/**
 * Image reference → asset id. Accepts an id from the front matter, a path already registered
 * there, or a new relative path (an id is derived from the file name).
 */
export function resolveImageAsset(
  ref: string,
  alt: string,
  line: number | undefined,
  ctx: ParseContext,
): string {
  const assets = ctx.lecture.assets;
  const setAlt = (id: string): string => {
    const asset = assets[id];
    if (asset && alt && asset.alt === undefined) asset.alt = alt;
    return id;
  };
  if (assets[ref]) return setAlt(ref);
  const norm = (p: string): string => p.replace(/^\.\//, '');
  const byPath = Object.keys(assets).find((id) => norm(assets[id]?.path ?? '') === norm(ref));
  if (byPath) return setAlt(byPath);
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
    report(
      ctx,
      'warn',
      'format.image.remote',
      `원격/데이터 URL 이미지는 덱에 포함할 수 없습니다: ${ref.slice(0, 60)}`,
      line,
    );
  } else if (!/[./\\]/.test(ref)) {
    report(
      ctx,
      'error',
      'format.asset.unknown',
      `머리말 assets에 없는 이미지 id입니다: '${ref}'`,
      line,
    );
    return ref;
  }
  const base = assetIdFromPath(ref);
  let id = base;
  for (let n = 2; assets[id]; n++) id = `${base}-${n}`;
  assets[id] = alt ? { path: ref, alt } : { path: ref };
  return id;
}
