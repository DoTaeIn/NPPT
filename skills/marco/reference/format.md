# MARCO source cheat-sheet (`.marco.md`)

Condensed by hand from the Korean kit (`marco ai kit --print`, section "컴포넌트 치트시트") and the
specs `docs/spec/format.md` and `docs/spec/components.md`. If this file and the kit ever disagree,
the kit and `BUDGETS` in `@marco/schema` win; report the difference.

**Budgets.** `≤N` is the maximum number of characters including spaces (a Hangul syllable counts 1;
Markdown markers such as `**` are not counted), or the maximum number of items, rows or columns.
Over-budget text is never cut: `marco build` / `marco lint` warn `budget.<block>.<field>` and you
shorten the source.

## 1. File layout

```
---
<YAML front matter>
---

# slide cover
<fields>

<body blocks>

# slide id=card-steps
<fields>

<body blocks>

## note
<presenter note>
```

UTF-8, LF line endings. Everything before the first `# slide` must be the front matter.

## 2. Front matter

| Key                         | Value                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                     | **required**; also the cover title when the cover has none                                                                                                                             |
| `course`, `week`            | course name; week number. Cover kicker defaults to `course · N주차`, footer too                                                                                                        |
| `date`, `presenter`         | cover `meta` defaults to these two                                                                                                                                                     |
| `duration`                  | planned minutes; lint compares the sum of slide times with it (`time.total`)                                                                                                           |
| `theme`                     | `v20-violet` (default, week-3 look) or `cau-navy` (week-5 look)                                                                                                                        |
| `edition`                   | `instructor` (default, notes included) or `student`; `--edition` overrides                                                                                                             |
| `lang`                      | `ko` (default) or `en`                                                                                                                                                                 |
| `footer`                    | overrides the `course · N주차` footer                                                                                                                                                  |
| `refs`                      | `S01: { title: "…", url: "https://…", kind: standard }` — id → `{title, url?, kind?, note?}`; `kind` is one of `standard`, `law`, `paper`, `vendor`, `article`, `video`, `other` |
| `videos`                    | YouTube id → `{title, start?, credit?}` (`start` in seconds or `mm:ss`)                                                                                                                |
| `assets`                    | id → `{path, title?, credit?, source?, alt?}`; `path` is relative to the source file (`assets/campus.png`)                                                                             |
| `terms`                     | `MFA: Multi-Factor Authentication 다중 요소 인증` — the abbreviation gets a tooltip everywhere it appears                                                                               |
| `quiz`, `sims`, `terminals` | plugin data, inline or a JSON sidecar path (`sims: sims.json`); only when the professor asks                                                                                           |

Only put a ref, video or asset here when you have its real title and URL/path (from the user, or
verified). Never invent one.

## 3. Slide header

`# slide` starts at column 1 (lowercase, one space), followed by optional tokens: one slide type,
the flags `dark` / `alert`, and `id=…`.

| Header                       | Slide                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `# slide id=card-steps`      | content (default type)                                                         |
| `# slide cover`              | cover                                                                          |
| `# slide divider id=part-1`  | part divider                                                                   |
| `# slide hero`               | question-first opener; `# slide hero alert` is the red warning variant         |
| `# slide quote`              | closing quote                                                                  |
| `# slide references`         | reference list                                                                 |
| `# slide cover dark`         | dark variant (`dark` on cover, hero, divider only; `alert` on hero, divider)   |
| `# slide raw`, `:::html`     | hand-written HTML escape hatch — **do not use**                                |

Ids: a letter first, then letters, digits, `-`, `_`. Give content slides a lowercase English id of
2–4 words (`id=card-steps`); without one the id is `s-NN` by position, which changes when slides
move. Never rename an existing id: notes target it (`@card-steps-b2`) and revisions address it.

## 4. Slide fields

`key: value` lines directly under the header, until the **first blank line**. Then one blank line,
then the body. Lists use YAML flow syntax: `refs: [S13, W06]`.

| Field                            | Budget            | Slide types                          | Use                                                                                          |
| -------------------------------- | ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `title`                          | ≤34 (quote ≤120)  | all                                  | required (cover defaults to the front-matter title, references to `참고 자료`); one claim  |
| `tag`                            | ≤16               | all                                  | eyebrow: `1부 · 3선 방어`, `도입`, `학습 안내`, `기본 원리`, `개념 정리`, `마무리`           |
| `subtitle`                       | ≤60               | cover, divider, hero, quote, content | lead sentence; on content slides it takes 60px of body height                                |
| `question`                       | ≤70               | all                                  | guiding-question strip under the title; takes 71px of body height                            |
| `refs`                           | —                 | all                                  | `[S13, W06]`: front-matter ref ids → "참고 출처" button                                      |
| `time`                           | —                 | all                                  | `3분` or `2.5분 · 10:00 – 12:30` (same value as the note's `[시간]`; see notes.md)           |
| `group`                          | —                 | all                                  | TOC group, e.g. `1부 · 인증과 하드웨어`                                                      |
| `toc`                            | —                 | all                                  | short TOC/search name when the title is a sentence                                           |
| `layout`                         | —                 | content, hero                        | `default` or `wide`                                                                          |
| `kicker`                         | —                 | cover, hero, divider                 | small line above the title (cover default `course · N주차`)                                  |
| `tagline`                        | —                 | cover, hero, divider                 | one uppercase English line: `PHYSICAL ACCESS × IDENTITY`                                     |
| `meta`                           | —                 | cover, hero, divider                 | `[중앙대학교 산업보안학과, 2026학년도 2학기]` (cover default: date, presenter)                |
| `art`                            | —                 | cover, hero, divider                 | asset id from front-matter `assets`, shown on the right half                                 |
| `no`                             | —                 | divider                              | part number, `no: 01` (quotes optional); default: the divider's position among dividers      |
| `cite`                           | ≤40               | quote                                | who said it                                                                                  |
| `only`                           | —                 | references                           | `[S1, S2]`; default: every front-matter ref                                                  |

A field on the wrong slide type is ignored with a warning (`format.field.type`); an unknown field
is an error (`format.field.unknown`). The inline `note: |` field exists, but write notes as a
`## note` section.

## 5. Slide types

- **content** (`# slide id=…`): `tag`, `title`, optional `question`, `refs`, `time`, `layout`; body
  of 2–3 blocks: one visual block (chain, cards, table, compare, steps, timeline …) plus one
  `takeaway`, `callout` or `verdict`. Do not repeat the same block combination on consecutive
  slides.
- **cover**: `title` (visible headline, may be a sentence; then add `toc` with the short name),
  `kicker`, `tagline`, `subtitle`, `meta`, `art`; body at most one `:::pills`.
- **divider**: `no: 01`, `title` (the part name, e.g. `인증과 하드웨어`), `subtitle` (one line),
  optional `group`, `kicker`, `art`; no body. The week-3 deck titles its dividers with a sentence
  and puts the part name in `toc` (`examples/03-part-divider.marco.md`); both forms are valid.
- **hero**: `tag`, `title`, `question`, optional `kicker`, `tagline`, `meta`, `art`; body like content.
- **quote**: `title` (the quote, ≤120), `cite` (≤40), optional `tag: 마무리`; no body.
- **references**: `title` (optional), `only` (optional); no body; renders the front-matter refs.

The height check (§8) applies to content and hero slides only.

## 6. Body: Markdown

| Write                                           | Block                                                  |
| ----------------------------------------------- | ------------------------------------------------------ |
| plain paragraph                                 | `paragraph` ≤220                                       |
| `### one sentence`                              | lead paragraph ≤90 (the only heading allowed in a body) |
| `- item` list                                   | `bullets`                                              |
| `1. **제목** 설명` list                          | `steps`                                                |
| GFM table                                       | `table`                                                |
| `> text` then `> — cite`                        | `quote`                                                |
| fenced code (` ```bash title="규칙 확인" `)      | `code`                                                 |
| `![alt](assets/x.png "caption")` alone on a line | `image`                                                |
| `:::name attrs` … `:::`                         | a component (§7)                                       |

Inline: `**bold**`, `*em*`, `` `code` `` (a code chip, e.g. `tcp/3389`), `[text](https://…)`.
Front-matter `terms` abbreviations are wrapped automatically. No nested lists, no `---` rules, no
`#`/`##` headings, no HTML.

## 7. Components

A `:::name` line opens a container and a line with only `:::` closes it; every container must be
closed. Attributes: `key=value`, `key="quoted value"`, bare flags. For `takeaway`, `callout`,
`verdict` the rest of the opening line is the label/title. Items are either YAML list items
(`- key: value`, continuation lines indented two spaces) or one pipe row per line (`a | b | c`,
cell order per block below); write `\|` for a literal `|` inside a cell. A pipe row has **no**
leading `- `: `- 인증 | 누구인가` is read as one text item whose title contains the pipes, with no
warning. Values need no quotes (colons, `#` and quotes inside are fine). Containers do not nest,
except `:::col` inside `:::columns` (one level).

### chain · numbered decision chain — items ≤6 · label ≤10 · sub ≤22 · height 200

```
:::chain
01 | 자격 제시 | 카드를 리더에 댄다
02 | 인증 | 유효한 자격인지 확인
:::
```

Row `no | label | sub`; without the number it is numbered automatically.

### cards · card grid — items ≤4/6/8 (cols=2/3/4) · kicker ≤16 · title ≤24 · body ≤90/60/40 (cols=2/3/4) · height 200 per row (cols=2), 180 per row (cols=3/4)

```
:::cards cols=2
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다.
  icon: door-open
  tone: warn
:::

:::cards cols=3
인증 | 누구인가 | 카드·PIN·생체로 자격을 확인한다
인가 | 들어가도 되는가 | 구역·시간·역할 조건을 본다
기록 | 무엇이 남는가 | 허용과 거부를 모두 남긴다
:::
```

Rows `kicker | title | body`, `title | body` or `title`; `icon` and `tone` only in the YAML form.
Always write `cols=`. Rows = ⌈items / cols⌉. `tone`: `neutral`, `primary`, `ok`, `warn`, `danger`,
`info`. `icon`: a Lucide icon name (lucide.dev). Checked names: `shield`, `shield-check`,
`shield-alert`, `lock`, `lock-open`, `key-round`, `door-open`, `door-closed`, `id-card`,
`fingerprint`, `user`, `users`, `server`, `database`, `network`, `router`, `wifi`, `globe`,
`cloud`, `laptop`, `smartphone`, `cpu`, `camera`, `clock`, `bell`, `siren`, `eye`, `search`,
`scroll-text`, `file-text`, `list-checks`, `book-open`, `lightbulb`, `info`, `circle-check`,
`circle-alert`, `triangle-alert`, `ban`, `activity`, `chart-line`, `scale`, `gavel`, `building`,
`graduation-cap`. If unsure, leave `icon` out (an unknown name only costs the warning
`icon.unknown`).

### takeaway · conclusion strip — label ≤8 · text ≤70 · height 90

```
:::takeaway 핵심 구분
인증은 자격 확인, 인가는 허용 판단이다.
:::
```

At most one per slide. Name the kind of conclusion: `핵심 구분`, `이 경우의 판단`, `설계 예`.

### table — cols ≤6 · rows ≤8 · cell ≤40/30/20/16/12 (cols=2/3/4/5/6) · height 56 + rows × 60

```
| 구역 예 | 확인할 대상 | 출입통제의 역할 |
|---|---|---|
| 1층 로비 | 직원·방문자 | 정상 인증과 동반 통과를 구분한다. |
```

The cell budget depends on the column count (a 3-column table allows 30 per cell). Every row must
have exactly as many cells as the header: an extra cell is **silently dropped** and a missing one
renders empty, and lint cannot see either in a Markdown table. Centre a column with `|:-:|`.
Caption: wrap the table in `:::table caption="…"` … `:::`. Header cells count against the budget
too.

### compare · side-by-side — rows ≤6 · label ≤10 · cell ≤60 · height 60 + rows × 64

```
:::compare left="1세대 · Stateless" right="2세대 · SPI"
보는 것 | 패킷 한 장의 주소·포트 | 패킷과 상태 테이블의 연결 기록
:::
```

Row `label | left | right`; `left=` and `right=` are required.

### callout · box — title ≤20 · body ≤160 · height 120

```
:::callout warn 수치의 전제
위 수치는 원리를 설명하기 위한 예다.
:::
```

Kind `info` (default), `warn`, `ok`, `danger`, then the title (optional).

### steps · ordered list — items ≤6 · title ≤24 · body ≤70 · height items × 64

```
1. **신청** 필요한 구역과 시간을 적는다
2. **승인** 다른 책임자가 필요성을 확인한다
```

Or `:::steps` with `- title: …` / `body: …` items, or rows `title | body`.

### bullets · list — items ≤6 · item ≤60 · height items × 44

```
- 인증은 누구인지 확인한다
- 인가는 허용 여부를 판단한다
```

### columns · 2–3 columns — height of the tallest column

```
:::columns cols=2
:::col
(blocks)
:::
:::col
(blocks)
:::
:::
```

Only one level; `cols` must equal the number of `:::col`.

### image — caption ≤60 · height 420 (or its `height`)

```
![외곽·로비·핵심구역 개념도](assets/campus.png "외곽·로비·핵심구역 개념도")
:::image asset=campus caption="외곽·로비·핵심구역 개념도" zoom height=420
:::
```

Only images that exist in `assets/` (or the front-matter `assets`). A path with spaces goes in
`<…>`: `![alt](<assets/출입 통제.png> "caption")`. Attributes: `asset`, `caption`, `zoom`,
`fit=contain|cover`, `height=<px>`, `alt`. No image yet → write `TODO: 이미지 — 무엇` in a paragraph.

### video · video button — label ≤40 · caption ≤60 · height 96

```
:::video id=tTAISQqmxWQ start=441 label="문틈 우회 시연" caption="DEF CON 33"
:::
```

`id` must be in front-matter `videos`; `start` in seconds or `mm:ss`.

### quote — text ≤120 · cite ≤40 · height 140

```
> 누구인지 확인하고, 필요한 권한만 허용한다.
> — 3주차 정리
```

### code — lines ≤12 · line length ≤80 · height lines × 36 + 60

````
```bash title="규칙 확인"
show rules
```
````

### pills · tags — items ≤8 · text ≤16 · height 56

```
:::pills
- ok: 허용
- danger: 차단
- 기록
:::
```

`- tone: text` or `- text` (tones as for cards).

### verdict · decision — label ≤8 · text ≤80 · height 72

```
:::verdict drop 1세대
서버의 SYN-ACK 응답 → 맞는 규칙 없음 → 폐기된다.
:::
```

Kind `allow`, `drop`, `ok`, `hot`, `info`, then an optional label (defaults 허용, 차단, 정상, 주의, 참고).

### timeline — items ≤6 · at ≤12 · title ≤20 · body ≤50 · height items × 72

```
:::timeline
D-7 | 신청 | 작업 구역과 기간을 적는다
:::
```

Row `at | title | body`.

### tiles · icon tiles — items ≤ cols (cols 2–5) · label ≤14 · value ≤12 · height 160

```
:::tiles cols=3
id-card | 인증 | 누구인가
key-round | 인가 | 무엇을 허용
scroll-text | 기록 | 남기고 검토
:::
```

Rows `icon | label | value | tone`, `icon | label | value`, `label | value`, `label`, or YAML
`- icon: … label: …`. One row of tiles: items = cols.

### terms · glossary — items ≤6 · abbr ≤8 · en ≤40 · ko ≤24 · height 90 per 3 terms

```
:::terms
MFA | Multi-Factor Authentication | 다중 요소 인증
:::
```

Row `abbr | en | ko`.

### paragraph — text ≤220 · lead ≤90 · height 44 per started 90 characters

```
### 협력사 점검원의 카드는 정상이다. 하지만 안전교육이 어제 만료됐다.

일반 문단은 그냥 쓴다. **굵게**, *기울임*, `코드`를 쓸 수 있다.
```

### widget, html

`:::widget <name>` mounts an interactive plugin (height 400): only when the professor asks for a
named widget. `:::html` (and `# slide raw`): never.

## 8. Body height (lint `budget.slide.dense`, content and hero slides)

Available height under the title: **760px**; with `subtitle` 700; with `question` 689; with both
629. Estimated heights: chain 200 · cards 200 per row (cols=2) or 180 per row (cols=3/4) ·
takeaway 90 · table 56 + rows × 60 · compare 60 + rows × 64 · callout 120 · steps items × 64 ·
bullets items × 44 · paragraph 44 per started 90 characters · image 420 (or `height`) · video 96 ·
quote 140 · code lines × 36 + 60 · pills 56 · verdict 72 · timeline items × 72 · tiles 160 ·
terms 90 per 3 terms · columns: the tallest column · widget 400 · html 200 · plus **28 between
blocks**. Lint warns above 110% of the available height; aim to stay under 100%.

Worked example: chain 200 + cards cols=2 with 2 items 200 + takeaway 90 + 2 × 28 = 546 ≤ 760.
A 5-row table (56 + 300) + callout 120 + 28 = 504; add a `question` (689) and it still fits.

## 9. Common mistakes

- A blank line inside the field block ends the fields: the lines after it become a body paragraph
  (`tag: 1부 refs: [S1]` on the slide) with **no** warning, and those fields are lost.
- `- 01 | 라벨 | 부제` in a pipe-row container: the leading `- ` turns the row into one text item,
  silently. Write `01 | 라벨 | 부제`.
- `# slide` not at column 1, or `#`/`##` headings in the body (`format.heading.level`).
- An unclosed `:::` (`format.container.unclosed`) swallows the rest of the slide.
- A container inside a container other than `:::columns` → `:::col`.
- `refs:` ids, `art:`, `asset=` and video `id=` that are not in the front matter.
- Both `time: 3분` and `[시간] 2분` on one slide (`format.note.time`): keep one, or make them equal.
- Emphasis before a Korean particle: `**인증**은` renders, but a bold or italic run that ends in
  punctuation and is followed directly by a letter does not (`**인증(Authn)**은` shows the
  asterisks). Move the punctuation out (`**인증**(Authn)은`) or put a space after the closing `**`.
