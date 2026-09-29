/**
 * importLegacyDeck: the professor's existing single-file HTML decks (V20 week-3 family and
 * v9.7 week-5 family, PLAN.md §2) → Lecture IR + `.marco.md` source + assets + report.
 */
import { parseHTML } from 'linkedom';
import { normalizeLecture, parseNote, validateLecture } from '@marco/schema';
import type { Lecture, LectureMeta, QuizItem, Ref, Slide, SlideNote, Video } from '@marco/schema';
import { AssetRegistry } from './assets.js';
import type { MapContext } from './blocks.js';
import { textOf } from './dom.js';
import { extractWindowData } from './jsdata.js';
import { PayloadTable } from './payloads.js';
import { finishReport, ReportBuilder } from './report.js';
import { serializeMarco } from './serialize.js';
import { finishSlide, v20Slide, v97Slide, type SlideDraft } from './slides.js';
import type { ImportOptions, ImportResult, LegacyFamily } from './types.js';

export function detectFamily(html: string): LegacyFamily {
  if (/class="[^"]*\bv20-slide\b/.test(html) || /class='[^']*\bv20-slide\b/.test(html)) return 'v20';
  if (/<section[^>]*\bdata-group=/.test(html)) return 'v97';
  if (/id="lecture-data"/.test(html)) return 'v20';
  return 'v97';
}

interface V20Data {
  assets?: Record<string, { title?: string; credit?: string; source?: string; data?: string }>;
  refs?: { id: string; title?: string; url?: string }[];
  slideRefs?: string[][];
  videos?: { id: string; title?: string; displayTitle?: string; author?: string; start?: number }[];
}

/** Plugin data larger than this (JSON characters) goes to a sidecar file instead of front matter. */
const SIDECAR_THRESHOLD = 4000;

function slideId(index: number): string {
  return `s-${String(index + 1).padStart(2, '0')}`;
}

function noteFromV20(text: string): SlideNote | undefined {
  const prose = text.replace(/\s+/g, ' ').trim();
  if (!prose) return undefined;
  return parseNote(`[대사] ${prose}`);
}

function noteFromV97(text: string): SlideNote | undefined {
  const raw = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!raw.trim()) return undefined;
  return parseNote(raw);
}

function isQuizItem(value: unknown): value is Omit<QuizItem, 'id'> {
  const v = value as Partial<QuizItem> | null;
  return !!v && typeof v.q === 'string' && Array.isArray(v.opts) && typeof v.ans === 'number';
}

export function quizFrom(value: unknown): QuizItem[] | undefined {
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [(v as { id?: string }).id ?? `Q${String(i + 1).padStart(2, '0')}`, v])
    : value && typeof value === 'object'
      ? Object.entries(value)
      : [];
  const out: QuizItem[] = [];
  for (const [id, v] of entries) {
    if (!isQuizItem(v)) return undefined;
    const item: QuizItem = { id, q: v.q, opts: v.opts.map(String), ans: v.ans };
    if (typeof v.area === 'number') item.area = v.area;
    if (typeof v.areaName === 'string') item.areaName = v.areaName;
    if (typeof v.key === 'string') item.key = v.key;
    if (typeof v.exp === 'string') item.exp = v.exp;
    if (Array.isArray(v.refs)) item.refs = v.refs.map(String);
    out.push(item);
  }
  return out.length ? out : undefined;
}

export function importLegacyDeck(html: string, opts: ImportOptions = {}): ImportResult {
  const family: LegacyFamily = !opts.family || opts.family === 'auto' ? detectFamily(html) : opts.family;
  const payloads = new PayloadTable();
  const tokenized = payloads.tokenize(html);
  const { document } = parseHTML(tokenized);
  const report = new ReportBuilder();
  const assets = new AssetRegistry(payloads, (opts.assetDir ?? 'assets').replace(/\/+$/, ''));

  const refs: Ref[] = [];
  const videos = new Map<string, Video>();
  const terms: Record<string, string> = {};
  let slideRefs: string[][] = [];
  const data: ImportResult['report']['data'] = {};
  const lecture: Partial<Lecture> = {};

  // ---- deck data -------------------------------------------------------------------------
  if (family === 'v20') {
    const json = document.querySelector('script#lecture-data')?.textContent;
    if (json) {
      try {
        const d = JSON.parse(json) as V20Data;
        for (const [id, a] of Object.entries(d.assets ?? {})) {
          const meta: { title?: string; credit?: string; source?: string } = {};
          if (a.title) meta.title = a.title;
          if (a.credit) meta.credit = a.credit;
          if (a.source) meta.source = a.source;
          if (!a.data || !assets.addDataUri(id, a.data, meta)) report.warn(`Asset \`${id}\` in #lecture-data has no data URI.`);
        }
        for (const r of d.refs ?? []) {
          const ref: Ref = { id: r.id, title: r.title ?? r.id };
          if (r.url) ref.url = r.url;
          refs.push(ref);
        }
        slideRefs = d.slideRefs ?? [];
        for (const v of d.videos ?? []) {
          const video: Video = { id: v.id, title: v.title ?? v.displayTitle ?? v.id };
          if (typeof v.start === 'number') video.start = v.start;
          if (v.author) video.credit = v.author;
          videos.set(v.id, video);
          const dropped = Object.keys(v).filter((k) => !['id', 'title', 'start', 'author'].includes(k));
          if (dropped.length) {
            report.warn(
              `Video \`${v.id}\`: fields without an IR home were not imported (${dropped.join(', ')}); the slide's html block still shows them.`,
            );
          }
        }
      } catch (e) {
        report.warn(`#lecture-data is not valid JSON: ${(e as Error).message}`);
      }
    } else report.warn('No #lecture-data script found (assets, refs and videos are missing).');
  } else {
    const quiz = extractWindowData(html, 'QUIZ');
    if (quiz) {
      const items = quizFrom(quiz.value);
      if (items) {
        lecture.quiz = items;
        data.quiz = items.length;
      } else report.warn('window.QUIZ does not have the QuizItem shape; not imported.');
    }
    const sims = extractWindowData(html, 'SIMS');
    if (sims && sims.value && typeof sims.value === 'object') {
      lecture.sims = sims.value as Record<string, unknown>;
      data.sims = Object.keys(lecture.sims).length;
      if (/correctAttackFlows|window\.SIMS\.\w+\s*=|B\.s_\w+\.flows/.test(html)) {
        report.warn('window.SIMS is patched at runtime by later scripts (v9.3 fact corrections); only the base literal was imported.');
      }
    }
    const terminals = extractWindowData(html, 'TERMS');
    if (terminals && terminals.value && typeof terminals.value === 'object') {
      lecture.terminals = terminals.value as Record<string, unknown>;
      data.terminals = Object.keys(lecture.terminals).length;
    }
    const script = extractWindowData(html, 'SCRIPT');
    if (script && script.value && typeof script.value === 'object') {
      data.script = Object.keys(script.value).length;
      report.warn(
        'window.SCRIPT (narration cues with legacy `{q, i}` focus selectors) was not imported: the `data-note` text is the single source of truth; focus targets need a selector → block-id resolver.',
      );
    }
  }

  const refByUrl = new Map<string, string>();
  const addRef = (url: string, title: string): string => {
    const known = refs.find((r) => r.url === url) ?? (refByUrl.has(url) ? refs.find((r) => r.id === refByUrl.get(url)) : undefined);
    if (known) return known.id;
    const id = `R${String(refs.length + 1).padStart(2, '0')}`;
    const ref: Ref = { id, title: title || url };
    if (url) ref.url = url;
    refs.push(ref);
    refByUrl.set(url, id);
    return id;
  };

  // ---- slides ----------------------------------------------------------------------------
  const sections = Array.from(document.querySelectorAll(family === 'v20' ? 'section.slide.v20-slide' : 'section.slide'));
  if (family === 'v20' && !sections.length) sections.push(...Array.from(document.querySelectorAll('section.slide')));
  const slides: Slide[] = [];
  const footers = new Map<string, number>();
  // V20 TOC: a divider opens a group ("1부 · 인증과 하드웨어") that runs until the next divider;
  // the quote slide closes it (buildToc in the V20 runtime).
  let v20Group: string | undefined;
  sections.forEach((section, index) => {
    const id = slideId(index);
    const ctx: MapContext = {
      family,
      slideId: id,
      report,
      assets,
      terms,
      videos,
      addRef,
      slideRefs: [],
      inColumn: false,
    };
    const draft: SlideDraft = family === 'v20' ? v20Slide(section, ctx, slideRefs[index]) : v97Slide(section, ctx);
    draft.refs.push(...ctx.slideRefs);
    if (family === 'v20') {
      if (draft.type === 'divider') v20Group = [draft.groupLabel, draft.title].filter(Boolean).join(' · ');
      else if (draft.type === 'quote' || draft.type === 'cover') v20Group = undefined;
      if (v20Group && !draft.group) draft.group = v20Group;
    }
    if (draft.footer) footers.set(draft.footer, (footers.get(draft.footer) ?? 0) + 1);
    const slide = finishSlide(draft, id, ctx);
    if (!slide.title) report.warn(`${id} has no title (no data-title and no heading).`);
    const noteText = section.getAttribute('data-note') ?? '';
    const note = family === 'v20' ? noteFromV20(noteText) : noteFromV97(noteText);
    if (note) slide.note = note;
    slides.push(slide);
  });

  for (const s of slides) {
    for (const r of s.refs ?? []) if (!refs.some((x) => x.id === r)) report.warn(`${s.id} cites \`${r}\`, which is not in the reference list.`);
  }

  // ---- meta ------------------------------------------------------------------------------
  const footer = [...footers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const meta: LectureMeta = {
    title: slides[0]?.title || textOf(document.querySelector('title') ?? document.createElement('title')) || 'Untitled',
    lang: document.documentElement?.getAttribute('lang') === 'en' ? 'en' : 'ko',
    theme: family === 'v20' ? 'v20-violet' : 'cau-navy',
    edition: 'instructor',
  };
  if (footer) {
    const m = /^(.*?)\s*·\s*(\d+)\s*주차$/.exec(footer);
    if (m) {
      meta.course = m[1] ?? '';
      meta.week = Number(m[2]);
    } else meta.footer = footer;
  }

  const draftLecture: Lecture = {
    ir: '0.1',
    meta,
    refs,
    videos: [...videos.values()],
    assets: assets.toLectureAssets(),
    terms,
    slides,
  };
  if (lecture.quiz) draftLecture.quiz = lecture.quiz;
  if (lecture.sims) draftLecture.sims = lecture.sims;
  if (lecture.terminals) draftLecture.terminals = lecture.terminals;

  const normalized = normalizeLecture(draftLecture);
  const validation = validateLecture(normalized);
  const finalLecture = validation.ok ? validation.lecture : normalized;
  // The source keeps the notes as authored: normalizeLecture assigns cue ids (pNN-cKKK) that
  // would otherwise be pinned into the text; the compiler assigns the same ids at build.
  const asAuthored: Lecture = {
    ...finalLecture,
    slides: finalLecture.slides.map((s, i) => {
      const note = draftLecture.slides[i]?.note;
      const copy: Slide = { ...s };
      delete copy.note;
      if (note) copy.note = note;
      return copy;
    }),
  };
  const sidecars: Record<string, unknown> = {};
  const sidecarPaths: Partial<Record<'sims' | 'terminals', string>> = {};
  for (const key of ['sims', 'terminals'] as const) {
    const value = finalLecture[key];
    if (value && JSON.stringify(value).length > SIDECAR_THRESHOLD) {
      sidecarPaths[key] = `${key}.json`;
      sidecars[`${key}.json`] = value;
    }
  }
  const source = serializeMarco(asAuthored, { sidecars: sidecarPaths });

  const imported = assets.toImported();
  return {
    lecture: finalLecture,
    source,
    assets: imported,
    sidecars,
    report: finishReport(report, asAuthored, family, {
      ...(opts.sourceName ? { sourceName: opts.sourceName } : {}),
      validation: validation.ok ? [] : validation.errors,
      assets: {
        total: imported.length,
        referenced: [...assets.referenced].filter((id) => assets.has(id)).length,
        stripped: imported.filter((a) => a.stripped).length,
        bytes: imported.reduce((n, a) => n + a.bytes.length, 0),
      },
      data,
    }),
  };
}
