/**
 * The MARCO MCP server: the engine's authoring tools (scaffold, build, lint, check a slide, import,
 * preview, read/replace a slide), the prompt kit and specs as tools and resources, and the
 * `@marco/ai` task prompts. Every path is confined to the server root (see paths.ts).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  type ChatMessage,
  buildNotesPrompt,
  buildOutlinePrompt,
  buildRevisePrompt,
  buildSlidesPrompt,
  findSlide,
  joinDeck,
  splitDeck,
} from '@marco/ai';
import {
  ENGINE_VERSION,
  FONT_MODES,
  checkSource,
  compile,
  lintIcons,
  parseMarco,
  type CompileOptions,
  type Diagnostic,
  type Edition,
  type Lecture,
  type LintIssue,
  type ThemeId,
} from '@marco/compiler';
import { CONFIG_FILE, loadImportConfig, runImport, type ImportConfig } from '@marco/importer';
import { DENSITY, availableBodyHeight, stackHeight } from '@marco/schema';
import {
  PathError,
  Sandbox,
  WORK_DIR,
  defaultOutFile,
  expandHome,
  hasExt,
  isDir,
  isFile,
} from './paths.js';
import { screenshotSlide } from './preview.js';
import {
  countLevels,
  countsText,
  diagnosticsText,
  groupLint,
  lintText,
  nextStep,
  shapeDiagnostics,
  type DiagnosticOut,
  type SlideIssues,
} from './report.js';
import {
  KIT_SECTIONS,
  MCP_KIT_PREFACE,
  SPEC_NAMES,
  SPEC_TITLES,
  kitSection,
  kitText,
  loadKit,
  readSpec,
  schemaText,
  type ResourceLocations,
  type SpecName,
} from './resources.js';
import { ASSETS_README, LECTURE_TEMPLATE } from './template.js';

export const SERVER_NAME = 'marco';

/** Largest `source_text` / `slide_source` accepted (UTF-8 bytes). */
export const MAX_TEXT_BYTES = 2 * 1024 * 1024;
/** Largest preview image returned inline (the PNG is always written to disk). */
export const MAX_INLINE_IMAGE_BYTES = 1024 * 1024;
/** Staged `source_text` builds kept in `.marco/mcp/`. */
export const STAGED_KEEP = 20;

const THEMES = ['v20-violet', 'cau-navy'] as const satisfies readonly ThemeId[];
const EDITIONS = ['student', 'instructor'] as const satisfies readonly Edition[];
const FONTS = FONT_MODES as unknown as readonly ['embed', 'subset', 'none'];
const READABLE_EXT = ['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.csv'];

export interface MarcoServerOptions extends ResourceLocations {
  /** Folder the tools may read and write; default: `cwd`. `~` is expanded. */
  root?: string;
  /** Base for a relative `root`; default `process.cwd()`. */
  cwd?: string;
  /** Let tools write files under the root (default true; `--read-only` sets false). */
  allowWrite?: boolean;
  /** Advanced/testing: extra options for every `compile()` call. */
  compileOptions?: Omit<CompileOptions, 'outFile' | 'edition' | 'theme' | 'fonts'>;
}

// ---------------------------------------------------------------------------------------------
// zod shapes shared by several tools
// ---------------------------------------------------------------------------------------------

const cappedText = (what: string) =>
  z
    .string()
    .max(MAX_TEXT_BYTES)
    .refine(
      (s) => Buffer.byteLength(s, 'utf8') <= MAX_TEXT_BYTES,
      `${what} is larger than 2 MB (UTF-8); split the deck or pass source_path instead.`,
    );

const level = z.enum(['error', 'warn', 'info']);
const diagnosticOut = z.object({
  level,
  code: z.string(),
  message: z.string(),
  line: z.number().int().optional(),
  slide: z.string().optional(),
  repair_hint: z.string(),
});
const issueOut = z.object({
  level,
  code: z.string(),
  message: z.string(),
  path: z.string(),
  line: z.number().int().optional(),
  repair_hint: z.string(),
  for_author: z.boolean().optional(),
});
const slideIssues = z.object({
  slide: z.string().nullable(),
  index: z.number().int().optional(),
  title: z.string().optional(),
  line: z.number().int().optional(),
  issues: z.array(issueOut),
});
const counts = z.object({
  errors: z.number().int(),
  warnings: z.number().int(),
  infos: z.number().int(),
});
const slideRef = z
  .union([z.number().int().min(1), z.string().min(1)])
  .describe('1-based slide number, or a slide id (s-04, or the id= name from the header)');

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

const toolResult = (text: string, data: object): CallToolResult => ({
  content: [{ type: 'text', text }],
  structuredContent: data as Record<string, unknown>,
});

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const REMOTE = /^[a-z][a-z0-9+.-]*:/i;
const DRIVE = /^[a-z]:[\\/]/i;

/** Remove old staged builds (`.marco/mcp/<hash>.marco.md` + `.html`), newest {@link STAGED_KEEP} kept. */
function pruneStaged(dir: string): void {
  try {
    const staged = readdirSync(dir)
      .filter((f) => /^[0-9a-f]{12}\.marco\.md$/.test(f))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of staged.slice(STAGED_KEEP)) {
      rmSync(join(dir, f), { force: true });
      rmSync(join(dir, f.replace(/\.marco\.md$/, '.html')), { force: true });
    }
  } catch {
    /* best effort */
  }
}

function parseRange(text: string): [number, number] {
  const m = /^\s*(\d+)\s*(?:[-–~]\s*(\d+))?\s*$/.exec(text);
  if (!m) throw new Error(`range must look like "7-12" or "7" (got "${text}")`);
  const from = Number(m[1]);
  const to = m[2] !== undefined ? Number(m[2]) : from;
  if (from < 1 || to < from) throw new Error(`invalid range "${text}"`);
  return [from, to];
}

/** Front matter text → `---` … `---` block with a trailing newline. */
function frontMatterBlock(text: string): string {
  const body = text.replace(/\r\n?/g, '\n').trim();
  if (body.startsWith('---')) return body.endsWith('---') ? `${body}\n` : `${body}\n---\n`;
  return `---\n${body}\n---\n`;
}

const newlineCount = (s: string): number => (s.match(/\n/g) ?? []).length;

// ---------------------------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------------------------

function prepareRoot(options: MarcoServerOptions): Sandbox {
  const cwd = options.cwd ?? process.cwd();
  const root = resolve(cwd, expandHome(options.root ?? cwd));
  const allowWrite = options.allowWrite !== false;
  if (!isDir(root)) {
    if (isFile(root)) throw new Error(`--root ${root} is a file, not a folder.`);
    if (!allowWrite) throw new Error(`--root ${root} does not exist.`);
    mkdirSync(root, { recursive: true });
  }
  return new Sandbox(root, allowWrite);
}

function instructions(sandbox: Sandbox): string {
  return [
    'MARCO Engine turns compact Markdown lecture sources (.marco.md) into single-file 1920×1080 HTML decks with the engine (navigation, notes, print) built in. Never write slide HTML or CSS: write MARCO source and let these tools build it.',
    'Workflow: 1) marco_kit once per conversation to learn the format, components and character budgets (Korean). 2) marco_new to scaffold a lecture folder, marco_read to open an existing deck, or marco_import to convert a legacy HTML deck. 3) Write the source and save+build it with marco_build { source_path, source_text }. 4) Repair loop: fix only the error/warn issues of the slides listed in the result, following each repair_hint (marco_replace_slide edits one slide; marco_check_slide tests one slide), rebuild, at most 3 rounds. 5) Give the user out_path and list the info items (TODO:, unused refs, time total) for them to check; never invent facts, URLs or citations.',
    `All paths are relative to the server root ${sandbox.root}${sandbox.allowWrite ? '' : ' (read-only: nothing can be written)'}. Temporary builds and backups live in ${WORK_DIR}/.`,
  ].join('\n');
}

/** Create the MCP server (not yet connected to a transport). */
export function createMarcoServer(options: MarcoServerOptions = {}): {
  server: McpServer;
  sandbox: Sandbox;
} {
  const sandbox = prepareRoot(options);
  const locations: ResourceLocations = {};
  if (options.specDir) locations.specDir = options.specDir;
  if (options.kitDir) locations.kitDir = options.kitDir;
  const server = new McpServer(
    { name: SERVER_NAME, title: 'MARCO Engine', version: ENGINE_VERSION },
    { instructions: instructions(sandbox) },
  );

  // ----- shared operations -------------------------------------------------------------------

  /** Refuse sources whose sidecar JSON or image paths point outside the root. */
  function outsideRoot(text: string, baseDir: string): Diagnostic[] {
    const parsed = parseMarco(text);
    const found: Diagnostic[] = [];
    const check = (path: string, what: string, line?: number): void => {
      if (REMOTE.test(path) && !DRIVE.test(path)) return; // remote: the compiler reports it
      const abs = isAbsolute(path) ? path : resolve(baseDir, path);
      if (!sandbox.inside(abs)) {
        found.push({
          level: 'error',
          code: 'mcp.path.outside',
          message: `${what} "${path}" is outside the server root (${sandbox.root}); the server does not read it.`,
          ...(line !== undefined ? { line } : {}),
        });
      }
    };
    for (const ref of parsed.sidecars) check(ref.path, ref.key, ref.line);
    for (const [id, asset] of Object.entries(parsed.lecture.assets ?? {})) {
      if (typeof asset?.path === 'string') check(asset.path, `asset ${id}`);
    }
    return found;
  }

  interface Checked {
    ok: boolean;
    lecture?: Lecture;
    diagnostics: DiagnosticOut[];
    lint: SlideIssues[];
    counts: ReturnType<typeof countLevels>;
    slides: number;
  }

  /** checkSource + lintIcons, shaped for tool results. */
  function check(
    text: string,
    baseDir: string,
    opts: { lineOffset?: number; drop?: (l: LintIssue) => boolean } = {},
  ): Checked {
    const blocked = outsideRoot(text, baseDir);
    if (blocked.length) {
      const diagnostics = shapeDiagnostics(blocked, opts.lineOffset);
      return {
        ok: false,
        diagnostics,
        lint: [],
        counts: countLevels(diagnostics, []),
        slides: 0,
      };
    }
    const checked = checkSource(text, { baseDir });
    let lint = [...checked.lint, ...lintIcons(checked.lecture)];
    if (opts.drop) lint = lint.filter((l) => !opts.drop!(l));
    const diagnostics = shapeDiagnostics(checked.diagnostics, opts.lineOffset);
    const groups = groupLint(lint, checked.lecture, checked.slideLines, opts.lineOffset);
    const c = countLevels(diagnostics, groups);
    return {
      ok: c.errors === 0,
      lecture: checked.lecture,
      diagnostics,
      lint: groups,
      counts: c,
      slides: checked.lecture.slides.length,
    };
  }

  /** Save `text` to `path` (backing up different existing content). Returns the backup path. */
  function save(path: string, text: string): string | undefined {
    let backup: string | undefined;
    if (isFile(path)) {
      const old = readFileSync(path, 'utf8');
      if (old === text) return undefined;
      backup = sandbox.backup(path, old);
    }
    sandbox.write(path, text);
    return backup;
  }

  /** Stage `text` at `.marco/mcp/<hash>.marco.md`. */
  function stage(text: string): string {
    sandbox.assertWritable();
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
    const file = sandbox.work(`${hash}.marco.md`);
    if (!isFile(file) || readFileSync(file, 'utf8') !== text) sandbox.write(file, text);
    pruneStaged(dirname(file));
    return file;
  }

  /** Read a source file under the root (must exist, be text and at most 2 MB). */
  function readSource(input: string, label: string): { path: string; text: string } {
    const path = sandbox.resolve(input, label);
    if (!isFile(path)) {
      throw new PathError(
        `${label} "${input}" not found under ${sandbox.root}. Create a deck with marco_new, or pass source_text.`,
      );
    }
    if (!hasExt(path, '.md')) throw new PathError(`${label} must be a .marco.md file.`);
    if (statSync(path).size > MAX_TEXT_BYTES) {
      throw new PathError(`${label} is larger than 2 MB.`);
    }
    return { path, text: readFileSync(path, 'utf8') };
  }

  const shown = (path: string): string => sandbox.rel(path);

  // ----- tools: learning the format ----------------------------------------------------------

  server.registerTool(
    'marco_kit',
    {
      title: 'MARCO authoring kit',
      description:
        'START HERE before writing or revising any MARCO source. Returns the authoring kit (Korean): rules, component cheat-sheet with every block and its character budgets, presenter-note grammar, style guide, self-check list and example slides, plus how to use it through these tools. Read section "all" (~25k characters) once per conversation; later fetch one section (e.g. "cheatsheet") as a reminder. Answer with MARCO source, never HTML.',
      inputSchema: {
        section: z
          .enum(KIT_SECTIONS)
          .optional()
          .describe(
            'all (default) | rules | cheatsheet (blocks + budgets) | notes (## note grammar) | style | review (self-check mapped to lint codes) | examples',
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ section }) => {
      const which = section ?? 'all';
      const text = kitSection(which, locations.kitDir);
      return {
        content: [
          {
            type: 'text',
            text: which === 'all' || which === 'rules' ? `${MCP_KIT_PREFACE}\n${text}` : text,
          },
        ],
      };
    },
  );

  server.registerTool(
    'marco_spec',
    {
      title: 'MARCO specification',
      description:
        'Returns one specification document (English Markdown). format: .marco.md syntax (front matter keys, slide header, fields, body, containers); components: every block with fields, budgets and HTML; notes: the ## note grammar; ir: Lecture IR, validation messages, every lint code and the slide-density heuristic; runtime: the deck runtime. Use it when the kit is not specific enough, e.g. to resolve a format.* or schema.* diagnostic.',
      inputSchema: {
        name: z.enum(SPEC_NAMES).describe('format | components | notes | ir | runtime'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ name }) => ({ content: [{ type: 'text', text: readSpec(name, locations.specDir) }] }),
  );

  // ----- tools: decks ------------------------------------------------------------------------

  server.registerTool(
    'marco_new',
    {
      title: 'Scaffold a lecture deck',
      description:
        'Create a new lecture folder under the server root: <dir>/lecture.marco.md (a valid 4-slide starter deck with the front matter filled in) and <dir>/assets/ for images. Never overwrites: fails when lecture.marco.md already exists. Returns the paths and the starter source. Next: replace the sample slides with real content (see marco_kit) and save+build with marco_build { source_path, source_text }.',
      inputSchema: {
        dir: z.string().describe('Folder to create, relative to the root, e.g. "week06"'),
        title: z.string().min(1).describe('Deck title, e.g. "6주차 · 침입 탐지와 차단 (IDS/IPS)"'),
        course: z.string().optional().describe('Course name (front matter course)'),
        week: z
          .union([z.number().int().min(0), z.string().regex(/^\d+$/)])
          .optional()
          .describe('Week number (default 1)'),
        theme: z.enum(THEMES).optional().describe('Visual theme (default v20-violet)'),
        presenter: z.string().optional().describe('Presenter shown on the cover'),
        duration: z
          .number()
          .int()
          .min(1)
          .max(600)
          .optional()
          .describe('Lecture length in minutes (front matter duration; default 20)'),
      },
      outputSchema: {
        dir: z.string(),
        source_path: z.string(),
        created: z.array(z.string()),
        source_text: z.string(),
        next_step: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ dir, title, course, week, theme, presenter, duration }) => {
      const target = sandbox.writable(dir, 'dir', 'dir');
      if (isFile(target)) throw new PathError(`dir "${dir}" is a file, not a folder.`);
      const file = join(target, 'lecture.marco.md');
      if (isFile(file)) {
        throw new PathError(
          `${shown(file)} already exists; marco_new never overwrites. Open it with marco_read, or save new content with marco_build { source_path, source_text } (the old file is backed up).`,
        );
      }
      const values: Record<string, string> = {
        // JSON strings are valid YAML double-quoted scalars, so any title is safe.
        title: JSON.stringify(title),
        course: JSON.stringify(course ?? '과목명'),
        week: String(week ?? '1'),
        theme: theme ?? 'v20-violet',
        date: new Date().toISOString().slice(0, 10),
      };
      let text = LECTURE_TEMPLATE.replace(
        /\{\{(title|course|week|theme|date)\}\}/g,
        (whole, key: string) => values[key] ?? whole,
      );
      if (presenter !== undefined) {
        text = text.replace(/^presenter: .*$/m, `presenter: ${JSON.stringify(presenter)}`);
      }
      if (duration !== undefined) text = text.replace(/^duration: .*$/m, `duration: ${duration}`);
      const created: string[] = [];
      sandbox.write(file, text);
      created.push(file);
      const readme = join(target, 'assets', 'README.md');
      if (!isFile(readme)) {
        sandbox.write(readme, ASSETS_README);
        created.push(readme);
      }
      const next = `Replace the sample slides with the lecture content (marco_kit has the format), then call marco_build { source_path: "${shown(file)}", source_text }. Put images in ${shown(join(target, 'assets'))}/ and reference them as assets/<file>.`;
      return toolResult(
        [
          `Created ${shown(file)} (starter deck, 4 slides) and ${shown(join(target, 'assets'))}/.`,
          `Full path: ${file}`,
          `Next: ${next}`,
          '',
          '```marco',
          text.trimEnd(),
          '```',
        ].join('\n'),
        { dir: target, source_path: file, created, source_text: text, next_step: next },
      );
    },
  );

  server.registerTool(
    'marco_build',
    {
      title: 'Build a deck',
      description:
        'Compile MARCO source into a single-file 1920×1080 HTML deck and report every problem. Give source_path (a .marco.md under the root) to build that file; give source_text to build text: together with source_path the text is first SAVED there (the old file is backed up to .marco/mcp/backups/), alone it is staged at <root>/.marco/mcp/<hash>.marco.md, so relative image paths resolve from that folder (decks with images must be saved in their own folder via source_path). out_path defaults to the source name with .html. Result: ok (false when format/schema errors stopped the build, or strict and lint errors), out_path, size_bytes, slides, diagnostics (errors with line numbers; they stop the build), lint grouped by slide (budget overflows, refs, assets, notes, time) each with a Korean repair_hint, warnings (asset/font/icon/build), stats and next_step. Repair loop: fix the error/warn issues of the listed slides following each hint, rebuild, stop when clean or after 3 rounds; tell the user about info items instead of inventing facts; give the user out_path.',
      inputSchema: {
        source_path: z
          .string()
          .optional()
          .describe('.marco.md under the root; with source_text, where to save the text'),
        source_text: cappedText('source_text')
          .optional()
          .describe('Whole MARCO source (front matter + slides), at most 2 MB'),
        out_path: z.string().optional().describe('Output .html under the root'),
        edition: z
          .enum(EDITIONS)
          .optional()
          .describe('Overrides front matter edition (student hides presenter notes)'),
        theme: z.enum(THEMES).optional().describe('Overrides front matter theme'),
        fonts: z
          .enum(FONTS)
          .optional()
          .describe(
            'subset (default: only the characters used) | embed (all) | none (system fonts)',
          ),
        strict: z.boolean().optional().describe('ok=false when lint reports errors'),
      },
      outputSchema: {
        ok: z.boolean(),
        source_path: z.string(),
        staged: z.boolean(),
        saved: z.boolean(),
        backup: z.string().optional(),
        out_path: z.string().nullable(),
        size_bytes: z.number().int(),
        slides: z.number().int(),
        edition: z.string().optional(),
        theme: z.string().optional(),
        diagnostics: z.array(diagnosticOut),
        lint: z.array(slideIssues),
        warnings: z.array(diagnosticOut),
        stats: z.object({
          slides: z.number().int(),
          bytes: z.number().int(),
          fonts: z.string().optional(),
          runtime: z.string().optional(),
          errors: z.number().int(),
          warnings: z.number().int(),
          infos: z.number().int(),
        }),
        strict_failed: z.boolean().optional(),
        next_step: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ source_path, source_text, out_path, edition, theme, fonts, strict }) => {
      if (source_path === undefined && source_text === undefined) {
        throw new Error(
          'Pass source_path (a .marco.md under the root), source_text (MARCO source), or both (save, then build).',
        );
      }
      let source: string;
      let text: string;
      let staged = false;
      let saved = false;
      let backup: string | undefined;
      if (source_text !== undefined) {
        text = source_text;
        if (source_path !== undefined) {
          source = sandbox.writable(source_path, 'source_path', 'source');
          backup = save(source, text);
          saved = true;
        } else {
          source = stage(text);
          staged = true;
        }
      } else {
        ({ path: source, text } = readSource(source_path!, 'source_path'));
      }
      const outFile = out_path
        ? sandbox.writable(out_path, 'out_path', 'html')
        : sandbox.allowWrite
          ? defaultOutFile(source)
          : undefined;

      const blocked = outsideRoot(text, dirname(source));
      if (blocked.length) {
        const diagnostics = shapeDiagnostics(blocked);
        const data = {
          ok: false,
          source_path: source,
          staged,
          saved,
          ...(backup ? { backup } : {}),
          out_path: null,
          size_bytes: 0,
          slides: 0,
          diagnostics,
          lint: [],
          warnings: [],
          stats: { slides: 0, bytes: 0, ...countLevels(diagnostics, []) },
          next_step: 'Move the files into the root and reference them with relative paths.',
        };
        return toolResult(
          ['✗ Build refused.', ...diagnosticsText('Diagnostics:', diagnostics)].join('\n'),
          data,
        );
      }

      if (outFile) mkdirSync(dirname(outFile), { recursive: true });
      const result = await compile(source, {
        ...options.compileOptions,
        ...(outFile ? { outFile } : {}),
        ...(edition ? { edition } : {}),
        ...(theme ? { theme } : {}),
        ...(fonts ? { fonts } : {}),
      });
      const diagnostics = shapeDiagnostics(result.diagnostics);
      const lint = groupLint(result.lint, result.lecture, result.slideLines);
      const warnings = shapeDiagnostics(result.warnings);
      const c = countLevels([...diagnostics, ...warnings], lint);
      const lintErrors = result.lint.filter((l) => l.level === 'error').length;
      const strictFailed = strict === true && lintErrors > 0;
      const ok = result.ok && !strictFailed;
      const written = result.ok && result.outFile !== undefined;
      const next = nextStep(diagnostics, lint);
      const data = {
        ok,
        source_path: source,
        staged,
        saved,
        ...(backup ? { backup } : {}),
        out_path: written ? result.outFile! : null,
        size_bytes: result.stats.bytes,
        slides: result.stats.slides,
        edition: result.lecture.meta.edition,
        theme: result.lecture.meta.theme,
        diagnostics,
        lint,
        warnings,
        stats: {
          slides: result.stats.slides,
          bytes: result.stats.bytes,
          ...(result.stats.fonts ? { fonts: result.stats.fonts } : {}),
          ...(result.stats.runtime ? { runtime: result.stats.runtime } : {}),
          ...c,
        },
        ...(strictFailed ? { strict_failed: true } : {}),
        next_step: next,
      };
      const head = result.ok
        ? written
          ? `✓ Built ${shown(result.outFile!)} (${formatBytes(result.stats.bytes)}, ${result.stats.slides} slides, ${result.lecture.meta.edition} edition, theme ${result.lecture.meta.theme}, fonts ${result.stats.fonts ?? '-'})${strictFailed ? ` — strict: ${lintErrors} lint error(s), ok=false` : ''}`
          : `✓ Compiled (read-only server: HTML not written; ${formatBytes(result.stats.bytes)}, ${result.stats.slides} slides)`
        : `✗ Build stopped by ${diagnostics.filter((d) => d.level === 'error').length} error(s) in the source; no HTML written.`;
      const lines = [
        head,
        `Source: ${shown(source)}${staged ? ' (staged from source_text)' : saved ? ' (saved from source_text)' : ''}${backup ? `; previous version backed up to ${shown(backup)}` : ''}`,
        ...(written ? [`Full path: ${result.outFile}`] : []),
        `Issues: ${countsText(c)}`,
        ...diagnosticsText('Diagnostics (fix these first):', diagnostics),
        ...lintText(lint),
        ...diagnosticsText('Build warnings:', warnings),
        `Next: ${next}`,
      ];
      return toolResult(lines.join('\n'), data);
    },
  );

  const checkedOutput = {
    ok: z.boolean(),
    source_path: z.string().nullable(),
    slides: z.number().int(),
    diagnostics: z.array(diagnosticOut),
    lint: z.array(slideIssues),
    counts,
    next_step: z.string(),
  };

  server.registerTool(
    'marco_lint',
    {
      title: 'Check a deck (no build)',
      description:
        'Check MARCO source without rendering (fast; writes nothing): parse errors (format.*, with line), schema errors and lint (character budgets, slide density, refs, assets, notes, time) grouped by slide, each with a Korean repair_hint. Same checks as marco_build; use it while iterating on text, then marco_build for the file. ok=false means errors (they would stop the build or are broken references).',
      inputSchema: {
        source_path: z.string().optional().describe('.marco.md under the root'),
        source_text: cappedText('source_text')
          .optional()
          .describe(
            'MARCO source to check instead of a file (sidecar paths resolve from .marco/mcp/)',
          ),
      },
      outputSchema: checkedOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ source_path, source_text }) => {
      let text: string;
      let baseDir: string;
      let source: string | null = null;
      if (source_text !== undefined) {
        text = source_text;
        baseDir = source_path
          ? dirname(sandbox.resolve(source_path, 'source_path'))
          : sandbox.work();
      } else if (source_path !== undefined) {
        const read = readSource(source_path, 'source_path');
        text = read.text;
        source = read.path;
        baseDir = dirname(read.path);
      } else {
        throw new Error('Pass source_path (a .marco.md under the root) or source_text.');
      }
      const r = check(text, baseDir);
      const next = nextStep(r.diagnostics, r.lint, 'marco_lint (or marco_build)');
      const lines = [
        `${r.ok ? '✓' : '✗'} ${source ? shown(source) : 'source_text'}: ${r.slides} slides · ${countsText(r.counts)}`,
        ...diagnosticsText('Diagnostics (fix these first):', r.diagnostics),
        ...lintText(r.lint),
        `Next: ${next}`,
      ];
      return toolResult(lines.join('\n'), {
        ok: r.ok,
        source_path: source,
        slides: r.slides,
        diagnostics: r.diagnostics,
        lint: r.lint,
        counts: r.counts,
        next_step: next,
      });
    },
  );

  server.registerTool(
    'marco_check_slide',
    {
      title: 'Check one slide',
      description:
        'Validate a single slide cheaply before putting it into a deck. Pass one "# slide …" block (header line, fields, body, optional ## note); it is wrapped in a minimal deck, or in your front_matter (needed to check refs/assets/videos ids, which are skipped otherwise), and checked. Returns diagnostics with lines relative to slide_source, lint issues with repair_hint, and the body-height estimate (estimate_px vs available_px; over ~110% triggers budget.slide.dense). Several "# slide" blocks are checked together.',
      inputSchema: {
        slide_source: cappedText('slide_source').describe(
          'One "# slide …" block; a missing header line is added',
        ),
        front_matter: z
          .string()
          .max(256 * 1024)
          .optional()
          .describe("The deck's front matter YAML (with or without the --- lines)"),
      },
      outputSchema: {
        ok: z.boolean(),
        slides: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            title: z.string().optional(),
            line: z.number().int().optional(),
            density: z
              .object({
                estimate_px: z.number(),
                available_px: z.number(),
                percent: z.number(),
              })
              .optional(),
          }),
        ),
        diagnostics: z.array(diagnosticOut),
        lint: z.array(slideIssues),
        skipped: z.array(z.string()),
        counts,
        next_step: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ slide_source, front_matter }) => {
      const fm = front_matter?.trim()
        ? frontMatterBlock(front_matter)
        : '---\ntitle: 슬라이드 검사\n---\n';
      let body = slide_source.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '');
      let offset = newlineCount(fm) + 1;
      if (!/^# slide(?:\s|$)/m.test(body)) {
        body = `# slide\n${body}`;
        offset += 1;
      }
      const skipped = ['ref.unused', 'term.unused', 'time.total'];
      if (!front_matter?.trim()) skipped.push('ref.missing', 'asset.missing', 'video.missing');
      const r = check(`${fm}\n${body}`, sandbox.root, {
        lineOffset: offset,
        drop: (l) => skipped.includes(l.code),
      });
      const slides = (r.lecture?.slides ?? []).map((s) => {
        const entry: {
          id: string;
          type: string;
          title?: string;
          line?: number;
          density?: { estimate_px: number; available_px: number; percent: number };
        } = { id: s.id, type: s.type };
        if (s.title) entry.title = s.title;
        const group = r.lint.find((g) => g.slide === s.id);
        if (group?.line !== undefined) entry.line = group.line;
        if ((DENSITY.slideTypes as readonly string[]).includes(s.type)) {
          const estimate = stackHeight(s.blocks ?? []);
          const available = availableBodyHeight(s);
          entry.density = {
            estimate_px: estimate,
            available_px: available,
            percent: Math.round((estimate / available) * 100),
          };
        }
        return entry;
      });
      const next =
        r.counts.errors || r.lint.some((g) => g.issues.some((i) => i.level === 'warn'))
          ? 'Fix the issues following each hint and call marco_check_slide again, then put the slide into the deck (marco_replace_slide or marco_build).'
          : 'The slide is clean: put it into the deck (marco_replace_slide or marco_build).';
      const lines = [
        `${r.ok ? '✓' : '✗'} ${slides.map((s) => `${s.id} (${s.type})`).join(', ') || 'no slide'} · ${countsText(r.counts)}`,
        ...slides
          .filter((s) => s.density)
          .map(
            (s) =>
              `  ${s.id} body height estimate ${s.density!.estimate_px}px of ${s.density!.available_px}px (${s.density!.percent}%)`,
          ),
        ...diagnosticsText('Diagnostics (lines are relative to slide_source):', r.diagnostics),
        ...lintText(r.lint),
        `Not checked: ${skipped.join(', ')}${front_matter?.trim() ? '' : ' (pass front_matter to check ids)'}`,
        `Next: ${next}`,
      ];
      return toolResult(lines.join('\n'), {
        ok: r.ok,
        slides,
        diagnostics: r.diagnostics,
        lint: r.lint,
        skipped,
        counts: r.counts,
        next_step: next,
      });
    },
  );

  server.registerTool(
    'marco_read',
    {
      title: 'Read a source file or one slide',
      description:
        'Read a MARCO source (or another text file: .md .txt .json .yaml .csv) under the root: the whole file, or one slide block by number or id. Use it to open an existing deck before revising it when you have no file-system tool of your own.',
      inputSchema: {
        path: z.string().describe('File under the root, e.g. "week06/lecture.marco.md"'),
        slide: slideRef.optional(),
      },
      outputSchema: {
        path: z.string(),
        text: z.string(),
        slides: z.number().int(),
        slide: z
          .object({ number: z.number().int(), id: z.string(), line: z.number().int() })
          .optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ path, slide }) => {
      const file = sandbox.resolve(path, 'path');
      if (!isFile(file)) throw new PathError(`path "${path}" not found under ${sandbox.root}.`);
      if (!hasExt(file, ...READABLE_EXT)) {
        throw new PathError(
          `marco_read only reads text sources (${READABLE_EXT.join(' ')}); built .html decks are not meant to be read back.`,
        );
      }
      if (statSync(file).size > MAX_TEXT_BYTES) throw new PathError(`path is larger than 2 MB.`);
      const text = readFileSync(file, 'utf8');
      const parts = splitDeck(text);
      if (slide === undefined) {
        return toolResult(`${shown(file)} (${parts.slides.length} slides)\n\n${text}`, {
          path: file,
          text,
          slides: parts.slides.length,
        });
      }
      const chunk = findSlide(parts, slide);
      if (!chunk) {
        throw new Error(
          `slide ${String(slide)} not found in ${shown(file)} (${parts.slides.length} slides).`,
        );
      }
      const line = parseMarco(text).slideLines[chunk.position - 1] ?? 1;
      return toolResult(
        `${shown(file)} · slide ${chunk.position} (${chunk.id}) · line ${line}\n\n${chunk.text}`,
        {
          path: file,
          text: chunk.text,
          slides: parts.slides.length,
          slide: { number: chunk.position, id: chunk.id, line },
        },
      );
    },
  );

  server.registerTool(
    'marco_replace_slide',
    {
      title: 'Replace one slide in a deck',
      description:
        'Replace one slide of a .marco.md in place with slide_source: one "# slide …" block, or several to split an overfull slide (a slide_source without a header line keeps the original header, so its id and type stay). The old file is backed up to .marco/mcp/backups/. Returns lint for the whole deck grouped by slide (with repair_hint), so the repair loop continues without resending the deck; call marco_build afterwards for the HTML.',
      inputSchema: {
        source_path: z.string().describe('.marco.md under the root'),
        slide: slideRef,
        slide_source: cappedText('slide_source').describe(
          'The new slide text (fields, body and optional ## note)',
        ),
      },
      outputSchema: {
        ...checkedOutput,
        source_path: z.string(),
        backup: z.string().optional(),
        replaced: z.object({ number: z.number().int(), id: z.string() }),
        inserted: z.number().int(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    ({ source_path, slide, slide_source }) => {
      sandbox.assertWritable();
      const { path, text } = readSource(source_path, 'source_path');
      sandbox.writable(source_path, 'source_path', 'source');
      const parts = splitDeck(text);
      const target = findSlide(parts, slide);
      if (!target) {
        throw new Error(
          `slide ${String(slide)} not found in ${shown(path)} (${parts.slides.length} slides).`,
        );
      }
      let body = slide_source.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '');
      if (!/^# slide(?:\s|$)/m.test(body)) body = `${target.header}\n${body}`;
      const inserted = splitDeck(body).slides.length;
      target.text = body.replace(/\s+$/, '') + '\n';
      const next = joinDeck(parts);
      const backup = save(path, next);
      const r = check(next, dirname(path));
      const step = nextStep(r.diagnostics, r.lint, 'marco_build');
      const lines = [
        `✓ Replaced slide ${target.position} (${target.id}) in ${shown(path)}${inserted > 1 ? ` with ${inserted} slides` : ''}${backup ? `; backup ${shown(backup)}` : ''}.`,
        `Deck: ${r.slides} slides · ${countsText(r.counts)}`,
        ...diagnosticsText('Diagnostics (fix these first):', r.diagnostics),
        ...lintText(r.lint),
        `Next: ${step}`,
      ];
      return toolResult(lines.join('\n'), {
        ok: r.ok,
        source_path: path,
        ...(backup ? { backup } : {}),
        slides: r.slides,
        replaced: { number: target.position, id: target.id },
        inserted,
        diagnostics: r.diagnostics,
        lint: r.lint,
        counts: r.counts,
        next_step: step,
      });
    },
  );

  server.registerTool(
    'marco_import',
    {
      title: 'Import a legacy HTML deck',
      description:
        'Convert a legacy single-file HTML lecture deck (V20 or v9.7 family) into MARCO source: writes <out_dir>/lecture.marco.md, assets/, sidecar JSON, assets.manifest.json and IMPORT-REPORT.md. Returns the slide count, coverage (share of blocks mapped to components vs html fallbacks), files written and warnings. keep_source keeps an existing lecture.marco.md (refreshes assets and report only); otherwise an existing one is backed up and replaced. Deck scripts are never run (import.config.json "corrections" are skipped; the `marco import` CLI runs them). Next: marco_lint or marco_build on the new source.',
      inputSchema: {
        html_path: z.string().describe('Legacy .html deck under the root'),
        out_dir: z.string().describe('Output folder under the root'),
        family: z
          .enum(['auto', 'v20', 'v97'])
          .optional()
          .describe('Deck family; auto (default) detects it'),
        keep_source: z.boolean().optional().describe('Keep an existing lecture.marco.md'),
      },
      outputSchema: {
        ok: z.boolean(),
        family: z.string(),
        out_dir: z.string(),
        source_path: z.string(),
        report_path: z.string(),
        slides: z.number().int(),
        blocks: z.object({
          mapped: z.number().int(),
          fallback: z.number().int(),
          mapped_percent: z.number(),
        }),
        assets: z.object({
          total: z.number().int(),
          stripped: z.number().int(),
          bytes: z.number().int(),
        }),
        validation_errors: z.number().int(),
        warnings: z.array(z.string()),
        files: z.array(z.string()),
        backup: z.string().optional(),
        corrections_skipped: z.array(z.string()).optional(),
        next_step: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ html_path, out_dir, family, keep_source }) => {
      const input = sandbox.resolve(html_path, 'html_path');
      if (!isFile(input)) throw new PathError(`html_path "${html_path}" not found.`);
      if (!hasExt(input, '.html', '.htm')) throw new PathError('html_path must be an .html file.');
      const out = sandbox.writable(out_dir, 'out_dir', 'dir');
      if (isFile(out)) throw new PathError(`out_dir "${out_dir}" is a file, not a folder.`);
      const sourceFile = join(out, 'lecture.marco.md');

      // Per-deck config (slide ids, notes mode …) applies; its load-time deck scripts do not run.
      let config: ImportConfig | false = false;
      let skipped: string[] = [];
      const configPath = join(out, CONFIG_FILE);
      if (isFile(configPath)) {
        const loaded = await loadImportConfig(configPath);
        if (loaded.corrections?.length) {
          skipped = [...loaded.corrections];
          const rest: ImportConfig = { ...loaded };
          delete rest.corrections;
          config = rest;
        } else config = loaded;
      }
      let backup: string | undefined;
      if (!keep_source && isFile(sourceFile)) {
        backup = sandbox.backup(sourceFile, readFileSync(sourceFile, 'utf8'));
      }
      mkdirSync(out, { recursive: true });
      const res = await runImport(input, out, {
        writeSource: !keep_source,
        config,
        ...(family && family !== 'auto' ? { family } : {}),
      });
      const r = res.result.report;
      const files = res.files.map((f) => join(out, f));
      const next = `Check the source with marco_lint { source_path: "${shown(sourceFile)}" }, then marco_build it. IMPORT-REPORT.md lists what was not mapped.`;
      const data = {
        ok: true,
        family: r.family,
        out_dir: out,
        source_path: sourceFile,
        report_path: join(out, 'IMPORT-REPORT.md'),
        slides: r.slideCount,
        blocks: {
          mapped: r.mappedBlocks,
          fallback: r.fallbackBlocks,
          mapped_percent: r.mappedPercent,
        },
        assets: { total: r.assets.total, stripped: r.assets.stripped, bytes: r.assets.bytes },
        validation_errors: r.validation.length,
        warnings: r.warnings.slice(0, 20),
        files,
        ...(backup ? { backup } : {}),
        ...(skipped.length ? { corrections_skipped: skipped } : {}),
        next_step: next,
      };
      const lines = [
        `✓ Imported ${shown(input)} → ${shown(out)} · ${r.family} deck · ${r.slideCount} slides · ${r.mappedBlocks + r.fallbackBlocks} blocks (${r.mappedPercent}% components, ${r.fallbackBlocks} html) · ${r.assets.total} images${r.assets.stripped ? ` (${r.assets.stripped} without data)` : ''}`,
        ...files.map((f) => `  wrote ${shown(f)}`),
        ...(keep_source ? [`  kept the existing ${shown(sourceFile)}`] : []),
        ...(backup ? [`  previous lecture.marco.md backed up to ${shown(backup)}`] : []),
        ...(skipped.length
          ? [`  skipped deck scripts from ${CONFIG_FILE} corrections: ${skipped.join(', ')}`]
          : []),
        ...(r.validation.length
          ? [`  ${r.validation.length} IR validation error(s): see IMPORT-REPORT.md`]
          : []),
        ...r.warnings.slice(0, 5).map((w) => `  warning: ${w}`),
        ...(r.warnings.length > 5 ? [`  … ${r.warnings.length - 5} more in IMPORT-REPORT.md`] : []),
        `Next: ${next}`,
      ];
      return toolResult(lines.join('\n'), data);
    },
  );

  server.registerTool(
    'marco_preview',
    {
      title: 'Screenshot one slide',
      description:
        'Render one slide of a deck to a 1920×1080 PNG in headless Chromium (needs Playwright; all network requests are blocked). source_path is a .marco.md (built first with default options, like marco_build) or an already built .html. Returns the PNG path and, when under 1 MB, the image itself. Use it to check the layout visually once lint is clean; lint (budget.slide.dense) is the cheaper overflow check.',
      inputSchema: {
        source_path: z.string().describe('.marco.md or built .html under the root'),
        slide: z.number().int().min(1).describe('1-based slide number'),
        out_png: z
          .string()
          .optional()
          .describe('Where to write the PNG (default .marco/mcp/previews/<name>-<n>.png)'),
      },
      outputSchema: {
        png_path: z.string().nullable(),
        html_path: z.string(),
        slide: z.number().int(),
        slides: z.number().int(),
        slide_id: z.string(),
        bytes: z.number().int(),
        inline_image: z.boolean(),
        page_errors: z.array(z.string()),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ source_path, slide, out_png }) => {
      const input = sandbox.resolve(source_path, 'source_path');
      if (!isFile(input)) throw new PathError(`source_path "${source_path}" not found.`);
      let html = input;
      if (hasExt(input, '.md')) {
        sandbox.assertWritable();
        const { text } = readSource(source_path, 'source_path');
        const blocked = outsideRoot(text, dirname(input));
        if (blocked.length) throw new PathError(blocked.map((d) => d.message).join(' '));
        html = defaultOutFile(input);
        const built = await compile(input, { ...options.compileOptions, outFile: html });
        if (!built.ok) {
          const errors = built.diagnostics.filter((d) => d.level === 'error');
          throw new Error(
            `The deck does not build (${errors.length} error(s), first: ${errors[0]?.message ?? '?'}). Run marco_build for the full list, fix, then preview.`,
          );
        }
      } else if (!hasExt(input, '.html', '.htm')) {
        throw new PathError('source_path must be a .marco.md source or a built .html deck.');
      }
      const png = out_png
        ? sandbox.writable(out_png, 'out_png', 'png')
        : sandbox.allowWrite
          ? sandbox.work(
              'previews',
              `${basename(html, extname(html))}-${String(slide).padStart(2, '0')}.png`,
            )
          : null;
      const shot = await screenshotSlide(html, slide);
      if (png) sandbox.write(png, shot.png);
      const inline = shot.png.length <= MAX_INLINE_IMAGE_BYTES;
      const data = {
        png_path: png,
        html_path: html,
        slide: shot.slide,
        slides: shot.slides,
        slide_id: shot.slideId,
        bytes: shot.png.length,
        inline_image: inline,
        page_errors: shot.pageErrors,
      };
      const text = [
        `Slide ${shot.slide}/${shot.slides} (${shot.slideId}) of ${shown(html)}${png ? ` → ${shown(png)}` : ''} · ${formatBytes(shot.png.length)}${inline ? '' : ' (too large to attach; open the file)'}`,
        ...(png ? [`Full path: ${png}`] : []),
        ...shot.pageErrors.slice(0, 3).map((e) => `page error: ${e}`),
      ].join('\n');
      return {
        content: [
          { type: 'text', text },
          ...(inline
            ? [{ type: 'image' as const, data: shot.png.toString('base64'), mimeType: 'image/png' }]
            : []),
        ],
        structuredContent: data,
      };
    },
  );

  // ----- resources ---------------------------------------------------------------------------

  server.registerResource(
    'kit',
    'marco://kit',
    {
      title: 'MARCO authoring kit (MARCO-작성-안내.md)',
      description:
        'The whole prompt kit: rules, cheat-sheet, note grammar, style guide, self-check, examples',
      mimeType: 'text/markdown',
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: kitText(locations.kitDir) }],
    }),
  );

  server.registerResource(
    'spec',
    new ResourceTemplate('marco://spec/{name}', {
      list: () => ({
        resources: SPEC_NAMES.map((name) => ({
          uri: `marco://spec/${name}`,
          name: `spec-${name}`,
          title: `${name}.md`,
          description: SPEC_TITLES[name],
          mimeType: 'text/markdown',
        })),
      }),
      complete: { name: (value) => SPEC_NAMES.filter((n) => n.startsWith(value)) },
    }),
    {
      title: 'MARCO specification',
      description: 'docs/spec/<name>.md: format, components, notes, ir, runtime',
      mimeType: 'text/markdown',
    },
    (uri, variables) => {
      const raw = variables.name;
      const name = (Array.isArray(raw) ? raw[0] : raw) as string | undefined;
      if (!name || !(SPEC_NAMES as readonly string[]).includes(name)) {
        throw new Error(`unknown spec "${String(name)}"; one of ${SPEC_NAMES.join(', ')}`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: readSpec(name as SpecName, locations.specDir),
          },
        ],
      };
    },
  );

  server.registerResource(
    'schema',
    'marco://schema',
    {
      title: 'Lecture IR JSON Schema (lecture.schema.json)',
      description: 'JSON Schema (2020-12) of the Lecture IR the compiler validates',
      mimeType: 'application/schema+json',
    },
    (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: schemaText() }],
    }),
  );

  // ----- prompts (@marco/ai task templates) --------------------------------------------------

  const includeKitArg = z
    .string()
    .optional()
    .describe('"no" to leave out the kit (when marco_kit was already read in this conversation)');

  function promptResult(
    description: string,
    msgs: ChatMessage[],
    includeKit: string | undefined,
    tail: string,
  ): GetPromptResult {
    const system = msgs.find((m) => m.role === 'system')?.content ?? '';
    const user = msgs.find((m) => m.role === 'user')?.content ?? '';
    const messages: GetPromptResult['messages'] = [];
    if (!/^(no|false|0)$/i.test(includeKit?.trim() ?? '')) {
      messages.push({
        role: 'user',
        content: { type: 'text', text: `${MCP_KIT_PREFACE}\n${system}` },
      });
    }
    messages.push({ role: 'user', content: { type: 'text', text: `${user}\n\n${tail}` } });
    return { description, messages };
  }

  server.registerPrompt(
    'outline',
    {
      title: 'MARCO: lecture outline',
      description:
        'Plan a lecture as 30–45 outline lines "번호 | 태그 | 제목 | 한 줄 의도 | 분" (the @marco/ai outline step).',
      argsSchema: {
        course: z.string().describe('Course name'),
        topic: z.string().describe('Lecture topic'),
        duration: z.string().describe('Lecture length in minutes, e.g. "150"'),
        week: z.string().optional().describe('Week number'),
        audience: z.string().optional().describe('Who the students are'),
        request: z.string().optional().describe('Cases, labs or readings the outline must cover'),
        include_kit: includeKitArg,
      },
    },
    ({ course, topic, duration, week, audience, request, include_kit }) => {
      const minutes = Number(duration);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error(`duration must be minutes, e.g. "150" (got "${duration}")`);
      }
      const msgs = buildOutlinePrompt(
        {
          course,
          topic,
          duration: minutes,
          ...(week ? { week } : {}),
          ...(audience ? { audience } : {}),
          ...(request ? { request } : {}),
        },
        loadKit(locations.kitDir),
      );
      return promptResult(
        `Outline: ${topic}`,
        msgs,
        include_kit,
        '(MCP) 개요가 확정되면 marco_new로 덱 폴더를 만들고, slides 프롬프트나 직접 작성으로 슬라이드를 쓴 뒤 marco_build로 빌드한다.',
      );
    },
  );

  server.registerPrompt(
    'slides',
    {
      title: 'MARCO: write slides',
      description: 'Write a range of outline items as MARCO slides (the @marco/ai slides step).',
      argsSchema: {
        outline: z.string().describe('The outline text (lines "번호 | 태그 | 제목 | 의도 | 분")'),
        range: z.string().describe('Outline numbers to write, e.g. "7-12" or "7"'),
        refs: z
          .string()
          .optional()
          .describe('Citable refs (front matter refs: YAML or "S13: …" lines)'),
        request: z.string().optional().describe('Extra instructions'),
        include_kit: includeKitArg,
      },
    },
    ({ outline, range, refs, request, include_kit }) => {
      const msgs = buildSlidesPrompt(
        {
          outline,
          range: parseRange(range),
          ...(refs ? { refs } : {}),
          ...(request ? { request } : {}),
        },
        loadKit(locations.kitDir),
      );
      return promptResult(
        `Slides ${range}`,
        msgs,
        include_kit,
        '(MCP) 쓴 슬라이드는 marco_check_slide로 확인하고, 덱에 넣어 marco_build로 빌드한 뒤 린트를 고친다.',
      );
    },
  );

  server.registerPrompt(
    'notes',
    {
      title: 'MARCO: presenter notes',
      description: 'Write the ## note (lecture script) for one slide (the @marco/ai notes step).',
      argsSchema: {
        slide: z.string().describe('The slide source ("# slide …" block)'),
        time: z.string().optional().describe('[시간] value, e.g. "2.5분 · 10:00 – 12:30"'),
        prev_title: z.string().optional().describe('Title of the previous slide'),
        next_title: z.string().optional().describe('Title of the next slide'),
        chars_per_minute: z
          .string()
          .optional()
          .describe('Spoken characters per minute (default 350)'),
        request: z.string().optional().describe('Extra instructions'),
        include_kit: includeKitArg,
      },
    },
    ({ slide, time, prev_title, next_title, chars_per_minute, request, include_kit }) => {
      const cpm = chars_per_minute ? Number(chars_per_minute) : undefined;
      const msgs = buildNotesPrompt(
        {
          slide,
          ...(time ? { time } : {}),
          ...(prev_title ? { prevTitle: prev_title } : {}),
          ...(next_title ? { nextTitle: next_title } : {}),
          ...(cpm && Number.isFinite(cpm) && cpm > 0 ? { charsPerMinute: cpm } : {}),
          ...(request ? { request } : {}),
        },
        loadKit(locations.kitDir),
      );
      return promptResult(
        'Presenter notes',
        msgs,
        include_kit,
        '(MCP) 해설을 넣은 슬라이드를 marco_replace_slide로 덱에 반영하고 note.* 린트를 확인한다.',
      );
    },
  );

  server.registerPrompt(
    'revise',
    {
      title: 'MARCO: revise one slide',
      description:
        'Revise one slide from a request and its lint lines (the @marco/ai revise step; also the repair loop).',
      argsSchema: {
        slide: z.string().describe('The slide source ("# slide …" block)'),
        request: z.string().describe('What to change'),
        lint: z
          .string()
          .optional()
          .describe('Lint lines for this slide (from marco_lint / marco_build)'),
        include_kit: includeKitArg,
      },
    },
    ({ slide, request, lint, include_kit }) => {
      const msgs = buildRevisePrompt(
        { slide, request, ...(lint ? { lint } : {}) },
        loadKit(locations.kitDir),
      );
      return promptResult(
        'Revise slide',
        msgs,
        include_kit,
        '(MCP) 고친 슬라이드를 marco_replace_slide로 반영하고 marco_build로 다시 확인한다.',
      );
    },
  );

  return { server, sandbox };
}
