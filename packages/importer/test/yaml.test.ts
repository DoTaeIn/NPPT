import { describe, expect, it } from 'vitest';
import { isPlainSafe, toYaml, toYamlList, yamlFlowList, yamlString } from '../src/yaml.js';

describe('yaml writer', () => {
  it('keeps safe strings plain and quotes ambiguous ones', () => {
    for (const s of ['물리보안 · 출입통제 IAM', '외곽 → 로비', '01 · 인증', 'NIST PACS · PIV', 'S13']) expect(isPlainSafe(s)).toBe(true);
    for (const s of ['01', '1.5', 'yes', 'No', 'null', '~', '12:30', 'a: b', 'x #y', '- item', '"q"', "'q'", '#tag', '@x', '', ' pad', 'https://x.org', '2025-10-10']) {
      expect(isPlainSafe(s), s).toBe(false);
    }
    expect(yamlString('01')).toBe('"01"');
    expect(yamlString('say "hi"')).toBe('say "hi"');
    expect(yamlString('"hi"')).toBe('"\\"hi\\""');
  });

  it('writes nested maps and lists deterministically', () => {
    expect(toYaml({ title: 'T', week: 3, refs: { S13: { title: 'Axis', url: 'https://a.b/c' } }, empty: undefined })).toBe(
      'title: T\nweek: 3\nrefs:\n  S13:\n    title: Axis\n    url: "https://a.b/c"',
    );
    expect(toYamlList([{ title: 'a', body: undefined }, 'b', { opts: ['x', 'y'] }])).toBe('- title: a\n- b\n- opts:\n  - x\n  - "y"');
    expect(yamlFlowList(['S13', 'S14'])).toBe('[S13, S14]');
  });
});
