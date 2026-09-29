# Week 3 · 물리보안 · 출입통제 IAM (V20)

MARCO source for the professor's week 3 deck, imported from the original V20 single-file HTML deck
(`reference/decks/week03-iam-v20.html`, 40 slides) with `@marco/importer`. It is the parity target for
milestone M1 (PLAN.md §12): rebuilding this source should reproduce the original deck.

| File                   | What it is                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `lecture.marco.md`     | The source (docs/spec/format.md). Slides 1–5 are hand-polished; slides 6–40 are exactly as imported. |
| `assets.manifest.json` | The 13 images: id, file name, MIME type, size, SHA-256, title, credit and source URL.                |
| `IMPORT-REPORT.md`     | What the importer mapped, what it kept as raw `html` and why (for the unpolished import).            |
| `assets/`              | Decoded images. **Local only**: gitignored until redistribution rights are settled (PLAN.md §14).    |

## Rebuild

```bash
marco build examples/week03-iam/lecture.marco.md          # single-file HTML deck next to the source
marco build examples/week03-iam/lecture.marco.md --edition student
```

`marco build` is the CLI in `apps/cli`, which is still being built. Until it lands, the compiler's `parseMarco` reads this
file with no errors.

## Getting the images

The images are third-party product photos and generated diagrams, so they are not committed. To recreate
`assets/` from your local copy of the original deck without touching the hand-edited source:

```bash
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week03-iam-v20.html examples/week03-iam --keep-source
```

Check the files against the `sha256` values in `assets.manifest.json`. Credits and source URLs are kept in the
front-matter `assets` map. The deck shows them in its media-credit dialog.

## What was polished (slides 1–5)

The first five slides already imported without `html` blocks. The polish made these changes and kept the professor's
Korean wording as it was:

- Stable slide ids: `cover`, `intro`, `four-questions`, `principle-chain`, `part-1`. The last two are the ids used in
  format.md's own examples.
- Notes: the V20 `data-note` text is split into one `[대사]` cue per block. Each cue is tied to its block or card with
  `@<slide>-b<n>[-i<m>]`, so the notes panel and narration highlight what is being read. Joined back together, the
  cue texts match the original note character for character.
- Divider `part-1`: the description line is now part of the lead (`subtitle`), because the divider scaffold does not
  show body blocks.

## Known gaps

- Cover (`cover`) and divider 2 (`s-17`) keep content that the current cover/divider scaffolds do not show: the cover
  art, the headline, the English kicker, the chips and the department line. The compiler warns about this
  (`format.body.ignored`); the scaffolds need to render it before M1 parity.
- 16 `html` blocks remain in slides 6–40. Most are the interactive demos (MFA, JIT, SoD, ABAC, APB, lock power,
  response time), which become Phase 3 widgets. The rest are the equipment photo grid, the pen-test video cards
  and the grouped reference list. See `IMPORT-REPORT.md`.
- The V20 `data-note` text is the slide text, not a spoken script; it is imported as one `[대사]` cue per slide.
- Video fields beyond `id/title/start/credit` (clip end, speakers, lesson text) have no IR field yet. They are still
  visible in the video slide's `html` block.
