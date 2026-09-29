// Parses `#lecture-data` (docs/spec/runtime.md §1). Tolerant: missing or malformed fields fall back
// to empty values so a hand-edited or legacy deck still runs.
import { isCueKind } from './labels';
import type {
  AssetMeta,
  Cue,
  Edition,
  LectureData,
  NoteTime,
  Ref,
  SlideNote,
  Video,
} from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d;
const optStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' || typeof x === 'number').map(String) : [];

const KNOWN = ['ir', 'engine', 'meta', 'refs', 'videos', 'assets', 'slideRefs', 'terms', 'notes'];

export function emptyData(): LectureData {
  return {
    ir: '0.1',
    engine: { name: 'MARCO Engine', version: '' },
    meta: {},
    refs: [],
    videos: [],
    assets: {},
    slideRefs: {},
    terms: {},
  };
}

/** Reads and JSON-parses `#lecture-data`; returns `{}` when absent or invalid. */
export function readLectureJson(doc: Document = document): unknown {
  const el = doc.getElementById('lecture-data');
  const text = el?.textContent?.trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.warn('[MARCO] #lecture-data is not valid JSON; running without lecture data.', err);
    return {};
  }
}

/** Edition from `html[data-edition]`, else `meta.edition`, else instructor. */
export function detectEdition(doc: Document = document, raw?: unknown): Edition {
  const a = doc.documentElement.getAttribute('data-edition');
  if (a === 'student' || a === 'instructor') return a;
  const m = isObj(raw) && isObj(raw.meta) ? raw.meta.edition : undefined;
  return m === 'student' ? 'student' : 'instructor';
}

function parseTime(v: unknown): NoteTime | undefined {
  if (!isObj(v)) return undefined;
  const minutes = num(v.minutes);
  if (minutes === undefined) return undefined;
  const t: NoteTime = { minutes };
  const from = optStr(v.from);
  const to = optStr(v.to);
  const remark = optStr(v.remark);
  if (from) t.from = from;
  if (to) t.to = to;
  if (remark) t.remark = remark;
  return t;
}

function parseCue(v: unknown): Cue | null {
  if (!isObj(v)) return null;
  const t = str(v.t);
  const k = isCueKind(v.k) ? v.k : 'MEMO';
  if (!t && k !== 'WAIT') return null;
  const c: Cue = { k, t };
  const id = optStr(v.id);
  const wait = optStr(v.wait);
  const marker = optStr(v.marker);
  if (id) c.id = id;
  if (wait) c.wait = wait;
  if (marker) c.marker = marker;
  if (isObj(v.focus)) {
    const targets = strArr(v.focus.targets);
    if (targets.length) c.focus = { targets };
  }
  return c;
}

function parseNote(v: unknown): SlideNote | null {
  if (typeof v === 'string') return v.trim() ? { cues: [], raw: v } : null;
  if (!isObj(v)) return null;
  const cues = Array.isArray(v.cues) ? v.cues.map(parseCue).filter((c): c is Cue => !!c) : [];
  const note: SlideNote = { cues };
  const time = parseTime(v.time);
  const raw = optStr(v.raw);
  if (time) note.time = time;
  if (raw) note.raw = raw;
  return note;
}

function parseRef(v: unknown): Ref | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  if (!id) return null;
  return { ...(v as Partial<Ref>), id, title: str(v.title, id) };
}

function parseVideo(v: unknown): Video | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  if (!id) return null;
  const video: Video = { ...(v as Partial<Video>), id, title: str(v.title, id) };
  const start = num(v.start);
  if (start === undefined) delete video.start;
  else video.start = start;
  return video;
}

function parseAsset(v: unknown): AssetMeta {
  const a: AssetMeta = {};
  if (!isObj(v)) return a;
  for (const k of ['title', 'credit', 'source', 'alt'] as const) {
    const s = optStr(v[k]);
    if (s) a[k] = s;
  }
  return a;
}

/**
 * Normalises raw `#lecture-data` JSON. In the student edition notes are dropped even when a
 * build accidentally left them in.
 */
export function normalizeData(raw: unknown, edition: Edition, fallbackTitle = ''): LectureData {
  const d = emptyData();
  if (!isObj(raw)) {
    if (fallbackTitle) d.meta.title = fallbackTitle;
    return d;
  }
  for (const k of Object.keys(raw)) if (!KNOWN.includes(k)) d[k] = raw[k];

  d.ir = str(raw.ir, d.ir);
  if (isObj(raw.engine)) {
    d.engine = { name: str(raw.engine.name, d.engine.name), version: str(raw.engine.version) };
  }
  d.meta = isObj(raw.meta) ? { ...(raw.meta as LectureData['meta']) } : {};
  if (typeof d.meta.title !== 'string' || !d.meta.title) d.meta.title = fallbackTitle;

  if (Array.isArray(raw.refs)) d.refs = raw.refs.map(parseRef).filter((r): r is Ref => !!r);
  if (Array.isArray(raw.videos)) {
    d.videos = raw.videos.map(parseVideo).filter((v): v is Video => !!v);
  }
  if (isObj(raw.assets)) {
    for (const k of Object.keys(raw.assets)) d.assets[k] = parseAsset(raw.assets[k]);
  }
  if (isObj(raw.slideRefs)) {
    for (const k of Object.keys(raw.slideRefs)) d.slideRefs[k] = strArr(raw.slideRefs[k]);
  }
  if (isObj(raw.terms)) {
    for (const k of Object.keys(raw.terms)) {
      const t = str(raw.terms[k]);
      if (t) d.terms[k] = t;
    }
  }
  if (edition === 'instructor' && isObj(raw.notes)) {
    const notes: Record<string, SlideNote> = {};
    for (const k of Object.keys(raw.notes)) {
      const n = parseNote(raw.notes[k]);
      if (n) notes[k] = n;
    }
    d.notes = notes;
  }
  if (d.quiz !== undefined && !Array.isArray(d.quiz)) delete d.quiz;
  return d;
}

/** Note for a slide (by id), or undefined. */
export function noteFor(data: LectureData, slide: HTMLElement | undefined): SlideNote | undefined {
  return slide && slide.id ? data.notes?.[slide.id] : undefined;
}

/** "2.5분 · 10:00 – 12:30 · remark" */
export function timeText(t: NoteTime): string {
  const parts = [`${+t.minutes.toFixed(2)}분`];
  if (t.from || t.to) parts.push(`${t.from || ''} – ${t.to || ''}`.trim());
  if (t.remark) parts.push(t.remark);
  return parts.join(' · ');
}
