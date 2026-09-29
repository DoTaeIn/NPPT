/**
 * A small, deterministic YAML writer (the `yaml` package is not a dependency of this package).
 * Emits block mappings/sequences; strings are plain when unambiguous in YAML 1.1 and 1.2,
 * otherwise double-quoted with JSON escapes (JSON strings are valid YAML double-quoted scalars).
 */

export type YamlValue =
  string | number | boolean | null | undefined | YamlValue[] | { [key: string]: YamlValue };

const RESERVED =
  /^(?:~|null|Null|NULL|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N|=|<<)$/;
const NUMBERISH =
  /^(?:[-+]?(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][-+]?\d+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN)|0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+|[-+]?\d[\d_]*(?::[0-5]?\d)+(?:\.\d*)?|\d{4}-\d\d?-\d\d?(?:[Tt ].*)?)$/;

function needsEscape(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x20 || cp === 0x7f || cp === 0xfeff || (cp >= 0xe000 && cp <= 0xf8ff);
}

/** True when `s` can be written as a plain scalar in block context. */
export function isPlainSafe(s: string): boolean {
  if (s === '' || s !== s.trim()) return false;
  if (RESERVED.test(s) || NUMBERISH.test(s)) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return false;
  if (/[\n\r\t]/.test(s)) return false;
  if (s.includes(': ') || s.endsWith(':') || s.includes(' #')) return false;
  // Sexagesimal-looking values and anything else with a colon are quoted for YAML 1.1 readers.
  if (s.includes(':')) return false;
  // Control characters, BOM and private-use characters need escapes.
  if (Array.from(s).some(needsEscape)) return false;
  return true;
}

export function yamlString(s: string): string {
  return isPlainSafe(s) ? s : JSON.stringify(s);
}

export function yamlKey(key: string): string {
  return yamlString(key);
}

function scalar(v: string | number | boolean | null): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return yamlString(v);
}

function isScalar(v: YamlValue): v is string | number | boolean | null {
  return v === null || typeof v !== 'object';
}

function isEmptyCollection(v: YamlValue): boolean {
  return Array.isArray(v)
    ? v.length === 0
    : !!v && typeof v === 'object' && Object.keys(v).length === 0;
}

function entries(obj: { [key: string]: YamlValue }): [string, YamlValue][] {
  return Object.entries(obj).filter(([, v]) => v !== undefined);
}

/** Lines for a value placed after `key:` or `- ` at the given indent. */
function emit(value: YamlValue, indent: number, out: string[], prefix: string): void {
  const pad = ' '.repeat(indent);
  if (value === undefined) return;
  if (isScalar(value)) {
    out.push(`${prefix}${scalar(value)}`);
    return;
  }
  if (isEmptyCollection(value)) {
    out.push(`${prefix}${Array.isArray(value) ? '[]' : '{}'}`);
    return;
  }
  if (Array.isArray(value)) {
    if (prefix.trim()) out.push(prefix.trimEnd());
    for (const item of value) {
      if (isScalar(item) || isEmptyCollection(item)) emit(item, indent + 2, out, `${pad}- `);
      else if (Array.isArray(item)) emit(item, indent + 2, out, `${pad}-`);
      else if (item) emitMapping(item, indent + 2, out, `${pad}- `);
    }
    return;
  }
  if (prefix.trim()) out.push(prefix.trimEnd());
  emitMapping(value, indent, out, pad);
}

/** Mapping whose first line starts with `firstPrefix` (e.g. `  - `) and the rest with `indent`. */
function emitMapping(
  obj: { [key: string]: YamlValue },
  indent: number,
  out: string[],
  firstPrefix: string,
): void {
  const pad = ' '.repeat(indent);
  let first = true;
  for (const [k, v] of entries(obj)) {
    const lead = first ? firstPrefix : pad;
    first = false;
    const key = `${lead}${yamlKey(k)}:`;
    if (isScalar(v) || isEmptyCollection(v)) emit(v, indent + 2, out, `${key} `);
    else if (Array.isArray(v)) emit(v, indent, out, key);
    else emit(v, indent + 2, out, key);
  }
  if (first) out.push(`${firstPrefix}{}`);
}

/** Serialise a mapping as a YAML document body (no `---`). */
export function toYaml(obj: { [key: string]: YamlValue }, indent = 0): string {
  const out: string[] = [];
  emitMapping(obj, indent, out, ' '.repeat(indent));
  return out.join('\n');
}

/** Serialise a list of mappings/scalars as block sequence items (`- key: value`). */
export function toYamlList(items: YamlValue[], indent = 0): string {
  const out: string[] = [];
  emit(items, indent, out, '');
  return out.join('\n');
}

/** Flow sequence of plain-safe scalars, e.g. `[S13, S14]`. */
export function yamlFlowList(items: string[]): string {
  return `[${items.map((s) => (isPlainSafe(s) && !/[,[\]{}]/.test(s) ? s : JSON.stringify(s))).join(', ')}]`;
}
