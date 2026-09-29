/**
 * `repair_hint`: one short Korean instruction per diagnostic or lint issue that an AI can act on
 * directly. Derived from the lint code table in docs/spec/ir.md §5 (and the parser's `format.*`
 * families); numbers (current length, budget) are taken from the issue message when present.
 */

export interface HintInput {
  code: string;
  message: string;
  level?: 'error' | 'warn' | 'info';
}

/** "cards[1].body: 104자 (허용 90자)" → { have: 104, max: 90, unit: '자' }. */
function numbers(message: string): { have: number; max: number; unit: string } | undefined {
  const m = /(\d+)(자|개|행|열|줄) \(허용 (\d+)\2\)/.exec(message);
  return m ? { have: Number(m[1]), max: Number(m[3]), unit: m[2]! } : undefined;
}

const TRIM_TO_NOTE = '핵심어만 남기고 부연 설명은 해설(## note)로 옮긴다.';
const AUTHOR = '작성자(교수)가 확인할 항목이므로 AI가 내용을 지어내 고치지 않는다.';

/** Exact codes (docs/spec/ir.md §5 and the compiler's own codes). */
const EXACT: Record<string, string> = {
  'budget.slide.dense':
    '본문이 슬라이드 높이를 넘친다. 메시지의 "가장 큰 블록"부터 줄이거나(항목·행 수, 문장 길이) 블록 하나를 빼거나 슬라이드를 둘로 나눈다. subtitle·question 줄도 본문 높이를 줄인다.',
  'budget.table.rows': '표를 8행 이하로 줄인다. 비슷한 행을 합치거나 표를 두 슬라이드로 나눈다.',
  'budget.table.cols': '표를 6열 이하로 줄인다. 열이 적을수록 칸 글자 예산이 커진다.',
  'budget.table.cell':
    '칸 글자를 허용 이하로 줄인다. 칸 예산은 열 수로 정해진다(2열 40·3열 30·4열 20·5열 16·6열 12자) — 열을 줄이는 것도 방법이다. 긴 설명은 해설(## note)로 옮긴다.',
  'budget.code.lines': '코드를 12줄 이하로 줄인다. 핵심 줄만 남기고 나머지는 `…` 한 줄로 생략한다.',
  'budget.code.cols': '코드 한 줄을 80자 이하로 줄이거나 줄바꿈한다.',
  'ref.missing':
    '머리말 refs에 없는 출처 id다. 있는 id로 바꾸거나, 머리말 refs에 항목을 추가하거나(URL을 지어내지 않는다), 인용을 지우고 `TODO: 출처 필요 — 무엇`을 남긴다.',
  'ref.unused': `어느 슬라이드도 인용하지 않는 출처다. 관련 슬라이드의 refs: [..]에 넣거나 머리말에서 지운다. ${AUTHOR}`,
  'asset.missing':
    '머리말 assets에 없는 이미지 id다. assets에 `id: { path: assets/파일.png }`를 추가하거나 본문에 `![대체 텍스트](assets/파일.png)`처럼 경로로 쓴다. 파일이 없으면 이미지를 빼고 `TODO: 이미지 필요`를 남긴다.',
  'video.missing':
    '머리말 videos에 없는 영상 id다. videos에 YouTube id를 추가하거나 video 블록을 지운다. 영상 id를 지어내지 않는다.',
  'slide.id.duplicate': '슬라이드 id가 겹친다. 뒤 슬라이드 머리줄의 `id=`를 고유한 값으로 바꾼다.',
  'slide.title.missing': '`# slide` 바로 아래 필드 블록(빈 줄 전)에 `title: …`을 쓴다.',
  'columns.nested':
    '`:::columns` 안에 `:::columns`를 넣을 수 없다. 한 단계로 펴거나 슬라이드를 나눈다.',
  'columns.count': '`:::columns cols=N`의 N을 실제 `:::col` 개수와 맞춘다.',
  'table.ragged':
    '표의 모든 행이 머리 행과 같은 칸 수를 갖게 한다(빈 칸은 `-`로 채우거나 칸을 합친다).',
  'icon.unknown':
    'Lucide 아이콘 이름이 아니다. lucide.dev의 kebab-case 이름(예: shield-check, lightbulb, lock, user, key-round)으로 바꾸거나 icon 필드를 지운다.',
  'quiz.ans.range': 'quiz의 `ans`는 opts의 0부터 세는 번호다. 보기 범위 안의 번호로 고친다.',
  'note.marker.unknown':
    '알 수 없는 해설 마커다. [대사] [조작] [주목] [발문] [이동] [예상질문] [예상답변] [전환] [팁] [대기] [화면] [검증] [메모] [시간] 중 하나로 바꾼다.',
  'note.time.invalid': '`[시간]`은 해설마다 한 번만, `2.5분 · 10:00 – 12:30` 형식으로 쓴다.',
  'note.cues.over': '해설 큐가 30개를 넘는다. 짧은 큐를 합치거나 덜 중요한 큐를 뺀다.',
  'note.cue.long': '큐 하나가 600자를 넘는다. 여러 [대사] 큐로 나눈다.',
  'note.cue.id.duplicate': '큐 id `{{pNN-cKKK}}`가 겹친다. 뒤의 것을 `{{auto}}`로 바꾸거나 지운다.',
  'term.unused': `머리말 terms의 약어가 본문·해설에 나오지 않는다. 쓰지 않으면 머리말에서 지운다. ${AUTHOR}`,
  'content.todo': `\`TODO:\` 표시가 남아 있다. 사실 확인이 필요한 자리이므로 ${AUTHOR}`,
  'time.total':
    '해설 [시간] 합계다. warn이면 합계가 머리말 duration을 넘은 것이니 슬라이드별 [시간]을 줄이거나 duration을 확인한다(작성자 판단).',
  'schema.invalid':
    'IR 구조 오류다. 메시지의 경로가 가리키는 필드를 고친다: unknown property는 오타(메시지의 제안 참고), 형식 오류는 값의 종류를 맞춘다.',
  'schema.normalize': '원고를 IR로 바꾸지 못했다. 같은 줄의 다른 format.* 오류를 먼저 고친다.',
  'schema.lint':
    '린터 내부 오류다. 원고 문제가 아닐 수 있으니 다른 오류를 먼저 고친 뒤 다시 빌드한다.',
  'asset.remote': '원격 URL 이미지는 덱에 넣을 수 없다. 파일을 assets/에 두고 상대 경로로 쓴다.',
  'build.runtime.missing':
    '엔진 설치 문제(런타임 번들 없음)다. 원고를 고칠 필요는 없다 — 엔진을 다시 빌드·설치한다.',
  'build.css.missing':
    '엔진 설치 문제(디자인 시스템 CSS 없음)다. 원고를 고칠 필요는 없다 — 엔진을 다시 빌드·설치한다.',
  'mcp.path.outside':
    '원고가 서버 루트 밖의 파일을 가리킨다. 이미지·JSON 파일을 덱 폴더(루트 안)로 옮기고 원고 기준 상대 경로(assets/…)로 쓴다.',
  'format.heading.level': '본문 소제목은 `###`만 쓴다. `#`·`##`는 `# slide`와 `## note` 전용이다.',
  'format.image.remote':
    '원격·data URL 이미지는 넣을 수 없다. 파일을 assets/에 두고 상대 경로로 쓰거나 이미지를 빼고 `TODO: 이미지 필요`를 남긴다.',
  'format.hr.ignored': '본문의 `---` 구분선은 무시된다. 지운다.',
  'format.list.nested':
    '목록은 한 단계만 쓴다. 하위 항목은 문장으로 합치거나 cards·steps로 바꾼다.',
  'format.raw.empty': '`# slide raw`는 쓰지 않는다. 일반 슬라이드와 컴포넌트로 바꾼다.',
  'format.slide.none': '파일에 `# slide` 줄이 없다. 슬라이드마다 줄 맨 앞에 `# slide`로 시작한다.',
  'format.widget.params': '`:::widget` 매개변수를 `key=value`로 고친다(치트시트 참고).',
};

/** Code families, longest prefix first. */
const FAMILIES: [prefix: string, hint: string][] = [
  [
    'format.container.',
    '`:::이름` … `:::` 짝을 맞추고 치트시트(marco_kit section="cheatsheet")에 있는 컨테이너 이름만 쓴다. 중첩은 `:::columns` → `:::col` 한 단계만 된다.',
  ],
  [
    'format.item.',
    '컨테이너 항목을 치트시트 형식에 맞춘다: `- key: value` YAML 목록, 또는 한 줄에 한 항목인 `a | b | c` 파이프 행.',
  ],
  [
    'format.attr.',
    '컨테이너 속성은 `key=value`, `key="따옴표 값"` 또는 플래그만 쓴다. 허용 속성은 치트시트를 본다.',
  ],
  [
    'format.field.',
    '슬라이드 필드는 `# slide` 다음 줄부터 빈 줄 전까지 `key: value`로 쓴다. 알 수 없는 필드는 오타를 고친다(메시지의 제안 참고).',
  ],
  [
    'format.slide.',
    '슬라이드 머리줄은 `# slide [종류] [alert|dark] [id=…]` 형식이다. 종류: cover, divider, quote, hero, references (AI는 raw를 쓰지 않는다).',
  ],
  [
    'format.frontmatter.',
    '머리말은 파일 첫 줄 `---`부터 다음 `---`까지의 YAML이다. 들여쓰기·따옴표를 고치고 refs·videos·assets·terms를 형식대로 쓴다(marco_spec name="format" §2).',
  ],
  [
    'format.meta.',
    '머리말 값을 고친다: title 필수, week는 숫자, theme는 v20-violet|cau-navy, edition은 student|instructor.',
  ],
  [
    'format.note.',
    '해설은 슬라이드 끝의 `## note` 아래 한 곳에만 쓰고 [시간]은 한 번만 쓴다(marco_spec name="notes").',
  ],
  ['format.table.', 'GFM 표 형식을 맞춘다: 머리 행, `|---|` 구분 행, 같은 칸 수의 본문 행.'],
  ['format.columns.', '`:::columns cols=N` 안에는 `:::col` … `:::` 블록만 N개 둔다.'],
  [
    'format.sidecar.',
    '머리말 quiz·sims·terminals의 JSON 파일 경로(원고 파일 기준 상대 경로)와 내용을 확인한다. 원격 경로는 쓸 수 없다.',
  ],
  [
    'format.image.',
    '이미지는 `![대체 텍스트](assets/파일.png "캡션")`를 한 단락에 단독으로 쓰거나, 머리말 assets id로 `:::image asset=id`처럼 부른다.',
  ],
  [
    'format.asset.',
    '머리말 assets에 있는 id만 쓴다. 새 이미지는 assets에 `id: { path: assets/파일 }`로 등록한다.',
  ],
  [
    'format.html.',
    'AI는 `:::html`을 쓰지 않는다. 같은 내용을 컴포넌트(cards, table, callout …)로 바꾼다.',
  ],
  [
    'format.',
    '메시지가 가리키는 줄을 MARCO 문법에 맞게 고친다(marco_spec name="format", 컨테이너는 marco_kit section="cheatsheet").',
  ],
  [
    'schema.',
    'IR 구조 오류다. 메시지의 경로가 가리키는 필드를 고친다(unknown property는 오타 확인).',
  ],
  [
    'asset.',
    '이미지 파일을 확인한다(경로는 원고 파일 기준). source_text만 넘겨 빌드했다면 기준 폴더가 .marco/mcp/이므로, 이미지가 있는 덱은 source_path로 덱 폴더에 저장해 빌드한다.',
  ],
  [
    'font.',
    '글꼴 처리 경고다. 원고를 고칠 필요는 없다; fonts="subset"|"embed"|"none"으로 다시 빌드할 수 있다.',
  ],
  ['build.', '엔진 설치 문제다. 원고를 고칠 필요는 없다 — 엔진을 다시 빌드·설치한다.'],
  ['note.', '해설 문법(marco_spec name="notes")에 맞게 고친다.'],
];

const SLIDE_FIELD_LABEL: Record<string, string> = {
  title: 'title',
  subtitle: 'subtitle',
  tag: 'tag',
  question: 'question',
};

/** Hint for `budget.<block>.<field>` codes (text length and item counts). */
function budgetHint(code: string, message: string): string | undefined {
  const m = /^budget\.([a-z]+)\.([a-z]+)$/.exec(code);
  if (!m) return undefined;
  const [, block, field] = m as unknown as [string, string, string];
  const n = numbers(message);
  const now = n ? `(지금 ${n.have}${n.unit})` : '';
  if (block === 'slide' && SLIDE_FIELD_LABEL[field]) {
    return `슬라이드 \`${field}:\`를 ${n ? `${n.max}자 이하로` : '예산 안으로'} 줄인다${now}. ${field === 'title' ? '한 문장 요지로 쓰고 부연은 subtitle이나 본문으로 옮긴다.' : TRIM_TO_NOTE}`;
  }
  if (field === 'items' || field === 'rows') {
    const cols =
      block === 'cards'
        ? ' cards 허용 개수는 cols로 정해진다(2열 4·3열 6·4열 8개).'
        : block === 'tiles'
          ? ' tiles는 cols 수만큼만 둔다.'
          : '';
    return `:::${block} 항목을 ${n ? `${n.max}${n.unit} 이하로` : '허용 개수 이하로'} 줄인다${now}. 비슷한 항목을 합치거나 슬라이드를 둘로 나눈다.${cols}`;
  }
  const cardsBody =
    block === 'cards' && field === 'body'
      ? ' cards 본문 예산은 cols로 정해진다(2열 90·3열 60·4열 40자).'
      : '';
  return `:::${block}의 \`${field}\`를 ${n ? `${n.max}자 이하로` : '예산 안으로'} 줄인다${now}. ${TRIM_TO_NOTE}${cardsBody}`;
}

/** Short Korean instruction for fixing one diagnostic or lint issue. */
export function repairHint(issue: HintInput): string {
  const exact = EXACT[issue.code];
  if (exact) return exact;
  const budget = budgetHint(issue.code, issue.message);
  if (budget) return budget;
  for (const [prefix, hint] of FAMILIES) if (issue.code.startsWith(prefix)) return hint;
  return '메시지를 읽고 해당 슬라이드를 MARCO 문법과 치트시트(marco_kit)에 맞게 고친다.';
}

/** Codes whose issues go to the author rather than to the model (docs/spec/ir.md §6). */
export const AUTHOR_CODES: ReadonlySet<string> = new Set([
  'ref.unused',
  'term.unused',
  'content.todo',
  'time.total',
]);
