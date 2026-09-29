---
name: marco
description: Create and revise university lecture decks (강의 슬라이드, 강의 덱, 발표 자료, 해설/강의 대본) with the MARCO Engine. Use this whenever the user wants lecture slides or presenter notes written, extended, shortened or fixed; whenever a `.marco.md` file (usually `lecture.marco.md`) is involved; when `marco build`, `marco lint` or `marco pdf` print errors or warnings (`format.*`, `budget.*`, `ref.missing`, `budget.slide.dense` …); or when an old single-file HTML lecture deck should be imported. You write compact MARCO source (Markdown with `# slide` blocks and `:::` components), never HTML, and the `marco` CLI (npm package `marco-engine`) or the `marco_*` MCP tools compile it into one offline 1920×1080 HTML deck.
---

# MARCO lecture decks

MARCO keeps the deck engine (runtime, design system, fonts, icons, print modes) apart from the
lecture content. You write only the content, as MARCO source: YAML front matter, then one
`# slide` block per slide with `key: value` fields, Markdown and `:::` components, and an optional
`## note` presenter script. `marco build` inlines everything into one HTML file.

Read before writing (paths relative to this file):

| File                       | What                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `reference/format.md`      | Every slide type, field and block: syntax, character budget, height. **Read first.**                             |
| `reference/notes.md`       | The `## note` grammar and how to write a note. Read before writing notes.                                        |
| `reference/lint-codes.md`  | Every build/lint code: the Korean message and the fix.                                                           |
| `reference/examples/`      | Real slides from the week-3 deck (chain+cards+takeaway, table+takeaway, divider) and one slide with a full note. |
| `reference/workflow-ko.md` | This workflow in Korean, for explaining it to the professor.                                                     |

These condense the Korean prompt kit that professors paste into chat assistants
(`marco ai kit --print`); the rules are the same. The kit's chat-only rules (reply in one code
fence, answer "준비됨") do not apply when you edit files directly.

## 1. Find the tools

| Situation                                         | Run `marco` as                     |
| ------------------------------------------------- | ---------------------------------- |
| `marco --version` works (`npm i -g marco-engine`) | `marco …`                          |
| npm is available, `marco` is not installed        | `npx -y marco-engine …` (same CLI) |
| Inside the NPPT repository (after `pnpm build`)   | `node apps/cli/dist/main.js …`     |

If tools named `marco_*` are available (MCP server `marco-mcp`), you may use them instead (§4).
The CLI prints Korean messages; exit code 0 = success, 1 = error. Do not install Chromium or
other system software without asking; only `marco pdf` needs a browser.

## 2. Workflow

1. **Learn the format.** Read `reference/format.md` (over MCP: `marco_kit` with section
   `cheatsheet`). For notes, also `reference/notes.md`. Look at one example in
   `reference/examples/`.
2. **Scaffold or open the deck.** New deck:
   `marco new week06 --title "6주차 · IDS/IPS" --course "보안시스템 운영 및 활용" --week 6`
   (add `--theme cau-navy` for the week-5 look). This writes `week06/lecture.marco.md` (front
   matter plus three practice slides: delete them) and `week06/assets/`. Fill the front matter:
   `title`, `course`, `week`, `date`, `presenter`, `duration` (minutes), `refs` and `terms`. The
   scaffold's values are placeholders (`presenter: 담당 교수`, `duration: 20`, the sample ref
   `S01` pointing to `https://example.com`, the sample term `IAM`): replace or delete them. Add
   a ref only with a title and URL the user gave you or that you opened and confirmed. Existing
   deck: read its front matter and the slides you will touch.
3. **Plan.** For a new deck, write the outline first, one line per slide:
   `번호 | 태그 | 제목 | 한 줄 의도 | 분`. A full lecture has 30–45 slides: 표지 → 도입 (case,
   question) → 학습 안내 → 1부, 2부 (, 3부), each opened by a divider and 8–15 slides long →
   개념 정리 → 마무리 → 참고 자료. One claim per slide; minutes in 0.5 steps adding up to
   `duration`. Show the outline to the user before writing 40 slides.
4. **Write the slides**, about six at a time, into `lecture.marco.md` after the front matter:
   one `# slide` per outline line, keeping its tag and title. Content slides get
   `# slide id=<2–4 lowercase English words>`, `tag`, `title`, `time`, and `question`/`refs` when
   useful; the body is 2–3 blocks (one visual block + one `takeaway`, `callout` or `verdict`).
   Count characters against the budgets and add up block heights (format.md §8) as you write.
5. **Build:** `marco build week06/lecture.marco.md` → `week06/lecture.html`. The build prints
   parser diagnostics, then the lint grouped by slide, then `✓ …` (or `✗ 빌드 중단` when a
   `format.*` error stopped it).
6. **Fix only the flagged slides** (§7, `reference/lint-codes.md`), rebuild, repeat until no
   `오류` or `경고` line is left anywhere in the output. The summary `린트 · 오류 0 · 경고 0`
   alone is not enough: it does not count the `file:line 경고 [format.…]` lines printed above it,
   and `marco build` prints `경고 [icon.unknown]` below it. Leave `정보 content.todo` for the
   professor.
7. **Notes** only when asked, as a separate pass (§6).
8. **Deliver** what was asked: the HTML path; a student edition
   (`marco build <file> --edition student -o <name>-student.html`); PDFs (`marco pdf <file>`,
   `marco pdf <file> --mode handout`). Finish with a short report: slides written or changed,
   the lint summary, and every remaining `TODO:` for the professor to check.

**Revising.** "Fix slide 12" means the 12th `# slide` in the file (count the header lines) or the
slide whose `id=` was named. Change only that slide and only what was asked; keep its header and
id, `tag`, `refs` and `## note` unless the request is about them; if blocks are added, removed or
reordered, renumber the note's `@<id>-bN` targets. Never rewrite, reorder or summarize other
slides on the way.

## 3. CLI (checked against `marco --help` and each command's `--help`)

| Command                                                        | Options                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marco new <dir>`                                              | `--title <title>` `--course <course>` `--week <n>` `--theme v20-violet\|cau-navy` `--force` (overwrite an existing `lecture.marco.md`)                                                                                                                |
| `marco build <file>`                                           | `-o, --out <file>` (default `<name>.html` next to the source) `--edition student\|instructor` `--theme v20-violet\|cau-navy` `--fonts subset\|embed\|none` (default `subset`) `--keep-png` `--strict` (exit 1 on lint errors) `--verbose` (also info) |
| `marco lint <file>`                                            | `--json` (`{file, ok, diagnostics, lint, slideLines}`) `--verbose`; exit 1 when there is an error                                                                                                                                                     |
| `marco watch <file>`                                           | the build options; rebuilds on every save until Ctrl+C. Only start it in the background.                                                                                                                                                              |
| `marco pdf <file>`                                             | `.marco.md` (built first) or a built `.html`; `--mode lecture\|handout` (1920×1080 page per slide, or A4 with notes) `-o, --out <file>` `--timeout <sec>` (default 60) and the build options. Needs Playwright's Chromium.                            |
| `marco import <legacy.html> <outDir>`                          | `--family auto\|v20\|v97` `--keep-source` (keep an edited `lecture.marco.md`) `--asset-dir <dir>` (default `assets`); writes `lecture.marco.md`, `assets/`, `IMPORT-REPORT.md`                                                                        |
| `marco ai kit`                                                 | `-o, --out <dir>` (default `.marco/ai/kit`) `--print`: the Korean kit, for a professor who uses a chat window                                                                                                                                         |
| `marco ai outline\|slides\|notes\|revise\|repair\|merge-notes` | the same steps for chat or API users. By default they write prompt files and **wait forever** for a reply file (`--timeout 0`); as an agent, do these steps yourself and run them only when the user asks.                                            |

## 4. MCP tools

When the `marco-mcp` server is connected, its tools do the same jobs on files under the server's
root folder. Arguments are in each tool's input schema; the main ones are shown.

| Tool                                                       | Job                                                                                              | CLI / file equivalent          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| `marco_kit { section? }`                                   | the Korean kit; `section`: `all`, `rules`, `cheatsheet`, `notes`, `style`, `review`, `examples`  | `marco ai kit --print`         |
| `marco_spec { name }`                                      | a spec document (English): `format`, `components`, `notes`, `ir`, `runtime`                      | `docs/spec/*.md`               |
| `marco_new { dir, title, course?, week?, … }`              | scaffold `<dir>/lecture.marco.md` (never overwrites)                                             | `marco new`                    |
| `marco_read { path, slide? }`                              | read a deck, or one slide by number or id                                                        | reading the file               |
| `marco_check_slide { slide_source, front_matter? }`        | check one `# slide` block before it goes into the deck; returns the height estimate              | build + lint on a scratch deck |
| `marco_replace_slide { source_path, slide, slide_source }` | replace one slide in place (several blocks split it); backs up the file, returns the deck's lint | editing that slide             |
| `marco_lint { source_path \| source_text }`                | check without writing HTML                                                                       | `marco lint --json`            |
| `marco_build { source_path?, source_text?, … }`            | build; with both, saves the text to the path first (backup in `.marco/mcp/backups/`)             | `marco build`                  |
| `marco_preview { source_path, slide }`                     | PNG of one slide (1-based), once lint is clean                                                   | open the HTML                  |
| `marco_import { html_path, out_dir, … }`                   | convert a legacy single-file HTML deck                                                           | `marco import`                 |

Results carry the same codes as the CLI plus a Korean `repair_hint` per issue; §7 applies. Where
the server's own instructions differ in detail (for example "start with `marco_kit`"), both are
fine: the kit and `reference/` hold the same rules.

## 5. Golden rules

1. **MARCO source only.** No HTML, CSS, JavaScript, `<tags>`, style instructions, `# slide raw` or
   `:::html`. Never edit the built `.html`. If MARCO cannot express something, say so.
2. **One slide = one `# slide` block**, the header at column 1. Fields directly under it until the
   first blank line, then the body. In the body use `###` only; `#` and `##` belong to `# slide`
   and `## note`.
3. **Respect the budgets**: characters per field, items/rows/columns per block, and the body
   height (format.md §8). Too much → shorten, merge, or split the slide into two.
4. **Notes** go under `## note` at the end of the slide, in the marker grammar of
   `reference/notes.md`, and only when asked.
5. **Korean style.** Slide text is short declarative Korean (…다). A title is one claim ending in
   "…이다/…한다" (≤34), contrasts as "A는 X, B는 Y"; question titles only for openers and cases.
   Tags: `N부 · 주제어`, or `도입`, `학습 안내`, `기본 원리`, `개념 정리`, `마무리`, `참고 자료`.
   Card bodies one or two sentences. No "~합니다", "매우", "다양한", "!" or emoji. Lists with `·`;
   expand an abbreviation the first time (`MFA · Multi-Factor Authentication`). Be concrete:
   resource, action, condition, real numbers with their assumptions; separate confirmed facts
   from open ones. In notes, `[대사]` is spoken lecturing style (…예요, …죠).
6. **Cite by id only**: `refs: [S13, W06]`, ids from the front-matter `refs`. Never invent URLs,
   YouTube ids, image paths, statistics, law article numbers, product models or dates.
7. **When unsure, leave a TODO in place**: `TODO: 확인할 내용`, `TODO: 출처 필요 — 무엇`,
   `TODO: 이미지 — 무엇`. `marco lint --verbose` collects them for the professor.
8. **Touch only what was asked.** Keep slide ids stable; never rewrite other slides.

## 6. Notes pass (when asked)

Per slide, append `## note` and write, in this order: `[시간]` (the slide's `time` value) →
`[화면]` → optional `[검증 보충]` → `[대사]`/`[주목] @<id>-bN`/`[조작]` repeated → `[발문] … | 10초`
→ a `[대사]` that answers it → optional `[예상질문]`/`[예상답변]` → `[전환]` into the next
slide's title. About 350 characters of `[대사]` + `[예상답변]` per minute (900 if the professor
wants the rich week-5 script), 150–400 characters per `[대사]`, ≤30 cues, ≤600 characters per
cue. No cue ids, no headings. If you write `[시간]`, delete the slide's `time:` field or give both
the same minutes. Full example: `reference/examples/04-principle-chain-note.marco.md`.

## 7. Reading build and lint output

```
lecture.marco.md:44  경고 [format.note.time] time: 필드와 노트의 [시간]이 달라 time: 필드를 씁니다.
  card-steps #4 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다 (lecture.marco.md:40)
    경고 budget.cards.body  cards[1].body: 104자 (허용 90자)
    오류 ref.missing  refs에 없는 참고 출처: S99
린트 · 오류 1 · 경고 1 · 정보 1
```

`오류` = error, `경고` = warning, `정보` = info. Slide groups read `<id> #<position> <title>
(<file>:<line>)`; indexes inside messages are 0-based (`cards[1]` = second card), block numbers
in `#2` are 1-based. The usual fixes:

| Code                                                  | Korean message (example)                                                                  | Fix                                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `format.*` (build stops on errors)                    | `:::callout 컨테이너가 닫히지 않았습니다 (닫는 ::: 필요).`                                | Syntax at `file:line`: header, blank line after fields, closed `:::`, known names. See lint-codes.md. |
| `budget.<block>.<field>`                              | `cards[1].body: 104자 (허용 90자)`                                                        | Shorten that text; keep the meaning.                                                                  |
| `budget.<block>.items`                                | `cards.items(cols=2): 5개 (허용 4개)`                                                     | Merge or drop items, change `cols`, or split the slide.                                               |
| `budget.table.cell`                                   | `table.rows[0][1](cols=3): 35자 (허용 30자)`                                              | Cell budget by columns: 40/30/20/16/12 for 2–6 columns.                                               |
| `budget.slide.title` (…`subtitle`, `tag`, `question`) | `title: 42자 (허용 34자)`                                                                 | ≤34 / 60 / 16 / 70.                                                                                   |
| `budget.slide.dense`                                  | `slide.dense: 본문 높이 추정 1036px (허용 760px, 36% 초과 · 가장 큰 블록 #2 table 296px)` | Drop a block, cut rows or items, drop subtitle/question, or split the slide.                          |
| `table.ragged`                                        | `table.rows[0]: 칸 2개 (머리글 3개)`                                                      | Every row has the header's cell count.                                                                |
| `icon.unknown`                                        | `알 수 없는 Lucide 아이콘 'x'은(는) 표시되지 않습니다.`                                   | Use a Lucide name or remove `icon:`.                                                                  |
| `ref.missing`                                         | `refs에 없는 참고 출처: S99`                                                              | Use an existing id, or add the real source to `refs`; otherwise remove it and leave a TODO.           |
| `asset.missing`, `video.missing`                      | `assets에 없는 이미지: campus`                                                            | Register the real file/video in the front matter, or remove the block and leave a TODO.               |
| `slide.id.duplicate`                                  | `중복된 슬라이드 id: b (1번 슬라이드와 같음)`                                             | Rename the later slide's id.                                                                          |
| `note.marker.unknown`                                 | `알 수 없는 노트 표시 [설명] → 메모로 처리했습니다`                                       | Use a marker from notes.md.                                                                           |
| `note.cues.over`, `note.cue.long`                     | `노트 큐 34개 (허용 30개)`                                                                | Merge short cues; split long ones.                                                                    |
| `time.total` (info; warning over)                     | `노트 [시간] 합계 152분 > 강의 시간 150분 (2분 초과, …)`                                  | Rebalance the slide times.                                                                            |
| `content.todo` (info)                                 | `확인할 TODO가 남아 있습니다: "TODO: …"`                                                  | Leave it; list it for the professor.                                                                  |

Four mistakes produce **no** message, so check them yourself: a GFM table row with more cells
than the header (extra cells are dropped); a blank line inside a slide's field block (the fields
after it become a paragraph); a `- ` before a pipe row (the row becomes one text item); a note
target such as `@card-steps-b4` that names no block.

## 8. Before you say you are done

- The build printed `✓`, `린트 · 오류 0 · 경고 0`, and no other `오류`/`경고` line (or you
  explain each warning left).
- No HTML/CSS/JS in the source; every `refs`, `art`, image and video id exists in the front matter.
- Only the requested slides changed; ids are stable; note targets match the blocks.
- The report lists the output path(s) and each remaining `TODO:`.
