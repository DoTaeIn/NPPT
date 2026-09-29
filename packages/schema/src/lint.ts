import type { Lecture, LintIssue } from './types.js';

/** Placeholder linter: returns no issues until budget/ref/time rules are implemented. */
export function lintLecture(_lecture: Lecture): LintIssue[] {
  return [];
}
