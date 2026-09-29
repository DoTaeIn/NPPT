// Shared runtime state, listener bookkeeping, a tiny internal pub/sub and the overlay stack.
import { emptyData } from './data';
import type { Edition, LectureData } from './types';

export interface Overlay {
  id: string;
  close(): void;
}

export interface RuntimeState {
  ready: boolean;
  slides: HTMLElement[];
  cur: number;
  data: LectureData;
  edition: Edition;
  stage: HTMLElement | null;
  canvas: HTMLElement | null;
  scale: number;
  notesOpen: boolean;
  tocOpen: boolean;
  /** Open overlays, most recent last; `Esc` closes the last one. */
  overlays: Overlay[];
  /** Aborts every listener the runtime registered (used by dispose()). */
  ac: AbortController;
}

export const S: RuntimeState = fresh();

function fresh(): RuntimeState {
  return {
    ready: false,
    slides: [],
    cur: 0,
    data: emptyData(),
    edition: 'instructor',
    stage: null,
    canvas: null,
    scale: 1,
    notesOpen: false,
    tocOpen: false,
    overlays: [],
    ac: new AbortController(),
  };
}

export function resetState(): void {
  S.ac.abort();
  Object.assign(S, fresh());
  topics.clear();
}

/** addEventListener bound to the runtime's lifetime. */
export function listen<E extends Event = Event>(
  target: EventTarget,
  type: string,
  fn: (e: E) => void,
  opts: AddEventListenerOptions = {},
): void {
  target.addEventListener(type, fn as EventListener, { ...opts, signal: S.ac.signal });
}

// Internal topics: 'ui' (panel/tool state changed), 'modal' (a modal opened), 'print' (printing starts).
const topics = new Map<string, Set<() => void>>();

export function sub(topic: string, fn: () => void): void {
  let set = topics.get(topic);
  if (!set) topics.set(topic, (set = new Set()));
  set.add(fn);
}

export function pub(topic: string): void {
  topics.get(topic)?.forEach((fn) => fn());
}

export function pushOverlay(id: string, close: () => void): void {
  removeOverlay(id);
  S.overlays.push({ id, close });
}

export function removeOverlay(id: string): void {
  S.overlays = S.overlays.filter((o) => o.id !== id);
}

export const body = (): HTMLElement => document.body;
