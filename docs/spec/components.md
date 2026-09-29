# Component catalog v0.1

The canonical components every MARCO deck is built from. **This file is a contract**: the
compiler emits exactly these HTML skeletons, the design system styles exactly these class
names, the linter enforces the budgets, and the prompt kit teaches the source syntax.
Class names come from the V20 deck where one existed (so its CSS ports directly); the v9.7
vocabulary is mapped in §4.

Conventions
- Canvas is 1920×1080 logical px; the runtime scales it. Sizes below are in canvas px.
- Every block's root element carries `id="<slide id>-b<n>"` (n = 1-based block index) and
  `data-block="<type>"`; items carry `id="<block id>-i<n>"`. These are the `focus.targets`.
- Tones: `tone-neutral | tone-primary | tone-ok | tone-warn | tone-danger | tone-info`.
- Icons: `<i class="icon" data-icon="shield">…inline svg…</i>` (Lucide, inlined by the
  compiler). The runtime never loads an icon library.
- Inline text may contain `<b> <em> <code> <a> <abbr class="term" title="…">`.
- Budgets are `BUDGETS` in `packages/schema/src/budgets.ts` (characters; Korean = 1).

## 1. Slide scaffolds

### content (default)
```html
<section class="slide" id="s-04" data-type="content" data-title="…" data-tag="…" data-group="…">
  <div class="slide-wrapper">
    <header class="s-head">
      <div class="eyebrow">기본 원리</div>
      <h2 class="section-title">카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다</h2>
      <p class="s-sub">…</p>                                   <!-- optional -->
      <div class="s-q"><span class="q-tag">질문</span><span class="q-text">…</span></div>  <!-- optional -->
    </header>
    <div class="s-body">…blocks…</div>                         <!-- class "layout-wide" when layout=wide -->
  </div>
  <footer class="slide-tag-bottom">
    <button class="source-link" data-source="s-04">참고 출처 S13 ↗</button> · 보안시스템 운영 및 활용 · 3주차
  </footer>
</section>
```
The runtime appends `.slide-no` and `.slide-progress` to the active slide. The `source-link`
button is emitted only when the slide has `refs`; its text lists the ref ids.
`.s-body` is a vertical flex column with `gap: 28px`; blocks stack in source order.

### cover, hero and divider: fields and body (v0.2 additions)

All three "title" slide types share these fields (all optional, additive to the IR):

| Field | Meaning | Rendered as |
|---|---|---|
| `kicker` | small line above the title; cover default `${course} · ${week}주차` (applied at render; `normalizeLecture(x, { coverDefaults: true })` writes it into the IR) | `.cover-kicker` / `.hero-kicker` / `.cover-kicker` after `.divider-no` (the big number itself is `no`) |
| `title` | the visible headline (may be a sentence, e.g. "문을 여는 기술, 권한을 다루는 설계.") | `h1.cover-title` / `h1.hero-title` / `h2.divider-title` |
| `tagline` | small-caps secondary line, e.g. "PHYSICAL ACCESS × IDENTITY" | `.cover-tagline` |
| `subtitle` | lead sentence | `.cover-sub` / `.s-sub` / `.divider-lead` |
| `question` | guiding question strip | `.s-q` |
| `meta` | list of short lines, e.g. `[2026학년도 2학기 · 5주차, 중앙대학교 산업보안학과]`; cover default `[date, presenter]` (as for `kicker`; an explicit `kicker: ""` or `meta: []` turns the default off) | `.cover-meta > span` (one per line) |
| `art` | asset id shown as artwork on the right half | `figure.cover-art > img` |
| `toc` | TOC / search label when it differs from the visible title (any slide type) | `data-title` attribute (`toc ?? title`) |
| body blocks | allowed (typically `pills`, `paragraph`, `tiles`); cover/divider: between the question and the meta line, omitted when empty; hero: after the head as on content slides | `.s-body` inside `.cover-main` |
| `dark` | header flag `# slide cover dark` (also hero, divider) | class `dark` on the `<section>` |
| `alert` | header flag, hero and divider | class `alert` on the `<section>` (red-toned) |

Layout: `.slide-wrapper` contains `.cover-main` (text column) and, when `art` is set, `figure.cover-art`
(right column, ~46% width, image `object-fit: contain`, bottom-aligned). Without `art` the text column
spans the full width. Both themes use a **light** background for cover/hero/divider (the reference
decks are light); a dark variant is opt-in via `# slide cover dark`.
Order inside a cover's `.cover-main`: kicker, title, tagline, sub, `.s-q`, `.s-body`, meta. With `art`
the wrapper has no padding (the art bleeds to the slide edges) and `.cover-main` carries it. The art box
and fit are theme tokens (`--cover-art-w`, `--cover-art-inset`, `--cover-art-fit`, `--cover-art-pos`,
`--cover-art-fade`): v20-violet lets the picture bleed over the right 58% with `object-fit: cover` and a
left fade (V20 `.v-cover-art`); cau-navy keeps `contain`, right-centred at 46% (v9.7 `.hero-art`).

```html
<section class="slide cover" id="s-01" data-type="cover" data-title="물리보안 · 출입통제 IAM" data-group="표지 · 도입">
  <div class="slide-wrapper has-art">
    <div class="cover-main">
      <div class="cover-kicker">보안시스템 운영 및 활용 · 3주차</div>
      <h1 class="cover-title">문을 여는 기술, 권한을 다루는 설계.</h1>
      <div class="cover-tagline">PHYSICAL ACCESS × IDENTITY</div>
      <p class="cover-sub">장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.</p>
      <div class="s-body"><div class="pills" id="s-01-b1" data-block="pills">…</div></div>
      <div class="cover-meta"><span>중앙대학교 산업보안학과</span><span>Curriculum v3 · V20</span></div>
    </div>
    <figure class="cover-art" data-asset="cover-art"><img src="…" alt="…"></figure>
    <div class="cover-brand"></div>                            <!-- logos come from the theme CSS -->
  </div>
</section>
```
### divider
```html
<section class="slide divider [alert] [dark]" id data-type="divider" data-title>
  <div class="slide-wrapper [has-art]">
    <div class="cover-main">
      <div class="divider-no">01</div>
      <div class="cover-kicker">보안시스템 운영 및 활용 · 3주차</div>   <!-- optional kicker (V20 .div-eyebrow) -->
      <h2 class="divider-title">인증과 하드웨어</h2>
      <p class="divider-lead">문 앞과 문 뒤를 함께 본다.</p>
      <div class="s-body">…optional blocks…</div>
    </div>
    <figure class="cover-art">…optional…</figure>
  </div>
</section>
```
`.cover-main` is a two-column grid: `.divider-no` spans the left column, everything else stacks on the
right (tagline, `.s-q` and meta follow the lead as on the cover). `no` defaults to the divider's
position (`01`, `02`, …); `no: "!"` with `alert` gives the v9.7 red case-study opener. A footer is
emitted only when the divider has `refs`.
### quote
```html
<section class="slide quote-slide" …>
  <div class="slide-wrapper">
    <div class="eyebrow">마무리</div>
    <blockquote class="quote big"><p>…</p><cite>…</cite></blockquote>
  </div>
</section>
```
### hero  (v9.7 opening/section slides; `alert` variant is red-toned)
Same as content but `class="slide hero [alert] [dark]"`, `<h1 class="hero-title">` instead of `h2`,
the `.s-q` strip is expected, and the cover fields above (`kicker`, `tagline`, `meta`, `art`)
are honoured: with `art`, the wrapper gets `has-art` and the text sits in `.cover-main`.
Head order: `.hero-kicker` (plain letter-spaced line, v9.7 `.div-eyebrow`), `.eyebrow` from `tag`
(rendered as a rounded pill with an icon slot, v9.7 `.cover-badge`), title, `.cover-tagline`, `.s-sub`,
`.cover-meta`, `.s-q`. A hero with `meta` is an opening slide and sets its title at display size.
```html
<section class="slide hero" id="s-01" data-type="hero" data-title="방화벽 운영 및 실무" data-tag="WEEK 05">
  <div class="slide-wrapper has-art">
    <div class="cover-main">
      <header class="s-head"><div class="eyebrow">WEEK 05</div><h1 class="hero-title">방화벽 운영 및 실무</h1>
        <p class="s-sub">…</p><div class="cover-meta"><span>…</span><span>…</span></div><div class="s-q">…</div></header>
      <div class="s-body">…</div>
    </div>
    <figure class="cover-art" data-asset="hero-01"><img src="…" alt="…"></figure>
  </div>
  <footer class="slide-tag-bottom">…</footer>
</section>
```

### references
```html
<section class="slide references" …>
  <div class="slide-wrapper">
    <header class="s-head"><div class="eyebrow">참고 자료</div><h2 class="section-title">참고 자료 · 공식 문서와 미디어</h2></header>
    <ol class="reference-list">
      <li id="s-40-r1"><span class="r-no">S13</span><a class="r-title" href="…" target="_blank" rel="noopener noreferrer">…</a><span class="r-snippet">…</span></li>
    </ol>
  </div>
  <footer class="slide-tag-bottom">…</footer>
</section>
```
### raw
`<section class="slide raw" …>` + the author's HTML verbatim (the author includes `.slide-wrapper`).

## 2. Blocks

| # | Block | Source | HTML skeleton | Budget (BUDGETS key) |
|---|---|---|---|---|
| 1 | **chain** — numbered decision chain | `:::chain` + pipe rows `01 \| 라벨 \| 부제` (no auto-numbered when omitted) | `<div class="decision-chain"><article id><span>01</span><b>라벨</b><small>부제</small></article>…</div>` | ≤6 items; label 10; sub 22 |
| 2 | **cards** | `:::cards cols=2` + YAML items `{kicker?, title, body?, icon?, tone?}` | `<div class="v-cards cols-2"><article class="v-card tone-ok" id>[<i class="icon" data-icon>]<span class="v-kicker">…</span><h3>…</h3><p>…</p></article></div>` | cols 2/3/4 → ≤4/6/8 items; kicker 16; title 24; body 90/60/40 |
| 3 | **takeaway** | `:::takeaway 라벨` + text | `<div class="takeaway"><b>라벨</b><span>…</span></div>` | label 8; text 70 |
| 4 | **table** | GFM table, or `:::table caption="…"` wrapping one | `<table class="v-table"><caption>…</caption><thead><tr><th class="c">…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>` (`class="c"`/`"r"` for alignment) | ≤6 cols; ≤8 rows; cell 40 |
| 5 | **compare** | `:::compare left="스피드게이트" right="맨트랩"` + pipe rows `항목 \| 왼쪽 \| 오른쪽` | `<div class="compare"><div class="compare-head"><span class="compare-label"></span><h3>left</h3><h3>right</h3></div><div class="compare-row" id><span class="compare-label">항목</span><div class="compare-cell left">…</div><div class="compare-cell right">…</div></div>…</div>` | ≤6 rows; label 10; cell 60 |
| 6 | **callout** | `:::callout warn 제목` + body (`kind` = info/warn/ok/danger, default info) | `<aside class="callout callout-warn"><b class="callout-title">제목</b><p>…</p></aside>` | title 20; body 160 |
| 7 | **steps** | ordered list `1. **제목** 설명` or `:::steps` + YAML `{title, body?}` | `<ol class="steps"><li id><b>제목</b><span>설명</span></li></ol>` | ≤6; title 24; body 70 |
| 8 | **bullets** | `- item` list | `<ul class="bullets"><li>…</li></ul>` | ≤6; item 60 |
| 9 | **columns** | `:::columns cols=2` containing `:::col … :::` children | `<div class="columns cols-2"><div class="col">…blocks…</div>…</div>` | 2–3 columns |
| 10 | **image** | `![alt](assets/x.png "caption")` or `:::image asset=campus caption="…" zoom fit=cover height=520` | `<figure class="figure fit-cover" data-asset="campus" style="--h:520px"><img src alt width height><figcaption>caption <button class="image-open" data-asset="campus">이미지 확대 ↗</button></figcaption></figure>` | caption 60 |
| 11 | **video** | `:::video id=YOUTUBE start=120 label="…" caption="…"` | `<div class="video-reference"><button class="video-open" data-video="ID" data-start="120"><i class="icon" data-icon="play"></i> 영상 · label</button><p class="media-caption">caption</p></div>` | label 40; caption 60 |
| 12 | **quote** | `> text` + `> — cite` | `<blockquote class="quote"><p>…</p><cite>…</cite></blockquote>` | text 120; cite 40 |
| 13 | **code** | fenced block ```` ```bash title="…" ```` | `<figure class="code"><figcaption>title</figcaption><pre><code class="language-bash">…</code></pre></figure>`; inline `` `x` `` → `<code>` chip | ≤12 lines; 80 cols |
| 14 | **pills** | `:::pills` + items `- ok: 텍스트` (tone: text) or `- 텍스트` | `<div class="pills"><span class="pill tone-ok">…</span></div>` | ≤8; text 16 |
| 15 | **verdict** | `:::verdict allow 라벨?` + text (allow/drop/ok/hot/info) | `<div class="verdict verdict-allow"><b>허용</b><span>…</span></div>` (default labels 허용/차단/정상/주의/참고) | label 8; text 80 |
| 16 | **timeline** | `:::timeline` + pipe rows `시점 \| 제목 \| 설명` | `<ol class="timeline"><li id><time>시점</time><b>제목</b><span>설명</span></li></ol>` | ≤6; at 12; title 20; body 50 |
| 17 | **tiles** | `:::tiles cols=4` + YAML `{icon?, label, value?, tone?}` | `<div class="tiles cols-4"><div class="tile tone-primary" id><i class="icon" data-icon></i><b class="tile-label">…</b><span class="tile-value">…</span></div></div>` | items = cols; label 14; value 12 |
| 18 | **terms** | `:::terms` + pipe rows `LPR \| License Plate Recognition \| 차량번호 인식` | `<dl class="terms"><div class="term" id><dt>LPR</dt><dd><i class="term-en">…</i><span class="term-ko">…</span></dd></div></dl>` | ≤6; abbr 8; en 40; ko 24 |
| 19 | **paragraph** | plain paragraph; `### text` → lead | `<p class="s-p [lead]">…</p>` | 220; lead 90 |
| 20 | **widget** | `:::widget abac key=value …` | `<div class="widget" data-widget="abac" data-params='{"key":"value"}'></div>` (runtime plugin mounts; Phase 3) | — |
| 21 | **html** | `:::html` … `:::` | verbatim | — |

Rendering rules
- Text fields are escaped, then inline Markdown is applied; `terms` abbreviations are wrapped
  as `<abbr class="term" title="expansion">LPR</abbr>`.
- `cards`/`tiles` with `icon` get the inline SVG; unknown icon name → lint `icon.unknown`,
  rendered without icon.
- `image`: the compiler inlines the optimised image as a data URI and writes `width`/`height`.
  The popup reads the same `<img>`; no second copy is stored.
- Over-budget text is **not truncated**; lint reports it (`budget.<block>.<field>`) so the AI
  or author fixes the source.

## 3. Type scale and spacing (both themes share; colours differ)

| Token | Value | Used by |
|---|---|---|
| `--fs-display` | 92px | cover-title |
| `--fs-headline` | 56px | hero-title, divider-title |
| `--fs-section` | 42px | section-title |
| `--fs-lead` | 30px | s-sub, lead paragraph, divider-lead |
| `--fs-card` | 30px | v-card h3, tile-label |
| `--fs-body` | 26px | body text, cells, list items |
| `--fs-caption` | 22px | kicker, captions, eyebrow, footer |
| `--fs-micro` | 18px | slide-no, pills |
| `--fs-table` | 24px | v-table |
| `--slide-pad` | 96px 112px | slide-wrapper padding |
| `--gap` | 28px | s-body gap |
| `--radius` | 20px | cards, callouts, figures |

Theme tokens (`--primary`, `--navy`, `--text`, `--muted`, `--border`, `--bg-card`,
`--shadow-*`, `--ok`, `--warn`, `--danger`, `--info`) are defined per theme in
`packages/design-system/src/themes/`. V20 values: `--primary:#6B4BFF`, `--navy:#1A1B4D`,
`--text:#1C1C2E`, `--muted:#566176`, `--border:#E8E5F5`, `--bg-card:#F7F5FD`, `--red:#EF1C5C`,
`--accent-blue:#3E9CF5`. CAU navy values: `--navy:#201D30`, blues `#F9FBFF … #1C2846`
(`--u-blue-01..12`), `--u-brand-text:#4663AE`, `--u-err:#EE4C54`, `--u-ok-fill:#32D8E3`,
greys `#DDDDDD … #111518`.

## 4. Legacy vocabulary → component (for the importer)

| V20 (week 3) | v9.7 (week 5) | Component |
|---|---|---|
| `.decision-chain > article` | `ol.steps` (numbered), `.sv-steps` | chain / steps |
| `.v-cards.cols-N > .v-card (.v-kicker,h3,p)` | `.card`, `.pcard`, `.tile` | cards / tiles |
| `.takeaway` | `.callout` (single line), `.fin` | takeaway |
| `.v-table`, `table` | `table`, `.tp-pol table` | table |
| `.compare-layout .compare-side/.compare-mid` | `.row .col` pairs | compare / columns |
| `.notice`, `.help-card` | `.callout`, `.why`, `.key` | callout |
| `.image-open`, `figure`, `.media-caption` | `img`, `.gm` | image |
| `.video-reference`, `.video-frame` | — | video |
| `.quote-slide` | — | quote slide |
| `.eyebrow`, `.section-title`, `.s-body` | `.s-eyebrow`, `.s-title`, `.s-head`, `.s-body` | scaffold |
| `.slide-tag-bottom`, `.source-link` | `.s-foot`, `.brand`, `.logo`, `.sv-ref` | footer / refs |
| `.note-terms`, `.tip-en/.tip-ko`, `wrapAbbr()` | `data-terms`, `data-tip` | terms / abbr |
| — | `.pill`, `.verdict`, `.allow/.drop/.ok/.hot` | pills / verdict |
| — | `.s-q .q-tag .q-text`, `data-q` | question strip |
| — | `code` (490×) | code chips |
| `.cover`, `.divider` | `.hero`, `.hero.alert` | cover / divider / hero |
| interactive: `abac()`, `renderJit()`, `mfa`, lock toggle | `sv-*`, `dd-*`, `simfull`, `QUIZ`, `SIMS`, `TERMS`, `FWCLI` | widget (Phase 3) |
