# NPPT

MARCO Engine for lecture decks: a build system that separates a presentation
runtime (1920×1080 canvas, presenter notes, ink tools, print modes, quiz and
simulator plugins) from AI-written lecture content, so a new deck or a
single-slide revision costs a fraction of the tokens that regenerating a whole
HTML file does.

Status: Phase 1–2 implemented (runtime, design system, compiler, importer, AI kit, CLI, quiz
plugin). See [PLAN.md](PLAN.md) for the roadmap and `docs/guide-ko/quickstart.md` for the
professor's guide (Korean).

## Quick start

```bash
pnpm install && pnpm build
node apps/cli/dist/main.js new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6
node apps/cli/dist/main.js ai kit -o week06/kit        # paste dist/kit/MARCO-작성-안내.md into any chat assistant
node apps/cli/dist/main.js build week06/lecture.marco.md   # → week06/lecture.html (single file, offline)
node apps/cli/dist/main.js lint  week06/lecture.marco.md
node apps/cli/dist/main.js pdf   week06/lecture.marco.md --mode handout
node apps/cli/dist/main.js import old-deck.html week05    # convert a legacy AI-generated deck
```

Packages: `schema` (IR, validator, linter), `design-system` (tokens, two themes, component CSS),
`runtime` (in-browser deck engine + plugins), `compiler` (source → HTML), `importer` (legacy HTML →
source), `ai` (vendor-neutral prompt kit and pipeline), `apps/cli` (`marco`). Specs live in
`docs/spec/`; the examples in `examples/` are rebuilt from the professor's two reference decks.

NPPT shares its name and license with [MARCO](https://github.com/DoTaeIn/Marco),
DoTaeIn's reasoning engine. It does not include that engine.

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
