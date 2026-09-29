/**
 * Loads the prompt kit (packages/ai/prompts) and builds chat messages for each pipeline step.
 *
 * Every builder returns `[system, user]` where `system` is the whole kit, byte-identical across
 * calls and steps, so provider-side prompt caching applies (PLAN.md §9). Only the user message
 * changes; its variable parts (range, slide) come last so a deck's batches also share a prefix.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LintIssue } from '@marco/schema';
import type { ChatMessage, OutlineItem, OutlineRequest } from './types.js';
import { splitDeck, splitNote } from './source.js';
import { formatOutlineItem, parseOutline } from './outline.js';
import { extractMarcoSource } from './extract.js';

export const PROMPT_FILES = {
  rules: '00-규칙.md',
  cheatsheet: '01-컴포넌트-치트시트.md',
  noteGrammar: '02-해설-문법.md',
  style: '03-문체-가이드.md',
  outline: '10-개요.md',
  slides: '20-슬라이드.md',
  notes: '30-해설.md',
  revise: '40-수정.md',
  review: '50-검토.md',
} as const;

export type PromptName = keyof typeof PROMPT_FILES;

/** Kit parts in the order they appear in the system prompt / pasteable kit. */
export const KIT_ORDER: readonly PromptName[] = [
  'rules',
  'cheatsheet',
  'noteGrammar',
  'style',
  'review',
];

/** Task templates, pasted per request after the kit. */
export const TASK_PROMPTS: readonly PromptName[] = ['outline', 'slides', 'notes', 'revise'];

export interface PromptExample {
  file: string;
  /** File content as stored (a valid mini-deck with front matter). */
  source: string;
}

export interface PromptKit {
  dir: string;
  /** Raw file contents, header comments included. */
  files: Record<PromptName, string>;
  examples: PromptExample[];
}

/** Spoken characters per minute the notes template asks for. */
export const DEFAULT_CHARS_PER_MINUTE = 350;
export const KIT_TITLE = 'MARCO 작성 안내';

/** `packages/ai/prompts/`, resolved from both `src/` (tests) and `dist/` (built package). */
export function defaultPromptDir(): string {
  return fileURLToPath(new URL('../prompts/', import.meta.url));
}

const cache = new Map<string, PromptKit>();

/** Read the prompt files. Cached per directory; pass `fresh` to re-read. */
export function loadPromptKit(dir: string = defaultPromptDir(), fresh = false): PromptKit {
  const key = path.resolve(dir);
  const hit = cache.get(key);
  if (hit && !fresh) return hit;
  const files = {} as Record<PromptName, string>;
  for (const [name, file] of Object.entries(PROMPT_FILES) as [PromptName, string][]) {
    files[name] = readFileSync(path.join(key, file), 'utf8').replace(/\r\n?/g, '\n');
  }
  const exampleDir = path.join(key, 'examples');
  const examples = readdirSync(exampleDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => ({ file, source: readFileSync(path.join(exampleDir, file), 'utf8') }));
  const kit: PromptKit = { dir: key, files, examples };
  cache.set(key, kit);
  return kit;
}

/** Remove the leading English `<!-- … -->` header comment. */
export function stripHeader(text: string): string {
  return text.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
}

/** Remove a trailing standalone-only paragraph (text after the last blank line starting "이 목록만"). */
function forKit(text: string): string {
  return stripHeader(text)
    .replace(/\n+이 목록만 따로 받았다면:[^\n]*\n?$/, '\n')
    .trim();
}

/** What the kit shows of an example: the slides, or for the notes example the header + note. */
export function renderExample(example: PromptExample): string {
  const deck = splitDeck(example.source);
  const notesOnly = example.file.includes('해설');
  return deck.slides
    .map((s) => {
      if (!notesOnly) return s.text.trimEnd();
      const { note } = splitNote(s.text);
      return `${s.header}\n\n${(note ?? '').trimEnd()}`;
    })
    .join('\n\n');
}

function exampleCaption(file: string): string {
  const name = file
    .replace(/\.marco\.md$|\.md$/, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' · ');
  return file.includes('해설') ? `${name} (슬라이드 머리 줄과 \`## note\`만 보인다)` : name;
}

/** The examples section of the kit. */
export function renderExamples(kit: PromptKit): string {
  const parts = ['# 예시 (3주차 V20 덱에서 옮긴 슬라이드와 5주차식 해설)'];
  kit.examples.forEach((ex, i) => {
    parts.push(
      `예시 ${i + 1} · ${exampleCaption(ex.file)}\n\n\`\`\`\`marco\n${renderExample(ex)}\n\`\`\`\``,
    );
  });
  return parts.join('\n\n');
}

const systemCache = new WeakMap<PromptKit, string>();

/**
 * The fixed system text: rules, cheat-sheet, note grammar, style guide, self-check, examples.
 * It is also the pasteable kit `MARCO-작성-안내.md`, so chat and API runs see the same text.
 */
export function systemPrompt(kit: PromptKit = loadPromptKit()): string {
  const hit = systemCache.get(kit);
  if (hit !== undefined) return hit;
  const parts = [
    `# ${KIT_TITLE}`,
    '이 안내는 이 대화 전체에 적용된다. 아래 규칙·치트시트·문법·문체를 지켜 MARCO 소스로만 답한다.',
    ...KIT_ORDER.map((name) => forKit(kit.files[name])),
    renderExamples(kit),
  ];
  const text = parts.join('\n\n') + '\n';
  systemCache.set(kit, text);
  return text;
}

/** Kit text without the examples section (what the ~12,000-character budget applies to). */
export function kitWithoutExamples(kit: PromptKit = loadPromptKit()): string {
  const full = systemPrompt(kit);
  const idx = full.indexOf('\n# 예시');
  return idx >= 0 ? full.slice(0, idx + 1) : full;
}

/**
 * Fill `{{키}}` slots. Unknown slots are left alone; empty values become "없음".
 * The header comment is removed: the model does not need it.
 */
export function fillTemplate(template: string, values: Record<string, string | undefined>): string {
  return stripHeader(template)
    .replace(/\{\{([^{}\s]+)\}\}/g, (slot, key: string) =>
      key in values ? values[key]?.trim() || '없음' : slot,
    )
    .trim();
}

function messages(kit: PromptKit, user: string): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(kit) },
    { role: 'user', content: user },
  ];
}

export function buildOutlinePrompt(
  req: OutlineRequest,
  kit: PromptKit = loadPromptKit(),
): ChatMessage[] {
  const user = fillTemplate(kit.files.outline, {
    과목: req.course,
    주차: req.week === undefined ? '' : String(req.week),
    주제: req.topic,
    시간: String(req.duration),
    대상: req.audience,
    요청: req.request,
  });
  return messages(kit, user);
}

export interface SlidesPromptInput {
  /** Outline text (fenced or not). */
  outline: string;
  /** 1-based inclusive range of outline numbers to write. */
  range: [number, number];
  refs?: string;
  request?: string;
}

function rangeLabel([from, to]: [number, number]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return from === to ? `${pad(from)}번` : `${pad(from)}–${pad(to)}번`;
}

export function buildSlidesPrompt(
  input: SlidesPromptInput,
  kit: PromptKit = loadPromptKit(),
): ChatMessage[] {
  const outlineText = extractMarcoSource(input.outline).trim() || input.outline.trim();
  const [from, to] = input.range;
  const picked: OutlineItem[] = parseOutline(outlineText).items.filter(
    (item) => item.no >= from && item.no <= to,
  );
  const range = [
    `${rangeLabel(input.range)} (${picked.length || to - from + 1}장)`,
    ...picked.map(formatOutlineItem),
  ].join('\n');
  const user = fillTemplate(kit.files.slides, {
    개요: outlineText,
    출처: input.refs ?? '없음 — refs 필드를 쓰지 않는다',
    범위: range,
    요청: input.request,
  });
  return messages(kit, user);
}

export interface NotesPromptInput {
  /** The slide (its body; an existing `## note` is dropped). */
  slide: string;
  /** `[시간]` value, e.g. "2.5분 · 10:00 – 12:30". */
  time?: string;
  prevTitle?: string;
  nextTitle?: string;
  charsPerMinute?: number;
  request?: string;
}

export function buildNotesPrompt(
  input: NotesPromptInput,
  kit: PromptKit = loadPromptKit(),
): ChatMessage[] {
  const extra: string[] = [];
  const cpm = input.charsPerMinute ?? DEFAULT_CHARS_PER_MINUTE;
  if (cpm !== DEFAULT_CHARS_PER_MINUTE) extra.push(`분량은 1분에 약 ${cpm}자로 한다.`);
  if (input.request?.trim()) extra.push(input.request.trim());
  const user = fillTemplate(kit.files.notes, {
    앞뒤: [
      `앞: ${input.prevTitle ?? '없음(첫 슬라이드)'}`,
      `뒤: ${input.nextTitle ?? '없음(마지막 슬라이드)'}`,
    ].join('\n'),
    시간: input.time,
    요청: extra.join('\n'),
    슬라이드: splitNote(input.slide).body.trim(),
  });
  return messages(kit, user);
}

/** One line per issue, the same shape `marco lint` prints. */
export function formatLintIssues(issues: LintIssue[]): string {
  return issues
    .map((i) => `- [${i.level}] ${i.code}${i.path ? ` · ${i.path}` : ''} · ${i.message}`)
    .join('\n');
}

export interface RevisePromptInput {
  slide: string;
  request: string;
  lint?: LintIssue[] | string;
}

export function buildRevisePrompt(
  input: RevisePromptInput,
  kit: PromptKit = loadPromptKit(),
): ChatMessage[] {
  const lint = typeof input.lint === 'string' ? input.lint : formatLintIssues(input.lint ?? []);
  const user = fillTemplate(kit.files.revise, {
    요청: input.request,
    린트: lint,
    슬라이드: input.slide.trim(),
  });
  return messages(kit, user);
}

export const REPAIR_REQUEST = '린트 결과의 문제만 고친다. 그 밖의 내용·문체·해설은 그대로 둔다.';

/** Validate-repair loop: send one slide back with only its lint issues. */
export function buildRepairPrompt(
  lintIssues: LintIssue[],
  slideSource: string,
  kit: PromptKit = loadPromptKit(),
): ChatMessage[] {
  return buildRevisePrompt({ slide: slideSource, request: REPAIR_REQUEST, lint: lintIssues }, kit);
}

/** Rough token estimate for Korean-heavy text: characters / 2.5 (varies by tokenizer). */
export function estimateTokens(textOrChars: string | number): number {
  const chars = typeof textOrChars === 'number' ? textOrChars : [...textOrChars].length;
  return Math.ceil(chars / 2.5);
}
