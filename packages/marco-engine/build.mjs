#!/usr/bin/env node
/**
 * Assembles the published `marco-engine` npm package in packages/marco-engine/dist/ so the engine
 * runs with `npx marco-engine …` / `npm i -g marco-engine` from nothing but Node and npm:
 *
 *   dist/package.json         generated: version from the root package.json; dependencies are the
 *                             third-party modules the bundles import, with the version ranges the
 *                             workspace manifests declare (so they never drift)
 *   dist/bin/marco.js         src/entry.ts + apps/cli + every @marco/* package, one ESM file
 *   dist/bin/marco-mcp.js     src/mcp-entry.ts + packages/mcp (a stub when mcp is not built)
 *   dist/assets/runtime/      packages/runtime/dist (manifest.json, bundles, plugins/)
 *   dist/assets/css/          packages/design-system/dist (marco.css, marco.nofonts.css, fonts/)
 *   dist/assets/kit/          packages/ai/dist/kit (the prompt kit)
 *   dist/assets/templates/    apps/cli/templates (`marco new`)
 *   dist/assets/schema/       packages/schema/lecture.schema.json
 *   dist/assets/spec/         docs/spec/*.md
 *   dist/assets/skill/marco/  skills/marco (the agent skill, when present)
 *   dist/README.md, LICENSE, NOTICE
 *
 * The bundles find their files next to themselves (import.meta.url), never through
 * `import.meta.resolve('@marco/…')`: the entry wrappers call the compiler's `setAssetRoots()`,
 * and the two `new URL(…, import.meta.url)` paths in @marco/ai and apps/cli are relocated to
 * assets/ while bundling (REWRITES). Any other import.meta path fails the audit below.
 *
 * Usage: node build.mjs [--strict] [--pack] [--pack-destination <dir>]
 *   --strict  fail when a prerequisite build output is missing or the audit finds a path it
 *             cannot relocate. Without it both only warn, and a missing prerequisite skips the
 *             build: `pnpm build` runs every package's build and may reach this one before the
 *             packages it copies are built.
 *   --pack    run `npm pack` in dist/ afterwards; the tarball goes next to this file (or to
 *             --pack-destination).
 */
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { isBuiltin } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(HERE, 'dist');
const MAX_UNPACKED = 25 * 1024 * 1024;

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict') || process.env.MARCO_ENGINE_STRICT === '1';
const PACK = argv.includes('--pack');
const packDestIndex = argv.indexOf('--pack-destination');
const PACK_DEST = packDestIndex >= 0 ? resolve(argv[packDestIndex + 1] ?? HERE) : HERE;

const rel = (path) => relative(ROOT, path).split(sep).join('/');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const log = (line = '') => process.stdout.write(`${line}\n`);
const warn = (line) => process.stderr.write(`marco-engine: ${line}\n`);

/** Required build outputs and sources, relative to the repository root. */
const INPUTS = {
  cli: 'apps/cli/src/main.ts',
  runtime: 'packages/runtime/dist',
  css: 'packages/design-system/dist',
  kit: 'packages/ai/dist/kit',
  templates: 'apps/cli/templates',
  schema: 'packages/schema/lecture.schema.json',
  spec: 'docs/spec',
  mcpDist: 'packages/mcp/dist/main.js',
  mcpSrc: 'packages/mcp/src/main.ts',
  skill: 'skills/marco',
};

/**
 * Asset paths written relative to a module's own file. In the bundle every module shares
 * bin/marco.js as its location, so these are pointed at the packaged copies. A rewrite that no
 * longer matches its source fails the build: update it together with the source.
 */
const REWRITES = {
  'apps/cli/src/commands/new.ts': [
    ["new URL('../../templates/', import.meta.url)", "new URL('../assets/templates/', import.meta.url)"],
  ],
  'packages/ai/src/prompts.ts': [
    ["new URL('../prompts/', import.meta.url)", "new URL('../assets/kit/', import.meta.url)"],
  ],
};

/** import.meta uses that are correct in the bundle. */
const SAFE_IMPORT_META = [
  // Resolves npm dependencies (lucide-static, Playwright) from bin/, i.e. the package's node_modules.
  /createRequire\(import\.meta\.url\)/g,
  // Relocated by REWRITES.
  /new URL\('\.\.\/assets\/[^']*', import\.meta\.url\)/g,
  // packages/compiler/src/version.ts: bin/../package.json is the published package.json.
  /new URL\('\.\.\/package\.json', import\.meta\.url\)/g,
  // src/entry.ts, src/mcp-entry.ts: bin/../assets/.
  /usePackagedAssets\(import\.meta\.url\)/g,
];
/** import.meta uses that are safe in one file only. */
const SAFE_IMPORT_META_IN = {
  // Package resolution, bypassed by setAssetRoots() (src/assets.ts).
  'packages/compiler/src/resolve.ts': [/import\.meta\.resolve/g],
  // Spec lookup candidates; src/assets.ts sets MARCO_SPEC_DIR / MARCO_KIT_DIR, which come first.
  'packages/mcp/src/resources.ts': [/new URL\(rel, import\.meta\.url\)/g],
};

/** Dependency policy for the published manifest. */
const OPTIONAL_DEPENDENCIES = new Set(['sharp']);
const PEER_DEPENDENCIES = { '@playwright/test': '>=1.40.0' };

// ---------------------------------------------------------------------------------------------

function missingInputs() {
  const missing = [];
  const need = (path, what) => {
    if (!existsSync(join(ROOT, path))) missing.push(`${path} (${what})`);
  };
  need(INPUTS.cli, 'CLI source');
  need(join(INPUTS.runtime, 'manifest.json'), 'pnpm --filter @marco/runtime build');
  const manifestPath = join(ROOT, INPUTS.runtime, 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    for (const file of [manifest.core, manifest.all, ...Object.values(manifest.plugins ?? {})]) {
      if (typeof file === 'string')
        need(join(INPUTS.runtime, file), 'pnpm --filter @marco/runtime build');
    }
  }
  for (const file of ['marco.css', 'marco.nofonts.css', 'fonts/fonts.json'])
    need(join(INPUTS.css, file), 'pnpm --filter @marco/design-system build');
  need(join(INPUTS.kit, 'MARCO-작성-안내.md'), 'pnpm --filter @marco/ai build');
  need(join(INPUTS.templates, 'lecture.marco.md'), 'CLI template');
  need(INPUTS.schema, 'schema');
  need(INPUTS.spec, 'spec docs');
  need('LICENSE', 'license');
  need('NOTICE', 'notice');
  return missing;
}

/** `name` → package directory for every workspace package (packages/*, apps/*). */
function workspacePackages() {
  const map = new Map();
  for (const group of ['packages', 'apps']) {
    for (const name of readdirSync(join(ROOT, group))) {
      const manifest = join(ROOT, group, name, 'package.json');
      if (existsSync(manifest)) map.set(readJson(manifest).name, dirname(manifest));
    }
  }
  return map;
}

/** Version ranges the workspace declares for third-party packages (highest lower bound wins). */
function declaredRanges(workspace) {
  const ranges = new Map();
  const floor = (range) => (/(\d+)\.(\d+)\.(\d+)/.exec(range) ?? [0, 0, 0, 0]).slice(1).map(Number);
  const newer = (a, b) => {
    const [x, y] = [floor(a), floor(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };
  for (const dir of workspace.values()) {
    const manifest = readJson(join(dir, 'package.json'));
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        if (String(range).startsWith('workspace:')) continue;
        const known = ranges.get(name);
        if (known === undefined || newer(range, known)) ranges.set(name, range);
      }
    }
  }
  return ranges;
}

const packageName = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

/**
 * esbuild plugin: `@marco/*` → the package's TypeScript source (inlined), every other bare
 * import → external (a dependency of the published package); applies REWRITES and audits
 * import.meta.
 */
function workspacePlugin(workspace, report) {
  return {
    name: 'marco-workspace',
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (isBuiltin(args.path)) return { path: args.path, external: true };
        const m = /^(@marco\/[^/]+)(\/.+)?$/.exec(args.path);
        if (m) {
          const dir = workspace.get(m[1]);
          if (!dir || m[2]) return { errors: [{ text: `cannot inline ${args.path}` }] };
          return { path: join(dir, 'src', 'index.ts') };
        }
        return { path: args.path, external: true };
      });
      build.onLoad({ filter: /\.[cm]?[jt]s$/ }, (args) => {
        const file = rel(args.path);
        let text = readFileSync(args.path, 'utf8');
        for (const [from, to] of REWRITES[file] ?? []) {
          if (!text.includes(from))
            return { errors: [{ text: `${file}: expected \`${from}\` (update REWRITES in build.mjs)` }] };
          text = text.split(from).join(to);
          report.rewritten.add(file);
        }
        text.split('\n').forEach((line, i) => {
          const code = line.trim();
          if (!code.includes('import.meta') || /^(\/\/|\/\*|\*)/.test(code)) return;
          for (const m of code.matchAll(/createRequire\(import\.meta\.url\)\.resolve\('([^'.][^']*)'\)/g))
            if (!m[1].startsWith('@marco/')) report.resolved.add(packageName(m[1]));
          const safe = [...SAFE_IMPORT_META, ...(SAFE_IMPORT_META_IN[file] ?? [])];
          const rest = safe.reduce((s, re) => s.replace(re, ''), code);
          if (rest.includes('import.meta')) report.unsafe.push(`${file}:${i + 1}: ${code}`);
        });
        return { contents: text, loader: args.path.endsWith('ts') ? 'ts' : 'js' };
      });
    },
  };
}

async function bundle(entry, outfile, workspace, banner) {
  const report = { rewritten: new Set(), resolved: new Set(), unsafe: [] };
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    charset: 'utf8',
    banner: { js: banner },
    metafile: true,
    logLevel: 'warning',
    plugins: [workspacePlugin(workspace, report)],
  });
  chmodSync(outfile, 0o755);
  const imports = Object.values(result.metafile.outputs).flatMap((o) => o.imports);
  const external = new Set(
    imports.filter((i) => i.external && !isBuiltin(i.path)).map((i) => packageName(i.path)),
  );
  for (const name of report.resolved) external.add(name);
  const inlined = new Set(
    Object.keys(result.metafile.inputs)
      .map((p) => /^(packages|apps)\/([^/]+)\//.exec(p)?.slice(1).join('/'))
      .filter(Boolean),
  );
  return { external, inlined, ...report };
}

function copyDir(from, to, filter = () => true) {
  cpSync(from, to, { recursive: true, filter: (src) => filter(src) });
}

function sizeOf(path) {
  const st = statSync(path);
  if (!st.isDirectory()) return st.size;
  return readdirSync(path).reduce((sum, name) => sum + sizeOf(join(path, name)), 0);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const kb = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : mb(n));

// ---------------------------------------------------------------------------------------------

async function main() {
  const missing = missingInputs();
  if (missing.length) {
    const msg = `prerequisites are not built yet:\n  ${missing.join('\n  ')}\nRun \`pnpm build\` first, then \`pnpm --filter marco-engine build\` (or \`pnpm dist\`).`;
    if (STRICT) throw new Error(msg);
    warn(`${msg}\nSkipped; dist/ left as it was.`);
    return;
  }

  const rootManifest = readJson(join(ROOT, 'package.json'));
  const harness = readJson(join(HERE, 'package.json'));
  const version = rootManifest.version;
  const workspace = workspacePackages();
  const ranges = declaredRanges(workspace);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'bin'), { recursive: true });

  const attribution =
    'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco';
  const banner = (what) =>
    `#!/usr/bin/env node\n// marco-engine v${version} · ${what} · MARCO Engine License 1.0 (see LICENSE and NOTICE)\n// ${attribution}`;

  // 1. Bundles.
  const cli = await bundle(
    join(HERE, 'src', 'entry.ts'),
    join(OUT, 'bin', 'marco.js'),
    workspace,
    banner('marco CLI'),
  );
  const bundles = [cli];
  let mcpBundled = false;
  if (existsSync(join(ROOT, INPUTS.mcpDist)) && existsSync(join(ROOT, INPUTS.mcpSrc))) {
    bundles.push(
      await bundle(
        join(HERE, 'src', 'mcp-entry.ts'),
        join(OUT, 'bin', 'marco-mcp.js'),
        workspace,
        banner('marco-mcp MCP server'),
      ),
    );
    mcpBundled = true;
  } else {
    warn(`${INPUTS.mcpDist} not found: bin/marco-mcp.js is a stub. Rebuild after packages/mcp.`);
    writeFileSync(
      join(OUT, 'bin', 'marco-mcp.js'),
      `${banner('marco-mcp stub')}\nprocess.stderr.write('marco-mcp: this marco-engine ${version} build does not include the MCP server (packages/mcp was not built when the package was assembled). Use the marco CLI, or install a release that ships marco-mcp.\\n');\nprocess.exitCode = 1;\n`,
    );
    chmodSync(join(OUT, 'bin', 'marco-mcp.js'), 0o755);
  }
  const unsafe = bundles.flatMap((b) => b.unsafe);
  if (unsafe.length) {
    const msg = `import.meta paths the bundle cannot relocate (add a REWRITE or use the packaged asset roots):\n  ${unsafe.join('\n  ')}`;
    if (STRICT) throw new Error(msg);
    warn(msg);
  }
  const missingRewrites = Object.keys(REWRITES).filter((f) => !cli.rewritten.has(f));
  if (missingRewrites.length)
    throw new Error(`REWRITES were not applied (module not bundled?): ${missingRewrites.join(', ')}`);

  // 2. Dependencies from what the bundles import.
  const external = new Set(bundles.flatMap((b) => [...b.external]));
  const dependencies = {};
  const optionalDependencies = {};
  const undeclared = [];
  for (const name of [...external].sort()) {
    const range = ranges.get(name);
    if (name in PEER_DEPENDENCIES) continue;
    if (range === undefined) undeclared.push(name);
    else if (OPTIONAL_DEPENDENCIES.has(name)) optionalDependencies[name] = range;
    else dependencies[name] = range;
  }
  if (undeclared.length)
    throw new Error(
      `bundled code imports packages no workspace manifest declares: ${undeclared.join(', ')}`,
    );

  // 3. Assets.
  const assets = join(OUT, 'assets');
  const src = (path) => join(ROOT, path);
  copyDir(src(INPUTS.runtime), join(assets, 'runtime'), (p) => !/\.map$|\.debug\.js$/.test(p));
  mkdirSync(join(assets, 'css'), { recursive: true });
  for (const file of ['marco.css', 'marco.nofonts.css'])
    copyFileSync(join(src(INPUTS.css), file), join(assets, 'css', file));
  copyDir(join(src(INPUTS.css), 'fonts'), join(assets, 'css', 'fonts'));
  copyDir(src(INPUTS.kit), join(assets, 'kit'));
  copyDir(src(INPUTS.templates), join(assets, 'templates'));
  mkdirSync(join(assets, 'schema'), { recursive: true });
  copyFileSync(src(INPUTS.schema), join(assets, 'schema', 'lecture.schema.json'));
  copyDir(src(INPUTS.spec), join(assets, 'spec'), (p) => statSync(p).isDirectory() || p.endsWith('.md'));
  const skill = existsSync(join(src(INPUTS.skill), 'SKILL.md'));
  if (skill) copyDir(src(INPUTS.skill), join(assets, 'skill', 'marco'));
  else warn(`${INPUTS.skill}/SKILL.md not found: the package ships no agent skill.`);

  // 4. Top-level files and the published manifest.
  copyFileSync(join(ROOT, 'LICENSE'), join(OUT, 'LICENSE'));
  writeFileSync(
    join(OUT, 'NOTICE'),
    `${readFileSync(join(ROOT, 'NOTICE'), 'utf8').trimEnd()}\n\n` +
      'This package also contains the Pretendard and Spoqa Han Sans fonts, licensed under the\n' +
      'SIL Open Font License 1.1 (assets/css/fonts/OFL.txt, also embedded in assets/css/marco.css).\n',
  );
  copyFileSync(join(HERE, 'README.md'), join(OUT, 'README.md'));
  const manifest = {
    name: 'marco-engine',
    version,
    description: harness.description,
    keywords: harness.keywords,
    license: 'SEE LICENSE IN LICENSE',
    author: 'DoTaeIn',
    homepage: 'https://github.com/DoTaeIn/NPPT#readme',
    repository: {
      type: 'git',
      url: 'git+https://github.com/DoTaeIn/NPPT.git',
      directory: 'packages/marco-engine',
    },
    bugs: { url: 'https://github.com/DoTaeIn/NPPT/issues' },
    type: 'module',
    bin: {
      marco: 'bin/marco.js',
      'marco-engine': 'bin/marco.js',
      'marco-mcp': 'bin/marco-mcp.js',
    },
    files: ['bin', 'assets'],
    engines: rootManifest.engines ?? { node: '>=20' },
    dependencies,
    optionalDependencies,
    peerDependencies: PEER_DEPENDENCIES,
    peerDependenciesMeta: Object.fromEntries(
      Object.keys(PEER_DEPENDENCIES).map((name) => [name, { optional: true }]),
    ),
    publishConfig: { access: 'public' },
  };
  writeFileSync(join(OUT, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // 5. Report.
  const total = sizeOf(OUT);
  log(`marco-engine ${version} → ${rel(OUT)}/`);
  log(`  inlined     ${[...new Set(bundles.flatMap((b) => [...b.inlined]))].sort().join(', ')}`);
  log(`  mcp         ${mcpBundled ? 'bundled from packages/mcp' : 'stub (packages/mcp not built)'}`);
  log(`  skill       ${skill ? 'assets/skill/marco' : '—'}`);
  log(`  deps        ${Object.entries(dependencies).map(([n, r]) => `${n}@${r}`).join(', ')}`);
  log(`  optional    ${Object.entries(optionalDependencies).map(([n, r]) => `${n}@${r}`).join(', ') || '—'}`);
  log(`  peer (opt.) ${Object.entries(PEER_DEPENDENCIES).map(([n, r]) => `${n}@${r}`).join(', ')}`);
  const rows = [
    'bin/marco.js',
    'bin/marco-mcp.js',
    ...readdirSync(assets).map((d) => `assets/${d}`),
    'LICENSE',
    'NOTICE',
    'README.md',
    'package.json',
  ];
  for (const row of rows) log(`  ${row.padEnd(22)} ${kb(sizeOf(join(OUT, row))).padStart(10)}`);
  log(`  ${'total (unpacked)'.padEnd(22)} ${mb(total).padStart(10)}`);
  if (total > MAX_UNPACKED) {
    const msg = `unpacked size ${mb(total)} exceeds ${mb(MAX_UNPACKED)}`;
    if (STRICT) throw new Error(msg);
    warn(msg);
  }

  // 6. Tarball.
  if (PACK) {
    mkdirSync(PACK_DEST, { recursive: true });
    const out = execFileSync(
      'npm',
      ['pack', '--json', '--pack-destination', PACK_DEST],
      { cwd: OUT, encoding: 'utf8', shell: process.platform === 'win32' },
    );
    const [info] = JSON.parse(out);
    const tgz = join(PACK_DEST, info.filename);
    log(`packed ${rel(tgz).startsWith('..') ? tgz : rel(tgz)} · ${kb(info.size)} (unpacked ${mb(info.unpackedSize)}, ${info.entryCount} files)`);
    log(`  install: npm install -g ${tgz}`);
  }
}

main().catch((e) => {
  warn(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
