import * as schema from '@marco/schema';
import {
  BUDGETS,
  charCount,
  isKnownMarker,
  markerKind,
  parseNote,
  visibleText,
} from '@marco/schema';
import type { CueKind, LintIssue } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import { CHEATSHEET_BLOCKS } from '../src/cheatsheet.js';
import {
  buildNotesPrompt,
  buildOutlinePrompt,
  buildRepairPrompt,
  buildRevisePrompt,
  buildSlidesPrompt,
  estimateTokens,
  fillTemplate,
  kitWithoutExamples,
  loadPromptKit,
  PROMPT_FILES,
  systemPrompt,
} from '../src/prompts.js';
import { splitDeck, splitNote } from '../src/source.js';
import type { ChatMessage } from '../src/types.js';
import { makeOutline } from './fake-provider.js';

const kit = loadPromptKit();
const outline = makeOutline(12);
const slide =
  '# slide id=zone-design\ntag: 1부 · 구역 설계\ntitle: 층 이름보다 보호 구역을 먼저 정한다\n\n본문이다.\n';
const issues: LintIssue[] = [
  {
    level: 'warn',
    code: 'budget.cards.body',
    path: '/slides/3/blocks/1/items/0/body',
    message: 'cards[0].body: 104자 (허용 90자)',
    slide: 'zone-design',
  },
];

const builds: Record<string, ChatMessage[]> = {
  outline: buildOutlinePrompt({
    course: '보안시스템 운영 및 활용',
    week: 6,
    topic: 'IDS/IPS',
    duration: 150,
  }),
  slides: buildSlidesPrompt({ outline, range: [7, 12], refs: 'S13: Axis Secure Entry' }),
  notes: buildNotesPrompt({ slide, time: '3분 · 6:00 – 9:00', prevTitle: '앞', nextTitle: '뒤' }),
  revise: buildRevisePrompt({ slide, request: '표를 3열로 줄인다', lint: issues }),
  repair: buildRepairPrompt(issues, slide),
};

describe('prompt builders', () => {
  it('put the fixed system text first, then one user message', () => {
    for (const [name, msgs] of Object.entries(builds)) {
      expect(
        msgs.map((m) => m.role),
        name,
      ).toEqual(['system', 'user']);
    }
  });

  it('send a byte-identical system message on every call (prompt-caching precondition)', () => {
    const again = buildSlidesPrompt({ outline, range: [1, 6] });
    const reference = builds.outline![0]!.content;
    for (const msgs of [...Object.values(builds), again]) expect(msgs[0]!.content).toBe(reference);
    expect(systemPrompt(loadPromptKit(kit.dir, true))).toBe(reference);
  });

  it('include every block name and its budgets in the system message', () => {
    for (const msgs of Object.values(builds)) {
      const system = msgs[0]!.content;
      for (const block of CHEATSHEET_BLOCKS) expect(system).toContain(`### ${block} `);
      expect(system).toContain(`title ≤${BUDGETS.slide.title}`);
      expect(system).toContain(
        `body ≤${BUDGETS.cards.body[2]}/${BUDGETS.cards.body[3]}/${BUDGETS.cards.body[4]}`,
      );
      expect(system).toContain(`label ≤${BUDGETS.chain.label} · sub ≤${BUDGETS.chain.sub}`);
      expect(system).toContain(`슬라이드당 큐 ≤${BUDGETS.note.cuesPerSlide}`);
    }
  });

  it('fill every slot and drop the English header comments', () => {
    for (const [name, msgs] of Object.entries(builds)) {
      const user = msgs[1]!.content;
      expect(user, name).not.toMatch(/\{\{[^{}\s]+\}\}/);
      expect(user, name).not.toContain('<!--');
      expect(msgs[0]!.content, name).not.toContain('<!--');
    }
    expect(builds.outline![1]!.content).toContain('주제: IDS/IPS');
    expect(builds.outline![1]!.content).toContain('강의 시간: 150분');
  });

  it('keep the variable part of a slides batch at the end of the user message', () => {
    const user = builds.slides![1]!.content;
    expect(user.indexOf('## 개요')).toBeLessThan(user.indexOf('## 이번 범위'));
    expect(user).toContain('07–12번 (6장)');
    expect(user).toContain('07 | 1부 · 주제7 |');
    const other = buildSlidesPrompt({ outline, range: [1, 6], refs: 'S13: Axis Secure Entry' })[1]!
      .content;
    const shared = user.slice(0, user.indexOf('## 이번 범위'));
    expect(other.startsWith(shared)).toBe(true);
  });

  it('carry lint issues and the slide into revise and repair prompts', () => {
    for (const name of ['revise', 'repair']) {
      const user = builds[name]![1]!.content;
      expect(user).toContain('budget.cards.body');
      expect(user).toContain('# slide id=zone-design');
    }
    expect(builds.repair![1]!.content).toContain('린트 결과의 문제만 고친다');
  });

  it('asks for more spoken text only when charsPerMinute differs from the kit default', () => {
    expect(builds.notes![1]!.content).not.toContain('분량은 1분에');
    const rich = buildNotesPrompt({ slide, charsPerMinute: 900 })[1]!.content;
    expect(rich).toContain('분량은 1분에 약 900자로 한다.');
  });

  it('fillTemplate leaves unknown slots and fills empty values with 없음', () => {
    expect(fillTemplate('<!-- h -->\n{{a}} {{b}} {{c}}', { a: 'x', b: '' })).toBe('x 없음 {{c}}');
  });
});

describe('prompt kit', () => {
  it('stays under ~12,000 characters without examples', () => {
    const lean = kitWithoutExamples(kit);
    expect(charCount(lean)).toBeLessThan(12_000);
    expect(estimateTokens(lean)).toBe(Math.ceil(charCount(lean) / 2.5));
  });

  it('has an English header comment on every prompt file', () => {
    for (const file of Object.values(PROMPT_FILES)) {
      const name = Object.entries(PROMPT_FILES).find(
        ([, f]) => f === file,
      )![0] as keyof typeof PROMPT_FILES;
      expect(kit.files[name], file).toMatch(/^<!-- MARCO prompt kit · /);
    }
  });

  it('teaches only note markers the schema knows, one for every cue kind', () => {
    const grammar = kit.files.noteGrammar;
    const markers = [...grammar.matchAll(/`\[([^\]`]+)\]`/g)].map((m) => m[1]!);
    expect(markers.length).toBeGreaterThan(10);
    for (const marker of markers) expect(isKnownMarker(marker), marker).toBe(true);
    const kinds = new Set(markers.map(markerKind).filter(Boolean));
    const all = (schema as Record<string, unknown>)['CUE_KINDS'] as readonly CueKind[] | undefined;
    for (const kind of all ?? []) expect(kinds.has(kind), kind).toBe(true);
  });

  it('maps the self-check to the schema lint codes', () => {
    const codes = (schema as Record<string, unknown>)['LINT_CODES'] as
      Record<string, string> | undefined;
    const review = kit.files.review;
    // quiz items are not authored with this kit; cue ids are never written by the model.
    const skip = new Set(['quiz.ans.range', 'note.cue.id.duplicate', 'ref.unused', 'term.unused']);
    for (const code of Object.keys(codes ?? {})) {
      if (skip.has(code)) continue;
      expect(review, code).toContain(code === 'budget.*' ? 'budget.<블록>.<필드>' : code);
    }
  });

  it('ships examples of compare, verdict, pills, timeline and a cover with its fields', () => {
    const all = kit.examples.map((ex) => ex.source).join('\n');
    for (const block of [':::compare ', ':::verdict ', ':::pills', ':::timeline'])
      expect(all, block).toContain(block);
    const cover = kit.examples
      .flatMap((ex) => splitDeck(ex.source).slides)
      .find((s) => s.type === 'cover');
    expect(cover).toBeDefined();
    for (const field of ['kicker', 'title', 'tagline', 'subtitle', 'meta', 'toc'])
      expect(cover!.text, field).toMatch(new RegExp(`^${field}: .+$`, 'm'));
    const system = systemPrompt(kit);
    for (const block of [':::compare ', ':::verdict ', ':::timeline', 'tagline: '])
      expect(system, block).toContain(block);
  });

  it('ships examples that fit the budgets and a note that parses', () => {
    const len = (s: string) => charCount(visibleText(s));
    for (const ex of kit.examples) {
      for (const s of splitDeck(ex.source).slides) {
        const field = (k: string) => new RegExp(`^${k}: (.*)$`, 'm').exec(s.text)?.[1] ?? '';
        const max = s.type === 'quote' ? BUDGETS.quote.text : BUDGETS.slide.title;
        expect(len(field('title')), `${ex.file} title`).toBeLessThanOrEqual(max);
        expect(len(field('subtitle')), `${ex.file} subtitle`).toBeLessThanOrEqual(
          BUDGETS.slide.subtitle,
        );
        expect(len(field('tag')), `${ex.file} tag`).toBeLessThanOrEqual(BUDGETS.slide.tag);
        for (const m of s.text.matchAll(/^\d\d \| (.+) \| (.+)$/gm)) {
          expect(len(m[1]!)).toBeLessThanOrEqual(BUDGETS.chain.label);
          expect(len(m[2]!)).toBeLessThanOrEqual(BUDGETS.chain.sub);
        }
        for (const [, cols, items] of s.text.matchAll(/^:::cards cols=(\d)\n([\s\S]*?)^:::$/gm)) {
          const body = BUDGETS.cards.body[Number(cols) as 2 | 3 | 4];
          for (const m of items!.matchAll(/^ {0,2}-? ?(kicker|title|body): (.+)$/gm)) {
            const limit = { kicker: BUDGETS.cards.kicker, title: BUDGETS.cards.title, body }[
              m[1] as 'kicker' | 'title' | 'body'
            ];
            expect(len(m[2]!), `${ex.file} ${m[1]}`).toBeLessThanOrEqual(limit);
          }
        }
        const tableRows = [...s.text.matchAll(/^\|(.+)\|$/gm)].map((row) =>
          row[1]!.split('|').map((cell) => cell.trim()),
        );
        const cols = tableRows[0]?.length ?? 0;
        const cellBudget =
          (BUDGETS.table.cellByCols as Record<number, number>)[cols] ?? BUDGETS.table.cell;
        for (const cells of tableRows) {
          expect(cells, `${ex.file} table.ragged`).toHaveLength(cols);
          for (const cell of cells) expect(len(cell)).toBeLessThanOrEqual(cellBudget);
        }
        const rows = (name: string): string[][] => {
          const block = new RegExp(`^:::${name}[^\\n]*\\n([\\s\\S]*?)^:::$`, 'm').exec(s.text);
          return (block?.[1] ?? '')
            .split('\n')
            .filter((l) => l.includes(' | '))
            .map((l) => l.split(' | '));
        };
        for (const [label, left, right] of rows('compare')) {
          expect(len(label!)).toBeLessThanOrEqual(BUDGETS.compare.label);
          expect(len(left!)).toBeLessThanOrEqual(BUDGETS.compare.cell);
          expect(len(right!)).toBeLessThanOrEqual(BUDGETS.compare.cell);
        }
        for (const [at, title, body] of rows('timeline')) {
          expect(len(at!)).toBeLessThanOrEqual(BUDGETS.timeline.at);
          expect(len(title!)).toBeLessThanOrEqual(BUDGETS.timeline.title);
          expect(len(body ?? '')).toBeLessThanOrEqual(BUDGETS.timeline.body);
        }
        for (const [, label, text] of s.text.matchAll(/^:::verdict \w+ ?(.*)\n(.+)$/gm)) {
          expect(len(label!)).toBeLessThanOrEqual(BUDGETS.verdict.label);
          expect(len(text!)).toBeLessThanOrEqual(BUDGETS.verdict.text);
        }
        const pills = /^:::pills\n([\s\S]*?)^:::$/m.exec(s.text)?.[1] ?? '';
        const pillItems = pills.split('\n').filter((l) => l.startsWith('- '));
        expect(pillItems.length).toBeLessThanOrEqual(BUDGETS.pills.maxItems);
        for (const item of pillItems)
          expect(
            len(item.replace(/^- (?:(?:ok|warn|danger|info|primary|neutral): )?/, '')),
          ).toBeLessThanOrEqual(BUDGETS.pills.text);
        const takeaway = /^:::takeaway (.+)\n(.+)$/m.exec(s.text);
        if (takeaway) {
          expect(len(takeaway[1]!)).toBeLessThanOrEqual(BUDGETS.takeaway.label);
          expect(len(takeaway[2]!)).toBeLessThanOrEqual(BUDGETS.takeaway.text);
        }
        const callout = /^:::callout \w+ (.+)\n(.+)$/m.exec(s.text);
        if (callout) {
          expect(len(callout[1]!)).toBeLessThanOrEqual(BUDGETS.callout.title);
          expect(len(callout[2]!)).toBeLessThanOrEqual(BUDGETS.callout.body);
        }
        const { note } = splitNote(s.text);
        if (note) {
          const parsed = parseNote(note.replace(/^## note\n/, ''));
          expect(parsed.time?.minutes).toBe(3);
          expect(parsed.cues.length).toBeLessThanOrEqual(BUDGETS.note.cuesPerSlide);
          for (const cue of parsed.cues) {
            expect(cue.marker === undefined || isKnownMarker(cue.marker), cue.marker).toBe(true);
            expect(len(cue.t)).toBeLessThanOrEqual(BUDGETS.note.cueText);
          }
          const focus = parsed.cues.flatMap((c) => c.focus?.targets ?? []);
          expect(focus).toContain('card-steps-b1');
          expect(parsed.cues.find((c) => c.k === 'ASK')?.wait).toBe('10초');
        }
      }
    }
  });
});
