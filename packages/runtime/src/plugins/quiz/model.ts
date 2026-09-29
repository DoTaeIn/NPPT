// Quiz data model: widget params, question selection and exam scoring (no DOM).
import type { QuizItem } from '@marco/schema';

export type QuizMode = 'cards' | 'exam';

/** `data-params` of `<div class="widget" data-widget="quiz">`, normalised. */
export interface QuizParams {
  mode: QuizMode;
  /** Only the questions of this area (`QuizItem.area`). */
  area?: number;
  /** Exactly these question ids, in this order (wins over `area`). */
  ids?: string[];
  /** Exam time limit in minutes (1–180, default 15). */
  minutes: number;
  /** Shuffle the question order (per mount in cards mode, per attempt in exam mode). */
  shuffle: boolean;
}

/** A valid quiz item plus its 1-based position in `#lecture-data` `quiz` (the question number). */
export interface Item extends QuizItem {
  no: number;
}

export const DEFAULT_MINUTES = 15;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function toNum(v: unknown): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * Tolerant params: `:::widget quiz mode=exam area=2 ids=Q01,Q02 minutes=10 shuffle` arrives as
 * numbers, booleans and strings, a YAML body as real arrays.
 */
export function parseQuizParams(raw: unknown): QuizParams {
  const p = isObj(raw) ? raw : {};
  const out: QuizParams = {
    mode: p.mode === 'exam' ? 'exam' : 'cards',
    minutes: DEFAULT_MINUTES,
    shuffle: p.shuffle === true || p.shuffle === 'true' || p.shuffle === 1,
  };
  const area = toNum(p.area);
  if (area !== undefined) out.area = area;
  const ids = (
    Array.isArray(p.ids) ? p.ids : typeof p.ids === 'string' ? p.ids.split(/[\s,]+/) : []
  )
    .filter((x) => typeof x === 'string' || typeof x === 'number')
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (ids.length) out.ids = ids;
  const min = toNum(p.minutes);
  if (min !== undefined && min > 0) out.minutes = Math.min(180, Math.max(1, Math.round(min)));
  return out;
}

/** Valid items of `data.quiz` (question, ≥2 options, `ans` in range); others are skipped. */
export function normalizeItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const items: Item[] = [];
  raw.forEach((v, i) => {
    if (!isObj(v)) return;
    const opts = Array.isArray(v.opts) ? v.opts.map((o) => String(o ?? '')) : [];
    const ans = toNum(v.ans) ?? -1;
    const q = typeof v.q === 'string' ? v.q : '';
    if (!q || opts.length < 2 || !Number.isInteger(ans) || ans < 0 || ans >= opts.length) {
      console.warn(`[MARCO quiz] quiz[${i}] is not a valid question and is skipped.`);
      return;
    }
    const id = String(v.id ?? '') || `Q${i + 1}`;
    const it: Item = { ...(v as unknown as QuizItem), id, q, opts, ans, no: i + 1 };
    const area = toNum(v.area);
    if (area === undefined) delete it.area;
    else it.area = area;
    it.refs = Array.isArray(v.refs) ? v.refs.map(String) : [];
    items.push(it);
  });
  return items;
}

export function shuffled<T>(list: readonly T[], rnd: () => number = Math.random): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** `ids` (in that order) > `area` > all; unknown ids are skipped with a warning. */
export function selectItems(all: readonly Item[], p: QuizParams): Item[] {
  if (p.ids) {
    const out: Item[] = [];
    for (const id of p.ids) {
      const it = all.find((x) => x.id === id);
      if (it) out.push(it);
      else console.warn(`[MARCO quiz] unknown question id "${id}".`);
    }
    return out;
  }
  return p.area === undefined ? all.slice() : all.filter((x) => x.area === p.area);
}

export interface AreaScore {
  area?: number;
  name: string;
  correct: number;
  total: number;
}

export interface ExamResult {
  correct: number;
  total: number;
  answered: number;
  /** 0–100, rounded. */
  score: number;
  grade: string;
  /** Per area, in area order (questions without an area form one group at the end). */
  areas: AreaScore[];
}

/** Reference week 5 grading: A ≥ 90, B ≥ 70, C ≥ 50, else D. */
export function grade(score: number): string {
  return score >= 90
    ? '우수 (A)'
    : score >= 70
      ? '양호 (B)'
      : score >= 50
        ? '보완 필요 (C)'
        : '재학습 권장 (D)';
}

export function areaLabel(it: Pick<QuizItem, 'area' | 'areaName'>): string {
  const n = it.area !== undefined ? `영역 ${it.area}` : '';
  return [n, it.areaName || ''].filter(Boolean).join(' · ');
}

export function scoreExam(
  items: readonly Item[],
  answers: ReadonlyMap<string, number>,
): ExamResult {
  const byArea = new Map<string, AreaScore>();
  let correct = 0;
  let answered = 0;
  for (const it of items) {
    const key = it.area !== undefined ? `a${it.area}` : `n${it.areaName || ''}`;
    let a = byArea.get(key);
    if (!a) {
      a = { name: areaLabel(it) || '기타', correct: 0, total: 0 };
      if (it.area !== undefined) a.area = it.area;
      byArea.set(key, a);
    }
    a.total++;
    const pick = answers.get(it.id);
    if (pick !== undefined) answered++;
    if (pick === it.ans) {
      a.correct++;
      correct++;
    }
  }
  const total = items.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const areas = [...byArea.values()].sort((x, y) => (x.area ?? Infinity) - (y.area ?? Infinity));
  return { correct, total, answered, score, grade: grade(score), areas };
}

/** Seconds → `MM:SS`. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
