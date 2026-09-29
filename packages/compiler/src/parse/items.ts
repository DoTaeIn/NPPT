/**
 * Item grammar inside containers (format.md §5): either a YAML list of `- key: value` items or
 * pipe rows `a | b | c`, one item per line. The YAML side is a lenient subset: plain values are
 * taken verbatim (so `body: 예: 카드` and `no: 01` survive), quoted values are unescaped, `|`/`>`
 * block scalars and indented continuation lines are supported.
 */
import { parse as parseYaml } from 'yaml';
import { splitPipes } from './text.js';

export type ParsedItem =
  | { kind: 'map'; fields: Record<string, string>; keys: string[]; line: number; raw: string }
  | { kind: 'scalar'; text: string; line: number }
  | { kind: 'row'; cells: string[]; line: number };

export interface ItemIssue {
  line: number;
  message: string;
}

const KEY_LINE = /^([A-Za-z_][\w-]*)\s*:(?:\s+(.*)|\s*)$/;
const indentOf = (line: string): number => /^\s*/.exec(line)?.[0].length ?? 0;

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    try {
      const parsed: unknown = parseYaml(v);
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* fall through: keep the raw text */
    }
    return v.slice(1, -1);
  }
  return v;
}

/**
 * @param lines   content lines of the container (without the ::: lines)
 * @param firstLine 1-based file line of `lines[0]`
 */
export function parseItems(
  lines: string[],
  firstLine: number,
): { format: 'yaml' | 'pipe' | 'empty'; items: ParsedItem[]; issues: ItemIssue[] } {
  const issues: ItemIssue[] = [];
  const first = lines.findIndex((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  if (first < 0) return { format: 'empty', items: [], issues };
  const firstTrim = (lines[first] ?? '').trim();
  if (!(firstTrim === '-' || firstTrim.startsWith('- '))) {
    const items: ParsedItem[] = [];
    lines.forEach((line, i) => {
      if (line.trim() === '') return;
      items.push({ kind: 'row', cells: splitPipes(line), line: firstLine + i });
    });
    return { format: 'pipe', items, issues };
  }

  const base = indentOf(lines[first] ?? '');
  const items: ParsedItem[] = [];
  let cur:
    Extract<ParsedItem, { kind: 'map' }> | Extract<ParsedItem, { kind: 'scalar' }> | undefined;
  let lastKey: string | undefined;
  let keyIndent = 0;
  let block: { key: string; style: '|' | '>'; lines: string[]; indent: number } | undefined;

  const closeBlock = (): void => {
    if (!block || !cur || cur.kind !== 'map') {
      block = undefined;
      return;
    }
    const minIndent = Math.min(
      ...block.lines.filter((l) => l.trim() !== '').map(indentOf),
      Number.MAX_SAFE_INTEGER,
    );
    const body = block.lines.map((l) => l.slice(Math.min(minIndent, indentOf(l))));
    while (body.length && body[body.length - 1]?.trim() === '') body.pop();
    cur.fields[block.key] =
      block.style === '|'
        ? body.join('\n')
        : body
            .map((l) => l.trim())
            .join(' ')
            .trim();
    block = undefined;
  };

  const setField = (key: string, rawValue: string, line: number, indent: number): void => {
    if (!cur || cur.kind !== 'map') return;
    if (key in cur.fields) issues.push({ line, message: `항목 키 '${key}'가 중복되었습니다.` });
    else cur.keys.push(key);
    const value = rawValue.trim();
    lastKey = key;
    keyIndent = indent;
    if (/^[|>][+-]?$/.test(value)) {
      block = { key, style: value[0] as '|' | '>', lines: [], indent };
      cur.fields[key] = '';
      return;
    }
    cur.fields[key] = unquote(value);
  };

  lines.forEach((line, i) => {
    const lineNo = firstLine + i;
    const indent = indentOf(line);
    const trimmed = line.trim();
    if (block) {
      if (trimmed === '' || indent > block.indent) {
        block.lines.push(line);
        return;
      }
      closeBlock();
    }
    if (trimmed === '' || (trimmed.startsWith('#') && indent <= base)) return;
    if (indent === base && (trimmed === '-' || trimmed.startsWith('- '))) {
      const rest = trimmed.slice(1).trim();
      const kv = KEY_LINE.exec(rest);
      if (kv?.[1]) {
        cur = { kind: 'map', fields: {}, keys: [], line: lineNo, raw: rest };
        items.push(cur);
        setField(kv[1], kv[2] ?? '', lineNo, indent + 2);
      } else {
        cur = { kind: 'scalar', text: unquote(rest), line: lineNo };
        items.push(cur);
        lastKey = undefined;
      }
      return;
    }
    if (!cur || indent <= base) {
      issues.push({
        line: lineNo,
        message: `YAML 목록 항목('- ')으로 시작해야 합니다: ${trimmed}`,
      });
      return;
    }
    const kv = KEY_LINE.exec(trimmed);
    if (kv?.[1] && cur.kind === 'map' && (lastKey === undefined || indent <= keyIndent)) {
      setField(kv[1], kv[2] ?? '', lineNo, indent);
      return;
    }
    // Indented continuation of the previous value.
    if (cur.kind === 'scalar') cur.text = `${cur.text} ${trimmed}`.trim();
    else if (lastKey !== undefined)
      cur.fields[lastKey] = `${cur.fields[lastKey] ?? ''} ${unquote(trimmed)}`.trim();
  });
  closeBlock();
  return { format: 'yaml', items, issues };
}
