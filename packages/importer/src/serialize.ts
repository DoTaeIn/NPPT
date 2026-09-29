/**
 * serializeMarco: Lecture IR → `.marco.md` source (docs/spec/format.md v0.1).
 *
 * Deterministic: the same IR always yields the same text. Container item syntax per
 * components.md §2: pipe rows for chain / compare / timeline / terms, YAML lists for cards /
 * tiles / pills / steps; Markdown for paragraphs, bullets, tables, quotes, code and plain images.
 */
import { serializeNote } from '@marco/schema';
import type { Block, Lecture, Slide } from '@marco/schema';
import type { ImportedSlide } from './types.js';
import { toYaml, toYamlList, yamlFlowList, yamlString, type YamlValue } from './yaml.js';

export interface SerializeOptions {
  /**
   * Front-matter keys whose data is written to a sidecar file instead of inline YAML
   * (value = path relative to the source, e.g. `{ sims: 'sims.json' }`). The caller writes the
   * file. Proposed extension of format.md §2 (the compiler does not load sidecars yet).
   */
  sidecars?: Partial<Record<'quiz' | 'sims' | 'terminals', string>>;
}

// ---------------------------------------------------------------------------------------------
// text escaping
// ---------------------------------------------------------------------------------------------

/** Escape a pipe-row / GFM table cell. */
export function cell(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** Escape Markdown block syntax at the start of a line of text. */
export function escapeLineStart(text: string): string {
  if (
    /^(#{1,6}(\s|$)|>|[-+*](\s|$)|:::|\||```|~~~|={3,}\s*$|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|!\[|<)/.test(
      text,
    )
  )
    return `\\${text}`;
  const ordered = /^(\d{1,9})([.)])(\s|$)/.exec(text);
  if (ordered) return `${ordered[1]}\\${text.slice((ordered[1] ?? '').length)}`;
  return text.replace(/^\s+/, '');
}

/** Container attribute: bare when safe, else double-quoted with `\"` escapes. */
export function attr(key: string, value: string | number | boolean): string {
  if (value === true) return key;
  const s = String(value);
  return /^[^\s"'=\\]+$/.test(s)
    ? `${key}=${s}`
    : `${key}="${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Free-text label after a container name (`:::takeaway 핵심 구분`). Falls back to the keyed form
 * (`label="…"`, or `title="…"` for callouts) when the bare words would be misread: a quote or
 * `=` inside, or a first word that is one of the container's flags (`:::callout info warn …`).
 */
function label(text: string | undefined, key: 'label' | 'title', reserved: string[] = []): string {
  if (!text) return '';
  const first = text.split(/\s+/)[0] ?? '';
  if (/["'=\\]/.test(text) || reserved.includes(first) || /^:/.test(text))
    return ` ${attr(key, text)}`;
  return ` ${text}`;
}

function container(head: string, body: string[]): string {
  return [`:::${head}`, ...body, ':::'].join('\n');
}

// ---------------------------------------------------------------------------------------------
// blocks
// ---------------------------------------------------------------------------------------------

function markdownTable(head: string[], rows: string[][], align?: ('l' | 'c' | 'r')[]): string[] {
  const width = Math.max(head.length, ...rows.map((r) => r.length), 1);
  const pad = (r: string[]): string[] => Array.from({ length: width }, (_, i) => cell(r[i] ?? ''));
  const line = (r: string[]): string => `| ${pad(r).join(' | ')} |`;
  const rule = Array.from({ length: width }, (_, i) => {
    const a = align?.[i];
    return a === 'c' ? ':---:' : a === 'r' ? '---:' : '---';
  });
  return [line(head), `|${rule.join('|')}|`, ...rows.map(line)];
}

function fence(code: string): string {
  let f = '```';
  while (code.includes(f)) f += '`';
  return f;
}

export function serializeBlock(block: Block, lecture: Pick<Lecture, 'assets'>): string {
  switch (block.type) {
    case 'paragraph':
      return block.lead ? `### ${block.text}` : escapeLineStart(block.text);
    case 'bullets':
      return block.items.map((i) => `- ${escapeLineStart(i)}`).join('\n');
    case 'steps':
      return container('steps', [
        toYamlList(block.items.map((i) => ({ title: i.title, body: i.body }))),
      ]);
    case 'chain':
      return container(
        'chain',
        block.items.map((i) => {
          const cells =
            i.no !== undefined
              ? [i.no, i.label, i.sub ?? '']
              : i.sub !== undefined
                ? [i.label, i.sub]
                : [i.label];
          return cells.map(cell).join(' | ');
        }),
      );
    case 'cards':
      return container(`cards ${attr('cols', block.cols)}`, [
        toYamlList(
          block.items.map((i) => ({
            kicker: i.kicker,
            title: i.title,
            body: i.body,
            icon: i.icon,
            tone: i.tone,
          })),
        ),
      ]);
    case 'tiles':
      return container(`tiles ${attr('cols', block.cols)}`, [
        toYamlList(
          block.items.map((i) => ({ label: i.label, value: i.value, icon: i.icon, tone: i.tone })),
        ),
      ]);
    case 'pills':
      return container('pills', [
        toYamlList(block.items.map((i): YamlValue => (i.tone ? { [i.tone]: i.text } : i.text))),
      ]);
    case 'takeaway':
      return container(`takeaway${label(block.label, 'label')}`, [escapeLineStart(block.text)]);
    case 'callout':
      return container(
        `callout ${block.kind}${label(block.title, 'title', ['info', 'warn', 'ok', 'danger'])}`,
        [escapeLineStart(block.body)],
      );
    case 'verdict':
      return container(
        `verdict ${block.verdict}${label(block.label, 'label', ['allow', 'drop', 'ok', 'hot', 'info'])}`,
        [escapeLineStart(block.text)],
      );
    case 'table': {
      const lines = markdownTable(block.head, block.rows, block.align);
      return block.caption
        ? container(`table ${attr('caption', block.caption)}`, lines)
        : lines.join('\n');
    }
    case 'compare':
      return container(
        `compare ${attr('left', block.left)} ${attr('right', block.right)}`,
        block.rows.map((r) => [r.label, r.left, r.right].map(cell).join(' | ')),
      );
    case 'timeline':
      return container(
        'timeline',
        block.items.map((i) =>
          [i.at, i.title, ...(i.body !== undefined ? [i.body] : [])].map(cell).join(' | '),
        ),
      );
    case 'terms':
      return container(
        'terms',
        block.items.map((i) => [i.abbr, i.en ?? '', i.ko].map(cell).join(' | ')),
      );
    case 'image': {
      const asset = lecture.assets[block.asset];
      if (asset && !block.zoom && !block.fit && block.height === undefined) {
        const alt = (asset.alt ?? '').replace(/([[\]\\])/g, '\\$1');
        const path = /[\s()<>]/.test(asset.path) ? `<${asset.path}>` : asset.path;
        const title = block.caption
          ? ` "${block.caption.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : '';
        return `![${alt}](${path}${title})`;
      }
      const attrs = [attr('asset', block.asset)];
      if (block.caption) attrs.push(attr('caption', block.caption));
      if (block.zoom) attrs.push('zoom');
      if (block.fit) attrs.push(attr('fit', block.fit));
      if (block.height !== undefined) attrs.push(attr('height', block.height));
      return container(`image ${attrs.join(' ')}`, []);
    }
    case 'video': {
      const attrs = [attr('id', block.video)];
      if (block.start !== undefined) attrs.push(attr('start', block.start));
      if (block.label) attrs.push(attr('label', block.label));
      if (block.caption) attrs.push(attr('caption', block.caption));
      return container(`video ${attrs.join(' ')}`, []);
    }
    case 'quote': {
      const lines = [`> ${block.text}`];
      if (block.cite) lines.push(`> — ${block.cite}`);
      return lines.join('\n');
    }
    case 'code': {
      const f = fence(block.code);
      const info = [
        block.lang ?? '',
        block.title ? `title="${block.title.replace(/"/g, '\\"')}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return [`${f}${info}`, block.code, f].join('\n');
    }
    case 'columns':
      return container(
        `columns ${attr('cols', block.cols)}`,
        block.columns.map((col) =>
          container(
            'col',
            col.length ? [col.map((b) => serializeBlock(b, lecture)).join('\n\n')] : [],
          ),
        ),
      );
    case 'widget': {
      const attrs: string[] = [];
      const complex: Record<string, YamlValue> = {};
      for (const [k, v] of Object.entries(block.params ?? {})) {
        const simple =
          (typeof v === 'string' && v.length <= 120 && !/[\n\r]/.test(v)) ||
          typeof v === 'number' ||
          typeof v === 'boolean';
        if (simple && /^[A-Za-z][\w-]*$/.test(k))
          attrs.push(attr(k, v as string | number | boolean));
        else complex[k] = v as YamlValue;
      }
      const body = Object.keys(complex).length ? [toYaml(complex)] : [];
      return container(['widget', block.name, ...attrs].join(' '), body);
    }
    case 'html':
      return container('html', [protectHtml(block.html)]);
  }
}

/**
 * Keep raw HTML from closing the container, opening a fence, or starting a slide/note by
 * accident: such lines are indented by four spaces (container and fence markers only count with
 * up to three), which HTML ignores.
 */
function protectHtml(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) =>
      /^(:::|`{3,}|~{3,}|# slide|## note)/.test(l.trimStart()) ? `    ${l.trimStart()}` : l,
    )
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// slides and front matter
// ---------------------------------------------------------------------------------------------

function defaultId(index: number): string {
  return `s-${String(index + 1).padStart(2, '0')}`;
}

export function serializeSlide(
  slide: Slide,
  index: number,
  lecture: Pick<Lecture, 'assets'>,
): string {
  const x = slide as ImportedSlide;
  const head = ['# slide'];
  if (slide.type !== 'content') head.push(slide.type);
  if (slide.alert) head.push('alert');
  if (x.dark) head.push('dark');
  if (slide.id !== defaultId(index)) head.push(`id=${slide.id}`);

  const fields: string[] = [`title: ${yamlString(slide.title)}`];
  if (x.toc) fields.push(`toc: ${yamlString(x.toc)}`);
  if (slide.subtitle) fields.push(`subtitle: ${yamlString(slide.subtitle)}`);
  if (x.kicker) fields.push(`kicker: ${yamlString(x.kicker)}`);
  if (x.tagline) fields.push(`tagline: ${yamlString(x.tagline)}`);
  if (x.meta) fields.push(`meta: ${yamlFlowList(x.meta)}`);
  if (x.art) fields.push(`art: ${yamlString(x.art)}`);
  if (slide.tag) fields.push(`tag: ${yamlString(slide.tag)}`);
  if (slide.group) fields.push(`group: ${yamlString(slide.group)}`);
  if (slide.question) fields.push(`question: ${yamlString(slide.question)}`);
  if (slide.refs?.length) fields.push(`refs: ${yamlFlowList(slide.refs)}`);
  if (slide.layout && slide.layout !== 'default') fields.push(`layout: ${slide.layout}`);
  if (slide.no) fields.push(`no: ${yamlString(slide.no)}`);
  if (slide.cite) fields.push(`cite: ${yamlString(slide.cite)}`);
  if (slide.only?.length) fields.push(`only: ${yamlFlowList(slide.only)}`);

  const parts = [[head.join(' '), ...fields].join('\n')];
  if (slide.type === 'raw' && slide.html) parts.push(protectHtml(slide.html));
  else for (const block of slide.blocks) parts.push(serializeBlock(block, lecture));
  if (slide.note && (slide.note.cues.length || slide.note.raw?.trim())) {
    parts.push(`## note\n${serializeNote(slide.note)}`);
  }
  return parts.join('\n\n');
}

function frontMatter(lecture: Lecture, opts: SerializeOptions): string {
  const m = lecture.meta;
  const fm: Record<string, YamlValue> = { title: m.title };
  if (m.course) fm.course = m.course;
  if (m.week !== undefined) fm.week = m.week;
  if (m.date) fm.date = m.date;
  if (m.presenter) fm.presenter = m.presenter;
  if (m.lang && m.lang !== 'ko') fm.lang = m.lang;
  fm.theme = m.theme;
  if (m.edition && m.edition !== 'instructor') fm.edition = m.edition;
  if (m.duration !== undefined) fm.duration = m.duration;
  const defaultFooter =
    m.course && m.week !== undefined ? `${m.course} · ${m.week}주차` : undefined;
  if (m.footer && m.footer !== defaultFooter) fm.footer = m.footer;
  if (lecture.refs.length) {
    fm.refs = Object.fromEntries(
      lecture.refs.map((r) => [r.id, { title: r.title, url: r.url, kind: r.kind, note: r.note }]),
    );
  }
  if (lecture.videos.length) {
    fm.videos = Object.fromEntries(
      lecture.videos.map((v) => [v.id, { title: v.title, start: v.start, credit: v.credit }]),
    );
  }
  const assets = Object.entries(lecture.assets);
  if (assets.length) {
    fm.assets = Object.fromEntries(
      assets.map(([id, a]) => [
        id,
        {
          path: a.path,
          title: a.title,
          credit: a.credit,
          source: a.source,
          alt: a.alt,
          width: a.width,
          height: a.height,
        },
      ]),
    );
  }
  if (Object.keys(lecture.terms).length) fm.terms = { ...lecture.terms };
  const data = (key: 'quiz' | 'sims' | 'terminals', value: unknown): void => {
    if (value === undefined) return;
    const side = opts.sidecars?.[key];
    fm[key] = side ?? (value as YamlValue);
  };
  data(
    'quiz',
    lecture.quiz?.map((q) => ({
      id: q.id,
      area: q.area,
      areaName: q.areaName,
      key: q.key,
      q: q.q,
      opts: q.opts,
      ans: q.ans,
      exp: q.exp,
      refs: q.refs,
    })),
  );
  data('sims', lecture.sims);
  data('terminals', lecture.terminals);
  return `---\n${toYaml(fm)}\n---`;
}

export function serializeMarco(lecture: Lecture, opts: SerializeOptions = {}): string {
  const parts = [frontMatter(lecture, opts)];
  lecture.slides.forEach((slide, i) => parts.push(serializeSlide(slide, i, lecture)));
  return parts.join('\n\n') + '\n';
}
