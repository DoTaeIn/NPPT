/**
 * Image assets → optimised data URIs with intrinsic width/height (components.md: image).
 * With sharp: fit inside 1920×1080, JPEG → q82, PNG → PNG when it has alpha or ≤ 256 colours
 * (or `keepPng`), otherwise WebP q85. Without sharp the original bytes are embedded.
 */
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { Diagnostic } from './diagnostics.js';
import type { Block, Lecture } from './ir.js';
import type { AssetData } from './render/blocks.js';

export interface AssetOptions {
  /** Directory the asset paths are relative to (the source file's directory). */
  baseDir: string;
  keepPng?: boolean;
  /** Set to false to skip sharp (tests and environments without the native module). */
  useSharp?: boolean;
}

export interface AssetResult {
  data: Record<string, AssetData>;
  warnings: Diagnostic[];
}

const MAX_W = 1920;
const MAX_H = 1080;

type SharpFactory = (typeof import('sharp'))['default'];
let sharpLoad: Promise<SharpFactory | null> | undefined;
function loadSharp(): Promise<SharpFactory | null> {
  sharpLoad ??= import('sharp').then(
    (m) => m.default,
    () => null,
  );
  return sharpLoad;
}

/** Asset ids used by image blocks, in first-use order. */
export function usedAssetIds(lecture: Lecture): string[] {
  const ids: string[] = [];
  const visit = (blocks: Block[]): void => {
    for (const b of blocks) {
      if (b.type === 'image' && !ids.includes(b.asset)) ids.push(b.asset);
      else if (b.type === 'columns') b.columns.forEach(visit);
    }
  };
  lecture.slides.forEach((s) => visit(s.blocks));
  return ids;
}

export async function processAssets(lecture: Lecture, opts: AssetOptions): Promise<AssetResult> {
  const warnings: Diagnostic[] = [];
  const data: Record<string, AssetData> = {};
  const sharp = opts.useSharp === false ? null : await loadSharp();
  let sharpWarned = opts.useSharp === false;
  for (const id of usedAssetIds(lecture)) {
    const asset = lecture.assets[id];
    if (!asset) continue; // validator / lint report unknown asset ids
    if (/^[a-z][a-z0-9+.-]*:/i.test(asset.path)) {
      warnings.push({
        level: 'warn',
        code: 'asset.remote',
        message: `이미지 '${id}'는 원격 경로라 포함하지 않습니다: ${asset.path}`,
      });
      data[id] = {};
      continue;
    }
    const file = isAbsolute(asset.path) ? asset.path : resolve(opts.baseDir, asset.path);
    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch {
      warnings.push({
        level: 'warn',
        code: 'asset.missing',
        message: `이미지 파일을 찾을 수 없습니다: ${asset.path} (asset '${id}')`,
      });
      data[id] = {};
      continue;
    }
    let out: Optimised | undefined;
    if (sharp) {
      try {
        out = await optimise(sharp, bytes, opts.keepPng ?? false);
      } catch (e) {
        warnings.push({
          level: 'warn',
          code: 'asset.optimise',
          message: `이미지 최적화 실패, 원본을 포함합니다: ${asset.path} (${(e as Error).message})`,
        });
      }
    } else if (!sharpWarned) {
      sharpWarned = true;
      warnings.push({
        level: 'warn',
        code: 'asset.sharp',
        message: 'sharp를 불러올 수 없어 이미지를 원본 그대로 포함합니다.',
      });
    }
    out ??= original(bytes);
    data[id] = {
      src: `data:${out.mime};base64,${out.bytes.toString('base64')}`,
      mime: out.mime,
      bytes: out.bytes.length,
      ...(out.width ? { width: out.width } : {}),
      ...(out.height ? { height: out.height } : {}),
    };
    if (out.width) asset.width = out.width;
    if (out.height) asset.height = out.height;
  }
  return { data, warnings };
}

interface Optimised {
  bytes: Buffer;
  mime: string;
  width?: number;
  height?: number;
}

async function optimise(sharp: SharpFactory, input: Buffer, keepPng: boolean): Promise<Optimised> {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const format = meta.format;
  if (format === 'svg' || format === 'gif' || !meta.width || !meta.height) return original(input);
  const rotated = (meta.orientation ?? 1) >= 5;
  const w = rotated ? meta.height : meta.width;
  const h = rotated ? meta.width : meta.height;
  const resize = w > MAX_W || h > MAX_H;
  const pipeline = (): ReturnType<SharpFactory> => {
    const p = sharp(input, { failOn: 'none' }).rotate();
    return resize
      ? p.resize({ width: MAX_W, height: MAX_H, fit: 'inside', withoutEnlargement: true })
      : p;
  };

  let result: { data: Buffer; info: { width: number; height: number } };
  let mime: string;
  if (format === 'jpeg') {
    result = await pipeline().jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
    mime = 'image/jpeg';
  } else if (format === 'png') {
    const alpha =
      meta.hasAlpha === true && !(await sharp(input, { failOn: 'none' }).stats()).isOpaque;
    const colours = await countColours(sharp, input, 256);
    if (alpha || colours <= 256 || keepPng) {
      result = await pipeline()
        .png({ compressionLevel: 9, palette: colours <= 256 })
        .toBuffer({ resolveWithObject: true });
      mime = 'image/png';
    } else {
      result = await pipeline().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
      mime = 'image/webp';
    }
  } else {
    result = await pipeline().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    mime = 'image/webp';
  }
  const sameFormat = mime === `image/${format}`;
  if (!resize && sameFormat && !rotated && result.data.length >= input.length) {
    return { bytes: input, mime, width: meta.width, height: meta.height };
  }
  return { bytes: result.data, mime, width: result.info.width, height: result.info.height };
}

/** Number of distinct RGBA colours, counting at most `limit + 1`. */
async function countColours(sharp: SharpFactory, input: Buffer, limit: number): Promise<number> {
  const { data } = await sharp(input, { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Set<number>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    seen.add(
      (((data[i] ?? 0) << 24) |
        ((data[i + 1] ?? 0) << 16) |
        ((data[i + 2] ?? 0) << 8) |
        (data[i + 3] ?? 0)) >>>
        0,
    );
    if (seen.size > limit) break;
  }
  return seen.size;
}

/** Original bytes with the MIME type and size read from the file header. */
export function original(bytes: Buffer): Optimised {
  const sniffed = sniffImage(bytes);
  return {
    bytes,
    mime: sniffed.mime,
    ...(sniffed.width ? { width: sniffed.width, height: sniffed.height } : {}),
  };
}

export function sniffImage(b: Buffer): { mime: string; width?: number; height?: number } {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 10 && b.toString('latin1', 0, 4) === 'GIF8') {
    return { mime: 'image/gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1] ?? 0;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return { mime: 'image/jpeg' };
  }
  if (
    b.length >= 30 &&
    b.toString('latin1', 0, 4) === 'RIFF' &&
    b.toString('latin1', 8, 12) === 'WEBP'
  ) {
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8 ')
      return {
        mime: 'image/webp',
        width: b.readUInt16LE(26) & 0x3fff,
        height: b.readUInt16LE(28) & 0x3fff,
      };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return {
        mime: 'image/webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X')
      return {
        mime: 'image/webp',
        width: 1 + b.readUIntLE(24, 3),
        height: 1 + b.readUIntLE(27, 3),
      };
    return { mime: 'image/webp' };
  }
  const head = b.toString('utf8', 0, Math.min(b.length, 1024));
  if (/<svg[\s>]/i.test(head)) {
    const w = /<svg[^>]*\swidth="(\d+(?:\.\d+)?)(?:px)?"/i.exec(head)?.[1];
    const h = /<svg[^>]*\sheight="(\d+(?:\.\d+)?)(?:px)?"/i.exec(head)?.[1];
    return {
      mime: 'image/svg+xml',
      ...(w && h ? { width: Math.round(Number(w)), height: Math.round(Number(h)) } : {}),
    };
  }
  return { mime: 'application/octet-stream' };
}
