/**
 * Attribute grammar for container lines and fence info strings (format.md §5):
 * `key=value`, `key="quoted value"`, `key='quoted'`, bare `flag`, `"quoted bare"`.
 */
export interface AttrToken {
  key?: string;
  value: string;
  quoted: boolean;
}

export function tokenizeAttrs(input: string): AttrToken[] {
  const out: AttrToken[] = [];
  const s = input;
  let i = 0;
  const readQuoted = (quote: string): string => {
    let v = '';
    i++; // opening quote
    while (i < s.length && s[i] !== quote) {
      if (s[i] === '\\' && (s[i + 1] === quote || s[i + 1] === '\\')) {
        v += s[i + 1];
        i += 2;
        continue;
      }
      v += s[i];
      i++;
    }
    i++; // closing quote (or end)
    return v;
  };
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i] ?? '')) i++;
    if (i >= s.length) break;
    const c = s[i] ?? '';
    if (c === '"' || c === "'") {
      out.push({ value: readQuoted(c), quoted: true });
      continue;
    }
    const keyMatch = /^([A-Za-z_][\w-]*)=/.exec(s.slice(i));
    if (keyMatch?.[1]) {
      const key = keyMatch[1];
      i += keyMatch[0].length;
      const q = s[i];
      if (q === '"' || q === "'") {
        out.push({ key, value: readQuoted(q), quoted: true });
      } else {
        let v = '';
        while (i < s.length && !/\s/.test(s[i] ?? '')) v += s[i++];
        out.push({ key, value: v, quoted: false });
      }
      continue;
    }
    let v = '';
    while (i < s.length && !/\s/.test(s[i] ?? '')) v += s[i++];
    out.push({ value: v, quoted: false });
  }
  return out;
}

export interface ContainerAttrSpec {
  /** Allowed `key=value` keys. */
  keys: readonly string[];
  /** Bare words with a meaning (e.g. callout kinds, `zoom`). */
  flags?: readonly string[];
  /** Whether the first unknown bare token starts a label (rest of the line). */
  label?: boolean;
}

export interface ParsedAttrs {
  attrs: Record<string, string>;
  flags: string[];
  label?: string;
  /** Tokens that matched nothing (reported as `format.attr.unknown`). */
  unknown: string[];
}

export function parseContainerAttrs(params: string, spec: ContainerAttrSpec): ParsedAttrs {
  const out: ParsedAttrs = { attrs: {}, flags: [], unknown: [] };
  const labelParts: string[] = [];
  for (const tok of tokenizeAttrs(params)) {
    if (tok.key !== undefined) {
      if (spec.keys.includes(tok.key)) out.attrs[tok.key] = tok.value;
      else out.unknown.push(`${tok.key}=${tok.value}`);
      continue;
    }
    if (labelParts.length === 0 && !tok.quoted && spec.flags?.includes(tok.value)) {
      out.flags.push(tok.value);
      continue;
    }
    if (spec.label) labelParts.push(tok.value);
    else out.unknown.push(tok.value);
  }
  if (labelParts.length) out.label = labelParts.join(' ');
  return out;
}
