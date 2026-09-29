# Examples

MARCO sources for the professor's existing decks, produced by `@marco/importer` from the original single-file HTML
decks in `reference/decks/` (local only, see `reference/README.md`). They are the parity targets for the rebuilt
decks (PLAN.md §12–13).

| Example                                | Source deck                                                   | Status                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`week03-iam/`](week03-iam/)           | 3주차 물리보안 · 출입통제 IAM, V20 family, 40 slides          | Imported. Slides 1–5 hand-polished. 88% of blocks mapped to components; 16 `html` blocks, mostly Phase 3 interactive demos. Parses and validates. M1 parity target.                                                                                                    |
| [`week05-firewall/`](week05-firewall/) | 5주차 방화벽 운영 및 실무, v9.7 instructor edition, 43 slides | Feasibility import, not polished. 81% of blocks mapped; 20 `html` blocks. 16 network simulators become `widget sim` blocks. All 1,199 note cues parse. Quiz (20 items) in the front matter; `window.SIMS` in the `sims.json` sidecar. Parses and validates. M3 target. |

Each folder has `lecture.marco.md` (the source), `assets.manifest.json` (image ids, sizes, SHA-256, credits) and
`IMPORT-REPORT.md` (mapping coverage, unmapped markup, notes statistics, validation).

## Media stays out of git

Decoded images go to `<example>/assets/`, which is gitignored (`examples/**/assets/`) until redistribution rights for
the third-party product photos and video thumbnails are settled (PLAN.md §14). Recreate them from your local copy of a
deck with the importer. Use `--keep-source` so a hand-edited `lecture.marco.md` is not overwritten:

```bash
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week03-iam-v20.html examples/week03-iam --keep-source
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week05-firewall-v9.7.html examples/week05-firewall
```

The manifest records each file's SHA-256, so a regenerated `assets/` folder can be checked against it.

## Week 5 notes

- `sims.json` is the deck's `window.SIMS` network-simulator data (compact JSON). The front matter points to it
  (`sims: sims.json`), which is a proposed extension of format.md §2. The compiler does not load it yet.
- The notes keep the professor's markers as authored (`[홉]`, `[학생 질문]`, `[강사 답변]`, `[검증 보충]`). The
  schema's note grammar reads them as aliases of HOP, SQ, SA and VERIFY.
- `window.SCRIPT` duplicates the notes as JSON and is not imported. Its legacy `{q, i}` focus selectors still need
  mapping to block ids (`@s-06-b1`).
