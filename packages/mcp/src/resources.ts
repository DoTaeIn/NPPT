/**
 * Read-only reference material the server hands to an AI: the prompt kit (`@marco/ai`), the
 * format specs (`docs/spec/*.md`) and the Lecture IR JSON Schema (`@marco/schema`).
 *
 * Locations can be overridden for bundled installs: `kitDir` / `MARCO_KIT_DIR` (a folder laid out
 * like `@marco/ai/dist/kit`) and `specDir` / `MARCO_SPEC_DIR` (a folder with `format.md` …).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KIT_FILE,
  PROMPT_FILES,
  loadPromptKit,
  renderExamples,
  stripHeader,
  systemPrompt,
  type PromptKit,
} from '@marco/ai';
import { lectureSchema } from '@marco/schema';

export const SPEC_NAMES = ['format', 'components', 'notes', 'ir', 'runtime'] as const;
export type SpecName = (typeof SPEC_NAMES)[number];

export const SPEC_TITLES: Record<SpecName, string> = {
  format: 'MARCO source format (.marco.md): front matter, slide headers, fields, body, containers',
  components: 'Component catalog: every block, its fields, budgets and HTML',
  notes: 'Presenter note grammar (## note markers, cue ids, focus targets)',
  ir: 'Lecture IR: schema, validation messages, lint codes and the density heuristic',
  runtime: 'Deck runtime contract: document shape, keyboard, print modes, window.MARCO API',
};

export const KIT_SECTIONS = [
  'all',
  'rules',
  'cheatsheet',
  'notes',
  'style',
  'review',
  'examples',
] as const;
export type KitSection = (typeof KIT_SECTIONS)[number];

export interface ResourceLocations {
  /** Folder with `format.md`, `components.md`, … */
  specDir?: string;
  /** Folder laid out like `@marco/ai/dist/kit` (`MARCO-작성-안내.md` + prompt files + examples/). */
  kitDir?: string;
}

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

function specCandidates(explicit?: string): string[] {
  return [
    explicit,
    process.env.MARCO_SPEC_DIR,
    // dist/spec (copied by scripts/copy-spec.mjs at build time; also next to a bundled file)
    here('./spec/'),
    // the monorepo's docs/spec, from packages/mcp/src or packages/mcp/dist
    here('../../../docs/spec/'),
  ].filter((d): d is string => typeof d === 'string' && d !== '');
}

/** The folder holding the spec Markdown files, or undefined when none is found. */
export function specDir(explicit?: string): string | undefined {
  return specCandidates(explicit).find((d) => existsSync(join(d, 'format.md')));
}

export function readSpec(name: SpecName, explicit?: string): string {
  const dir = specDir(explicit);
  if (!dir) {
    throw new Error(
      `MARCO spec files not found (looked in ${specCandidates(explicit).join(', ')}). Set MARCO_SPEC_DIR to a folder containing ${SPEC_NAMES.map((n) => `${n}.md`).join(', ')}.`,
    );
  }
  return readFileSync(join(dir, `${name}.md`), 'utf8');
}

/** `@marco/ai/dist/kit`, when the package resolves and the kit was built. */
function aiDistKit(): string | undefined {
  try {
    const pkg = createRequire(import.meta.url).resolve('@marco/ai/package.json');
    return join(dirname(pkg), 'dist', 'kit');
  } catch {
    return undefined;
  }
}

function kitCandidates(explicit?: string): string[] {
  return [explicit, process.env.MARCO_KIT_DIR, aiDistKit()].filter(
    (d): d is string => typeof d === 'string' && d !== '',
  );
}

/** A folder with every prompt file of the kit (the built `dist/kit` has the same layout as `prompts/`). */
function kitDir(explicit?: string): string | undefined {
  return kitCandidates(explicit).find((d) =>
    Object.values(PROMPT_FILES).every((f) => existsSync(join(d, f))),
  );
}

/** The prompt kit: from the built kit folder, else from `@marco/ai`'s own prompt sources. */
export function loadKit(explicit?: string): PromptKit {
  const dir = kitDir(explicit);
  try {
    return dir ? loadPromptKit(dir) : loadPromptKit();
  } catch (e) {
    throw new Error(
      `MARCO prompt kit not found (${(e as Error).message}). Build it with \`pnpm --filter @marco/ai build\` or set MARCO_KIT_DIR to a folder like @marco/ai/dist/kit.`,
      { cause: e },
    );
  }
}

/**
 * The whole pasteable kit `MARCO-작성-안내.md`. Read from the built kit when present; otherwise
 * rendered in memory from the prompt sources (the same text `buildKit()` writes), so the server
 * never writes into the engine's own folders.
 */
export function kitText(explicit?: string): string {
  const dir = kitDir(explicit);
  if (dir && existsSync(join(dir, KIT_FILE))) return readFileSync(join(dir, KIT_FILE), 'utf8');
  return systemPrompt(loadKit(explicit));
}

/** Same trimming the kit applies to each part (header comment, standalone-only tail). */
function part(text: string): string {
  return (
    stripHeader(text)
      .replace(/\n+이 목록만 따로 받았다면:[^\n]*\n?$/, '\n')
      .trim() + '\n'
  );
}

/** One section of the kit (`all` = the whole kit). */
export function kitSection(section: KitSection, explicit?: string): string {
  if (section === 'all') return kitText(explicit);
  const kit = loadKit(explicit);
  switch (section) {
    case 'rules':
      return part(kit.files.rules);
    case 'cheatsheet':
      return part(kit.files.cheatsheet);
    case 'notes':
      return part(kit.files.noteGrammar);
    case 'style':
      return part(kit.files.style);
    case 'review':
      return part(kit.files.review);
    case 'examples':
      return renderExamples(kit) + '\n';
  }
}

/** `lecture.schema.json` (the object `@marco/schema` validates with), pretty-printed. */
export function schemaText(): string {
  return JSON.stringify(lectureSchema, null, 2) + '\n';
}

/**
 * Read by the AI before the kit when it works through MCP: the kit was written for chat windows,
 * so two of its rules change and the tool loop replaces copy-paste.
 */
export const MCP_KIT_PREFACE = `# MCP로 작업할 때 (아래 안내보다 우선)

- 아래 규칙 2(답 전체를 코드 펜스 하나에)와 10("준비됨")은 채팅 창용이다. 도구를 쓸 때는 원고를 marco_build의 source_text로 넘기고(파일로 저장하려면 source_path도 함께), 한 장만 고칠 때는 marco_replace_slide를 쓴다.
- 원고를 쓰거나 고친 뒤에는 marco_build(또는 marco_lint)를 호출한다. 결과의 error·warn은 슬라이드별 repair_hint대로 그 슬라이드만 고쳐 다시 빌드한다. error와 budget·dense·ragged 경고가 없어질 때까지, 최대 3회 반복한다.
- info(content.todo, ref.unused, term.unused, time.total)는 작성자(교수)가 확인할 몫이다. 사실·출처·URL을 지어내지 말고 사용자에게 알린다.
- 한 장만 빠르게 확인할 때는 marco_check_slide, 형식 세부는 marco_spec(name="format" | "components" | "notes").
`;
