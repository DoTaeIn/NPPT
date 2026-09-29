import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { detectFamily, importLegacyDeck } from '../src/index.js';
import { PNG_1X1, fixture } from './helpers.js';

describe('importLegacyDeck · V20', () => {
  const html = fixture('v20-deck.html');
  const result = importLegacyDeck(html, { sourceName: 'v20-deck.html' });
  const { lecture, report } = result;

  it('detects the family and reads deck meta from the footer', () => {
    expect(detectFamily(html)).toBe('v20');
    expect(report.family).toBe('v20');
    expect(lecture.meta).toMatchObject({ title: '물리보안 · 출입통제 IAM', course: '보안시스템 운영 및 활용', week: 3, theme: 'v20-violet' });
    expect(lecture.slides.map((s) => s.id)).toEqual(['s-01', 's-02', 's-03']);
  });

  it('maps a content slide: chain + cards + takeaway + source-link refs', () => {
    const slide = lecture.slides[1]!;
    expect(slide).toMatchObject({ type: 'content', title: '카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다', tag: '기본 원리', refs: ['S13'] });
    expect(slide.blocks).toEqual([
      {
        type: 'chain',
        items: [
          { label: '자격 제시', no: '01', sub: '카드를 리더에 댄다' },
          { label: '인증', no: '02', sub: '유효한 자격인지 확인' },
        ],
      },
      {
        type: 'cards',
        cols: 2,
        items: [
          { title: '허용 신호 ≠ 실제 입실', kicker: '허용됐지만 안 들어감', body: '인증 뒤 문을 열지 않을 수도 있다.' },
          { title: '퇴실·소방·원격 개방', kicker: '카드 없이 잠금 해제', body: '실내 퇴실 버튼도 잠금을 해제할 수 있다.' },
        ],
      },
      { type: 'takeaway', label: '핵심 구분', text: '인증은 자격 확인, 인가는 `allow` 판단이다.' },
    ]);
    expect(slide.note?.cues).toEqual([expect.objectContaining({ k: 'SAY', t: '01 자격 제시 카드를 리더에 댄다' })]);
    expect(slide.note?.raw).toBe('[대사] 01 자격 제시 카드를 리더에 댄다');
  });

  it('maps a cover: subtitle from the tagline, art / headline / chips as blocks', () => {
    const cover = lecture.slides[0]!;
    expect(cover.type).toBe('cover');
    expect(cover.title).toBe('물리보안 · 출입통제 IAM');
    expect(cover.subtitle).toBe('장비가 문을 제어하는 방식을 이해한다.');
    expect(cover.tag).toBeUndefined();
    expect(cover.blocks).toEqual([
      { type: 'image', asset: 'pix' },
      { type: 'paragraph', text: '문을 여는 기술, *권한을 다루는 설계.*', lead: true },
      { type: 'pills', items: [{ text: '인증 · 통신' }, { text: '피난 · 권한' }] },
    ]);
    expect(report.dropped.map((d) => d.what)).toEqual(
      expect.arrayContaining(['course · week line (same as the footer)', 'cover TOC tag (`표지`)']),
    );
  });

  it('maps a table, keeps pipes and quotes, and records unmapped markup', () => {
    const slide = lecture.slides[2]!;
    expect(slide.blocks[0]).toEqual({
      type: 'table',
      head: ['구역 예', '확인할 대상'],
      rows: [
        ['외곽·주차장', '차량 | 탑승자'],
        ['**1층 로비** 직원·방문자', '“정상” 인증'],
      ],
      align: ['l', 'c'],
    });
    expect(slide.blocks[1]).toMatchObject({ type: 'html' });
    expect((slide.blocks[1] as { html: string }).html).toContain('<div class="mystery-widget"><canvas></canvas>');
    expect(slide.blocks[3]).toEqual({ type: 'paragraph', text: '수치는 예시다.' });
    expect(report.unmapped).toEqual([{ selector: 'div.mystery-widget', reason: 'unmapped', count: 2, slides: ['s-03'] }]);
    expect(slide.note).toBeUndefined();
  });

  it('decodes lecture-data assets (1×1 PNG) with their credits', () => {
    expect(result.assets).toHaveLength(1);
    const asset = result.assets[0]!;
    expect(asset).toMatchObject({ id: 'pix', fileName: 'pix.png', mime: 'image/png', title: '테스트 이미지', credit: '테스트 · 1×1', source: 'https://example.org/pix' });
    const expected = Buffer.from(PNG_1X1, 'base64');
    expect(Buffer.from(asset.bytes).equals(expected)).toBe(true);
    expect([...asset.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(createHash('sha256').update(asset.bytes).digest('hex')).toHaveLength(64);
    expect(lecture.assets.pix).toEqual({
      path: 'assets/pix.png',
      title: '테스트 이미지',
      credit: '테스트 · 1×1',
      source: 'https://example.org/pix',
      alt: '사옥 개념도',
    });
    expect(report.assets).toMatchObject({ total: 1, referenced: 1, stripped: 0, bytes: expected.length });
  });

  it('builds refs, videos and reports video fields without an IR home', () => {
    expect(lecture.refs).toEqual([{ id: 'S13', title: 'Axis Secure Entry', url: 'https://help.axis.com/' }]);
    expect(lecture.videos).toEqual([{ id: 'tTAISQqmxWQ', title: 'DEF CON 33 - Intro', start: 441, credit: 'DEFCONConference' }]);
    expect(report.warnings.some((w) => w.includes('tTAISQqmxWQ') && w.includes('end'))).toBe(true);
  });

  it('honours the assetDir option', () => {
    const other = importLegacyDeck(html, { assetDir: 'media/' });
    expect(other.lecture.assets.pix?.path).toBe('media/pix.png');
  });

  it('validates and reports coverage', () => {
    expect(report.validation).toEqual([]);
    expect(report.slideCount).toBe(3);
    expect(report.fallbackBlocks).toBe(2);
    expect(report.mappedPercent).toBeGreaterThan(70);
    expect(result.source.startsWith('---\ntitle: 물리보안 · 출입통제 IAM\n')).toBe(true);
  });
});

describe('importLegacyDeck · v9.7', () => {
  const html = fixture('v97-deck.html');
  const result = importLegacyDeck(html);
  const { lecture, report } = result;

  it('maps a hero with data-q, alert and a structured marker note', () => {
    expect(report.family).toBe('v97');
    const hero = lecture.slides[0]!;
    expect(hero).toMatchObject({
      type: 'hero',
      alert: true,
      title: '사례 연구 · CISA AA20-283A',
      subtitle: '경계 장비의 취약점 하나가 AD 전체로 이어지는 공격 체인',
      tag: 'CASE STUDY · AA20-283A',
      group: '표지 · 도입',
      question: '이 공격 체인을 끊을 수 있는 정책은 몇 개일까?',
    });
    expect(hero.blocks).toEqual([{ type: 'paragraph', text: '방화벽의 **SSL VPN 취약점**으로 들어온다.' }]);
    const note = hero.note!;
    // Verbatim, with HTML entities decoded.
    expect(note.raw).toContain("[화면] 빨간 경고 배경, '공격 체인' 제목.");
    expect(note.raw).toContain('[대사] {{p05-c000}} 좋은 수사관은 "사실"부터 모읍니다.');
    expect(note.raw?.startsWith('# 해설 1|P05 · 해설 1–8\n\n[시간]')).toBe(true);
    expect(note.time).toMatchObject({ minutes: 2.5, from: '10:00', to: '12:30' });
    expect(note.cues.map((c) => c.k)).toEqual(['SCREEN', 'SAY', 'HOP', 'SQ', 'SA', 'ASK']);
    expect(note.cues[5]).toMatchObject({ id: 'p05-c004', wait: '10초' });
    expect(report.dropped.map((d) => d.what)).toEqual(
      expect.arrayContaining(['hero illustration `svg.hero-art` (theme decoration)']),
    );
  });

  it('maps a v9.7 content slide: table, callout, pills, source links → refs', () => {
    const slide = lecture.slides[1]!;
    expect(slide).toMatchObject({ title: '4주차 회수', tag: 'HANDOFF · WEEK 04 → 05', question: '⑤·⑥을 멈추는 장비는?', refs: ['R01'] });
    expect(slide.blocks).toEqual([
      { type: 'table', head: ['단계', '판정'], rows: [['① 랜포트 연결', '못 막음'], ['⑤ 서버 스캔', '막음']] },
      { type: 'callout', kind: 'warn', body: '**예상과 결과가 다른 영역**이 가장 먼저 볼 곳이다.' },
      { type: 'pills', items: [{ text: '문항당 5점', tone: 'primary' }, { text: '100점 만점', tone: 'neutral' }] },
    ]);
    expect(lecture.refs).toEqual([{ id: 'R01', title: 'CISA AA20-283A', url: 'https://www.cisa.gov/aa20-283a' }]);
    expect(report.formatting['table row highlights dropped']).toBe(1);
  });

  it('extracts window.QUIZ as QuizItem[] and TERMS as terminals', () => {
    expect(lecture.quiz).toEqual([
      { id: 'Q01', area: 1, areaName: '위치 및 구역 분리', key: '인라인 통과', q: '조건은?', opts: ['인라인 통과', '같은 L2'], ans: 0, exp: 'NIST SP 800-41' },
    ]);
    expect(lecture.terminals).toEqual({});
    expect(report.data).toMatchObject({ quiz: 1, terminals: 0 });
    expect(lecture.meta).toMatchObject({ theme: 'cau-navy', course: '보안시스템 운영 및 활용', week: 5 });
  });

  it('can be forced to a family', () => {
    expect(importLegacyDeck(html, { family: 'v97' }).report.family).toBe('v97');
  });
});
