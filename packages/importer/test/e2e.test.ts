import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importLegacyDeck } from '../src/index.js';
import { repoRoot } from './helpers.js';

const week3 = join(repoRoot, 'reference/decks/week03-iam-v20.stripped.html');
const week5 = join(repoRoot, 'reference/decks/week05-firewall-v9.7.stripped.html');

describe.skipIf(!existsSync(week3))('week 3 reference deck (V20, stripped)', () => {
  const result = importLegacyDeck(readFileSync(week3, 'utf8'), {
    sourceName: 'week03-iam-v20.stripped.html',
  });
  const r = result.report;

  it('imports 40 slides with most blocks mapped', () => {
    console.info(
      `week 3: ${r.mappedBlocks}/${r.mappedBlocks + r.fallbackBlocks} blocks mapped (${r.mappedPercent}%), ${r.fallbackBlocks} html fallback`,
    );
    expect(result.lecture.slides).toHaveLength(40);
    expect(r.family).toBe('v20');
    expect(r.mappedPercent).toBeGreaterThan(50);
    expect(r.mappedBlocks).toBeGreaterThan(r.fallbackBlocks);
  });

  it('validates and keeps refs, videos, assets, terms and notes', () => {
    expect(r.validation).toEqual([]);
    expect(result.lecture.refs.length).toBe(44);
    expect(result.lecture.videos.map((v) => v.id)).toEqual([
      'tTAISQqmxWQ',
      'DNP_fHTMy84',
      'wd74Pnwd-50',
    ]);
    expect(Object.keys(result.lecture.assets)).toHaveLength(13);
    expect(result.lecture.terms.IAM).toBe('Identity and Access Management 신원 및 접근 관리');
    expect(r.notes.slidesWithNotes).toBe(40);
    expect(result.lecture.slides.map((s) => s.type).filter((t) => t !== 'content')).toEqual([
      'cover',
      'divider',
      'divider',
      'quote',
    ]);
  });

  it('keeps Korean punctuation verbatim in the source', () => {
    expect(result.source).toContain('title: 허용 신호 ≠ 실제 입실');
    expect(result.source).toContain('title: 외곽 → 로비 → 핵심구역');
    expect(result.source).toContain(
      '“5층 전체 허용”보다 “5층 서버실 점검, 승인된 시간, 동행자 필요”처럼',
    );
  });
});

describe.skipIf(!existsSync(week5))('week 5 reference deck (v9.7, stripped)', () => {
  const result = importLegacyDeck(readFileSync(week5, 'utf8'));
  const r = result.report;

  it('imports 43 slides, quiz, sims and structured notes', () => {
    console.info(
      `week 5: ${r.mappedBlocks}/${r.mappedBlocks + r.fallbackBlocks} blocks mapped (${r.mappedPercent}%), ${r.fallbackBlocks} html fallback`,
    );
    expect(result.lecture.slides).toHaveLength(43);
    expect(r.family).toBe('v97');
    expect(result.lecture.quiz).toHaveLength(20);
    expect(Object.keys(result.lecture.sims ?? {}).length).toBeGreaterThan(10);
    expect(r.notes.unknownMarkers).toEqual({});
    expect(r.notes.explicitCueIds).toBeGreaterThan(1000);
    expect(r.validation).toEqual([]);
    expect(Object.keys(result.sidecars)).toEqual(['sims.json']);
  });
});
