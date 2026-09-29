import { describe, expect, it } from 'vitest';
import {
  formatOutlineItem,
  outlineMinutes,
  outlineSlideType,
  parseOutline,
} from '../src/outline.js';

const REPLY = `개요입니다.

\`\`\`\`outline
번호 | 태그 | 제목 | 한 줄 의도 | 분
01 | 표지 | 물리보안 · 출입통제 IAM | 오늘 다룰 범위와 질문을 연다 | 2
02 | 도입 | 사원증이 유효하면, 들어가도 되는가? | 인증과 인가가 다름을 사례로 연다 | 3
03 | 1부 | 인증과 하드웨어 | 문 앞과 문 뒤를 함께 본다 | 0.5
04 | 1부 · 3선 방어 | 외곽 → 로비 → 핵심구역 | 세 겹의 경계 | A | B를 지도로 본다 | 3분
05 | 마무리 | 인증에서 현장 동작까지 | 오늘의 한 문장 | 1
06 | 참고 자료 | 출처 및 참고자료 | 인용한 자료 | 0.5
07 | 망가진 줄
합계 | 10분
\`\`\`\``;

describe('parseOutline', () => {
  const parsed = parseOutline(REPLY);

  it('reads slide lines, types and the total', () => {
    expect(parsed.items.map((i) => [i.no, i.type])).toEqual([
      [1, 'cover'],
      [2, 'content'],
      [3, 'divider'],
      [4, 'content'],
      [5, 'quote'],
      [6, 'references'],
    ]);
    expect(parsed.total).toBe(10);
    expect(parsed.errors).toEqual(['07 | 망가진 줄']);
    expect(outlineMinutes(parsed.items)).toBe(10);
  });

  it('keeps "|" inside the intent and accumulates the lecture clock', () => {
    const item = parsed.items[3]!;
    expect(item.intent).toBe('세 겹의 경계 | A | B를 지도로 본다');
    expect(item.minutes).toBe(3);
    expect([item.from, item.to]).toEqual(['5:30', '8:30']);
    expect(formatOutlineItem(parsed.items[2]!)).toBe(
      '03 | 1부 | 인증과 하드웨어 | 문 앞과 문 뒤를 함께 본다 | 0.5',
    );
  });

  it('maps the professor’s tags to slide types', () => {
    expect(outlineSlideType('2부')).toBe('divider');
    expect(outlineSlideType('2부 · 권한')).toBe('content');
    expect(outlineSlideType('참고자료')).toBe('references');
  });
});
