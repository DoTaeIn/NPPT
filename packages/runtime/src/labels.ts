// Cue kind → Korean marker label (docs/spec/notes.md). Duplicated from the schema on purpose:
// the runtime bundle has no run-time dependency on @marco/schema.
import type { CueKind } from './types';

export const CUE_LABEL: Record<CueKind, string> = {
  SAY: '대사',
  DO: '조작',
  LOOK: '주목',
  ASK: '발문',
  HOP: '이동',
  SQ: '예상질문',
  SA: '예상답변',
  NEXT: '전환',
  TIP: '팁',
  WAIT: '대기',
  SCREEN: '화면',
  VERIFY: '검증',
  MEMO: '메모',
};

export const isCueKind = (k: unknown): k is CueKind =>
  typeof k === 'string' && Object.prototype.hasOwnProperty.call(CUE_LABEL, k);

/** Pen colours; keys `1`–`8` select them in order. */
export const PEN_COLORS: ReadonlyArray<{ c: string; name: string }> = [
  { c: '#EF1C5C', name: '빨강' },
  { c: '#6B4BFF', name: '보라' },
  { c: '#3E9CF5', name: '파랑' },
  { c: '#12B886', name: '초록' },
  { c: '#FF922B', name: '주황' },
  { c: '#FAB005', name: '노랑' },
  { c: '#1A1B4D', name: '남색' },
  { c: '#FFFFFF', name: '흰색' },
];
