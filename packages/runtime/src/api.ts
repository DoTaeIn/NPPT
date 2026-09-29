// `window.MARCO` (docs/spec/runtime.md §7).
import { toggleHelp } from './chrome/help';
import { toggleNotes } from './chrome/notes';
import { toggleToc } from './chrome/toc';
import { toggleFullscreen } from './layout';
import { go, goId, next, prev } from './nav';
import { registerPlugin } from './plugins';
import { print } from './print';
import { S } from './state';
import type { LectureData, MarcoApi, PrintMode } from './types';
import { ATTRIBUTION, RUNTIME_VERSION } from './version';

/** Engine version plus the Attribution line. */
export function about(): string {
  const e = S.data.engine;
  const deck = e.version ? ` · deck built with ${e.name || 'MARCO Engine'} v${e.version}` : '';
  return `MARCO Engine runtime v${RUNTIME_VERSION}${deck}\n${ATTRIBUTION}`;
}

export function createApi(): MarcoApi {
  return {
    version: RUNTIME_VERSION,
    get slides(): HTMLElement[] {
      return S.slides.slice();
    },
    get cur(): number {
      return S.cur;
    },
    go: (i: number) => go(Number(i)),
    next,
    prev,
    goId: (id: string) => goId(String(id)),
    toggleNotes: () => toggleNotes(),
    toggleToc: () => toggleToc(),
    toggleHelp: () => toggleHelp(),
    toggleFullscreen,
    print: (mode: PrintMode) => print(mode),
    registerPlugin,
    get data(): LectureData {
      return S.data;
    },
    about,
  };
}
