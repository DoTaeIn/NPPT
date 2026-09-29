/**
 * `marco_preview`: screenshot one slide of a built deck in headless Chromium. Playwright is not a
 * dependency of this package; it is loaded lazily from wherever it resolves (the monorepo's dev
 * dependencies, or a project that installed `playwright`). Every request other than file:, data:,
 * blob: and about: is aborted, so the preview makes no network calls.
 */
import { pathToFileURL } from 'node:url';

interface PwRoute {
  request(): { url(): string };
  continue(): Promise<void>;
  abort(): Promise<void>;
}
interface PwPage {
  goto(url: string, opts?: { waitUntil?: 'load'; timeout?: number }): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  evaluate<R>(fn: string): Promise<R>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts: { type: 'png'; fullPage?: boolean }): Promise<Buffer>;
  on(event: 'pageerror', cb: (e: Error) => void): void;
}
interface PwContext {
  route(url: string, handler: (route: PwRoute) => Promise<void>): Promise<void>;
  newPage(): Promise<PwPage>;
}
interface PwBrowser {
  newContext(opts?: Record<string, unknown>): Promise<PwContext>;
  close(): Promise<void>;
}
interface PwChromium {
  launch(opts?: Record<string, unknown>): Promise<PwBrowser>;
}

/** Playwright's Chromium from `@playwright/test`, `playwright` or `playwright-core`. */
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

export const PREVIEW_UNAVAILABLE =
  'marco_preview needs Playwright and its Chromium, which this installation cannot load. Install them where the server can resolve them (e.g. `npm i -D playwright && npx playwright install chromium` in the folder the server runs from), or skip the preview: marco_build and marco_lint work without a browser.';

export interface PreviewResult {
  png: Buffer;
  /** 1-based slide shown. */
  slide: number;
  slides: number;
  slideId: string;
  pageErrors: string[];
}

const LOCAL_URL = /^(file|data|blob|about):/i;

/** Open `htmlFile`, go to slide `slide` (1-based) and return a 1920×1080 PNG. */
export async function screenshotSlide(
  htmlFile: string,
  slide: number,
  opts: { timeoutMs?: number } = {},
): Promise<PreviewResult> {
  const chromium = await loadChromium();
  if (!chromium) throw new Error(PREVIEW_UNAVAILABLE);
  let browser: PwBrowser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    const cause = ((e as Error).message ?? '').split('\n').find((l) => l.trim()) ?? '';
    throw new Error(`${PREVIEW_UNAVAILABLE}${cause ? ` (Chromium: ${cause.trim()})` : ''}`, {
      cause: e,
    });
  }
  const timeout = opts.timeoutMs ?? 30_000;
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      offline: true,
    });
    await context.route('**/*', (route) =>
      LOCAL_URL.test(route.request().url()) ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load', timeout });
    try {
      await page.waitForFunction(
        `document.documentElement.getAttribute('data-marco') === 'ready' && typeof window.MARCO?.go === 'function'`,
        undefined,
        { timeout },
      );
    } catch {
      throw new Error(
        `The deck's runtime did not start (html[data-marco="ready"] never appeared). Is this a MARCO-built HTML file? Rebuild it with marco_build.${pageErrors.length ? ` Page errors: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`,
      );
    }
    const info = await page.evaluate<{ n: number; id: string }>(
      `(() => { const M = window.MARCO; const n = M.slides.length; if (${slide} <= n) M.go(${slide - 1}); return { n, id: M.slides[M.cur]?.id ?? '' }; })()`,
    );
    if (slide > info.n) {
      throw new Error(`slide ${slide} does not exist: the deck has ${info.n} slides.`);
    }
    // Hide the presenter's nav dock (it overlays the slide) and let fonts and transitions settle.
    await page.evaluate(
      `(() => { const s = document.createElement('style'); s.textContent = '#nav-dock{display:none!important}'; document.head.appendChild(s); return document.fonts ? document.fonts.ready.then(() => true) : true; })()`,
    );
    await page.waitForTimeout(600);
    const png = await page.screenshot({ type: 'png' });
    return { png, slide, slides: info.n, slideId: info.id, pageErrors };
  } finally {
    await browser.close();
  }
}
