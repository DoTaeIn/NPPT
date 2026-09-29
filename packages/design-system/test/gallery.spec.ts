import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const galleryUrl = new URL('../gallery/index.html', import.meta.url).href;
const resultsDir = fileURLToPath(new URL('../test-results/', import.meta.url));
const THEMES = ['v20-violet', 'cau-navy'] as const;

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${galleryUrl}?${query}`);
  await page.evaluate(() => document.fonts.ready);
}

/** Layout problems per slide, in unscaled canvas px (the gallery runs at scale=1). */
function measure(): { slides: number; fontsLoaded: boolean; problems: string[] } {
  const problems: string[] = [];
  const slides = [...document.querySelectorAll<HTMLElement>('#canvas > section.slide')];
  for (const slide of slides) {
    const at = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = slide.getBoundingClientRect();
      return {
        top: r.top - s.top,
        bottom: r.bottom - s.top,
        left: r.left - s.left,
        right: r.right - s.left,
      };
    };
    if (slide.scrollWidth > 1920 || slide.scrollHeight > 1080) {
      problems.push(`${slide.id}: section ${slide.scrollWidth}×${slide.scrollHeight}`);
    }
    const wrapper = slide.querySelector<HTMLElement>(':scope > .slide-wrapper');
    if (!wrapper) continue;
    if (wrapper.scrollWidth > 1920 || wrapper.scrollHeight > 1080) {
      problems.push(`${slide.id}: .slide-wrapper ${wrapper.scrollWidth}×${wrapper.scrollHeight}`);
    }
    const style = getComputedStyle(wrapper);
    const limit = {
      top: parseFloat(style.paddingTop) - 0.5,
      bottom: 1080 - parseFloat(style.paddingBottom) + 0.5,
      left: 0,
      right: 1920,
    };
    const body = wrapper.querySelector<HTMLElement>(':scope > .s-body');
    if (body) {
      const b = at(body);
      limit.left = b.left - 0.5;
      limit.right = b.right + 0.5;
      if (body.scrollHeight > body.clientHeight + 1) {
        problems.push(
          `${slide.id}: .s-body content ${body.scrollHeight}px > ${body.clientHeight}px`,
        );
      }
    }
    // Everything in the wrapper, and every block, must sit inside the padded content box.
    const targets = [...wrapper.children, ...slide.querySelectorAll('[data-block]')];
    for (const el of targets) {
      const box = at(el);
      const name = el.id || `.${[...el.classList].join('.')}`;
      if (box.bottom > limit.bottom || box.top < limit.top) {
        problems.push(
          `${slide.id}: ${name} spans y ${box.top.toFixed(0)}–${box.bottom.toFixed(0)}, limit ${limit.top.toFixed(0)}–${limit.bottom.toFixed(0)}`,
        );
      }
      if (el.hasAttribute('data-block') && (box.right > limit.right || box.left < limit.left)) {
        problems.push(
          `${slide.id}: ${name} spans x ${box.left.toFixed(0)}–${box.right.toFixed(0)}, limit ${limit.left.toFixed(0)}–${limit.right.toFixed(0)}`,
        );
      }
      const h = el as HTMLElement;
      if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).display !== 'inline') {
        problems.push(`${slide.id}: ${name} content ${h.scrollWidth}px wide in ${h.clientWidth}px`);
      }
    }
  }
  const fontsLoaded = [...document.fonts].some(
    (f) => f.family.replace(/"/g, '') === 'Pretendard' && f.status === 'loaded',
  );
  return { slides: slides.length, fontsLoaded, problems };
}

for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test('no slide content overflows its 1920×1080 box', async ({ page }) => {
      await open(page, `theme=${theme}&scale=1`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const report = await page.evaluate(measure);
      expect(report.fontsLoaded, 'Pretendard from dist/marco.css is in use').toBe(true);
      expect(report.slides).toBeGreaterThanOrEqual(25);
      expect(report.problems, report.problems.join('\n')).toEqual([]);
    });

    test('screenshots every slide', async ({ page }) => {
      await open(page, `theme=${theme}&scale=1`);
      await page.addStyleTag({ content: '.g-bar { display: none !important; }' });
      const slides = page.locator('#canvas > section.slide');
      const count = await slides.count();
      for (let i = 0; i < count; i++) {
        const slide = slides.nth(i);
        const id = await slide.getAttribute('id');
        await slide.screenshot({
          path: `${resultsDir}gallery/${theme}/${id}.png`,
          animations: 'disabled',
        });
      }
      expect(count).toBeGreaterThan(0);
    });
  });
}

/** Page count and page sizes of a Chromium PDF (uncompressed page dictionaries). */
function pdfPages(pdf: Buffer): { count: number; sizes: Set<string> } {
  const text = pdf.toString('latin1');
  const count = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  const sizes = new Set([...text.matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map((m) => m[1]!.trim()));
  return { count, sizes };
}

test.describe('print modes', () => {
  test('lecture: one 1920×1080 page per slide', async ({ page }) => {
    await open(page, 'mode=lecture&theme=cau-navy');
    await expect(page.locator('body')).toHaveClass(/print-lecture/);
    const slides = await page.locator('#canvas > section.slide').count();
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(`${resultsDir}lecture.pdf`, pdf);
    const { count, sizes } = pdfPages(pdf);
    expect(count).toBe(slides);
    expect([...sizes]).toEqual(['0 0 1440 810']); // 1920×1080 px in pt
  });

  test('handout: A4 pages with a scaled thumbnail and the notes per slide', async ({ page }) => {
    await open(page, 'mode=handout&theme=v20-violet');
    const slides = await page.locator('#canvas > section.slide').count();
    await expect(page.locator('#stage')).toBeHidden();
    await expect(page.locator('#handout .ho-page')).toHaveCount(slides);
    const layout = await page.evaluate(() => {
      const shot = document.querySelector('#handout .ho-shot')!.getBoundingClientRect();
      const thumb = document.querySelector('#handout .ho-shot > .slide')!.getBoundingClientRect();
      const note = getComputedStyle(document.querySelector('#handout .ho-note')!);
      return {
        shot: [shot.width, shot.height],
        thumb: [thumb.width, thumb.height],
        noteSize: parseFloat(note.fontSize),
      };
    });
    expect(layout.shot).toEqual([688, 387]);
    expect(Math.abs(layout.thumb[0]! - 688)).toBeLessThan(1);
    expect(Math.abs(layout.thumb[1]! - 387)).toBeLessThan(1);
    expect(layout.noteSize).toBeGreaterThanOrEqual((11 * 96) / 72 - 0.1); // 11pt
    await page
      .locator('#handout .ho-page')
      .nth(1)
      .screenshot({ path: `${resultsDir}handout-page-02.png` });

    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    writeFileSync(`${resultsDir}handout.pdf`, pdf);
    const { count, sizes } = pdfPages(pdf);
    expect(count).toBeGreaterThanOrEqual(slides + 1); // one page per slide, plus the terms page
    expect(sizes.size).toBe(1);
    const [w, h] = [...sizes][0]!.split(/\s+/).slice(2).map(Number);
    expect(Math.abs(w! - 595.3)).toBeLessThan(1.5); // A4 portrait in pt
    expect(Math.abs(h! - 841.9)).toBeLessThan(1.5);
  });
});
