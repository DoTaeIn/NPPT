import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkSource, compile, parseMarco } from '../src/index.js';

const tmp = mkdtempSync(join(tmpdir(), 'marco-sidecar-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const QUIZ = [
  {
    id: 'Q01',
    area: 1,
    areaName: '출입통제',
    q: '인증과 인가의 차이는?',
    opts: ['같다', '다르다'],
    ans: 1,
  },
];
const SIMS = { _base: { W: 1872, H: 1012, nodes: [{ id: 'webx' }] } };

const deck = (fm: string) => `---\ntitle: 사이드카\n${fm}\n---\n# slide\ntitle: A\n`;

describe('front-matter sidecars (sims: sims.json)', () => {
  const dir = join(tmp, 'deck');
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'sims.json'), `${JSON.stringify(SIMS, null, 2)}\n`);
  writeFileSync(join(dir, 'data', 'terminals.json'), '{"t1": {"prompt": "$ "}}');
  writeFileSync(join(dir, 'quiz.json'), JSON.stringify(QUIZ));

  it('the parser records paths and reads no files', () => {
    const r = parseMarco(deck('sims: sims.json\nterminals: data/terminals.json\nquiz: quiz.json'));
    expect(r.diagnostics).toEqual([]);
    expect(r.sidecars).toEqual([
      { key: 'quiz', path: 'quiz.json', line: 5 },
      { key: 'sims', path: 'sims.json', line: 3 },
      { key: 'terminals', path: 'data/terminals.json', line: 4 },
    ]);
    expect(r.lecture.sims).toBeUndefined();
  });

  it('checkSource loads them relative to baseDir', () => {
    const r = checkSource(
      deck('sims: sims.json\nterminals: data/terminals.json\nquiz: quiz.json'),
      {
        file: 'x.marco.md',
        baseDir: dir,
      },
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.lecture.sims).toEqual(SIMS);
    expect(r.lecture.terminals).toEqual({ t1: { prompt: '$ ' } });
    expect(r.lecture.quiz).toEqual(QUIZ);
    expect(r.inputs).toEqual([
      join(dir, 'quiz.json'),
      join(dir, 'sims.json'),
      join(dir, 'data', 'terminals.json'),
    ]);
  });

  it('inline values keep working', () => {
    const r = checkSource(
      deck(
        'sims:\n  a: { x: 1 }\nterminals: {}\nquiz:\n  - { id: Q01, q: 질문, opts: [가, 나], ans: 0 }',
      ),
      { baseDir: dir },
    );
    expect(r.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(r.lecture.sims).toEqual({ a: { x: 1 } });
    expect(r.lecture.terminals).toEqual({});
    expect(r.lecture.quiz).toHaveLength(1);
    expect(r.inputs).toEqual([]);
  });

  it('missing, invalid and wrongly shaped files are errors at the key line', () => {
    writeFileSync(join(dir, 'broken.json'), '{ "a": ');
    writeFileSync(join(dir, 'list.json'), '[1, 2]');
    const r = checkSource(deck('sims: nope.json\nterminals: broken.json\nquiz: sims.json'), {
      file: 'deck.marco.md',
      baseDir: dir,
    });
    expect(r.diagnostics.map((d) => `${d.code}@${d.line}`)).toEqual([
      'format.sidecar.shape@5',
      'format.sidecar.missing@3',
      'format.sidecar.json@4',
    ]);
    expect(r.diagnostics.every((d) => d.level === 'error' && d.file === 'deck.marco.md')).toBe(
      true,
    );
    expect(r.diagnostics[1]?.message).toContain('nope.json');
    const shape = checkSource(deck('sims: list.json'), { baseDir: dir });
    expect(shape.diagnostics.map((d) => d.code)).toEqual(['format.sidecar.shape']);
    const wrong = parseMarco(deck('sims: 3\nquiz: { a: 1 }'));
    expect(wrong.diagnostics.map((d) => d.code)).toEqual([
      'format.frontmatter.quiz',
      'format.frontmatter.sims',
    ]);
  });

  it('compile embeds the loaded data in #lecture-data and stops on a missing file', async () => {
    const source = join(dir, 'lecture.marco.md');
    writeFileSync(source, deck('sims: sims.json\nquiz: quiz.json'));
    const ok = await compile(source, { fonts: 'none', useSharp: false });
    expect(ok.ok).toBe(true);
    expect(ok.inputs).toEqual([join(dir, 'quiz.json'), join(dir, 'sims.json')]);
    const data = JSON.parse(
      /<script id="lecture-data" type="application\/json">(.*?)<\/script>/s.exec(ok.html)?.[1] ??
        '{}',
    ) as { sims?: unknown; quiz?: unknown };
    expect(data.sims).toEqual(SIMS);
    expect(data.quiz).toEqual(QUIZ);

    writeFileSync(source, deck('terminals: gone.json'));
    const bad = await compile(source, { fonts: 'none', useSharp: false });
    expect(bad.ok).toBe(false);
    expect(bad.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'format.sidecar.missing', line: 3 }),
    );
  });
});
