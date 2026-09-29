import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { runCli, runWatch } from '../src/index.js';
import { capture as captureIn } from './helpers.js';

const ATTRIBUTION =
  'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco';
const root = mkdtempSync(join(tmpdir(), 'marco-cli-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const capture = (cwd = root) => captureIn(cwd);

describe('marco new → build → lint', () => {
  const dir = join(root, 'week02');
  const source = join(dir, 'lecture.marco.md');

  it('new writes the starter lecture and assets/README.md', async () => {
    const io = capture();
    const code = await runCli(
      [
        'new',
        'week02',
        '--title',
        '2주차 · 인증: 인가',
        '--course',
        '보안시스템',
        '--week',
        '2',
        '--theme',
        'cau-navy',
      ],
      io,
    );
    expect(code).toBe(0);
    expect(existsSync(join(dir, 'assets', 'README.md'))).toBe(true);
    const text = readFileSync(source, 'utf8');
    expect(text).toContain('title: "2주차 · 인증: 인가"');
    expect(text).toContain('course: "보안시스템"');
    expect(text).toContain('week: 2\n');
    expect(text).toContain('theme: cau-navy\n');
    expect(text).toContain('# slide cover');
    expect(text).toContain('# slide references');
    expect(text).toContain('## note\n[시간]');
    expect(text).toContain('{{auto}}'); // cue-id placeholders are left for the compiler
    expect(io.text()).toContain('marco build week02/lecture.marco.md');
  });

  it('new refuses to overwrite without --force', async () => {
    const io = capture();
    expect(await runCli(['new', 'week02'], io)).toBe(1);
    expect(io.stderr.join('\n')).toContain('--force');
    expect(
      await runCli(
        ['new', 'week02', '--force', '--title', '2주차 · 인증: 인가', '--week', '2'],
        capture(),
      ),
    ).toBe(0);
  });

  it('build writes <name>.html next to the source', async () => {
    const io = capture();
    const code = await runCli(['build', 'week02/lecture.marco.md', '--strict'], io);
    expect(io.stderr).toEqual([]);
    expect(code).toBe(0);
    const out = join(dir, 'lecture.html');
    expect(existsSync(out)).toBe(true);
    const html = readFileSync(out, 'utf8');
    expect(html).toContain(ATTRIBUTION);
    expect(html.match(/<section class="slide/g)).toHaveLength(4);
    expect(io.stdout.at(-1)).toMatch(
      /^✓ week02\/lecture\.html · [\d.]+ KB · 슬라이드 4장 · 강의자용 · 글꼴 /,
    );
  });

  it('build -o, --edition student and --fonts none', async () => {
    const io = capture();
    expect(
      await runCli(
        [
          'build',
          source,
          '-o',
          join(root, 'student.html'),
          '--edition',
          'student',
          '--fonts',
          'none',
        ],
        io,
      ),
    ).toBe(0);
    const html = readFileSync(join(root, 'student.html'), 'utf8');
    expect(html).toContain('data-edition="student"');
    const data = JSON.parse(
      /<script id="lecture-data" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}',
    ) as object;
    expect(data).toHaveProperty('slideRefs');
    expect(data).not.toHaveProperty('notes');
    expect(io.stdout.at(-1)).toContain('학생용');
  });

  it('lint --json reports a clean starter deck', async () => {
    const io = capture();
    expect(await runCli(['lint', source, '--json'], io)).toBe(0);
    const report = JSON.parse(io.stdout.join('\n')) as {
      ok: boolean;
      diagnostics: unknown[];
      lint: { level: string }[];
    };
    expect(report.ok).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.lint.filter((l) => l.level !== 'info')).toEqual([]);
  });
});

describe('errors and lint output', () => {
  const bad = join(root, 'bad.marco.md');
  writeFileSync(bad, '---\ntitle: 깨진 덱\n---\n# slide\ntitle: A\n\n:::cardz\n- title: x\n:::\n');
  const budget = join(root, 'budget.marco.md');
  writeFileSync(
    budget,
    '---\ntitle: 예산\n---\n# slide\ntitle: 카드\nrefs: [S99]\n\n:::cards cols=4\n- title: 카드\n  body: 네 칸 카드의 본문은 사십 자를 넘기면 안 되는데 이 문장은 일부러 그 예산을 훌쩍 넘기도록 길게 썼다.\n  icon: nope-icon\n:::\n',
  );

  it('build prints file:line diagnostics and exits 1', async () => {
    const io = capture();
    expect(await runCli(['build', 'bad.marco.md'], io)).toBe(1);
    expect(io.stderr[0]).toBe(
      "bad.marco.md:7  오류 [format.container.unknown] 알 수 없는 컨테이너 ':::cardz' (':::cards'을(를) 의도했나요?).",
    );
    expect(existsSync(join(root, 'bad.html'))).toBe(false);
  });

  it('lint groups issues by slide; --strict fails on lint errors', async () => {
    const io = capture();
    expect(await runCli(['lint', 'budget.marco.md'], io)).toBe(1);
    const text = io.text();
    expect(text).toContain('  s-01 #1 카드 (budget.marco.md:4)');
    expect(text).toMatch(/경고 budget\.cards\.body {2}cards\[0\]\.body: \d+자 \(허용 40자\)/);
    expect(text).toContain('오류 ref.missing');
    expect(text).toContain('경고 icon.unknown');
    const build = capture();
    expect(await runCli(['build', 'budget.marco.md', '--fonts', 'none'], build)).toBe(0);
    expect(
      await runCli(['build', 'budget.marco.md', '--fonts', 'none', '--strict'], capture()),
    ).toBe(1);
  });

  it('missing files, bad options and unknown commands', async () => {
    expect(await runCli(['build', 'nope.marco.md'], capture())).toBe(1);
    expect(await runCli(['build', 'budget.marco.md', '--fonts', 'all'], capture())).toBe(1);
    expect(await runCli(['frobnicate'], capture())).toBe(1);
  });

  it('help and version exit 0', async () => {
    const help = capture();
    expect(await runCli(['--help'], help)).toBe(0);
    expect(help.text()).toContain('Usage: marco');
    const version = capture();
    expect(await runCli(['--version'], version)).toBe(0);
    expect(version.stdout).toEqual([expect.stringMatching(/^\d+\.\d+\.\d+/)]);
  });

  it('help lists every command and every ai step', async () => {
    const help = capture();
    expect(await runCli(['help'], help)).toBe(0);
    for (const cmd of ['new', 'build', 'watch', 'lint', 'pdf', 'import', 'ai'])
      expect(help.text()).toMatch(new RegExp(`^  ${cmd}\\b`, 'm'));
    const ai = capture();
    expect(await runCli(['ai', '--help'], ai)).toBe(0);
    for (const step of ['kit', 'outline', 'slides', 'notes', 'revise', 'repair', 'merge-notes'])
      expect(ai.text()).toMatch(new RegExp(`^  ${step}\\b`, 'm'));
    // Missing arguments are usage errors, not crashes.
    expect(await runCli(['import', 'only-one.html'], capture())).toBe(1);
    expect(await runCli(['import', 'nope.html', 'out'], capture())).toBe(1);
    expect(await runCli(['pdf', 'nope.marco.md'], capture())).toBe(1);
  });
});

describe('marco watch', () => {
  it('rebuilds when the source changes', async () => {
    const dir = mkdtempSync(join(root, 'watch-'));
    const file = join(dir, 'w.marco.md');
    writeFileSync(file, '---\ntitle: 감시\n---\n# slide\ntitle: 처음\n');
    const io = capture(dir);
    const ac = new AbortController();
    const done = runWatch('w.marco.md', { fonts: 'none' }, io, ac.signal, 20);
    const waitFor = async (pred: () => boolean): Promise<void> => {
      for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 25));
    };
    await waitFor(() => io.stdout.some((l) => l.startsWith('변경을 감시합니다')));
    writeFileSync(file, '---\ntitle: 감시\n---\n# slide\ntitle: 바뀐 제목\n');
    await waitFor(() => readFileSync(join(dir, 'w.html'), 'utf8').includes('바뀐 제목'));
    ac.abort();
    expect(await done).toBe(0);
    expect(readFileSync(join(dir, 'w.html'), 'utf8')).toContain('바뀐 제목');
    expect(io.stdout.some((l) => l.includes('변경 감지'))).toBe(true);
  }, 15_000);

  it('rebuilds when a sidecar JSON file changes', async () => {
    const dir = mkdtempSync(join(root, 'watch-sidecar-'));
    writeFileSync(join(dir, 'sims.json'), '{"a": 1}');
    writeFileSync(
      join(dir, 's.marco.md'),
      '---\ntitle: 감시\nsims: sims.json\n---\n# slide\ntitle: A\n',
    );
    const io = capture(dir);
    const ac = new AbortController();
    const done = runWatch('s.marco.md', { fonts: 'none' }, io, ac.signal, 20);
    const waitFor = async (pred: () => boolean): Promise<void> => {
      for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 25));
    };
    await waitFor(() => io.stdout.some((l) => l.startsWith('변경을 감시합니다')));
    writeFileSync(join(dir, 'sims.json'), '{"changed": "바뀐 값"}');
    await waitFor(() => readFileSync(join(dir, 's.html'), 'utf8').includes('바뀐 값'));
    ac.abort();
    expect(await done).toBe(0);
    expect(readFileSync(join(dir, 's.html'), 'utf8')).toContain('"changed":"바뀐 값"');
  }, 15_000);
});

const MAIN = fileURLToPath(new URL('../dist/main.js', import.meta.url));
describe.runIf(existsSync(MAIN))('node apps/cli/dist/main.js', () => {
  it('runs new and build as a real process', () => {
    const dir = join(root, 'proc');
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [MAIN, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
    expect(run('new', 'proc', '--title', '프로세스')).toContain('새 강의를 만들었습니다');
    expect(run('build', 'proc/lecture.marco.md', '--fonts', 'none')).toContain(
      '✓ proc/lecture.html',
    );
    expect(readFileSync(join(dir, 'lecture.html'), 'utf8')).toContain(ATTRIBUTION);
    expect(readFileSync(MAIN, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true);
  });
});
