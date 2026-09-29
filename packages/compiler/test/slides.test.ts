/**
 * Title-slide skeletons (components.md §1 "cover, hero and divider"): kicker, tagline, meta,
 * art, toc, dark and body blocks. Built from IR objects, independent of the parser.
 */
import { describe, expect, it } from 'vitest';
import type { Lecture, Slide } from '../src/ir.js';
import { renderBlock } from '../src/render/blocks.js';
import { renderLecture, renderSlide } from '../src/render/slides.js';

const lecture = (slides: Slide[], extra: Partial<Lecture> = {}): Lecture => ({
  ir: '0.1',
  meta: {
    title: '물리보안',
    course: '보안시스템 운영 및 활용',
    week: 3,
    date: '2026-09-29',
    presenter: '홍길동',
    lang: 'ko',
    theme: 'v20-violet',
    edition: 'instructor',
  },
  refs: [{ id: 'S13', title: 'Axis Secure Entry' }],
  videos: [],
  assets: {
    campus: { path: 'assets/campus.png', title: '사옥 **개념도**', alt: '사옥의 외곽·로비 개념도' },
    wall: { path: 'assets/wall.svg', title: '방화벽 **그림**' },
  },
  terms: {},
  slides,
  ...extra,
});

const assets = {
  campus: { src: 'data:image/png;base64,AAAA', width: 1672, height: 941 },
};

const render = (slide: Slide, extra: Partial<Lecture> = {}): string =>
  renderSlide(slide, lecture([slide], extra), { assets, dividerNo: 1 });

const pills: Slide['blocks'] = [
  {
    type: 'pills',
    items: [{ text: '인증 · 통신 · 피난 · 권한' }, { text: '본문으로 이해하는 출입통제' }],
  },
];

describe('cover', () => {
  it('renders the full §1 skeleton with art, fields and body blocks', () => {
    expect(
      render({
        id: 's-01',
        type: 'cover',
        group: '표지 · 도입',
        title: '문을 여는 기술, 권한을 다루는 설계.',
        toc: '물리보안 · 출입통제 IAM',
        kicker: '보안시스템 운영 및 활용 · 3주차',
        tagline: 'PHYSICAL ACCESS × IDENTITY',
        subtitle: '장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.',
        question: '사원증이 유효하면 들어가도 되는가?',
        meta: ['중앙대학교 산업보안학과', 'Curriculum v3 · V20'],
        art: 'campus',
        blocks: pills,
      }),
    ).toBe(
      '<section class="slide cover" id="s-01" data-type="cover" data-title="물리보안 · 출입통제 IAM" data-group="표지 · 도입">\n' +
        '<div class="slide-wrapper has-art"><div class="cover-main">' +
        '<div class="cover-kicker">보안시스템 운영 및 활용 · 3주차</div>' +
        '<h1 class="cover-title">문을 여는 기술, 권한을 다루는 설계.</h1>' +
        '<div class="cover-tagline">PHYSICAL ACCESS × IDENTITY</div>' +
        '<p class="cover-sub">장비가 어떻게 문을 제어하는지 이해하고, 누가 언제 들어갈 수 있는지 설계한다.</p>' +
        '<div class="s-q"><span class="q-tag">질문</span><span class="q-text">사원증이 유효하면 들어가도 되는가?</span></div>' +
        `<div class="s-body">\n${renderBlock(pills[0]!, 's-01-b1')}\n</div>` +
        '<div class="cover-meta"><span>중앙대학교 산업보안학과</span><span>Curriculum v3 · V20</span></div>' +
        '</div>' +
        '<figure class="cover-art" data-asset="campus"><img src="data:image/png;base64,AAAA" alt="사옥의 외곽·로비 개념도" width="1672" height="941"></figure>' +
        '<div class="cover-brand"></div></div>\n' +
        '</section>',
    );
  });

  it('defaults kicker and meta from front matter, escaped as plain text', () => {
    const html = render(
      { id: 's-01', type: 'cover', title: '표지', blocks: [] },
      {
        meta: {
          title: 't',
          course: '보안 <시스템> *운영*',
          week: 3,
          presenter: 'A & B',
          lang: 'ko',
          theme: 'cau-navy',
          edition: 'student',
        },
      },
    );
    expect(html).toContain('<div class="cover-kicker">보안 &lt;시스템&gt; *운영* · 3주차</div>');
    expect(html).toContain('<div class="cover-meta"><span>A &amp; B</span></div>');
    expect(html).toContain('<div class="slide-wrapper"><div class="cover-main">');
    expect(html).not.toContain('cover-art');
    expect(html).not.toContain('s-body');
  });

  it('keeps an explicit empty kicker or meta (no defaults, no empty elements)', () => {
    const html = render({
      id: 's-01',
      type: 'cover',
      title: '표지',
      kicker: '',
      meta: [],
      blocks: [],
    });
    expect(html).not.toContain('cover-kicker');
    expect(html).not.toContain('cover-meta');
    const blanks = render({
      id: 's-01',
      type: 'cover',
      title: '표지',
      kicker: ' ',
      tagline: '',
      meta: ['', '**둘째**'],
      blocks: [],
    });
    expect(blanks).not.toContain('cover-kicker');
    expect(blanks).not.toContain('cover-tagline');
    expect(blanks).toContain('<div class="cover-meta"><span><b>둘째</b></span></div>');
  });

  it('renders author fields as inline Markdown', () => {
    const html = render({
      id: 's-01',
      type: 'cover',
      title: '문을 여는 기술,\\\n*권한을 다루는 설계.*',
      kicker: '**3주차**',
      blocks: [],
    });
    expect(html).toContain('<div class="cover-kicker"><b>3주차</b></div>');
    expect(html).toContain(
      '<h1 class="cover-title">문을 여는 기술,<br><em>권한을 다루는 설계.</em></h1>',
    );
    expect(html).toContain('data-title="문을 여는 기술, 권한을 다루는 설계."');
  });

  it('adds dark but never alert', () => {
    const html = render({
      id: 's-01',
      type: 'cover',
      title: '표지',
      dark: true,
      alert: true,
      blocks: [],
    });
    expect(html).toContain('<section class="slide cover dark" id="s-01"');
  });
});

describe('hero', () => {
  const hero: Slide = {
    id: 's-01',
    type: 'hero',
    group: '표지 · 도입',
    tag: 'SECURITY SYSTEMS OPERATION & UTILIZATION · WEEK 05',
    title: '방화벽 운영 및 실무',
    subtitle: '네트워크 보안 시스템 2부',
    meta: ['2026학년도 2학기 · 5주차', '중앙대학교 산업보안학과'],
    question: '고위 포트를 상시 열지 않고 응답만 받으려면?',
    blocks: [],
  };

  it('without art keeps the content scaffold and adds the title fields to the head', () => {
    const html = render({ ...hero, kicker: 'CASE STUDY', tagline: 'FIREWALL', refs: ['S13'] });
    expect(html).toBe(
      '<section class="slide hero" id="s-01" data-type="hero" data-title="방화벽 운영 및 실무" data-tag="SECURITY SYSTEMS OPERATION &amp; UTILIZATION · WEEK 05" data-group="표지 · 도입">\n' +
        '<div class="slide-wrapper">\n' +
        '<header class="s-head"><div class="hero-kicker">CASE STUDY</div>' +
        '<div class="eyebrow">SECURITY SYSTEMS OPERATION &amp; UTILIZATION · WEEK 05</div>' +
        '<h1 class="hero-title">방화벽 운영 및 실무</h1><div class="cover-tagline">FIREWALL</div>' +
        '<p class="s-sub">네트워크 보안 시스템 2부</p>' +
        '<div class="cover-meta"><span>2026학년도 2학기 · 5주차</span><span>중앙대학교 산업보안학과</span></div>' +
        '<div class="s-q"><span class="q-tag">질문</span><span class="q-text">고위 포트를 상시 열지 않고 응답만 받으려면?</span></div></header>\n' +
        '<div class="s-body">\n</div>\n' +
        '</div>\n' +
        '<footer class="slide-tag-bottom"><button class="source-link" data-source="s-01">참고 출처 S13 ↗</button> · 보안시스템 운영 및 활용 · 3주차</footer>\n' +
        '</section>',
    );
  });

  it('with art wraps the head and body in .cover-main and adds figure.cover-art', () => {
    const html = render({
      ...hero,
      alert: true,
      dark: true,
      art: 'wall',
      blocks: [{ type: 'paragraph', text: '본문' }],
    });
    expect(html).toContain('<section class="slide hero alert dark" id="s-01"');
    expect(html).toContain(
      '<div class="slide-wrapper has-art">\n<div class="cover-main">\n<header class="s-head">',
    );
    expect(html).toContain(
      '</header>\n<div class="s-body">\n<p class="s-p" id="s-01-b1" data-block="paragraph">본문</p>\n</div>\n</div>' +
        '<figure class="cover-art" data-asset="wall"><img alt="방화벽 그림"></figure>\n</div>\n<footer',
    );
    // No cover defaults on a hero.
    const bare = render({ id: 's-02', type: 'hero', title: 'x', blocks: [] });
    expect(bare).not.toContain('cover-meta');
    expect(bare).not.toContain('hero-kicker');
  });
});

describe('divider', () => {
  it('keeps divider-no / divider-title / divider-lead inside .cover-main', () => {
    const html = render({
      id: 'part-1',
      type: 'divider',
      no: '!',
      kicker: 'CASE STUDY · CISA',
      title: '경계 장비의 취약점 하나가 AD 전체로 이어지는 공격 체인',
      toc: '사례 연구 · CISA AA20-283A',
      tagline: 'AA20-283A',
      subtitle: '경계 방어 하나로는 충분하지 않다.',
      question: '이 공격 체인을 끊을 수 있는 정책은 몇 개일까?',
      meta: ['2020-10-09'],
      art: 'campus',
      alert: true,
      refs: ['S13'],
      blocks: [{ type: 'paragraph', text: 'CISA·FBI 공동 권고' }],
    });
    expect(html).toBe(
      '<section class="slide divider alert" id="part-1" data-type="divider" data-title="사례 연구 · CISA AA20-283A">\n' +
        '<div class="slide-wrapper has-art"><div class="cover-main"><div class="divider-no">!</div>' +
        '<div class="cover-kicker">CASE STUDY · CISA</div>' +
        '<h2 class="divider-title">경계 장비의 취약점 하나가 AD 전체로 이어지는 공격 체인</h2>' +
        '<div class="cover-tagline">AA20-283A</div>' +
        '<p class="divider-lead">경계 방어 하나로는 충분하지 않다.</p>' +
        '<div class="s-q"><span class="q-tag">질문</span><span class="q-text">이 공격 체인을 끊을 수 있는 정책은 몇 개일까?</span></div>' +
        '<div class="s-body">\n<p class="s-p" id="part-1-b1" data-block="paragraph">CISA·FBI 공동 권고</p>\n</div>' +
        '<div class="cover-meta"><span>2020-10-09</span></div></div>' +
        '<figure class="cover-art" data-asset="campus"><img src="data:image/png;base64,AAAA" alt="사옥의 외곽·로비 개념도" width="1672" height="941"></figure></div>\n' +
        '<footer class="slide-tag-bottom"><button class="source-link" data-source="part-1">참고 출처 S13 ↗</button> · 보안시스템 운영 및 활용 · 3주차</footer>\n' +
        '</section>',
    );
  });

  it('numbers dividers automatically and adds dark', () => {
    const html = renderLecture(
      lecture([
        { id: 'a', type: 'divider', title: '하나', blocks: [] },
        { id: 'b', type: 'divider', title: '둘', dark: true, blocks: [] },
      ]),
    );
    expect(html).toContain('<div class="divider-no">01</div>');
    expect(html).toContain(
      '<section class="slide divider dark" id="b" data-type="divider" data-title="둘">\n<div class="slide-wrapper"><div class="cover-main"><div class="divider-no">02</div>',
    );
  });
});

describe('toc', () => {
  it('sets data-title on every slide type and falls back to the title when blank', () => {
    const types: Slide['type'][] = ['content', 'quote', 'references', 'raw', 'hero'];
    for (const type of types) {
      const html = render({
        id: 's-09',
        type,
        title: '보이는 제목',
        toc: '*목차* 이름',
        blocks: [],
      });
      expect(html, type).toContain('data-title="목차 이름"');
      expect(html, type).not.toContain('data-title="보이는 제목"');
    }
    const blank = render({
      id: 's-09',
      type: 'content',
      title: '보이는 제목',
      toc: ' ',
      blocks: [],
    });
    expect(blank).toContain('data-title="보이는 제목"');
  });

  it('leaves content slides untouched by title-slide fields', () => {
    const html = render({
      id: 's-04',
      type: 'content',
      title: 'T',
      dark: true,
      alert: true,
      art: 'campus',
      kicker: 'x',
      meta: ['y'],
      blocks: [],
    });
    expect(html).toBe(
      '<section class="slide dark" id="s-04" data-type="content" data-title="T">\n<div class="slide-wrapper">\n' +
        '<header class="s-head"><h2 class="section-title">T</h2></header>\n<div class="s-body">\n</div>\n</div>\n' +
        '<footer class="slide-tag-bottom">보안시스템 운영 및 활용 · 3주차</footer>\n</section>',
    );
  });
});
