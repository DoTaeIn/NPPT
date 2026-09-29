import type { Lecture, ValidationResult } from './types.js';

/**
 * Placeholder validator: structural minimum until the JSON Schema + Ajv implementation lands.
 * Compiler and CLI call this; keep the signature.
 */
export function validateLecture(input: unknown): ValidationResult {
  const errors: { path: string; message: string }[] = [];
  const l = input as Partial<Lecture> | null;
  if (!l || typeof l !== 'object') return { ok: false, errors: [{ path: '', message: 'lecture must be an object' }] };
  if (!l.meta || typeof l.meta.title !== 'string') errors.push({ path: '/meta/title', message: 'meta.title is required' });
  if (!Array.isArray(l.slides)) errors.push({ path: '/slides', message: 'slides must be an array' });
  return errors.length ? { ok: false, errors } : { ok: true, lecture: l as Lecture };
}
