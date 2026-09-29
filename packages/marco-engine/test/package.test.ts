/**
 * Offline checks of the assembled package (dist/, built by test/setup.ts) and of the compiler's
 * packaged-asset options it relies on.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  assetRootsIn,
  compile,
  designSystemDistDir,
  getAssetRoots,
  runtimeDistDir,
  setAssetRoots,
} from '../../compiler/src/index.js';
import { DIST, ROOT, packageName, readJson, readText, type PublishedManifest } from './helpers.js';

const manifest = readJson<PublishedManifest>(join(DIST, 'package.json'));
const cli = readText(join(DIST, 'bin', 'marco.js'));

/** Bare specifiers the bundle imports (static and literal dynamic imports). */
function bundleImports(code: string): string[] {
  const specs = [
    ...code.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm),
    ...code.matchAll(/^import\s+"([^"]+)";/gm),
    ...code.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g),
  ].map((m) => m[1] ?? '');
  return [...new Set(specs.filter((s) => s && !s.startsWith('node:') && !s.startsWith('.')))];
}

describe('published manifest', () => {
  it('is named marco-engine with the root version and three bins', () => {
    const root = readJson<{ version: string }>(join(ROOT, 'package.json'));
    expect(manifest.name).toBe('marco-engine');
    expect(manifest.version).toBe(root.version);
    expect(manifest.bin).toEqual({
      marco: 'bin/marco.js',
      'marco-engine': 'bin/marco.js',
      'marco-mcp': 'bin/marco-mcp.js',
    });
    expect(manifest.files).toEqual(['bin', 'assets', 'NOTICE']);
    expect(manifest).not.toHaveProperty('private');
    expect(manifest).not.toHaveProperty('scripts');
    expect(manifest).not.toHaveProperty('devDependencies');
  });

  it('declares every third-party module the CLI bundle imports, with workspace ranges', () => {
    const cliManifest = readJson<{ dependencies: Record<string, string> }>(
      join(ROOT, 'apps', 'cli', 'package.json'),
    );
    const compilerManifest = readJson<{ dependencies: Record<string, string> }>(
      join(ROOT, 'packages', 'compiler', 'package.json'),
    );
    const declared = { ...manifest.dependencies, ...manifest.optionalDependencies };
    for (const spec of bundleImports(cli)) expect(declared).toHaveProperty(packageName(spec));
    expect(manifest.dependencies.commander).toBe(cliManifest.dependencies.commander);
    expect(manifest.dependencies['markdown-it']).toBe(compilerManifest.dependencies['markdown-it']);
    // Resolved at run time with createRequire, not imported.
    expect(manifest.dependencies['lucide-static']).toBe(
      compilerManifest.dependencies['lucide-static'],
    );
    expect(manifest.optionalDependencies).toEqual({
      sharp: compilerManifest.dependencies.sharp,
    });
    expect(manifest.dependencies).not.toHaveProperty('sharp');
    expect(manifest.peerDependencies).toHaveProperty('@playwright/test');
    expect(manifest.peerDependenciesMeta['@playwright/test']?.optional).toBe(true);
    expect(Object.keys(manifest.dependencies).some((d) => d.startsWith('@marco/'))).toBe(false);
  });
});

describe('bundles', () => {
  it('inline every @marco/* package', () => {
    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli.match(/^#!/gm)).toHaveLength(1);
    const mcp = readText(join(DIST, 'bin', 'marco-mcp.js'));
    for (const code of [cli, mcp]) {
      expect(bundleImports(code).filter((s) => s.startsWith('@marco/'))).toEqual([]);
      expect(code).not.toMatch(/\brequire\(\s*["']@marco\//);
    }
  });

  it('bin/marco-mcp.js is the real MCP server, not the stub', () => {
    const mcp = readText(join(DIST, 'bin', 'marco-mcp.js'));
    expect(mcp.match(/^#!/gm)).toHaveLength(1);
    expect(mcp).not.toContain('does not include the MCP server');
    expect(mcp).toContain('// packages/mcp/src/main.ts');
    expect(cli).toContain('// packages/mcp/src/index.ts'); // `marco mcp`
    const mcpManifest = readJson<{ dependencies: Record<string, string> }>(
      join(ROOT, 'packages', 'mcp', 'package.json'),
    );
    for (const dep of ['@modelcontextprotocol/sdk', 'zod'])
      expect(manifest.dependencies[dep], dep).toBe(mcpManifest.dependencies[dep]);
  });

  it('locate the kit and templates next to themselves', () => {
    expect(cli).toContain('new URL("../assets/kit/", import.meta.url)');
    expect(cli).toContain('new URL("../assets/templates/", import.meta.url)');
    expect(cli).not.toContain('"../../templates/"');
    expect(cli).not.toContain('"../prompts/"');
    expect(cli).toContain('usePackagedAssets(import.meta.url)');
  });
});

describe('assets', () => {
  const assets = join(DIST, 'assets');

  it('ship the runtime bundles named by the manifest', () => {
    const runtime = readJson<{ core: string; all: string; plugins: Record<string, string> }>(
      join(assets, 'runtime', 'manifest.json'),
    );
    for (const file of [runtime.core, runtime.all, ...Object.values(runtime.plugins)])
      expect(existsSync(join(assets, 'runtime', file)), file).toBe(true);
  });

  it('ship the CSS, fonts, kit, templates, schema, spec and notices', () => {
    for (const file of [
      'css/marco.css',
      'css/marco.nofonts.css',
      'css/fonts/fonts.json',
      'css/fonts/OFL.txt',
      'kit/MARCO-작성-안내.md',
      'kit/examples',
      'templates/lecture.marco.md',
      'templates/assets/README.md',
      'schema/lecture.schema.json',
      'spec/format.md',
    ])
      expect(existsSync(join(assets, file)), file).toBe(true);
    for (const file of ['LICENSE', 'NOTICE', 'README.md'])
      expect(existsSync(join(DIST, file)), file).toBe(true);
    expect(readText(join(DIST, 'NOTICE'))).toContain('Powered by MARCO — Created by DoTaeIn');
  });
});

describe('compiler asset roots (packaged builds)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marco-assets-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  afterEach(() => setAssetRoots({}));

  /** An assets/ directory with marker runtime and CSS. */
  const fake = join(tmp, 'assets');
  mkdirSync(join(fake, 'runtime'), { recursive: true });
  mkdirSync(join(fake, 'css'), { recursive: true });
  writeFileSync(
    join(fake, 'runtime', 'manifest.json'),
    JSON.stringify({ core: 'core.js', all: 'all.js', plugins: {} }),
  );
  writeFileSync(join(fake, 'runtime', 'core.js'), '/*PACKAGED CORE*/');
  writeFileSync(join(fake, 'css', 'marco.css'), '/*PACKAGED CSS*/');
  writeFileSync(join(fake, 'css', 'marco.nofonts.css'), '/*PACKAGED NOFONTS*/');
  const deck = join(tmp, 'deck.marco.md');
  writeFileSync(deck, '---\ntitle: 자산 위치\n---\n# slide\ntitle: 한 장\n\n본문\n');

  it('assetRootsIn names runtime/ and css/', () => {
    expect(assetRootsIn(fake)).toEqual({
      runtimeDir: join(fake, 'runtime'),
      designSystemDir: join(fake, 'css'),
    });
  });

  it('compile({ assetsDir }) reads the runtime and CSS from there', async () => {
    const r = await compile(deck, { assetsDir: fake, fonts: 'none' });
    expect(r.ok).toBe(true);
    expect(r.html).toContain('/*PACKAGED CORE*/');
    expect(r.html).toContain('/*PACKAGED NOFONTS*/');
    expect(r.warnings.map((w) => w.code)).not.toContain('build.runtime.missing');
  });

  it('setAssetRoots() changes the process-wide default until reset', async () => {
    const workspaceRuntime = runtimeDistDir();
    const workspaceCss = designSystemDistDir();
    setAssetRoots(assetRootsIn(fake));
    expect(getAssetRoots()).toEqual(assetRootsIn(fake));
    expect(runtimeDistDir()).toBe(join(fake, 'runtime'));
    expect(designSystemDistDir()).toBe(join(fake, 'css'));
    const r = await compile(deck, { fonts: 'embed' });
    expect(r.html).toContain('/*PACKAGED CORE*/');
    expect(r.html).toContain('/*PACKAGED CSS*/');
    setAssetRoots({});
    expect(getAssetRoots()).toEqual({});
    expect(runtimeDistDir()).toBe(workspaceRuntime);
    expect(designSystemDistDir()).toBe(workspaceCss);
  });

  it('explicit compile options still win over the roots', async () => {
    setAssetRoots({ runtimeDir: join(tmp, 'nowhere') });
    const r = await compile(deck, { runtimeDir: join(fake, 'runtime'), fonts: 'none' });
    expect(r.html).toContain('/*PACKAGED CORE*/');
  });
});
