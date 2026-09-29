# NPPT

MARCO Engine for lecture decks: a build system that separates a presentation
runtime (1920×1080 canvas, presenter notes, ink tools, print modes, quiz and
simulator plugins) from AI-written lecture content, so a new deck or a
single-slide revision costs a fraction of the tokens that regenerating a whole
HTML file does.

Status: Phase 1–2 implemented (runtime, design system, compiler, importer, AI kit, CLI, quiz
plugin). See [PLAN.md](PLAN.md) for the roadmap and `docs/guide-ko/quickstart.md` for the
professor's guide (Korean).

## Install

Once published to npm (see `docs/release.md`):

```bash
npm install -g marco-engine        # gives the `marco`, `marco-engine` and `marco-mcp` commands
npx marco-engine build week06/lecture.marco.md   # or run without installing
```

Until then, build the package from this repository: `pnpm install && pnpm dist` produces
`packages/marco-engine/marco-engine-<version>.tgz`; install it with `npm install -g ./marco-engine-<version>.tgz`.

## Three ways an AI uses the engine

1. **Chat window (any assistant).** `marco ai kit -o kit` writes the Korean prompt kit; paste
   `MARCO-작성-안내.md` once, ask for slides, save the reply as `lecture.marco.md`, run `marco build`.
   Guide: `docs/guide-ko/quickstart.md`, `docs/guide-ko/ai-workflow.md`.
2. **MCP tools (Claude Desktop, Claude Code, Cursor, any MCP client).** `marco mcp --root ~/lectures`
   or `npx -y marco-engine mcp --root ~/lectures` exposes `marco_build`, `marco_lint`,
   `marco_check_slide`, `marco_new`, `marco_import`, `marco_preview`, `marco_kit`, `marco_spec` and
   more, with a repair hint on every issue. Guide: `docs/guide-ko/mcp.md`, `packages/mcp/README.md`.
3. **Agent skill (Claude Code, Codex, Cursor, Gemini CLI).** Copy `skills/marco/` into the agent's
   skills folder (also shipped inside the package as `assets/skill/marco/`); the agent then knows the
   source format, the commands and how to read lint. Guide: `docs/guide-ko/ai-agents.md`. Agents
   working inside this repository read `AGENTS.md` / `CLAUDE.md`.

## Quick start (from source)

```bash
pnpm install && pnpm build
node apps/cli/dist/main.js new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6
node apps/cli/dist/main.js ai kit -o week06/kit        # paste dist/kit/MARCO-작성-안내.md into any chat assistant
node apps/cli/dist/main.js build week06/lecture.marco.md   # → week06/lecture.html (single file, offline)
node apps/cli/dist/main.js lint  week06/lecture.marco.md
node apps/cli/dist/main.js pdf   week06/lecture.marco.md --mode handout
node apps/cli/dist/main.js import old-deck.html week05    # convert a legacy AI-generated deck
node apps/cli/dist/main.js mcp --root .                   # MCP server over stdio
```

Packages: `schema` (IR, validator, linter), `design-system` (tokens, two themes, component CSS),
`runtime` (in-browser deck engine + plugins), `compiler` (source → HTML), `importer` (legacy HTML →
source), `ai` (vendor-neutral prompt kit and pipeline), `mcp` (MCP server), `marco-engine` (the
installable package), `apps/cli` (`marco`). Specs live in `docs/spec/`; the examples in `examples/`
are rebuilt from the professor's two reference decks.

## License

- **Engine** (all code): the **MARCO Engine License 1.0** (`LICENSE`), which is
  the Apache License 2.0 plus one Additional Condition: a product that puts the
  engine in front of end users, including a lecture deck built with it, must
  show, somewhere an end user can find it (about screen, help overlay, docs
  page, footer or first-run text):

  > Powered by MARCO — Created by DoTaeIn,
  > Original project: https://github.com/DoTaeIn/Marco

  Personal use, research, evaluation, development, internal tools and plain
  redistribution do not trigger it. Everything else Apache 2.0 allows stays
  allowed, including commercial use. A white-label license without the
  attribution is available from the copyright holder.

- **Lecture content** (slides, notes and media written with the engine)
  belongs to its author and is not covered by this license.
