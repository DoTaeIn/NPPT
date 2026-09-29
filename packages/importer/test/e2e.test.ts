import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintLecture, validateLecture } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import {
  formatJson,
  importLegacyDeck,
  parseImportConfig,
  type ImportConfig,
  type ImportedSlide,
} from '../src/index.js';
import { repoRoot } from './helpers.js';

const week3 = join(repoRoot, 'reference/decks/week03-iam-v20.stripped.html');
const week5 = join(repoRoot, 'reference/decks/week05-firewall-v9.7.stripped.html');
const example3 = join(repoRoot, 'examples/week03-iam');
const example5 = join(repoRoot, 'examples/week05-firewall');

const configOf = (dir: string): ImportConfig =>
  parseImportConfig(JSON.parse(readFileSync(join(dir, 'import.config.json'), 'utf8')));

describe.skipIf(!existsSync(week3))('week 3 reference deck (V20, stripped)', () => {
  const result = importLegacyDeck(readFileSync(week3, 'utf8'), {
    sourceName: 'week03-iam-v20.stripped.html',
    config: configOf(example3),
  });
  const r = result.report;
  const slides = result.lecture.slides as ImportedSlide[];

  it('imports 40 slides with at least 92% of blocks mapped', () => {
    console.info(
      `week 3: ${r.mappedBlocks}/${r.mappedBlocks + r.fallbackBlocks} blocks mapped (${r.mappedPercent}%), ${r.fallbackBlocks} html fallback`,
    );
    expect(slides).toHaveLength(40);
    expect(r.family).toBe('v20');
    expect(r.mappedPercent).toBeGreaterThanOrEqual(92);
    // What is left is the script-driven demos (Phase 3 widgets).
    expect(r.unmapped.every((u) => u.reason === 'interactive')).toBe(true);
  });

  it('validates, lints without errors and keeps refs, videos, assets, terms and notes', () => {
    expect(r.validation).toEqual([]);
    expect(validateLecture(result.lecture).ok).toBe(true);
    expect(lintLecture(result.lecture).filter((i) => i.level === 'error')).toEqual([]);
    expect(result.lecture.refs.length).toBe(44);
    expect(result.lecture.videos.map((v) => v.id)).toEqual([
      'tTAISQqmxWQ',
      'DNP_fHTMy84',
      'wd74Pnwd-50',
    ]);
    expect(Object.keys(result.lecture.assets)).toHaveLength(13);
    expect(result.lecture.terms.IAM).toBe('Identity and Access Management 신원 및 접근 관리');
    expect(r.notes.slidesWithNotes).toBe(40);
    expect(slides.map((s) => s.type).filter((t) => t !== 'content')).toEqual([
      'cover',
      'divider',
      'divider',
      'quote',
      'references',
    ]);
  });

  it('fills the cover and divider fields and applies the config ids', () => {
    expect(slides.slice(0, 5).map((s) => s.id)).toEqual([
      'cover',
      'intro',
      'four-questions',
      'principle-chain',
      'part-1',
    ]);
    expect(slides[0]).toMatchObject({
      type: 'cover',
      title: '문을 여는 기술, *권한을 다루는 설계.*',
      toc: '물리보안 · 출입통제 IAM',
      tagline: 'PHYSICAL ACCESS × IDENTITY',
      subtitle: '장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.',
      meta: ['중앙대학교 산업보안학과', 'Curriculum v3 · V20'],
      art: 'campus',
      tag: '표지',
      group: '표지 · 도입',
    });
    expect(slides[4]).toMatchObject({
      type: 'divider',
      dark: true,
      no: '01',
      title: '문 앞과 문 뒤를 함께 본다.',
      toc: '인증과 하드웨어',
      subtitle: '외곽에서 핵심구역까지, 자격·장비·통신의 역할을 연결한다.',
      kicker: '보안시스템 운영 및 활용 · 3주차',
      group: '1부 · 인증과 하드웨어',
    });
    expect(slides.find((s) => s.id === 'references')?.only).toHaveLength(44);
  });

  it('splits the prose notes into per-block cues that rejoin to the original', () => {
    expect(r.noteSplit?.split).toBeGreaterThanOrEqual(35);
    const intro = slides[1]!;
    expect(intro.note?.cues.map((c) => c.focus?.targets)).toEqual([
      ['intro-b1'],
      ['intro-b2-i1'],
      ['intro-b2-i2'],
      ['intro-b2-i3'],
      ['intro-b3'],
    ]);
    const note = readFileSync(week3, 'utf8').match(/data-note="(협력사[^"]*)"/)?.[1];
    expect(intro.note?.cues.map((c) => c.t).join(' ')).toBe(note);
  });

  it('keeps Korean punctuation verbatim in the source', () => {
    expect(result.source).toContain('title: 허용 신호 ≠ 실제 입실');
    expect(result.source).toContain('title: 외곽 → 로비 → 핵심구역');
    expect(result.source).toContain(
      '“5층 전체 허용”보다 “5층 서버실 점검, 승인된 시간, 동행자 필요”처럼',
    );
  });

  it('reproduces examples/week03-iam/lecture.marco.md exactly', () => {
    expect(result.source).toBe(readFileSync(join(example3, 'lecture.marco.md'), 'utf8'));
  });
});

describe.skipIf(!existsSync(week5))('week 5 reference deck (v9.7, stripped)', () => {
  const html = readFileSync(week5, 'utf8');
  const result = importLegacyDeck(html, { config: configOf(example5) });
  const r = result.report;
  const slides = result.lecture.slides as ImportedSlide[];

  it('imports 43 slides with at least 88% of blocks mapped, quiz, sims and structured notes', () => {
    console.info(
      `week 5: ${r.mappedBlocks}/${r.mappedBlocks + r.fallbackBlocks} blocks mapped (${r.mappedPercent}%), ${r.fallbackBlocks} html fallback`,
    );
    expect(slides).toHaveLength(43);
    expect(r.family).toBe('v97');
    expect(r.mappedPercent).toBeGreaterThanOrEqual(88);
    expect(result.lecture.quiz).toHaveLength(20);
    expect(Object.keys(result.lecture.sims ?? {}).length).toBeGreaterThan(10);
    expect(r.notes.explicitCueIds).toBeGreaterThan(1000);
    expect(r.validation).toEqual([]);
    expect(lintLecture(result.lecture).filter((i) => i.level === 'error')).toEqual([]);
    expect(Object.keys(result.sidecars)).toEqual(['sims.json']);
  });

  it('maps the opening hero and the two section openers', () => {
    expect(slides[0]).toMatchObject({
      id: 'cover',
      type: 'hero',
      title: '방화벽 운영 및 실무',
      tag: 'SECURITY SYSTEMS OPERATION & UTILIZATION · WEEK 05',
      meta: ['2026학년도 2학기 · 5주차', '중앙대학교 산업보안학과'],
      art: 'hero-01',
    });
    expect(result.lecture.assets['hero-01']).toMatchObject({ width: 860, height: 1080 });
    expect(slides[4]).toMatchObject({ type: 'divider', alert: true, no: '!', art: 'hero-05' });
    expect(result.lecture.assets['hero-05']).toMatchObject({ width: 760, height: 900 });
    expect(slides[40]).toMatchObject({ type: 'divider', no: '6', toc: '6주차 예고' });
  });

  it('turns the exam launcher into a quiz widget with the deck’s default time', () => {
    const diagnostic = slides.find((s) => s.id === 'diagnostic')!;
    expect(diagnostic.blocks).toContainEqual({
      type: 'widget',
      name: 'quiz',
      params: { mode: 'exam', minutes: 15 },
    });
  });

  it('applies the deck’s load-time corrections to SIMS, QUIZ, notes and text', () => {
    const k = r.corrections!;
    expect(k.errors).toEqual([]);
    expect(k.missing).toEqual([]);
    expect(k.audit).toEqual([]);
    expect(k.changed.sims).toBe(true);
    expect(k.changed.quiz).toBe(3);
    const sims = result.lecture.sims as Record<string, { flows?: { goal?: string }[] }>;
    expect(sims.s_block?.flows?.[4]?.goal).toBe(
      '웹 공개 규칙의 SYN 프록시가 위조 SYN에 어떻게 응답하는지 확인한다. 공격량과 성능은 측정하지 않는다.',
    );
    expect(result.lecture.quiz?.find((q) => q.id === 'Q10')?.q).toBe(
      '외부 사용자가 공인 VIP(198.51.100.4:443)로 접속할 때 DMZ의 WAF(172.18.5.10:443)로 목적지를 바꾸는 기술은?',
    );
    // v9.4 N2SF refresh on the trends slide.
    expect(result.source).toContain('2026-05-01 개정 지침: 업무정보를 **기밀·민감·공개**로 분류');
  });

  it('reproduces examples/week05-firewall (source and sims.json) exactly', () => {
    expect(result.source).toBe(readFileSync(join(example5, 'lecture.marco.md'), 'utf8'));
    expect(formatJson(result.sidecars['sims.json'])).toBe(
      readFileSync(join(example5, 'sims.json'), 'utf8'),
    );
  });
});
