import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildKit, KIT_FILE } from '../src/kit.js';
import { loadPromptKit, PROMPT_FILES, systemPrompt } from '../src/prompts.js';

const outDir = mkdtempSync(path.join(tmpdir(), 'marco-kit-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

describe('buildKit', () => {
  it('writes the single pasteable kit and copies every prompt and example', async () => {
    const report = await buildKit({ outDir, syncCheatsheet: false });
    const kitText = readFileSync(path.join(outDir, KIT_FILE), 'utf8');
    expect(report.kitPath).toBe(path.join(outDir, KIT_FILE));
    expect(kitText).toBe(systemPrompt(loadPromptKit()));
    expect(kitText.startsWith('# MARCO 작성 안내')).toBe(true);
    for (const file of Object.values(PROMPT_FILES))
      expect(existsSync(path.join(outDir, file)), file).toBe(true);
    for (const ex of loadPromptKit().examples) {
      expect(existsSync(path.join(outDir, 'examples', ex.file)), ex.file).toBe(true);
    }
    expect(report.kit.chars).toBeGreaterThan(report.kit.charsWithoutExamples);
    expect(report.kit.charsWithoutExamples).toBeLessThan(12_000);
    expect(report.kit.tokens).toBe(Math.ceil(report.kit.chars / 2.5));
    expect(report.files).toHaveLength(
      Object.keys(PROMPT_FILES).length + loadPromptKit().examples.length,
    );
  });

  it('contains no task templates and no unfilled slots', () => {
    const kitText = readFileSync(path.join(outDir, KIT_FILE), 'utf8');
    expect(kitText).not.toMatch(/\{\{[^{}\s]+\}\}/);
    expect(kitText).not.toContain('# 작업:');
    expect(kitText).not.toContain('이 목록만 따로 받았다면');
  });
});
