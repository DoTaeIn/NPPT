# Examples

MARCO sources for the professor's existing decks, produced by `@marco/importer` from the original single-file HTML
decks in `reference/decks/` (local only, see `reference/README.md`). They are the parity targets for the rebuilt
decks (PLAN.md §12–13). Nothing in these folders is edited by hand: every file is the importer's output for the
deck plus the folder's `import.config.json`.

| Example                                | Source deck                                                   | Status                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`week03-iam/`](week03-iam/)           | 3주차 물리보안 · 출입통제 IAM, V20 family, 40 slides          | 92.3% of blocks mapped to components; the 11 `html` blocks left are the interactive demos (Phase 3 widgets). Cover, dividers and references slide use the v0.2 fields. Notes split into one `[대사]` cue per block. M1 parity target.                     |
| [`week05-firewall/`](week05-firewall/) | 5주차 방화벽 운영 및 실무, v9.7 instructor edition, 43 slides | 97.9% of blocks mapped; 2 `html` blocks (the solutions page button and the attack-chain deep dive). The deck's load-time corrections (v9.0–v9.7) are applied. Quiz in the front matter plus a `:::widget quiz mode=exam`; `sims.json` sidecar. M3 target. |

Each folder has `lecture.marco.md` (the source), `import.config.json` (the per-deck import settings),
`assets.manifest.json` (image ids, sizes, SHA-256, credits) and `IMPORT-REPORT.md` (mapping coverage, unmapped markup,
notes statistics, validation, what the config and the corrections did). `week05-firewall/sims.json` holds the
network-simulator data.

## Regenerate

```bash
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week03-iam-v20.html examples/week03-iam
pnpm --filter @marco/importer exec tsx scripts/import.ts reference/decks/week05-firewall-v9.7.html examples/week05-firewall
```

The output is deterministic and already Prettier-formatted, so a regenerated folder shows no diff unless the importer
or the config changed. `packages/importer/test/e2e.test.ts` checks that importing the stripped reference decks with
these configs reproduces both `lecture.marco.md` files (and `sims.json`) exactly.

## `import.config.json`

Polish that used to be hand edits lives in the config (schema: `packages/importer/src/config.ts`):

```json
{
  "notes": "split",
  "slides": [
    { "at": 1, "id": "cover" },
    { "legacyTitle": "안전과 권한", "id": "part-2", "set": { "toc": "2부 · 안전과 권한" } }
  ],
  "cover": { "group": "표지 · 도입" },
  "assets": { "campus": { "credit": "imagegen 생성" } },
  "dropRefs": ["R03"],
  "corrections": ["applyCorrections97"]
}
```

- `slides`: stable ids and field overrides, selected by 1-based position (`at`) or by the legacy `data-title`
  (`legacyTitle`). `set` accepts `title`, `subtitle`, `toc`, `tag`, `group`, `question`, `kicker`, `tagline`, `meta`,
  `art`, `dark`, `layout` (an empty string removes a field).
- `cover`: the same overrides for the first slide.
- `assets`: title / credit / source / alt overrides by asset id. `dropRefs`: refs removed from the front matter and
  every slide.
- `notes` (V20 only): `split` (default) cuts the prose `data-note` into one `[대사]` cue per block with an
  `@<slide>-b<n>[-i<m>]` focus target; `prose` keeps one cue per slide.
- `corrections`: named load-time scripts of the legacy deck (IIFE function names or `<script id>`s) to run before
  mapping. This executes the deck's own code in a `node:vm` context, so it is opt-in per deck.

## Media stays out of git

Decoded images go to `<example>/assets/`, which is gitignored (`examples/**/assets/`) until redistribution rights for
the third-party product photos and video thumbnails are settled (PLAN.md §14). Recreate them from your local copy of a
deck with the commands above. The manifest records each file's SHA-256, so a regenerated `assets/` folder can be
checked against it. The week 5 hero illustrations (`hero-01.svg`, `hero-05.svg`, `hero-41.svg`) are the deck's own
inline SVGs written out as files.

## Week 5 notes

- `sims.json` is the deck's `window.SIMS` network-simulator data after the deck's load-time corrections
  (`correctAttackFlows`, `applyCorrections97`). The front matter points to it (`sims: sims.json`).
- The corrections also rewrite 3 quiz items, the text of 7 slides, the TOC title and question of the two simulator
  wrap-up slides, and the notes of 40 slides (v9.5 cue splitting, v9.3/v9.4/v9.7 fact fixes). See the report's
  "Load-time corrections" section.
- The notes keep the professor's markers as authored (`[홉]`, `[학생 질문]`, `[강사 답변]`, `[검증 보충]`). The
  schema's note grammar reads them as aliases of HOP, SQ, SA and VERIFY. Two `[기타]` source lines added by the v9.3
  patch are kept as MEMO (lint `note.marker.unknown`).
- `window.SCRIPT` duplicates the notes as JSON and is not imported. Its legacy `{q, i}` focus selectors still need
  mapping to block ids (`@s-06-b1`).
