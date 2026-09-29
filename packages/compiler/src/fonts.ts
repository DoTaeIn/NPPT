/**
 * Deck CSS with fonts (design-system dist → one `<style>`).
 *
 * - `embed`:  `dist/marco.css` as is (fonts included by the design system).
 * - `subset`: `dist/marco.nofonts.css` + `@font-face` rules whose fonts are subset with
 *   subset-font to the characters the deck uses (plus ASCII and common Korean punctuation).
 *   Font faces are read from the `@font-face` rules of `marco.css` (their `url(fonts/x.woff2)`
 *   files in `dist/fonts/` or inline data URLs); if it has none, from `dist/fonts/*.woff2`
 *   file names (`Family-Weight.woff2`).
 * - `none`:   `marco.nofonts.css` + a system font stack.
 * Subsetting problems or missing files fall back to `embed` with a warning.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import subsetFont from 'subset-font';
import type { Diagnostic } from './diagnostics.js';
import { designSystemDistDir } from './resolve.js';

export type FontMode = 'embed' | 'subset' | 'none';
export const FONT_MODES: readonly FontMode[] = ['embed', 'subset', 'none'];

export interface StyleOptions {
  mode: FontMode;
  /** All text the deck can show (slides, notes, dialogs, runtime UI). */
  text: string;
  /** Override for the design-system dist directory (tests). */
  designSystemDir?: string;
}

export interface StyleResult {
  css: string;
  /** Mode actually used (after fallbacks). */
  mode: FontMode;
  warnings: Diagnostic[];
}

/** ASCII printable and punctuation common in Korean lecture text, always kept in subsets. */
export const BASE_CHARS =
  Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)).join('') +
  ' ·•…‥–—―‘’“”«»‹›「」『』《》〈〉【】〔〕※→←↑↓↔↗↘⇒⇔▶▷◀◁○●◎■□▲△▼▽◆◇★☆✓✔✕✗×÷±≠≤≥≈°℃%‰①②③④⑤⑥⑦⑧⑨⑩、。・～';

export const SYSTEM_FONT_CSS =
  '\n/* MARCO: --fonts none — system font stack */\n' +
  ':root{--font-sans:system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif}' +
  'html,body{font-family:var(--font-sans)}\n';

export const MISSING_CSS_PLACEHOLDER =
  '/* MARCO PLACEHOLDER: @marco/design-system dist/marco.css was not found. Build it with `pnpm --filter @marco/design-system build`. */';

interface FontFace {
  family: string;
  weight: string;
  style: string;
  stretch?: string;
  range?: [number, number][];
  rangeRaw?: string;
  bytes: Buffer;
  source: string;
}

const read = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

export async function buildStyles(opts: StyleOptions): Promise<StyleResult> {
  const warnings: Diagnostic[] = [];
  const dir = opts.designSystemDir ?? designSystemDistDir();
  const full = dir ? read(join(dir, 'marco.css')) : undefined;
  const nofonts = dir ? read(join(dir, 'marco.nofonts.css')) : undefined;

  const embed = (reason?: string): StyleResult => {
    if (reason) warnings.push({ level: 'warn', code: 'font.fallback', message: `${reason} → 글꼴 전체 포함(embed)으로 대체합니다.` });
    if (full === undefined) {
      warnings.push({ level: 'warn', code: 'build.css.missing', message: '디자인 시스템 CSS(@marco/design-system/dist/marco.css)가 없어 자리표시자를 넣었습니다.' });
      return { css: MISSING_CSS_PLACEHOLDER, mode: 'embed', warnings };
    }
    return { css: full, mode: 'embed', warnings };
  };

  if (opts.mode === 'embed') return embed();
  if (nofonts === undefined) return embed('marco.nofonts.css가 없습니다');
  if (opts.mode === 'none') return { css: nofonts + SYSTEM_FONT_CSS, mode: 'none', warnings };

  const faces = collectFaces(full, dir ? join(dir, 'fonts') : undefined);
  if (!faces.length) return embed('서브셋할 글꼴(dist/fonts/*.woff2)을 찾지 못했습니다');
  const chars = usedChars(opts.text);
  const rules: string[] = [];
  try {
    for (const face of faces) {
      const text = face.range ? chars.filter((c) => inRange(c, face.range ?? [])) : chars;
      if (!text.length) continue;
      const subset = await subsetFont(face.bytes, text.map((c) => String.fromCodePoint(c)).join(""), { targetFormat: 'woff2' });
      rules.push(
        `@font-face{font-family:${face.family};font-style:${face.style};font-weight:${face.weight};${
          face.stretch ? `font-stretch:${face.stretch};` : ''
        }font-display:swap;${face.rangeRaw ? `unicode-range:${face.rangeRaw};` : ''}src:url(data:font/woff2;base64,${subset.toString(
          'base64',
        )}) format("woff2")}`,
      );
    }
  } catch (e) {
    return embed(`글꼴 서브셋 실패 (${(e as Error).message})`);
  }
  return { css: `/* MARCO: fonts subset to ${chars.length} characters */\n${rules.join('\n')}\n${nofonts}`, mode: 'subset', warnings };
}

/** Sorted, de-duplicated code points of `text` plus BASE_CHARS (control characters dropped). */
export function usedChars(text: string): number[] {
  const set = new Set<number>();
  for (const ch of BASE_CHARS + text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x20 && !(cp >= 0x7f && cp < 0xa0)) set.add(cp);
  }
  return [...set].sort((a, b) => a - b);
}

function inRange(cp: number, ranges: [number, number][]): boolean {
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** `U+0000-00FF, U+0131, U+4??` → code point ranges. */
export function parseUnicodeRange(value: string): [number, number][] {
  const out: [number, number][] = [];
  for (const part of value.split(',')) {
    const m = /^\s*U\+([0-9A-F?]+)(?:-([0-9A-F]+))?\s*$/i.exec(part);
    if (!m?.[1]) continue;
    if (m[1].includes('?')) {
      out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'F'), 16)]);
    } else {
      const lo = parseInt(m[1], 16);
      out.push([lo, m[2] ? parseInt(m[2], 16) : lo]);
    }
  }
  return out;
}

const WEIGHTS: Record<string, string> = {
  thin: '100',
  hairline: '100',
  extralight: '200',
  ultralight: '200',
  light: '300',
  regular: '400',
  normal: '400',
  book: '400',
  medium: '500',
  semibold: '600',
  demibold: '600',
  bold: '700',
  extrabold: '800',
  ultrabold: '800',
  black: '900',
  heavy: '900',
};

function collectFaces(css: string | undefined, fontsDir: string | undefined): FontFace[] {
  const faces: FontFace[] = [];
  for (const m of (css ?? '').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1] ?? '';
    const desc = (name: string): string | undefined => new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim();
    const family = desc('font-family');
    if (!family) continue;
    const urls = [...body.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)(?:\s*format\(\s*['"]?([\w-]+)['"]?\s*\))?/g)].map((u) => ({
      url: u[2] ?? '',
      format: u[3],
    }));
    const pick =
      urls.find((u) => u.format === 'woff2' || /\.woff2(?:[?#].*)?$/.test(u.url) || u.url.startsWith('data:font/woff2')) ?? urls[0];
    if (!pick) continue;
    const bytes = fontBytes(pick.url, fontsDir);
    if (!bytes) continue;
    const rangeRaw = desc('unicode-range');
    const stretch = desc('font-stretch');
    faces.push({
      family,
      weight: desc('font-weight') ?? '400',
      style: desc('font-style') ?? 'normal',
      ...(stretch ? { stretch } : {}),
      ...(rangeRaw ? { rangeRaw, range: parseUnicodeRange(rangeRaw) } : {}),
      bytes,
      source: pick.url.startsWith('data:') ? 'data-url' : pick.url,
    });
  }
  if (faces.length || !fontsDir || !existsSync(fontsDir)) return faces;
  // No @font-face rules to follow: derive faces from file names (Family-Weight[-Italic].woff2).
  for (const file of readdirSync(fontsDir).filter((f) => f.endsWith('.woff2')).sort()) {
    const stem = file.replace(/\.woff2$/, '');
    const m = /^(.+?)[-_]([A-Za-z]+|\d{3})(?:[-_]?(Italic))?$/.exec(stem);
    const family = m?.[1] ?? stem;
    const weightWord = (m?.[2] ?? 'regular').toLowerCase();
    const weight = /^\d{3}$/.test(weightWord) ? weightWord : (WEIGHTS[weightWord.replace(/italic$/, '')] ?? '400');
    faces.push({
      family: JSON.stringify(family),
      weight,
      style: m?.[3] || /italic$/i.test(stem) ? 'italic' : 'normal',
      bytes: readFileSync(join(fontsDir, file)),
      source: file,
    });
  }
  return faces;
}

function fontBytes(url: string, fontsDir: string | undefined): Buffer | undefined {
  if (url.startsWith('data:')) {
    const m = /^data:[^,]*;base64,(.*)$/s.exec(url);
    return m?.[1] ? Buffer.from(m[1], 'base64') : undefined;
  }
  if (!fontsDir) return undefined;
  const name = basename(url.replace(/[?#].*$/, ''));
  const path = join(fontsDir, name);
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
}
