/**
 * `.marco.md` → Lecture IR (docs/spec/format.md). Pure function: no file system access.
 * Image paths stay relative; assets.ts resolves them against the source file later.
 */
import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from '../diagnostics.js';
import type { Lecture, NoteTime, Slide, SlideNote } from '../ir.js';
import { SLIDE_TYPES } from '../ir.js';
import { parseNote } from '@marco/schema';
import { tokenizeAttrs } from './attrs.js';
import { parseBody } from './body.js';
import { type ParseContext, report } from './context.js';
import { parseFrontMatter } from './frontmatter.js';
import { didYouMean, parseIdList } from './text.js';

export { CONTAINERS } from './body.js';

export interface ParseOptions {
  /** File name used in diagnostics (`file:line`). */
  file?: string;
}

export interface ParseResult {
  lecture: Lecture;
  diagnostics: Diagnostic[];
  /** 1-based file line of each slide's `# slide` header, by slide index. */
  slideLines: number[];
}

type SlideType = Slide['type'];

const SLIDE_HEADER = /^# slide(?:[ \t]+(.*))?$/;
const LOOKS_LIKE_HEADER = /^#\s*slides?\b/i;
const NOTE_HEADER = /^## note\s*$/;
const FIELD_LINE = /^([A-Za-z_][\w-]*)\s*:(?:[ \t]+(.*)|[ \t]*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Slide fields (format.md §4) and the slide types that use them (undefined = all). */
const FIELDS: Record<string, readonly SlideType[] | undefined> = {
  id: undefined,
  title: undefined,
  subtitle: ['cover', 'divider', 'hero', 'quote', 'content'],
  tag: ['content', 'hero', 'quote', 'references', 'raw'],
  group: undefined,
  question: undefined,
  refs: undefined,
  layout: ['content', 'hero'],
  time: undefined,
  note: undefined,
  cite: ['quote'],
  no: ['divider'],
  only: ['references'],
};

interface Chunk {
  header: string;
  /** 1-based file line of the header. */
  line: number;
  lines: string[];
}

export function parseMarco(text: string, options: ParseOptions = {}): ParseResult {
  const file = options.file ?? '<input>';
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const lecture: Lecture = {
    ir: '0.1',
    meta: { title: '', lang: 'ko', theme: 'v20-violet', edition: 'instructor' },
    refs: [],
    videos: [],
    assets: {},
    terms: {},
    slides: [],
  };
  const ctx: ParseContext = { file, lecture, diagnostics: [] };

  let i = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, j) => j > 0 && (l.trim() === '---' || l.trim() === '...'));
    if (end < 0) {
      report(
        ctx,
        'error',
        'format.frontmatter.unclosed',
        "머리말(front matter)을 닫는 '---' 줄이 없습니다.",
        1,
      );
      i = lines.length;
    } else {
      parseFrontMatter(lines.slice(1, end).join('\n'), 2, ctx);
      i = end + 1;
    }
  } else {
    report(
      ctx,
      'error',
      'format.frontmatter.missing',
      "파일은 '---'로 감싼 YAML 머리말로 시작해야 합니다 (title 필수).",
      1,
    );
  }

  const chunks: Chunk[] = [];
  let fence: string | undefined;
  let orphanLine: number | undefined;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const current = chunks[chunks.length - 1];
    const f = FENCE.exec(line);
    if (fence) {
      if (f?.[1] && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1])
        fence = undefined;
    } else if (f?.[1] && current) {
      fence = f[1];
    } else if (SLIDE_HEADER.test(line)) {
      chunks.push({ header: line, line: i + 1, lines: [] });
      continue;
    } else if (LOOKS_LIKE_HEADER.test(line)) {
      report(
        ctx,
        'error',
        'format.slide.header',
        "슬라이드 머리줄은 1열에서 '# slide'(소문자, 공백 하나)로 시작해야 합니다.",
        i + 1,
      );
    }
    if (current) current.lines.push(line);
    else if (line.trim() !== '' && orphanLine === undefined) orphanLine = i + 1;
  }
  if (orphanLine !== undefined) {
    report(
      ctx,
      'error',
      'format.slide.orphan',
      "첫 '# slide' 앞의 내용은 어느 슬라이드에도 속하지 않습니다.",
      orphanLine,
    );
  }
  if (!chunks.length) {
    report(ctx, 'error', 'format.slide.none', "파일에 '# slide' 줄이 없습니다.", lines.length);
  }
  chunks.forEach((chunk, k) => lecture.slides.push(parseSlide(chunk, k + 1, ctx)));
  return { lecture, diagnostics: ctx.diagnostics, slideLines: chunks.map((c) => c.line) };
}

// ---------------------------------------------------------------------------

interface FieldValue {
  value: string;
  /** 1-based file line of the field (or of the header for `key=value` tokens). */
  line: number;
}

function parseSlide(chunk: Chunk, position: number, parentCtx: ParseContext): Slide {
  // Header and field diagnostics are buffered until the slide id is known.
  const ctx: ParseContext = { ...parentCtx, diagnostics: [] };
  const flushPending = (): void => {
    for (const d of ctx.diagnostics) {
      if (ctx.slide) d.slide = ctx.slide;
      parentCtx.diagnostics.push(d);
    }
    ctx.diagnostics = parentCtx.diagnostics;
  };
  let type: SlideType = 'content';
  let typeSet = false;
  let alert = false;
  const fields = new Map<string, FieldValue>();

  // Header tokens: type, `alert`, key=value.
  const headerRest = SLIDE_HEADER.exec(chunk.header)?.[1] ?? '';
  for (const tok of tokenizeAttrs(headerRest)) {
    if (tok.key !== undefined) {
      if (tok.key in FIELDS) fields.set(tok.key, { value: tok.value, line: chunk.line });
      else
        report(
          ctx,
          'error',
          'format.slide.token',
          `슬라이드 머리줄의 알 수 없는 키 '${tok.key}='입니다.`,
          chunk.line,
        );
      continue;
    }
    const known = SLIDE_TYPES.find((t) => t === tok.value);
    if (known && !tok.quoted) {
      if (typeSet)
        report(
          ctx,
          'error',
          'format.slide.token',
          `슬라이드 종류가 두 번 지정되었습니다: ${type}, ${known}`,
          chunk.line,
        );
      type = known;
      typeSet = true;
    } else if (tok.value === 'alert' && !tok.quoted) {
      alert = true;
    } else {
      const hint = didYouMean(tok.value, [...SLIDE_TYPES, 'alert']);
      report(
        ctx,
        'error',
        'format.slide.token',
        `슬라이드 머리줄의 알 수 없는 토큰 '${tok.value}'${hint ? ` ('${hint}'을(를) 의도했나요?)` : ''}. 허용: ${SLIDE_TYPES.join(', ')}, alert, key=value`,
        chunk.line,
      );
    }
  }

  // Field lines until the first blank line (or the first line that is not `key: value`).
  const lines = chunk.lines;
  const lineAt = (j: number): number => chunk.line + 1 + j;
  let j = 0;
  let inlineNote: FieldValue | undefined;
  while (j < lines.length) {
    const line = lines[j] ?? '';
    if (line.trim() === '') {
      j++;
      break;
    }
    const m = FIELD_LINE.exec(line);
    if (!m?.[1]) break;
    const key = m[1];
    let value = (m[2] ?? '').trim();
    const fieldLine = lineAt(j);
    j++;
    if (/^[|>][+-]?$/.test(value)) {
      const block: string[] = [];
      while (j < lines.length) {
        const l = lines[j] ?? '';
        if (l.trim() === '') {
          const next = lines.slice(j).find((x) => x.trim() !== '');
          if (next === undefined || !/^\s/.test(next)) break;
        } else if (!/^\s/.test(l)) break;
        block.push(l);
        j++;
      }
      value = readBlockScalar(key, value, block);
    } else if (/^["']/.test(value)) {
      value = unquote(value);
    }
    if (!(key in FIELDS)) {
      const hint = didYouMean(key, Object.keys(FIELDS));
      report(
        ctx,
        'error',
        'format.field.unknown',
        `알 수 없는 슬라이드 필드 '${key}'${hint ? ` ('${hint}'을(를) 의도했나요?)` : ''}.`,
        fieldLine,
      );
      continue;
    }
    if (key === 'note') {
      inlineNote = { value, line: fieldLine };
      continue;
    }
    if (fields.has(key))
      report(
        ctx,
        'warn',
        'format.field.duplicate',
        `필드 '${key}'가 두 번 지정되어 마지막 값을 씁니다.`,
        fieldLine,
      );
    fields.set(key, { value, line: fieldLine });
  }

  // Id first, so every later diagnostic carries it.
  const idField = fields.get('id');
  let id = `s-${String(position).padStart(2, '0')}`;
  if (idField) {
    if (/^[A-Za-z][\w-]*$/.test(idField.value)) id = idField.value;
    else
      report(
        ctx,
        'error',
        'format.slide.id',
        `슬라이드 id는 영문자로 시작하고 영문·숫자·-·_만 쓸 수 있습니다: '${idField.value}'`,
        idField.line,
      );
  }
  ctx.slide = id;
  flushPending();

  for (const [key, f] of fields) {
    const types = FIELDS[key];
    if (types && !types.includes(type)) {
      report(
        ctx,
        'warn',
        'format.field.type',
        `필드 '${key}'는 ${type} 슬라이드에서 쓰이지 않습니다.`,
        f.line,
      );
    }
  }

  // Body and `## note` section.
  const bodyStart = j;
  const body: string[] = [];
  const noteLines: string[] = [];
  let noteLine: number | undefined;
  let fence: string | undefined;
  let trailingNote: FieldValue | undefined;
  for (; j < lines.length; j++) {
    const line = lines[j] ?? '';
    if (noteLine !== undefined) {
      noteLines.push(line);
      continue;
    }
    const f = FENCE.exec(line);
    if (fence) {
      if (f?.[1] && f[1][0] === fence[0] && f[1].length >= fence.length && line.trim() === f[1])
        fence = undefined;
    } else if (f?.[1]) {
      fence = f[1];
    } else if (NOTE_HEADER.test(line)) {
      noteLine = lineAt(j);
      continue;
    } else if (type !== 'raw' && /^note:\s*\|[+-]?\s*$/.test(line)) {
      // PLAN.md-style trailing `note: |` block inside the body.
      const block: string[] = [];
      const start = lineAt(j);
      while (
        j + 1 < lines.length &&
        (/^\s/.test(lines[j + 1] ?? '') || (lines[j + 1] ?? '').trim() === '')
      ) {
        block.push(lines[++j] ?? '');
      }
      trailingNote = { value: readBlockScalar('note', '|', block), line: start };
      report(
        ctx,
        'warn',
        'format.note.position',
        "본문 속 'note: |'는 '## note' 섹션으로 옮기세요.",
        start,
      );
      continue;
    } else if (/^##\s+notes?\s*$/i.test(line)) {
      report(
        ctx,
        'error',
        'format.note.header',
        "노트 섹션 머리줄은 정확히 '## note'로 써야 합니다.",
        lineAt(j),
      );
    }
    body.push(line);
  }

  const slide: Slide = { id, type, title: '', blocks: [] };
  if (alert) {
    slide.alert = true;
    if (type !== 'hero')
      report(
        ctx,
        'warn',
        'format.slide.alert',
        'alert는 hero 슬라이드에서만 쓰입니다.',
        chunk.line,
      );
  }
  const get = (key: string): string | undefined => {
    const v = fields.get(key)?.value;
    return v === undefined || v === '' ? undefined : v;
  };
  const title = get('title');
  if (title) slide.title = title;
  else if (type === 'references') slide.title = '참고 자료';
  else if (type === 'cover' && ctx.lecture.meta.title) slide.title = ctx.lecture.meta.title;
  else
    report(
      ctx,
      'error',
      'format.field.title',
      "슬라이드에 'title:' 필드가 필요합니다.",
      chunk.line,
    );
  for (const key of ['subtitle', 'tag', 'group', 'question', 'cite', 'no'] as const) {
    const v = get(key);
    if (v !== undefined) slide[key] = v;
  }
  const refs = get('refs');
  if (refs !== undefined) slide.refs = parseIdList(refs);
  const only = get('only');
  if (only !== undefined) slide.only = parseIdList(only);
  const layout = fields.get('layout');
  if (layout) {
    if (layout.value === 'default' || layout.value === 'wide') slide.layout = layout.value;
    else
      report(
        ctx,
        'error',
        'format.field.invalid',
        `layout은 default 또는 wide여야 합니다: ${layout.value}`,
        layout.line,
      );
  }

  // Body.
  if (type === 'raw') {
    const html = trimBlank(body).join('\n');
    if (html) slide.html = html;
    else
      report(
        ctx,
        'error',
        'format.raw.empty',
        'raw 슬라이드에는 HTML 본문이 필요합니다.',
        chunk.line,
      );
  } else {
    slide.blocks = parseBody(body, lineAt(bodyStart), ctx);
    if ((type === 'cover' || type === 'divider') && slide.blocks.length) {
      report(
        ctx,
        'warn',
        'format.body.ignored',
        `${type} 슬라이드의 본문 블록은 표시되지 않습니다.`,
        lineAt(bodyStart),
      );
    }
  }

  // Notes: inline `note:` field, trailing `note: |`, `## note` section; `time:` sets note.time.
  const rawParts: string[] = [];
  if (inlineNote?.value.trim()) rawParts.push(inlineNote.value.trim());
  if (trailingNote?.value.trim()) rawParts.push(trailingNote.value.trim());
  const section = trimBlank(noteLines).join('\n');
  if (section) rawParts.push(section);
  if (rawParts.length > 1) {
    report(
      ctx,
      'warn',
      'format.note.duplicate',
      '노트가 여러 곳에 있어 순서대로 합칩니다.',
      noteLine ?? inlineNote?.line,
    );
  }
  let note: SlideNote | undefined;
  if (rawParts.length) note = parseNote(rawParts.join('\n'));
  const time = fields.get('time');
  if (time) {
    const parsed: NoteTime | undefined = parseNote(`[시간] ${time.value}`).time;
    if (!parsed) {
      report(
        ctx,
        'error',
        'format.field.time',
        `time은 '2.5분' 또는 '2.5분 · 10:00 – 12:30' 형식이어야 합니다: ${time.value}`,
        time.line,
      );
    } else {
      note ??= { cues: [] };
      if (note.time && JSON.stringify(note.time) !== JSON.stringify(parsed)) {
        report(
          ctx,
          'warn',
          'format.note.time',
          'time: 필드와 노트의 [시간]이 달라 time: 필드를 씁니다.',
          time.line,
        );
      }
      note.time = parsed;
    }
  }
  if (note) slide.note = note;
  return slide;
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a]?.trim() === '') a++;
  while (b > a && lines[b - 1]?.trim() === '') b--;
  return lines.slice(a, b);
}

function unquote(value: string): string {
  try {
    const v: unknown = parseYaml(value);
    if (typeof v === 'string') return v;
  } catch {
    /* keep raw */
  }
  return value;
}

/** YAML block scalar (`|`, `>`, with chomping) from its indented lines. */
function readBlockScalar(key: string, indicator: string, block: string[]): string {
  try {
    const v: unknown = parseYaml(`${key}: ${indicator}\n${block.join('\n')}\n`);
    const out = (v as Record<string, unknown> | null)?.[key];
    if (typeof out === 'string') return out.replace(/\n+$/, '');
  } catch {
    /* fall back to a plain dedent */
  }
  const indent = Math.min(
    ...block.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)?.[0].length ?? 0),
  );
  return block
    .map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
    .join('\n')
    .trim();
}
