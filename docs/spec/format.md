# MARCO source format v0.1 (`.marco.md`)

The authoring format the AI and the professor write. The compiler parses it into the
Lecture IR (`packages/schema/src/types.ts`) and renders HTML per `components.md`.
Design goals: cheap for an LLM to emit, readable by a human, one slide = one addressable
unit, the professor's existing note grammar (`notes.md`) unchanged.

## 1. File structure

```
---            ← YAML front matter (deck metadata, refs, videos, assets, terms)
…
---
# slide cover  ← slide header line
key: value     ← slide fields (until the first blank line)

body           ← Markdown + ::: containers
…
## note        ← optional presenter notes for this slide (until the next "# slide")
[대사] …
# slide
…
```

Encoding UTF-8, LF line endings. A file with no `# slide` line is an error.

## 2. Front matter (YAML)

| Key | Type | Notes |
|---|---|---|
| `title` | string | required |
| `course`, `presenter`, `date` | string | optional |
| `week` | number | optional |
| `lang` | `ko` \| `en` | default `ko` |
| `theme` | `v20-violet` \| `cau-navy` | default `v20-violet` |
| `edition` | `student` \| `instructor` | default `instructor`; CLI `--edition` overrides |
| `footer` | string | default `${course} · ${week}주차` |
| `refs` | map id → `{title, url?, kind?, note?}` | e.g. `S13: { title: "…", url: "https://…" }` |
| `videos` | map id → `{title, start?, credit?}` | id is the YouTube id |
| `assets` | map id → `{path, title?, credit?, source?, alt?}` | `path` relative to the source file. Image blocks may also reference a path directly; the compiler then creates an asset id from the file name |
| `terms` | map abbr → string | `LPR: "License Plate Recognition 차량번호 인식"` |

## 3. Slide header

```
# slide                          content slide (default)
# slide cover | divider | quote | hero | references | raw
# slide hero alert               type + flags
# slide id=principle-chain       explicit id (default s-01, s-02, … by position)
# slide divider id=part-1
```

Grammar: `# slide` then zero or more whitespace-separated tokens. A token that is a known
type sets `type`; `alert` sets `alert: true`; `key=value` sets the field. Unknown tokens are
an error. `# slide` must start at column 1. Markdown headings inside a body therefore use
`###` (never `#`).

## 4. Slide fields

`key: value` lines directly after the header, until the first blank line.

| Field | Slide types | Notes |
|---|---|---|
| `title` | all | required (a `references` slide defaults to "참고 자료") |
| `subtitle` | cover, divider, hero, quote, content | lead sentence |
| `kicker`, `tagline`, `meta` (list), `art` (asset id) | cover, hero, divider | see components.md §1; `dark` flag on the header line selects the dark variant |
| `toc` | all | TOC/search label when it differs from the visible title |
| `tag` | content, hero, quote | eyebrow text |
| `group` | all | TOC grouping label |
| `question` | all | guiding-question strip under the title |
| `refs` | all | `[S13, S14]` → "참고 출처" button |
| `layout` | content | `default` \| `wide` |
| `time` | all | `2.5분` or `2.5분 · 10:00 – 12:30` (same as `[시간]` in the note) |
| `note` | all | short inline note: `note: |` + indented lines. Long notes use `## note` |

Type-specific: `cover` uses `title` (the visible headline), `subtitle`, `kicker` (default from
front-matter `course`/`week`), `meta` (default `date`/`presenter`), `tagline`, `art`, and may have body
blocks (e.g. `:::pills`); `divider` uses `title`, `subtitle`, `no: 01`, optional `art` and body; `quote` uses `title` (the quote), `cite`;
`references` renders `refs` from the front matter (all of them, or `only: [S1, S2]`);
`raw` takes its body verbatim as HTML.

## 5. Body

Markdown (CommonMark + GFM tables) plus `:::` containers. Mapping to IR blocks:

| Markdown | Block |
|---|---|
| paragraph | `paragraph` |
| `### text` | `paragraph` with `lead: true` |
| `- item` list | `bullets` |
| `1. **제목** 설명` list | `steps` (bold run = title, rest = body) |
| GFM table | `table` |
| `> quote` (`— cite` last line) | `quote` |
| fenced code | `code` (info string = lang; `title="…"` after lang allowed) |
| `![alt](assets/x.png "caption")` alone in a paragraph | `image` |
| `:::name attrs` … `:::` | the named block (see `components.md`) |

Inline Markdown allowed in text fields: `**bold**`, `*em*`, `` `code` ``, links. Abbreviations
listed in `terms` are wrapped automatically for tooltips.

### Container syntax

```
:::cards cols=2
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 인증 뒤 문을 열지 않을 수도 있다.
:::

:::takeaway 핵심 구분
인증은 자격 확인, 인가는 허용 판단이다.
:::

:::chain
01 | 자격 제시 | 카드를 리더에 댄다
:::
```

- Attributes: `key=value`, `key="quoted value"`, bare `flag` (= true). The first bare token
  that is not a known attribute of that container is its **label** (`takeaway`, `callout`,
  `verdict`, `widget` use one).
- Item lists are either YAML lists (`- key: value` items) or **pipe rows** (`a | b | c`,
  one item per line), per container. Both are trimmed; empty lines are ignored.
- Containers may nest only inside `:::columns` → `:::col` (one level).
- Unknown container name → error (`format.container.unknown`).

## 6. Notes

Everything after a `## note` line, until the next `# slide`, is that slide's presenter
note, parsed by the grammar in `notes.md`. The raw text is also kept (`note.raw`).

## 7. Ids

- Slide ids: `id=` or `s-NN` (1-based, zero-padded to 2 digits).
- Cue ids: `pNN-cKKK` where NN is the slide position and KKK the cue index, assigned at
  build unless the note gives `{{p04-c002}}` explicitly. `{{auto}}` is accepted and replaced.
- Element ids inside a slide for `focus.targets`: components emit `id="s-04-b2"` per block
  (`<slide id>-b<block index>`) and `id="s-04-b2-i1"` per item.

## 8. Errors and lint

Parse errors carry `file:line` and a code (`format.*`). Lint (budgets, missing refs, time
budget, duplicate ids) is separate and comes from `@marco/schema` `lintLecture()`.

## 9. Example

See `examples/week03-iam/lecture.marco.md` (parity target for the V20 deck).
