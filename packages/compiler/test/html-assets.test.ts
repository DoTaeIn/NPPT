import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  compile,
  htmlAssetIds,
  parseMarco,
  resolveHtmlImages,
  scanImages,
  usedAssetIds,
} from '../src/index.js';

const PNG = fileURLToPath(new URL('./fixtures/assets/diagram.png', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'marco-htmlimg-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('scanImages / resolveHtmlImages', () => {
  it('finds <img> tags with data-asset and src, quoted > included', () => {
    const imgs = scanImages(
      '<p>x</p><img data-asset="udt" alt="a > b"><IMG SRC=\'assets/x.png\' /><img src="data:image/png;base64,AA">',
    );
    expect(imgs.map((i) => [i.asset, i.src, i.alt])).toEqual([
      ['udt', undefined, 'a > b'],
      [undefined, 'assets/x.png', undefined],
      [undefined, 'data:image/png;base64,AA', undefined],
    ]);
    expect(
      htmlAssetIds('<img data-asset="a"><img src="./assets/x.png"><img data-asset="zz">', {
        a: { path: 'a.png' },
        x: { path: 'assets/x.png' },
      }),
    ).toEqual(['a', 'x']);
  });

  it('fills src, width, height and a missing alt; leaves unknown and remote images alone', () => {
    const data = { a: { src: 'data:image/png;base64,QQ==', width: 40, height: 30 } };
    const assets = { a: { path: 'assets/a.png', title: '**그림** A' } };
    expect(resolveHtmlImages('<div><img data-asset="a" class="x"></div>', data, assets)).toBe(
      '<div><img data-asset="a" class="x" src="data:image/png;base64,QQ==" width="40" height="30" alt="그림 A"></div>',
    );
    // A local src is replaced; author width / alt are kept; self-closing tags stay self-closing.
    expect(
      resolveHtmlImages('<img src="assets/a.png" width="100" alt="직접" />', data, assets),
    ).toBe('<img width="100" alt="직접" src="data:image/png;base64,QQ==" />');
    const untouched =
      '<img data-asset="zz"><img src="https://x/y.png"><img src="assets/other.png">';
    expect(resolveHtmlImages(untouched, data, assets)).toBe(untouched);
  });
});

describe('html blocks and raw slides reference assets', () => {
  it('the parser registers src paths and warns once per unknown data-asset id', () => {
    const { lecture, diagnostics } = parseMarco(
      `---
title: T
assets:
  udt: { path: assets/udt.png }
---
# slide
title: A

:::html
<img data-asset="udt"><img src="assets/Rex Sensor.png" alt="퇴실 센서"><img data-asset="ghost">
:::

# slide raw
title: R

<div class="slide-wrapper"><img data-asset="ghost"><img data-asset="phantom"><img src="assets/udt.png"></div>
`,
      { file: 'd.marco.md' },
    );
    expect(lecture.assets).toEqual({
      udt: { path: 'assets/udt.png' },
      'rex-sensor': { path: 'assets/Rex Sensor.png', alt: '퇴실 센서' },
    });
    expect(diagnostics).toEqual([
      expect.objectContaining({ level: 'warn', code: 'format.html.asset', line: 9, slide: 's-01' }),
      expect.objectContaining({
        level: 'warn',
        code: 'format.html.asset',
        line: 16,
        slide: 's-02',
      }),
    ]);
    expect(diagnostics.map((d) => d.message)).toEqual([
      expect.stringContaining('"ghost"'),
      expect.stringContaining('"phantom"'),
    ]);
    expect(usedAssetIds(lecture)).toEqual(['udt', 'rex-sensor']);
  });

  it('compile embeds one optimised data URI per asset use, with width/height', async () => {
    const dir = join(tmp, 'deck');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    copyFileSync(PNG, join(dir, 'assets', 'diagram.png'));
    copyFileSync(PNG, join(dir, 'assets', 'copy.png'));
    const source = join(dir, 'lecture.marco.md');
    writeFileSync(
      source,
      `---
title: HTML 이미지
assets:
  diagram: { path: assets/diagram.png, alt: 개념도 }
  twin: { path: assets/copy.png }
---
# slide
title: A

![개념도](assets/diagram.png)

:::html
<figure class="v-figure"><img data-asset="diagram"></figure>
:::

:::columns cols=2
:::col
:::html
<img src="assets/diagram.png" alt="경로로 참조">
:::
:::
:::col
:::html
<img data-asset="twin">
:::
:::
:::

# slide raw
title: R

<div class="slide-wrapper"><img data-asset="diagram"><img data-asset="missing-id"></div>
`,
    );
    const r = await compile(source, { fonts: 'none' });
    expect(r.ok).toBe(true);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['format.html.asset']);
    expect(r.warnings.filter((w) => w.code.startsWith('asset.'))).toEqual([]);
    const html = r.html;
    const uri = /<figure class="figure" id="s-01-b1"[^>]*><img src="(data:[^"]+)"/.exec(html)?.[1];
    expect(uri).toMatch(/^data:image\/(png|webp);base64,/);
    const size = /<img src="data:[^"]+" alt="개념도" width="(\d+)" height="(\d+)">/.exec(html);
    expect(size).not.toBeNull();
    const wh = `width="${size?.[1]}" height="${size?.[2]}"`;
    // Each use carries the data URI (a single HTML file cannot share <img> bytes without JS).
    expect(html).toContain(
      `<figure class="v-figure"><img data-asset="diagram" src="${uri}" ${wh} alt="개념도"></figure>`,
    );
    expect(html).toContain(`<img alt="경로로 참조" src="${uri}" ${wh}>`);
    // Identical bytes under another id reuse the same optimised output.
    expect(html).toContain(`<img data-asset="twin" src="${uri}" ${wh}>`);
    expect(html).toContain(
      `<div class="slide-wrapper"><img data-asset="diagram" src="${uri}" ${wh} alt="개념도"><img data-asset="missing-id"></div>`,
    );
    expect(html.split(uri ?? '#').length - 1).toBe(5);
  });
});
