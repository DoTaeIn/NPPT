import type { Block, Lecture } from '@marco/schema';
import { describe, expect, it } from 'vitest';
import { serializeBlock, serializeMarco } from '../src/index.js';
import { attr, cell, escapeLineStart } from '../src/serialize.js';

const lecture: Lecture = {
  ir: '0.1',
  meta: {
    title: '물리보안 · 출입통제 IAM',
    course: '보안시스템 운영 및 활용',
    week: 3,
    lang: 'ko',
    theme: 'v20-violet',
    edition: 'instructor',
  },
  refs: [{ id: 'S13', title: 'Axis Secure Entry', url: 'https://help.axis.com/' }],
  videos: [
    {
      id: 'tTAISQqmxWQ',
      title: 'Intro to Physical Security Bypass',
      start: 441,
      credit: 'DEFCONConference',
    },
  ],
  assets: {
    campus: {
      path: 'assets/campus.png',
      title: '사옥의 3선 방어 개념도',
      credit: 'imagegen 생성',
      alt: '외곽·로비·핵심구역',
    },
  },
  terms: { LPR: 'License Plate Recognition 차량번호 인식' },
  slides: [],
};

const BLOCKS: Block[] = [
  {
    type: 'chain',
    items: [
      { no: '01', label: '자격 제시', sub: '카드를 리더에 댄다' },
      { label: 'A|B', sub: '파이프 | 포함' },
      { label: '라벨만' },
    ],
  },
  {
    type: 'cards',
    cols: 2,
    items: [
      {
        kicker: '01 · 인증',
        title: '허용 신호 ≠ 실제 입실',
        body: '인증 뒤: 문을 열지 않을 수도 있다.',
        icon: 'shield',
        tone: 'ok',
      },
      { title: 'yes' },
    ],
  },
  { type: 'takeaway', label: '핵심 구분', text: '인증은 자격 확인, 인가는 허용 판단이다.' },
  { type: 'takeaway', text: '- 목록처럼 보이는 문장' },
  {
    type: 'table',
    head: ['구역', '대상'],
    rows: [
      ['외곽', '차량 | 탑승자'],
      ['로비', ''],
    ],
    align: ['l', 'c'],
  },
  { type: 'table', head: ['a', 'b'], rows: [['1', '2']], caption: '캡션 "따옴표"' },
  {
    type: 'compare',
    left: '스피드게이트',
    right: '맨트랩',
    rows: [{ label: '작동', left: '통로를 연다', right: '두 문 인터락' }],
  },
  { type: 'callout', kind: 'warn', title: '주의', body: '전원이 끊기면 잠금이 풀린다.' },
  { type: 'callout', kind: 'info', title: 'warn 이라는 단어로 시작', body: '본문' },
  { type: 'steps', items: [{ title: '신청', body: '필요한 구역을 신청한다' }, { title: '승인' }] },
  { type: 'bullets', items: ['첫째', '1. 번호처럼 보이는 항목', '# 제목처럼'] },
  {
    type: 'columns',
    cols: 2,
    columns: [
      [{ type: 'paragraph', text: '왼쪽' }],
      [{ type: 'pills', items: [{ text: '오른쪽' }] }],
    ],
  },
  { type: 'image', asset: 'campus', caption: '개념도 "그림"' },
  { type: 'image', asset: 'campus', caption: '확대 가능', zoom: true, fit: 'cover', height: 520 },
  {
    type: 'video',
    video: 'tTAISQqmxWQ',
    start: 441,
    label: '문틈 우회 시연',
    caption: '07:21부터',
  },
  { type: 'quote', text: '누구인지 확인하고, 필요한 권한만 허용한다.', cite: '3주차 마무리' },
  {
    type: 'code',
    lang: 'bash',
    title: 'rule',
    code: 'iptables -A INPUT -p tcp --dport 22 -j DROP\n```',
  },
  { type: 'pills', items: [{ tone: 'ok', text: '허용' }, { text: '중립: 콜론' }, { text: '01' }] },
  { type: 'verdict', verdict: 'drop', label: '차단', text: '3306은 외부에서 닿지 않는다.' },
  {
    type: 'timeline',
    items: [
      { at: '14:00', title: '활성', body: 'JIT 시작' },
      { at: '16:00', title: '만료' },
    ],
  },
  {
    type: 'tiles',
    cols: 3,
    items: [
      { icon: 'brick-wall', label: '5주차 방화벽', value: '현재', tone: 'primary' },
      { label: '6주차 IPS' },
    ],
  },
  {
    type: 'terms',
    items: [
      { abbr: 'LPR', en: 'License Plate Recognition', ko: '차량번호 인식' },
      { abbr: 'JML', ko: '입사·이동·퇴사' },
    ],
  },
  { type: 'paragraph', text: '평범한 문단.' },
  { type: 'paragraph', text: '1. 번호로 시작하는 문단' },
  { type: 'paragraph', text: '제목 같은 리드', lead: true },
  {
    type: 'widget',
    name: 'sim',
    params: {
      sim: 'g_ip',
      heading: 'IP 주소 · 서브넷',
      terms: '<div class="tconcept">긴 "HTML"</div>'.repeat(10),
    },
  },
  { type: 'html', html: '<div class="x">\n:::\n# slide\n</div>' },
];

describe('serializeBlock', () => {
  for (const block of BLOCKS) {
    it(`${block.type}`, () => {
      expect(serializeBlock(block, lecture)).toMatchSnapshot();
    });
  }
});

describe('serializeMarco', () => {
  it('writes front matter, slide headers, fields, body and notes', () => {
    const full: Lecture = {
      ...lecture,
      slides: [
        {
          id: 's-01',
          type: 'cover',
          title: '물리보안 · 출입통제 IAM',
          subtitle: '출입통제의 기술과 운영',
          blocks: [],
        },
        {
          id: 's-02',
          type: 'content',
          title: '카드 인식, 허용, 문 열림: 다른 단계',
          tag: '기본 원리',
          group: '1부 · 인증과 하드웨어',
          question: "'막음'의 뜻은?",
          refs: ['S13'],
          blocks: [BLOCKS[0]!, BLOCKS[2]!],
          note: {
            cues: [{ k: 'SAY', t: '카드를 리더에 댄다.' }],
            raw: '[대사] 카드를 리더에 댄다.',
          },
        },
        {
          id: 'principle',
          type: 'divider',
          title: '인증과 하드웨어',
          subtitle: '문 앞과 문 뒤를 함께 본다.',
          no: '01',
          blocks: [],
        },
        { id: 's-04', type: 'hero', alert: true, title: '사례 연구', blocks: [] },
      ],
    };
    const text = serializeMarco(full);
    expect(text).toMatchSnapshot();
    expect(text).toContain('# slide divider id=principle\n');
    expect(text).toContain('# slide hero alert\n');
    expect(text).toContain('title: "카드 인식, 허용, 문 열림: 다른 단계"\n');
    expect(serializeMarco(full)).toBe(text);
  });

  it('writes plugin data inline or as sidecar paths', () => {
    const withData: Lecture = {
      ...lecture,
      slides: [{ id: 's-01', type: 'content', title: 't', blocks: [] }],
      quiz: [{ id: 'Q01', q: '조건은?', opts: ['a', 'b'], ans: 1 }],
      sims: { big: 1 },
    };
    const inline = serializeMarco(withData);
    expect(inline).toContain('quiz:\n- id: Q01\n  q: 조건은?\n  opts:\n  - a\n  - b\n  ans: 1\n');
    expect(inline).toContain('sims:\n  big: 1\n');
    expect(serializeMarco(withData, { sidecars: { sims: 'sims.json' } })).toContain(
      'sims: sims.json\n',
    );
  });
});

describe('escaping helpers', () => {
  it('escapes pipes in cells and block starts in text', () => {
    expect(cell('a | b')).toBe('a \\| b');
    expect(escapeLineStart('- x')).toBe('\\- x');
    expect(escapeLineStart('12. x')).toBe('12\\. x');
    expect(escapeLineStart(':::html')).toBe('\\:::html');
    expect(escapeLineStart('보통 문장')).toBe('보통 문장');
  });

  it('quotes attribute values only when needed', () => {
    expect(attr('cols', 3)).toBe('cols=3');
    expect(attr('caption', '두 단어')).toBe('caption="두 단어"');
    expect(attr('caption', 'say "hi"')).toBe('caption="say \\"hi\\""');
    expect(attr('zoom', true)).toBe('zoom');
  });
});
