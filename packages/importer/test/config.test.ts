import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ImportConfigError,
  iifeSource,
  importLegacyDeck,
  parseImportConfig,
  runImport,
  type ImportedSlide,
} from '../src/index.js';
import { fixture, v20Deck, v20Slide, v97Deck, v97Slide } from './helpers.js';

describe('parseImportConfig', () => {
  it('accepts a full config and ignores $-keys', () => {
    const config = parseImportConfig({
      $comment: 'notes',
      family: 'v20',
      notes: 'prose',
      slides: [
        { at: 1, id: 'cover', set: { toc: 'TOC', meta: ['a', 'b'], dark: true, layout: 'wide' } },
        { legacyTitle: '안전과 권한', id: 'part-2' },
      ],
      cover: { kicker: '과목 · 3주차', meta: [] },
      assets: { pix: { credit: '© 테스트' } },
      dropRefs: ['R03'],
      corrections: ['applyCorrections97'],
    });
    expect(config.slides?.[0]).toEqual({
      at: 1,
      id: 'cover',
      set: { toc: 'TOC', meta: ['a', 'b'], dark: true, layout: 'wide' },
    });
    expect(config.cover).toEqual({ kicker: '과목 · 3주차', meta: [] });
  });

  it('lists every problem at once', () => {
    let error: unknown;
    try {
      parseImportConfig({
        notes: 'loud',
        slides: [
          { at: 1, legacyTitle: 'x', id: 'a' },
          { at: 0, id: 's-02' },
          { legacyTitle: 'y', id: 'a', set: { colour: 'red', meta: 'x' } },
        ],
        dropRefs: [3],
        extra: true,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ImportConfigError);
    expect((error as ImportConfigError).problems).toEqual([
      'config: unknown key `extra` (allowed: family, notes, slides, cover, assets, dropRefs, corrections)',
      'config.notes: must be "split" or "prose"',
      'config.slides[0]: give exactly one of `at` (position) or `legacyTitle`',
      'config.slides[1].at: must be a 1-based slide position',
      'config.slides[1].id: `s-02` looks like a positional id; pick a name',
      'config.slides[2].id: `a` is used twice',
      'config.slides[2].set: unknown key `colour` (allowed: title, subtitle, toc, tag, group, question, kicker, tagline, art, meta, dark, layout)',
      'config.slides[2].set.meta: must be a list of strings',
      'config.dropRefs: must be a list of non-empty strings',
    ]);
  });
});

describe('importLegacyDeck with a config', () => {
  const deck = v20Deck(
    [
      v20Slide('<p class="v-lead">첫 문장은 조금 길게 쓴다.</p>', {
        title: '첫 장',
        note: '첫 문장은 조금 길게 쓴다.',
      }),
      v20Slide('<p>둘째 본문.</p>', { title: '둘째 장', note: '둘째 본문.' }),
      v20Slide('<p>셋째 본문.</p>', { title: '셋째 장' }),
    ],
    {
      refs: [
        { id: 'S01', title: '하나', url: 'https://example.org/1' },
        { id: 'S02', title: '둘', url: 'https://example.org/2' },
      ],
      slideRefs: [['S01', 'S02'], ['S02'], []],
    },
  );

  it('gives stable ids by position and by legacy title, and applies overrides', () => {
    const result = importLegacyDeck(deck, {
      config: {
        slides: [
          { at: 1, id: 'opening', set: { toc: '처음', group: '도입', dark: true } },
          { legacyTitle: '둘째 장', id: 'second', set: { subtitle: '보탠 한 줄', tag: '' } },
          { legacyTitle: '없는 장', id: 'ghost' },
        ],
        cover: { meta: ['2026학년도 2학기'] },
        dropRefs: ['S02'],
      },
      configSource: 'import.config.json',
    });
    const [a, b, c] = result.lecture.slides as ImportedSlide[];
    expect(a).toMatchObject({
      id: 'opening',
      toc: '처음',
      group: '도입',
      dark: true,
      meta: ['2026학년도 2학기'],
    });
    expect(b).toMatchObject({ id: 'second', subtitle: '보탠 한 줄' });
    expect(b?.tag).toBeUndefined();
    expect(c?.id).toBe('s-03');
    // Block ids in the notes follow the stable slide id.
    expect(a?.note?.cues[0]?.focus?.targets).toEqual(['opening-b1']);
    // Dropped refs leave the front matter and every slide.
    expect(result.lecture.refs.map((r) => r.id)).toEqual(['S01']);
    expect(a?.refs).toEqual(['S01']);
    expect(b?.refs).toBeUndefined();
    expect(result.report.config).toEqual({
      source: 'import.config.json',
      notes: 'split',
      applied: [
        { rule: 'at 1', slide: 'opening', id: 'opening', fields: ['toc', 'group', 'dark'] },
        { rule: 'cover', slide: 'opening', fields: ['meta'] },
        {
          rule: 'legacyTitle "둘째 장"',
          slide: 'second',
          id: 'second',
          fields: ['subtitle', 'tag'],
        },
      ],
      unmatched: ['legacyTitle "없는 장"'],
      droppedRefs: ['S02'],
      assets: [],
    });
    expect(result.source).toContain(
      '# slide dark id=opening\ntitle: 첫 장\ntoc: 처음\nmeta: [2026학년도 2학기]\n',
    );
  });

  it('keeps one prose cue per slide with `notes: prose`', () => {
    const result = importLegacyDeck(deck, { config: { notes: 'prose' } });
    expect(result.lecture.slides[0]?.note?.raw).toBe('[대사] 첫 문장은 조금 길게 쓴다.');
    expect(result.report.noteSplit).toEqual({ split: 0, total: 3 });
  });

  it('overrides asset metadata', () => {
    const result = importLegacyDeck(fixture('v20-deck.html'), {
      config: { assets: { pix: { credit: '새 출처', alt: '대체 텍스트' } } },
    });
    expect(result.lecture.assets.pix).toMatchObject({ credit: '새 출처', alt: '대체 텍스트' });
    expect(result.report.config?.assets).toEqual(['pix']);
  });
});

describe('load-time corrections', () => {
  const script = `window.SIMS={"a":{"x":1,"list":["UN-NAT"]}};
window.QUIZ={"Q01":{"area":1,"q":"옛 질문?","opts":["a","b"],"ans":0}};
/* v9.x fix */
(function fixDeck(){
  const re = /\\}/g; const tpl = \`\${'}'} {\`;
  window.SIMS.a.x = 2;
  SIMS.a.list = SIMS.a.list.map(s => s.split('UN-NAT').join('DNAT 후 목적지'));
  const slide = window.DECK.slides[0];
  slide.dataset.note += ' 보정됨';
  slide.querySelector('.s-body p').textContent = '고친 문장';
  document.querySelector('table.u').rows[0].cells[1].textContent = '고친 칸';
})();
(function breaks(){ throw new Error('boom'); })();`;
  const html = v97Deck(
    [
      v97Slide(
        '<p>옛 문장</p><table class="u"><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>',
        {
          note: '[대사] 원래 노트',
        },
      ),
    ],
    { script: `${script}\n</script><script id="late-fix">window.QUIZ.Q01.q = '새 질문?';` },
  );

  it('extracts named IIFEs with strings, templates and regex literals intact', () => {
    const found = iifeSource(script, 'fixDeck');
    expect(found?.code.startsWith('(function fixDeck(){')).toBe(true);
    expect(found?.code.endsWith('})();')).toBe(true);
    expect(iifeSource(script, 'missing')).toBeUndefined();
  });

  it('runs only the requested scripts, in document order, and reports what changed', () => {
    const result = importLegacyDeck(html, {
      config: { corrections: ['late-fix', 'fixDeck', 'breaks', 'nope'] },
    });
    expect(result.lecture.sims).toEqual({ a: { x: 2, list: ['DNAT 후 목적지'] } });
    expect(result.lecture.quiz?.[0]?.q).toBe('새 질문?');
    const slide = result.lecture.slides[0]!;
    expect(slide.note?.raw).toBe('[대사] 원래 노트 보정됨');
    expect(slide.blocks[0]).toEqual({ type: 'paragraph', text: '고친 문장' });
    expect(slide.blocks[1]).toMatchObject({ head: ['a', '고친 칸'] });
    expect(result.report.corrections).toEqual({
      requested: ['late-fix', 'fixDeck', 'breaks', 'nope'],
      ran: ['fixDeck', 'breaks', 'late-fix'],
      missing: ['nope'],
      errors: ['breaks: boom'],
      changed: { sims: true, quiz: 1, notes: 1, slideText: 1, attributes: 0 },
      audit: [],
    });
  });

  it('never runs deck code without a config', () => {
    const result = importLegacyDeck(html);
    expect(result.lecture.sims).toEqual({ a: { x: 1, list: ['UN-NAT'] } });
    expect(result.report.corrections).toBeUndefined();
    expect(result.report.warnings.join('\n')).not.toContain('corrections');
  });
});

describe('runImport and import.config.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'marco-config-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('applies outDir/import.config.json unless told not to', async () => {
    const input = join(dir, 'deck.html');
    writeFileSync(input, fixture('v20-deck.html'));
    const out = join(dir, 'out');
    mkdirSync(out, { recursive: true });
    writeFileSync(
      join(out, 'import.config.json'),
      JSON.stringify({ slides: [{ at: 1, id: 'cover' }] }),
    );
    const { result } = await runImport(input, out);
    expect(result.lecture.slides[0]?.id).toBe('cover');
    expect(result.report.config?.source).toBe('import.config.json');
    expect(readFileSync(join(out, 'IMPORT-REPORT.md'), 'utf8')).toContain('## Import config');
    const plain = await runImport(input, out, { config: false });
    expect(plain.result.lecture.slides[0]?.id).toBe('s-01');
    expect(plain.result.report.config).toBeUndefined();
  });

  it('rejects a bad config file with the list of problems', async () => {
    const out = join(dir, 'bad');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'import.config.json'), JSON.stringify({ notes: 'x' }));
    await expect(runImport(join(dir, 'deck.html'), out)).rejects.toThrow(
      'config.notes: must be "split" or "prose"',
    );
  });
});
