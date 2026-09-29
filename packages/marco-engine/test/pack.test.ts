/**
 * End-to-end check of the npm package: `npm pack` dist/, install the tarball into a temporary
 * global prefix (dependencies come from the registry), then run `marco` from a scratch directory
 * outside the repository, exactly as a user without the engine source would, and open the decks
 * in headless Chromium.
 *
 * Skipped when the registry is unreachable (`npm ping`), on Windows, or with MARCO_PACK_TEST=0.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATTRIBUTION, DIST, ROOT, readJson, readText, type PublishedManifest } from './helpers.js';

const MINUTE = 60_000;

const REFERENCE_DECK = join(ROOT, 'reference', 'decks', 'week03-iam-v20.stripped.html');

function npmOnline(): boolean {
  if (process.env.MARCO_PACK_TEST === '0' || process.platform === 'win32') return false;
  const r = spawnSync('npm', ['ping', '--fetch-retries=0', '--fetch-timeout=15000'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  return r.status === 0;
}

const online = npmOnline();
if (!online) console.warn('marco-engine pack test skipped: npm registry unreachable (npm ping)');

/** A small many-colour RGB PNG (sharp turns it into WebP; without sharp it stays PNG). */
function gradientPng(w = 64, h = 48): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(0);
    for (let x = 0; x < w; x++) rows.push((x * 4) % 256, (y * 5) % 256, ((x + y) * 3) % 256);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe.skipIf(!online)('npm package (pack → install → run)', () => {
  const manifest = readJson<PublishedManifest>(join(DIST, 'package.json'));
  let tmp = '';
  let prefix = '';
  let work = '';
  let pkgDir = '';

  /** Run a bin of the installed package in the scratch directory. */
  function run(bin: string, args: string[], timeout = 2 * MINUTE) {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
    delete env.NODE_PATH;
    delete env.NODE_OPTIONS;
    delete env.FORCE_COLOR;
    const r = spawnSync(join(prefix, 'bin', bin), args, {
      cwd: work,
      env,
      encoding: 'utf8',
      timeout,
    });
    return {
      code: r.status,
      out: r.stdout ?? '',
      err: r.stderr ?? '',
      all: `${r.stdout}${r.stderr}`,
    };
  }
  const marco = (...args: string[]) => run('marco', args);

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'marco-pack-'));
    prefix = join(tmp, 'prefix');
    work = join(tmp, 'work');
    mkdirSync(work, { recursive: true });
    const packed = JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', tmp], {
        cwd: DIST,
        encoding: 'utf8',
      }),
    ) as { filename: string; unpackedSize: number }[];
    const info = packed[0];
    if (!info) throw new Error('npm pack printed nothing');
    expect(info.filename).toBe(`marco-engine-${manifest.version}.tgz`);
    expect(info.unpackedSize).toBeLessThan(25 * 1024 * 1024);
    execFileSync(
      'npm',
      ['install', '-g', '--prefix', prefix, '--no-audit', '--no-fund', join(tmp, info.filename)],
      { cwd: tmp, encoding: 'utf8', stdio: 'pipe', timeout: 8 * MINUTE },
    );
    pkgDir = join(prefix, 'lib', 'node_modules', 'marco-engine');
  }, 10 * MINUTE);

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  /** The built deck inlines the packaged runtime and CSS and keeps the attribution. */
  function expectPackagedDeck(html: string): void {
    const inline = (js: string) =>
      `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
    const runtime = ['marco-runtime.js', 'marco-runtime.all.js'].map((f) =>
      readText(join(pkgDir, 'assets', 'runtime', f)),
    );
    expect(runtime.some((js) => html.includes(inline(js)))).toBe(true);
    expect(html).toContain(readText(join(pkgDir, 'assets', 'css', 'marco.nofonts.css')));
    expect(html).toMatch(/@font-face\{font-family:"?Pretendard"?;[^}]*data:font\/woff2;base64,/);
    expect(html).toContain(ATTRIBUTION);
    expect(html).toContain(`MARCO Engine v${manifest.version}`);
    expect(html).not.toContain('MARCO PLACEHOLDER');
  }

  it('installs the bins and reports the package version', () => {
    for (const bin of ['marco', 'marco-engine']) {
      const r = run(bin, ['--version']);
      expect(r.code, r.all).toBe(0);
      expect(r.out.trim()).toBe(manifest.version);
    }
    expect(existsSync(join(prefix, 'bin', 'marco-mcp'))).toBe(true);
    for (const file of ['LICENSE', 'NOTICE', 'README.md'])
      expect(existsSync(join(pkgDir, file)), file).toBe(true);
    execFileSync(process.execPath, ['--check', join(pkgDir, 'bin', 'marco-mcp.js')]);
  });

  it('new → build → lint', () => {
    let r = marco(
      'new',
      'week06',
      '--title',
      '6주차 · IDS/IPS',
      '--course',
      '보안시스템 운영 및 활용',
      '--week',
      '6',
    );
    expect(r.code, r.all).toBe(0);
    expect(existsSync(join(work, 'week06', 'lecture.marco.md'))).toBe(true);
    expect(readText(join(work, 'week06', 'lecture.marco.md'))).toContain('6주차 · IDS/IPS');

    r = marco('build', 'week06/lecture.marco.md');
    expect(r.code, r.all).toBe(0);
    expect(r.all).not.toContain('build.runtime.missing');
    expect(r.all).not.toContain('build.css.missing');
    expectPackagedDeck(readText(join(work, 'week06', 'lecture.html')));

    r = marco('lint', 'week06/lecture.marco.md');
    expect(r.code, r.all).toBe(0);
    expect(r.all).toContain('오류 0');
  });

  it('ai kit writes the packaged prompt kit', () => {
    const r = marco('ai', 'kit', '-o', 'kit');
    expect(r.code, r.all).toBe(0);
    expect(readText(join(work, 'kit', 'MARCO-작성-안내.md'))).toBe(
      readText(join(pkgDir, 'assets', 'kit', 'MARCO-작성-안내.md')),
    );
  });

  it.skipIf(!existsSync(REFERENCE_DECK))('import a legacy deck → build', () => {
    let r = marco('import', REFERENCE_DECK, 'w03');
    expect(r.code, r.all).toBe(0);
    r = marco('build', 'w03/lecture.marco.md');
    expect(r.code, r.all).toBe(0);
    expectPackagedDeck(readText(join(work, 'w03', 'lecture.html')));
  });

  it(
    'decks render in headless Chromium without console errors',
    async (ctx) => {
      const { chromium } = await import('@playwright/test');
      let browser;
      try {
        browser = await chromium.launch();
      } catch (e) {
        ctx.skip(`Chromium is not installed: ${(e as Error).message.split('\n')[0]}`);
        return;
      }
      try {
        const decks = ['week06', 'w03']
          .map((d) => join(work, d, 'lecture.html'))
          .filter((f) => existsSync(f));
        expect(decks.length).toBeGreaterThan(0);
        for (const file of decks) {
          const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
          const errors: string[] = [];
          page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
          });
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(pathToFileURL(file).href);
          await page.waitForFunction(
            `document.documentElement.getAttribute('data-marco') === 'ready' && typeof window.MARCO === 'object'`,
            undefined,
            { timeout: 30_000 },
          );
          const slides = await page.evaluate<number>(
            `document.querySelectorAll('section.slide').length`,
          );
          expect(slides, file).toBeGreaterThan(0);
          expect(errors, file).toEqual([]);
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    2 * MINUTE,
  );

  it('images are embedded as-is when sharp is missing, optimised when it is present', () => {
    writeFileSync(join(work, 'week06', 'assets', 'gradient.png'), gradientPng());
    appendFileSync(
      join(work, 'week06', 'lecture.marco.md'),
      '\n# slide\ntag: 그림\ngroup: 도입\ntitle: 그림 한 장\n\n![그라데이션](assets/gradient.png "그라데이션")\n',
    );
    const sharp = join(pkgDir, 'node_modules', 'sharp');
    const hasSharp = existsSync(sharp);
    if (hasSharp) renameSync(sharp, `${sharp}.off`);
    try {
      const r = marco('build', 'week06/lecture.marco.md', '-o', 'week06/nosharp.html');
      expect(r.code, r.all).toBe(0);
      expect(r.all).toContain('asset.sharp');
      expect(readText(join(work, 'week06', 'nosharp.html'))).toContain('data:image/png;base64,');
    } finally {
      if (hasSharp) renameSync(`${sharp}.off`, sharp);
    }
    if (!hasSharp) return; // the optional dependency could not be installed on this platform
    const r = marco('build', 'week06/lecture.marco.md', '-o', 'week06/sharp.html');
    expect(r.code, r.all).toBe(0);
    expect(r.all).not.toContain('asset.sharp');
    expect(readText(join(work, 'week06', 'sharp.html'))).toContain('data:image/webp;base64,');
  });

  /**
   * Start an installed bin as an MCP server over stdio with the MCP SDK's client (the SDK comes
   * from packages/mcp's dependencies), list its tools and read every resource: the spec, schema
   * and prompt kit must come from the packaged assets. Returns the tool names.
   */
  async function mcpSession(bin: string, args: string[]): Promise<string[]> {
    const { Client } =
      await import('../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js');
    const { StdioClientTransport } =
      await import('../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js');
    const transport = new StdioClientTransport({
      command: join(prefix, 'bin', bin),
      args,
      cwd: work,
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    const client = new Client({ name: 'marco-engine-pack-test', version: '0' });
    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.version, stderr).toBe(manifest.version);
      const { tools } = await client.listTools();
      expect(tools.length, stderr).toBeGreaterThan(0);
      if (client.getServerCapabilities()?.resources) {
        const { resources } = await client.listResources();
        for (const { uri } of resources) {
          const { contents } = await client.readResource({ uri });
          expect(
            contents.some((c) => 'text' in c && typeof c.text === 'string' && c.text.length > 0),
            uri,
          ).toBe(true);
        }
      }
      return tools.map((t) => t.name);
    } finally {
      await client.close();
    }
  }

  it('marco-mcp serves the engine over stdio (MCP SDK client)', async () => {
    const script = readText(join(pkgDir, 'bin', 'marco-mcp.js'));
    expect(script, 'bin/marco-mcp.js is the stub').not.toContain('does not include the MCP server');
    const version = run('marco-mcp', ['--version']);
    expect(version.code, version.all).toBe(0);
    expect(version.out.trim()).toBe(manifest.version);
    const tools = await mcpSession('marco-mcp', ['--root', work, '--read-only']);
    expect(tools).toEqual(expect.arrayContaining(['marco_build', 'marco_lint', 'marco_new']));
    console.info(`marco-mcp tools: ${tools.join(', ')}`);
  });

  it('marco mcp runs the same server from the CLI bundle', async () => {
    const tools = await mcpSession('marco', ['mcp', '--root', work, '--read-only']);
    expect(tools).toEqual(expect.arrayContaining(['marco_build', 'marco_lint', 'marco_new']));
  });

  it('pdf without Playwright explains how to install it', () => {
    const r = marco('pdf', 'week06/lecture.html');
    expect(r.code).toBe(1);
    expect(r.err).toContain('Playwright를 찾을 수 없습니다');
    expect(r.err).toContain('npm i -g marco-engine playwright');
    expect(r.err).not.toMatch(/\n\s+at /); // no stack trace
  });
});
