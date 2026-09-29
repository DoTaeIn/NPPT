import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processAssets, sniffImage } from '../src/index.js';
import type { Lecture } from '../src/ir.js';

const FIXTURE_PNG = fileURLToPath(new URL('./fixtures/assets/diagram.png', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'marco-assets-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Deterministic many-colour RGB noise. */
function noise(width: number, height: number, channels: 3 | 4 = 3): Buffer {
  const buf = Buffer.alloc(width * height * channels);
  let x = 12345;
  for (let i = 0; i < buf.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = (x >>> 16) & 0xff;
  }
  return buf;
}

beforeAll(async () => {
  mkdirSync(join(dir, 'assets'));
  await sharp(noise(2400, 1200), { raw: { width: 2400, height: 1200, channels: 3 } })
    .png()
    .toFile(join(dir, 'assets/photo.png'));
  await sharp(noise(3000, 2000), { raw: { width: 3000, height: 2000, channels: 3 } })
    .jpeg({ quality: 95 })
    .toFile(join(dir, 'assets/big.jpg'));
  await sharp(noise(64, 64, 4), { raw: { width: 64, height: 64, channels: 4 } })
    .png()
    .toFile(join(dir, 'assets/alpha.png'));
  writeFileSync(join(dir, 'assets/diagram.png'), readFileSync(FIXTURE_PNG));
});

function lectureWith(paths: Record<string, string>): Lecture {
  return {
    ir: '0.1',
    meta: { title: 't', lang: 'ko', theme: 'v20-violet', edition: 'instructor' },
    refs: [],
    videos: [],
    terms: {},
    assets: Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, { path }])),
    slides: [
      {
        id: 's-01',
        type: 'content',
        title: 't',
        blocks: [
          ...Object.keys(paths).map((asset) => ({ type: 'image' as const, asset })),
          { type: 'columns', cols: 2, columns: [[], []] },
        ],
      },
    ],
  };
}

const bytesOf = (src = ''): Buffer => Buffer.from(src.slice(src.indexOf(',') + 1), 'base64');

describe('processAssets (sharp)', () => {
  it('keeps a small palette PNG as PNG with its size', async () => {
    const lecture = lectureWith({ diagram: 'assets/diagram.png' });
    const { data, warnings } = await processAssets(lecture, { baseDir: dir });
    expect(warnings).toEqual([]);
    expect(data.diagram).toMatchObject({ mime: 'image/png', width: 160, height: 90 });
    expect(data.diagram?.src?.startsWith('data:image/png;base64,')).toBe(true);
    expect(lecture.assets.diagram).toMatchObject({ width: 160, height: 90 });
  });

  it('converts a many-colour opaque PNG to WebP and fits it into 1920×1080', async () => {
    const { data } = await processAssets(lectureWith({ photo: 'assets/photo.png' }), {
      baseDir: dir,
    });
    expect(data.photo).toMatchObject({ mime: 'image/webp', width: 1920, height: 960 });
    expect(await sharp(bytesOf(data.photo?.src)).metadata()).toMatchObject({
      format: 'webp',
      width: 1920,
      height: 960,
    });
  });

  it('keeps PNG with keepPng', async () => {
    const { data } = await processAssets(lectureWith({ photo: 'assets/photo.png' }), {
      baseDir: dir,
      keepPng: true,
    });
    expect(data.photo).toMatchObject({ mime: 'image/png', width: 1920, height: 960 });
  });

  it('keeps PNG with transparency', async () => {
    const { data } = await processAssets(lectureWith({ alpha: 'assets/alpha.png' }), {
      baseDir: dir,
    });
    expect(data.alpha).toMatchObject({ mime: 'image/png', width: 64, height: 64 });
  });

  it('re-encodes and resizes JPEG', async () => {
    const { data } = await processAssets(lectureWith({ big: 'assets/big.jpg' }), { baseDir: dir });
    expect(data.big).toMatchObject({ mime: 'image/jpeg', width: 1620, height: 1080 });
  });

  it('warns about missing files and remote paths', async () => {
    const { data, warnings } = await processAssets(
      lectureWith({ gone: 'assets/gone.png', web: 'https://x.org/a.png' }),
      { baseDir: dir },
    );
    expect(data).toEqual({ gone: {}, web: {} });
    expect(warnings.map((w) => w.code)).toEqual(['asset.missing', 'asset.remote']);
  });

  it('only processes assets used by image blocks', async () => {
    const lecture = lectureWith({});
    lecture.assets.unused = { path: 'assets/diagram.png' };
    const { data } = await processAssets(lecture, { baseDir: dir });
    expect(data).toEqual({});
  });
});

describe('processAssets without sharp', () => {
  it('embeds the original bytes and reads the size from the header', async () => {
    const { data, warnings } = await processAssets(lectureWith({ diagram: 'assets/diagram.png' }), {
      baseDir: dir,
      useSharp: false,
    });
    expect(warnings).toEqual([]);
    expect(data.diagram).toMatchObject({ mime: 'image/png', width: 160, height: 90 });
    expect(bytesOf(data.diagram?.src)).toEqual(readFileSync(FIXTURE_PNG));
  });
});

describe('sniffImage', () => {
  it('reads PNG, JPEG, GIF, WebP and SVG headers', async () => {
    const png = await sharp({ create: { width: 7, height: 5, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const jpg = await sharp({ create: { width: 9, height: 4, channels: 3, background: '#fff' } })
      .jpeg()
      .toBuffer();
    const gif = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#fff' } })
      .gif()
      .toBuffer();
    const webp = await sharp({ create: { width: 11, height: 6, channels: 3, background: '#fff' } })
      .webp({ lossless: true })
      .toBuffer();
    expect(sniffImage(png)).toEqual({ mime: 'image/png', width: 7, height: 5 });
    expect(sniffImage(jpg)).toEqual({ mime: 'image/jpeg', width: 9, height: 4 });
    expect(sniffImage(gif)).toEqual({ mime: 'image/gif', width: 3, height: 2 });
    expect(sniffImage(webp)).toEqual({ mime: 'image/webp', width: 11, height: 6 });
    expect(
      sniffImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>'),
      ),
    ).toEqual({
      mime: 'image/svg+xml',
      width: 40,
      height: 20,
    });
  });
});
