import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMarcoServer, type MarcoServerOptions } from '../src/index.js';

const LEGACY = fileURLToPath(
  new URL('../../../reference/decks/week03-iam-v20.stripped.html', import.meta.url),
);

const temp = mkdtempSync(join(tmpdir(), 'marco-mcp-'));
const root = join(temp, 'lectures');
const outside = join(temp, 'outside');
afterAll(() => rmSync(temp, { recursive: true, force: true }));

async function connect(options: MarcoServerOptions): Promise<Client> {
  const { server } = createMarcoServer(options);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'marco-test', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

let client: Client;
beforeAll(async () => {
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'secret.md'), '# slide\ntitle: secret\n');
  client = await connect({ root });
});
afterAll(async () => {
  await client.close();
});

type Structured = Record<string, unknown> & {
  ok?: boolean;
  lint?: { slide: string | null; issues: { code: string; level: string; repair_hint: string }[] }[];
  diagnostics?: { code: string; level: string; line?: number; repair_hint: string }[];
};

async function call(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult & { structuredContent?: Structured }> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult & {
    structuredContent?: Structured;
  };
}

const textOf = (r: CallToolResult): string =>
  r.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

const issues = (s: Structured | undefined) => (s?.lint ?? []).flatMap((g) => g.issues);

const FRONT = `---
title: "린트 시험"
course: 보안시스템
week: 6
---
`;

describe('discovery', () => {
  it('lists tools, resources, templates and prompts', async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(
      [
        'marco_build',
        'marco_check_slide',
        'marco_import',
        'marco_kit',
        'marco_lint',
        'marco_new',
        'marco_preview',
        'marco_read',
        'marco_replace_slide',
        'marco_spec',
      ].sort(),
    );
    const build = (await client.listTools()).tools.find((t) => t.name === 'marco_build')!;
    expect(build.description).toMatch(/repair_hint/);
    expect(build.outputSchema).toBeDefined();

    const resources = (await client.listResources()).resources.map((r) => r.uri);
    expect(resources).toEqual(
      expect.arrayContaining([
        'marco://kit',
        'marco://schema',
        'marco://spec/format',
        'marco://spec/components',
        'marco://spec/notes',
        'marco://spec/ir',
        'marco://spec/runtime',
      ]),
    );
    const templates = (await client.listResourceTemplates()).resourceTemplates.map(
      (t) => t.uriTemplate,
    );
    expect(templates).toContain('marco://spec/{name}');

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name).sort();
    expect(prompts).toEqual(['notes', 'outline', 'revise', 'slides']);
  });

  it('tells the client how to use the server', () => {
    const text = client.getInstructions() ?? '';
    expect(text).toContain('marco_kit');
    expect(text).toContain(root.split('/').pop()!);
  });
});

describe('marco_new → marco_build', () => {
  it('scaffolds a deck and returns its source', async () => {
    const r = await call('marco_new', {
      dir: 'week06',
      title: '6주차 · 침입 탐지와 차단',
      course: '보안시스템 운영 및 활용',
      week: 6,
      presenter: '홍길동 교수',
      duration: 150,
    });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    const file = join(root, 'week06', 'lecture.marco.md');
    expect(existsSync(s.source_path as string)).toBe(true);
    expect(s.created).toEqual(
      expect.arrayContaining([expect.stringContaining('lecture.marco.md')]),
    );
    const text = readFileSync(file, 'utf8');
    expect(s.source_text).toBe(text);
    expect(text).toContain('title: "6주차 · 침입 탐지와 차단"');
    expect(text).toContain('week: 6');
    expect(text).toContain('presenter: "홍길동 교수"');
    expect(text).toContain('duration: 150');
    expect(existsSync(join(root, 'week06', 'assets', 'README.md'))).toBe(true);
  });

  it('never overwrites an existing deck', async () => {
    const r = await call('marco_new', { dir: 'week06', title: 'again' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/already exists/);
  });

  it('builds the deck into one HTML file with the attribution and lecture data', async () => {
    const r = await call('marco_build', {
      source_path: 'week06/lecture.marco.md',
      fonts: 'none',
    });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    expect(s.ok).toBe(true);
    expect(s.out_path).toBe(join(root, 'week06', 'lecture.html'));
    expect(s.slides).toBe(4);
    expect(s.size_bytes).toBeGreaterThan(10_000);
    expect(s.diagnostics).toEqual([]);
    expect(Array.isArray(s.lint)).toBe(true);
    const html = readFileSync(s.out_path as string, 'utf8');
    expect(html).toContain(
      'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco',
    );
    expect(html).toMatch(/<script id="lecture-data" type="application\/json">/);
    expect(textOf(r)).toMatch(/✓ Built week06\/lecture\.html/);
  }, 30_000);

  it('saves source_text to source_path (backing up the old file), then builds', async () => {
    const path = join(root, 'week06', 'lecture.marco.md');
    const edited = readFileSync(path, 'utf8').replace('# slide references', '# slide references\n');
    const r = await call('marco_build', {
      source_path: 'week06/lecture.marco.md',
      source_text: edited,
      out_path: 'week06/out/deck.html',
      fonts: 'none',
      edition: 'student',
    });
    const s = r.structuredContent!;
    expect(s.ok).toBe(true);
    expect(s.saved).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(edited);
    expect(existsSync(s.backup as string)).toBe(true);
    expect(s.backup).toContain(join('.marco', 'mcp', 'backups'));
    expect(s.edition).toBe('student');
    expect(existsSync(join(root, 'week06', 'out', 'deck.html'))).toBe(true);
  }, 30_000);

  it('stages source_text without a path under .marco/mcp/', async () => {
    const text = `${FRONT}\n# slide\ntitle: 한 장짜리 덱\n\n본문 한 줄.\n`;
    const r = await call('marco_build', { source_text: text, fonts: 'none' });
    const s = r.structuredContent!;
    expect(s.ok).toBe(true);
    expect(s.staged).toBe(true);
    expect(s.source_path).toMatch(/\.marco[\\/]mcp[\\/][0-9a-f]{12}\.marco\.md$/);
    expect(s.out_path).toMatch(/\.marco[\\/]mcp[\\/][0-9a-f]{12}\.html$/);
    expect(existsSync(s.out_path as string)).toBe(true);
  }, 30_000);

  it('reports format errors with lines and does not write HTML', async () => {
    const text = `${FRONT}\n# slide\ntitle: 깨진 슬라이드\n\n:::cardz\n- title: x\n:::\n`;
    const r = await call('marco_build', { source_text: text, fonts: 'none' });
    const s = r.structuredContent!;
    expect(r.isError).toBeFalsy();
    expect(s.ok).toBe(false);
    expect(s.out_path).toBeNull();
    const d = s.diagnostics!.find((x) => x.code === 'format.container.unknown');
    expect(d?.line).toBe(10);
    expect(d?.repair_hint).toContain('치트시트');
    expect(textOf(r)).toMatch(/Build stopped/);
  });

  it('refuses sources that pull files from outside the root', async () => {
    writeFileSync(join(outside, 'x.png'), 'not really a png');
    const text = `${FRONT}\n# slide\ntitle: 바깥 이미지\n\n![바깥](${join(outside, 'x.png')})\n`;
    const r = await call('marco_build', { source_text: text, fonts: 'none' });
    const s = r.structuredContent!;
    expect(s.ok).toBe(false);
    expect(s.diagnostics!.map((d) => d.code)).toContain('mcp.path.outside');
  });
});

describe('marco_lint', () => {
  const overBudget = `${FRONT}
# slide
title: 카드 본문이 너무 길다

:::cards cols=2
- title: 짧은 카드
  body: ${'가'.repeat(120)}
- title: 둘째 카드
  body: 짧다.
:::
`;

  it('reports an over-budget card with a repair hint', async () => {
    const r = await call('marco_lint', { source_text: overBudget });
    const s = r.structuredContent!;
    expect(s.ok).toBe(true); // budgets are warnings
    const issue = issues(s).find((i) => i.code === 'budget.cards.body');
    expect(issue?.level).toBe('warn');
    expect(issue?.repair_hint).toContain('90자 이하');
    expect(issue?.repair_hint).toContain('지금 120자');
    const group = s.lint!.find((g) => g.slide === 's-01');
    expect(group).toMatchObject({ index: 1, title: '카드 본문이 너무 길다', line: 7 });
    expect(textOf(r)).toContain('hint:');
    expect(s.next_step).toMatch(/s-01/);
  });

  it('lints a file under the root', async () => {
    writeFileSync(join(root, 'dense.marco.md'), overBudget);
    const r = await call('marco_lint', { source_path: 'dense.marco.md' });
    expect(r.structuredContent!.source_path).toBe(join(root, 'dense.marco.md'));
    expect(issues(r.structuredContent).map((i) => i.code)).toContain('budget.cards.body');
  });

  it('marks author-only issues', async () => {
    const text = `${FRONT}\n# slide\ntitle: 확인 필요\n\nTODO: 통계 출처 확인\n`;
    const r = await call('marco_lint', { source_text: text });
    const todo = r
      .structuredContent!.lint!.flatMap((g) => g.issues)
      .find((i) => i.code === 'content.todo') as { for_author?: boolean } | undefined;
    expect(todo?.for_author).toBe(true);
  });
});

describe('marco_check_slide', () => {
  it('flags a bad container name with a format.* diagnostic and a relative line', async () => {
    const r = await call('marco_check_slide', {
      slide_source: '# slide\ntitle: 잘못된 컨테이너\n\n:::card\n- title: 하나\n:::\n',
    });
    const s = r.structuredContent!;
    expect(s.ok).toBe(false);
    const d = s.diagnostics!.find((x) => x.code.startsWith('format.'));
    expect(d?.code).toBe('format.container.unknown');
    expect(d?.line).toBe(4);
    expect(d?.repair_hint).toBeTruthy();
  });

  it('reports the body height estimate and skips id checks without front matter', async () => {
    const r = await call('marco_check_slide', {
      slide_source: 'title: 머리줄 없는 슬라이드\nrefs: [S99]\n\n- 하나\n- 둘\n',
    });
    const s = r.structuredContent!;
    expect(s.ok).toBe(true);
    const slides = s.slides as { id: string; density?: { estimate_px: number } }[];
    expect(slides[0]?.id).toBe('s-01');
    expect(slides[0]?.density?.estimate_px).toBe(88);
    expect(s.skipped).toContain('ref.missing');
  });

  it('checks ids against the given front matter', async () => {
    const r = await call('marco_check_slide', {
      slide_source: '# slide\ntitle: 출처 인용\nrefs: [S99]\n\n본문.\n',
      front_matter: 'title: 덱\nrefs:\n  S01: { title: "책" }\n',
    });
    const codes = issues(r.structuredContent).map((i) => i.code);
    expect(codes).toContain('ref.missing');
    expect(r.structuredContent!.ok).toBe(false);
  });
});

describe('marco_read / marco_replace_slide', () => {
  it('reads one slide by number and by id', async () => {
    const r = await call('marco_read', { path: 'week06/lecture.marco.md', slide: 2 });
    const s = r.structuredContent!;
    expect(s.slides).toBe(4);
    expect(s.slide).toMatchObject({ number: 2, id: 's-02' });
    expect(s.text).toMatch(/^# slide\ntag: 기본 개념/);
    const byId = await call('marco_read', { path: 'week06/lecture.marco.md', slide: 's-03' });
    expect((byId.structuredContent!.slide as { number: number }).number).toBe(3);
  });

  it('replaces a slide in place, keeps the header when omitted and returns deck lint', async () => {
    const r = await call('marco_replace_slide', {
      source_path: 'week06/lecture.marco.md',
      slide: 3,
      slide_source: `title: 새 절차 슬라이드\n\n:::cards cols=2\n- title: 너무 긴 카드\n  body: ${'나'.repeat(100)}\n- title: 짧은 카드\n  body: 짧다.\n:::\n`,
    });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    expect(s.replaced).toEqual({ number: 3, id: 's-03' });
    expect(existsSync(s.backup as string)).toBe(true);
    const text = readFileSync(join(root, 'week06', 'lecture.marco.md'), 'utf8');
    expect(text).toContain('# slide\ntitle: 새 절차 슬라이드');
    expect(text).toContain('# slide references');
    const issue = s.lint!.find((g) => g.slide === 's-03')?.issues[0];
    expect(issue?.code).toBe('budget.cards.body');
  });
});

describe('reference material', () => {
  it('marco_kit returns the kit with the MCP preface, or one section', async () => {
    const all = textOf(await call('marco_kit', {}));
    expect(all).toContain('MCP로 작업할 때');
    expect(all).toContain('# MARCO 작성 규칙');
    expect(all).toContain('# 컴포넌트 치트시트');
    expect(all.length).toBeGreaterThan(10_000);
    const cheat = textOf(await call('marco_kit', { section: 'cheatsheet' }));
    expect(cheat).toMatch(/^# 컴포넌트 치트시트/);
    expect(cheat).not.toContain('MCP로 작업할 때');
    const examples = textOf(await call('marco_kit', { section: 'examples' }));
    expect(examples).toContain('````marco');
  });

  it('marco_spec returns a spec document', async () => {
    const r = await call('marco_spec', { name: 'format' });
    expect(textOf(r)).toMatch(/^# MARCO source format/);
    const bad = await call('marco_spec', { name: 'secrets' });
    expect(bad.isError).toBe(true);
  });

  it('serves the kit, specs and schema as resources', async () => {
    const kit = await client.readResource({ uri: 'marco://kit' });
    expect((kit.contents[0] as { text: string }).text).toContain('# MARCO 작성 안내');
    const spec = await client.readResource({ uri: 'marco://spec/notes' });
    expect((spec.contents[0] as { text: string }).text).toMatch(/^# Presenter note grammar/);
    const schema = await client.readResource({ uri: 'marco://schema' });
    const json = JSON.parse((schema.contents[0] as { text: string }).text) as {
      $schema?: string;
    };
    expect(json.$schema).toMatch(/json-schema/);
  });

  it('builds prompts with @marco/ai', async () => {
    const outline = await client.getPrompt({
      name: 'outline',
      arguments: { course: '보안시스템', topic: 'IDS/IPS', duration: '150', week: '6' },
    });
    expect(outline.messages).toHaveLength(2);
    const task = (outline.messages[1]!.content as { text: string }).text;
    expect(task).toContain('IDS/IPS');
    expect(task).toContain('150');
    const kitMessage = (outline.messages[0]!.content as { text: string }).text;
    expect(kitMessage).toContain('# MARCO 작성 안내');

    const revise = await client.getPrompt({
      name: 'revise',
      arguments: { slide: '# slide\ntitle: 제목\n', request: '더 짧게', include_kit: 'no' },
    });
    expect(revise.messages).toHaveLength(1);
    expect((revise.messages[0]!.content as { text: string }).text).toContain('더 짧게');

    const slides = await client.getPrompt({
      name: 'slides',
      arguments: { outline: '1 | 표지 | 제목 | 의도 | 2\n2 | 개념 | 둘 | 의도 | 3', range: '1-2' },
    });
    expect((slides.messages[1]!.content as { text: string }).text).toContain('01–02번');

    const notes = await client.getPrompt({
      name: 'notes',
      arguments: { slide: '# slide\ntitle: 제목\n\n본문.\n', time: '2분 · 0:00 – 2:00' },
    });
    expect((notes.messages[1]!.content as { text: string }).text).toContain('2분 · 0:00 – 2:00');
  });
});

describe('safety', () => {
  it('rejects paths outside the root', async () => {
    for (const [tool, args] of [
      ['marco_lint', { source_path: '../etc/passwd' }],
      ['marco_lint', { source_path: '/etc/passwd' }],
      ['marco_read', { path: '../outside/secret.md' }],
      ['marco_new', { dir: '../escape', title: 'x' }],
      ['marco_build', { source_path: '../../etc/passwd.marco.md', source_text: '# slide\n' }],
      ['marco_import', { html_path: '../etc/passwd', out_dir: 'x' }],
    ] as const) {
      const r = await call(tool, args);
      expect(r.isError, `${tool} ${JSON.stringify(args)}`).toBe(true);
      expect(textOf(r)).toMatch(/outside the server root/);
    }
    expect(existsSync(join(temp, 'escape'))).toBe(false);
  });

  it('follows symlinks before deciding', async () => {
    symlinkSync(outside, join(root, 'link'));
    const r = await call('marco_read', { path: 'link/secret.md' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/outside the server root/);
  });

  it('only writes the file types a tool produces', async () => {
    const r = await call('marco_build', {
      source_path: 'week06/lecture.marco.md',
      out_path: 'week06/lecture.marco.md',
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/must end with \.html/);
    const s = await call('marco_build', { source_path: 'package.json', source_text: '# slide\n' });
    expect(s.isError).toBe(true);
  });

  it('caps source_text at 2 MB', async () => {
    const r = await call('marco_lint', { source_text: '가'.repeat(700_000) + '\n# slide\n' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/2 MB/);
  });

  it('refuses every write in read-only mode', async () => {
    const ro = await connect({ root, allowWrite: false });
    try {
      const n = await ro.callTool({ name: 'marco_new', arguments: { dir: 'ro', title: 'x' } });
      expect(n.isError).toBe(true);
      expect(textOf(n as CallToolResult)).toMatch(/read-only/);
      const staged = await ro.callTool({
        name: 'marco_build',
        arguments: { source_text: '# slide\ntitle: x\n' },
      });
      expect(staged.isError).toBe(true);
      const b = (await ro.callTool({
        name: 'marco_build',
        arguments: { source_path: 'dense.marco.md', fonts: 'none' },
      })) as CallToolResult & { structuredContent?: Structured };
      expect(b.structuredContent!.ok).toBe(true);
      expect(b.structuredContent!.out_path).toBeNull();
      expect(existsSync(join(root, 'dense.html'))).toBe(false);
      expect(existsSync(join(root, 'ro'))).toBe(false);
    } finally {
      await ro.close();
    }
  }, 30_000);
});

describe.runIf(existsSync(LEGACY))('marco_import', () => {
  it('imports the week-3 V20 deck', async () => {
    mkdirSync(join(root, 'legacy'), { recursive: true });
    copyFileSync(LEGACY, join(root, 'legacy', 'week03.html'));
    const r = await call('marco_import', { html_path: 'legacy/week03.html', out_dir: 'week03' });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent!;
    expect(s.family).toBe('v20');
    expect(s.slides).toBe(40);
    expect((s.blocks as { mapped_percent: number }).mapped_percent).toBeGreaterThan(80);
    expect(s.files).toEqual(expect.arrayContaining([join(root, 'week03', 'lecture.marco.md')]));
    expect(existsSync(join(root, 'week03', 'IMPORT-REPORT.md'))).toBe(true);
    expect(readdirSync(join(root, 'week03'))).toContain('assets.manifest.json');

    // A second import backs up the existing source; keep_source leaves it alone.
    const again = await call('marco_import', {
      html_path: 'legacy/week03.html',
      out_dir: 'week03',
    });
    expect(existsSync(again.structuredContent!.backup as string)).toBe(true);
    const kept = await call('marco_import', {
      html_path: 'legacy/week03.html',
      out_dir: 'week03',
      keep_source: true,
    });
    expect(kept.structuredContent!.files).not.toContain(join(root, 'week03', 'lecture.marco.md'));
  }, 60_000);

  it('never runs deck scripts named in import.config.json', async () => {
    writeFileSync(
      join(root, 'week03', 'import.config.json'),
      JSON.stringify({ corrections: ['applyCorrections97'] }),
    );
    const r = await call('marco_import', { html_path: 'legacy/week03.html', out_dir: 'week03' });
    expect(r.structuredContent!.corrections_skipped).toEqual(['applyCorrections97']);
  }, 60_000);
});
