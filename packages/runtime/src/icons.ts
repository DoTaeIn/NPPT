// Inline SVG icons for the chrome (24×24, stroked with currentColor). Drawn for this runtime; no
// icon library is loaded at run time.

const svg = (d: string): string =>
  `<svg class="mc-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const p = (d: string): string => `<path d="${d}"/>`;

export const ICON = {
  prev: svg(p('M15 18l-6-6 6-6')),
  next: svg(p('M9 18l6-6-6-6')),
  toc: svg(p('M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01')),
  notes: svg(p('M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5')),
  search: svg('<circle cx="11" cy="11" r="7"/>' + p('M21 21l-4.3-4.3')),
  pen: svg(p('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')),
  highlighter: svg(p('M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4')),
  eraser: svg(p('M7 21l-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21zM22 21H7M5 11l9 9')),
  text: svg(p('M4 7V4h16v3M9 20h6M12 4v16')),
  rect: svg('<rect x="3" y="5" width="18" height="14" rx="2"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
  line: svg(p('M5 19L19 5')),
  arrow: svg(p('M7 17L17 7M8 7h9v9')),
  laser: svg('<circle cx="12" cy="12" r="3"/>' + p('M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2')),
  undo: svg(p('M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')),
  trash: svg(p('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6')),
  print: svg(p('M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2') + '<rect x="6" y="14" width="12" height="8"/>'),
  handout: svg(p('M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z')),
  full: svg(p('M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3')),
  help: svg('<circle cx="12" cy="12" r="10"/>' + p('M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01')),
  close: svg(p('M18 6L6 18M6 6l12 12')),
  clock: svg('<circle cx="12" cy="12" r="9"/>' + p('M12 7v5l3 2')),
  play: svg(p('M7 4l13 8-13 8z')),
} as const;

export type IconName = keyof typeof ICON;
