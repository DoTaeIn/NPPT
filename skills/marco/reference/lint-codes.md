# Build and lint codes

Every problem `marco build` and `marco lint` report, with the Korean message they print and the
fix. Codes and levels come from `LINT_CODES` in `@marco/schema` (`docs/spec/ir.md` §5) and from
the compiler's parser (`format.*`).

## Reading the output

```
lecture.marco.md:44  경고 [format.note.time] time: 필드와 노트의 [시간]이 달라 time: 필드를 씁니다.
  card-steps #4 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다 (lecture.marco.md:40)
    경고 budget.cards.body  cards[1].body: 104자 (허용 90자)
    오류 ref.missing  refs에 없는 참고 출처: S99
  덱 전체
    정보 time.total  노트 [시간] 합계 7분 / 강의 시간 20분 (슬라이드 4개 중 3개에 [시간])
린트 · 오류 1 · 경고 1 · 정보 1
✓ lecture.html · 383.6 KB · 슬라이드 4장 · 강의자용 · 글꼴 subset
```

- `file:line  level [format.…]` lines are parser diagnostics with a source line.
- Lint issues are grouped per slide: `<slide id> #<position> <title> (<file>:<line of # slide>)`,
  then `level code  message`. `덱 전체` holds deck-level issues.
- Levels: `오류` error, `경고` warning, `정보` info (info is hidden unless `--verbose`, except a
  count in the summary line).
- The summary `린트 · 오류 N · 경고 N · 정보 N` counts lint issues only. Parser lines
  (`file:line 경고 [format.…]`) are not in it, and `marco build` prints the compiler's
  `경고 [icon.unknown] … (<slide id>)` after it (`marco lint` lists `icon.unknown` under the slide
  and counts it). Read every line, not just the summary.
- `✗ 빌드 중단 · … 오류를 고친 뒤 다시 실행하세요.` means a `format.*` error: no HTML was written.
  Lint errors (such as `ref.missing`) do not stop `marco build` unless `--strict`; `marco lint`
  exits 1 on any error.
- Machine-readable: `marco lint <file> --json` → `{file, ok, diagnostics, lint, slideLines}`.
  `diagnostics[]` = parser issues `{level, code, message, file, line, slide?}`; `lint[]` = lint
  issues `{level, code, path, message, slide?}` where `path` is a JSON pointer into the IR
  (`/slides/3/blocks/1/items/0/body`: slide index 3 = 4th slide, block index 1 = `-b2`, item 0 =
  `-i1`); `slideLines` maps slide id → line of its `# slide`.

**Done** means: no `오류` line, and no `경고` line of kind `format.*`, `budget.*`,
`table.ragged`, `columns.*`, `icon.unknown` or `note.*`, anywhere in the output. `정보` lines are for the author; report `content.todo`
lines to the user instead of guessing.

## Parser codes (`format.*`)

| Code                                                   | Level | Message (Korean, as printed)                                                                | Fix                                                                                           |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `format.frontmatter.missing` / `.unclosed`             | 오류  | `파일은 '---'로 감싼 YAML 머리말로 시작해야 합니다 (title 필수).`                           | Start the file with `---`, YAML, `---`.                                                       |
| `format.meta.title`                                    | 오류  | `머리말(front matter)에 title이 필요합니다.`                                                | Add `title:` to the front matter.                                                             |
| `format.frontmatter.yaml` / `.refs` / `.assets` …      | 오류  | `refs.S01에 title이 필요합니다.` / `YAML 오류: …`                                            | Fix the YAML at that line (quote values with `:` or `#`).                                     |
| `format.frontmatter.unknown`                           | 경고  | `알 수 없는 머리말 키 'x'는 무시됩니다.`                                                    | Remove or rename the key (see format.md §2).                                                  |
| `format.meta.invalid`                                  | 오류  | `theme은 v20-violet \| cau-navy 중 하나여야 합니다: …`                                      | Use an allowed value (`week`, `duration` are numbers).                                        |
| `format.slide.none`                                    | 오류  | `파일에 '# slide' 줄이 없습니다.`                                                           | Add slides.                                                                                   |
| `format.slide.header`                                  | 오류  | `슬라이드 머리줄은 1열에서 '# slide'(소문자, 공백 하나)로 시작해야 합니다.`                 | Write exactly `# slide` at column 1.                                                          |
| `format.slide.orphan`                                  | 오류  | `첫 '# slide' 앞의 내용은 어느 슬라이드에도 속하지 않습니다.`                               | Move or delete text between the front matter and the first slide.                             |
| `format.slide.token`                                   | 오류  | `슬라이드 머리줄의 알 수 없는 토큰 'x'. 허용: cover, divider, …, alert, dark, key=value`     | Use a known type, `dark`, `alert` or `id=…` on the header.                                    |
| `format.slide.id`                                      | 오류  | `슬라이드 id는 영문자로 시작하고 영문·숫자·-·_만 쓸 수 있습니다: '…'`                       | Use an ASCII id such as `card-steps`.                                                         |
| `format.slide.dark` / `.alert`                         | 경고  | `alert는 hero와 divider 슬라이드에서만 쓰입니다.`                                           | Remove the flag or change the type.                                                           |
| `format.field.title`                                   | 오류  | `슬라이드에 'title:' 필드가 필요합니다.`                                                    | Add `title:` (only cover and references may omit it).                                         |
| `format.field.unknown`                                 | 오류  | `알 수 없는 슬라이드 필드 'x' ('y'을(를) 의도했나요?).`                                     | Fix the field name, or a missing blank line before the body.                                  |
| `format.field.type`                                    | 경고  | `필드 'x'는 content 슬라이드에서 쓰이지 않습니다.`                                           | Remove the field or change the slide type.                                                    |
| `format.field.duplicate`                               | 경고  | `필드 'x'가 두 번 지정되어 마지막 값을 씁니다.`                                              | Keep one.                                                                                     |
| `format.field.time` / `.invalid`                       | 오류  | `time은 '2.5분' 또는 '2.5분 · 10:00 – 12:30' 형식이어야 합니다: …`                         | Use that format.                                                                              |
| `format.note.time`                                     | 경고  | `time: 필드와 노트의 [시간]이 달라 time: 필드를 씁니다.`                                     | Keep only one of `time:` and `[시간]`, or give both the same minutes.                         |
| `format.note.header` / `.position` / `.duplicate`      | 오류/경고 | `노트 섹션 머리줄은 정확히 '## note'로 써야 합니다.`                                    | One `## note` line at the end of the slide.                                                   |
| `format.heading.level`                                 | 오류  | `본문 제목은 '###'을 씁니다 ('##'는 슬라이드·노트 구분과 겹칩니다).`                        | Use `###` (a lead sentence) in the body.                                                      |
| `format.container.unknown`                             | 오류  | `알 수 없는 컨테이너 ':::card' (':::cards'을(를) 의도했나요?).`                              | Use a block name from format.md §7.                                                           |
| `format.container.unclosed` / `.stray`                 | 오류  | `:::callout 컨테이너가 닫히지 않았습니다 (닫는 ::: 필요).`                                   | Close every container with a `:::` line; remove extra `:::`.                                  |
| `format.container.nesting`                             | 오류  | `:::cards 안에는 다른 컨테이너를 넣을 수 없습니다 (':::pills').`                             | Put the blocks one after another; only `:::columns` → `:::col` nests.                         |
| `format.container.empty`                               | 오류  | `:::takeaway에 본문 텍스트가 필요합니다.`                                                    | Add the text or items.                                                                        |
| `format.item.cells`                                    | 오류  | `:::chain 행은 '01 \| 라벨 \| 부제' 형식이어야 합니다 (칸 4개).`                             | Match the row shape; escape a literal pipe as `\|`.                                           |
| `format.item.missing` / `.syntax` / `.tone`            | 오류  | `:::cards 항목에 title이(가) 필요합니다.`                                                    | Add the required key; `tone` is neutral, primary, ok, warn, danger or info.                   |
| `format.item.key`                                      | 경고  | `:::cards 항목의 알 수 없는 키 'x'는 무시됩니다 (허용: kicker, title, body, icon, tone).`   | Use an allowed key.                                                                           |
| `format.attr.invalid` / `.missing` / `.unknown`        | 오류/경고 | `:::cards의 cols는 2, 3, 4 중 하나여야 합니다: 5` / `:::compare에는 left="…" right="…" 속성이 필요합니다.` | Fix the attribute on the `:::` line.                                          |
| `format.columns.count` / `.content`                    | 오류/경고 | `:::columns에는 :::col이 2개 또는 3개 필요합니다 (현재 1개).`                            | 2–3 `:::col` children, `cols=` equal to their number, nothing outside them.                   |
| `format.table.missing` / `.extra`                      | 오류/경고 | `:::table 안에 GFM 표(\| a \| b \| + 구분선)가 필요합니다.`                              | Exactly one GFM table inside `:::table`.                                                      |
| `format.list.nested`                                   | 경고  | `중첩 목록과 목록 안의 블록은 지원하지 않아 무시됩니다.`                                    | Flatten the list; use cards or steps for structure.                                           |
| `format.hr.ignored`                                    | 경고  | `본문의 구분선('---')은 무시됩니다.`                                                         | Remove `---` / `===` lines from the body.                                                     |
| `format.image.inline` / `.remote`, `format.asset.unknown` | 경고/오류 | `이미지는 문단에 단독으로 써야 image 블록이 됩니다. …`                                | Image alone on its line; local files only; ids from front-matter `assets`.                    |

## Lint codes

| Code                                               | Level     | Message (example)                                                                         | Fix                                                                                                               |
| -------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `budget.<block>.<field>`                           | 경고      | `cards[1].body: 104자 (허용 90자)`                                                        | Shorten that text, keeping the meaning. The index is 0-based (`cards[1]` = second card).                          |
| `budget.<block>.items`                             | 경고      | `cards.items(cols=2): 5개 (허용 4개)`                                                             | Merge or drop the least important items, change `cols`, or split the slide.                                       |
| `budget.table.cell`                                | 경고      | `table.rows[0][1](cols=3): 35자 (허용 30자)`                                              | Per-cell budget by column count: 40/30/20/16/12 for 2–6 columns. Shorten, or drop a column.                       |
| `budget.table.rows` / `.cols`                      | 경고      | `table.rows: 9행 (허용 8행)`                                                              | At most 8 rows and 6 columns; split the table or the slide.                                                       |
| `budget.slide.title` / `subtitle` / `tag` / `question` | 경고  | `title: 42자 (허용 34자)`                                                                 | 34 / 60 / 16 / 70 characters. Rewrite the title as a shorter claim.                                               |
| `budget.slide.dense`                               | 경고      | `slide.dense: 본문 높이 추정 1036px (허용 760px, 36% 초과 · 가장 큰 블록 #2 table 296px)` | Remove a block, cut rows or items, drop the subtitle/question, or split into two slides. `#2` = second block.     |
| `budget.code.lines` / `.cols`                      | 경고      | `code.lines: 14줄 (허용 12줄)`                                                            | ≤12 lines, ≤80 characters per line.                                                                               |
| `table.ragged`                                     | 경고      | `table.rows[0]: 칸 2개 (머리글 3개)`                                                      | Give every row the header's cell count. (In a Markdown table lint cannot see this; check by eye, see format.md.) |
| `columns.nested`                                   | 오류      | `columns 안에 columns를 넣을 수 없습니다 (한 단계만 허용)`                                 | One level of columns.                                                                                             |
| `columns.count`                                    | 경고      | `columns cols=3인데 열이 2개입니다`                                                       | Make `cols=` equal the number of `:::col`.                                                                        |
| `icon.unknown` (compiler)                          | 경고      | `알 수 없는 Lucide 아이콘 'x'은(는) 표시되지 않습니다.`                                   | Use a Lucide icon name or remove `icon:`.                                                                         |
| `ref.missing`                                      | 오류      | `refs에 없는 참고 출처: S99`                                                              | Cite an existing id, or add the real source to front-matter `refs`; if you have none, remove it and leave `TODO: 출처 필요 — …`. |
| `asset.missing`                                    | 오류      | `assets에 없는 이미지: campus`                                                            | Register the file in front-matter `assets` (the file must exist) or remove the image and leave `TODO: 이미지 — …`. |
| `video.missing`                                    | 오류      | `videos에 없는 영상: ID`                                                                  | Add the video to front-matter `videos` (real YouTube id) or remove the block.                                     |
| `slide.id.duplicate`                               | 오류      | `중복된 슬라이드 id: b (1번 슬라이드와 같음)`                                              | Rename the later slide's id (and its note targets).                                                               |
| `slide.title.missing`                              | 오류      | `슬라이드 제목(title)이 비어 있습니다`                                                    | Add a title.                                                                                                      |
| `quiz.ans.range`                                   | 오류      | `퀴즈 q1 정답 번호 4가 보기 범위(0–3)를 벗어납니다`                                       | `ans` is a 0-based index into `opts`.                                                                             |
| `note.marker.unknown`                              | 경고      | `알 수 없는 노트 표시 [설명] → 메모로 처리했습니다`                                       | Use a marker from notes.md.                                                                                       |
| `note.time.invalid`                                | 경고      | `[시간]을 해석할 수 없거나 중복입니다: "…" (예: 2.5분 · 10:00 – 12:30)`                   | One readable `[시간]` per note.                                                                                   |
| `note.cues.over`                                   | 경고      | `노트 큐 34개 (허용 30개)`                                                                | Merge short cues or split the slide.                                                                              |
| `note.cue.long`                                    | 경고      | `cues[3] 대사: 640자 (허용 600자)`                                                        | Split the cue into two of the same marker.                                                                        |
| `note.cue.id.duplicate`                            | 경고      | `중복된 큐 id: p04-c002`                                                                  | Remove hand-written `{{…}}` cue ids.                                                                              |
| `time.total`                                       | 정보/경고 | `노트 [시간] 합계 152분 > 강의 시간 150분 (2분 초과, …)`                                   | Warning when the sum exceeds `duration`: rebalance slide times (fix the outline first).                           |
| `content.todo`                                     | 정보      | `확인할 TODO가 남아 있습니다: "TODO: 출처 필요 — …"`                                       | Intentional: the professor checks it. List them for the user; do not invent the missing fact.                     |
| `ref.unused`                                       | 정보      | `어느 슬라이드에서도 인용하지 않은 참고 출처: S01`                                         | Cite it where it applies, or leave it (the references slide lists it).                                           |
| `term.unused`                                      | 정보      | `본문에 쓰이지 않은 용어: IAM`                                                             | Remove the term or use it.                                                                                        |

## Repair loop

1. Collect the issues per slide id (text output or `--json`).
2. For each slide with `오류` or `경고`, open that slide only, fix every listed issue, keep the id,
   `tag`, `refs` and note unless the issue is about them. Renumber note targets if blocks moved.
3. Rebuild. Stop when done (above) or after three rounds; then report what is left and why.
4. Deck-level `ref.unused`, `term.unused`, `time.total` (info) and every `content.todo` go to the
   user, not into guesses.

## Known quirks

- A Markdown table row with more cells than the header loses the extra cells silently, and one
  with fewer renders empty cells; `table.ragged` does not fire for Markdown tables. Count cells.
- When two slides share an id, both are listed under each group (`b #1 …` twice): fix the
  `slide.id.duplicate` first.
- No code fires for a blank line inside a slide's field block (the remaining fields become a
  paragraph) or for a `- ` in front of a pipe row (the row becomes one text item). Check the
  built slide or the source when a field seems to have no effect.
- Note focus targets are not checked: `@card-steps-b9` or a misspelled slide id pass silently.
  Count the blocks (and items) of the slide when you write or renumber targets.
