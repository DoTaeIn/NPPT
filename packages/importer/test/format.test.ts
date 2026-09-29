import { describe, expect, it } from 'vitest';
import { alignMarkdownTables, formatJson, stringWidth } from '../src/index.js';

describe('stringWidth', () => {
  it('counts East Asian wide characters as 2', () => {
    expect(stringWidth('abc')).toBe(3);
    expect(stringWidth('표지')).toBe(4);
    expect(stringWidth('1부 · 3선')).toBe(9);
    expect(stringWidth('→ ≠ ① “”')).toBe(8);
  });
});

describe('alignMarkdownTables', () => {
  it('pads cells to the display width and keeps alignment markers', () => {
    const md = [
      '# T',
      '',
      '| Block | Count |',
      '|---|---:|',
      '| 표 | 3 |',
      '| paragraph | 12 |',
      '',
      'x | y',
    ].join('\n');
    expect(alignMarkdownTables(md)).toBe(
      [
        '# T',
        '',
        '| Block     | Count |',
        '| --------- | ----: |',
        '| 표        |     3 |',
        '| paragraph |    12 |',
        '',
        'x | y',
      ].join('\n'),
    );
  });

  it('handles empty header cells, escaped pipes and centred columns', () => {
    expect(alignMarkdownTables('| | |\n|:---:|---|\n| a \\| b | 한글 |')).toBe(
      '|        |      |\n| :----: | ---- |\n| a \\| b | 한글 |',
    );
  });
});

describe('formatJson', () => {
  it('prints like Prettier: objects expanded, short arrays inline', () => {
    expect(formatJson({ a: 1, b: ['x', 'y'], c: {}, d: [] })).toBe(
      '{\n  "a": 1,\n  "b": ["x", "y"],\n  "c": {},\n  "d": []\n}\n',
    );
  });

  it('breaks arrays that hold objects or several multi-element arrays', () => {
    expect(
      formatJson({
        pts: [
          [70, 150],
          [225, 290],
        ],
        one: [[1, 2]],
        objs: [{ n: 1 }],
      }),
    ).toBe(
      '{\n  "pts": [\n    [70, 150],\n    [225, 290]\n  ],\n  "one": [[1, 2]],\n  "objs": [\n    {\n      "n": 1\n    }\n  ]\n}\n',
    );
  });

  it('fills long number arrays and puts long string arrays one per line', () => {
    const nums = Array.from({ length: 40 }, (_, i) => i * 1000);
    const out = formatJson({ nums });
    expect(out.split('\n')[1]).toBe('  "nums": [');
    expect(out.split('\n').every((l) => l.length <= 100)).toBe(true);
    expect(out.split('\n')[2]?.split(', ').length).toBeGreaterThan(5);
    const words = Array.from({ length: 8 }, () => '열두 글자 정도의 긴 문장입니다');
    expect(formatJson(words).split('\n')).toHaveLength(words.length + 3);
  });
});
