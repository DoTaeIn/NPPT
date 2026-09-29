/**
 * Generates `prompts/01-컴포넌트-치트시트.md` from `BUDGETS` (@marco/schema) and the source syntax
 * in docs/spec/components.md. The numbers always come from BUDGETS, so the prompt kit, the linter
 * and the design system cannot drift apart; the syntax examples below mirror components.md §2
 * and use sentences from the week-3 V20 deck so the model also sees the professor's voice.
 */
import * as schema from '@marco/schema';
import { BUDGETS } from '@marco/schema';
import type { BlockType } from '@marco/schema';

export type Budgets = typeof BUDGETS;

/** The part of `DENSITY` (@marco/schema src/budgets.ts) the cheat-sheet teaches. */
export interface Density {
  body: number;
  subtitle: number;
  question: number;
  gap: number;
  tolerance: number;
  block: {
    chain: number;
    cardsRow: Readonly<Record<number, number>>;
    takeaway: number;
    tableHead: number;
    tableRow: number;
    compareHead: number;
    compareRow: number;
    callout: number;
    stepsItem: number;
    bulletsItem: number;
    paragraphLine: number;
    paragraphChars: number;
    image: number;
    video: number;
    quote: number;
    codeLine: number;
    code: number;
    pills: number;
    verdict: number;
    timelineItem: number;
    tiles: number;
    termsRow: number;
    termsPerRow: number;
    widget: number;
    html: number;
  };
}

/**
 * Mirror of `DENSITY` in @marco/schema for as long as the package index does not export it
 * (a test keeps the two equal). When `@marco/schema` exports `DENSITY`, that table wins.
 */
export const DENSITY_MIRROR: Density = {
  body: 760,
  subtitle: 60,
  question: 71,
  gap: 28,
  tolerance: 0.1,
  block: {
    chain: 200,
    cardsRow: { 2: 200, 3: 180, 4: 180 },
    takeaway: 90,
    tableHead: 56,
    tableRow: 60,
    compareHead: 60,
    compareRow: 64,
    callout: 120,
    stepsItem: 64,
    bulletsItem: 44,
    paragraphLine: 44,
    paragraphChars: 90,
    image: 420,
    video: 96,
    quote: 140,
    codeLine: 36,
    code: 60,
    pills: 56,
    verdict: 72,
    timelineItem: 72,
    tiles: 160,
    termsRow: 90,
    termsPerRow: 3,
    widget: 400,
    html: 200,
  },
};

/** The slide-density table the linter uses (`budget.slide.dense`). */
export const DENSITY: Density =
  ((schema as Record<string, unknown>)['DENSITY'] as Density | undefined) ?? DENSITY_MIRROR;

/**
 * Limits documented in components.md §2 that BUDGETS does not carry. Keys that BUDGETS has
 * always win, so this only fills gaps.
 */
export const DOC_BUDGETS = {
  columns: { cols: '2–3' },
} as const;

/** Every block type of the IR the cheat-sheet documents, in components.md order. */
export const CHEATSHEET_BLOCKS = [
  'chain',
  'cards',
  'takeaway',
  'table',
  'compare',
  'callout',
  'steps',
  'bullets',
  'columns',
  'image',
  'video',
  'quote',
  'code',
  'pills',
  'verdict',
  'timeline',
  'tiles',
  'terms',
  'paragraph',
  'widget',
  'html',
] as const satisfies readonly BlockType[];

interface BlockDoc {
  /** Block type; also the BUDGETS / DOC_BUDGETS key when one exists. */
  key: BlockType;
  title: string;
  syntax: string[];
  notes?: string;
}

const T = '```';

const BLOCK_DOCS: BlockDoc[] = [
  {
    key: 'chain',
    title: '결정 체인(번호 단계)',
    syntax: [
      ':::chain',
      '01 | 자격 제시 | 카드를 리더에 댄다',
      '02 | 인증 | 유효한 자격인지 확인',
      ':::',
    ],
    notes: '줄 형식 `번호 | label | sub`. 번호를 빼면 자동으로 붙는다.',
  },
  {
    key: 'cards',
    title: '카드 격자',
    syntax: [
      ':::cards cols=2',
      '- kicker: 허용됐지만 안 들어감',
      '  title: 허용 신호 ≠ 실제 입실',
      '  body: 인증 뒤 문을 열지 않을 수도 있다. 문센서와 통과 감지는 별도로 확인한다.',
      '  icon: door-open',
      '  tone: warn',
      ':::',
      '',
      ':::cards cols=3',
      '인증 | 누구인가 | 카드·PIN·생체로 자격을 확인한다',
      '인가 | 들어가도 되는가 | 구역·시간·역할 조건을 본다',
      '기록 | 무엇이 남는가 | 허용과 거부를 모두 남긴다',
      ':::',
    ],
    notes:
      '줄 형식 `kicker | title | body`, `title | body`, `title`. icon·tone은 `- key: value` 형식에서만 쓴다. kicker·body·icon·tone은 생략 가능. tone: neutral·primary·ok·warn·danger·info. icon은 Lucide 이름(shield, lock, key-round, door-open, id-card, fingerprint, server, network, users, clock).',
  },
  {
    key: 'takeaway',
    title: '결론 띠',
    syntax: [':::takeaway 핵심 구분', '인증은 자격 확인, 인가는 허용 판단이다.', ':::'],
    notes: '첫 줄 뒤 단어가 label. 슬라이드마다 많아야 하나.',
  },
  {
    key: 'table',
    title: '표',
    syntax: [
      '| 구역 예 | 확인할 대상 | 출입통제의 역할 |',
      '|---|---|---|',
      '| 1층 로비 | 직원·방문자 | 정상 인증과 동반 통과를 구분한다. |',
    ],
    notes:
      '칸 예산은 열 수로 정한다. 모든 행의 칸 수를 머리글과 같게 쓴다. 캡션은 `:::table caption="…"`로 감싼다. 가운데 정렬은 `|:-:|`.',
  },
  {
    key: 'compare',
    title: '좌우 비교',
    syntax: [
      ':::compare left="스피드게이트" right="맨트랩"',
      '작동 | 인증 후 통로를 열고 통과를 감지한다 | 첫 문을 닫은 뒤 다음 문을 연다',
      ':::',
    ],
    notes: '줄 형식 `label | left | right`.',
  },
  {
    key: 'callout',
    title: '강조 상자',
    syntax: [':::callout warn 수치의 전제', '위 수치는 원리를 설명하기 위한 예다.', ':::'],
    notes: '종류 info(기본)·warn·ok·danger, 그 뒤가 title.',
  },
  {
    key: 'steps',
    title: '순서 목록',
    syntax: [
      '1. **신청** 필요한 구역과 시간을 적는다',
      '2. **승인** 다른 책임자가 필요성을 확인한다',
    ],
    notes: '또는 `:::steps` + `- title: …` `body: …`.',
  },
  {
    key: 'bullets',
    title: '글머리 목록',
    syntax: ['- 인증은 누구인지 확인한다', '- 인가는 허용 여부를 판단한다'],
  },
  {
    key: 'columns',
    title: '단 나누기',
    syntax: [':::columns cols=2', ':::col', '(블록)', ':::', ':::col', '(블록)', ':::', ':::'],
    notes: '안에는 한 단계만 넣는다.',
  },
  {
    key: 'image',
    title: '이미지',
    syntax: ['![외곽·로비·핵심구역 개념도](assets/campus.png "외곽·로비·핵심구역 개념도")'],
    notes:
      '경로에 공백이 있으면 `<…>`로 감싼다: `![alt](<assets/출입 통제.png> "caption")`. 또는 `:::image asset=campus caption="…" zoom height=420` + `:::`. front matter assets에 있는 것만 쓴다. 없으면 `TODO: 이미지 — 무엇`.',
  },
  {
    key: 'video',
    title: '영상 버튼',
    syntax: [':::video id=영상ID start=441 label="문틈 우회 시연" caption="DEF CON 33"', ':::'],
    notes: 'id는 front matter videos에 있는 것만. start는 초.',
  },
  {
    key: 'quote',
    title: '인용',
    syntax: ['> 누구인지 확인하고, 필요한 권한만 허용한다.', '> — 3주차 정리'],
  },
  {
    key: 'code',
    title: '코드',
    syntax: [`${T}bash title="규칙 확인"`, 'show rules', T],
    notes: '문장 속 `tcp/3389`는 코드 칩이 된다.',
  },
  {
    key: 'pills',
    title: '알약 표시',
    syntax: [':::pills', '- ok: 허용', '- danger: 차단', '- 기록', ':::'],
    notes: '`- tone: 텍스트` 또는 `- 텍스트`.',
  },
  {
    key: 'verdict',
    title: '판정',
    syntax: [':::verdict drop', '세션이 없는 SYN-ACK는 #99에서 폐기된다.', ':::'],
    notes: '종류 allow·drop·ok·hot·info, 그 뒤 label(기본 허용·차단·정상·주의·참고).',
  },
  {
    key: 'timeline',
    title: '타임라인',
    syntax: [':::timeline', 'D-7 | 신청 | 작업 구역과 기간을 적는다', ':::'],
    notes: '줄 형식 `at | title | body`.',
  },
  {
    key: 'tiles',
    title: '타일',
    syntax: [
      ':::tiles cols=3',
      'id-card | 인증 | 누구인가',
      'key-round | 인가 | 무엇을 허용',
      'scroll-text | 기록 | 남기고 검토',
      ':::',
    ],
    notes:
      '줄 형식 `icon | label | value | tone`, `icon | label | value`, `label | value`, `label`. `- icon: …` `label: …` 형식도 된다. 항목 수 = cols.',
  },
  {
    key: 'terms',
    title: '용어',
    syntax: [':::terms', 'MFA | Multi-Factor Authentication | 다중 요소 인증', ':::'],
    notes: '줄 형식 `abbr | en | ko`. front matter terms의 약어에는 풀이가 자동으로 붙는다.',
  },
  {
    key: 'paragraph',
    title: '문단',
    syntax: [
      '### 협력사 점검원의 카드는 정상이다. 하지만 안전교육이 어제 만료됐다.',
      '',
      '일반 문단은 그냥 쓴다. **굵게**, *기울임*, `코드`를 쓸 수 있다.',
    ],
    notes: '`###` 한 줄은 리드 문장(lead). 본문에 `#`·`##` 제목은 쓰지 않는다.',
  },
  {
    key: 'widget',
    title: '인터랙티브 위젯',
    syntax: [':::widget abac', ':::'],
    notes: '교수가 요청할 때만 쓴다.',
  },
  {
    key: 'html',
    title: 'HTML',
    syntax: [],
    notes: '쓰지 않는다.',
  },
];

/** Display names for count-type budget fields; `block.field` entries win over `field`. */
const COUNT_LABELS: Record<string, string> = {
  maxItems: '항목',
  maxRows: '행',
  maxCols: '열',
  maxLines: '줄',
  'code.maxCols': '줄 길이',
  cuesPerSlide: '슬라이드당 큐',
  cueText: '큐 하나',
};

/** Display label of a budget field: count labels, and `cellByCols` → `cell`. */
export function budgetLabel(key: string, field: string): string {
  return COUNT_LABELS[`${key}.${field}`] ?? COUNT_LABELS[field] ?? field.replace(/ByCols$/, '');
}

/**
 * "label ≤10 · sub ≤22"; per-column maps render as "body ≤90/60/40 (cols=2/3/4)". A scalar
 * field that also has a `<field>ByCols` map (table `cell`) is its fallback and is not shown.
 */
export function renderBudget(spec: unknown, key = ''): string {
  if (!spec || typeof spec !== 'object') return '';
  const fields = spec as Record<string, unknown>;
  const parts: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value === 'number' && `${field}ByCols` in fields) continue;
    const label = budgetLabel(key, field);
    if (typeof value === 'number') parts.push(`${label} ≤${value}`);
    else if (typeof value === 'string') parts.push(`${label} ${value}`);
    else if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      const nums = entries.map(([, v]) => String(v)).join('/');
      const keys = entries.map(([k]) => k).join('/');
      parts.push(`${label} ≤${nums} (cols=${keys})`);
    }
  }
  return parts.join(' · ');
}

function fence(lines: string[]): string {
  const body = lines.join('\n');
  const tick = body.includes(T) ? '````' : T;
  return `${tick}\n${body}\n${tick}`;
}

function budgetFor(key: string, budgets: Record<string, unknown>): string {
  const docs = DOC_BUDGETS as Record<string, unknown>;
  return renderBudget(budgets[key] ?? docs[key], key);
}

function slideTypesDoc(b: Record<string, unknown>): string[] {
  const quote = (b['quote'] ?? {}) as { text?: number; cite?: number };
  return [
    '- `# slide id=영문-id` 본문(기본): tag, title, question, refs, time, `layout: wide`',
    '- `# slide cover` 표지: title(보이는 제목, 문장도 된다), kicker(위 작은 줄, 생략하면 `과목 · N주차`), tagline(영문 대문자 한 줄), subtitle, `meta: [소속, 학기]`(아래 작은 줄들, 생략하면 날짜·발표자). 본문에는 `:::pills` 하나 정도',
    '- `# slide hero` 질문을 앞세운 도입: tag, title, question, 필요하면 kicker·tagline·meta. `# slide hero alert`는 경고형',
    '- `# slide divider` 부 구분: `no: 01`, title(부 이름), subtitle(한 줄 소개)',
    '- cover·hero·divider: `art: 에셋id`(오른쪽 그림, front matter assets에 있는 id만), 머리 줄 끝 `dark`(어두운 변형: `# slide cover dark`)',
    `- \`# slide quote\` 마무리 인용: title(인용문 ≤${quote.text ?? '?'}), cite(≤${quote.cite ?? '?'})`,
    '- `# slide references` 참고 자료: title, `only: [S1, S2]`(생략하면 전부)',
    '- 모든 유형: `group: 표지 · 도입`(목차 묶음), `toc: 짧은 이름`(제목이 문장이라 목차에는 다른 이름을 쓸 때)',
  ];
}

/** One paragraph teaching the slide-density estimate (lint `budget.slide.dense`). */
export function densityDoc(d: Density = DENSITY): string {
  const k = d.block;
  const both = d.body - d.subtitle - d.question;
  const pct = Math.round((1 + d.tolerance) * 100);
  const cards = `${k.cardsRow[2] ?? '?'}(cols=2)/${k.cardsRow[3] ?? '?'}(cols=3·4)`;
  return [
    `본문 높이(px): 제목 아래 ${d.body}, subtitle이 있으면 −${d.subtitle}, question이 있으면 −${d.question}(둘 다면 ${both}).`,
    `블록 어림: chain ${k.chain} · cards 한 줄 ${cards} · takeaway ${k.takeaway} · table ${k.tableHead}+행×${k.tableRow} · compare ${k.compareHead}+행×${k.compareRow} · callout ${k.callout} · steps 항목×${k.stepsItem} · bullets 항목×${k.bulletsItem} · 문단 ${k.paragraphChars}자마다 ${k.paragraphLine} · image ${k.image}(또는 height) · video ${k.video} · quote ${k.quote} · code 줄×${k.codeLine}+${k.code} · pills ${k.pills} · verdict ${k.verdict} · timeline 항목×${k.timelineItem} · tiles ${k.tiles} · terms ${k.termsPerRow}개마다 ${k.termsRow} · columns 가장 높은 단 · widget ${k.widget} · 블록 사이 ${d.gap}.`,
    `합이 본문 높이의 ${pct}%를 넘으면 블록을 빼거나 슬라이드를 나눈다.`,
  ].join(' ');
}

/** Render the component cheat-sheet (Korean Markdown) for the given budgets. */
export function renderCheatsheet(budgets: Budgets = BUDGETS): string {
  const b = budgets as unknown as Record<string, unknown>;
  const out: string[] = [
    '<!-- MARCO prompt kit · 01 component cheat-sheet. GENERATED by packages/ai/scripts/build-kit.ts from BUDGETS (@marco/schema) and docs/spec/components.md. Do not edit by hand: run `pnpm --filter @marco/ai build`. -->',
    '',
    '# 컴포넌트 치트시트',
    '',
    '`≤숫자`는 공백을 포함한 최대 글자 수(한글 1자 = 1, `**` 같은 표시 기호는 세지 않음), 항목·행·열은 최대 개수다.',
    '',
    '## 슬라이드 (slide)',
    '',
    fence([
      '# slide id=card-steps',
      'tag: 기본 원리',
      'title: 카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다',
      'question: 카드가 읽혔다면, 그 사람은 들어간 것일까?',
      'refs: [S13]',
      'time: 3분',
      '',
      '(본문 블록들)',
      '',
      '## note',
      '(해설)',
    ]),
    '',
    `예산: ${renderBudget(b['slide'], 'slide')}`,
    '',
    '필드는 머리 바로 아래 빈 줄 전까지 쓰고, 빈 줄 하나 뒤에 본문 블록을 쌓는다. 블록은 위에서 아래로 놓인다. 본문 안의 소제목은 `###`만 쓴다(`#`·`##`는 `# slide`·`## note` 전용).',
    '',
    ...slideTypesDoc(b),
    '',
    densityDoc(),
    '',
    '## 블록',
    '',
    '`:::` 블록의 항목은 `- key: value` 목록이나, 한 줄에 한 항목인 `a | b | c` 줄로 쓴다(칸 순서는 블록마다 아래와 같다). 칸 안의 `|`는 `\\|`로 쓴다.',
  ];
  const documented = new Set<string>();
  for (const doc of BLOCK_DOCS) {
    documented.add(doc.key);
    const budget = budgetFor(doc.key, b);
    out.push('', `### ${doc.key} · ${doc.title}${budget ? ` — ${budget}` : ''}`);
    if (doc.syntax.length) out.push('', fence(doc.syntax));
    if (doc.notes) out.push('', doc.notes);
  }
  // Budget keys without a hand-written entry still reach the model (future schema additions).
  for (const key of Object.keys(b)) {
    if (key === 'slide' || key === 'note' || documented.has(key)) continue;
    out.push(
      '',
      `### ${key} — ${renderBudget(b[key], key)}`,
      '',
      '문법은 docs/spec/components.md를 따른다.',
    );
  }
  out.push(
    '',
    '## 해설 (note)',
    '',
    `예산: ${renderBudget(b['note'], 'note')}. 문법은 해설 문법을 따른다.`,
    '',
  );
  return out.join('\n');
}
