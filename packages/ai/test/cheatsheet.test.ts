import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as schema from '@marco/schema';
import { BUDGETS, type BlockType } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import { DENSITY as SCHEMA_DENSITY } from '../../schema/dist/budgets.js';
import {
  budgetLabel,
  CHEATSHEET_BLOCKS,
  DENSITY,
  DENSITY_MIRROR,
  densityDoc,
  renderBudget,
  renderCheatsheet,
} from '../src/cheatsheet.js';
import { defaultPromptDir, PROMPT_FILES } from '../src/prompts.js';

// Compile-time: the cheat-sheet documents every block type of the IR (`pnpm typecheck` fails otherwise).
type Undocumented = Exclude<BlockType, (typeof CHEATSHEET_BLOCKS)[number]>;
const everyBlockDocumented: [Undocumented] extends [never] ? true : Undocumented = true;

const sheet = renderCheatsheet(BUDGETS);

/** Text of the cheat-sheet section that documents one BUDGETS key. */
function section(key: string): string {
  const lines = sheet.split('\n');
  const start = lines.findIndex(
    (l) => l.startsWith(`### ${key} `) || l === `### ${key}` || l.endsWith(`(${key})`),
  );
  if (start < 0) return '';
  let inFence = false;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(`{3,}|~{3,})/.test(lines[i]!)) inFence = !inFence;
    else if (!inFence && /^#{2,3} /.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function leaves(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(leaves);
  return [];
}

describe('renderCheatsheet', () => {
  it('documents every block type', () => {
    expect(everyBlockDocumented).toBe(true);
    for (const type of CHEATSHEET_BLOCKS) expect(sheet).toContain(`### ${type} `);
    const schemaBlocks = (schema as Record<string, unknown>)['BLOCK_TYPES'];
    if (Array.isArray(schemaBlocks)) {
      for (const type of schemaBlocks) expect(sheet).toContain(`### ${String(type)} `);
    }
  });

  it('covers every key of BUDGETS with all of its numbers', () => {
    for (const [key, spec] of Object.entries(BUDGETS)) {
      const text = section(key);
      expect(text, `section for ${key}`).not.toBe('');
      for (const field of Object.keys(spec)) {
        const label = /^max|^cue/.test(field) ? '' : budgetLabel(key, field);
        if (label) expect(text, `${key}.${field}`).toContain(label);
      }
      for (const n of leaves(spec))
        expect(text, `${key} budget ${n}`).toMatch(new RegExp(`≤[^\\n]*\\b${n}\\b`));
    }
  });

  it('renders per-column budgets compactly', () => {
    expect(renderBudget(BUDGETS.cards, 'cards')).toBe(
      '항목 ≤4/6/8 (cols=2/3/4) · kicker ≤16 · title ≤24 · body ≤90/60/40 (cols=2/3/4)',
    );
    expect(renderBudget(BUDGETS.chain, 'chain')).toBe('항목 ≤6 · label ≤10 · sub ≤22');
    // The scalar `cell` is the one-column fallback of `cellByCols` and is not shown twice.
    expect(renderBudget(BUDGETS.table, 'table')).toBe(
      '열 ≤6 · 행 ≤8 · cell ≤40/30/20/16/12 (cols=2/3/4/5/6)',
    );
  });

  it('teaches the slide-density table the linter uses', () => {
    // The mirror must equal @marco/schema's DENSITY until the package index exports it.
    const shared = Object.fromEntries(
      Object.entries(SCHEMA_DENSITY).filter(([key]) => key !== 'slideTypes'),
    );
    expect(DENSITY_MIRROR).toEqual(JSON.parse(JSON.stringify(shared)));
    expect(DENSITY).toEqual(JSON.parse(JSON.stringify(SCHEMA_DENSITY)));
    const text = densityDoc();
    expect(sheet).toContain(text);
    expect(text).toContain('제목 아래 760');
    expect(text).toContain('둘 다면 629');
    expect(text).toContain('cards 한 줄 200(cols=2)/180(cols=3·4)');
    expect(text).toContain('table 56+행×60');
    expect(text).toContain('블록 사이 28');
    expect(text).toContain('110%');
  });

  it('teaches the pipe-row forms, bracketed image paths, ### headings and cover fields', () => {
    expect(section('cards')).toContain('`kicker | title | body`');
    expect(section('cards')).toContain('인증 | 누구인가 | 카드·PIN·생체로 자격을 확인한다');
    expect(section('tiles')).toContain('`icon | label | value | tone`');
    expect(section('tiles')).toContain('id-card | 인증 | 누구인가');
    expect(section('image')).toContain('`![alt](<assets/출입 통제.png> "caption")`');
    expect(sheet).toContain('`###`만 쓴다');
    for (const field of [
      'kicker',
      'tagline',
      '`meta: [',
      '`art: ',
      '`toc: ',
      '`# slide cover dark`',
    ])
      expect(sheet, field).toContain(field);
  });

  it('follows BUDGETS when a budget changes', () => {
    const changed = {
      ...BUDGETS,
      chain: { ...BUDGETS.chain, label: 12 },
    } as unknown as typeof BUDGETS;
    expect(renderCheatsheet(changed)).toContain('label ≤12');
  });

  it('lists every block of docs/spec/components.md', () => {
    const spec = readFileSync(
      fileURLToPath(new URL('../../../docs/spec/components.md', import.meta.url)),
      'utf8',
    );
    const names = [...spec.matchAll(/^\| \d+ \| \*\*([a-z]+)\*\*/gm)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThanOrEqual(21);
    for (const name of names) expect(sheet).toContain(`### ${name} `);
  });

  it('matches the checked-in prompts/01 file (run the package build after changing BUDGETS)', () => {
    const file = readFileSync(`${defaultPromptDir()}/${PROMPT_FILES.cheatsheet}`, 'utf8');
    expect(file).toBe(sheet);
  });
});
