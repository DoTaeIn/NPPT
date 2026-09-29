import { readFileSync } from 'node:fs';
import { iconSvg } from '@marco/compiler';
import { LINT_CODES } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import { ASSETS_README, LECTURE_TEMPLATE, repairHint } from '../src/index.js';

const FALLBACK = repairHint({ code: 'no.such.code', message: '' });

describe('repairHint', () => {
  it('has a specific hint for every lint code in LINT_CODES (docs/spec/ir.md §5)', () => {
    for (const code of Object.keys(LINT_CODES)) {
      const probe = code === 'budget.*' ? 'budget.steps.title' : code;
      const hint = repairHint({ code: probe, message: '' });
      expect(hint, code).not.toBe(FALLBACK);
      expect(hint.length, code).toBeGreaterThan(10);
    }
  });

  it('puts the budget and the current length into budget hints', () => {
    const text = repairHint({
      code: 'budget.cards.body',
      message: 'cards[1].body: 104자 (허용 90자)',
    });
    expect(text).toContain('90자 이하');
    expect(text).toContain('지금 104자');
    const items = repairHint({
      code: 'budget.bullets.items',
      message: 'bullets.items: 8개 (허용 6개)',
    });
    expect(items).toContain('6개 이하');
    const title = repairHint({ code: 'budget.slide.title', message: 'title: 40자 (허용 34자)' });
    expect(title).toContain('`title:`');
    expect(title).toContain('34자 이하');
  });

  it('covers the parser families', () => {
    for (const code of [
      'format.container.unknown',
      'format.item.syntax',
      'format.field.unknown',
      'format.slide.token',
      'format.frontmatter.yaml',
      'format.note.duplicate',
      'format.heading.level',
      'schema.invalid',
      'asset.remote',
      'font.fallback',
      'mcp.path.outside',
    ]) {
      expect(repairHint({ code, message: '' }), code).not.toBe(FALLBACK);
    }
  });

  it('only suggests icons that exist', () => {
    const hint = repairHint({ code: 'icon.unknown', message: '' });
    const names = /예: ([^)]+)\)/
      .exec(hint)![1]!
      .split(',')
      .map((s) => s.trim());
    expect(names.length).toBeGreaterThan(2);
    for (const name of names) expect(iconSvg(name), name).toBeTruthy();
  });
});

describe('starter template', () => {
  it('is the `marco new` template (apps/cli/templates)', () => {
    const cli = (rel: string) =>
      readFileSync(new URL(`../../../apps/cli/templates/${rel}`, import.meta.url), 'utf8');
    expect(LECTURE_TEMPLATE).toBe(cli('lecture.marco.md'));
    expect(ASSETS_README).toBe(cli('assets/README.md'));
  });
});
