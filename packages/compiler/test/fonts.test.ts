import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildStyles, usedChars } from '../src/index.js';
import { parseUnicodeRange, SYSTEM_FONT_CSS } from '../src/fonts.js';

// A real woff2 we are allowed to depend on: the Lucide icon font.
const lucideRoot = dirname(createRequire(import.meta.url).resolve('lucide-static/package.json'));
const FONT = join(lucideRoot, 'font', 'lucide.woff2');
const codepoints = JSON.parse(
  readFileSync(join(lucideRoot, 'font', 'codepoints.json'), 'utf8'),
) as Record<string, number>;
const shieldChar = String.fromCodePoint(codepoints.shield ?? 0xe000);

const root = mkdtempSync(join(tmpdir(), 'marco-fonts-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Fake design-system dist: marco.css, marco.nofonts.css, fonts/ (+ optional manifest). */
function dist(
  name: string,
  opts: { css?: string; nofonts?: string; fonts?: string[]; manifest?: unknown },
): string {
  const dir = join(root, name);
  mkdirSync(join(dir, 'fonts'), { recursive: true });
  if (opts.css !== undefined) writeFileSync(join(dir, 'marco.css'), opts.css);
  if (opts.nofonts !== undefined) writeFileSync(join(dir, 'marco.nofonts.css'), opts.nofonts);
  for (const f of opts.fonts ?? []) copyFileSync(FONT, join(dir, 'fonts', f));
  if (opts.manifest !== undefined)
    writeFileSync(join(dir, 'fonts', 'fonts.json'), JSON.stringify(opts.manifest));
  return dir;
}

const FULL =
  '@font-face{font-family:Icons;font-style:normal;font-weight:400;src:url(fonts/icons.woff2) format("woff2")}.a{color:red}';
const NOFONTS = '.a{color:red}';

// Subsetting runs harfbuzz (WASM); allow for slow, busy machines.
describe('buildStyles', { timeout: 30_000 }, () => {
  it('embed uses marco.css as is', async () => {
    const r = await buildStyles({
      mode: 'embed',
      text: '',
      designSystemDir: dist('embed', { css: FULL, nofonts: NOFONTS }),
    });
    expect(r).toEqual({ css: FULL, mode: 'embed', warnings: [] });
  });

  it('none uses marco.nofonts.css plus a system font stack', async () => {
    const r = await buildStyles({
      mode: 'none',
      text: '',
      designSystemDir: dist('none', { css: FULL, nofonts: NOFONTS }),
    });
    expect(r.css).toBe(NOFONTS + SYSTEM_FONT_CSS);
    expect(r.mode).toBe('none');
  });

  it('subset follows @font-face rules of marco.css and embeds smaller fonts', async () => {
    const dir = dist('subset', { css: FULL, nofonts: NOFONTS, fonts: ['icons.woff2'] });
    const r = await buildStyles({
      mode: 'subset',
      text: `강의 ${shieldChar}`,
      designSystemDir: dir,
    });
    expect(r.warnings).toEqual([]);
    expect(r.mode).toBe('subset');
    const m =
      /@font-face\{font-family:Icons;font-style:normal;font-weight:400;font-display:swap;src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\) format\("woff2"\)\}/.exec(
        r.css,
      );
    expect(m).not.toBeNull();
    expect(Buffer.from(m?.[1] ?? '', 'base64').length).toBeLessThan(readFileSync(FONT).length);
    expect(r.css.endsWith(`\n${NOFONTS}`)).toBe(true);
    // Deterministic.
    expect(
      (await buildStyles({ mode: 'subset', text: `강의 ${shieldChar}`, designSystemDir: dir })).css,
    ).toBe(r.css);
  });

  it('subset prefers the fonts.json manifest', async () => {
    const dir = dist('manifest', {
      css: '',
      nofonts: NOFONTS,
      fonts: ['Brand-Bold.woff2'],
      manifest: [
        {
          family: 'Brand Sans',
          weight: '700 900',
          style: 'normal',
          file: 'fonts/Brand-Bold.woff2',
        },
      ],
    });
    const r = await buildStyles({ mode: 'subset', text: 'x', designSystemDir: dir });
    expect(r.css).toContain(
      '@font-face{font-family:"Brand Sans";font-style:normal;font-weight:700 900;font-display:swap;src:url(data:font/woff2;base64,',
    );
  });

  it('subset derives faces from file names when nothing describes them', async () => {
    const dir = dist('names', {
      nofonts: NOFONTS,
      fonts: ['Pretendard-SemiBold.woff2', 'Spoqa-Regular.woff2'],
    });
    const r = await buildStyles({ mode: 'subset', text: 'x', designSystemDir: dir });
    const faces = [
      ...r.css.matchAll(/font-family:([^;]+);font-style:(\w+);font-weight:(\d+)/g),
    ].map((m) => `${m[1]} ${m[3]}`);
    expect(faces).toEqual(['"Pretendard" 600', '"Spoqa" 400']);
  });

  it('subset skips faces whose unicode-range misses every used character', async () => {
    const css =
      '@font-face{font-family:A;font-weight:400;unicode-range:U+AC00-D7A3;src:url(fonts/a.woff2)}' +
      '@font-face{font-family:B;font-weight:400;unicode-range:U+1F600-1F64F;src:url(fonts/b.woff2)}';
    const dir = dist('ranges', { css, nofonts: NOFONTS, fonts: ['a.woff2', 'b.woff2'] });
    const r = await buildStyles({ mode: 'subset', text: '한글', designSystemDir: dir });
    expect(r.css).toContain('font-family:A;');
    expect(r.css).toContain('unicode-range:U+AC00-D7A3;');
    expect(r.css).not.toContain('font-family:B;');
  });

  it('falls back to embed when fonts or nofonts.css are missing', async () => {
    const noFonts = await buildStyles({
      mode: 'subset',
      text: 'x',
      designSystemDir: dist('nofiles', { css: FULL, nofonts: NOFONTS }),
    });
    expect(noFonts.mode).toBe('embed');
    expect(noFonts.css).toBe(FULL);
    expect(noFonts.warnings.map((w) => w.code)).toEqual(['font.fallback']);
    const noNofonts = await buildStyles({
      mode: 'none',
      text: 'x',
      designSystemDir: dist('nonofonts', { css: FULL }),
    });
    expect(noNofonts).toMatchObject({ mode: 'embed', css: FULL });
    expect(noNofonts.warnings.map((w) => w.code)).toEqual(['font.fallback']);
  });

  it('falls back to embed when a font cannot be subset', async () => {
    const dir = dist('corrupt', { css: FULL, nofonts: NOFONTS });
    writeFileSync(join(dir, 'fonts', 'icons.woff2'), 'not a font');
    const r = await buildStyles({ mode: 'subset', text: 'x', designSystemDir: dir });
    expect(r.mode).toBe('embed');
    expect(r.warnings[0]).toMatchObject({ code: 'font.fallback' });
  });

  it('emits a marked placeholder when the design-system dist is missing', async () => {
    const r = await buildStyles({
      mode: 'embed',
      text: '',
      designSystemDir: join(root, 'missing'),
    });
    expect(r.css).toContain('MARCO PLACEHOLDER');
    expect(r.warnings.map((w) => w.code)).toEqual(['build.css.missing']);
  });
});

describe('font helpers', () => {
  it('usedChars adds ASCII and Korean punctuation, sorted and unique', () => {
    const chars = usedChars('가가나\n\t');
    expect(chars).toContain('A'.codePointAt(0));
    expect(chars).toContain('·'.codePointAt(0));
    expect(chars).toContain('가'.codePointAt(0));
    expect(chars).not.toContain(10);
    expect([...chars].sort((a, b) => a - b)).toEqual(chars);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it('parseUnicodeRange handles ranges, singles and wildcards', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131, U+4??')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
  });
});
