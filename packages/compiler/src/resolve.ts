/**
 * Locations of the sibling build outputs the compiler inlines:
 * `@marco/runtime/dist/marco-runtime.js` and `@marco/design-system/dist/{marco.css,marco.nofonts.css,fonts/}`.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveSpecifier(spec: string): string | undefined {
  try {
    if (typeof import.meta.resolve === 'function') return fileURLToPath(import.meta.resolve(spec));
  } catch {
    /* fall through to require-style resolution */
  }
  try {
    return createRequire(import.meta.url).resolve(spec);
  } catch {
    return undefined;
  }
}

/** Resolve a file inside a workspace package, even when the file does not exist yet. */
function packageFile(pkg: string, file: string): string | undefined {
  const direct = resolveSpecifier(`${pkg}/${file}`);
  if (direct) return direct;
  const manifest = resolveSpecifier(`${pkg}/package.json`);
  return manifest ? join(dirname(manifest), file) : undefined;
}

export function runtimeBundlePath(): string | undefined {
  return packageFile('@marco/runtime', 'dist/marco-runtime.js');
}

export function designSystemDistDir(): string | undefined {
  const css = packageFile('@marco/design-system', 'dist/marco.css');
  return css ? dirname(css) : undefined;
}
