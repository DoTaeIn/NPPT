import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/index.js';
import { fixture, PNG_1X1 } from './helpers.js';

describe('runImport', () => {
  const dir = mkdtempSync(join(tmpdir(), 'marco-import-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes source, decoded assets, manifest and report', async () => {
    const input = join(dir, 'deck.html');
    writeFileSync(input, fixture('v20-deck.html'));
    const out = join(dir, 'out');
    const { files, result } = await runImport(input, out);
    expect(files.sort()).toEqual(['IMPORT-REPORT.md', 'assets.manifest.json', 'assets/pix.png', 'lecture.marco.md']);
    expect(readFileSync(join(out, 'assets/pix.png')).equals(Buffer.from(PNG_1X1, 'base64'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(out, 'assets.manifest.json'), 'utf8')) as Record<string, unknown>[];
    expect(manifest).toEqual([
      {
        id: 'pix',
        fileName: 'pix.png',
        mime: 'image/png',
        bytes: Buffer.from(PNG_1X1, 'base64').length,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        title: '테스트 이미지',
        credit: '테스트 · 1×1',
        source: 'https://example.org/pix',
      },
    ]);
    const report = readFileSync(join(out, 'IMPORT-REPORT.md'), 'utf8');
    for (const heading of ['## Summary', '## Blocks by type', '## Unmapped markup', '## Validation', '## Notes']) expect(report).toContain(heading);
    expect(report).toContain('| `div.mystery-widget` | unmapped | 2 | s-03 |');
    expect(readFileSync(join(out, 'lecture.marco.md'), 'utf8')).toBe(result.source);
  });

  it('can leave an edited source alone', async () => {
    const input = join(dir, 'deck.html');
    const out = join(dir, 'keep');
    const { files } = await runImport(input, out, { writeSource: false });
    expect(files).not.toContain('lecture.marco.md');
  });
});
