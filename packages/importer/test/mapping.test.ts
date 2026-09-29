/**
 * Second-pass mappings (components.md §4): each legacy family → existing components.
 * One small fixture per rule; the expected blocks are the contract.
 */
import { describe, expect, it } from 'vitest';
import { importLegacyDeck, type ImportedSlide } from '../src/index.js';
import { PNG_URI, v20Deck, v20Slide, v97Deck, v97Slide } from './helpers.js';

const v97 = (body: string, opts: Parameters<typeof v97Deck>[1] = {}) => {
  const result = importLegacyDeck(v97Deck([v97Slide(body)], opts));
  return { result, slide: result.lecture.slides[0] as ImportedSlide };
};
const v20 = (body: string, data: object = {}, css = '') => {
  const result = importLegacyDeck(v20Deck([v20Slide(body)], data, css));
  return { result, slide: result.lecture.slides[0] as ImportedSlide };
};

describe('v9.7 numbered flows', () => {
  it('maps `.row > .card` with a number badge to cards with the number in the kicker', () => {
    const card = (n: number, kicker: string, title: string, text: string, tag: string) =>
      `<div class="card" style="flex:1"><div class="row"><span class="pill navy">${n}</span><div><div style="font-size:18px">${kicker}</div><b style="font-size:26px">${title}</b></div></div><p>${text}</p><span class="pill gray">${tag}</span></div>`;
    const { slide, result } = v97(
      `<div class="row">${card(1, '초기 침투', '경계 장비 취약점', 'FortiOS SSL VPN <b>CVE-2018-13379</b> 등', 'ATT&amp;CK T1190')}<div class="flow-ar"><i data-lucide="chevron-right"></i></div>${card(2, '권한 상승', 'Zerologon', 'Netlogon 결함', 'ATT&amp;CK T1068')}</div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'cards',
        cols: 2,
        items: [
          {
            kicker: '1 · 초기 침투',
            title: '경계 장비 취약점',
            body: 'FortiOS SSL VPN **CVE-2018-13379** 등 · ATT&CK T1190',
          },
          { kicker: '2 · 권한 상승', title: 'Zerologon', body: 'Netlogon 결함 · ATT&CK T1068' },
        ],
      },
    ]);
    expect(result.report.fallbackBlocks).toBe(0);
  });

  it('maps a long `.flow > .st` sequence to cards and a short one to a chain', () => {
    const st = (n: number, title: string, text: string, hot = false) =>
      `<div class="st${hot ? ' hot' : ''}"><div class="n">${n}</div><h4>${title}</h4><p>${text}</p></div>`;
    const long = v97(
      `<div class="flow">${st(1, '변경 전 검증', '지금 규칙으로 <b>정상·차단 트래픽을 먼저 테스트</b>해 기준선을 남긴다')}<div class="arr"><i data-lucide="arrow-right"></i></div>${st(2, '원자적 적용', '새 규칙셋 전체를 한 번에 교체한다', true)}</div>`,
    );
    expect(long.slide.blocks).toEqual([
      {
        type: 'cards',
        cols: 2,
        items: [
          {
            kicker: '1',
            title: '변경 전 검증',
            body: '지금 규칙으로 **정상·차단 트래픽을 먼저 테스트**해 기준선을 남긴다',
          },
          {
            kicker: '2',
            title: '원자적 적용',
            body: '새 규칙셋 전체를 한 번에 교체한다',
            tone: 'primary',
          },
        ],
      },
    ]);
    const short = v97(
      `<div class="flow">${st(1, '검증', '기준선')}<div class="arr"></div>${st(2, '적용', '한 번에')}<div class="arr"></div>${st(3, '롤백', '즉시 복구')}</div>`,
    );
    expect(short.slide.blocks).toEqual([
      {
        type: 'chain',
        items: [
          { no: '1', label: '검증', sub: '기준선' },
          { no: '2', label: '적용', sub: '한 번에' },
          { no: '3', label: '롤백', sub: '즉시 복구' },
        ],
      },
    ]);
  });
});

describe('v9.7 label rows', () => {
  it('maps pill → card rows to a table without a header row', () => {
    const row = (label: string, text: string) =>
      `<div class="row"><span class="pill"><i data-lucide="shield"></i>${label}</span><i data-lucide="arrow-right"></i><div class="card"><span>${text}</span></div></div>`;
    const { slide } = v97(
      `<div class="col">${row('위치·구역', 'Zone(P13) · 매트릭스(P18)')}${row('NAT·PAT', 'NAT(P14) · 종합실습 T1·T2(P35)')}</div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'table',
        head: ['', ''],
        rows: [
          ['위치·구역', 'Zone(P13) · 매트릭스(P18)'],
          ['NAT·PAT', 'NAT(P14) · 종합실습 T1·T2(P35)'],
        ],
      },
    ]);
  });

  it('maps a card of `.k` + label rows to a captioned table', () => {
    const row = (label: string, text: string) =>
      `<div class="row" style="gap:14px"><b style="flex:0 0 250px">${label}</b><span>${text}</span></div>`;
    const { slide } = v97(
      `<div class="card"><div class="k">BMT 측정 체크리스트 <span class="mono">· RFC 9411</span></div>${row('보안 기능 모두 ON', 'IPS · 앱 식별')}${row('지연', 'TTFB · TTLB')}</div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'table',
        caption: 'BMT 측정 체크리스트 · RFC 9411',
        head: ['', ''],
        rows: [
          ['보안 기능 모두 ON', 'IPS · 앱 식별'],
          ['지연', 'TTFB · TTLB'],
        ],
      },
    ]);
  });

  it('maps `.trow` trend rows to a four-column table and keeps an appended link in its cell', () => {
    const trow = (n: number, title: string, text: string, tag: string, link = '') =>
      `<div class="trow"><div class="tn">${n}</div><div class="ti"><i data-lucide="network"></i></div><div class="tt"><b>${title}</b><span>${text}</span>${link}</div><span class="pill gray">${tag}</span></div>`;
    const { slide } = v97(
      `<div class="col">${trow(1, 'AI 내장', '머신러닝 탐지 + <b>운영 도우미</b>', '6주차 IPS')}${trow(2, 'N2SF', '개정 지침', '경계 통제', '<a href="https://example.org/n2sf">원문</a>')}</div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'table',
        head: ['', '', '', ''],
        rows: [
          ['1', 'AI 내장', '머신러닝 탐지 + **운영 도우미**', '6주차 IPS'],
          ['2', 'N2SF', '개정 지침 [원문](https://example.org/n2sf)', '경계 통제'],
        ],
      },
    ]);
  });
});

describe('v9.7 generation comparison', () => {
  it('maps `.gevo` columns to a table with one column per generation', () => {
    const col = (
      g: string,
      era: string,
      name: string,
      q: string,
      on: string[],
      mem: string,
      speed: number,
    ) =>
      `<div class="gcol"><div class="gera">${era}</div><div class="ghd"><div class="gic"><i data-lucide="filter"></i><span>1</span></div><div><div class="gg">${g}</div><div class="gn">${name}</div></div></div><div class="gq">${q}</div><div class="gsec">판단에 쓰는 정보</div><div class="glay">${[
        'L3',
        'L4',
        'L7',
      ]
        .map(
          (l) =>
            `<div class="gl${on.includes(l) ? ' on' : ''}"><b>${l}</b><span>${l}층</span><i data-lucide="eye"></i></div>`,
        )
        .join(
          '',
        )}</div><div class="gsec">기억하는 것</div><div class="gmem">${mem}</div><div class="gex drop">응답 → <b>DROP</b></div><div class="gmet"><div><span>처리 속도</span><em>${[
        1, 2, 3,
      ]
        .map((i) => `<i${i <= speed ? ' class="on"' : ''}></i>`)
        .join('')}</em></div></div></div>`;
    const { slide } = v97(
      `<div class="gevo">${col('1세대', '1980년대 ~', 'Stateless', '“맞나?”', ['L3', 'L4'], '없음', 3)}<div class="garr"><i data-lucide="chevrons-right"></i><b>+ 상태 기억</b></div>${col('2세대', '1990년대 ~', 'Stateful', '“대화인가?”', ['L3', 'L4', 'L7'], '상태 테이블', 2)}</div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'table',
        head: ['', '1세대 · Stateless', '2세대 · Stateful'],
        rows: [
          ['', '1980년대 ~', '1990년대 ~'],
          ['', '', '**+ 상태 기억**'],
          ['', '“맞나?”', '“대화인가?”'],
          ['판단에 쓰는 정보', 'L3 L3층 · L4 L4층', 'L3 L3층 · L4 L4층 · L7 L7층'],
          ['기억하는 것', '없음', '상태 테이블'],
          ['', '응답 → **DROP**', '응답 → **DROP**'],
          ['처리 속도', '●●●', '●●○'],
        ],
      },
    ]);
  });
});

describe('v9.7 product cards, card grids and strips', () => {
  it('maps `.pgrid` product cards to cards, keeps the photos as assets with their credit', () => {
    const pcard = (vendor: string, name: string, feats: string[], latest: string, credit: string) =>
      `<div class="pcard"><div class="ph"><img src="${PNG_URI}" alt="${name} 제품 사진"></div><div class="pv"><b>${vendor}</b><span>미국</span></div><div class="pn">${name}</div><ul class="pf">${feats.map((f) => `<li>${f}</li>`).join('')}</ul><div class="pl"><i data-lucide="sparkles"></i><div><b>2025-02</b> ${latest}</div></div><div class="ps">${credit}</div></div>`;
    const { slide, result } = v97(
      `<div class="pgrid g2">${pcard('Fortinet', 'FortiGate', ['ASIC 가속', '한 OS'], 'G 시리즈', '사진: fortinet.com')}${pcard('Cisco', 'Secure Firewall', ['Snort IPS'], '6100 시리즈', '사진: cisco.com')}</div>`,
      { css: '.pgrid.g2{grid-template-columns:repeat(2,1fr)}' },
    );
    expect(slide.blocks).toEqual([
      {
        type: 'cards',
        cols: 2,
        items: [
          {
            kicker: 'Fortinet · 미국',
            title: 'FortiGate',
            body: 'ASIC 가속 · 한 OS · **2025-02** G 시리즈',
          },
          {
            kicker: 'Cisco · 미국',
            title: 'Secure Firewall',
            body: 'Snort IPS · **2025-02** 6100 시리즈',
          },
        ],
      },
    ]);
    // The two photos are identical bytes, so they share one asset; the first credit wins.
    expect(Object.values(result.lecture.assets)).toEqual([
      expect.objectContaining({ title: 'FortiGate 제품 사진', credit: '사진: fortinet.com' }),
    ]);
    expect(result.report.dropped.map((d) => d.what)).toContain(
      'product photos in `.pgrid` cards (`cards` has no image; the assets stay in the front matter)',
    );
  });

  it('maps a `.qgrid` of `.card`s to cards with the grid’s own column count', () => {
    const card = (title: string, text: string) =>
      `<div class="card"><div class="row"><div class="icon-tile"><i data-lucide="circle-x"></i></div><h3>${title}</h3></div><p><b class="hl">→</b> ${text}</p></div>`;
    const { slide } = v97(
      `<div class="qgrid">${card('Q1. 차단 규칙', '방향 확인')}${card('Q2. 포워딩', 'dest 수정')}${card('Q3. 응답 드롭', 'SPI 전환')}${card('Q4. 롤백', '규칙 삭제')}</div>`,
      { css: '.qgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px}' },
    );
    expect(slide.blocks[0]).toMatchObject({ type: 'cards', cols: 2 });
    expect((slide.blocks[0] as { items: unknown[] }).items[0]).toEqual({
      title: 'Q1. 차단 규칙',
      body: '**→** 방향 확인',
      icon: 'circle-x',
    });
  });

  it('maps a `.strip` of steps to tiles with icons', () => {
    const { slide } = v97(
      `<div class="strip" style="margin-top:36px"><div class="sn fw"><div class="tile"><i data-lucide="brick-wall"></i></div><div class="l">5주차 방화벽</div></div><div class="sa on"></div><div class="sn" style="opacity:.6"><div class="tile"><i data-lucide="scan-search"></i></div><div class="l">6주차 IPS</div></div></div>`,
    );
    expect(slide.blocks).toEqual([
      {
        type: 'tiles',
        cols: 2,
        items: [
          { label: '5주차 방화벽', icon: 'brick-wall' },
          { label: '6주차 IPS', icon: 'scan-search' },
        ],
      },
    ]);
  });
});

describe('v9.x quiz', () => {
  const quiz =
    'window.QUIZ={"Q01":{"area":1,"areaName":"구역","q":"A?","opts":["a","b"],"ans":0},"Q02":{"area":1,"areaName":"구역","q":"B?","opts":["a","b"],"ans":1},"Q03":{"area":2,"areaName":"정책","q":"C?","opts":["a","b"],"ans":0}};';

  it('maps the exam launcher to `widget quiz mode=exam` with the deck’s default minutes', () => {
    const { slide, result } = v97(
      `<div class="diag-actions"><button class="card blue" data-exam=""><b>자가 진단 시험 시작 ▶</b><p>제한 시간을 직접 설정</p></button><button class="card" data-solutions="" type="button"><b>20문항 상세 풀이 열기</b></button></div>`,
      {
        script: `${quiz}\nfunction renderSetup(){ return '<input type="range" min="10" max="20" step="1" value="12" id="qx-min">'; }`,
      },
    );
    expect(slide.blocks).toEqual([
      { type: 'widget', name: 'quiz', params: { mode: 'exam', minutes: 12 } },
      { type: 'html', html: expect.stringContaining('data-solutions') },
    ]);
    expect(result.source).toContain(':::widget quiz mode=exam minutes=12\n:::');
    expect(result.report.unmapped).toEqual([
      { selector: 'button.card', reason: 'interactive', count: 1, slides: ['s-01'] },
    ]);
  });

  it('maps `.qcard[data-q]` review cards to `widget quiz mode=cards` (all, one area, or ids)', () => {
    const cards = (ids: string[]) =>
      `<div class="qgrid">${ids.map((id) => `<button class="qcard" data-q="${id}"><div class="qn"><b>${id}</b></div><div class="qt">문항</div></button>`).join('')}</div>`;
    const params = (ids: string[]) =>
      (v97(cards(ids), { script: quiz }).slide.blocks[0] as { params?: unknown }).params;
    expect(params(['Q01', 'Q02', 'Q03'])).toEqual({ mode: 'cards' });
    expect(params(['Q01', 'Q02'])).toEqual({ mode: 'cards', area: 1 });
    expect(params(['Q01', 'Q03'])).toEqual({ mode: 'cards', ids: 'Q01,Q03' });
  });
});

describe('v9.7 opening hero', () => {
  it('maps `.cover-wrap`: badge → tag, meta lines, visible question, SVG art', () => {
    const result = importLegacyDeck(
      v97Deck([
        `<section class="slide hero" data-group="표지 · 도입" data-title="방화벽 운영 및 실무" data-q="지난주 예고 질문 — 무엇을 기억해야 할까?" data-note=""><svg class="hero-art" viewBox="0 0 860 1080"><linearGradient id="g"></linearGradient><rect width="10" height="10"/></svg><div class="cover-wrap"><div class="cover-logos"><div class="cover-logo"></div></div><div class="cover-badge"><i data-lucide="shield-check"></i>WEEK 05</div><h1 class="cover-title">방화벽 운영 및 실무</h1><p class="cover-sub">네트워크 보안 시스템 2부</p><div class="cover-meta"><span><i data-lucide="calendar"></i>2026학년도 2학기 · 5주차</span><span>중앙대학교 산업보안학과</span></div><div class="cover-q"><i data-lucide="message-circle-question"></i><span>지난주 예고 질문</span>무엇을 기억해야 할까?</div></div>${'<div class="s-foot"><span class="brand"><span>보안시스템 운영 및 활용 · 5주차</span></span></div>'}</section>`,
      ]),
    );
    const hero = result.lecture.slides[0] as ImportedSlide;
    expect(hero).toMatchObject({
      type: 'hero',
      title: '방화벽 운영 및 실무',
      subtitle: '네트워크 보안 시스템 2부',
      tag: 'WEEK 05',
      meta: ['2026학년도 2학기 · 5주차', '중앙대학교 산업보안학과'],
      question: '무엇을 기억해야 할까?',
      art: 'hero-01',
      group: '표지 · 도입',
    });
    expect(hero.toc).toBeUndefined();
    expect(hero.blocks).toEqual([]);
    // The SVG file keeps the source's element-name case (linearGradient).
    const svg = new TextDecoder().decode(result.assets.find((a) => a.id === 'hero-01')!.bytes);
    expect(svg).toContain('<linearGradient id="g">');
    expect(result.source).toContain(
      'meta: [2026학년도 2학기 · 5주차, 중앙대학교 산업보안학과]\nart: hero-01\n',
    );
  });
});

describe('V20 composite layouts', () => {
  const assets = Object.fromEntries(
    ['udt', 'rex', 'latch', 'panic', 'thumb'].map((id) => [id, { title: id, data: PNG_URI }]),
  );
  const videos = [{ id: 'tTAISQqmxWQ', title: 'Intro', start: 441 }];

  it('maps `.equipment-grid` photo cards to 2 × 2 columns of image + paragraph', () => {
    const art = (id: string, title: string, en: string) =>
      `<article><figure class="v-figure"><button class="image-open" data-zoom="${id}"><img data-asset="${id}" alt="${title}"><span class="zoom-badge">이미지 확대 ↗</span></button><figcaption>${title}</figcaption></figure><h3>${title}</h3><small>${en}</small><p>${title} 설명.</p><b>점검 · ${title} 확인.</b></article>`;
    const { slide } = v20(
      `<div class="equipment-grid">${art('udt', '문 하부 접근 도구', 'Under-Door Tool')}${art('rex', '퇴실 요청 센서', 'REX')}${art('latch', '래치 보호판', 'Latch Guard')}${art('panic', '패닉바', 'Panic Exit Device')}</div>`,
      { assets },
      '.equipment-grid{display:grid;grid-template-columns:repeat(4,1fr)}\n.equipment-grid .image-open{height:215px;border-radius:12px}',
    );
    const cell = (id: string, title: string, en: string) => [
      { type: 'image', asset: id, zoom: true, height: 215 },
      { type: 'paragraph', text: `**${title}** · ${en} ${title} 설명. **점검 · ${title} 확인.**` },
    ];
    expect(slide.blocks).toEqual([
      {
        type: 'columns',
        cols: 2,
        columns: [
          cell('udt', '문 하부 접근 도구', 'Under-Door Tool'),
          cell('rex', '퇴실 요청 센서', 'REX'),
        ],
      },
      {
        type: 'columns',
        cols: 2,
        columns: [
          cell('latch', '래치 보호판', 'Latch Guard'),
          cell('panic', '패닉바', 'Panic Exit Device'),
        ],
      },
    ]);
  });

  it('maps `.pentest-videos` cards to video blocks with label, start, caption and text', () => {
    const card = `<article><button class="pentest-poster" data-video="tTAISQqmxWQ" data-start="441"><img data-asset="thumb" alt="썸네일"><span aria-hidden="true">▶</span></button><div class="pentest-content"><span class="pentest-date">공식 강연 · 게시 2025-10-10</span><h3>문틈·손잡이 우회 시연</h3><p class="pentest-title">Intro to Physical Security Bypass</p><p class="pentest-speakers">DEF CON 33<br>Karen Ng</p><p class="pentest-range">07:21–12:17</p><p class="pentest-lesson">래치 보호판 시연을 본다.</p><button class="action" data-video="tTAISQqmxWQ" data-start="441">▶ 07:21부터 재생</button></div></article>`;
    const { slide, result } = v20(
      `<div class="pentest-videos">${card}${card.replace('441', '441')}</div>`,
      {
        assets,
        videos,
      },
    );
    const col = [
      {
        type: 'video',
        video: 'tTAISQqmxWQ',
        start: 441,
        label: '문틈·손잡이 우회 시연',
        caption: 'Intro to Physical Security Bypass',
      },
      {
        type: 'paragraph',
        text: '공식 강연 · 게시 2025-10-10 · DEF CON 33 Karen Ng · 07:21–12:17',
      },
      { type: 'paragraph', text: '래치 보호판 시연을 본다.' },
    ];
    expect(slide.blocks).toEqual([{ type: 'columns', cols: 2, columns: [col, col] }]);
    expect(result.report.dropped.map((d) => d.what)).toEqual(
      expect.arrayContaining([
        'video card thumbnails (`video` shows no poster; the assets stay in the front matter)',
        'video card play buttons (the `video` block is the button)',
      ]),
    );
  });

  it('maps `v-cards cols-1` to 2-column cards alone and to bullets inside a column', () => {
    const stack = `<div class="v-cards cols-1"><article class="v-card"><span class="v-kicker">제1선 · 외곽</span><h3>사람과 차량</h3><p>펜스로 경로를 정한다.</p></article><article class="v-card"><span class="v-kicker">제2선 · 로비</span><h3>등록과 통과</h3><p>게이트로 관리한다.</p></article></div>`;
    expect(v20(stack).slide.blocks).toEqual([
      {
        type: 'cards',
        cols: 2,
        items: [
          { kicker: '제1선 · 외곽', title: '사람과 차량', body: '펜스로 경로를 정한다.' },
          { kicker: '제2선 · 로비', title: '등록과 통과', body: '게이트로 관리한다.' },
        ],
      },
    ]);
    const inColumn = v20(`<div class="split"><p>왼쪽 설명</p>${stack}</div>`).slide.blocks;
    expect(inColumn).toEqual([
      {
        type: 'columns',
        cols: 2,
        columns: [
          [{ type: 'paragraph', text: '왼쪽 설명' }],
          [
            {
              type: 'bullets',
              items: [
                '**제1선 · 외곽 · 사람과 차량** 펜스로 경로를 정한다.',
                '**제2선 · 로비 · 등록과 통과** 게이트로 관리한다.',
              ],
            },
          ],
        ],
      },
    ]);
  });

  it('maps `.final-references` to a references slide with `only` in the grouped order', () => {
    const link = (id: string) =>
      `<li><a data-reference-id="${id}" href="https://example.org/${id}"><small>${id}</small><span>${id}</span></a></li>`;
    const result = importLegacyDeck(
      v20Deck(
        [
          v20Slide(
            `<p class="reference-intro">자료 이름을 누르면 원문이 열린다.</p><div class="final-references"><article><h3><span>01</span>신원</h3><ul>${link('S02')}${link('S01')}</ul></article><article><h3><span>02</span>인증</h3><ul>${link('S03')}</ul></article></div><div class="reference-footer"><p>개념도는 생성했다.<br>인터넷이 필요하다.</p><button class="action secondary" data-media="">이미지·영상 출처 확인 ↗</button></div>`,
            { title: '출처 및 참고자료', tag: '참고 자료' },
          ),
        ],
        {
          refs: ['S01', 'S02', 'S03'].map((id) => ({
            id,
            title: id,
            url: `https://example.org/${id}`,
          })),
        },
      ),
    );
    const refs = result.lecture.slides[0] as ImportedSlide;
    expect(refs).toMatchObject({
      type: 'references',
      title: '출처 및 참고자료',
      tag: '참고 자료',
      only: ['S02', 'S01', 'S03'],
    });
    expect(refs.blocks).toEqual([
      { type: 'paragraph', text: '자료 이름을 누르면 원문이 열린다.' },
      { type: 'paragraph', text: '개념도는 생성했다. 인터넷이 필요하다.' },
    ]);
    expect(result.report.fallbackBlocks).toBe(0);
    expect(result.report.dropped.map((d) => d.what)).toEqual(
      expect.arrayContaining([
        'reference group headings (`01신원`, `02인증`; the list keeps their order)',
        'media-credit button (the runtime help dialog lists image and video credits)',
      ]),
    );
  });

  it('maps a divider: visible heading as title, data-title as toc, eyebrow as kicker, dark from CSS', () => {
    const result = importLegacyDeck(
      v20Deck(
        [
          `<section class="slide v20-slide divider" data-title="인증과 하드웨어" data-tag="1부" data-note="01 과목 문 앞과 문 뒤를 함께 본다. 외곽에서 핵심구역까지."><div class='div-content'><div class='big-num'>01</div><div><div class='div-eyebrow'>보안시스템 운영 및 활용 · 3주차</div><h2>문 앞과 문 뒤를<br>함께 본다.</h2><div class='div-desc'>외곽에서<br>핵심구역까지.</div></div></div><div class="slide-tag-bottom">보안시스템 운영 및 활용 · 3주차</div></section>`,
          v20Slide('<p>본문</p>'),
        ],
        {},
        '.divider h2{font-size:78px;color:#fff}',
      ),
    );
    const [divider, next] = result.lecture.slides as ImportedSlide[];
    expect(divider).toMatchObject({
      type: 'divider',
      dark: true,
      no: '01',
      title: '문 앞과 문 뒤를 함께 본다.',
      toc: '인증과 하드웨어',
      subtitle: '외곽에서 핵심구역까지.',
      kicker: '보안시스템 운영 및 활용 · 3주차',
      tag: '1부',
      group: '1부 · 인증과 하드웨어',
    });
    expect(next?.group).toBe('1부 · 인증과 하드웨어');
    expect(result.source).toContain(
      '# slide divider dark\ntitle: 문 앞과 문 뒤를 함께 본다.\ntoc: 인증과 하드웨어\n',
    );
  });
});

describe('titles', () => {
  it('uses the visible heading as title and keeps a different data-title as toc, never as subtitle', () => {
    const result = importLegacyDeck(
      v97Deck([
        v97Slide('<p>본문</p>', {
          title: '4주차 회수 · 개통 첫날',
          heading: '4주차 회수 — 개통 첫날',
        }),
        v97Slide('<p>본문</p>', { title: '같은 제목' }),
      ]),
    );
    const [a, b] = result.lecture.slides as ImportedSlide[];
    expect(a).toMatchObject({ title: '4주차 회수 — 개통 첫날', toc: '4주차 회수 · 개통 첫날' });
    expect(a?.subtitle).toBeUndefined();
    expect(b?.toc).toBeUndefined();
    expect(result.report.titleMismatches).toEqual([
      { slide: 's-01', title: '4주차 회수 · 개통 첫날', heading: '4주차 회수 — 개통 첫날' },
    ]);
    expect(result.source).toContain('title: 4주차 회수 — 개통 첫날\ntoc: 4주차 회수 · 개통 첫날\n');
  });
});
