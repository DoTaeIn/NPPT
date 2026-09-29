import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMarcoServer, loadChromium } from '../src/index.js';

/** Chromium is usable when Playwright loads and its browser executable exists. */
async function chromiumAvailable(): Promise<boolean> {
  const chromium = (await loadChromium()) as { executablePath?: () => string } | undefined;
  try {
    const path = chromium?.executablePath?.();
    return path !== undefined && existsSync(path);
  } catch {
    return false;
  }
}
const hasChromium = await chromiumAvailable();

describe.runIf(hasChromium)('marco_preview (Playwright Chromium)', () => {
  const root = mkdtempSync(join(tmpdir(), 'marco-mcp-preview-'));
  const client = new Client({ name: 'marco-preview-test', version: '0.0.0' });
  beforeAll(async () => {
    const { server } = createMarcoServer({ root });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    await client.callTool({ name: 'marco_new', arguments: { dir: 'deck', title: '미리보기' } });
  });
  afterAll(async () => {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('builds the source and returns a PNG of one slide', async () => {
    const r = (await client.callTool({
      name: 'marco_preview',
      arguments: { source_path: 'deck/lecture.marco.md', slide: 2 },
    })) as CallToolResult;
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent as { png_path: string; slide_id: string; slides: number };
    expect(s.slide_id).toBe('s-02');
    expect(s.slides).toBe(4);
    const png = readFileSync(s.png_path);
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1920);
    expect(png.readUInt32BE(20)).toBe(1080);
    expect(r.content.some((c) => c.type === 'image')).toBe(true);
    expect(existsSync(join(root, 'deck', 'lecture.html'))).toBe(true);
  }, 90_000);

  it('rejects a slide number past the end', async () => {
    const r = (await client.callTool({
      name: 'marco_preview',
      arguments: { source_path: 'deck/lecture.html', slide: 9, out_png: 'shots/nine.png' },
    })) as CallToolResult;
    expect(r.isError).toBe(true);
    expect((r.content[0] as { text: string }).text).toMatch(/4 slides/);
  }, 60_000);
});
