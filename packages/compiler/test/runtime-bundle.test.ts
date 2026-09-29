import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  compile,
  readRuntime,
  runtimeBundlePath,
  runtimeDistDir,
  usesWidgets,
} from '../src/index.js';

const tmp = mkdtempSync(join(tmpdir(), 'marco-runtime-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const FM = '---\ntitle: 런타임 선택\n---\n';
const WIDGET_DECK = `${FM}# slide\ntitle: 퀴즈\n\n:::widget quiz mode=cards area=1 shuffle\n:::\n`;
const HTML_WIDGET_DECK = `${FM}# slide\ntitle: HTML 위젯\n\n:::html\n<div data-widget="quiz" data-params='{"mode":"exam"}'></div>\n:::\n`;
const PLAIN_DECK = `${FM}# slide\ntitle: 위젯 없음\n\n본문과 \`<div data-widget="x">\` 코드 조각.\n\n\`\`\`html\n<div data-widget="quiz"></div>\n\`\`\`\n`;

function deck(name: string, text: string): string {
  const file = join(tmp, `${name}.marco.md`);
  writeFileSync(file, text);
  return file;
}

/** A runtime dist with marker bundles, named by its manifest. */
function fakeRuntime(name: string, files: { core?: boolean; all?: boolean }): string {
  const dir = join(tmp, name);
  mkdirSync(join(dir, 'plugins'), { recursive: true });
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      version: '9.9.9',
      core: 'core.js',
      all: 'core-plus-plugins.js',
      plugins: { quiz: 'plugins/quiz.js' },
    }),
  );
  if (files.core) writeFileSync(join(dir, 'core.js'), '/*FAKE CORE*/');
  if (files.all) writeFileSync(join(dir, 'core-plus-plugins.js'), '/*FAKE ALL*/');
  writeFileSync(join(dir, 'plugins', 'quiz.js'), '/*FAKE QUIZ*/');
  return dir;
}

describe('usesWidgets', () => {
  it('finds [data-widget] elements, not text that mentions them', () => {
    expect(
      usesWidgets('<div class="widget" id="s-01-b1" data-block="widget" data-widget="quiz"></div>'),
    ).toBe(true);
    expect(usesWidgets(`<section><div data-widget='abac'>`)).toBe(true);
    expect(usesWidgets('<span data-widget>')).toBe(true);
    expect(usesWidgets('<p>&lt;div data-widget="x"&gt;</p><code>data-widget</code>')).toBe(false);
    expect(usesWidgets('<div data-widgets="x" title="a data-widget">')).toBe(false);
  });
});

describe('runtime bundle choice (runtime.md §7)', () => {
  const both = fakeRuntime('both', { core: true, all: true });

  it('a deck with a :::widget quiz block embeds the all bundle', async () => {
    const r = await compile(deck('widget', WIDGET_DECK), { fonts: 'none', runtimeDir: both });
    expect(r.ok).toBe(true);
    expect(r.stats.runtime).toBe('all');
    expect(r.html).toContain('<script>\n/*FAKE ALL*/\n</script>');
    expect(r.html).not.toContain('FAKE CORE');
    expect(r.warnings.filter((w) => w.code === 'build.runtime.missing')).toEqual([]);
  });

  it('widgets written as author HTML count too', async () => {
    const r = await compile(deck('html-widget', HTML_WIDGET_DECK), {
      fonts: 'none',
      runtimeDir: both,
    });
    expect(r.stats.runtime).toBe('all');
    expect(r.html).toContain('/*FAKE ALL*/');
  });

  it('a deck without widgets embeds only the core', async () => {
    const r = await compile(deck('plain', PLAIN_DECK), { fonts: 'none', runtimeDir: both });
    expect(r.ok).toBe(true);
    expect(r.stats.runtime).toBe('core');
    expect(r.html).toContain('<script>\n/*FAKE CORE*/\n</script>');
    expect(r.html).not.toContain('FAKE ALL');
    expect(r.html).not.toContain('FAKE QUIZ');
  });

  it('falls back to the core with a warning when the all bundle is not built', async () => {
    const coreOnly = fakeRuntime('core-only', { core: true });
    const r = await compile(deck('widget2', WIDGET_DECK), { fonts: 'none', runtimeDir: coreOnly });
    expect(r.ok).toBe(true);
    expect(r.stats.runtime).toBe('core');
    expect(r.html).toContain('/*FAKE CORE*/');
    expect(r.warnings).toContainEqual(
      expect.objectContaining({
        code: 'build.runtime.missing',
        message: expect.stringContaining('dist/core-plus-plugins.js'),
      }),
    );
  });

  it('the placeholder names the bundle that was wanted', async () => {
    const none = fakeRuntime('none', {});
    const r = await compile(deck('widget3', WIDGET_DECK), { fonts: 'none', runtimeDir: none });
    expect(r.html).toContain(
      '/* MARCO PLACEHOLDER: @marco/runtime dist/core-plus-plugins.js was not found.',
    );
    expect(r.warnings.map((w) => w.code)).toContain('build.runtime.missing');
    expect(readRuntime(undefined, 'core', join(tmp, 'nowhere')).js).toContain(
      'dist/marco-runtime.js was not found',
    );
    expect(readRuntime(undefined, 'all', join(tmp, 'nowhere')).js).toContain(
      'dist/marco-runtime.all.js was not found',
    );
  });
});

const REAL_DIR = runtimeDistDir();
const REAL_ALL = runtimeBundlePath('all');
describe.runIf(REAL_DIR !== undefined && REAL_ALL !== undefined && existsSync(REAL_ALL))(
  'with the built @marco/runtime',
  () => {
    it('inlines marco-runtime.all.js for widgets and marco-runtime.js otherwise', async () => {
      const all = readFileSync(REAL_ALL ?? '', 'utf8');
      const core = readFileSync(runtimeBundlePath('core') ?? '', 'utf8');
      expect(REAL_ALL).toMatch(/marco-runtime\.all\.js$/);
      const withWidget = await compile(deck('real-widget', WIDGET_DECK), { fonts: 'none' });
      expect(withWidget.html).toContain(all);
      expect(withWidget.html).not.toContain(core);
      const plain = await compile(deck('real-plain', PLAIN_DECK), { fonts: 'none' });
      expect(plain.html).toContain(core);
      expect(plain.html).not.toContain(all);
    });
  },
);
