import { describe, expect, it } from 'vitest';
import { searchSlides, slideText } from '../../src/chrome/search';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();

function type(text: string): void {
  const input = $<HTMLInputElement>('#search-input')!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('search', () => {
  it('matches titles, body text, note text and slide numbers', () => {
    boot();
    expect(searchSlides('3선')[0]).toMatchObject({ i: 2, where: '제목' });
    expect(searchSlides('식별자')[0]).toMatchObject({ i: 1, where: '본문' });
    expect(searchSlides('두 측면')[0]).toMatchObject({ i: 0, where: '노트' });
    expect(searchSlides('4')[0]).toMatchObject({ i: 3, where: '번호' });
    expect(searchSlides('존재하지않는말')).toEqual([]);
    expect(searchSlides('  ')).toEqual([]);
  });

  it('keeps words of separate blocks apart', () => {
    boot();
    const text = slideText($('#s-04')!);
    expect(text).toBe('02 인증과 하드웨어 문 앞과 문 뒤를 함께 본다.');
    expect(text).not.toContain('02 / 06');
  });

  it('opens with /, lists results and jumps on Enter', () => {
    const m = boot();
    press('/');
    type('참고 자료');
    expect(document.querySelectorAll('#search .sr').length).toBeGreaterThan(0);
    expect($('#search .sr.sel .sr-title mark')?.textContent).toBe('참고 자료');
    press('Enter', {}, $('#search-input')!);
    expect(m.cur).toBe(4);
    expect($('#search')?.hidden).toBe(true);
  });

  it('moves the selection with arrow keys and closes with Esc', () => {
    const m = boot();
    press('/');
    type('보안');
    const input = $('#search-input')!;
    press('ArrowDown', {}, input);
    const sel = $('#search .sr.sel')!;
    const target = Number(sel.dataset.index);
    press('Enter', {}, input);
    expect(m.cur).toBe(target);
    press('/');
    press('Escape', {}, $('#search-input')!);
    expect($('#search')?.hidden).toBe(true);
  });

  it('shows a hint for no results', () => {
    boot();
    press('/');
    type('zzz');
    expect($('#search .sr-hint')?.textContent).toContain('일치하는 슬라이드가 없습니다');
  });
});
