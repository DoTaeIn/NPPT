# Presenter notes: the `## note` grammar

Condensed from the kit's "해설 문법" and "작업: 해설" prompts and `docs/spec/notes.md`. Write notes
only when the user asks for them, and as a separate pass after the slide bodies.

## Where

A `## note` line at the end of a slide; everything after it until the next `# slide` is that
slide's note. One `## note` per slide.

```
# slide id=card-steps
tag: 기본 원리
title: 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다

:::chain
…
:::

## note
[시간] 3분 · 6:00 – 9:00
[화면] 위 5단계 체인, 아래 카드 2장, 맨 아래 '핵심 구분' 띠.
[대사] …
```

## Markers

A marker in square brackets at the start of a line starts a cue; the cue runs until the next
marker (blank lines do not end it). Use only these:

| Marker        | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `[시간]`      | the slide's time, once, first line: `3분`, `2.5분 · 10:00 – 12:30`       |
| `[화면]`      | what is on screen (for the handout and accessibility)                   |
| `[대사]`      | what the instructor says                                                |
| `[주목]`      | point at a block: `[주목] @card-steps-b1 체인을 01부터 짚는다.`          |
| `[조작]`      | an action: click, run a demo, full screen                               |
| `[이동]`      | move the focus without speech: `[이동] @card-steps-b3`                  |
| `[발문]`      | a question to the class, ending in a wait: `… 어디일까요? \| 10초`      |
| `[예상질문]`  | a question students are likely to ask                                   |
| `[예상답변]`  | the answer to it                                                        |
| `[팁]`        | a teaching tip                                                          |
| `[대기]`      | a pause (duration or reason)                                            |
| `[검증 보충]` | fact-check and caveats (versions, law articles, conditions of a number) |
| `[전환]`      | the bridge to the next slide                                            |
| `[메모]`      | anything else, including `TODO:`                                        |

Any other bracketed word at the start of a line (`[설명]`, `[Note]`) becomes a memo with the
warning `note.marker.unknown`. A bracketed key name (`[F]`, `[Esc]`, `[→]`) at the start of a
line is text, not a marker.

## Focus targets

`@<slide id>-b<block number>`, plus `-i<item number>` for an item. Blocks are numbered 1, 2, 3 in
body order (a `###` lead paragraph is a block too); items are cards, chain steps, table rows,
timeline entries and so on. Example: `@card-steps-b2-i1` = the first card of the second block.
In `[주목]` and `[이동]` a target may appear anywhere; in other cues only right after the marker.
Without an explicit `id=` the slide id is `s-NN` (its position), so give the slide an id before
you write targets. When a revision reorders blocks, renumber the targets.

## Waits and times

- A wait is `| <number><unit>` at the very end of a cue: `| 10초`, `| 30초~1분`, `| 1.5 min`.
  Anything else after a `|` stays text.
- `[시간]` appears once per note. The slide field `time:` sets the same value; use one of the two,
  or give both the same minutes (otherwise the warning `format.note.time`, and `time:` wins).
- The sum of all slide times is compared with the front-matter `duration` (`time.total`).

## Do not write

- Cue ids (`{{p04-c002}}`, `{{auto}}`): the build assigns them.
- `#` headings or `===` separators inside a note.
- More than 30 cues per slide (`note.cues.over`) or more than 600 characters in one cue
  (`note.cue.long`).

## How to write a note (kit task "해설")

1. Order: `[시간]` → `[화면]` → (`[검증 보충]`) → `[대사]` / `[주목]` / `[조작]` repeated →
   `[발문]` → a `[대사]` that resolves the question → (`[예상질문]` / `[예상답변]`) → `[전환]`.
2. `[시간]`: the value you were given, else the slide's `time:` value.
3. Length: `[대사]` plus `[예상답변]` ≈ 350 characters per minute of slide time (speaking speed);
   one `[대사]` 150–400 characters. If the professor asks for the week-5 "rich script", use about
   900 per minute and watch the 30-cue limit.
4. Every `[주목]` names its block with `@<id>-bN`.
5. `[발문]` connects to the slide's question or key point and ends with a wait (`| 10초`).
6. Speech style: polite lecturing Korean (…예요, …죠, …거든요), one idea at a time, one everyday
   analogy (경비원, 출입 명단, 방문 기록부, 출입증), and repeat the slide's key sentence in the last
   `[대사]`.
7. Unsure of a fact: `[검증 보충] TODO: 확인할 내용`.
8. `[전환]` leads naturally into the next slide's title.

A complete note is in `examples/04-principle-chain-note.marco.md`.
