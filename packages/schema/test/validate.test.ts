import { describe, expect, it } from 'vitest';
import { formatValidationErrors, validateLecture } from '../src/index.js';
import type { ValidationError } from '../src/index.js';
import { fixture, makeLecture } from './helpers.js';

function errorsOf(input: unknown): ValidationError[] {
  const result = validateLecture(input);
  if (result.ok) throw new Error('expected validation to fail');
  return result.errors;
}

describe('validateLecture', () => {
  it('accepts the minimal fixture and returns the same object', () => {
    const input = fixture('minimal.json');
    const result = validateLecture(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lecture).toBe(input);
  });

  it('accepts the week 3 excerpt', () => {
    expect(validateLecture(fixture('week03-excerpt.json'))).toMatchObject({ ok: true });
  });

  it('accepts over-budget text (budgets are lint, not validation)', () => {
    expect(validateLecture(fixture('invalid-over-budget.json')).ok).toBe(true);
  });

  it('reports an unknown block type once, at the block, with a suggestion', () => {
    const errors = errorsOf(fixture('invalid-block-type.json'));
    expect(errors).toEqual([
      { path: '/slides/1/blocks/1', message: "unknown block type 'card' (did you mean 'cards'?)" },
    ]);
    expect(formatValidationErrors(errors)).toBe(
      "/slides/1/blocks/1: unknown block type 'card' (did you mean 'cards'?)",
    );
  });

  it('lists the valid block types when nothing is close', () => {
    const errors = errorsOf(
      makeLecture([
        { id: 's-01', type: 'content', title: 't', blocks: [{ type: 'diagram' } as never] },
      ]),
    );
    expect(errors[0]?.message).toMatch(
      /^unknown block type 'diagram' \(expected one of: chain, cards, /,
    );
  });

  it('points a missing required property at the property', () => {
    expect(errorsOf(fixture('invalid-missing-title.json'))).toEqual([
      { path: '/slides/0/title', message: "missing required property 'title'" },
    ]);
  });

  it('reports every error in one pass (allErrors) with JSON-pointer paths', () => {
    const input = {
      ir: '0.2',
      meta: { title: 'x', lang: 'kr', theme: 'v20-violet', edition: 'instructor' },
      refs: [{ id: 'S13', title: 'Axis', url: 'not a url' }],
      videos: [],
      assets: {},
      terms: {},
      slides: [
        {
          id: 's-01',
          type: 'content',
          title: 't',
          subtitel: 'typo',
          blocks: [
            { items: [] },
            { type: 'cards', cols: 5, items: [{ title: 3, bdy: 'x' }] },
            { type: 'columns', cols: 2, columns: [[{ type: 'takeaway' }], []] },
          ],
          note: { cues: [{ k: 'SPEAK', t: 'hi', id: 'bad id' }] },
        },
      ],
    };
    const errors = errorsOf(input);
    const byPath = Object.fromEntries(errors.map((e) => [e.path, e.message]));
    expect(byPath['/ir']).toBe("must be '0.1' (got '0.2')");
    expect(byPath['/meta/lang']).toBe("must be one of 'ko', 'en' (got 'kr'; did you mean 'ko'?)");
    expect(byPath['/refs/0/url']).toBe("must be a valid uri (got 'not a url')");
    expect(byPath['/slides/0/subtitel']).toBe(
      "unknown property 'subtitel' (did you mean 'subtitle'?)",
    );
    expect(byPath['/slides/0/blocks/0/type']).toBe("missing required property 'type' (block type)");
    expect(byPath['/slides/0/blocks/1/cols']).toBe('must be one of 2, 3, 4 (got 5)');
    expect(byPath['/slides/0/blocks/1/items/0/title']).toBe('must be a string (got integer)');
    expect(byPath['/slides/0/blocks/1/items/0/bdy']).toBe(
      "unknown property 'bdy' (did you mean 'body'?)",
    );
    expect(byPath['/slides/0/blocks/2/columns/0/0/text']).toBe("missing required property 'text'");
    expect(byPath['/slides/0/note/cues/0/k']).toMatch(
      /^must be one of 'SAY', 'DO', .* \(got 'SPEAK'\)$/,
    );
    expect(byPath['/slides/0/note/cues/0/id']).toMatch(/^invalid value 'bad id' \(must match /);
    expect(errors).toHaveLength(11);
  });

  it('lists allowed properties when an unknown one has no close match', () => {
    const errors = errorsOf(
      makeLecture([
        { id: 's-01', type: 'content', title: 't', blocks: [], background: 'red' } as never,
      ]),
    );
    expect(errors[0]).toEqual({
      path: '/slides/0/background',
      message: expect.stringMatching(
        /^unknown property 'background' \(allowed: id, type, tag, /,
      ) as unknown as string,
    });
  });

  it('rejects non-objects at the root', () => {
    expect(errorsOf(null)).toEqual([
      { path: '', message: 'lecture must be a JSON object (got null)' },
    ]);
    expect(errorsOf([])[0]?.message).toBe('lecture must be a JSON object (got array)');
  });

  it('requires at least one slide', () => {
    expect(errorsOf(makeLecture([]))).toEqual([
      { path: '/slides', message: 'must have at least 1 item(s)' },
    ]);
  });
});
