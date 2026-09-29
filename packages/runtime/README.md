# @marco/runtime

The in-browser deck engine that the compiler inlines into every MARCO lecture deck
(`dist/marco-runtime.js`, one IIFE, zero dependencies, ~63 KB minified / ~22 KB gzip; hard
limit 120 KB). It is content-agnostic: it finds the slides in the DOM, reads `#lecture-data`,
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
- **Plugins** (Phase 3): `[data-widget]` elements are mounted by registered plugins; unknown
  names get a small placeholder so the slide still lays out.
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
dialog is open only `Esc` works; while help is open only `Esc`, `?` and `H`.

## API

```ts
window.MARCO = {
  version: string,                 // runtime version (package.json)
  slides: HTMLElement[],           // copy of the slide list
  cur: number,                     // current index (getter)
  go(i), next(), prev(), goId(id),
  toggleNotes(), toggleToc(), toggleHelp(), toggleFullscreen(),
  print(mode: 'lecture' | 'handout'),
  registerPlugin(name, { mount(el, params, ctx) }),
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
    /* contents of dist/marco-runtime.js */
  </script>
  <script>
    /* optional plugin bundles (Phase 3) */
  </script>
</body>
```

- Read `dist/marco-runtime.js` from this package (`@marco/runtime/dist/marco-runtime.js`) and
  inline it verbatim. `build.mjs` fails if the bundle ever contains `</script` or `<!--`.
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
(cue focus outline), `.widget-placeholder` / `.widget-missing`, and body classes `notes-open`,
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

## Plugins (Phase 3)

A plugin is a separate IIFE concatenated after the core. It can register before or after the
runtime has started:

```js
window.MARCO.registerPlugin('abac', {
  mount(el, params, ctx) {
    // el: the <div data-widget="abac" data-params='{…}'> element; params: parsed JSON (or {})
    // ctx: { data, edition, runtimeVersion, slide, slideIndex, go, goId,
    //        onSlideChange(fn) → unsubscribe, openDialog(title, htmlOrNode), closeDialog }
    el.textContent = `조건 ${params.conditions}개`;
  },
});
```

Every `[data-widget="abac"]` is mounted once (at init, or immediately when registered later),
even on hidden slides; react to `ctx.onSlideChange` to start or stop work. A `mount` that
throws gets an error placeholder instead of breaking the deck.

## Development

```sh
pnpm --filter @marco/runtime build       # dist/marco-runtime.js (+ .debug.js with inline sourcemap), prints size
pnpm --filter @marco/runtime typecheck   # src (DOM, ES2020) and tests
pnpm --filter @marco/runtime test        # vitest (jsdom) then playwright (chromium, file://)
```

Open `test/fixtures/minimal-deck.html` (instructor) or `test/fixtures/minimal-deck.student.html`
in a browser after building; they load `../../dist/marco-runtime.js`. The fixtures follow
runtime.md §1 and components.md §1 and carry a tiny inline stand-in for the design system.
Playwright's global setup rebuilds the bundle first.

Source layout: `main.ts` (entry), `init.ts` (bootstrap/teardown), `data.ts`, `state.ts`,
`layout.ts`, `nav.ts`, `keys.ts`, `media.ts`, `print.ts`, `handout.ts`, `plugins.ts`, `api.ts`,
`chrome.css.ts`, `icons.ts`, `labels.ts`, `chrome/` (dock, toc, notes, search, help, dialog,
toast) and `ink/` (pen, laser, toolbar).

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
- Not ported (week 5 only): whiteboard (`W`) with table insertion, element zoom lightbox,
  draggable toolbar, narration/avatar, student Q&A toggle, and V20's `Ctrl+F` search binding.

## Known limits

- Ink lives in memory only: it is lost on reload and is not printed.
- Dialogs use `aria-modal` but do not trap focus.
- `Video` has no end time, so clips play from `start` to the end.
- End-to-end tests run on Chromium only.
