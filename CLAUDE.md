# AGENTS.md — NPPT / MARCO Engine

Conventions for coding agents working in this repository. `CLAUDE.md` is a verbatim copy of this
file; edit both together.

NPPT is the MARCO Engine for lecture decks: a runtime, design system and compiler that turn compact
AI-written lecture sources (`*.marco.md`) into single-file 1920×1080 HTML decks. The plan is
`PLAN.md`; the professor-facing guides (Korean) are in `docs/guide-ko/`.

**Writing or revising lecture content** (slides, notes, a `.marco.md` deck)? Follow the skill in
`skills/marco/SKILL.md` (also loaded from `.claude/skills/marco/`). The rest of this file is about
changing the engine.

## Package map

Internal dependencies: `schema`, `design-system` and `runtime` depend on nothing internal;
`compiler` uses all three; `importer` and `ai` use `schema`; `apps/cli` and `mcp` use `schema`,
`compiler`, `importer` and `ai`; `marco-engine` bundles the CLI and the MCP server for npm.

| Path                     | Package                 | Owns                                                                                                                                                                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/schema`        | `@marco/schema`         | Lecture IR types, JSON Schema (`lecture.schema.json`, emitted from `src/schema.ts`), validator, normalizer, note parser, linter and `LINT_CODES`, `BUDGETS` and `DENSITY` (the only source of budgets) |
| `packages/design-system` | `@marco/design-system`  | tokens, the `v20-violet` and `cau-navy` themes, component CSS, print CSS, fonts, gallery with overflow tests                                                                                           |
| `packages/runtime`       | `@marco/runtime`        | the in-browser deck engine (one IIFE), plugins (quiz), the help overlay that shows the attribution                                                                                                     |
| `packages/compiler`      | `@marco/compiler`       | `.marco.md` parser (`format.*` diagnostics), renderer, asset/font/icon inlining (`icon.unknown`), single-file output                                                                                   |
| `packages/importer`      | `@marco/importer`       | legacy V20 / v9.7 HTML decks → MARCO source; `scripts/import.ts`                                                                                                                                       |
| `packages/ai`            | `@marco/ai`             | Korean prompt kit (`prompts/`, built into `dist/kit/`) and the vendor-neutral authoring pipeline                                                                                                       |
| `apps/cli`               | `@marco/cli`            | the `marco` command (`new`, `build`, `watch`, `lint`, `pdf`, `import`, `ai …`)                                                                                                                         |
| `packages/mcp`           | `@marco/mcp`            | MCP server `marco-mcp` (tools `marco_kit`, `marco_spec`, `marco_new`, `marco_read`, `marco_check_slide`, `marco_replace_slide`, `marco_lint`, `marco_build`, `marco_preview`, `marco_import`)          |
| `packages/marco-engine`  | `marco-engine` (public) | the installable npm package bundling the CLI, runtime, design system, kit and MCP server (bins `marco`, `marco-mcp`)                                                                                   |
| `docs/spec/`             | —                       | the contracts (below)                                                                                                                                                                                  |
| `skills/marco/`          | —                       | Agent Skill for writing decks with MARCO (reference files condensed from the kit and the specs)                                                                                                        |
| `examples/`              | —                       | importer output for the two reference decks (below)                                                                                                                                                    |
| `reference/`             | —                       | the professor's original decks, local only (below)                                                                                                                                                     |

**Ownership.** When several agents work in parallel, each edits only the paths it was assigned.
A change needed elsewhere goes into the hand-off report (file, what, why), not into the other
owner's files. Within one package, keep the change inside that package unless the task says
otherwise.

## Commands

Run from the repository root.

| Command                                                    | What                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm build`                                               | build every package (`pnpm -r run build`); needed before the CLI or tests            |
| `pnpm typecheck`                                           | `tsc --noEmit` in every package                                                      |
| `pnpm lint`                                                | ESLint over the repo                                                                 |
| `pnpm test`                                                | Vitest in every package, plus Playwright in `runtime` and `design-system`            |
| `pnpm format:check` / `pnpm exec prettier --write <files>` | Prettier                                                                             |
| `pnpm --filter @marco/compiler test`                       | one package (`build`, `typecheck`, `test`; runtime also `test:unit`, `test:e2e`)     |
| `node apps/cli/dist/main.js <command> …`                   | the CLI from source after `pnpm build`                                               |
| `pnpm --filter @marco/schema schema:emit`                  | re-emit `lecture.schema.json` after changing `src/schema.ts` (a test fails on drift) |
| `pnpm --filter @marco/ai build`                            | rebuild the kit; regenerates `prompts/01-컴포넌트-치트시트.md` from `BUDGETS`        |

- Playwright's Chromium is preinstalled here (`PLAYWRIGHT_BROWSERS_PATH`). Never run
  `playwright install`; CI installs its own browser.
- Do not run `pnpm install` or change dependencies (`package.json`, `pnpm-lock.yaml`) unless the
  task asks for it. CI installs with `--frozen-lockfile`.
- Before handing off a change: `pnpm build`, then `pnpm typecheck`, `pnpm lint` and the tests of
  the packages you touched.

## Contracts

- `docs/spec/format.md` (source format), `components.md` (component catalog, HTML skeletons,
  budgets), `notes.md` (note grammar), `ir.md` (IR, validation, lint codes), `runtime.md` are
  contracts. The compiler emits exactly the skeletons and class names in `components.md`, the
  design system styles exactly those, the linter enforces the budgets, and the kit teaches them.
  Change a spec and its implementation in the same change, never one without the other.
- Budgets live only in `BUDGETS` / `DENSITY` (`packages/schema/src/budgets.ts`); the spec tables,
  the kit's cheat-sheet and `skills/marco/reference/format.md` follow them.
- Generated files are not edited by hand: `packages/schema/lecture.schema.json`,
  `packages/ai/prompts/01-컴포넌트-치트시트.md`, everything in `dist/`.
- When the grammar, a budget, a block or a lint code changes, update the kit
  (`packages/ai/prompts/`) and `skills/marco/` too.

## Examples are generated

`examples/week03-iam` and `examples/week05-firewall` are the importer's output for the two
reference decks plus each folder's `import.config.json`. Do not edit `lecture.marco.md`,
`IMPORT-REPORT.md`, `assets.manifest.json` or `sims.json` by hand. Put the change in
`import.config.json` or in the importer, then regenerate:

```bash
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week03-iam-v20.html examples/week03-iam
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week05-firewall-v9.7.html examples/week05-firewall
```

Re-import is deterministic and byte-identical; `packages/importer/test/e2e.test.ts` checks it.
Built decks (`examples/**/lecture.html`) are not committed. Scratch decks for experiments go in
a temporary folder, not in `examples/`.

## Reference decks and media

`reference/decks/` holds the professor's original single-file decks and their extracted CSS/JS.
They are local only (gitignored except `reference/README.md`) and are **not redistributed**: never
commit them, copy them into packages, or quote large parts of them in docs. `examples/**/assets/`
(decoded images, including third-party product photos) is gitignored for the same reason until
redistribution rights are settled (PLAN.md §14).

## Licence and attribution

The engine is under the MARCO Engine License 1.0 (`LICENSE`: Apache 2.0 plus visible
attribution). Every built deck shows

> Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco

in the runtime's help overlay (`?`), and the compiler repeats it in the NOTICE comment in the
`<head>` of each HTML file. Never remove or weaken the attribution, and never add a flag, theme or option
that hides it; tests in `runtime`, `compiler` and `apps/cli` check it. `LICENSE` and `NOTICE`
change only on the maintainer's instruction. Lecture content (slides, notes, media) belongs to
its author and is not covered by the licence.

## Formatting

Prettier (`.prettierrc`: single quotes, width 100, trailing commas, semicolons) formats
everything except the paths in `.prettierignore`: `dist`, `node_modules`, `reference`,
`pnpm-lock.yaml`, `examples/**/*.html`, `**/*.marco.md` and `docs/spec/**` (hand-aligned
tables). Run `pnpm exec prettier --write <files>` on the files you changed. EditorConfig: UTF-8,
LF, two spaces, final newline.

## Commits

- Commit only when asked. One commit per package or feature, e.g. `Implement @marco/runtime: deck
engine ported to TypeScript`, `Compiler follow-ups, CLI wiring (import, ai, pdf) and runtime
bundle choice`, `README: status, quick start and package map`.
- Subject in sentence case without a trailing period; body wrapped at about 72 columns, saying
  what changed and why, with test counts where relevant.
- No AI model or vendor names in the subject or body (the engine and its docs are
  vendor-neutral). Trailers your environment requires go at the end.
- In-progress snapshots are titled `WIP checkpoint: …` and are followed by the real commits.
- Never commit `reference/*`, `examples/**/assets/`, `dist/` or built decks.
