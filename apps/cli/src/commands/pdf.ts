/**
 * `marco pdf <file.marco.md | deck.html>`: build when given a source, open the deck in
 * Playwright's Chromium over file://, wait for `html[data-marco="ready"]`, switch the runtime into
 * its print mode (`MARCO.print(mode)` with `window.print` stubbed; runtime.md §5 and §7) and save
 * `page.pdf()`. Lecture: one 1920×1080 px page per slide. Handout: A4 portrait pages built by the
 * runtime (`#handout`: slide thumbnail + full note per page, then the terms list).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Edition, FontMode, ThemeId } from '@marco/compiler';
import { type CliIo, displayPath, formatBytes, paint } from '../output.js';
import { defaultOutFile, runBuild } from './build.js';

export type PdfMode = 'lecture' | 'handout';
export const PDF_MODES: readonly PdfMode[] = ['lecture', 'handout'];

export interface PdfOptions {
  mode?: PdfMode;
  /** PDF path (default: next to the input, `<name>.pdf` / `<name>.handout.pdf`). */
  out?: string;
  /** Build options, used only when the input is a `.marco.md` source. */
  edition?: Edition;
  theme?: ThemeId;
  fonts?: FontMode;
  keepPng?: boolean;
  /** How long to wait for the runtime (ms, default 60 000). */
  timeoutMs?: number;
}

/** The subset of Playwright's API used here (Playwright is loaded lazily, types stay local). */
interface PwPage {
  goto(url: string, opts?: { waitUntil?: 'load'; timeout?: number }): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  evaluate<R>(fn: string): Promise<R>;
  pdf(opts: Record<string, unknown>): Promise<Buffer>;
  on(event: 'pageerror', cb: (e: Error) => void): void;
}
interface PwBrowser {
  newPage(opts?: Record<string, unknown>): Promise<PwPage>;
  close(): Promise<void>;
}
interface PwChromium {
  launch(opts?: Record<string, unknown>): Promise<PwBrowser>;
}

/** Playwright's Chromium launcher from `@playwright/test`, `playwright` or `playwright-core`. */
export async function loadChromium(): Promise<PwChromium | undefined> {
  for (const spec of ['@playwright/test', 'playwright', 'playwright-core']) {
    try {
      const mod = (await import(spec)) as { chromium?: PwChromium };
      if (mod.chromium) return mod.chromium;
    } catch {
      /* try the next package */
    }
  }
  return undefined;
}

/** Number of pages in a PDF (`/Type /Page` objects; `/Count` of the page tree as a fallback). */
export function countPdfPages(pdf: Uint8Array): number {
  const text = Buffer.from(pdf).toString('latin1');
  const pages = text.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
  if (pages) return pages;
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  return counts.length ? Math.max(...counts) : 0;
}

/** `lecture.html` → `lecture.pdf`; handout → `lecture.handout.pdf`. */
export function defaultPdfFile(htmlOrSource: string, mode: PdfMode): string {
  const name = basename(htmlOrSource)
    .replace(/(\.marco)?\.md$/i, '')
    .replace(/\.html?$/i, '');
  return join(
    dirname(htmlOrSource),
    `${name || 'lecture'}${mode === 'handout' ? '.handout' : ''}.pdf`,
  );
}

const MISSING_BROWSER =
  'PDF를 만들려면 Playwright의 Chromium이 필요합니다. `pnpm exec playwright install chromium`으로 설치하거나, 이미 설치했다면 PLAYWRIGHT_BROWSERS_PATH가 그 폴더를 가리키는지 확인하세요.';

export async function runPdf(file: string, opts: PdfOptions, io: CliIo): Promise<number> {
  const mode: PdfMode = opts.mode ?? 'lecture';
  const input = resolve(io.cwd, file);
  if (!existsSync(input)) {
    io.err(`${paint(io, 'red', '오류')} 파일이 없습니다: ${file}`);
    return 1;
  }
  const isHtml = /^\.html?$/i.test(extname(input));
  let html = input;
  if (!isHtml) {
    const built = await runBuild(
      file,
      {
        ...(opts.edition ? { edition: opts.edition } : {}),
        ...(opts.theme ? { theme: opts.theme } : {}),
        ...(opts.fonts ? { fonts: opts.fonts } : {}),
        ...(opts.keepPng ? { keepPng: true } : {}),
      },
      io,
    );
    if (built.code || !built.result?.outFile) return built.code || 1;
    html = built.result.outFile ?? defaultOutFile(input);
  }
  const out = opts.out ? resolve(io.cwd, opts.out) : defaultPdfFile(input, mode);

  const chromium = await loadChromium();
  if (!chromium) {
    io.err(`${paint(io, 'red', '오류')} Playwright를 찾을 수 없습니다. ${MISSING_BROWSER}`);
    return 1;
  }
  let browser: PwBrowser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    const cause = ((e as Error).message ?? '').split('\n').find((l) => l.trim()) ?? '';
    io.err(`${paint(io, 'red', '오류')} Chromium을 실행할 수 없습니다. ${MISSING_BROWSER}`);
    if (cause) io.err(paint(io, 'dim', `  원인: ${cause.trim()}`));
    return 1;
  }
  const timeout = opts.timeoutMs ?? 60_000;
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load', timeout });
    try {
      await page.waitForFunction(
        `document.documentElement.getAttribute('data-marco') === 'ready' && typeof window.MARCO?.print === 'function'`,
        undefined,
        { timeout },
      );
    } catch {
      io.err(
        `${paint(io, 'red', '오류')} 덱의 런타임이 준비되지 않았습니다 (html[data-marco="ready"]). MARCO로 빌드한 HTML인지 확인하고 다시 빌드하세요: ${displayPath(io, html)}`,
      );
      for (const m of pageErrors.slice(0, 3)) io.err(paint(io, 'dim', `  페이지 오류: ${m}`));
      return 1;
    }
    // Print mode without the print dialog; the runtime keeps the mode until `afterprint`.
    await page.evaluate(
      `(() => { window.print = () => {}; window.MARCO.print(${JSON.stringify(mode)}); })()`,
    );
    const ready =
      mode === 'handout'
        ? `document.body.classList.contains('handout-mode') && document.querySelector('#handout .ho-page') !== null`
        : `document.body.classList.contains('print-lecture')`;
    await page.waitForFunction(
      `${ready} && Array.from(document.images).every((i) => i.complete)`,
      undefined,
      { timeout },
    );
    await page.evaluate('document.fonts.ready.then(() => true)');
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      ...(mode === 'lecture' ? { width: '1920px', height: '1080px' } : { format: 'A4' }),
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, pdf);
    const pages = countPdfPages(pdf);
    io.out(
      `${paint(io, 'green', '✓')} ${paint(io, 'bold', displayPath(io, out))} · ${pages}쪽 · ${
        mode === 'lecture' ? '강의용 1920×1080' : '유인물 A4'
      } · ${formatBytes(pdf.length)}`,
    );
    return 0;
  } catch (e) {
    io.err(`${paint(io, 'red', '오류')} PDF 만들기 실패: ${(e as Error).message.split('\n')[0]}`);
    return 1;
  } finally {
    await browser.close();
  }
}
