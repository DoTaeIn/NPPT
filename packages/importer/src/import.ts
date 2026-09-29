/**
 * importLegacyDeck: the professor's existing single-file HTML decks (V20 week-3 family and
 * v9.7 week-5 family, PLAN.md §2) → Lecture IR + `.marco.md` source + assets + report.
 */
import { parseHTML } from 'linkedom';
import {
  lectureSchema,
  normalizeLecture,
  parseNote,
  validateLecture,
  type ValidationError,
} from '@marco/schema';
import type { Lecture, LectureMeta, QuizItem, Ref, SlideNote, Video } from '@marco/schema';
import { AssetRegistry } from './assets.js';
import type { MapContext } from './blocks.js';
import type { ImportConfig, SlideOverrides, SlideRule } from './config.js';
import { runCorrections, type CorrectionData } from './corrections.js';
import { CssIndex } from './css.js';
import { textOf } from './dom.js';
import { plainText } from './inline.js';
import { extractWindowData } from './jsdata.js';
import { splitProseNote } from './notesplit.js';
import { PayloadTable } from './payloads.js';
import { finishReport, ReportBuilder } from './report.js';
import { serializeMarco } from './serialize.js';
import { finishSlide, v20Slide, v97Slide, type SlideDraft } from './slides.js';
import type {
  ConfigReport,
  CorrectionsReport,
  ImportedSlide,
  ImportOptions,
  ImportResult,
  LegacyFamily,
} from './types.js';

export function detectFamily(html: string): LegacyFamily {
  if (/class="[^"]*\bv20-slide\b/.test(html) || /class='[^']*\bv20-slide\b/.test(html))
    return 'v20';
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

function proseNote(text: string): SlideNote | undefined {
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

// ---------------------------------------------------------------------------------------------
// config helpers
// ---------------------------------------------------------------------------------------------

function ruleLabel(rule: SlideRule): string {
  return rule.at !== undefined ? `at ${rule.at}` : `legacyTitle "${rule.legacyTitle ?? ''}"`;
}

/** Which config rule applies to each slide position (by `at`, else by legacy `data-title`). */
function matchRules(
  rules: SlideRule[],
  legacyTitles: string[][],
  report: ConfigReport | undefined,
): (SlideRule[] | undefined)[] {
  const out: (SlideRule[] | undefined)[] = legacyTitles.map(() => undefined);
  for (const rule of rules) {
    const hits =
      rule.at !== undefined
        ? rule.at <= legacyTitles.length
          ? [rule.at - 1]
          : []
        : legacyTitles.flatMap((titles, i) => (titles.includes(rule.legacyTitle ?? '') ? [i] : []));
    if (!hits.length) report?.unmatched.push(ruleLabel(rule));
    for (const i of hits) (out[i] ??= []).push(rule);
  }
  return out;
}

const OVERRIDE_KEYS = [
  'title',
  'subtitle',
  'toc',
  'tag',
  'group',
  'question',
  'kicker',
  'tagline',
  'meta',
  'art',
  'dark',
  'layout',
] as const satisfies readonly (keyof SlideOverrides)[];

function applyOverrides(target: ImportedSlide, set: SlideOverrides): string[] {
  const slide = target as unknown as Record<string, unknown>;
  const fields: string[] = [];
  for (const key of OVERRIDE_KEYS) {
    const v = set[key];
    if (v === undefined) continue;
    fields.push(key);
    if (v === '' || (Array.isArray(v) && !v.length && key !== 'meta')) {
      delete slide[key];
      continue;
    }
    slide[key] = v;
  }
  return fields;
}

// ---------------------------------------------------------------------------------------------
// schema compatibility: fields the installed @marco/schema does not know yet
// ---------------------------------------------------------------------------------------------

const COVER_FIELDS = ['toc', 'kicker', 'tagline', 'meta', 'art', 'dark'] as const;

function schemaSlideFields(): Set<string> {
  const defs = (lectureSchema as { $defs?: Record<string, { properties?: object }> }).$defs;
  return new Set(Object.keys(defs?.Slide?.properties ?? {}));
}

/** Validate, leaving out slide fields the installed schema does not know (they are reported). */
function validateCompat(lecture: Lecture): { errors: ValidationError[]; pending: string[] } {
  const known = schemaSlideFields();
  const pending = COVER_FIELDS.filter(
    (f) => !known.has(f) && lecture.slides.some((s) => f in (s as ImportedSlide)),
  );
  const copy: Lecture = pending.length
    ? {
        ...lecture,
        slides: lecture.slides.map((s) => {
          const c = { ...s } as Record<string, unknown>;
          for (const f of pending) delete c[f];
          return c as unknown as Lecture['slides'][number];
        }),
      }
    : lecture;
  const result = validateLecture(copy);
  return { errors: result.ok ? [] : result.errors, pending: [...pending] };
}

// ---------------------------------------------------------------------------------------------
// import
// ---------------------------------------------------------------------------------------------

export function importLegacyDeck(html: string, opts: ImportOptions = {}): ImportResult {
  const config: ImportConfig = opts.config ?? {};
  const family: LegacyFamily =
    opts.family && opts.family !== 'auto' ? opts.family : (config.family ?? detectFamily(html));
  const payloads = new PayloadTable();
  const tokenized = payloads.tokenize(html);
  const { document } = parseHTML(tokenized);
  const report = new ReportBuilder();
  const assets = new AssetRegistry(payloads, (opts.assetDir ?? 'assets').replace(/\/+$/, ''));
  const css = new CssIndex(
    Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n'),
  );
  const configReport: ConfigReport | undefined = opts.config
    ? {
        source: opts.configSource ?? 'inline',
        notes: family === 'v20' ? (config.notes ?? 'split') : 'verbatim',
        applied: [],
        unmatched: [],
        droppedRefs: [],
        assets: [],
      }
    : undefined;

  const selector = family === 'v20' ? 'section.slide.v20-slide' : 'section.slide';
  let sections = Array.from(document.querySelectorAll(selector));
  if (family === 'v20' && !sections.length)
    sections = Array.from(document.querySelectorAll('section.slide'));
  const legacyTitles = sections.map((s) => [s.getAttribute('data-title')?.trim() ?? '']);

  // ---- load-time corrections (opt-in per deck) ---------------------------------------------
  let corrected: CorrectionData | undefined;
  let correctionsReport: CorrectionsReport | undefined;
  if (config.corrections?.length) {
    const data: CorrectionData = {};
    for (const key of ['SIMS', 'QUIZ', 'SCRIPT'] as const) {
      const found = extractWindowData(html, key);
      if (found) data[key] = found.value;
    }
    const result = runCorrections(document, config.corrections, data);
    corrected = result;
    correctionsReport = result.report;
    sections.forEach((s, i) => {
      const now = s.getAttribute('data-title')?.trim() ?? '';
      const titles = legacyTitles[i];
      if (titles && !titles.includes(now)) titles.push(now);
    });
  }
  const windowData = (key: 'SIMS' | 'QUIZ' | 'SCRIPT' | 'TERMS'): { value: unknown } | undefined =>
    corrected && key !== 'TERMS' && corrected[key] !== undefined
      ? { value: corrected[key] }
      : extractWindowData(html, key);

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
          if (!a.data || !assets.addDataUri(id, a.data, meta))
            report.warn(`Asset \`${id}\` in #lecture-data has no data URI.`);
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
          const dropped = Object.keys(v).filter(
            (k) => !['id', 'title', 'start', 'author'].includes(k),
          );
          if (dropped.length) {
            report.warn(
              `Video \`${v.id}\`: fields without an IR home were not imported (${dropped.join(', ')}).`,
            );
          }
        }
      } catch (e) {
        report.warn(`#lecture-data is not valid JSON: ${(e as Error).message}`);
      }
    } else report.warn('No #lecture-data script found (assets, refs and videos are missing).');
  } else {
    const quiz = windowData('QUIZ');
    if (quiz) {
      const items = quizFrom(quiz.value);
      if (items) {
        lecture.quiz = items;
        data.quiz = items.length;
      } else report.warn('window.QUIZ does not have the QuizItem shape; not imported.');
    }
    const sims = windowData('SIMS');
    if (sims && sims.value && typeof sims.value === 'object') {
      lecture.sims = sims.value as Record<string, unknown>;
      data.sims = Object.keys(lecture.sims).length;
      const patched = /correctAttackFlows|applyCorrections97|window\.SIMS\.\w+\s*=/.test(html);
      if (patched && !correctionsReport?.changed.sims) {
        report.warn(
          'window.SIMS is patched at load time by later scripts (`correctAttackFlows`, `applyCorrections97`); only the base literal was imported. List them under `corrections` in import.config.json to apply them.',
        );
      }
    }
    const terminals = windowData('TERMS');
    if (terminals && terminals.value && typeof terminals.value === 'object') {
      lecture.terminals = terminals.value as Record<string, unknown>;
      data.terminals = Object.keys(lecture.terminals).length;
    }
    const script = windowData('SCRIPT');
    if (script && script.value && typeof script.value === 'object') {
      data.script = Object.keys(script.value).length;
      report.warn(
        'window.SCRIPT (narration cues with legacy `{q, i}` focus selectors) was not imported: the `data-note` text is the single source of truth; focus targets need a selector → block-id resolver.',
      );
    }
  }

  const refByUrl = new Map<string, string>();
  const addRef = (url: string, title: string): string => {
    const known =
      refs.find((r) => r.url === url) ??
      (refByUrl.has(url) ? refs.find((r) => r.id === refByUrl.get(url)) : undefined);
    if (known) return known.id;
    const id = `R${String(refs.length + 1).padStart(2, '0')}`;
    const ref: Ref = { id, title: title || url };
    if (url) ref.url = url;
    refs.push(ref);
    refByUrl.set(url, id);
    return id;
  };

  // ---- slides ----------------------------------------------------------------------------
  const rulesAt = matchRules(config.slides ?? [], legacyTitles, configReport);
  const ids = sections.map((_s, i) => rulesAt[i]?.find((r) => r.id)?.id ?? slideId(i));
  const slides: ImportedSlide[] = [];
  const footers = new Map<string, number>();
  // V20 TOC: a divider opens a group ("1부 · 인증과 하드웨어") that runs until the next divider;
  // the quote slide closes it (buildToc in the V20 runtime).
  let v20Group: string | undefined;
  const splitNotes = family === 'v20' && (config.notes ?? 'split') === 'split';
  let splitCount = 0;
  sections.forEach((section, index) => {
    const id = ids[index] ?? slideId(index);
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
      css,
    };
    const draft: SlideDraft =
      family === 'v20' ? v20Slide(section, ctx, slideRefs[index]) : v97Slide(section, ctx);
    draft.refs.push(...ctx.slideRefs);
    if (family === 'v20') {
      if (draft.type === 'divider')
        v20Group = [draft.groupLabel, draft.title].filter(Boolean).join(' · ');
      else if (draft.type === 'quote' || draft.type === 'cover') v20Group = undefined;
      if (v20Group && !draft.group) draft.group = v20Group;
    }
    if (draft.footer) footers.set(draft.footer, (footers.get(draft.footer) ?? 0) + 1);
    const slide = finishSlide(draft, id, ctx);
    const noteText = section.getAttribute('data-note') ?? '';
    let note: SlideNote | undefined;
    if (family === 'v20') {
      note = splitNotes ? splitProseNote(noteText, slide.blocks, id) : undefined;
      if (note) splitCount++;
      else note = proseNote(noteText);
    } else note = noteFromV97(noteText);
    if (note) {
      slide.note = note;
      const hazard = (note.raw ?? '')
        .split('\n')
        .find((l) => /^( {0,3}(`{3,}|~{3,})|# slide\b|## note\s*$)/.test(l));
      if (hazard)
        report.warn(
          `${id}: note line \`${hazard.slice(0, 40)}\` can be misread as a fence or slide/note header in the source.`,
        );
    }
    for (const rule of rulesAt[index] ?? []) {
      const fields = rule.set ? applyOverrides(slide, rule.set) : [];
      const applied: ConfigReport['applied'][number] = { rule: ruleLabel(rule), slide: id, fields };
      if (rule.id) applied.id = rule.id;
      configReport?.applied.push(applied);
    }
    if (index === 0 && config.cover) {
      const fields = applyOverrides(slide, config.cover);
      configReport?.applied.push({ rule: 'cover', slide: id, fields });
    }
    if (slide.art) assets.markReferenced(slide.art);
    if (!slide.title) report.warn(`${id} has no title (no data-title and no heading).`);
    slides.push(slide);
  });
  if (family === 'v20') report.noteSplit = { split: splitCount, total: sections.length };

  // ---- refs --------------------------------------------------------------------------------
  const drop = new Set(config.dropRefs ?? []);
  for (const id of drop) {
    const at = refs.findIndex((r) => r.id === id);
    if (at < 0) {
      report.warn(`config.dropRefs: \`${id}\` is not in the reference list.`);
      continue;
    }
    refs.splice(at, 1);
    configReport?.droppedRefs.push(id);
  }
  for (const s of slides) {
    if (drop.size && s.refs) {
      s.refs = s.refs.filter((r) => !drop.has(r));
      if (!s.refs.length) delete s.refs;
    }
    if (drop.size && s.only) s.only = s.only.filter((r) => !drop.has(r));
    for (const r of s.refs ?? [])
      if (!refs.some((x) => x.id === r))
        report.warn(`${s.id} cites \`${r}\`, which is not in the reference list.`);
    if (s.type === 'references' && s.only) {
      const missing = s.only.filter((r) => !refs.some((x) => x.id === r));
      if (missing.length)
        report.warn(`${s.id} lists refs that are not in the reference list: ${missing.join(', ')}.`);
      const unlisted = refs.filter((r) => !s.only?.includes(r.id)).map((r) => r.id);
      if (unlisted.length)
        report.warn(`${s.id}: refs not in the legacy reference list: ${unlisted.join(', ')}.`);
      if (s.only.join(',') === refs.map((r) => r.id).join(',')) delete s.only;
    }
  }

  // ---- assets ------------------------------------------------------------------------------
  for (const [id, meta] of Object.entries(config.assets ?? {})) {
    if (assets.override(id, meta)) configReport?.assets.push(id);
    else report.warn(`config.assets: \`${id}\` is not an imported asset.`);
  }
  for (const s of slides)
    if (s.art && !assets.has(s.art)) report.warn(`${s.id}: art \`${s.art}\` is not an asset.`);

  // ---- meta ------------------------------------------------------------------------------
  const footer = [...footers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const first = slides[0];
  const meta: LectureMeta = {
    title:
      (first ? plainText(first.toc ?? first.title) : '') ||
      textOf(document.querySelector('title') ?? document.createElement('title')) ||
      'Untitled',
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
  const validation = validateCompat(normalized);
  const sidecars: Record<string, unknown> = {};
  const sidecarPaths: Partial<Record<'sims' | 'terminals', string>> = {};
  for (const key of ['sims', 'terminals'] as const) {
    const value = draftLecture[key];
    if (value && JSON.stringify(value).length > SIDECAR_THRESHOLD) {
      sidecarPaths[key] = `${key}.json`;
      sidecars[`${key}.json`] = value;
    }
  }
  // The source is written from the draft: notes as authored (normalizeLecture would pin cue
  // ids pNN-cKKK into the text; the compiler assigns the same ids at build).
  const source = serializeMarco(draftLecture, { sidecars: sidecarPaths });

  const imported = assets.toImported();
  const finished = finishReport(report, draftLecture, family, {
    ...(opts.sourceName ? { sourceName: opts.sourceName } : {}),
    validation: validation.errors,
    schemaPending: validation.pending,
    assets: {
      total: imported.length,
      referenced: [...assets.referenced].filter((id) => assets.has(id)).length,
      stripped: imported.filter((a) => a.stripped).length,
      bytes: imported.reduce((n, a) => n + a.bytes.length, 0),
    },
    data,
  });
  if (configReport) finished.config = configReport;
  if (correctionsReport) finished.corrections = correctionsReport;
  return {
    lecture: normalized,
    source,
    assets: imported,
    sidecars,
    report: finished,
  };
}
