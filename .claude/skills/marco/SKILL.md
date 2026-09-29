---
name: marco
description: Create and revise university lecture decks (강의 슬라이드, 강의 덱, 발표 자료, 해설/강의 대본) with the MARCO Engine. Use this whenever the user wants lecture slides or presenter notes written, extended, shortened or fixed; whenever a `.marco.md` file (usually `lecture.marco.md`) is involved; when `marco build`, `marco lint` or `marco pdf` print errors or warnings (`format.*`, `budget.*`, `ref.missing`, `budget.slide.dense` …); or when an old single-file HTML lecture deck should be imported. You write compact MARCO source (Markdown with `# slide` blocks and `:::` components), never HTML, and the `marco` CLI (npm package `marco-engine`) or the `marco_*` MCP tools compile it into one offline 1920×1080 HTML deck.
---

# MARCO lecture decks (pointer)

This repository keeps the skill in `skills/marco/`; this copy only makes Claude Code sessions in
the repo load it. Before writing or fixing any `.marco.md` slide or note:

1. Read `skills/marco/SKILL.md` (workflow, CLI, MCP tools, golden rules, lint table) and follow it.
2. Read `skills/marco/reference/format.md` before writing slides and
   `skills/marco/reference/notes.md` before writing notes.
3. Look up build/lint codes in `skills/marco/reference/lint-codes.md`; real slides are in
   `skills/marco/reference/examples/`.

In this repo run the CLI as `node apps/cli/dist/main.js …` (after `pnpm build`). Write MARCO
source only, never HTML. Do not edit `examples/*/lecture.marco.md`: those files are importer
output (see `AGENTS.md`); write test decks in a scratch folder instead.

Edit the skill in `skills/marco/` only; if you change the frontmatter there, copy it here.
