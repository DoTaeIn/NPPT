# Week 3 · 물리보안 · 출입통제 IAM (V20)

MARCO source for the professor's week 3 deck, imported from the original V20 single-file HTML deck
(`reference/decks/week03-iam-v20.html`, 40 slides) with `@marco/importer`. It is the parity target for
milestone M1 (PLAN.md §12): rebuilding this source should reproduce the original deck.

| File                   | What it is                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `lecture.marco.md`     | The source (docs/spec/format.md), exactly as the importer writes it.                              |
| `import.config.json`   | Stable slide ids, the cover's TOC group, notes mode (see `examples/README.md`).                   |
| `assets.manifest.json` | The 13 images: id, file name, MIME type, size, SHA-256, title, credit and source URL.             |
| `IMPORT-REPORT.md`     | What the importer mapped, what it kept as raw `html` and why, and what the config did.            |
| `assets/`              | Decoded images. **Local only**: gitignored until redistribution rights are settled (PLAN.md §14). |

## Rebuild

```bash
marco build examples/week03-iam/lecture.marco.md          # single-file HTML deck next to the source
marco build examples/week03-iam/lecture.marco.md --edition student
```

## Regenerate from the original deck

```bash
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week03-iam-v20.html examples/week03-iam
```

This rewrites the source, the manifest, the report and `assets/`. Do not edit `lecture.marco.md` by hand; put the
change in `import.config.json` (or in the importer) and regenerate. Check the images against the `sha256` values in
`assets.manifest.json`.

## What the importer does for this deck

- Titles: `title` is the heading on the slide; the legacy `data-title` (TOC label) is kept as `toc` where it differs
  (cover, both dividers, the closing quote).
- Cover: the headline is the title (`문을 여는 기술, *권한을 다루는 설계.*`), `tagline` PHYSICAL ACCESS × IDENTITY, the
  lead as `subtitle`, `meta` for the department and version lines, `art: campus`, the chips as `:::pills`. The
  course · week line equals the renderer's default kicker and is left out.
- Dividers: `# slide divider dark` with `no`, `kicker` (course · week line), the heading as `title`, the description as
  `subtitle`, `toc` and `tag` from the legacy TOC label; the part label also groups the following slides.
- Notes: the V20 `data-note` text is the slide text read aloud. It is cut into one `[대사]` cue per block, card or
  step, each tied to its block with `@<slide>-b<n>[-i<m>]` (36 of 40 slides; the cover, the dividers and the
  references slide have their own prose). Joined back together, the cue texts match the original note.
- The photo grid becomes 2 × 2 columns of image + text, the pen-test video cards become `:::video` blocks, the grouped
  reference list becomes the `references` slide (`only` in the grouped order).

## Known gaps

- 11 `html` blocks remain, all interactive demos (MFA, response time, JIT, SoD, ABAC, APB, lock power, the
  source/credit buttons), which become Phase 3 widgets. See `IMPORT-REPORT.md`.
- The reference list's four group headings are not kept (the `references` slide has no groups).
- Video fields beyond `id/title/start/credit` (clip end, speakers, lesson text) have no IR field; the card text is
  kept as paragraphs next to each `:::video`, the thumbnails are not shown.
