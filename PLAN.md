# MARCO Engine — Project Plan

**Project:** NPPT / MARCO Engine — an engine for building AI-assisted university lecture decks
**Status:** Draft v0.1 · 2026-09-29
**License:** MARCO Engine License, Version 1.0 (Apache 2.0 + Visible Attribution; see §15)

---

## 요약 (Korean summary)

교수님은 지금 강의 슬라이드를 **AI 채팅으로 HTML 파일 한 개씩** 만들고 있습니다. 파일 하나가 5–10 MB이고, 그 안에 아이콘 라이브러리(0.6 MB), 글꼴(1 MB), 이미지, 슬라이드 엔진(JS/CSS)이 매번 통째로 들어갑니다. 그래서 수정할 때마다 토큰이 빨리 소진되고, 실제로 v6.1 → v9.7처럼 "패치 스크립트를 덧붙이는" 방식으로 버텨 왔습니다.

**MARCO Engine**은 이 문제를 "엔진과 내용을 분리"해서 해결합니다.

- **엔진**(재생기·디자인 시스템·인쇄·필기·퀴즈·시뮬레이터)은 한 번만 만들고 버전 관리합니다. AI는 엔진을 다시 쓰지 않습니다.
- **AI는 내용만** 씁니다. 슬라이드·해설·퀴즈를 짧은 텍스트 형식(MARCO 소스)으로 쓰면, 컴파일러가 지금 쓰시는 것과 같은 **단일 HTML 파일**을 만들어 냅니다.
- 12번 슬라이드 하나만 고치면 **그 슬라이드만** 다시 생성합니다. 파일 전체를 다시 만들지 않습니다.
- 기존 V20·v9.7 덱은 **가져오기(import)** 기능으로 새 형식으로 변환해 계속 쓸 수 있습니다.

예상 효과: 덱 하나를 새로 만들 때 출력 토큰 5–10배 절감, 부분 수정 시 50–100배 절감(§9). 아래는 영어로 쓴 상세 계획입니다.

---

## 1. Why this project exists

The professor produces every lecture deck as a single, self-contained HTML file written by an AI chat assistant. The output is excellent (fixed 1920×1080 canvas, presenter notes, ink tools, print-to-PDF, quizzes, network simulators) but the process is broken:

1. **Every deck re-emits the whole engine.** The runtime JS, CSS design system, Lucide icon library and fonts are regenerated with each deck, even though they never change.
2. **Every revision re-emits the whole deck.** Fixing one slide means asking for the entire file again. When that became too expensive, the AI started appending patch layers (`/* v6.3 · 평가 개선 */`, `applyCorrections97()`, `bindNarration95()`, `#v90-solutions`) on top of older code. The Week 5 deck carries at least seven such layers.
3. **The two template generations have drifted.** The Week 3 deck ("V20", violet theme, `v-cards`/`takeaway` vocabulary) and the Week 5 deck ("v9.7 instructor edition", CAU navy theme, `sv-*`/`dd-*`/`verdict` vocabulary) share almost no class names and store notes in different formats, so nothing learned in one carries over to the next.
4. **Tokens run out** before the deck is finished, so quality depends on how many turns are left rather than on the material.

MARCO Engine turns this into a build system: **the engine is code we own and version; the AI only writes content.**

---

## 2. What the two reference decks tell us

Both uploaded files were analysed structurally (base64 payloads stripped, DOM/CSS/JS inventoried). Findings that shape the design:

### 2.1 Anatomy of a deck

| Aspect | Week 3 · 물리보안·출입통제 IAM (V20) | Week 5 · 방화벽 운영 및 실무 (v9.7, 강사용) |
|---|---|---|
| Slides | 40 (`section.slide.v20-slide`: cover, divider ×2, quote, 36 content) + 1 student-note section | 43 (`section.slide`: hero ×3, 40 content) |
| Per-slide metadata | `data-title`, `data-tag`, `data-note` | `data-group`, `data-title`, `data-q` (guiding question), `data-note` |
| Notes format | Plain prose per slide | Structured lecture script: `# 해설 N|P06 · 해설 1–8`, `===` separators, markers `[시간] [화면] [검증 보충] [조작] [대사] [주목] [발문] [전환] [메모]`, 1,135 cue ids `{{p06-c002}}` |
| Cue data | — | `window.SCRIPT` JSON: cue kinds `SAY` 433, `HOP` 230, `LOOK` 135, `DO` 103, `SQ`/`SA` 75, `ASK` 53, `NEXT` 43, `TIP` 10, `WAIT` 6; each with `focus.targets[]` |
| Reference data | `<script id="lecture-data" type="application/json">` with `assets{}`, `refs[]`, `slideRefs{}`, `videos[]` | `window.QUIZ` (20 questions: area, key, q, opts, ans, exp), `window.SIMS` (16 network sims: nodes, ifs, links), `window.TERMS` (virtual terminals), `window.FWCLI` (firewall CLI interpreter), `window.SM_SPRITES` (teacher/student avatar poses) |
| Runtime | 13 KB inline JS: canvas scaling, nav, TOC sidebar, notes panel, search, pen/laser/shapes, dialogs, two print modes | "Deck engine v2.1" ~54 KB + quiz/exam ~8 KB + deep-dive ~7 KB + terminal ~8 KB + FWCLI ~95 KB + narration/avatar ~800 KB data |
| Theme | Violet `--primary:#6B4BFF`, navy text, `--fs-*` type scale, Inter display | CAU navy `--u-navy:#201D30`, blue scale `--u-blue-01..12`, `--t-*` type scale, Pretendard + SpoqaHanSans (embedded woff2), logos as CSS vars |
| Icons | Lucide v1.28.0, full UMD bundle embedded as base64 `<script src>` | Lucide v1.28.0, full UMD bundle embedded inline |

### 2.2 Where the bytes go (measured)

| | Week 3 (V20) | Week 5 (v9.7) |
|---|---|---|
| File size | 10.3 MB | 5.4 MB |
| Embedded images | 6.3 MB (13 PNG/JPEG, unoptimised PNG) | 0.4 MB (28) |
| Embedded fonts | — | 1.0 MB (7 woff2, full glyph sets) |
| Lucide library | 0.6 MB (base64) | 0.6 MB (inline) |
| Non-base64 text | 0.59 MB | 3.4 MB |
| of which runtime + data JS | ~0.02 MB | ~2.3 MB (SCRIPT 0.8, SIMS 0.7, lucide 0.6, FWCLI 0.1, engine 0.05, other 0.05) |
| of which slide HTML + CSS | ~0.57 MB | ~1.1 MB |

Two observations matter for token cost:

- **Authored content is a minority of the bytes.** Everything else (engine, libraries, fonts, images) is boilerplate an AI should never emit.
- **Notes are stored twice** in the Week 5 deck: once in each slide's `data-note` attribute and again as `window.SCRIPT` JSON. A single source of truth halves that cost.

### 2.3 How revisions were made

Version markers found in the Week 5 file: `v6.1`, `v6.3`, `v6.4`, `v90-*` (ids), `*95` (narration), `*96` (terminal), `*97` (corrections/audit). Each is a CSS/JS layer that patches the previous state at runtime. This is exactly the behaviour a compiler with slide-level rebuilds removes.

### 2.4 Features that must be preserved

**Runtime (both decks):** 1920×1080 logical canvas scaled to the viewport so line breaks never change; keyboard navigation (arrows, space, PageUp/Down, Home/End) plus single-key shortcuts (fullscreen, notes, pen, help, TOC, search); TOC sidebar with active tracking; presenter notes panel intended for the instructor monitor; in-deck search; ink tools (pen, highlighter, eraser, text, rect, ellipse, line, arrow, table, laser) with a colour/size toolbar; whiteboard and zoom (Week 5); source/reference dialogs (`참고 출처 S13 ↗`), media-credit dialog, image zoom popups, YouTube video with start time and a `file://` fallback; help overlay; slide number and progress bar; footer tag (`보안시스템 운영 및 활용 · 3주차`) with course logos (Week 5); two print modes (lecture: one slide per 1920×1080 page; handout: A4 portrait with slide thumbnail + full notes); abbreviation expansion tooltips (`LPR → License Plate Recognition`).

**Content components (union of both vocabularies):** cover, section divider, quote, hero with guiding question and `alert` variant; eyebrow + title + body + footer scaffold; decision chain (numbered steps), card grids (2/3 columns) with kicker/title/body, takeaway bar, comparison (side-by-side), tables, callouts, pills/badges, verdict chips (allow/drop/ok/hot), ordered steps, code chips (490 `<code>` in Week 5), timeline, tiles, product cards, formula cards, big headline, image with caption and zoom, video reference, reference list slide, student-note/handout section.

**Interactive plugins (Week 5, plus Week 3 widgets):** pre-diagnostic quiz (card click → answer modal) and exam mode (10–20 min timer, self-scoring); step-by-step solved questions (`sv-*`: stem, options, pick, check, solution, refs); deep-dive full-slide overlays (`dd-*`); network topology simulator (nodes, interfaces, packet flow, allow/drop); firewall CLI console (`show rules|nat|state|route`, `rule add|delete|move`, `packet-tracer`, `ping`); virtual terminal with admin/attacker modes and per-command explanation panel; narration player driven by `SCRIPT` cues that highlight `focus.targets`; teacher/student avatar sprites; Week 3's ABAC evaluator, JIT access timeline, MFA factor combinations, fail-safe/fail-secure lock power toggle and response-time calculator.

---

## 3. Root cause and the core idea

**Root cause:** content and engine are fused in one file, so the unit of generation is "the whole deck".

**Core idea:** make the unit of generation "one slide's content" and make everything else deterministic.

```
   AI / professor writes            MARCO compiles                 Output (unchanged for the professor)
 ┌──────────────────────┐        ┌──────────────────┐        ┌────────────────────────────────────┐
 │ lecture.marco.md     │  ───▶  │ parse → validate │  ───▶  │ week05.html  (single file, offline) │
 │  · slides (DSL)      │        │ → render → inline│        │  · runtime + design system (fixed)  │
 │  · notes / cues      │        │   runtime, CSS,  │        │  · subset fonts, used icons only    │
 │  · quiz, sims, refs  │        │   fonts, assets  │        │  · optimised images                 │
 │ assets/ (images)     │        └──────────────────┘        │  · slides + notes + data            │
 └──────────────────────┘                                    └────────────────────────────────────┘
```

Regenerating slide 12 touches ~2 KB of source, and `marco build` produces the full file in under a second with zero tokens.

---

## 4. Goals and non-goals

**Goals (v1)**

1. Cut AI output per new deck by 5–10× and per revision by 50–100× (§9).
2. Produce the same kind of artefact the professor uses today: one offline HTML file, 1920×1080 canvas, notes, ink, print modes, references.
3. One canonical component library with two themes (V20 violet, CAU navy) so decks stop drifting.
4. Import existing V20 and v9.7 decks into the new source format so nothing is lost.
5. Korean-first typography and UI; the professor never has to read code.

**Non-goals (v1)**

- PowerPoint-style drag-and-drop WYSIWYG editing (see §5 for the recommended alternative).
- `.pptx` export with full fidelity (PDF via the existing print modes is the export path).
- Cloud hosting, accounts, or real-time collaboration.
- Replacing the professor's AI of choice. The engine is AI-agnostic: the professor keeps using whatever chat assistant he uses today, and the prompt kit is plain text he pastes into it. Direct API automation is an optional add-on that works with any provider.

---

## 5. Product shape: three layers

| Layer | What it is | Who touches it |
|---|---|---|
| **MARCO Runtime + Design System** | The in-browser deck engine and CSS component library, built once, embedded into every output | Developers only |
| **MARCO Source + Compiler** | A compact text format for lecture content, a validator/linter, and a CLI that builds the HTML | AI writes it; professor edits it (directly or via Studio) |
| **MARCO Studio** (Phase 4) | Local app: source editor + live preview + "revise this slide with AI" + asset manager + export | Professor |

On "a PPT-like program": a full WYSIWYG editor is the most expensive and least valuable piece here, because the AI is the one doing the writing. The recommendation is a **source-plus-live-preview studio** (the model used by Marp and Slidev) with per-slide AI revision. Direct manipulation (drag to reorder slides, inline text edits that write back to the source) comes after that. Existing tools (reveal.js, Marp, Slidev) are not adopted directly because they lack the professor's requirements: fixed-canvas Korean typography, the notes/cue grammar, dual print modes, ink tools, quiz and simulator plugins, and compatibility with the existing decks.

---

## 6. Architecture

```
packages/
  schema/          JSON Schema + TypeScript types for the Lecture document (§8)
  design-system/   tokens.css (colour, type scale, spacing), components.css, themes/v20-violet.css, themes/cau-navy.css
  runtime/         TypeScript, no framework; core (canvas scale, nav, TOC, notes, search, ink, print, dialogs, help)
                   + plugins/ (quiz, exam, deep-dive, sim, cli, terminal, narration, avatar, iam-widgets)
  compiler/        marco source → Lecture IR → HTML; inlines runtime + CSS; subsets fonts; optimises images; validates; lints
  importer/        legacy V20 / v9.7 HTML → marco source (DOM walk over section[data-title], class → component mapping)
  ai/              prompt kit, tool schemas, pipelines (outline → slides → notes → revise), validation-repair loop
apps/
  cli/             marco new | build | watch | lint | import | pdf | ai ...
  studio/          local web app (Phase 4)
examples/
  week03-iam/      re-created from the V20 deck (parity target #1)
  week05-firewall/ re-created from the v9.7 deck (parity target #2)
docs/
```

Design rules:

- **Runtime is plugin-based.** Core stays under ~120 KB. A deck that uses no simulator embeds no simulator code.
- **Data lives once.** Notes, cues, quiz, sims and refs are emitted as one JSON block; the runtime hydrates panels from it. No duplicate `data-note`.
- **Assets are referenced, not pasted.** Source refers to `assets/campus.png`; the compiler embeds an optimised version and carries `title/credit/source` for the media dialog.
- **Icons are tree-shaken.** Only Lucide icons actually used are emitted as an SVG sprite (~5–20 KB instead of 600 KB).
- **Fonts are subsetted** to the glyphs the deck uses (typically 1 MB → 200–300 KB), with a `--no-embed-fonts` option for the student edition.
- **Two editions from one source:** `--edition student` (no notes/script) and `--edition instructor` (notes, cues, narration).
- **Output stays a single HTML file.** Its head carries a NOTICE comment (engine version, the MARCO Attribution, third-party notices) and the help overlay shows the Attribution, which is what the licence requires (§15). Content stays the author's.

---

## 7. Authoring format: MARCO source

Markdown-based, YAML front matter, one `# slide` block per slide, `:::` containers for components. Chosen because it is what humans read and what LLMs write most cheaply and reliably. JSON (§8) is the canonical intermediate representation and is also accepted as input, which is what the optional API pipeline emits as structured output.

```markdown
---
title: 3주차 · 물리보안·출입통제 IAM
course: 보안시스템 운영 및 활용
week: 3
theme: v20-violet
edition: instructor
refs:
  S13: { title: "ISO/IEC 27001:2022 A.7 Physical controls", url: "https://..." }
---

# slide cover
tag: 표지
title: 물리보안 · 출입통제 IAM
subtitle: 출입통제의 기술과 운영을 함께 다룬다
note: |
  [시간] 2분 · 0:00 – 2:00
  [조작] 수업 시작 전 덱을 열고 [F] 키로 전체화면 전환.
  [대사] 출입통제의 기술과 운영을 함께 다룹니다. IAM은 …

# slide
tag: 기본 원리
title: 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다
refs: [S13]

:::chain
01 | 자격 제시 | 카드를 리더에 댄다
02 | 인증     | 유효한 자격인지 확인
03 | 인가     | 이 구역·시간에 허용?
04 | 잠금 해제 | 전기정의 잠금을 푼다
05 | 실제 통과 | 센서로 통과를 확인
:::

:::cards cols=2
- kicker: 허용됐지만 안 들어감
  title: 허용 신호 ≠ 실제 입실
  body: 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다.
- kicker: 카드 없이 잠금 해제
  title: 퇴실·소방·원격 개방
  body: 실내 퇴실 버튼, 화재 연동, 운영자 명령도 잠금을 해제할 수 있다.
:::

:::takeaway 핵심 구분
인증은 자격 확인, 인가는 허용 판단, 센서는 문과 사람의 상태 확인이다.
:::

note: |
  [대사] {{auto}} 카드가 읽혔다고 사람이 들어간 것은 아닙니다. …
  [발문] {{auto}} 네 단계 중 어디에서 실패가 가장 자주 날까요? | 10초
```

Rules of the format:

- The note grammar is the professor's existing one (`[시간] [화면] [조작] [대사] [주목] [발문] [전환] [검증 보충] [메모]`), so existing scripts import unchanged. `{{auto}}` cue ids are assigned deterministically at build time (`p04-c002`).
- Each component declares a **character budget** per field (e.g., card body ≤ 90 Korean characters at 2 columns). The linter reports overflow before the browser does.
- Slides are addressable by stable ids (`# slide id=principle-chain`) so revisions target one slide.
- A `# slide raw` escape hatch accepts hand-written HTML for one-off layouts, so the format never blocks the professor.

---

## 8. Data model: the canonical IR

```ts
type Lecture = {
  meta: { title; course; week; lang: 'ko'; theme: 'v20-violet' | 'cau-navy'; edition: 'student' | 'instructor'; version; date? };
  refs: Ref[];                      // id, title, url, kind
  videos: Video[];                  // id (YouTube), title, start
  assets: Record<string, Asset>;    // path, title, credit, source, alt
  terms: Record<string, string>;    // LPR → "License Plate Recognition 차량번호 인식"
  slides: Slide[];
  quiz?: QuizItem[];                // area, areaName, key, q, opts[], ans, exp, refs[]
  sims?: Record<string, Sim>;       // nodes[], links[], ifs[], packets[] (Week 5 schema)
  terminals?: Record<string, Term>; // prompts, modes, cmds[], run[] (Week 5 schema)
};

type Slide = {
  id: string; type: 'cover' | 'divider' | 'quote' | 'hero' | 'content' | 'references' | 'raw';
  tag?: string; group?: string; title: string; question?: string; refs?: string[];
  blocks: Block[];                  // chain | cards | takeaway | table | compare | callout | steps | code | image | video | tiles | timeline | widget | html
  note?: { time?: { minutes: number; from?: string; to?: string }; cues: Cue[] };
};

type Cue = { k: 'SAY'|'DO'|'LOOK'|'ASK'|'HOP'|'SQ'|'SA'|'NEXT'|'TIP'|'WAIT'|'SCREEN'|'VERIFY'|'MEMO';
             t: string; id: string; focus?: { targets: string[] }; wait?: string };
```

The schema is published as JSON Schema so the AI can be given it verbatim (tool definition) and so `marco lint` can validate any input before rendering.

---

## 9. The token-saving workflow

**Before (today)**

1. One long chat → whole HTML (5–10 MB) → tokens run out mid-deck.
2. Revision → whole HTML again, or a patch script appended → `v9.7`.

**After (MARCO)**

| Step | Command | What the AI emits | Rough size |
|---|---|---|---|
| 1. Scaffold | `marco new week06 --theme cau-navy` | nothing | 0 |
| 2. Outline | `marco ai outline "6주차 · IDS/IPS"` | 40 lines: tag · title · one-line intent · time | ~2–3 K tokens |
| 3. Slides | `marco ai slides --batch 6` | slide bodies in MARCO source, 6 at a time | ~1–2 K tokens per slide |
| 4. Notes | `marco ai notes --slides 1-43` | cue script per slide, separate pass | ~1–3 K tokens per slide |
| 5. Check | `marco build && marco lint` | nothing; linter output (overflow, missing refs, time budget) | 0 |
| 6. Fix | `marco ai revise 12 "표를 3열로 줄이고 예시를 하나 추가"` | slide 12 only | ~2–5 K tokens |
| 7. Ship | `marco build --edition instructor && marco pdf --handout` | nothing | 0 |

In chat mode, steps 2–4 and 6 are the same prompts pasted into whatever chat assistant the professor already uses; he saves the reply as the source file and runs `marco build`. The `marco ai …` commands are the automated form of the same prompts for anyone with API access to any provider.

Estimated totals for a Week-5-class deck (43 slides, full narration): 150–250 K output tokens spread across small calls that never hit a response limit, versus an unbounded, repeatedly-restarted attempt today. A student edition without narration lands around 50–80 K. A single-slide fix costs a few thousand tokens instead of a whole-deck regeneration. These are estimates from the measured decks and will be re-measured in Phase 0.

Mechanics that make this hold:

- **Fixed system prompt** (style guide + component list + budgets + schema) is identical across calls, so provider prompt caching applies where available; only the slide payload is new each time.
- **Chat first.** The prompt kit is a Markdown file the professor pastes into the chat assistant he already uses (ChatGPT, Claude, Gemini or another); the assistant answers in MARCO source, never HTML. **API optional.** The same prompts run unattended through a provider adapter with structured output for anyone who wants automation.
- **Validate-repair loop:** the compiler returns machine-readable errors (`slide 12 · cards[1].body exceeds 90 chars by 14`), and the pipeline sends only that slide back for repair.
- **Nothing generated twice:** engine, fonts, icons, images and unchanged slides are never in the prompt or the response.

---

## 10. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language / tooling | TypeScript, Node 20+, pnpm workspaces | One language across runtime, compiler, CLI, studio |
| Runtime | Vanilla TS compiled to a single IIFE, no framework | Keeps the embedded runtime small and dependency-free, like today's decks |
| Styling | Plain CSS with custom properties; PostCSS for bundling/minifying | Matches the existing `--primary`, `--u-blue-*`, `--fs-*` token approach |
| Markdown / DSL | `markdown-it` + `markdown-it-container` for `:::` blocks, `yaml` for front matter and list items | Mature, small, extensible |
| Validation | JSON Schema (Ajv) + custom lint rules | Machine-readable errors for the AI repair loop |
| Icons | Lucide (ISC) via tree-shaken SVG sprite | Same icon set the professor's decks use |
| Fonts | Pretendard, SpoqaHanSans, Inter (all SIL OFL) subsetted at build with `subset-font` | Same look, 3–5× smaller |
| Images | `sharp`: resize to ≤1920 px, WebP/AVIF with PNG fallback for diagrams | Week 3's 6.3 MB of PNG becomes < 1 MB |
| Testing | Vitest (unit), Playwright (per-slide screenshots, overflow detection, print PDF) | Chromium is preinstalled in this environment |
| AI | Prompt kit as plain Markdown that works in any chat assistant; optional provider adapter for API automation (OpenAI, Anthropic, Google, local models) | The professor's workflow is chat-based today; nothing in the engine depends on a specific AI vendor |
| Studio (Phase 4) | Vite + Svelte (or React), Monaco/CodeMirror editor, iframe preview of the built HTML | Small, fast, local-first |

---

## 11. Repository layout

```
NPPT/
  PLAN.md                  this document
  LICENSE                  MARCO Engine License 1.0: Apache 2.0 + Visible Attribution, from DoTaeIn/Marco (§15)
  NOTICE                   third-party licences (Lucide, Pretendard, SpoqaHanSans, Inter, markdown-it, …)
  package.json / pnpm-workspace.yaml / tsconfig.base.json
  packages/{schema,design-system,runtime,compiler,importer,ai}/
  apps/{cli,studio}/
  examples/{week03-iam,week05-firewall}/
  docs/
    spec/         format spec, component catalog (rendered gallery), note grammar, cue kinds
    guide-ko/     professor-facing guide in Korean
    adr/          architecture decision records
```

---

## 12. Roadmap and milestones

Assumes one to two developers. Weeks are calendar estimates, not commitments; the order is what matters.

### Phase 0 · Discovery and spec (week 1)
- Freeze `Lecture` schema v0.1 and the note/cue grammar (§7–8).
- Component inventory: map every class family in both decks to one of ~25 canonical components; record the mapping for the importer.
- Extract design tokens for both themes; agree on the type scale.
- Measure token baselines on the two decks to calibrate §9.
- **Deliverables:** `docs/spec/`, `packages/schema` v0.1, component catalog draft, ADR-001 (DSL vs JSON), ADR-002 (single-file output).

### Phase 1 · Engine + compiler MVP (weeks 2–4)
- Port the Week 3 runtime (nav, canvas scaling, TOC, notes, search, ink, laser, dialogs, help, two print modes) into `packages/runtime` as TS modules; build to one IIFE.
- Implement `design-system` tokens + the ~25 components in both themes.
- Compiler: MARCO source → IR → HTML with inlined runtime/CSS, icon sprite, font subsetting, image optimisation, editions.
- CLI: `marco new | build | watch | lint`.
- **Milestone M1:** `examples/week03-iam` rebuilt from source; Playwright screenshots match the original deck slide-for-slide within an agreed tolerance; output file ≤ 2 MB.

### Phase 2 · AI pipeline + importer (weeks 5–6)
- Prompt kit v1: system prompt, component cheat-sheet with budgets, few-shot slides from the examples.
- `marco ai outline | slides | notes | revise` with tool-use structured output, prompt caching, validate-repair loop, provider adapter.
- Importer: legacy V20 and v9.7 HTML → MARCO source (sections, blocks, notes, refs, assets, quiz/sims/terminals data blocks).
- **Milestone M2:** a new 40-slide deck produced end-to-end from an outline with < 100 K output tokens; both legacy decks import and rebuild with no lost text.

### Phase 3 · Interactive plugins (weeks 7–9)
- Plugins: quiz + exam mode, solved questions (`sv`), deep-dive overlays, network sim, firewall CLI console, virtual terminal, narration player with focus highlighting, avatar sprites, Week 3 IAM widgets.
- Plugin data schemas in `packages/schema`; per-plugin AI prompt snippets.
- **Milestone M3:** `examples/week05-firewall` rebuilt from source with all interactions working; runtime only embeds plugins a deck uses.

### Phase 4 · Studio + handoff (weeks 10–12)
- Local studio: source editor, live preview (built HTML in an iframe), slide list with reorder, "revise this slide with AI" panel, asset manager with credit fields, lint panel, one-click build/PDF.
- Korean professor guide, screencast, install script (Windows/macOS).
- **Milestone M4:** the professor produces a new week's deck without touching a terminal or reading HTML.

### Ongoing
- Release process (`marco --version` stamped into output), changelog, examples gallery, licence/NOTICE maintenance.

---

## 13. Quality: testing and acceptance criteria

- **Visual parity:** Playwright renders every slide of each example at 1920×1080 and diffs against golden PNGs (threshold agreed in Phase 0).
- **Overflow detection:** headless check that no slide body's `scrollHeight` exceeds the canvas; linter budgets are tuned from these results.
- **Print:** generated PDFs for both modes checked for page count and page size.
- **Schema:** every example and every AI output validates against `lecture.schema.json`.
- **Import round-trip:** `import → build` of the two legacy decks preserves every `data-title`, note text, ref, quiz item and sim node (text-level diff).
- **Size budgets:** runtime core ≤ 120 KB min+gz; typical deck ≤ 2 MB; instructor edition with sims ≤ 4 MB.
- **Accessibility floor:** keyboard-only operation, focus styles, `alt` on all images (already in `assets.alt`).

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rebuilt decks "look different" to the professor | Golden-screenshot diffs from day one; the professor signs off M1 before Phase 2 |
| Text overflow at fixed 1920×1080 with AI-written copy | Character budgets per component + headless overflow check + auto-repair loop |
| Two template families do not map cleanly to one component set | `raw` escape hatch; importer keeps unmapped markup as `html` blocks and reports them; add components iteratively |
| Notes grammar evolves (new markers) | Grammar is a table in `schema`; unknown markers pass through as `MEMO` with a lint warning |
| AI still tries to emit HTML or engine code | System prompt forbids it; the tool schema only accepts MARCO blocks; validator rejects `<script>`/`<style>` outside `raw` |
| Font and icon licensing when embedding | All chosen fonts are SIL OFL, Lucide is ISC; `NOTICE` carries attributions; `--no-embed-fonts` for distribution-sensitive builds |
| Third-party product photos in decks (e.g., Boon Edam, Suprema) | Engine keeps `credit`/`source` metadata and renders the media-credit dialog; content responsibility stays with the author, and the licence covers the engine only (§15) |
| Scope creep toward a full WYSIWYG editor | Phase 4 is explicitly source-plus-preview; direct manipulation is a post-v1 item |
| Single-file output grows again as plugins are added | Plugins embed only when used; size budgets are CI checks |

---

## 15. MARCO Engine License

The engine ships under the **MARCO Engine License, Version 1.0**, the licence already used by [DoTaeIn/Marco](https://github.com/DoTaeIn/Marco): the Apache License 2.0 reproduced in full, plus one *Additional Condition* (Visible Attribution). No new licence is drafted. The text is copied from the Marco repository with the two adaptations listed below.

**What the licence means for this project**

| Situation | Under the licence |
|---|---|
| The professor builds decks and shows them to students | A built deck runs the engine (navigation, notes, quiz, simulators) in front of people who did not build it, so it is a *User-Facing Product* and must show the Attribution. The runtime's help overlay (`?`) carries it by default, which satisfies §2 of the Additional Condition ("an about, credits, settings or help screen"). The professor never has to do anything. |
| Lecture content: slides, notes, images, the professor's source files | Not the Engine. Content belongs to its author and the licence places no condition on it. The built file's NOTICE comment says so. |
| Someone forks the engine or ships a modified build | Apache 2.0 terms apply, and the Attribution stays required for any user-facing product that contains the engine (Additional Condition §6). |
| Personal use, research, development, testing, plain redistribution of source or builds | No Attribution requirement (§3); Apache §4(d) NOTICE rules apply to redistribution. |
| Someone wants no attribution | White-label licence from the copyright holder (§5). |

**Two adaptations the copyright holder has to decide, because the Marco text cannot be copied verbatim**

1. **Definition of "Engine" (Additional Condition §1).** Marco defines it as "the MARCO reasoning, dialogue, language, learning, storage and benchmarking code". That does not cover a deck engine. Proposed wording for this repository: *"Engine" means this software: the MARCO deck runtime, design system, compiler, importer, authoring pipeline and studio code, and builds made from it, whether or not modified.*
2. **Attribution text (Additional Condition §1).** Marco's line is `Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco`. Decide whether NPPT decks show that line unchanged, or one that points at this repository (for example `Powered by MARCO Engine — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/NPPT`). The plan assumes a line that keeps the three parts the licence requires: the name MARCO, the name DoTaeIn and a project URL.

Everything else is copied unchanged: Additional Condition §2–6, the sentence that the licence must not be described as the Apache License alone, and the full Apache 2.0 text. Whether to publish this as "Version 1.0, as applied to NPPT" or to bump the shared licence to 1.1 with a generalised Engine definition is your call as the holder of both copyrights. Marco's own notes say licence-text changes warrant legal review; the same applies here.

**Files and mechanics**

- `LICENSE`: the adapted text. `NOTICE`: modelled on Marco's (product name, copyright, the Attribution, pointer to `LICENSE`) plus third-party notices: Lucide (ISC), Pretendard (SIL OFL 1.1), Spoqa Han Sans (SIL OFL 1.1), Inter (SIL OFL 1.1), markdown-it (MIT), Ajv (MIT), sharp (Apache 2.0), and others as added, generated from `package.json` at release.
- The runtime's help overlay shows the Attribution and the compiler has no flag to remove it, so every built deck is compliant by construction. Each built HTML also starts with a NOTICE comment naming the engine version and repeating the Attribution.
- `README.md` gets a `## License` section in the same shape as Marco's.
- The project is under this licence from its first release; there is no earlier Apache-only period to grandfather.

---

## 16. Open decisions

Defaults are chosen so work can start; change any of them and the plan adjusts.

| Question | Default in this plan |
|---|---|
| Who uses it: only this professor, or other faculty too? | Design for one course now, but themes and course metadata are data, not code |
| Which AI does the professor use today, and through a chat window or an API? | Unknown. The plan assumes a chat assistant with copy-paste; the prompt kit is vendor-neutral. API automation is optional and provider-agnostic |
| Are narration player and avatar (v9.7 features) required in v1? | Phase 3 plugins; core deck ships in Phase 1 without them |
| Must legacy decks be imported? | Yes, in Phase 2; it is also how we validate parity |
| Local files only, or a small server? | Local files only; Studio runs on localhost |
| Attribution line and "Engine" definition for the licence (§15) | Line names MARCO, DoTaeIn and the NPPT repository; the Engine definition covers the deck engine |

---

## 17. First two weeks: concrete task list

1. Initialise the monorepo: pnpm workspaces, TypeScript, ESLint/Prettier, Vitest, Playwright; CI that builds and screenshots the examples.
2. Write `packages/schema/lecture.schema.json` v0.1 and TS types (§8), including the cue-kind table and note-marker table.
3. Author the component catalog (`docs/spec/components.md`): for each of ~25 components, its fields, character budgets, the legacy class names it replaces from both decks, and a rendered example.
4. Extract both themes' tokens into `packages/design-system/themes/` and port the shared CSS into `components.css`.
5. Port the Week 3 runtime into `packages/runtime/src/` (nav, canvas scale, TOC, notes, search, ink/laser, dialogs, help, print modes); build to one IIFE; unit-test navigation and print-mode switching.
6. Compiler MVP: parse MARCO source → IR → HTML, inline runtime and CSS, icon sprite, font subsetting, image optimisation, `--edition`.
7. Hand-write the first five slides of `examples/week03-iam/lecture.marco.md` and get pixel parity with the original.
8. Importer spike: parse all 40 Week 3 sections into MARCO source automatically; list unmapped markup.
9. Prompt kit v0.1: system prompt, component cheat-sheet, `outline` and `slides` tool definitions; run one outline → slides trial and record token usage.
10. Add `LICENSE` (MARCO Engine License 1.0 with the two adaptations in §15) and `NOTICE`; put the Attribution in the runtime help overlay.
