import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, blockDefName, lectureSchema } from '../src/index.js';
import { fixture } from './helpers.js';

const root = new URL('../', import.meta.url);
const schemaFile = JSON.parse(readFileSync(new URL('lecture.schema.json', root), 'utf8')) as {
  $defs: Record<string, { oneOf?: { $ref: string }[]; properties?: Record<string, unknown> }>;
};

describe('lecture.schema.json', () => {
  it('is identical to the exported lectureSchema (run `pnpm --filter @marco/schema schema:emit` after changing src/schema.ts)', () => {
    expect(schemaFile).toEqual(lectureSchema);
  });

  it('declares draft 2020-12 and a Lecture root', () => {
    expect(lectureSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(lectureSchema.required).toEqual([
      'ir',
      'meta',
      'refs',
      'videos',
      'assets',
      'terms',
      'slides',
    ]);
  });

  it('discriminates every block type with oneOf + const', () => {
    const refs = schemaFile.$defs.Block?.oneOf?.map((branch) => branch.$ref) ?? [];
    expect(refs).toEqual(BLOCK_TYPES.map((type) => `#/$defs/${blockDefName(type)}`));
    expect(BLOCK_TYPES).toHaveLength(21);
    for (const type of BLOCK_TYPES) {
      expect(schemaFile.$defs[blockDefName(type)]?.properties?.type).toEqual({
        type: 'string',
        const: type,
      });
    }
  });

  it('closes every object except the free-form plugin payloads', () => {
    const open: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${path}/${i}`));
      if (typeof node !== 'object' || node === null) return;
      const schema = node as Record<string, unknown>;
      if (schema.type === 'object' && schema.additionalProperties !== false) open.push(path);
      for (const [key, child] of Object.entries(schema)) walk(child, `${path}/${key}`);
    };
    walk(schemaFile, '');
    expect(open.sort()).toEqual([
      '/$defs/Block',
      '/$defs/WidgetBlock/properties/params',
      '/properties/assets',
      '/properties/sims',
      '/properties/terminals',
      '/properties/terms',
    ]);
    // Block is closed by its oneOf branches; assets/terms constrain their values instead.
    expect(schemaFile.$defs.Block?.oneOf).toHaveLength(BLOCK_TYPES.length);
  });

  it('works as-is with a plain draft 2020-12 validator (no Ajv extensions)', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormatsModule.default(ajv, ['uri']);
    const validate = ajv.compile(schemaFile);
    expect(validate(fixture('minimal.json'))).toBe(true);
    expect(validate(fixture('week03-excerpt.json'))).toBe(true);
    expect(validate(fixture('invalid-block-type.json'))).toBe(false);
    expect(validate(fixture('invalid-missing-title.json'))).toBe(false);
  });

  it('ships the JSON file with the package', () => {
    const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(pkg.files).toContain('lecture.schema.json');
    expect(pkg.exports['./lecture.schema.json']).toBe('./lecture.schema.json');
  });
});
