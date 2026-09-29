/**
 * Asset locations of the published `marco-engine` package.
 *
 * In the workspace the compiler finds the runtime and design-system builds by resolving
 * `@marco/runtime` and `@marco/design-system`. The npm package bundles every `@marco/*` package
 * into `bin/*.js` and ships those builds under `assets/` instead:
 *
 *   bin/marco.js, bin/marco-mcp.js
 *   assets/runtime/   runtime dist (manifest.json, marco-runtime.js, marco-runtime.all.js, plugins/)
 *   assets/css/       design-system dist (marco.css, marco.nofonts.css, fonts/)
 *   assets/kit/       prompt kit (build.mjs points @marco/ai's default prompt folder here)
 *   assets/templates/ `marco new` templates (build.mjs points the CLI here)
 *   assets/spec/      docs/spec/*.md
 *
 * so each entry point tells the compiler (and the MCP server) where they are before starting.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetRootsIn, setAssetRoots } from '../../compiler/src/resolve.js';

/** `<package>/assets/` for a module in `<package>/bin/`. */
export function packagedAssetsDir(moduleUrl: string): string {
  return fileURLToPath(new URL('../assets/', moduleUrl));
}

/**
 * Point the compiler at the packaged runtime and CSS, and the MCP server at the packaged spec and
 * prompt kit (its documented MARCO_SPEC_DIR / MARCO_KIT_DIR overrides, unless the user set them).
 * Returns the assets directory.
 */
export function usePackagedAssets(moduleUrl: string): string {
  const dir = packagedAssetsDir(moduleUrl);
  setAssetRoots(assetRootsIn(dir));
  process.env.MARCO_SPEC_DIR ||= join(dir, 'spec');
  process.env.MARCO_KIT_DIR ||= join(dir, 'kit');
  return dir;
}
