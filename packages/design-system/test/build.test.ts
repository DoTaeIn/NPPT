import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkg = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const dist = (p: string) => pkg(`dist/${p}`);
const specPath = fileURLToPath(new URL('../../../docs/spec/components.md', import.meta.url));

const FONT_FILES = [
  'Pretendard-Regular.woff2',
  'Pretendard-Medium.woff2',
  'Pretendard-SemiBold.woff2',
  'Pretendard-Bold.woff2',
  'SpoqaHanSans-Regular.woff2',
  'SpoqaHanSans-Medium.woff2',
  'SpoqaHanSans-Bold.woff2',
];

function read(file: string): string {
  if (!existsSync(file))
    throw new Error(`${file} is missing; run \`pnpm --filter @marco/design-system build\` first`);
  return readFileSync(file, 'utf8');
}

/** Class names used in selectors (declaration blocks, comments and strings removed). */
function selectorClasses(css: string): Set<string> {
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""')
    .replace(/\{[^{}]*\}/g, '{}');
  return new Set([...selectors.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]!));
}

/** class="…" values inside the fenced blocks and inline code spans of components.md. */
function specClasses(md: string): Set<string> {
  const code: string[] = [];
  const withoutFences = md.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body: string) => {
    code.push(body);
    return '';
  });
  for (const m of withoutFences.matchAll(/`([^`\n]+)`/g)) code.push(m[1]!);
  const names = new Set<string>();
  for (const snippet of code) {
    for (const m of snippet.matchAll(/class=(["'])(.*?)\1/g)) {
      for (const token of m[2]!.split(/\s+/)) {
        const name = token.replace(/^\[|\]$/g, '');
        if (/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name)) names.add(name);
      }
    }
  }
  return names;
}

describe('build outputs', () => {
  it('writes both bundles and the font files', () => {
    expect(existsSync(dist('marco.css'))).toBe(true);
    expect(existsSync(dist('marco.nofonts.css'))).toBe(true);
    const fonts = readdirSync(dist('fonts'));
    expect(fonts).toEqual(expect.arrayContaining([...FONT_FILES, 'fonts.json', 'OFL.txt']));
    for (const file of FONT_FILES) {
      const bytes = readFileSync(dist(`fonts/${file}`));
      expect(bytes.subarray(0, 4).toString('latin1'), file).toBe('wOF2');
    }
    const manifest = JSON.parse(read(dist('fonts/fonts.json'))) as {
      family: string;
      file: string;
    }[];
    expect(manifest.map((f) => f.file).sort()).toEqual(FONT_FILES.map((f) => `fonts/${f}`).sort());
  });

  it('inlines every font face in marco.css and none in marco.nofonts.css', () => {
    const full = read(dist('marco.css'));
    const faces = full.match(/@font-face\{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(FONT_FILES.length);
    for (const face of faces) expect(face).toContain('url(data:font/woff2;base64,');
    expect(full).toContain('SIL Open Font License');

    const nofonts = read(dist('marco.nofonts.css'));
    expect(nofonts).not.toContain('@font-face');
    expect(nofonts).not.toContain('data:font');
  });

  it('keeps marco.nofonts.css within 80 KB', () => {
    expect(statSync(dist('marco.nofonts.css')).size).toBeLessThanOrEqual(80 * 1024);
  });
});

describe('components.md contract', () => {
  const md = read(specPath);
  const css = read(dist('marco.nofonts.css'));
  const defined = selectorClasses(css);

  it('defines every class used in the component skeletons', () => {
    const used = specClasses(md);
    // The code block's language class is open-ended; it is styled by attribute selector.
    const languageClasses = [...used].filter((c) => c.startsWith('language-'));
    for (const c of languageClasses) used.delete(c);
    if (languageClasses.length) expect(css).toMatch(/\[class\*=["']?language-/);

    expect(used.size).toBeGreaterThan(60);
    const missing = [...used].filter((c) => !defined.has(c)).sort();
    expect(missing, `classes without a rule: ${missing.join(', ')}`).toEqual([]);
  });

  it('defines every tone, kind and column variant the catalog names', () => {
    const variants = [
      ...[...md.matchAll(/\btone-[a-z]+/g)].map((m) => m[0]),
      // callout kind = info/warn/ok/danger; verdict = allow/drop/ok/hot/info (components.md §2)
      ...['info', 'warn', 'ok', 'danger'].map((k) => `callout-${k}`),
      ...['allow', 'drop', 'ok', 'hot', 'info'].map((k) => `verdict-${k}`),
      ...['cols-2', 'cols-3', 'cols-4', 'cols-5'],
      // scaffold classes named in prose or added by the runtime
      'layout-wide',
      'active',
      'slide-no',
      'slide-progress',
    ];
    const missing = [...new Set(variants)].filter((c) => !defined.has(c)).sort();
    expect(missing, `variants without a rule: ${missing.join(', ')}`).toEqual([]);
  });

  it('ships the §3 type scale and spacing tokens with their contract values', () => {
    const section = md.slice(md.indexOf('## 3.'), md.indexOf('## 4.'));
    const rows = [...section.matchAll(/^\| `(--[a-z-]+)` \| ([^|]+?) \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(12);
    for (const [, name, value] of rows) {
      const pattern = new RegExp(`${name}:\\s*${value!.trim().replace(/ /g, '\\s+')}[;}]`);
      expect(css, `${name}: ${value}`).toMatch(pattern);
    }
  });

  it('scopes the themes to html[data-theme] with v20-violet as the default', () => {
    expect(css).toMatch(/html:not\(\[data-theme\]\),html\[data-theme=v20-violet\]\{/);
    expect(css).toMatch(/html\[data-theme=cau-navy\]\{/);
    // V20 and CAU values quoted in components.md §3
    for (const token of [
      '--primary: #6b4bff',
      '--navy: #1a1b4d',
      '--red: #ef1c5c',
      '--accent-blue: #3e9cf5',
    ]) {
      expect(css.toLowerCase()).toContain(token);
    }
    for (const token of [
      '--u-navy: #201d30',
      '--u-brand-text: #4663ae',
      '--u-err: #ee4c54',
      '--u-ok-fill: #32d8e3',
    ]) {
      expect(css.toLowerCase()).toContain(token);
    }
  });
});
