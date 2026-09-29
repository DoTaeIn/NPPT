import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli } from '../src/index.js';
import { capture } from './helpers.js';

const STRIPPED = fileURLToPath(
  new URL('../../../reference/decks/week03-iam-v20.stripped.html', import.meta.url),
);
const root = mkdtempSync(join(tmpdir(), 'marco-import-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe.runIf(existsSync(STRIPPED))('marco import (week03 V20, stripped payloads)', () => {
  const out = join(root, 'week03');

  it('writes the source, manifest and report and prints a summary', async () => {
    const io = capture(root);
    expect(await runCli(['import', STRIPPED, 'week03'], io)).toBe(0);
    expect(io.stderr).toEqual([]);
    const source = readFileSync(join(out, 'lecture.marco.md'), 'utf8');
    expect(source.startsWith('---\n')).toBe(true);
    expect(source.match(/^# slide/gm)).toHaveLength(40);
    expect(existsSync(join(out, 'assets.manifest.json'))).toBe(true);
    expect(readFileSync(join(out, 'IMPORT-REPORT.md'), 'utf8')).toContain('v20');
    expect(io.stdout[0]).toMatch(
      /^✓ .*week03-iam-v20\.stripped\.html → week03 · V20 덱 · 슬라이드 40장 · 블록 \d+개 \(컴포넌트 [\d.]+% · html \d+\) · 이미지 \d+개 /,
    );
    expect(io.stdout).toContain('  lecture.marco.md');
    expect(io.text()).toMatch(/이미지 \d+개는 원본에 데이터가 없어\(<STRIPPED>\)/);
    expect(io.stdout.at(-1)).toContain('다음: marco build week03/lecture.marco.md');
  });

  it('--keep-source refreshes everything but a hand-edited lecture.marco.md', async () => {
    const file = join(out, 'lecture.marco.md');
    const edited = readFileSync(file, 'utf8').replace(/^title: .*$/m, 'title: 손본 제목');
    writeFileSync(file, edited);
    const io = capture(root);
    expect(
      await runCli(['import', STRIPPED, 'week03', '--keep-source', '--family', 'v20'], io),
    ).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(edited);
    expect(io.stdout).not.toContain('  lecture.marco.md');
    expect(io.text()).toContain('--keep-source week03/lecture.marco.md는 그대로 두었습니다.');
  });

  it('the imported source builds (missing image payloads are warnings)', async () => {
    const io = capture(root);
    expect(await runCli(['build', 'week03/lecture.marco.md', '--fonts', 'none'], io)).toBe(0);
    expect(io.stdout.at(-1)).toMatch(/^✓ week03\/lecture\.html · .* · 슬라이드 40장 /);
  }, 60_000);

  it('--family forces the importer rules; unknown families are rejected', async () => {
    const io = capture(root);
    expect(await runCli(['import', STRIPPED, 'forced', '--family', 'v97'], io)).toBe(0);
    expect(io.stdout[0]).toContain(' → forced · v9.7 덱 · ');
    const bad = capture(root);
    expect(await runCli(['import', STRIPPED, 'x', '--family', 'v10'], bad)).toBe(1);
    expect(bad.stderr.join('\n')).toContain('Allowed choices are auto, v20, v97');
  });
});

describe('marco import errors', () => {
  it('rejects a missing input and an output path that is a file', async () => {
    const io = capture(root);
    expect(await runCli(['import', 'missing.html', 'out'], io)).toBe(1);
    expect(io.stderr[0]).toBe('오류 파일이 없습니다: missing.html');
    writeFileSync(join(root, 'deck.html'), '<html></html>');
    writeFileSync(join(root, 'file-out'), '');
    const io2 = capture(root);
    expect(await runCli(['import', 'deck.html', 'file-out'], io2)).toBe(1);
    expect(io2.stderr[0]).toContain('출력 위치가 폴더가 아니라 파일입니다');
  });
});
