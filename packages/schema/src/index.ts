export * from './types.js';
export { BUDGETS, DENSITY, tableCellBudget } from './budgets.js';
export { lectureSchema, LECTURE_SCHEMA_ID, BLOCK_TYPES, blockDefName } from './schema.js';
export type { JsonSchema } from './schema.js';
export { validateLecture, formatValidationErrors } from './validate.js';
export {
  normalizeLecture,
  slideIdFor,
  cueIdFor,
  DEFAULT_META,
  DEFAULT_REFERENCES_TITLE,
} from './normalize.js';
export type { LectureInput, SlideInput, SlideNoteInput, NormalizeOptions } from './normalize.js';
export { coverKicker, coverMeta } from './normalize.js';
export type { SerializeNoteOptions } from './notes.js';
export {
  parseNote,
  serializeNote,
  serializeCue,
  parseNoteTime,
  formatNoteTime,
  markerKind,
  isKnownMarker,
  MARKERS,
  CANONICAL_MARKERS,
  CUE_LABELS,
  CUE_KINDS,
  TIME_MARKER,
} from './notes.js';
export {
  lintLecture,
  LINT_CODES,
  estimateBlockHeight,
  stackHeight,
  availableBodyHeight,
} from './lint.js';
export { charCount, visibleText } from './text.js';
