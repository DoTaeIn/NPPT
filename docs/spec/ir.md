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
`layout`, `note`, and the type-specific `html` (raw), `no` (divider), `cite` (quote) and
`only` (references). The 21 block types and their fields are in `components.md`; `BLOCK_TYPES`
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
`image.caption`, `video.label`/`caption`, `code.maxLines`/`maxCols`.

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

| Code                                          | Level       | Fires when                                                                                                                      |
| --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `budget.<block>.<field>`                      | warn        | text longer than `BUDGETS[block][field]`; message `cards[1].body: 104자 (허용 90자)`                                            |
| `budget.<block>.items`                        | warn        | too many items (chain, cards, steps, bullets, pills, timeline, tiles, terms, compare rows); cards/tiles limits depend on `cols` |
| `budget.table.rows` / `budget.table.cols`     | warn        | more than 8 rows / 6 columns                                                                                                    |
| `budget.code.lines` / `budget.code.cols`      | warn        | more than 12 lines / a line over 80 characters                                                                                  |
| `budget.slide.title\|subtitle\|tag\|question` | warn        | slide field over budget (a quote slide's title uses the quote budget)                                                           |
| `ref.missing`                                 | error       | `slide.refs`, `slide.only` or `quiz[].refs` names an id not in `refs`                                                           |
| `ref.unused`                                  | info        | a ref no slide or quiz item cites                                                                                               |
| `asset.missing`                               | error       | image block's `asset` not in `assets`                                                                                           |
| `video.missing`                               | error       | video block's `video` not in `videos`                                                                                           |
| `slide.id.duplicate`                          | error       | a slide id repeats (reported on the later slide)                                                                                |
| `slide.title.missing`                         | error       | empty or blank title                                                                                                            |
| `columns.nested`                              | error       | a `columns` block inside a `columns` block                                                                                      |
| `columns.count`                               | warn        | `cols` differs from the number of columns                                                                                       |
| `quiz.ans.range`                              | error       | `ans` is not a valid index into `opts`                                                                                          |
| `note.marker.unknown`                         | warn        | a cue kept an unknown marker (`[설명]` → MEMO)                                                                                  |
| `note.time.invalid`                           | warn        | `[시간]` text could not be read, or a second `[시간]`                                                                           |
| `note.cues.over`                              | warn        | more than 30 cues on a slide                                                                                                    |
| `note.cue.long`                               | warn        | a cue over 600 characters                                                                                                       |
| `note.cue.id.duplicate`                       | warn        | a cue id repeats anywhere in the deck                                                                                           |
| `term.unused`                                 | info        | a `terms` key never appears in slide, note or quiz text                                                                         |
| `time.total`                                  | info / warn | sum of `[시간]` minutes; **warn** when it exceeds `meta.duration`                                                               |

`LINT_CODES` exports this table (level per code) for tools.

## 6. How tools consume the results

- **Compiler / CLI.** Normalize, then validate. Validation errors stop the build; print them
  as `path: message`, mapped back to `file:line` where the parser kept positions. Then lint:
  lint `error`s should fail `marco lint` (and `marco build --strict`), `warn`s print, `info`s
  print only with `--verbose` (`time.total` is worth always showing). Group output by `slide`.
- **AI repair loop.** Send the model only the slides that have issues: for each `slide` id,
  that slide's source plus its `error` and `warn` issues as `code · path · message` lines
  (budget overflows are warnings but are always worth repairing; `info` is never sent). Deck
  level issues (`ref.unused`, `term.unused`, `time.total`) go to the author, not the model.
  Re-run normalize → validate → lint on the patched slide and stop when no errors or budget
  warnings remain, or after a fixed number of rounds.
- **Prompt kit.** Ship `lecture.schema.json` verbatim for JSON output; for MARCO source,
  `BUDGETS` and `components.md` carry the same limits.
- **Notes.** `parseNote`/`serializeNote`, `MARKERS`, `CANONICAL_MARKERS` and `CUE_LABELS` are
  the single implementation of `notes.md`. `serializeNote` returns `note.raw` verbatim while it
  still parses to the same cues (keeping `# 해설` headings and `===`), otherwise one cue per
  line; pass `{ canonical: true }` to force the compact form.
