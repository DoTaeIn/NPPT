import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ATTRIBUTION =
  'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco';
const deckUrl = (name: string): string =>
  pathToFileURL(join(import.meta.dirname, '..', 'fixtures', name)).href;

async function open(page: Page, name = 'minimal-deck.html'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(deckUrl(name));
  await page.waitForFunction(() => document.documentElement.dataset.marco === 'ready');
  return errors;
}

const cur = (page: Page): Promise<number> => page.evaluate(() => window.MARCO?.cur ?? -1);
const scale = (page: Page): Promise<string> =>
  page.locator('#canvas').evaluate((el) => (el as HTMLElement).style.transform);

test('first slide is active and the canvas is scaled to the viewport', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('section.slide.active')).toHaveCount(1);
  await expect(page.locator('#s-01')).toHaveClass(/\bactive\b/);
  await expect(page.locator('#s-01')).toBeVisible();
  await expect(page.locator('#s-02')).toBeHidden();
  await expect(page.locator('#s-01 > .slide-no')).toHaveText('01 / 05');
  expect(await scale(page)).toBe('scale(0.83333)');
  const box = await page.locator('#s-01').boundingBox();
  expect(box?.width).toBeCloseTo(1600, 0);
  expect(box?.height).toBeCloseTo(900, 0);
  expect(await page.evaluate(() => window.MARCO?.slides.length)).toBe(5);
  expect(errors).toEqual([]);
});

test('ArrowRight / ArrowLeft / Home / End navigate', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  expect(await cur(page)).toBe(1);
  await expect(page.locator('#s-02')).toBeVisible();
  await expect(page.locator('#s-01')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  expect(await cur(page)).toBe(0);
  await page.keyboard.press('End');
  expect(await cur(page)).toBe(4);
  await expect(page.locator('#s-05 > .slide-no')).toHaveText('05 / 05');
  await page.keyboard.press('Home');
  expect(await cur(page)).toBe(0);
  await expect(page.locator('#nav-count')).toHaveText('01 / 05');
});

test('M opens the TOC listing all titles grouped by data-group', async ({ page }) => {
  await open(page);
  await expect(page.locator('#toc-sidebar')).toBeHidden();
  await page.keyboard.press('m');
  await expect(page.locator('#toc-sidebar')).toBeVisible();
  await expect(page.locator('#toc-sidebar .toc-group-head')).toHaveText([
    '표지 · 도입',
    '1부 · 기본 원리',
    '2부 · 운영',
  ]);
  await expect(page.locator('#toc-sidebar .toc-title')).toHaveText([
    '물리보안 · 출입통제 IAM',
    '카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다',
    '사옥의 3선 방어 개념도',
    '인증과 하드웨어',
    '참고 자료 · 공식 문서와 미디어',
  ]);
  await expect(page.locator('#toc-sidebar .toc-group').nth(1).locator('.toc-item')).toHaveCount(2);
  await expect(page.locator('#toc-sidebar .toc-item.active .toc-num')).toHaveText('01');
  await page.locator('#toc-sidebar .toc-item[data-index="3"]').click();
  expect(await cur(page)).toBe(3);
  await expect(page.locator('#toc-sidebar .toc-item.active .toc-num')).toHaveText('04');
});

test('N opens the notes panel with cue text and Korean labels', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('n');
  const panel = page.locator('#notes-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.cue-k')).toHaveText([
    '화면',
    '대사',
    '주목',
    '발문',
    '예상질문',
    '예상답변',
    '전환',
  ]);
  await expect(panel).toContainText('이 네 단계 중 정책이 개입하는 단계는 어디일까요?');
  await expect(panel.locator('.notes-time')).toContainText('2.5분 · 01:00 – 03:30');
  await expect(panel.locator('[data-cue-id="p02-c001"]')).toBeVisible();
  // The notes panel narrows the canvas.
  expect(await scale(page)).not.toBe('scale(0.83333)');
  await page.keyboard.press('ArrowRight');
  await expect(panel).toContainText('검증 보충');
});

test('? opens help with the Attribution line and link', async ({ page }) => {
  await open(page);
  await page.keyboard.press('?');
  const help = page.locator('#help');
  await expect(help).toBeVisible();
  await expect(help.locator('.marco-attribution')).toHaveText(ATTRIBUTION);
  await expect(help.locator('.marco-attribution a')).toHaveAttribute(
    'href',
    'https://github.com/DoTaeIn/Marco',
  );
  await expect(help.locator('.marco-attribution')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});

test('/ search finds a slide by title and Enter jumps to it', async ({ page }) => {
  await open(page);
  await page.keyboard.press('/');
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.type('3선 방어');
  await expect(page.locator('#search .sr').first()).toContainText('사옥의 3선 방어 개념도');
  await page.keyboard.press('Enter');
  expect(await cur(page)).toBe(2);
  await expect(page.locator('#search')).toBeHidden();
});

test('clicking source-link opens the sources dialog with the ref titles', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  await page.locator('#s-02 .source-link').click();
  const dlg = page.locator('#dialog');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#dialog-title')).toHaveText('참고 출처');
  await expect(dlg.locator('.dlg-sources a')).toHaveText([
    'S04 · NIST PACS · PIV',
    'S13 · Axis Secure Entry',
  ]);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('clicking image-open opens the image popup', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.locator('#s-03 .image-open').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dialog-title')).toHaveText('사옥의 3선 방어 개념도');
  const img = page.locator('#dialog img.dlg-image');
  await expect(img).toBeVisible();
  expect(await img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  const box = await img.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(400);
});

test('video-open on file:// opens YouTube in a new window instead of embedding', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((url: string) => {
      (window as unknown as { __opened: string[] }).__opened.push(url);
      return null;
    }) as typeof window.open;
  });
  await page.evaluate(() => window.MARCO?.go(2));
  await page.locator('#s-03 .video-open').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dialog iframe')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(
    ['https://www.youtube.com/watch?v=tTAISQqmxWQ&t=441s'],
  );
});

test('P enables the pen and drawing leaves a stroke on the canvas', async ({ page }) => {
  await open(page);
  await page.keyboard.press('p');
  await expect(page.locator('body')).toHaveClass(/\bpen-on\b/);
  await expect(page.locator('#pen-toolbar')).toBeVisible();
  const blank = (): Promise<boolean> =>
    page.locator('#pen-canvas').evaluate((c) => {
      const cv = c as HTMLCanvasElement;
      const data = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    });
  expect(await blank()).toBe(true);
  await page.mouse.move(500, 300);
  await page.mouse.down();
  await page.mouse.move(600, 360, { steps: 6 });
  await page.mouse.move(700, 320, { steps: 6 });
  await page.mouse.up();
  expect(await blank()).toBe(false);
  // Ink is per slide: another slide starts blank, returning restores the stroke.
  await page.keyboard.press('ArrowRight');
  expect(await blank()).toBe(true);
  await page.keyboard.press('ArrowLeft');
  expect(await blank()).toBe(false);
});

test('Ctrl+Shift+P builds #handout (window.print intercepted)', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    (window as unknown as { __printed: string[] }).__printed = [];
    window.print = () => {
      (window as unknown as { __printed: string[] }).__printed.push(document.body.className);
    };
  });
  await page.keyboard.press('Control+Shift+P');
  await page.waitForFunction(
    () => (window as unknown as { __printed: string[] }).__printed.length === 1,
  );
  expect(
    await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed[0]),
  ).toContain('handout-mode');
  await expect(page.locator('#handout article.ho-page')).toHaveCount(5);
  await expect(page.locator('#handout section.ho-terms')).toHaveCount(1);
  await expect(page.locator('#handout .ho-shot')).toHaveCount(5);
  expect(await page.locator('#page-size').evaluate((e) => e.textContent)).toBe(
    '@media print{@page{size:A4 portrait;margin:0}}',
  );
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#handout')).toHaveCount(0);
});

test('lecture print produces one 1920×1080 page per slide', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.keyboard.press('Control+p');
  await expect(page.locator('body')).toHaveClass(/\bprint-lecture\b/);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const text = pdf.toString('latin1');
  expect(text.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(5);
  expect(text).toMatch(/\/MediaBox\s*\[0 0 1440 810\]/);
});

test('resizing the window changes the canvas scale', async ({ page }) => {
  await open(page);
  expect(await scale(page)).toBe('scale(0.83333)');
  await page.setViewportSize({ width: 960, height: 540 });
  await expect.poll(() => scale(page)).toBe('scale(0.5)');
  const box = await page.locator('#s-01').boundingBox();
  expect(box?.width).toBeCloseTo(960, 0);
});

test('student edition hides the notes button and disables N', async ({ page }) => {
  const errors = await open(page, 'minimal-deck.student.html');
  await expect(page.locator('#nav-dock')).toBeVisible();
  await expect(page.locator('#nav-notes')).toBeHidden();
  await expect(page.locator('#nav-toc')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.locator('body')).not.toHaveClass(/\bnotes-open\b/);
  expect(await page.evaluate(() => window.MARCO?.data.notes)).toBeUndefined();
  expect(errors).toEqual([]);
});
