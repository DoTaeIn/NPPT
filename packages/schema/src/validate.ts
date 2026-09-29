/**
 * Structural validation of the Lecture IR against `lectureSchema` (Ajv, draft 2020-12).
 *
 * Errors are translated into short, repairable messages with a JSON-pointer `path`
 * (the pointer is not repeated in `message`; print them as `${path}: ${message}`).
 */
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { BLOCK_TYPES, lectureSchema } from './schema.js';
import type { JsonSchema } from './schema.js';
import { didYouMean, pointerToken } from './text.js';
import type { Lecture, ValidationError, ValidationResult } from './types.js';

// ajv-formats is CommonJS; under NodeNext its default import is the module object.
const addFormats = addFormatsModule.default;

let compiled: ValidateFunction | undefined;

/** Ajv copy of the schema: same rules, plus Ajv's `discriminator` so block errors stay local. */
function ajvSchema(): JsonSchema {
  const copy = JSON.parse(JSON.stringify(lectureSchema)) as JsonSchema & {
    $defs: Record<string, JsonSchema>;
  };
  copy.$defs.Block = { ...copy.$defs.Block, discriminator: { propertyName: 'type' } };
  return copy;
}

function validator(): ValidateFunction {
  if (!compiled) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, verbose: true, discriminator: true });
    addFormats(ajv, ['uri']);
    compiled = ajv.compile(ajvSchema());
  }
  return compiled;
}

const quote = (value: unknown): string =>
  typeof value === 'string' ? `'${value}'` : (JSON.stringify(value) ?? String(value));

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

const article = (type: string): string => (/^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`);

const hint = (value: unknown, candidates: readonly string[]): string => {
  if (typeof value !== 'string') return '';
  const match = didYouMean(value, candidates);
  return match ? `; did you mean '${match}'?` : '';
};

/** Translate one Ajv error; returns undefined for errors that only restate another one. */
function translate(error: ErrorObject): ValidationError | undefined {
  const path = error.instancePath;
  const params = error.params as Record<string, unknown>;
  const data: unknown = error.data;
  switch (error.keyword) {
    case 'required': {
      const property = String(params.missingProperty);
      return {
        path: `${path}/${pointerToken(property)}`,
        message: `missing required property '${property}'`,
      };
    }
    case 'additionalProperties': {
      const property = String(params.additionalProperty);
      const parent = (error.parentSchema ?? {}) as { properties?: Record<string, unknown> };
      const allowed = Object.keys(parent.properties ?? {});
      const suggestion = didYouMean(property, allowed);
      return {
        path: `${path}/${pointerToken(property)}`,
        message: suggestion
          ? `unknown property '${property}' (did you mean '${suggestion}'?)`
          : `unknown property '${property}' (allowed: ${allowed.join(', ')})`,
      };
    }
    case 'discriminator': {
      if (params.error === 'mapping') {
        const value = params.tagValue;
        const suggestion = typeof value === 'string' ? didYouMean(value, BLOCK_TYPES) : undefined;
        return {
          path,
          message: suggestion
            ? `unknown block type ${quote(value)} (did you mean '${suggestion}'?)`
            : `unknown block type ${quote(value)} (expected one of: ${BLOCK_TYPES.join(', ')})`,
        };
      }
      const value = (data as Record<string, unknown> | null)?.type;
      return value === undefined
        ? { path: `${path}/type`, message: `missing required property 'type' (block type)` }
        : { path: `${path}/type`, message: `block type must be a string (got ${typeName(value)})` };
    }
    case 'type': {
      const expected = String(params.type);
      if (path === '') {
        return { path, message: `lecture must be a JSON object (got ${typeName(data)})` };
      }
      return { path, message: `must be ${article(expected)} (got ${typeName(data)})` };
    }
    case 'const':
      return { path, message: `must be ${quote(params.allowedValue)} (got ${quote(data)})` };
    case 'enum': {
      const allowed = (params.allowedValues as unknown[]) ?? [];
      const names = allowed.map((v) => String(v));
      return {
        path,
        message: `must be one of ${allowed.map(quote).join(', ')} (got ${quote(data)}${hint(data, names)})`,
      };
    }
    case 'pattern':
      return {
        path,
        message: `invalid value ${quote(data)} (must match ${String(params.pattern)})`,
      };
    case 'format':
      return { path, message: `must be a valid ${String(params.format)} (got ${quote(data)})` };
    case 'minLength':
      return Number(params.limit) === 1
        ? { path, message: 'must not be empty' }
        : { path, message: `must be at least ${String(params.limit)} characters` };
    case 'minItems':
      return { path, message: `must have at least ${String(params.limit)} item(s)` };
    case 'maxItems':
      return { path, message: `must have at most ${String(params.limit)} item(s)` };
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
      return {
        path,
        message: `must be ${String(params.comparison)} ${String(params.limit)} (got ${quote(data)})`,
      };
    case 'oneOf':
    case 'anyOf':
    case 'if':
      // Branch errors carry the detail; the summary adds nothing for a repair loop.
      return undefined;
    default:
      return { path, message: error.message ?? `failed ${error.keyword}` };
  }
}

/** Translate Ajv errors into de-duplicated `ValidationError`s. */
function toValidationErrors(errors: readonly ErrorObject[]): ValidationError[] {
  const out: ValidationError[] = [];
  const seen = new Set<string>();
  for (const error of errors) {
    const translated = translate(error);
    if (!translated) continue;
    const key = `${translated.path}\u0000${translated.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(translated);
  }
  if (!out.length && errors.length) {
    const first = errors[0];
    out.push({ path: first?.instancePath ?? '', message: first?.message ?? 'invalid lecture' });
  }
  return out;
}

/**
 * Validate an unknown value against the Lecture IR schema. Structural only: budgets,
 * references and ids are checked by `lintLecture`. Run `normalizeLecture` first on partial
 * input (compiler/AI output) so defaults and ids are present.
 * On success `lecture` is the input object itself (not a copy).
 */
export function validateLecture(input: unknown): ValidationResult {
  const validate = validator();
  if (validate(input)) return { ok: true, lecture: input as Lecture };
  return { ok: false, errors: toValidationErrors(validate.errors ?? []) };
}

/** Human-readable lines: `/slides/3/blocks/1: unknown block type 'card' (did you mean 'cards'?)`. */
export function formatValidationErrors(errors: readonly ValidationError[]): string {
  return errors.map((e) => `${e.path || '/'}: ${e.message}`).join('\n');
}
