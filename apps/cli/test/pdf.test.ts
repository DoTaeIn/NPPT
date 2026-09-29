import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countPdfPages, defaultPdfFile, loadChromium, runCli } from '../src/index.js';
import { capture } from './helpers.js';

const FIXTURES = fileURLToPath(
  new URL('../../../packages/compiler/test/fixtures/', import.meta.url),
);
const MAIN = fileURLToPath(new URL('../dist/main.js', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'marco-pdf-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Chromium is usable when Playwright loads and its browser executable exists. */
async function chromiumAvailable(): Promise<boolean> {
  const chromium = (await loadChromium()) as { executablePath?: () => string } | undefined;
  try {
    const path = chromium?.executablePath?.();
    return path !== undefined && existsSync(path);
  } catch {
    return false;
  }
}
const hasChromium = await chromiumAvailable();

describe('PDF helpers', () => {
  it('countPdfPages counts page objects, not the page tree', () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj <</Type /Pages /Kids [2 0 R 3 0 R] /Count 2>> endobj\n' +
        '2 0 obj <</Type /Page /Parent 1 0 R>> endobj\n3 0 obj <</Type/Page/Parent 1 0 R>> endobj\n',
      'latin1',
    );
    expect(countPdfPages(pdf)).toBe(2);
    expect(countPdfPages(Buffer.from('<</Type /Pages /Count 7>>'))).toBe(7);
    expect(countPdfPages(Buffer.from('not a pdf'))).toBe(0);
  });

  it('defaultPdfFile sits next to the input', () => {
    expect(defaultPdfFile('/a/lecture.marco.md', 'lecture')).toBe('/a/lecture.pdf');
    expect(defaultPdfFile('/a/deck.html', 'handout')).toBe('/a/deck.handout.pdf');
  });
});

describe.runIf(hasChromium)('marco pdf (Playwright Chromium)', () => {
  const dir = join(root, 'sample');
  beforeAll(() => {
    cpSync(FIXTURES, dir, { recursive: true });
  });
  const slides = () =>
    (readFileSync(join(dir, 'sample.marco.md'), 'utf8').match(/^# slide/gm) ?? []).length;

  it('builds the source, then prints one 1920×1080 page per slide', async () => {
    const io = capture(dir);
    expect(await runCli(['pdf', 'sample.marco.md', '--fonts', 'none'], io)).toBe(0);
    expect(existsSync(join(dir, 'sample.html'))).toBe(true);
    const pdf = readFileSync(join(dir, 'sample.pdf'));
    expect(countPdfPages(pdf)).toBe(slides());
    const text = pdf.toString('latin1');
    expect(text.match(/\/MediaBox\s*\[0 0 1440 810\]/g)).toHaveLength(slides());
    expect(io.stdout.at(-1)).toMatch(
      new RegExp(`^✓ sample\\.pdf · ${slides()}쪽 · 강의용 1920×1080 · [\\d.]+ (KB|MB)$`),
    );
  }, 120_000);

  it('handout mode from built HTML: A4 pages with thumbnails and notes', async () => {
    const io = capture(dir);
    expect(await runCli(['pdf', 'sample.html', '--mode', 'handout', '-o', 'out/ho.pdf'], io)).toBe(
      0,
    );
    expect(io.stdout.at(-1)).toMatch(/^✓ out\/ho\.pdf · \d+쪽 · 유인물 A4 · /);
    const pdf = readFileSync(join(dir, 'out', 'ho.pdf'));
    const pages = countPdfPages(pdf);
    expect(pages).toBeGreaterThanOrEqual(slides());
    const boxes = new Set(pdf.toString('latin1').match(/\/MediaBox\s*\[[^\]]*\]/g));
    expect([...boxes]).toEqual([
      expect.stringMatching(/^\/MediaBox \[0 0 59[45](\.\d+)? 84[12](\.\d+)?\]$/),
    ]);
  }, 120_000);

  it('an HTML file without the MARCO runtime is a clear error', async () => {
    writeFileSync(join(dir, 'plain.html'), '<!doctype html><title>x</title><p>no runtime</p>');
    const io = capture(dir);
    expect(await runCli(['pdf', 'plain.html', '--timeout', '1'], io)).toBe(1);
    expect(io.stderr[0]).toContain('덱의 런타임이 준비되지 않았습니다 (html[data-marco="ready"])');
  }, 60_000);
});

describe.runIf(existsSync(MAIN))('marco pdf without a browser', () => {
  it('explains how to install Chromium, in Korean, and exits 1', () => {
    writeFileSync(join(root, 'x.html'), '<!doctype html><p>x</p>');
    let stderr = '';
    let status = 0;
    try {
      execFileSync(process.execPath, [MAIN, 'pdf', 'x.html'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1', PLAYWRIGHT_BROWSERS_PATH: join(root, 'no-browsers') },
      });
    } catch (e) {
      const err = e as { status: number; stderr: string };
      status = err.status;
      stderr = err.stderr;
    }
    expect(status).toBe(1);
    expect(stderr).toContain('오류 Chromium을 실행할 수 없습니다.');
    expect(stderr).toContain('pnpm exec playwright install chromium');
  }, 60_000);
});
