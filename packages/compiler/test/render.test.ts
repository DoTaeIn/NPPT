import { describe, expect, it } from 'vitest';
import { renderBlock, renderSlide, type Diagnostic } from '../src/index.js';
import type { Block, Lecture, Slide } from '../src/ir.js';

const SHIELD =
  '<svg aria-hidden="true" class="lucide lucide-shield" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';
const PLAY =
  '<svg aria-hidden="true" class="lucide lucide-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>';

const r = (block: Block, opts = {}) => renderBlock(block, 's-04-b1', opts);

describe('block skeletons (components.md §2)', () => {
  it('chain', () => {
    expect(
      r({
        type: 'chain',
        items: [{ no: '01', label: '자격 제시', sub: '카드를 리더에 댄다' }, { label: '인증' }],
      }),
    ).toBe(
      '<div class="decision-chain" id="s-04-b1" data-block="chain">' +
        '<article id="s-04-b1-i1"><span>01</span><b>자격 제시</b><small>카드를 리더에 댄다</small></article>' +
        '<article id="s-04-b1-i2"><span>02</span><b>인증</b></article></div>',
    );
  });

  it('cards with icon, tone, kicker and body', () => {
    expect(
      r({
        type: 'cards',
        cols: 2,
        items: [
          {
            kicker: '허용됐지만 안 들어감',
            title: '허용 신호 ≠ 실제 입실',
            body: '인증 뒤 문을 열지 않을 수도 있다.',
            icon: 'shield',
            tone: 'ok',
          },
          { title: '제목만' },
        ],
      }),
    ).toBe(
      '<div class="v-cards cols-2" id="s-04-b1" data-block="cards">' +
        `<article class="v-card tone-ok" id="s-04-b1-i1"><i class="icon" data-icon="shield">${SHIELD}</i><span class="v-kicker">허용됐지만 안 들어감</span><h3>허용 신호 ≠ 실제 입실</h3><p>인증 뒤 문을 열지 않을 수도 있다.</p></article>` +
        '<article class="v-card" id="s-04-b1-i2"><h3>제목만</h3></article></div>',
    );
  });

  it('cards with an unknown icon: no <i>, warning icon.unknown', () => {
    const warnings: Diagnostic[] = [];
    const html = r(
      { type: 'cards', cols: 3, items: [{ title: 'A', icon: 'not-an-icon' }] },
      { warn: (d: Diagnostic) => warnings.push(d), slideId: 's-04' },
    );
    expect(html).toBe(
      '<div class="v-cards cols-3" id="s-04-b1" data-block="cards"><article class="v-card" id="s-04-b1-i1"><h3>A</h3></article></div>',
    );
    expect(warnings).toEqual([
      expect.objectContaining({ level: 'warn', code: 'icon.unknown', slide: 's-04' }),
    ]);
  });

  it('takeaway', () => {
    expect(r({ type: 'takeaway', label: '핵심 구분', text: '인증은 **자격** 확인이다.' })).toBe(
      '<div class="takeaway" id="s-04-b1" data-block="takeaway"><b>핵심 구분</b><span>인증은 <b>자격</b> 확인이다.</span></div>',
    );
    expect(r({ type: 'takeaway', text: '라벨 없음' })).toBe(
      '<div class="takeaway" id="s-04-b1" data-block="takeaway"><span>라벨 없음</span></div>',
    );
  });

  it('table with caption and alignment', () => {
    expect(
      r({
        type: 'table',
        caption: '표 1',
        head: ['구역', '대상', '수'],
        align: ['l', 'c', 'r'],
        rows: [
          ['로비', '방문자', '3'],
          ['서버실', '직원', '1'],
        ],
      }),
    ).toBe(
      '<table class="v-table" id="s-04-b1" data-block="table"><caption>표 1</caption>' +
        '<thead><tr><th>구역</th><th class="c">대상</th><th class="r">수</th></tr></thead>' +
        '<tbody><tr id="s-04-b1-i1"><td>로비</td><td class="c">방문자</td><td class="r">3</td></tr>' +
        '<tr id="s-04-b1-i2"><td>서버실</td><td class="c">직원</td><td class="r">1</td></tr></tbody></table>',
    );
  });

  it('compare', () => {
    expect(
      r({
        type: 'compare',
        left: '스피드게이트',
        right: '맨트랩',
        rows: [{ label: '작동', left: '통로 개방', right: '두 문 인터락' }],
      }),
    ).toBe(
      '<div class="compare" id="s-04-b1" data-block="compare"><div class="compare-head"><span class="compare-label"></span><h3>스피드게이트</h3><h3>맨트랩</h3></div>' +
        '<div class="compare-row" id="s-04-b1-i1"><span class="compare-label">작동</span><div class="compare-cell left">통로 개방</div><div class="compare-cell right">두 문 인터락</div></div></div>',
    );
  });

  it('callout', () => {
    expect(
      r({ type: 'callout', kind: 'warn', title: '주의', body: 'UPS가 전원을 공급한다.' }),
    ).toBe(
      '<aside class="callout callout-warn" id="s-04-b1" data-block="callout"><b class="callout-title">주의</b><p>UPS가 전원을 공급한다.</p></aside>',
    );
  });

  it('steps', () => {
    expect(
      r({ type: 'steps', items: [{ title: '인사 종료', body: '기준일' }, { title: '회수' }] }),
    ).toBe(
      '<ol class="steps" id="s-04-b1" data-block="steps"><li id="s-04-b1-i1"><b>인사 종료</b><span>기준일</span></li><li id="s-04-b1-i2"><b>회수</b></li></ol>',
    );
  });

  it('bullets', () => {
    expect(r({ type: 'bullets', items: ['하나', '`둘`'] })).toBe(
      '<ul class="bullets" id="s-04-b1" data-block="bullets"><li id="s-04-b1-i1">하나</li><li id="s-04-b1-i2"><code>둘</code></li></ul>',
    );
  });

  it('columns number nested blocks under each col', () => {
    expect(
      r({
        type: 'columns',
        cols: 2,
        columns: [[{ type: 'paragraph', text: '왼쪽' }], [{ type: 'bullets', items: ['오른쪽'] }]],
      }),
    ).toBe(
      '<div class="columns cols-2" id="s-04-b1" data-block="columns">' +
        '<div class="col" id="s-04-b1-i1"><p class="s-p" id="s-04-b1-i1-b1" data-block="paragraph">왼쪽</p></div>' +
        '<div class="col" id="s-04-b1-i2"><ul class="bullets" id="s-04-b1-i2-b1" data-block="bullets"><li id="s-04-b1-i2-b1-i1">오른쪽</li></ul></div></div>',
    );
  });

  it('image with zoom, fit, height and processed data', () => {
    const opts = {
      assets: { campus: { src: 'data:image/png;base64,AAAA', width: 800, height: 450 } },
      lecture: {
        assets: { campus: { path: 'assets/campus.png', alt: '캠퍼스 전경', title: '캠퍼스' } },
      },
    };
    expect(
      r(
        {
          type: 'image',
          asset: 'campus',
          caption: '외곽 개념도',
          zoom: true,
          fit: 'cover',
          height: 520,
        },
        opts,
      ),
    ).toBe(
      '<figure class="figure fit-cover" id="s-04-b1" data-block="image" data-asset="campus" style="--h:520px">' +
        '<img src="data:image/png;base64,AAAA" alt="캠퍼스 전경" width="800" height="450">' +
        '<figcaption>외곽 개념도 <button class="image-open" data-asset="campus">이미지 확대 ↗</button></figcaption></figure>',
    );
    expect(r({ type: 'image', asset: 'campus' }, opts)).toBe(
      '<figure class="figure" id="s-04-b1" data-block="image" data-asset="campus"><img src="data:image/png;base64,AAAA" alt="캠퍼스 전경" width="800" height="450"></figure>',
    );
  });

  it('video', () => {
    expect(
      r({ type: 'video', video: 'abc123', start: 120, label: '우회 시연', caption: 'DEF CON 33' }),
    ).toBe(
      '<div class="video-reference" id="s-04-b1" data-block="video">' +
        `<button class="video-open" data-video="abc123" data-start="120"><i class="icon" data-icon="play">${PLAY}</i> 영상 · 우회 시연</button>` +
        '<p class="media-caption">DEF CON 33</p></div>',
    );
  });

  it('quote', () => {
    expect(r({ type: 'quote', text: '좋은 보안은 설계다.', cite: '강의 노트' })).toBe(
      '<blockquote class="quote" id="s-04-b1" data-block="quote"><p>좋은 보안은 설계다.</p><cite>강의 노트</cite></blockquote>',
    );
  });

  it('code escapes its content and never applies inline Markdown', () => {
    expect(
      r({ type: 'code', lang: 'bash', title: '설치', code: 'echo "<b>**x**</b>" && ls' }),
    ).toBe(
      '<figure class="code" id="s-04-b1" data-block="code"><figcaption>설치</figcaption><pre><code class="language-bash">echo &quot;&lt;b&gt;**x**&lt;/b&gt;&quot; &amp;&amp; ls</code></pre></figure>',
    );
  });

  it('pills', () => {
    expect(r({ type: 'pills', items: [{ tone: 'ok', text: '인증 성공' }, { text: '중립' }] })).toBe(
      '<div class="pills" id="s-04-b1" data-block="pills"><span class="pill tone-ok" id="s-04-b1-i1">인증 성공</span><span class="pill" id="s-04-b1-i2">중립</span></div>',
    );
  });

  it('verdict uses default labels', () => {
    const labels = (['allow', 'drop', 'ok', 'hot', 'info'] as const).map(
      (verdict) => /<b>(.*?)<\/b>/.exec(r({ type: 'verdict', verdict, text: 't' }))?.[1],
    );
    expect(labels).toEqual(['허용', '차단', '정상', '주의', '참고']);
    expect(r({ type: 'verdict', verdict: 'allow', label: '통과', text: '조건 충족' })).toBe(
      '<div class="verdict verdict-allow" id="s-04-b1" data-block="verdict"><b>통과</b><span>조건 충족</span></div>',
    );
  });

  it('timeline', () => {
    expect(
      r({ type: 'timeline', items: [{ at: '09:00', title: '퇴사 확정', body: '인사 반영' }] }),
    ).toBe(
      '<ol class="timeline" id="s-04-b1" data-block="timeline"><li id="s-04-b1-i1"><time>09:00</time><b>퇴사 확정</b><span>인사 반영</span></li></ol>',
    );
  });

  it('tiles', () => {
    expect(
      r({
        type: 'tiles',
        cols: 4,
        items: [
          { icon: 'shield', label: '소유', value: '카드', tone: 'primary' },
          { label: '지식' },
        ],
      }),
    ).toBe(
      '<div class="tiles cols-4" id="s-04-b1" data-block="tiles">' +
        `<div class="tile tone-primary" id="s-04-b1-i1"><i class="icon" data-icon="shield">${SHIELD}</i><b class="tile-label">소유</b><span class="tile-value">카드</span></div>` +
        '<div class="tile" id="s-04-b1-i2"><b class="tile-label">지식</b></div></div>',
    );
  });

  it('terms (its own text is not abbr-wrapped)', () => {
    expect(
      r(
        {
          type: 'terms',
          items: [{ abbr: 'LPR', en: 'License Plate Recognition', ko: '차량번호 인식' }],
        },
        { terms: { LPR: 'x' } },
      ),
    ).toBe(
      '<dl class="terms" id="s-04-b1" data-block="terms"><div class="term" id="s-04-b1-i1"><dt>LPR</dt><dd><i class="term-en">License Plate Recognition</i><span class="term-ko">차량번호 인식</span></dd></div></dl>',
    );
  });

  it('paragraph and lead', () => {
    expect(r({ type: 'paragraph', text: '본문 [링크](https://example.com)' })).toBe(
      '<p class="s-p" id="s-04-b1" data-block="paragraph">본문 <a href="https://example.com" target="_blank" rel="noopener noreferrer">링크</a></p>',
    );
    expect(r({ type: 'paragraph', text: '핵심', lead: true })).toBe(
      '<p class="s-p lead" id="s-04-b1" data-block="paragraph">핵심</p>',
    );
  });

  it('widget escapes JSON params for a single-quoted attribute', () => {
    expect(r({ type: 'widget', name: 'abac', params: { key: 'value', q: "it's <b>&" } })).toBe(
      `<div class="widget" id="s-04-b1" data-block="widget" data-widget="abac" data-params='{"key":"value","q":"it&#39;s &lt;b>&amp;"}'></div>`,
    );
    expect(r({ type: 'widget', name: 'quiz' })).toBe(
      '<div class="widget" id="s-04-b1" data-block="widget" data-widget="quiz"></div>',
    );
  });

  it('html passes through verbatim', () => {
    expect(r({ type: 'html', html: '<div class="x"><b>그대로</b></div>' })).toBe(
      '<div class="x"><b>그대로</b></div>',
    );
  });
});

describe('slide scaffolds (components.md §1)', () => {
  const lecture = (slides: Slide[], extra: Partial<Lecture> = {}): Lecture => ({
    ir: '0.1',
    meta: {
      title: '덱',
      course: '보안시스템 운영 및 활용',
      week: 3,
      date: '2026-09-29',
      presenter: '홍길동',
      lang: 'ko',
      theme: 'v20-violet',
      edition: 'instructor',
    },
    refs: [
      { id: 'S13', title: 'ISO 27001', url: 'https://iso.org', note: '물리 통제' },
      { id: 'L01', title: '소방시설법' },
    ],
    videos: [],
    assets: {},
    terms: {},
    slides,
    ...extra,
  });
  const one = (slide: Slide, extra: Partial<Lecture> = {}) =>
    renderSlide(slide, lecture([slide], extra), { dividerNo: 1 });

  it('content with header strip, wide body and source link', () => {
    expect(
      one({
        id: 's-04',
        type: 'content',
        tag: '기본 원리',
        group: '1부',
        title: '카드 **인식**과 허용',
        subtitle: '부제',
        question: '왜 다를까?',
        refs: ['S13', 'L01'],
        layout: 'wide',
        blocks: [{ type: 'paragraph', text: '본문' }],
      }),
    ).toBe(
      '<section class="slide" id="s-04" data-type="content" data-title="카드 인식과 허용" data-tag="기본 원리" data-group="1부">\n' +
        '<div class="slide-wrapper">\n' +
        '<header class="s-head"><div class="eyebrow">기본 원리</div><h2 class="section-title">카드 <b>인식</b>과 허용</h2><p class="s-sub">부제</p>' +
        '<div class="s-q"><span class="q-tag">질문</span><span class="q-text">왜 다를까?</span></div></header>\n' +
        '<div class="s-body layout-wide">\n<p class="s-p" id="s-04-b1" data-block="paragraph">본문</p>\n</div>\n' +
        '</div>\n' +
        '<footer class="slide-tag-bottom"><button class="source-link" data-source="s-04">참고 출처 S13 · L01 ↗</button> · 보안시스템 운영 및 활용 · 3주차</footer>\n' +
        '</section>',
    );
  });

  it('content without refs, tag or footer text', () => {
    expect(
      one(
        { id: 's-02', type: 'content', title: 'T', blocks: [] },
        { meta: { title: 'x', lang: 'ko', theme: 'v20-violet', edition: 'student' } },
      ),
    ).toBe(
      '<section class="slide" id="s-02" data-type="content" data-title="T">\n<div class="slide-wrapper">\n' +
        '<header class="s-head"><h2 class="section-title">T</h2></header>\n<div class="s-body">\n</div>\n</div>\n</section>',
    );
  });

  it('hero uses h1.hero-title and the alert class', () => {
    const html = one({
      id: 's-02',
      type: 'hero',
      alert: true,
      title: '질문',
      question: '들어가도 되는가?',
      blocks: [],
    });
    expect(html).toContain(
      '<section class="slide hero alert" id="s-02" data-type="hero" data-title="질문">',
    );
    expect(html).toContain(
      '<h1 class="hero-title">질문</h1><div class="s-q"><span class="q-tag">질문</span><span class="q-text">들어가도 되는가?</span></div>',
    );
  });

  it('cover', () => {
    expect(
      one({
        id: 's-01',
        type: 'cover',
        title: '물리보안 · 출입통제 IAM',
        subtitle: '기술과 운영',
        blocks: [],
      }),
    ).toBe(
      '<section class="slide cover" id="s-01" data-type="cover" data-title="물리보안 · 출입통제 IAM">\n' +
        '<div class="slide-wrapper"><div class="cover-main"><div class="cover-kicker">보안시스템 운영 및 활용 · 3주차</div><h1 class="cover-title">물리보안 · 출입통제 IAM</h1>' +
        '<p class="cover-sub">기술과 운영</p><div class="cover-meta"><span>2026-09-29</span><span>홍길동</span></div></div><div class="cover-brand"></div></div>\n' +
        '</section>',
    );
  });

  it('divider with explicit and automatic numbers', () => {
    expect(
      one({
        id: 'part-1',
        type: 'divider',
        no: '01',
        title: '인증과 하드웨어',
        subtitle: '문 앞과 문 뒤',
        blocks: [],
      }),
    ).toBe(
      '<section class="slide divider" id="part-1" data-type="divider" data-title="인증과 하드웨어">\n' +
        '<div class="slide-wrapper"><div class="cover-main"><div class="divider-no">01</div><h2 class="divider-title">인증과 하드웨어</h2><p class="divider-lead">문 앞과 문 뒤</p></div></div>\n' +
        '</section>',
    );
    expect(
      renderSlide({ id: 'd', type: 'divider', title: 'x', blocks: [] }, lecture([]), {
        dividerNo: 2,
      }),
    ).toContain('<div class="divider-no">02</div>');
  });

  it('quote slide', () => {
    expect(
      one({
        id: 's-10',
        type: 'quote',
        tag: '마무리',
        title: '설계가 먼저다.',
        cite: '3주차',
        blocks: [],
      }),
    ).toBe(
      '<section class="slide quote-slide" id="s-10" data-type="quote" data-title="설계가 먼저다." data-tag="마무리">\n' +
        '<div class="slide-wrapper"><div class="eyebrow">마무리</div><blockquote class="quote big"><p>설계가 먼저다.</p><cite>3주차</cite></blockquote></div>\n' +
        '</section>',
    );
  });

  it('references list all refs (or only) with links only for safe URLs', () => {
    expect(
      one({ id: 's-40', type: 'references', title: '참고 자료 · 공식 문서', blocks: [] }),
    ).toBe(
      '<section class="slide references" id="s-40" data-type="references" data-title="참고 자료 · 공식 문서">\n' +
        '<div class="slide-wrapper">\n' +
        '<header class="s-head"><div class="eyebrow">참고 자료</div><h2 class="section-title">참고 자료 · 공식 문서</h2></header>\n' +
        '<ol class="reference-list">\n' +
        '<li id="s-40-r1"><span class="r-no">S13</span><a class="r-title" href="https://iso.org" target="_blank" rel="noopener noreferrer">ISO 27001</a><span class="r-snippet">물리 통제</span></li>\n' +
        '<li id="s-40-r2"><span class="r-no">L01</span><span class="r-title">소방시설법</span></li>\n' +
        '</ol>\n</div>\n' +
        '<footer class="slide-tag-bottom">보안시스템 운영 및 활용 · 3주차</footer>\n' +
        '</section>',
    );
    const only = one({ id: 's-40', type: 'references', title: 'R', only: ['L01'], blocks: [] });
    expect(only).toContain('<li id="s-40-r1"><span class="r-no">L01</span>');
    expect(only).not.toContain('S13');
    const unsafe = renderSlide(
      { id: 'r', type: 'references', title: 'R', blocks: [] },
      lecture([], { refs: [{ id: 'X', title: 'x', url: 'javascript:alert(1)' }] }),
    );
    expect(unsafe).not.toContain('javascript:');
  });

  it('raw slide keeps the author HTML', () => {
    expect(
      one({
        id: 's-12',
        type: 'raw',
        title: '직접',
        html: '<div class="slide-wrapper">x</div>',
        blocks: [],
      }),
    ).toBe(
      '<section class="slide raw" id="s-12" data-type="raw" data-title="직접">\n<div class="slide-wrapper">x</div>\n</section>',
    );
  });
});

describe('lintIcons', () => {
  it('reports unknown icons in cards, tiles and nested columns', async () => {
    const { lintIcons } = await import('../src/index.js');
    const lecture = {
      ir: '0.1',
      meta: { title: 't', lang: 'ko', theme: 'v20-violet', edition: 'instructor' },
      refs: [],
      videos: [],
      assets: {},
      terms: {},
      slides: [
        {
          id: 's-01',
          type: 'content',
          title: 't',
          blocks: [
            {
              type: 'cards',
              cols: 2,
              items: [
                { title: 'a', icon: 'shield' },
                { title: 'b', icon: 'nope' },
              ],
            },
            {
              type: 'columns',
              cols: 2,
              columns: [[{ type: 'tiles', cols: 2, items: [{ label: 'x', icon: 'zzz' }] }], []],
            },
          ],
        },
      ],
    } satisfies Lecture;
    expect(lintIcons(lecture).map((i) => `${i.slide} ${i.code} ${i.path}`)).toEqual([
      's-01 icon.unknown /slides/0/blocks/0/items/1/icon',
      's-01 icon.unknown /slides/0/blocks/1/columns/0/0/items/0/icon',
    ]);
  });
});
