# @marco/mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI applications (Claude Desktop,
Claude Code, Cursor, any MCP client) use the MARCO Engine as tools. The model writes compact
MARCO source (`.marco.md`) and calls `marco_build`; the engine produces the single-file
1920×1080 HTML deck and reports every problem per slide with a repair hint. The model never
writes slide HTML.

## Run

```sh
marco-mcp --root ~/lectures            # this package's bin (dist/main.js)
marco mcp --root ~/lectures            # the same server inside the marco CLI (no child process)
npx -y marco-engine mcp --root ~/lectures   # from the published package
node /path/NPPT/packages/mcp/dist/main.js --root ~/lectures   # local development
```

The server speaks MCP over stdio (stdout carries the protocol; status lines go to stderr).

| Option          | Meaning                                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--root <dir>`  | The sandbox. Every path argument is resolved under it (relative paths against it; absolute paths must lie inside it; symlinks are followed before the check). Default: the working directory. `~` is expanded; a missing folder is created. |
| `--allow-write` | Tools may write under the root: scaffold, save and build decks, import, previews, `.marco/mcp/`. This is the default; the flag exists for explicit configs.                                                                                 |
| `--read-only`   | Nothing is written: `marco_new`, `marco_import`, `marco_replace_slide` and saving/staging `source_text` are refused; `marco_build` on a file compiles and reports without writing HTML.                                                     |

Environment: `MARCO_SPEC_DIR` (folder with `format.md`, `components.md`, …) and `MARCO_KIT_DIR`
(a folder laid out like `@marco/ai/dist/kit`) override where the specs and the prompt kit are
read from; the `marco-engine` bundle sets both to its `assets/`.

## Client configuration

**Claude Desktop** (`claude_desktop_config.json`; Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "marco": {
      "command": "npx",
      "args": ["-y", "marco-engine", "mcp", "--root", "~/lectures"]
    }
  }
}
```

Local development against this repository (build first with `pnpm build`):

```json
{
  "mcpServers": {
    "marco": {
      "command": "node",
      "args": ["/path/NPPT/packages/mcp/dist/main.js", "--root", "/Users/me/lectures"]
    }
  }
}
```

**Claude Code**: `claude mcp add marco -- npx -y marco-engine mcp --root ~/lectures`. To share
the server with everyone who opens a lecture folder, register it per project instead:
`claude mcp add --scope project marco -- npx -y marco-engine mcp --root .` (writes `.mcp.json`).

**Cursor** (`~/.cursor/mcp.json` or `<project>/.cursor/mcp.json`) and other stdio clients: the
same `command` / `args` as for Claude Desktop under `mcpServers`. Any client that can start a
process and talk MCP over its stdin/stdout works; `npx -y -p marco-engine marco-mcp --root …`
is an equivalent command.

## Tools

Tool descriptions are written for the model: they say what to call first, what results mean
and how to iterate. The server's `instructions` summarise the workflow: `marco_kit` →
`marco_new` / `marco_read` / `marco_import` → write → `marco_build` → fix the listed slides →
rebuild (at most 3 rounds) → report `out_path` and the author's items.

| Tool                  | Input                                                                          | What it does                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marco_kit`           | `section?: all \| rules \| cheatsheet \| notes \| style \| review \| examples` | The Korean prompt kit (`@marco/ai`), prefixed (for `all`/`rules`) with how the chat-oriented rules change under MCP. Read once per conversation.                                                                                                                                      |
| `marco_spec`          | `name: format \| components \| notes \| ir \| runtime`                         | One spec document from `docs/spec/`.                                                                                                                                                                                                                                                  |
| `marco_new`           | `dir, title, course?, week?, theme?, presenter?, duration?`                    | Scaffolds `<dir>/lecture.marco.md` (the `marco new` template) and `<dir>/assets/`; never overwrites. Returns paths and source.                                                                                                                                                        |
| `marco_build`         | `source_path?, source_text?, out_path?, edition?, theme?, fonts?, strict?`     | Compiles. `source_path` alone builds the file; with `source_text` the text is saved there first (old file backed up); `source_text` alone is staged at `<root>/.marco/mcp/<hash>.marco.md`. Returns `{ ok, out_path, size_bytes, slides, diagnostics[], lint[], warnings[], stats }`. |
| `marco_lint`          | `source_path?, source_text?`                                                   | Parse + validate + lint without rendering or writing; same issue shapes as `marco_build`.                                                                                                                                                                                             |
| `marco_check_slide`   | `slide_source, front_matter?`                                                  | Wraps one `# slide …` block in a minimal deck (or the given front matter) and returns its diagnostics (lines relative to `slide_source`), lint and body-height estimate.                                                                                                              |
| `marco_read`          | `path, slide?`                                                                 | A text file under the root, or one slide block by number or id, for clients without file access.                                                                                                                                                                                      |
| `marco_replace_slide` | `source_path, slide, slide_source`                                             | Replaces one slide in place (several blocks split it; a missing header keeps the old one), backs up the file, returns deck lint.                                                                                                                                                      |
| `marco_import`        | `html_path, out_dir, family?: auto \| v20 \| v97, keep_source?`                | `runImport` from `@marco/importer`: slides, coverage, files written, warnings. Deck scripts are never run: `import.config.json` `corrections` are skipped and reported.                                                                                                               |
| `marco_preview`       | `source_path, slide, out_png?`                                                 | Builds a `.marco.md` (or takes a built `.html`), opens it in headless Chromium with every non-local request aborted, and returns a 1920×1080 PNG path plus the image inline when under 1 MB. Needs Playwright; without it the tool returns a clear error.                             |

Every tool returns a compact text summary (for clients that show only text) and
`structuredContent` matching its declared `outputSchema`.

### Build and lint results

```ts
{
  ok: boolean,                  // false: format/schema errors stopped the build (or strict + lint errors)
  out_path: string | null,      // absolute path of the HTML written
  size_bytes, slides, edition, theme,
  diagnostics: [{ level, code, message, line?, slide?, repair_hint }],   // format.* / schema.*
  lint: [{ slide: 's-04' | null, index?, title?, line?,                    // grouped by slide
           issues: [{ level, code, message, path, line?, repair_hint, for_author? }] }],
  warnings: [{ level, code, message, repair_hint }],                      // asset.* font.* icon.* build.*
  stats: { slides, bytes, fonts?, runtime?, errors, warnings, infos },
  next_step: string,
}
```

`repair_hint` is a short Korean instruction derived from the lint table in
`docs/spec/ir.md` §5 (and the parser's `format.*` families), with the budget and the current
length filled in, e.g. ``:::cards의 `body`를 90자 이하로 줄인다(지금 104자). …``. Issues the
author has to settle (`content.todo`, `ref.unused`, `term.unused`, `time.total`) carry
`for_author: true`; the model reports them instead of inventing facts.

### Where files go

| Path                                | Written by                                                            |
| ----------------------------------- | --------------------------------------------------------------------- |
| `<dir>/lecture.marco.md`, `assets/` | `marco_new`, `marco_import`                                           |
| `<source>.html`                     | `marco_build`, `marco_preview` (next to the source unless `out_path`) |
| `.marco/mcp/<hash>.marco.md/.html`  | `marco_build` with `source_text` only (newest 20 kept)                |
| `.marco/mcp/backups/`               | any tool that overwrites a source (newest 20 per file)                |
| `.marco/mcp/previews/`              | `marco_preview` without `out_png`                                     |

Relative image and sidecar paths resolve from the source file's folder. A staged
`source_text` lives in `.marco/mcp/`, so decks with images should be saved into their own
folder (`source_path` + `source_text`) before building.

## Resources and prompts

- `marco://kit` — the whole kit (`MARCO-작성-안내.md`).
- `marco://spec/{name}` — `format`, `components`, `notes`, `ir`, `runtime` (listed, with completion).
- `marco://schema` — `lecture.schema.json`.
- Prompts built with `@marco/ai`'s `build*Prompt` builders; the arguments mirror theirs, plus
  `include_kit: "no"` to leave out the kit message:
  - `outline`: `course, topic, duration, week?, audience?, request?`
  - `slides`: `outline, range ("7-12"), refs?, request?`
  - `notes`: `slide, time?, prev_title?, next_title?, chars_per_minute?, request?`
  - `revise`: `slide, request, lint?`

## Safety

- Every path argument is resolved under `--root` and rejected otherwise; symlinks are resolved
  first. Sources whose image or sidecar JSON paths point outside the root are refused
  (`mcp.path.outside`) before anything reads them.
- `source_text` and `slide_source` are capped at 2 MB (UTF-8).
- Writes happen only under the root and only with the file type a tool produces (`.marco.md`,
  `.html`, `.png`, folders); `--read-only` refuses all of them.
- Deck HTML is never executed except by `marco_preview` in headless Chromium, where every
  request other than `file:`, `data:`, `blob:` and `about:` is aborted. The importer parses
  HTML without running it and skips configured correction scripts.
- No network calls.

## API

```ts
import { createMarcoServer, runStdioServer } from '@marco/mcp';

const { server, sandbox } = createMarcoServer({ root: '/lectures', allowWrite: true });
await server.connect(transport); // any MCP transport
await runStdioServer({ root: '~/lectures' }); // what the bins do
```

Also exported: `repairHint`, `Sandbox`, `parseMainArgs`, `kitSection`, `readSpec`,
`screenshotSlide`, `LECTURE_TEMPLATE`.

## Layout and build

```
src/server.ts     tools, resources, prompts
src/stdio.ts      runStdioServer, argument parsing, runMain (the bin)
src/main.ts       bin entry (shebang)
src/paths.ts      root sandbox, backups
src/report.ts     diagnostics/lint → grouped results and text
src/hints.ts      repair_hint table
src/resources.ts  kit, specs, schema lookup
src/preview.ts    Playwright screenshot
src/template.ts   the `marco new` template, embedded (a test keeps it equal to apps/cli/templates)
scripts/copy-spec.mjs   build step: docs/spec/*.md → dist/spec/
```

`pnpm --filter @marco/mcp build` runs `tsc` and copies the specs. The kit is read from
`@marco/ai/dist/kit` (built by `pnpm --filter @marco/ai build`); when it is missing the server
renders the same text in memory from `@marco/ai`'s prompt sources and never writes into engine
folders.

## Tests

`pnpm --filter @marco/mcp test` (Vitest): an in-memory `Client` lists tools, resources,
templates and prompts; `marco_new` → `marco_build` (HTML with the attribution comment and
`#lecture-data`), save-and-build with backup, staged builds, format errors with lines,
outside-root assets; `marco_lint` on an over-budget card (code, hint with numbers, grouping);
`marco_check_slide` (bad container → `format.container.unknown` at the right line, density,
front matter ids); `marco_read` / `marco_replace_slide`; kit, spec, resources and prompts; path
escapes (`../etc/passwd`, absolute paths, symlinks), write types, the 2 MB cap and read-only
mode; `marco_import` of `reference/decks/week03-iam-v20.stripped.html` (skipped when absent)
including skipped correction scripts. Stdio smoke tests spawn `dist/main.js` and
`apps/cli/dist/main.js mcp` with `StdioClientTransport` (skipped until built); the preview test
runs when Playwright's Chromium is installed. A hint test checks that every `LINT_CODES` entry
has a specific hint and that suggested icon names exist.
