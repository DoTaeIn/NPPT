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
| `[이동]` | `HOP` | move focus to a target without speech |
| `[예상질문]` | `SQ` | expected student question |
| `[예상답변]` | `SA` | the answer to give |
| `[전환]` | `NEXT` | transition to the next slide / part |
| `[팁]` | `TIP` | teaching tip |
| `[대기]` | `WAIT` | pause; text is the duration or reason |
| `[화면]` | `SCREEN` | what is on screen (for the handout and for accessibility) |
| `[검증]`, `[검증 보충]` | `VERIFY` | fact-check / caveat text |
| `[메모]` | `MEMO` | anything else |
| `[시간]` | — | slide time budget → `note.time` (`2.5분 · 10:00 – 12:30`); not a cue |
| unknown `[…]` | `MEMO` | kept, with lint warning `note.marker.unknown` |

## Cue ids and focus

- `{{p06-c002}}` right after the marker is the cue id. `{{auto}}` or no id → assigned at build.
- `@target` tokens anywhere in a `LOOK`/`HOP` cue name focus targets (`@s-06-b1`, `@s-06-b1-i2`);
  they are removed from the text and stored in `focus.targets`.

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
