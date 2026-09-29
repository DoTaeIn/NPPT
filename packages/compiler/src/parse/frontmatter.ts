/** YAML front matter → meta, refs, videos, assets, terms, plugin data (format.md §2). */
import { isMap, LineCounter, parseDocument } from 'yaml';
import type { Asset, LectureMeta, QuizItem, Ref, Video } from '../ir.js';
import { EDITIONS, REF_KINDS, THEMES } from '../ir.js';
import { type ParseContext, report } from './context.js';
import { parseSeconds } from './text.js';

const KNOWN_KEYS = new Set([
  'title',
  'course',
  'presenter',
  'date',
  'week',
  'lang',
  'theme',
  'edition',
  'footer',
  'version',
  'duration',
  'refs',
  'videos',
  'assets',
  'terms',
  'quiz',
  'sims',
  'terminals',
]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  v === undefined || v === null
    ? undefined
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : typeof v === 'object'
        ? undefined
        : String(v);

/**
 * @param text  front matter body (between the `---` lines)
 * @param startLine 1-based file line of the first front matter line
 */
export function parseFrontMatter(text: string, startLine: number, ctx: ParseContext): void {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });
  for (const err of doc.errors) {
    const pos = err.linePos?.[0];
    report(
      ctx,
      'error',
      'format.frontmatter.yaml',
      `YAML 오류: ${(err.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:?$/, '')}`,
      pos ? startLine + pos.line - 1 : startLine,
    );
  }
  if (doc.errors.length) return;
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) {
    report(
      ctx,
      'error',
      'format.meta.title',
      '머리말(front matter)에 title이 필요합니다.',
      startLine,
    );
    return;
  }
  if (!isObj(data)) {
    report(
      ctx,
      'error',
      'format.frontmatter.yaml',
      '머리말은 key: value 형식의 YAML 맵이어야 합니다.',
      startLine,
    );
    return;
  }

  // Line of each top-level key, for precise diagnostics.
  const keyLine: Record<string, number> = {};
  if (isMap(doc.contents)) {
    for (const pair of doc.contents.items) {
      const key = pair.key as { value?: unknown; range?: [number, number, number] } | null;
      if (key?.range)
        keyLine[String(key.value)] = startLine + lineCounter.linePos(key.range[0]).line - 1;
    }
  }
  const lineOf = (key: string): number => keyLine[key] ?? startLine;

  for (const key of Object.keys(data)) {
    if (!KNOWN_KEYS.has(key)) {
      report(
        ctx,
        'warn',
        'format.frontmatter.unknown',
        `알 수 없는 머리말 키 '${key}'는 무시됩니다.`,
        lineOf(key),
      );
    }
  }

  const lecture = ctx.lecture;
  const meta: LectureMeta = lecture.meta;
  const title = str(data.title);
  if (!title)
    report(
      ctx,
      'error',
      'format.meta.title',
      '머리말(front matter)에 title이 필요합니다.',
      startLine,
    );
  else meta.title = title;
  for (const key of ['course', 'presenter', 'date', 'footer', 'version'] as const) {
    const v = str(data[key]);
    if (v !== undefined) meta[key] = v;
  }
  if (data.week !== undefined) {
    const week = Number(data.week);
    if (Number.isFinite(week)) meta.week = week;
    else
      report(
        ctx,
        'error',
        'format.meta.invalid',
        `week는 숫자여야 합니다: ${String(data.week)}`,
        lineOf('week'),
      );
  }
  if (data.duration !== undefined) {
    const duration = Number(String(data.duration).replace(/\s*분$/, ''));
    if (Number.isFinite(duration)) meta.duration = duration;
    else
      report(
        ctx,
        'error',
        'format.meta.invalid',
        `duration은 분 단위 숫자여야 합니다: ${String(data.duration)}`,
        lineOf('duration'),
      );
  }
  if (data.lang !== undefined) {
    if (data.lang === 'ko' || data.lang === 'en') meta.lang = data.lang;
    else
      report(
        ctx,
        'error',
        'format.meta.invalid',
        `lang은 ko 또는 en이어야 합니다: ${String(data.lang)}`,
        lineOf('lang'),
      );
  }
  if (data.theme !== undefined) {
    const theme = THEMES.find((t) => t === data.theme);
    if (theme) meta.theme = theme;
    else
      report(
        ctx,
        'error',
        'format.meta.invalid',
        `theme은 ${THEMES.join(' | ')} 중 하나여야 합니다: ${String(data.theme)}`,
        lineOf('theme'),
      );
  }
  if (data.edition !== undefined) {
    const edition = EDITIONS.find((e) => e === data.edition);
    if (edition) meta.edition = edition;
    else
      report(
        ctx,
        'error',
        'format.meta.invalid',
        `edition은 student 또는 instructor여야 합니다: ${String(data.edition)}`,
        lineOf('edition'),
      );
  }

  lecture.refs = parseRefs(data.refs, lineOf('refs'), ctx);
  lecture.videos = parseVideos(data.videos, lineOf('videos'), ctx);
  lecture.assets = parseAssets(data.assets, lineOf('assets'), ctx);
  if (data.terms !== undefined) {
    if (!isObj(data.terms)) {
      report(
        ctx,
        'error',
        'format.frontmatter.terms',
        'terms는 약어 → 설명 맵이어야 합니다.',
        lineOf('terms'),
      );
    } else {
      for (const [abbr, expansion] of Object.entries(data.terms)) {
        const v = str(expansion);
        if (v === undefined)
          report(
            ctx,
            'error',
            'format.frontmatter.terms',
            `terms.${abbr}의 값은 문자열이어야 합니다.`,
            lineOf('terms'),
          );
        else lecture.terms[abbr] = v;
      }
    }
  }
  if (data.quiz !== undefined) {
    if (Array.isArray(data.quiz)) lecture.quiz = data.quiz as QuizItem[];
    else
      report(ctx, 'error', 'format.frontmatter.quiz', 'quiz는 목록이어야 합니다.', lineOf('quiz'));
  }
  if (isObj(data.sims)) lecture.sims = data.sims;
  if (isObj(data.terminals)) lecture.terminals = data.terminals;
}

/** Accepts a map `id → {…}` (or `id → "title"`) or a list of `{ id, … }`. */
function entries(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.map((v, i) => [isObj(v) && v.id !== undefined ? String(v.id) : String(i + 1), v]);
  }
  if (isObj(value)) return Object.entries(value);
  return [];
}

function parseRefs(value: unknown, line: number, ctx: ParseContext): Ref[] {
  if (value === undefined) return [];
  if (!isObj(value) && !Array.isArray(value)) {
    report(
      ctx,
      'error',
      'format.frontmatter.refs',
      'refs는 id → {title, url} 맵이어야 합니다.',
      line,
    );
    return [];
  }
  const refs: Ref[] = [];
  for (const [id, v] of entries(value)) {
    const o: Obj = isObj(v) ? v : { title: v };
    const title = str(o.title);
    if (!title) {
      report(ctx, 'error', 'format.frontmatter.refs', `refs.${id}에 title이 필요합니다.`, line);
      continue;
    }
    const ref: Ref = { id, title };
    const url = str(o.url);
    if (url) ref.url = url;
    if (o.kind !== undefined) {
      const kind = REF_KINDS.find((k) => k === o.kind);
      if (kind) ref.kind = kind;
      else
        report(
          ctx,
          'warn',
          'format.frontmatter.refs',
          `refs.${id}.kind '${String(o.kind)}'는 ${REF_KINDS.join(' | ')} 중 하나가 아니므로 무시됩니다.`,
          line,
        );
    }
    const note = str(o.note);
    if (note) ref.note = note;
    refs.push(ref);
  }
  return refs;
}

function parseVideos(value: unknown, line: number, ctx: ParseContext): Video[] {
  if (value === undefined) return [];
  if (!isObj(value) && !Array.isArray(value)) {
    report(
      ctx,
      'error',
      'format.frontmatter.videos',
      'videos는 YouTube id → {title, start} 맵이어야 합니다.',
      line,
    );
    return [];
  }
  const videos: Video[] = [];
  for (const [id, v] of entries(value)) {
    const o: Obj = isObj(v) ? v : { title: v };
    const video: Video = { id, title: str(o.title) ?? id };
    if (o.start !== undefined) {
      const start = parseSeconds(typeof o.start === 'number' ? o.start : String(o.start));
      if (start === undefined)
        report(
          ctx,
          'error',
          'format.frontmatter.videos',
          `videos.${id}.start는 초 또는 mm:ss여야 합니다.`,
          line,
        );
      else video.start = start;
    }
    const credit = str(o.credit);
    if (credit) video.credit = credit;
    videos.push(video);
  }
  return videos;
}

function parseAssets(value: unknown, line: number, ctx: ParseContext): Record<string, Asset> {
  const assets: Record<string, Asset> = {};
  if (value === undefined) return assets;
  if (!isObj(value)) {
    report(
      ctx,
      'error',
      'format.frontmatter.assets',
      'assets는 id → {path, title, credit} 맵이어야 합니다.',
      line,
    );
    return assets;
  }
  for (const [id, v] of Object.entries(value)) {
    const o: Obj = isObj(v) ? v : { path: v };
    const path = str(o.path);
    if (!path) {
      report(ctx, 'error', 'format.frontmatter.assets', `assets.${id}에 path가 필요합니다.`, line);
      continue;
    }
    const asset: Asset = { path };
    for (const key of ['title', 'credit', 'source', 'alt'] as const) {
      const s = str(o[key]);
      if (s !== undefined) asset[key] = s;
    }
    assets[id] = asset;
  }
  return assets;
}
