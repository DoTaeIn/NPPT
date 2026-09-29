# Lecture IR v0.1 (`@marco/schema`)

The Lecture IR is the canonical JSON form of a deck. The compiler parses `.marco.md` into
it, the importer produces it from legacy HTML, the AI pipeline may emit it directly, and the
runtime reads a subset of it from `#lecture-data`. Types live in
`packages/schema/src/types.ts`; this page covers the schema, the validation result, the lint
codes, and how the tools should use them.

```
source ─parse─▶ partial IR ─normalizeLecture─▶ IR ─validateLecture─▶ IR ─lintLecture─▶ issues
                                                    (errors: stop)        (render anyway)
```

## 1. Shape

| Field               | Type                   | Notes                                                                                                                                                                                                      |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ir`                | `"0.1"`                | IR version                                                                                                                                                                                                 |
| `meta`              | `LectureMeta`          | `title` (required), `course`, `week`, `date`, `presenter`, `lang` (`ko`\|`en`), `theme` (`v20-violet`\|`cau-navy`), `edition` (`student`\|`instructor`), `version`, `footer`, `duration` (planned minutes) |
| `refs`              | `Ref[]`                | `{id, title, url?, kind?, note?}`; `id` such as `S13`                                                                                                                                                      |
| `videos`            | `Video[]`              | `{id (YouTube), title, start?, credit?}`                                                                                                                                                                   |
| `assets`            | `Record<id, Asset>`    | `{path, title?, credit?, source?, alt?, width?, height?}`                                                                                                                                                  |
| `terms`             | `Record<abbr, string>` | abbreviation tooltips                                                                                                                                                                                      |
| `slides`            | `Slide[]`              | at least one                                                                                                                                                                                               |
| `quiz`              | `QuizItem[]`           | optional; `ans` is a 0-based index into `opts`                                                                                                                                                             |
| `sims`, `terminals` | object                 | Phase 3 plugin data, free-form                                                                                                                                                                             |

A `Slide` has `id`, `type` (`cover`\|`divider`\|`quote`\|`hero`\|`content`\|`references`\|`raw`),
`title` and `blocks` (required), plus `tag`, `group`, `subtitle`, `question`, `alert`, `refs`,
`layout`, `note`, `toc` (TOC/search label when it differs from `title`), the cover/hero/divider
fields `kicker`, `tagline`, `meta` (list of short lines), `art` (asset id, checked like an image
`asset`) and `dark` (components.md §1), and the type-specific `html` (raw), `no` (divider),
`cite` (quote) and `only` (references). The 21 block types and their fields are in `components.md`; `BLOCK_TYPES`
lists them in catalog order.

A `SlideNote` is `{time?, cues, raw?}`. `time` is `{minutes, from?, to?, remark?}`. A `Cue`
is `{k, t, id?, focus?: {targets}, wait?, marker?}`; `marker` keeps the authored marker when
it is an alias (`검증 보충`, `학생 질문`, `강사 답변`, `홉`) or unknown. See `notes.md`.

`parseNote` implements `notes.md` plus what the real decks need:

- aliases `[홉]` → HOP, `[학생 질문]` → SQ, `[강사 답변]` → SA; marker lookup ignores
  whitespace (`[예상 질문]`);
- bracketed key hints at line start (`[F]`, `[Esc]`, `[→]`) are text, not markers;
- the trailing `| 10초` wait must be a duration (`초`/`분`/`s`/`min`, or a range such as
  `30초~1분`), so `show rules | grep 99` stays text;
- `@target` tokens anywhere in LOOK/HOP cues, and leading tokens (right after the id) in any
  cue; `serializeNote` writes focus targets there;
- `[시간]` accepts `2분`, `2분 30초`, `2.5분 · 10:00 – 12:30` (en dash, em dash, hyphen or `~`), a range
  alone (minutes computed) and a trailing remark (`· 끝나면 휴식 10분`); unreadable time text
  becomes a MEMO cue with marker `시간`;
- text outside any cue (before the first marker, or after a heading or `===`) is a MEMO cue.

Fields added to the v0.1 contract by the schema package (all optional): `meta.duration`,
`Cue.marker`, `NoteTime.remark`, `Slide.no`, `Slide.cite`, `Slide.only`, and the budgets
`image.caption`, `video.label`/`caption`, `code.maxLines`/`maxCols`, `table.cellByCols`
(per-cell budget by column count; `table.cell` stays a number, the one-column fallback).

## 2. JSON Schema

`packages/schema/lecture.schema.json` (draft 2020-12, `$id` `urn:marco:lecture-ir:0.1`),
also exported as `lectureSchema` and importable as `@marco/schema/lecture.schema.json`.

- Every object has `additionalProperties: false` except `sims`, `terminals`, widget `params`
  and the `assets`/`terms` records (which constrain their values instead).
- `Block` is a `oneOf` over `$defs/<Type>Block`, each with `type: {const: "<type>"}`.
- Budgets appear in `description`s ("Budget: 90 chars") so a model sees them, but they are
  **not** validation rules: overflow is a lint finding.
- Source of truth is `src/schema.ts`, whose helper types make `tsc` fail if the schema and
  `types.ts` disagree. After changing it run `pnpm --filter @marco/schema schema:emit`; a test
  fails when the JSON file drifts.

## 3. Normalization — `normalizeLecture(input)`

Pure (returns a new object). Accepts `LectureInput` (a `Lecture` whose defaultable fields may
be missing) and applies:

- `ir` `"0.1"`; `meta.lang` `ko`, `meta.theme` `v20-violet`, `meta.edition` `instructor`;
  `meta.footer` `${course} · ${week}주차` when both exist.
- `refs`/`videos` `[]`, `assets`/`terms` `{}`, `slide.type` `content`, `slide.blocks` `[]`,
  `references` title `참고 자료`, `callout.kind` `info`, `note.cues` parsed from `note.raw`
  when absent.
- Slide ids `s-01`, `s-02`, … by 1-based position (`s-100` from 100 on). If an explicit id
  already uses the value, the auto id gets a suffix (`s-03-2`).
- Cue ids `pNN-cKKK` (NN slide position, KKK 0-based cue index, 3 digits); `auto` counts as
  missing; an index taken by an explicit id moves to the next free index.
- Strings trimmed, except `code`, `html` and `note.raw`; `params`/`sims`/`terminals` copied
  verbatim; empty `refs[].url` and `assets.*.source` dropped (they would fail `format: uri`).
- Unknown properties are kept so validation still reports them. Idempotent.

## 4. Validation — `validateLecture(input): ValidationResult`

```ts
type ValidationResult = { ok: true; lecture: Lecture } | { ok: false; errors: ValidationError[] };
interface ValidationError {
  path: string;
  message: string;
} // path = JSON pointer
```

Ajv 2020 with `allErrors`, so one call reports everything. Paths point at the thing to fix
and are not repeated in `message`; print `${path}: ${message}` (`formatValidationErrors`).

| Case               | `path`                             | `message`                                                                       |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| missing property   | `/slides/0/title`                  | `missing required property 'title'`                                             |
| unknown property   | `/slides/0/subtitel`               | `unknown property 'subtitel' (did you mean 'subtitle'?)` — or `(allowed: …)`    |
| unknown block type | `/slides/3/blocks/1`               | `unknown block type 'card' (did you mean 'cards'?)` — or `(expected one of: …)` |
| missing block type | `/slides/3/blocks/1/type`          | `missing required property 'type' (block type)`                                 |
| wrong type         | `/slides/0/blocks/1/items/0/title` | `must be a string (got integer)`                                                |
| enum / const       | `/meta/lang`                       | `must be one of 'ko', 'en' (got 'kr'; did you mean 'ko'?)`                      |
| pattern / format   | `/refs/0/url`                      | `must be a valid uri (got 'not a url')`                                         |
| root not an object | (empty)                            | `lecture must be a JSON object (got array)`                                     |

Errors inside a block only come from that block's own schema, never from the other 20
branches. Validation is structural only: ids, references and budgets are lint.

## 5. Lint — `lintLecture(lecture): LintIssue[]`

```ts
interface LintIssue {
  level: 'error' | 'warn' | 'info';
  code: string;
  path: string;
  message: string;
  slide?: string;
}
```

Issues are ordered by slide position; deck-level issues (no `slide`) come last. Messages are
Korean. Characters are counted as `Array.from(text).length` on the visible text (inline
Markdown markers and simple inline tags removed), so a Korean syllable is 1.

`LINT_CODES` also lists `icon.unknown`, which **the compiler** reports (it owns the Lucide icon
set; `lintLecture` has no icon list and never emits it). Tools that merge compiler warnings
with lint issues use the same table for levels.

| Code                                          | Level       | Fires when                                                                                                                      |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `budget.<block>.<field>`                      | warn        | text longer than `BUDGETS[block][field]`; message `cards[1].body: 104자 (허용 90자)`                                            |
| `budget.<block>.items`                        | warn        | too many items (chain, cards, steps, bullets, pills, timeline, tiles, terms, compare rows); cards/tiles limits depend on `cols` |
| `budget.table.rows` / `budget.table.cols`     | warn        | more than 8 rows / 6 columns                                                                                                    |
| `budget.table.cell`                           | warn        | a cell over `tableCellBudget(cols)`: `cellByCols` 2→40, 3→30, 4→20, 5→16, 6→12 (1 column → `cell` 40; over 6 → 12); cols = widest row or header; message `table.rows[0][1](cols=3): 35자 (허용 30자)` |
| `budget.slide.dense`                          | warn        | estimated body height over the available height by more than 10% (§5.1); path `/slides/N/blocks`; content and hero slides only  |
| `budget.code.lines` / `budget.code.cols`      | warn        | more than 12 lines / a line over 80 characters                                                                                  |
| `budget.slide.title\|subtitle\|tag\|question` | warn        | slide field over budget (a quote slide's title uses the quote budget)                                                           |
| `ref.missing`                                 | error       | `slide.refs`, `slide.only` or `quiz[].refs` names an id not in `refs`                                                           |
| `ref.unused`                                  | info        | a ref no slide or quiz item cites                                                                                               |
| `asset.missing`                               | error       | image block's `asset`, or a cover/hero/divider `art`, not in `assets`                                                           |
| `video.missing`                               | error       | video block's `video` not in `videos`                                                                                           |
| `slide.id.duplicate`                          | error       | a slide id repeats (reported on the later slide)                                                                                |
| `slide.title.missing`                         | error       | empty or blank title                                                                                                            |
| `columns.nested`                              | error       | a `columns` block inside a `columns` block                                                                                      |
| `columns.count`                               | warn        | `cols` differs from the number of columns                                                                                       |
| `table.ragged`                                | warn        | a body row has a different cell count than the header; one issue per table at the first such row (`… 외 2행`)                  |
| `icon.unknown`                                | warn        | **compiler only**: a cards/tiles `icon` is not a known Lucide name; rendered without the icon                                   |
| `quiz.ans.range`                              | error       | `ans` is not a valid index into `opts`                                                                                          |
| `note.marker.unknown`                         | warn        | a cue kept an unknown marker (`[설명]` → MEMO)                                                                                  |
| `note.time.invalid`                           | warn        | `[시간]` text could not be read, or a second `[시간]`                                                                           |
| `note.cues.over`                              | warn        | more than 30 cues on a slide                                                                                                    |
| `note.cue.long`                               | warn        | a cue over 600 characters                                                                                                       |
| `note.cue.id.duplicate`                       | warn        | a cue id repeats anywhere in the deck                                                                                           |
| `term.unused`                                 | info        | a `terms` key never appears in slide, note or quiz text                                                                         |
| `content.todo`                                | info        | a `TODO:` marker (also `TODO :`, full-width `TODO：`; case-sensitive, not inside a word) in any visible text field or note cue, one issue per field; deck-level for `meta`, `refs`, `videos`, `assets`, `terms`, `quiz` |
| `time.total`                                  | info / warn | sum of `[시간]` minutes; **warn** when it exceeds `meta.duration`                                                               |

`LINT_CODES` exports this table (level per code) for tools.

### 5.1 Slide density heuristic (`budget.slide.dense`)

A planning estimate of how tall a slide's body renders, so an overfull slide is caught before
anyone opens the deck. It is not a layout engine: the numbers are the design system's
measurements of the content scaffold at 1920×1080, and live in `DENSITY` in
`packages/schema/src/budgets.ts` (the design system tunes them there; this table must follow).

Available body height (content and hero slides; cover, divider, quote, references and raw
slides have their own layouts and are skipped):

| Slide head | Available |
| --- | --- |
| eyebrow + title | 760px (`DENSITY.body`) |
| + `subtitle` | − 60px (700) |
| + `question` strip | − 71px (689) |
| + both | 629px |

Estimated block heights (px):

| Block | Height |
| --- | --- |
| `chain` | 200 |
| `cards` | rows × 200 for `cols=2`, rows × 180 for `cols=3/4` (rows = ⌈items / cols⌉) |
| `takeaway` | 90 |
| `table` | 56 (header) + rows × 60 |
| `compare` | 60 (head) + rows × 64 |
| `callout` | 120 |
| `steps` | items × 64 |
| `bullets` | items × 44 |
| `paragraph` | 44 per started 90 visible characters (at least 44; lead paragraphs alike) |
| `image` | its `height`, else 420 |
| `video` | 96 |
| `quote` | 140 |
| `code` | lines × 36 + 60 |
| `pills` | 56 |
| `verdict` | 72 |
| `timeline` | items × 72 |
| `tiles` | 160 (one row) |
| `terms` | 90 per row of three terms (⌈items / 3⌉ × 90) |
| `columns` | the tallest column (its blocks plus gaps) |
| `widget` | 400 |
| `html` | 200 |

Blocks stack with a 28px gap (`--gap`), so the estimate is the sum of block heights plus
28 × (blocks − 1). The linter warns when `estimate > available × 1.10`, with the message
`slide.dense: 본문 높이 추정 1036px (허용 760px, 36% 초과 · 가장 큰 블록 #2 table 296px)` (block
numbers are 1-based, as in `-b<n>` element ids). `estimateBlockHeight`, `stackHeight` and
`availableBodyHeight` in `src/lint.ts` implement the table.

## 6. How tools consume the results

- **Compiler / CLI.** Normalize, then validate. Validation errors stop the build; print them
  as `path: message`, mapped back to `file:line` where the parser kept positions. Then lint:
  lint `error`s should fail `marco lint` (and `marco build --strict`), `warn`s print, `info`s
  print only with `--verbose` (`time.total` and `content.todo` are worth always showing: a
  leftover `TODO:` is the AI kit's "please check this"). Group output by `slide`. Report the
  compiler's `icon.unknown` with the lint `warn`s, at the level `LINT_CODES` gives it.
- **AI repair loop.** Send the model only the slides that have issues: for each `slide` id,
  that slide's source plus its `error` and `warn` issues as `code · path · message` lines
  (budget overflows, `budget.slide.dense` and `table.ragged` are warnings but are always worth
  repairing; `info` is never sent, so `content.todo` stays with the author, who has the facts).
  Deck level issues (`ref.unused`, `term.unused`, `time.total`) go to the author, not the model.
  Re-run normalize → validate → lint on the patched slide and stop when no errors or budget
  warnings remain, or after a fixed number of rounds.
- **Prompt kit.** Ship `lecture.schema.json` verbatim for JSON output; for MARCO source,
  `BUDGETS` and `components.md` carry the same limits.
- **Notes.** `parseNote`/`serializeNote`, `MARKERS`, `CANONICAL_MARKERS` and `CUE_LABELS` are
  the single implementation of `notes.md`. `serializeNote` returns `note.raw` verbatim while it
  still parses to the same cues (keeping `# 해설` headings and `===`), otherwise one cue per
  line; pass `{ canonical: true }` to force the compact form.
