# Presenter note grammar v0.1

The professor's existing script format, unchanged. A note is a sequence of **cues**. Each cue
starts with a marker in square brackets at the start of a line and runs until the next marker,
heading or separator. Lines before the first marker form a `MEMO` cue.

## Markers → cue kinds

| Marker | Kind | Meaning |
|---|---|---|
| `[대사]` | `SAY` | what the instructor says |
| `[조작]` | `DO` | what the instructor does in the deck / room |
| `[주목]` | `LOOK` | point at / highlight something on the slide |
| `[발문]` | `ASK` | question to the class; optional trailing `\| 10초` → `wait` |
| `[이동]`, `[홉]` | `HOP` | move focus to a target without speech |
| `[예상질문]`, `[학생 질문]` | `SQ` | expected student question |
| `[예상답변]`, `[강사 답변]` | `SA` | the answer to give |
| `[전환]` | `NEXT` | transition to the next slide / part |
| `[팁]` | `TIP` | teaching tip |
| `[대기]` | `WAIT` | pause; text is the duration or reason |
| `[화면]` | `SCREEN` | what is on screen (for the handout and for accessibility) |
| `[검증]`, `[검증 보충]` | `VERIFY` | fact-check / caveat text |
| `[메모]` | `MEMO` | anything else |
| `[시간]` | — | slide time budget → `note.time` (`2.5분 · 10:00 – 12:30`); not a cue |
| unknown `[…]` | `MEMO` | kept, with lint warning `note.marker.unknown` |

The second marker in a row is an alias; see "Aliases and edge cases" below for exactly what the
parser accepts.

## Cue ids and focus

- `{{p06-c002}}` right after the marker is the cue id. `{{auto}}` or no id → assigned at build.
- `@target` tokens name focus targets (`@s-06-b1`, `@s-06-b1-i2`); they are removed from the
  text and stored in `focus.targets`. In `LOOK`/`HOP` cues they may appear anywhere; in every
  other cue only at the start of the text (right after the id). Details below.

## Aliases and edge cases (as implemented by `parseNote`)

`packages/schema/src/notes.ts` is the single implementation; this section describes it exactly.

### Marker aliases

| Authored | Kind | `cue.marker` | Notes |
|---|---|---|---|
| `[홉]` | `HOP` | `홉` | v9.7 deck |
| `[학생 질문]` | `SQ` | `학생 질문` | v9.7 deck |
| `[강사 답변]` | `SA` | `강사 답변` | v9.7 deck |
| `[검증 보충]` | `VERIFY` | `검증 보충` | v9.7 deck; `[검증]` is the canonical form |
| `[예상 질문]`, `[학생질문]`, `[검증보충]`, `[대 사]` … | by lookup | as authored | lookup ignores all whitespace, so spacing variants of any marker resolve |
| `[ 대사 ]` | `SAY` | — | surrounding spaces are trimmed; the result is canonical, so no `marker` is kept |

- `cue.marker` is set only when the authored name (trimmed, inner runs of whitespace collapsed to
  one space) differs from the canonical marker of its kind (`CANONICAL_MARKERS`), and for unknown
  markers. `serializeNote` writes a cue with the marker it carries, so aliases survive a round trip.
- A marker is `[` + 1–24 characters without brackets + `]` at the start of a line (leading
  spaces and tabs allowed), followed by the cue text on the same line.
- Unknown markers are only recognised when the name looks like a word: Hangul first, then Hangul,
  digits or spaces (`[설명]`, `[참고 2]`), or ASCII letters and spaces of at least two
  characters (`[Note]`, `[TODO]`). They become `MEMO` cues that keep `marker` and get
  `note.marker.unknown`. Anything else in brackets (`[S13]`, `[1/3]`, `[중요!]`) is ordinary text
  and continues the current cue.

### Key hints are text

A bracketed key name at the start of a line is a keyboard hint, not a marker, so the line is
text of the current cue: a single ASCII letter or digit (`[F]`, `[N]`, `[1]`), `F` plus one or two digits (`F5`, `F12`),
`Enter`, `Esc`, `Space`, `Tab`, `Shift`, `Ctrl`, `Alt`, `Cmd`, `Home`, `End`, `PgUp`, `PgDn`,
`PageUp`, `PageDown` (any letter case), the arrows `←` `→` `↑` `↓`, and `+` `-` `?` `/` `.` `,`.

```
[조작] 전체화면으로 바꾼다.
[F] 키를 한 번 누른다.        ← still part of the [조작] cue
```

### Trailing wait `| 10초`

A cue's text ending in `|` + a **duration** becomes `wait` (any cue kind, not only `[발문]`).
A duration is a number (decimals allowed) and a unit `초`, `분`, `s`, `sec`, `secs`, `min` or
`mins`, optionally a range joined by `~`, `–`, `—` or `-` (`30초~1분`). It must end the cue
text (the last line of a multi-line cue). Anything else stays text:

| Cue text ends with | `wait` |
|---|---|
| `… 단계는? \| 10초` | `10초` |
| `… \| 30초~1분` | `30초~1분` |
| `… \| 1.5 min` | `1.5 min` |
| `show rules \| grep 99` | — (not a duration; the pipe stays in the text) |
| `… \| 10초 정도` | — (does not end the text) |

### `@target` rules

- A target is `@` + an ASCII letter + letters, digits, `_` or `-`: `@s-06-b1`, `@card-steps-b2-i1`.
- **Leading targets, any cue kind:** after the optional `{{id}}`, one or more `@target` tokens at
  the very start of the cue text are taken (this is where `serializeNote` writes them).
- **Anywhere, `LOOK`/`HOP` only:** a token preceded by the start of a line, whitespace or `(` is
  taken wherever it appears; the text left behind has doubled spaces collapsed. So
  `user@example.com` is never a target, and a mid-sentence `@s-06-b1` in a `[대사]` stays text.
- Targets are de-duplicated in order of appearance.
- Processing order per cue: `{{id}}` → trailing wait → leading targets → anywhere targets
  (`LOOK`/`HOP`), so `[주목] {{p06-c001}} @s-06-b1 표를 짚는다 | 10초` gives id, wait and target.

### `[시간]`

- The first readable `[시간]` sets `note.time`; it is not a cue. Accepted: `2분`, `2.5분`,
  `2분 30초`, `3 min`/`3m`, each optionally followed by a clock range
  (`· 10:00 – 12:30`; en dash, em dash, hyphen or `~`; separator `·`, `・`, `,` or `/`) and a
  remark (`· 끝나면 휴식 10분`); or a clock range alone, whose minutes are computed
  (`10:00-12:30` → 2.5).
- Unreadable `[시간]` text, and any second `[시간]`, becomes a `MEMO` cue with marker `시간`
  (lint `note.time.invalid`).

### Text outside cues

Lines before the first marker, or after a heading or `===` separator and before the next
marker, form a `MEMO` cue without `marker`. Blank lines never end a cue; other lines continue it
(each line trimmed, joined with `\n`).

## Structure lines (ignored for cues, kept in `raw`)

- `# 해설 1|P06 · 해설 1–8` style headings
- `===` separators
- blank lines

## Example

```
[시간] 2.5분 · 10:00 – 12:30
[화면] 왼쪽 팩트 표, 오른쪽 빨간 CVE 카드, 아래 공격 체인 4단계.
[대사] {{p06-c000}} 좋은 수사관은 추리보다 사실부터 모읍니다. …
[주목] @s-06-b1 왼쪽 표 4행을 위에서부터 짚는다.
[발문] 이 네 단계 중 방화벽 룰이 직접 관여하는 단계는? | 10초
[전환] 다음 슬라이드에서 규칙 순서를 본다.
```

Parses to `time = {minutes: 2.5, from: "10:00", to: "12:30"}` and cues
`SCREEN, SAY(id p06-c000), LOOK(focus [s-06-b1]), ASK(wait "10초"), NEXT`.

## Budgets

`BUDGETS.note`: at most 30 cues per slide, 600 characters per cue (lint warnings). The total
of `[시간]` across the deck is compared with front-matter `duration` if given (`time.total`).
