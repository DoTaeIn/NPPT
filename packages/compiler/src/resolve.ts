/**
 * Locations of the sibling build outputs the compiler inlines: a runtime bundle from
 * `@marco/runtime/dist/` (`manifest.json` names them: `core` = marco-runtime.js, `all` =
 * marco-runtime.all.js) and `@marco/design-system/dist/{marco.css,marco.nofonts.css,fonts/}`.
 */
import { readFileSync } from 'node:fs';
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

/** `core`: runtime only (decks without widgets) · `all`: runtime plus every plugin. */
export type RuntimeBundle = 'core' | 'all';

/** Bundle file names when the runtime dist has no manifest.json. */
export const RUNTIME_BUNDLE_FILES: Readonly<Record<RuntimeBundle, string>> = {
  core: 'marco-runtime.js',
  all: 'marco-runtime.all.js',
};

/** `@marco/runtime/dist/manifest.json`. */
export interface RuntimeManifest {
  version?: string;
  core?: string;
  all?: string;
  /** Widget name → standalone plugin bundle, relative to the dist directory. */
  plugins?: Record<string, string>;
}

/** The `@marco/runtime` dist directory (it may not be built yet). */
export function runtimeDistDir(): string | undefined {
  const core = packageFile('@marco/runtime', `dist/${RUNTIME_BUNDLE_FILES.core}`);
  return core ? dirname(core) : undefined;
}

export function readRuntimeManifest(dir: string): RuntimeManifest | undefined {
  try {
    const m: unknown = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    return typeof m === 'object' && m !== null ? (m as RuntimeManifest) : undefined;
  } catch {
    return undefined;
  }
}

/** File name of a bundle inside the runtime dist: from manifest.json, else the default name. */
export function runtimeBundleFile(bundle: RuntimeBundle, dir = runtimeDistDir()): string {
  const named = dir !== undefined ? readRuntimeManifest(dir)?.[bundle] : undefined;
  return typeof named === 'string' && /^[\w./-]+\.js$/.test(named) && !named.includes('..')
    ? named
    : RUNTIME_BUNDLE_FILES[bundle];
}

export function runtimeBundlePath(
  bundle: RuntimeBundle = 'core',
  dir = runtimeDistDir(),
): string | undefined {
  return dir !== undefined ? join(dir, runtimeBundleFile(bundle, dir)) : undefined;
}

export function designSystemDistDir(): string | undefined {
  const css = packageFile('@marco/design-system', 'dist/marco.css');
  return css ? dirname(css) : undefined;
}
