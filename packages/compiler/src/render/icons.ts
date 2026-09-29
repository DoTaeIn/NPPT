/**
 * Lucide icons inlined as SVG (components.md: `<i class="icon" data-icon="name">…svg…</i>`).
 * The runtime never loads an icon library; only icons a deck uses are emitted.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Block, Lecture, LintIssue } from '../ir.js';

let iconsDir: string | null | undefined;
const cache = new Map<string, string | null>();

function lucideDir(): string | null {
  if (iconsDir !== undefined) return iconsDir;
  try {
    const pkg = createRequire(import.meta.url).resolve('lucide-static/package.json');
    iconsDir = join(dirname(pkg), 'icons');
  } catch {
    iconsDir = null;
  }
  return iconsDir;
}

/** Inline SVG markup for a Lucide icon name, or undefined when the icon does not exist. */
export function iconSvg(name: string): string | undefined {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return undefined;
  const hit = cache.get(name);
  if (hit !== undefined) return hit ?? undefined;
  const dir = lucideDir();
  let svg: string | null = null;
  if (dir) {
    try {
      svg = readFileSync(join(dir, `${name}.svg`), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .replace(/\s*\/>/g, '/>')
        .replace(/\s+>/g, '>')
        .trim()
        // Only the root <svg> loses its fixed size; <rect width height> inside must stay.
        .replace(/^<svg\b[^>]*>/, (open) =>
          open
            .replace(/\s(width|height)="[^"]*"/g, '')
            .replace(/^<svg\b/, '<svg aria-hidden="true"'),
        );
    } catch {
      svg = null;
    }
  }
  cache.set(name, svg);
  return svg ?? undefined;
}

/** `<i class="icon" data-icon="name">svg</i>`, or undefined for an unknown icon. */
export function iconHtml(name: string): string | undefined {
  const svg = iconSvg(name);
  return svg ? `<i class="icon" data-icon="${name}">${svg}</i>` : undefined;
}

/** `icon.unknown` lint issues for cards/tiles icons that Lucide does not have (components.md). */
export function lintIcons(lecture: Lecture): LintIssue[] {
  const issues: LintIssue[] = [];
  lecture.slides.forEach((slide, si) => {
    const visit = (blocks: Block[], path: string): void =>
      blocks.forEach((block, bi) => {
        const p = `${path}/${bi}`;
        if (block.type === 'cards' || block.type === 'tiles') {
          block.items.forEach((item, ii) => {
            if (item.icon && !iconSvg(item.icon)) {
              issues.push({
                level: 'warn',
                code: 'icon.unknown',
                path: `${p}/items/${ii}/icon`,
                message: `알 수 없는 Lucide 아이콘 '${item.icon}'은(는) 표시되지 않습니다.`,
                slide: slide.id,
              });
            }
          });
        } else if (block.type === 'columns') {
          block.columns.forEach((col, ci) => visit(col, `${p}/columns/${ci}`));
        }
      });
    visit(slide.blocks, `/slides/${si}/blocks`);
  });
  return issues;
}
