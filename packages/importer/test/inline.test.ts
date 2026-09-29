import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { escapeInline, inlineOf, type FormattingStats } from '../src/inline.js';

const md = (html: string, stats?: FormattingStats): string => {
  const { document } = parseHTML(`<div id="x">${html}</div>`);
  return inlineOf(document.getElementById('x')!, stats ? { stats } : {});
};

describe('inline Markdown', () => {
  it('converts bold, emphasis, code and links', () => {
    expect(md('<b>굵게</b> 그리고 <em>기울임</em>, <code>tcp/443</code>, <a href="https://x.org">링크</a>')).toBe(
      '**굵게** 그리고 *기울임*, `tcp/443`, [링크](https://x.org)',
    );
  });

  it('moves whitespace outside delimiters and flattens <br>', () => {
    const stats: FormattingStats = {};
    expect(md('문을 여는 기술,<br><em> 권한을 다루는 설계. </em>', stats)).toBe('문을 여는 기술, *권한을 다루는 설계.*');
    expect(stats['line breaks flattened']).toBe(1);
  });

  it('drops emphasis that CommonMark would not close (punctuation before a letter)', () => {
    const stats: FormattingStats = {};
    expect(md('<b>정상 원격접속(VPN·RDP)</b>으로 머문다', stats)).toBe('정상 원격접속(VPN·RDP)으로 머문다');
    expect(stats['bold dropped (flanking)']).toBe(1);
    expect(md('<b>“정상”</b> 인증')).toBe('**“정상”** 인증');
  });

  it('escapes Markdown-significant characters', () => {
    expect(escapeInline('a*b _c `d` \\ snake_case <tag> [x](y)')).toBe('a\\*b \\_c \\`d\\` \\\\ snake_case \\<tag> \\[x](y)');
    expect(md('2 * 3 = 6')).toBe('2 \\* 3 = 6');
  });

  it('keeps Korean typography verbatim', () => {
    expect(md('허용 신호 ≠ 실제 입실 · 외곽 → 로비 “정상”')).toBe('허용 신호 ≠ 실제 입실 · 외곽 → 로비 “정상”');
  });

  it('drops icons and counts them', () => {
    const stats: FormattingStats = {};
    expect(md('<i data-lucide="shield"></i>보안', stats)).toBe('보안');
    expect(stats['inline icons dropped']).toBe(1);
  });
});
