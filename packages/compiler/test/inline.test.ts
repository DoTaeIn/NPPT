import { describe, expect, it } from 'vitest';
import { plainText, renderInline, wrapTerms } from '../src/index.js';

const terms = {
  IAM: 'Identity and Access Management 신원 및 접근 관리',
  MFA: 'Multi-Factor Authentication',
  'MFA-2': '두 번째 MFA',
  'R&D': 'Research and Development',
  amp: '앰프',
  'Q"X': '따옴표 "포함"',
};
const abbr = (key: string, title: string) => `<abbr class="term" title="${title}">${key}</abbr>`;

describe('inline pipeline: escape → Markdown → abbr', () => {
  it('escapes HTML before applying Markdown', () => {
    expect(renderInline('<script>alert(1)</script> **굵게** *기울임* `x<y`')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; <b>굵게</b> <em>기울임</em> <code>x&lt;y</code>',
    );
  });

  it('opens external links in a new tab and drops unsafe schemes', () => {
    expect(renderInline('[공식](https://nist.gov) [앵커](#s-02)')).toBe(
      '<a href="https://nist.gov" target="_blank" rel="noopener noreferrer">공식</a> <a href="#s-02">앵커</a>',
    );
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('href');
  });

  it('does not render images inside text', () => {
    expect(renderInline('![a](x.png)')).not.toContain('<img');
  });
});

describe('abbreviation wrapping', () => {
  it('wraps whole words, including before Korean particles', () => {
    expect(wrapTerms('IAM은 IAM, (IAM)', terms)).toBe(
      `${abbr('IAM', 'Identity and Access Management 신원 및 접근 관리')}은 ${abbr('IAM', 'Identity and Access Management 신원 및 접근 관리')}, (${abbr('IAM', 'Identity and Access Management 신원 및 접근 관리')})`,
    );
  });

  it('does not wrap inside longer Latin words', () => {
    expect(wrapTerms('IAMS xIAM IAM2 iam', terms)).toBe('IAMS xIAM IAM2 iam');
  });

  it('prefers the longest term', () => {
    expect(wrapTerms('MFA-2와 MFA', terms)).toBe(
      `${abbr('MFA-2', '두 번째 MFA')}와 ${abbr('MFA', 'Multi-Factor Authentication')}`,
    );
  });

  it('never touches tags, attributes, code or existing abbr', () => {
    const html =
      '<a href="https://x.org/IAM" title="IAM">IAM 링크</a> <code>IAM</code> <abbr title="t">MFA</abbr>';
    expect(wrapTerms(html, terms)).toBe(
      `<a href="https://x.org/IAM" title="IAM">${abbr('IAM', 'Identity and Access Management 신원 및 접근 관리')} 링크</a> <code>IAM</code> <abbr title="t">MFA</abbr>`,
    );
  });

  it('matches escaped text and leaves entities intact', () => {
    expect(renderInline('R&D 부서와 &amp; 기호', terms)).toBe(
      `${abbr('R&amp;D', 'Research and Development')} 부서와 &amp; 기호`,
    );
  });

  it('escapes the title attribute', () => {
    expect(wrapTerms('Q&quot;X', terms)).toBe(`${abbr('Q&quot;X', '따옴표 &quot;포함&quot;')}`);
  });

  it('wraps inside bold text produced by Markdown', () => {
    expect(renderInline('**IAM 설계**', { IAM: 'x' })).toBe(`<b>${abbr('IAM', 'x')} 설계</b>`);
  });

  it('is a no-op without terms', () => {
    expect(wrapTerms('IAM', {})).toBe('IAM');
    expect(renderInline('IAM')).toBe('IAM');
  });
});

describe('plainText', () => {
  it('strips inline Markdown for data-title', () => {
    expect(plainText('**굵게** `code` [링크](https://x.org)\n다음 줄')).toBe(
      '굵게 code 링크 다음 줄',
    );
  });
});
