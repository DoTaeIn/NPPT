# @marco/runtime

The in-browser deck engine that the compiler inlines into every MARCO lecture deck
(`dist/marco-runtime.js`, one IIFE, zero dependencies, ~64 KB minified / ~23 KB gzip; hard
limit 120 KB, target 70 KB). Widget plugins ship separately: `dist/marco-runtime.all.js` is the
core plus every bundled plugin (~84 KB / ~29 KB gzip) and `dist/plugins/quiz.js` is the quiz
plugin alone (~20 KB / ~7 KB gzip). It is content-agnostic: it finds the slides in the DOM, reads `#lecture-data`,
injects its own chrome and chrome CSS, and exposes `window.MARCO`. Slide content CSS belongs to
`@marco/design-system`. The contract is [docs/spec/runtime.md](../../docs/spec/runtime.md).

## Features

- **Fixed 1920×1080 canvas** scaled into the free viewport (`scale(min(w/1920, h/1080))`,
  centred); the notes panel (420 px, right) and TOC (280 px, left) shrink the free area. Font
  sizes never change, so line breaks are stable. Recomputed on `resize` and `fullscreenchange`.
- **Navigation**: exactly one `section.slide.active`; `.slide-no` (`04 / 40`) and
  `.slide-progress` appended to the active slide; `marco:slidechange` events; the URL hash
  follows the slide (`#s-04`, and `#4` also works on load).
- **Nav dock** `#nav-dock`: prev / counter / next, TOC, notes, search, pen, lecture print,
  handout print, fullscreen, help. Hides after 2.5 s without pointer movement.
- **TOC** `#toc-sidebar`: grouped by consecutive `data-group`, active tracking, click to jump.
- **Presenter notes** `#notes-panel` (instructor edition): cues rendered by kind with the Korean
  marker label (`[대사]`, `[발문]`, … or the authored alias such as `검증 보충`), cue ids, the
  `[발문] … | 10초` wait, `@target` chips (hovering a cue outlines its targets with
  `.marco-focus`), the slide time budget and a running total against `meta.duration`, the
  slide's `abbr.term` terms, the next slide's title, and font-size buttons.
- **Search** `#search` (`/`): slide titles, body text and note text; a bare number finds that
  slide; ↑/↓ select, Enter jumps.
- **Ink**: `#pen-canvas` inside `#canvas` (logical 1920×1080 coordinates) with pen,
  highlighter, eraser, text, rect, ellipse, line and arrow; 8 colours; size; undo; clear.
  Strokes are kept as vectors per slide, so the canvas is cleared on slide change and restored
  when you come back, and redraws sharply after a resize. `#laser-canvas` draws a fading
  pointer trail. Toolbar `#pen-toolbar`.
- **Dialogs** `#dialog`: sources (`button.source-link[data-source]` → `slideRefs` + `refs`,
  `id · title` links), all sources and media credits (from help), image popup
  (`button.image-open[data-asset]` → the slide's `figure[data-asset] img`, title and credit
  from `assets`), YouTube video (`button.video-open[data-video][data-start]`: embedded
  `youtube-nocookie.com` player, or a new window on `file:` where embeds are blocked).
- **Help** `#help` (`?`/`H`): keyboard map, links to all sources and media credits, deck title,
  engine and runtime versions, and the Attribution line verbatim with the URL as a link. It is
  always built; there is no option to remove it.
- **Print**: lecture (`Ctrl+P`; one 1920×1080 page per slide, `body.print-lecture`) and handout
  (`Ctrl+Shift+P`; A4 portrait, `body.handout-mode`, `#handout` with a scaled thumbnail and the
  full note per slide plus a terms page, removed on `afterprint`). `@page` is set through
  `<style id="page-size">`. Printing from the browser menu uses lecture mode.
- **Editions** via `html[data-edition]`: in `student`, notes are ignored even if present, `N` is
  disabled, the notes button is hidden and the handout prints an empty ruled note area.
- **Plugins**: `[data-widget]` elements are mounted by registered plugins (see [Plugins](#plugins));
  unknown names get a placeholder that names the missing plugin and says whether
  `marco-runtime.all.js` would provide it. Bundled: `quiz` (cards and timed exam).
- **Quiz** (`data-widget="quiz"`): question cards that open a graded dialog (number keys pick
  an option), and an exam mode with a countdown, per-area scoring, a summary dialog and review.
- Touch swipe navigation; letter shortcuts also work while a Korean IME is active.

## Keys

| Key                        | Action                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| `→` `↓` `Space` `PageDown` | next slide                                                                        |
| `←` `↑` `PageUp`           | previous slide                                                                    |
| `Home` / `End`             | first / last                                                                      |
| `F`                        | fullscreen                                                                        |
| `N`                        | notes panel (instructor edition only)                                             |
| `M`                        | TOC sidebar                                                                       |
| `/`                        | search                                                                            |
| `?` or `H`                 | help                                                                              |
| `P`                        | pen on/off; `L` laser; `E` eraser; `C` clear this slide's ink; `1`–`8` pen colour |
| `Ctrl+Z`                   | undo the last stroke (while the pen is on)                                        |
| `Esc`                      | close the topmost overlay (dialog, help, search, TOC), else exit pen / laser      |
| `Ctrl+P` / `Ctrl+Shift+P`  | print lecture / handout (`⌘` on macOS)                                            |

Keys are ignored while typing in an input, textarea, select or contenteditable element. While a
dialog is open only `Esc` works, plus the keys the dialog's owner takes (the quiz dialog takes
`1`–`9` to pick an option); while help is open only `Esc`, `?` and `H`.

## API

```ts
window.MARCO = {
  version: string,                 // runtime version (package.json)
  slides: HTMLElement[],           // copy of the slide list
  cur: number,                     // current index (getter)
  go(i), next(), prev(), goId(id),
  toggleNotes(), toggleToc(), toggleHelp(), toggleFullscreen(),
  print(mode: 'lecture' | 'handout'),
  registerPlugin({ name, mount(el, params, ctx), unmount?(el) }),  // or registerPlugin(name, { mount })
  data: LectureData,               // normalised #lecture-data (getter)
  about(): string,                 // runtime + deck engine version and the Attribution
};
document.addEventListener('marco:ready', …);                 // after init
document.addEventListener('marco:slidechange', (e) => e.detail /* { index, id } */);
```

`window.MARCO` exists as soon as the script runs; the runtime itself starts on
`DOMContentLoaded` (or immediately when the document is already parsed) and sets
`html[data-marco="ready"]`. Loading the bundle twice is harmless: the second copy does nothing.

## How the compiler embeds it

```html
<body>
  <div id="stage">
    <div id="canvas">
      <section class="slide" id="s-01" data-type="cover" data-title="…" data-group="…">…</section>
      …
    </div>
  </div>
  <script id="lecture-data" type="application/json">
    { …; "<" escaped as < }
  </script>
  <script>
    /* contents of dist/marco-runtime.js, or of dist/marco-runtime.all.js when the deck has widgets */
  </script>
</body>
```

- **Pick the bundle by content.** If the rendered slides contain no `[data-widget]`, inline
  `dist/marco-runtime.js` (core). If they contain any widget, inline `dist/marco-runtime.all.js`
  instead (core + every bundled plugin, registered before the runtime starts). Resolve them as
  `import.meta.resolve('@marco/runtime/dist/marco-runtime.js')` and
  `import.meta.resolve('@marco/runtime/dist/marco-runtime.all.js')` (the package exports
  `./dist/*`). Inline the file verbatim; `build.mjs` fails if any bundle contains `</script` or
  `<!--`.
- `dist/manifest.json` lists the files and the widget names the `all` bundle provides:
  `{ "version", "core": "marco-runtime.js", "all": "marco-runtime.all.js", "plugins": { "quiz": "plugins/quiz.js" } }`.
  A widget whose name is not in `plugins` (e.g. `sim` today) only gets a placeholder, so a
  deck whose widgets are all unknown gains nothing from the `all` bundle.
- Alternative for size: inline the core and then one `<script>` per used plugin,
  `@marco/runtime/dist/plugins/<name>.js` (e.g. `plugins/quiz.js`), after it. A plugin bundle
  registers itself on `window.MARCO`; if it runs before the core it queues itself in
  `window.MARCO_PLUGINS` and the core registers it at start, so the order is not critical.
  Widgets whose plugin is in neither bundle get the placeholder.
- `#lecture-data` must not contain a literal `</script`; escape `<` in the JSON.
- `section.slide` must be direct children of `#canvas` and have unique ids; the notes,
  `slideRefs` and `source-link[data-source]` all key on the slide id. If `#stage`/`#canvas`
  are missing the runtime wraps the slides itself.
- Give every slide `data-title` (TOC, search, notes, handout; falls back to its first
  `h1`/`h2`) and `data-group` (consecutive equal values form one TOC group) and `data-type`
  (`cover`/`divider` are bold in the TOC).
- Do not emit `.active`, `.slide-no` or `.slide-progress`; the runtime manages them.

## Styling hooks for the design system

The runtime injects `<style id="marco-chrome">` and styles only its own elements (`#nav-dock`,
`#toc-sidebar`, `#notes-panel`, `#search`, `#help`, `#dialog`, `#pen-toolbar`, `#pen-canvas`,
`#laser-canvas`, `#marco-toast`, `#handout`) plus zero-specificity (`:where`) fallbacks for
`#stage`, `#canvas`, `#canvas > section.slide`, `.slide-no` and `.slide-progress`, which the
design system overrides. It enforces one rule itself: on screen, inactive slides are
`display:none` (except while `body.print-lecture` is set, so a print mode can be previewed).
Its print fallbacks (lecture layout, `#handout` layout) are also zero-specificity, so
`print.css` of the design system wins; only the chrome hiding and the `#canvas` reset (which
must beat the inline `left/top/transform`) use `!important`. Chrome colours follow `--primary`,
`--accent-blue`, `--navy` and `--muted` when the theme defines them. Other hooks: `.marco-focus`
(cue focus outline), `.widget-placeholder` / `.widget-missing`, `#dialog[data-kind]` (`sources`,
`media`, `image`, `video`, `widget`, `quiz`, …), and body classes `notes-open`,
`toc-open`, `pen-on`, `laser-on`, `dialog-open`, `fs-active`, `print-lecture`, `handout-mode`.

The handout DOM (shared with `packages/design-system/src/print.css`):

```html
<div id="handout">
  <article class="ho-page" data-slide="s-04">
    <header class="ho-head">
      <span class="ho-no">04</span>
      <h2 class="ho-title">…</h2>
      <span class="ho-tag">deck title</span>
    </header>
    <div class="ho-shot"><section class="slide active …">clone, ids removed</section></div>
    <div class="ho-note">
      <p class="ho-time">2.5분 · 10:00 – 12:30</p>
      <ol class="ho-cues">
        <li class="ho-cue" data-kind="SAY">
          <b class="ho-marker">대사</b>
          <div class="ho-text">…</div>
        </li>
      </ol>
    </div>
  </article>
  <section class="ho-terms">
    <h2>용어 · 약자</h2>
    <dl>
      <div>
        <dt>LPR</dt>
        <dd>…</dd>
      </div>
    </dl>
  </section>
</div>
```

The thumbnail is scaled by CSS (`--ho-w: 688px`, `--ho-scale: 0.358333`); `.ho-note` is empty
(ruled space) in the student edition and for slides without notes.

## Plugins

A plugin is an object `{ name, mount(el, params, ctx), unmount?(el) }` (`Plugin` in
`src/types.ts`). Register it with `window.MARCO.registerPlugin(plugin)` (or the older
`registerPlugin(name, { mount })`); a standalone bundle uses `definePlugin` from
`src/plugins/define.ts`, which falls back to the `window.MARCO_PLUGINS` queue when the core has
not run yet.

```js
window.MARCO.registerPlugin({
  name: 'abac',
  mount(el, params, ctx) {
    // el: <div class="widget" data-widget="abac" data-params='{…}'>
    // params: data-params parsed as a JSON object ({} when absent, invalid or not an object)
    ctx.registerStyles('.abac-box{border:2px solid var(--primary)}'); // <style id="marco-plugin-abac">, once
    el.innerHTML = `<div class="abac-box">조건 ${params.conditions}개</div>`;
  },
  unmount(el) {
    /* stop timers; called when the runtime is torn down */
  },
});
```

| `ctx.`                                                            |                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `data`, `edition`, `runtimeVersion`                       | plugin name, normalised `#lecture-data` (e.g. `data.quiz`), `instructor`/`student`, runtime version                                                                                                                                                                                    |
| `slide`, `slideId`, `slideIndex`                                  | the containing `section.slide` (null / `''` / -1 outside a slide)                                                                                                                                                                                                                      |
| `go(i)`, `goId(id)`                                               | navigation                                                                                                                                                                                                                                                                             |
| `openDialog(title, htmlOrNode, kind \| { kind, onKey, onClose })` | the runtime `#dialog` (`data-kind`, default `widget`). `onKey(e)` receives keys while that dialog is open, after the runtime handled `Esc`, Ctrl/⌘ shortcuts and Space/Enter on a focused button; return true to consume the key. `onClose()` runs once when it closes or is replaced. |
| `closeDialog()`, `openSources(refIds)`                            | close the dialog; open the sources dialog for these `refs` ids                                                                                                                                                                                                                         |
| `registerStyles(css)`                                             | injects `<style id="marco-plugin-<name>" data-marco-plugin>` once per plugin; later calls are ignored; removed at teardown                                                                                                                                                             |
| `events.on(type, fn)` → off                                       | listens to `marco:<type>` on document (`slidechange`, `ready`, `quiz:submit`, …)                                                                                                                                                                                                       |
| `events.emit(type, detail)`                                       | dispatches `marco:<name>:<type>` from the widget element, bubbling                                                                                                                                                                                                                     |
| `onSlideChange(fn)` → off                                         | shorthand for `events.on('slidechange', fn)`                                                                                                                                                                                                                                           |
| `signal`                                                          | an `AbortSignal` aborted at teardown, for your own `addEventListener` calls                                                                                                                                                                                                            |

Every `[data-widget]` is mounted once, in document order: at init for plugins registered
before the runtime started, or immediately for plugins registered later; widgets on hidden
slides are mounted too (react to `slidechange` to start or stop work) and widgets inside
`#handout` clones never are. A `mount` that throws gets an error placeholder instead of breaking
the deck. Plugin CSS must style only the plugin's own classes and use the theme tokens
(`--primary`, `--navy`, `--muted`, `--border`, `--bg-card`, `--ok`, `--danger`, …) with fallbacks.
Inside `#dialog`, scope rules with `#dialog` (the chrome sets `button{font:inherit;color:inherit}`
at ID specificity).

Adding a bundled plugin: create `src/plugins/<name>/index.ts` (the plugin) and
`src/plugins/<name>/entry.ts` (`definePlugin(plugin)`), add it to `BUNDLED` in
`src/plugins/bundled.ts` and its name to `BUNDLED_PLUGINS` in `src/plugins/registry.ts` (a unit
test keeps them equal). `build.mjs` turns every `entry.ts` into `dist/plugins/<name>.js`.

### Quiz (`data-widget="quiz"`)

Questions come from `#lecture-data` `quiz` (`QuizItem`: `id`, `area`, `areaName`, `key`, `q`,
`opts[]`, `ans` (0-based), `exp`, `refs[]`); invalid items (fewer than two options, `ans` out of
range) are skipped with a warning. Text is escaped; `**bold**` and `` `code` `` are rendered.

```md
:::widget quiz mode=cards area=1
:::widget quiz mode=exam minutes=10
:::widget quiz mode=cards ids=Q03,Q07,Q11 shuffle
```

| Param     | Default |                                                                                                             |
| --------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `mode`    | `cards` | `cards` or `exam`                                                                                           |
| `area`    | all     | only questions with this `area` number                                                                      |
| `ids`     | —       | exactly these ids, in this order (array or `"Q01,Q02"`); wins over `area`                                   |
| `minutes` | `15`    | exam time limit, 1–180 (adjustable with −/+ before starting)                                                |
| `shuffle` | `false` | shuffle the question order (once per mount for cards, per attempt for the exam); options are never shuffled |

- **Cards**: a grid (2×2 for four, up to five columns) of `button.mq-card` with the number (the
  item's position in `quiz`), area label and key term (plus the question when there are at most
  six). A card opens `#dialog[data-kind=quiz]` with the question and option buttons (① ② …;
  keys `1`–`9` pick). The first pick is graded: correct option and wrong pick are marked, then
  the verdict, the explanation and `참고 S13` chips (buttons that open the sources dialog when
  the id is in `refs`, plain chips otherwise). `다시 풀기` resets that question, `다음 문항` opens
  the next. The card keeps `data-state="ok|wrong"` and a status line counts answers.
- **Exam**: a start panel (question count, time limit, `시험 시작`) → every question in a
  scrollable in-slide form (`.mq-list`) with `응답 n / N`, a countdown (`is-warn` in the last
  minute) and `제출` → a `채점 결과` dialog: score out of 100, grade (A ≥ 90, B ≥ 70, C ≥ 50,
  else D, as in week 5), correct/answered counts, time used, a per-area table and the weakest
  area → review in the slide (correct answers, wrong picks, explanations, refs) with `결과 요약`
  and `다시 풀기`. At zero the exam submits itself; the dialog only opens if the widget's slide
  is showing.
- Events: `marco:quiz:answer` `{ id, pick, correct }`, `marco:quiz:start` `{ minutes, total }`,
  `marco:quiz:submit` `{ score, correct, total, answered, grade, areas, auto, seconds }`.
- State is per widget and in memory only (a reload starts over). Everything is Korean.

## Development

```sh
pnpm --filter @marco/runtime build       # dist/marco-runtime.js (+ .debug.js), marco-runtime.all.js, plugins/*.js; prints sizes
pnpm --filter @marco/runtime typecheck   # src (DOM, ES2020) and tests
pnpm --filter @marco/runtime test        # vitest (jsdom) then playwright (chromium, file://)
```

Open `test/fixtures/minimal-deck.html` (instructor; loads `../../dist/marco-runtime.all.js` and
has a quiz slide with a cards and an exam widget) or `test/fixtures/minimal-deck.student.html`
(loads the core `../../dist/marco-runtime.js`) in a browser after building. The fixtures follow
runtime.md §1 and components.md §1 and carry a tiny inline stand-in for the design system.
Playwright's global setup rebuilds the bundle first.

Source layout: `main.ts` / `main-all.ts` (bundle entries), `boot.ts` (creates `window.MARCO`,
registers plugins, starts), `init.ts` (bootstrap/teardown), `data.ts`, `state.ts`, `layout.ts`,
`nav.ts`, `keys.ts`, `media.ts`, `print.ts`, `handout.ts`, `api.ts`, `chrome.css.ts`, `icons.ts`,
`labels.ts`, `chrome/` (dock, toc, notes, search, help, dialog, toast), `ink/` (pen, laser,
toolbar) and `plugins/` (`registry.ts` mounting and context, `define.ts`, `bundled.ts`, and
`quiz/`: `model.ts` params, selection and scoring, `view.ts`, `cards.ts`, `exam.ts`,
`styles.ts`, `index.ts`, `entry.ts`).

## What changed versus the reference runtimes

Compared with the V20 inline runtime (week 3) and "Deck engine v2.1" (week 5):

- Notes come from `#lecture-data` (`notes[slideId].cues`), never from `data-note`; the panel
  renders parsed cues by kind instead of splitting prose (V20) or keyword tabs (v2.1).
- The runtime injects all chrome and its CSS; decks no longer ship toolbar/panel markup.
- No Lucide at run time: chrome icons are inline SVG strings; slide icons are inlined by the
  compiler.
- Ink is stored as vectors per slide (v2.1 stored bitmaps, V20 cleared on every change), with
  undo; `1`–`8` pick colours (V20 used them for tools); text is drawn into the canvas instead
  of draggable DOM boxes.
- Images are read from the slide's `<img>` for the popup (V20 kept a second base64 copy in the
  JSON); abbreviations are `abbr.term` from the compiler (V20 wrapped them at run time with a
  floating tooltip; now the native `title` tooltip).
- Handout is built from DOM clones with cue labels and a terms page; the student edition gets an
  empty ruled note area.
- The dock is anchored bottom-left so it never covers the right-aligned footer and its
  `참고 출처` button.
- The quiz is a widget inside the slide instead of fixed `#qmodal`/`#qexam` overlays: card
  questions use the runtime dialog, the exam is an in-slide scrollable form instead of one
  question per screen, and scoring adds a per-area table. The 10–20 minute slider became −/+
  (1–180 minutes, default from `minutes`).
- Not ported (week 5 only): whiteboard (`W`) with table insertion, element zoom lightbox,
  draggable toolbar, narration/avatar, student Q&A toggle, and V20's `Ctrl+F` search binding.

## Known limits

- Ink lives in memory only: it is lost on reload and is not printed.
- Dialogs use `aria-modal` but do not trap focus.
- Quiz answers and exam results live in memory only and are not sent anywhere; the handout's
  slide clones show the widget as it was, without behaviour.
- `Video` has no end time, so clips play from `start` to the end.
- End-to-end tests run on Chromium only.
