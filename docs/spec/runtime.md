# Runtime contract v0.1

`@marco/runtime` is the browser code embedded in every built deck. It is content-agnostic:
it finds slides in the DOM, reads `#lecture-data`, and injects its own UI chrome. It owns the
chrome CSS (injected at init); slide content CSS is the design system's.

## 1. Document the compiler emits

```html
<!doctype html>
<html lang="ko" data-theme="v20-violet" data-edition="instructor">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>3주차 · 물리보안·출입통제 IAM</title>
<!--
  Built with MARCO Engine v0.1.0 (https://github.com/DoTaeIn/NPPT)
  Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco
  Engine: MARCO Engine License 1.0. Lecture content © its author. Third-party notices: see NOTICE in the engine repository.
-->
<style>/* design-system: dist/marco.css (theme selected by html[data-theme]) */</style>
</head>
<body>
  <div id="stage"><div id="canvas">
    <section class="slide" …>…</section>   <!-- one per slide, in order; see components.md -->
  </div></div>
  <script id="lecture-data" type="application/json">{ … }</script>
  <script>/* dist/marco-runtime.js */</script>
</body>
</html>
```

`#lecture-data`:
```ts
{
  ir: "0.1",
  engine: { name: "MARCO Engine", version: "0.1.0" },
  meta: LectureMeta,
  refs: Ref[],                        // for the sources dialog
  videos: Video[],
  assets: Record<id, {title, credit, source, alt}>,   // metadata only; image bytes live in <img src>
  slideRefs: Record<slideId, refId[]>,
  terms: Record<abbr, expansion>,
  notes?: Record<slideId, SlideNote>,  // omitted in the student edition
  quiz?: QuizItem[], sims?: …, terminals?: …           // plugin data
}
```

## 2. Layout and scaling

- Logical canvas `CW=1920, CH=1080`. `#canvas` is positioned absolutely and transformed
  with `scale(min(w/CW, h/CH))`, centred in the free area. Open panels reduce `w`: notes
  panel 420px (right), TOC sidebar 280px (left). Recompute on `resize` and
  `fullscreenchange`. Font sizes never change with viewport size, so line breaks are stable.
- Exactly one `section.slide.active` is visible; others are `display:none`.
- The runtime appends `<div class="slide-no">04 / 40</div>` and
  `<div class="slide-progress" style="width:10%">` to the active slide.

## 3. Chrome the runtime injects (ids are contract for CSS/tests)

`#nav-dock` (prev/next/counter/notes/toc/print/fullscreen/help buttons, bottom centre, auto-hides),
`#toc-sidebar` (grouped by `data-group`, active tracking, click to jump), `#notes-panel`
(cues rendered by kind with the marker label, time budget, cue ids), `#search`
(`/` opens; matches slide titles, body text and note text; Enter jumps),
`#pen-toolbar` + `#pen-canvas` + `#laser-canvas` (ink: pen, highlighter, eraser, text, rect,
ellipse, line, arrow, laser; 8 colours; size; clear; ink is per slide and cleared on change),
`#dialog` (generic modal: sources, media credits, image popup, video),
`#help` (keyboard map, engine version, **the Attribution line, verbatim**:
`Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco`,
with the URL as a link). The help overlay is always present; there is no build option to
remove it.

## 4. Keyboard

| Key | Action |
|---|---|
| `→` `↓` `Space` `PageDown` | next slide |
| `←` `↑` `PageUp` | previous slide |
| `Home` / `End` | first / last |
| `F` | toggle fullscreen |
| `N` | toggle notes panel (hidden in student edition) |
| `M` | toggle TOC sidebar |
| `/` | search |
| `?` or `H` | help |
| `P` | toggle pen; `L` laser; `E` eraser; `C` clear ink; `1`–`8` pen colour |
| `Esc` | close the topmost overlay, else exit pen |
| `Ctrl+P` | print, lecture mode |
| `Ctrl+Shift+P` | print, handout mode |

Keys are ignored while typing in an input.

## 5. Print modes

- **Lecture** (`Ctrl+P`): one slide per page, `@page { size: 1920px 1080px; margin: 0 }`,
  every slide visible, chrome hidden, ink hidden, notes hidden. Body class `print-lecture`.
- **Handout** (`Ctrl+Shift+P`): `@page { size: A4 portrait; margin: 0 }`; body class
  `handout-mode`; the runtime builds `#handout` containing, per slide, a scaled slide
  thumbnail and the full note text (cues with marker labels), plus a terms list. Removed
  after printing.
- The runtime sets `@page` via a `<style id="page-size">` element; the design system ships
  the print CSS for both modes (`print.css`).

## 6. Dialogs and media

- `button.source-link[data-source=slideId]` → sources dialog listing `refs` for that slide
  (`id · title` as links). Help includes "모든 출처" (all refs) and "이미지·영상 출처" (assets credits).
- `button.image-open[data-asset]` → image popup with the `<img>` from
  `figure[data-asset] img` on the current slide, title and credit from `assets`.
- `button.video-open[data-video][data-start]` → embedded YouTube iframe in the dialog
  (`https://www.youtube-nocookie.com/embed/ID?start=S`); when `location.protocol === 'file:'`,
  open `https://www.youtube.com/watch?v=ID&t=Ss` in a new window instead (embed is blocked
  from file://). Videos need network; state this in the dialog.
- `abbr.term` → native tooltip; the notes panel lists the slide's terms.

## 7. Public API and events

```ts
window.MARCO = {
  version: string,
  slides: HTMLElement[],
  get cur(): number,
  go(i: number): void, next(): void, prev(): void, goId(id: string): void,
  toggleNotes(), toggleToc(), toggleHelp(), toggleFullscreen(),
  print(mode: 'lecture' | 'handout'): void,
  registerPlugin(name: string, plugin: { mount(el: HTMLElement, params: unknown, ctx: PluginCtx): void }): void,
  data: LectureData,   // parsed #lecture-data
  about(): string,     // engine version + Attribution
};
document.dispatchEvent(new CustomEvent('marco:ready'));
document.dispatchEvent(new CustomEvent('marco:slidechange', { detail: { index, id } }));
```
On init the runtime mounts every `[data-widget]` element with the registered plugin of that
name (plugins are separate bundles concatenated after the core; Phase 3). Unknown widget names
render a small placeholder so the slide still lays out.

## 8. Editions

`html[data-edition="student"]`: no `notes` in data, `N` disabled, notes button hidden, handout
mode prints slide thumbnails with the `[화면]`-free empty note area. Everything else identical.

## 9. Size and compatibility

- Core ≤ 120 KB minified (target ~60 KB). No external requests. ES2020, Chromium/Edge/Safari/Firefox
  current versions. Works from `file://`.
- No dependency on Lucide at runtime; chrome icons are inline SVG strings in the bundle.
