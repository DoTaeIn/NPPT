import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ATTRIBUTION,
  compile,
  ENGINE_VERSION,
  scriptJson,
  type CompileResult,
} from '../src/index.js';

const SAMPLE = fileURLToPath(new URL('./fixtures/sample.marco.md', import.meta.url));
const PKG_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
const tmp = mkdtempSync(join(tmpdir(), 'marco-compile-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const lectureData = (html: string): Record<string, unknown> => {
  const m = /<script id="lecture-data" type="application\/json">(.*?)<\/script>/s.exec(html);
  if (!m?.[1]) throw new Error('no #lecture-data');
  return JSON.parse(m[1]) as Record<string, unknown>;
};
/** The slide markup between #canvas and the data script (author content lives here). */
const canvas = (html: string): string =>
  html.slice(html.indexOf('<div id="canvas">'), html.indexOf('<script id="lecture-data"'));

let instructor: CompileResult;
let student: CompileResult;

describe('compile(sample.marco.md)', () => {
  it('builds the instructor edition', async () => {
    instructor = await compile(SAMPLE, { outFile: join(tmp, 'sample.html') });
    expect(instructor.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(instructor.ok).toBe(true);
    expect(readFileSync(join(tmp, 'sample.html'), 'utf8')).toBe(instructor.html);
    expect(instructor.stats.bytes).toBe(Buffer.byteLength(instructor.html));
  });

  it('emits the document head with the NOTICE and the exact Attribution line', () => {
    const html = instructor.html;
    expect(
      html.startsWith(
        '<!doctype html>\n<html lang="ko" data-theme="v20-violet" data-edition="instructor">\n<head>',
      ),
    ).toBe(true);
    expect(html).toContain('<title>3주차 · 물리보안·출입통제 IAM</title>');
    expect(html).toContain(
      `  Built with MARCO Engine v${PKG_VERSION} (https://github.com/DoTaeIn/NPPT)\n`,
    );
    expect(html).toContain(
      '\n  Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco\n',
    );
    expect(ATTRIBUTION).toBe(
      'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco',
    );
    expect(html).toContain(
      '<div id="stage"><div id="canvas">\n<section class="slide cover" id="s-01"',
    );
    expect(ENGINE_VERSION).toBe(PKG_VERSION);
  });

  it('renders one section per slide in order', () => {
    const sections = [
      ...instructor.html.matchAll(/<section class="slide[^"]*" id="([^"]+)" data-type="([^"]+)"/g),
    ].map((m) => `${m[1]}:${m[2]}`);
    expect(sections).toEqual([
      's-01:cover',
      's-02:hero',
      'principle-chain:content',
      's-04:divider',
      's-05:content',
      's-06:content',
      's-07:content',
      's-08:content',
      's-09:content',
      's-10:quote',
      's-11:references',
      's-12:raw',
    ]);
    expect(instructor.stats.slides).toBe(12);
  });

  it('uses every block type', () => {
    const types = new Set([...instructor.html.matchAll(/data-block="([a-z]+)"/g)].map((m) => m[1]));
    expect([...types].sort()).toEqual(
      [
        'bullets',
        'callout',
        'cards',
        'chain',
        'code',
        'columns',
        'compare',
        'image',
        'paragraph',
        'pills',
        'quote',
        'steps',
        'table',
        'takeaway',
        'terms',
        'tiles',
        'timeline',
        'verdict',
        'video',
        'widget',
      ].sort(),
    );
    expect(instructor.html).toContain('<div class="custom-note">직접 쓴 HTML 조각</div>'); // html block (no wrapper)
  });

  it('embeds #lecture-data with the runtime.md §1 shape', () => {
    const data = lectureData(instructor.html);
    expect(Object.keys(data)).toEqual([
      'ir',
      'engine',
      'meta',
      'refs',
      'videos',
      'assets',
      'slideRefs',
      'terms',
      'notes',
    ]);
    expect(data.ir).toBe('0.1');
    expect(data.engine).toEqual({ name: 'MARCO Engine', version: PKG_VERSION });
    expect(data.meta).toMatchObject({
      title: '3주차 · 물리보안·출입통제 IAM',
      edition: 'instructor',
      footer: '보안시스템 운영 및 활용 · 3주차',
      duration: 20,
    });
    expect((data.refs as { id: string }[]).map((r) => r.id)).toEqual(['S13', 'S14', 'L01']);
    expect(data.videos).toEqual([
      { id: 'dQw4w9WgXcQ', title: '문틈·손잡이 우회 시연', start: 441, credit: 'DEF CON 33' },
    ]);
    // Asset metadata only: no path, no bytes.
    expect(data.assets).toEqual({
      diagram: { title: '3선 방어 개념도', credit: 'MARCO 예제', alt: '외곽·로비·핵심구역 개념도' },
    });
    expect(data.slideRefs).toEqual({ 'principle-chain': ['S13'], 's-05': ['S13', 'S14'] });
    expect(data.terms).toMatchObject({
      IAM: expect.any(String),
      MFA: expect.any(String),
      LPR: 'License Plate Recognition 차량번호 인식',
    });
    const notes = data.notes as Record<string, { cues: { k: string; id: string }[]; raw?: string }>;
    expect(Object.keys(notes)).toEqual(['s-01', 's-02', 'principle-chain']);
    expect(notes['s-02']?.cues.map((c) => `${c.k}:${c.id}`)).toEqual([
      'SAY:p02-c000',
      'ASK:p02-c001',
      'LOOK:p02-c002',
    ]);
    expect(notes['s-01']).not.toHaveProperty('raw');
  });

  it('inlines the PNG asset with its intrinsic size', () => {
    expect(instructor.html).toMatch(
      /<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="외곽·로비·핵심구역 개념도" width="160" height="90">/,
    );
    expect(instructor.lecture.assets.diagram).toMatchObject({ width: 160, height: 90 });
  });

  it('never leaks raw <script from content', () => {
    const slides = canvas(instructor.html);
    expect(slides).not.toMatch(/<script/i);
    expect(slides).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(instructor.html.split('<script id="lecture-data"')).toHaveLength(2);
  });

  it('reports the unknown icon as a warning and lint issues from @marco/schema', () => {
    expect(instructor.warnings).toContainEqual(
      expect.objectContaining({ code: 'icon.unknown', slide: 's-09' }),
    );
    const allowed = new Set([
      'icon.unknown',
      'font.fallback',
      'build.css.missing',
      'build.runtime.missing',
    ]);
    expect(instructor.warnings.filter((w) => !allowed.has(w.code))).toEqual([]);
    // `budget.slide.*` (layout estimates) is tuned in @marco/schema; the text budgets are fixed.
    const budget = instructor.lint.filter(
      (l) => l.code.startsWith('budget.') && !l.code.startsWith('budget.slide.'),
    );
    expect(budget).toEqual([
      expect.objectContaining({
        level: 'warn',
        code: 'budget.cards.body',
        slide: 'principle-chain',
      }),
    ]);
    expect(instructor.lint.filter((l) => l.level === 'error')).toEqual([]);
    expect(instructor.slideLines['principle-chain']).toBe(55);
  });

  it('is deterministic', async () => {
    // Snapshot the sibling dists so a concurrent rebuild cannot change the inputs mid-test.
    const pinned: { designSystemDir?: string; runtimePath?: string } = {};
    const cssDir = fileURLToPath(new URL('../../design-system/dist', import.meta.url));
    const runtime = fileURLToPath(new URL('../../runtime/dist/marco-runtime.js', import.meta.url));
    if (existsSync(cssDir)) {
      cpSync(cssDir, join(tmp, 'ds'), { recursive: true });
      pinned.designSystemDir = join(tmp, 'ds');
    }
    if (existsSync(runtime)) {
      cpSync(runtime, join(tmp, 'runtime.js'));
      pinned.runtimePath = join(tmp, 'runtime.js');
    }
    const a = await compile(SAMPLE, pinned);
    const b = await compile(SAMPLE, pinned);
    expect(b.html).toBe(a.html);
  });

  it('student edition omits notes', async () => {
    student = await compile(SAMPLE, { edition: 'student', fonts: 'none' });
    expect(student.ok).toBe(true);
    expect(student.html).toContain(
      '<html lang="ko" data-theme="v20-violet" data-edition="student">',
    );
    const data = lectureData(student.html);
    expect(data).not.toHaveProperty('notes');
    expect(Object.keys(data)).toEqual([
      'ir',
      'engine',
      'meta',
      'refs',
      'videos',
      'assets',
      'slideRefs',
      'terms',
    ]);
    expect(student.html).not.toContain('카드는 정상인데 교육이 만료되었다면');
  });

  it('theme override and fonts=none', async () => {
    const r = await compile(SAMPLE, { theme: 'cau-navy', fonts: 'none' });
    expect(r.html).toContain('data-theme="cau-navy"');
    expect(['none', 'embed']).toContain(r.stats.fonts);
  });
});

describe('compile errors', () => {
  it('stops before emit on parse errors and returns diagnostics', async () => {
    const file = join(tmp, 'broken.marco.md');
    writeFileSync(
      file,
      '---\ntitle: 깨진 덱\n---\n# slide\ntitle: A\n\n:::cardz\n- title: x\n:::\n',
    );
    const r = await compile(file, { outFile: join(tmp, 'broken.html') });
    expect(r.ok).toBe(false);
    expect(r.html).toBe('');
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ code: 'format.container.unknown', line: 7, file }),
    ]);
    expect(() => readFileSync(join(tmp, 'broken.html'))).toThrow();
  });

  it('missing image files are warnings, not errors', async () => {
    const file = join(tmp, 'noimg.marco.md');
    writeFileSync(
      file,
      '---\ntitle: 이미지 없음\n---\n# slide\ntitle: A\n\n![없는 그림](assets/missing.png)\n',
    );
    const r = await compile(file, { fonts: 'none' });
    expect(r.ok).toBe(true);
    expect(r.warnings).toContainEqual(expect.objectContaining({ code: 'asset.missing' }));
    expect(r.html).toContain('<img alt="없는 그림">');
  });

  it('uses placeholders when the runtime or CSS dist is missing', async () => {
    const file = join(tmp, 'min.marco.md');
    writeFileSync(file, '---\ntitle: 최소\n---\n# slide\ntitle: A\n');
    const r = await compile(file, {
      runtimePath: join(tmp, 'nope.js'),
      designSystemDir: join(tmp, 'nope'),
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual([
      'build.runtime.missing',
      'font.fallback',
      'build.css.missing',
    ]);
    expect(r.html).toContain(
      '/* MARCO PLACEHOLDER: @marco/runtime dist/marco-runtime.js was not found.',
    );
    expect(r.html).toContain(
      '/* MARCO PLACEHOLDER: @marco/design-system dist/marco.css was not found.',
    );
  });
});

describe('scriptJson', () => {
  it('cannot close the data script', () => {
    const value = { t: '</script><script>alert(1)</script> <!-- \u2028' };
    const out = scriptJson(value);
    expect(out).not.toMatch(/<\/script|<!--|\u2028/i);
    expect(JSON.parse(out)).toEqual(value);
  });
});
