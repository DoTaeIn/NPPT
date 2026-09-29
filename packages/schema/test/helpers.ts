import { readFileSync } from 'node:fs';
import type { Lecture } from '../src/index.js';

const here = (name: string): URL => new URL(`./fixtures/${name}`, import.meta.url);

/** Raw text of a fixture file. */
export const fixtureText = (name: string): string => readFileSync(here(name), 'utf8');

/** Parsed JSON fixture (typed loosely on purpose: invalid fixtures are not Lectures). */
export const fixture = (name: string): unknown => JSON.parse(fixtureText(name));

/** Parsed JSON fixture known to be a valid Lecture. */
export const lectureFixture = (name: string): Lecture => fixture(name) as Lecture;

/** Recursively freeze a value so accidental mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** A minimal valid lecture with the given slides (and optional top-level overrides). */
export function makeLecture(slides: Lecture['slides'], extra: Partial<Lecture> = {}): Lecture {
  return {
    ir: '0.1',
    meta: { title: '테스트', lang: 'ko', theme: 'v20-violet', edition: 'instructor' },
    refs: [],
    videos: [],
    assets: {},
    terms: {},
    slides,
    ...extra,
  };
}
