import { describe, expect, it, vi } from 'vitest';
import { $, autoDispose, boot } from './helpers';

autoDispose();

const pageSize = (): string => $('#page-size')?.textContent || '';

describe('print modes', () => {
  it('sets the lecture page size at init', () => {
    boot();
    expect(pageSize()).toBe('@media print{@page{size:1920px 1080px;margin:0}}');
  });

  it('lecture mode: body class, @page 1920×1080, every slide numbered; cleaned up after print', () => {
    const m = boot();
    let during = '';
    let numbered = 0;
    vi.spyOn(window, 'print').mockImplementation(() => {
      during = document.body.className;
      numbered = document.querySelectorAll('section.slide > .slide-no').length;
    });
    m.print('lecture');
    expect(during).toContain('print-lecture');
    expect(numbered).toBe(5);
    expect(pageSize()).toContain('1920px 1080px');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-lecture')).toBe(false);
    expect(document.querySelectorAll('section.slide > .slide-no')).toHaveLength(1);
  });

  it('handout mode builds #handout with thumbnails, notes and terms; removed after print', async () => {
    const m = boot();
    let during = '';
    let size = '';
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      during = document.body.className;
      size = pageSize();
    });
    m.print('handout');
    await vi.waitFor(() => expect(print).toHaveBeenCalled());
    expect(during).toContain('handout-mode');
    expect(size).toContain('A4 portrait');
    const pages = document.querySelectorAll('#handout article.ho-page');
    expect(pages).toHaveLength(5);
    const second = pages[1]!;
    expect(second.getAttribute('data-slide')).toBe('s-02');
    expect(second.querySelector('.ho-no')?.textContent).toBe('02');
    expect(second.querySelector('h2.ho-title')?.textContent).toBe(
      '카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다',
    );
    expect(second.querySelector('.ho-tag')?.textContent).toBe('물리보안 · 출입통제 IAM');
    const clone = second.querySelector<HTMLElement>('.ho-shot > section.slide')!;
    expect(clone.classList.contains('active')).toBe(true);
    expect(clone.style.transform).toBe('');
    expect(clone.querySelectorAll('[id]')).toHaveLength(0);
    expect(clone.querySelector('.slide-no')).toBeNull();
    expect(second.querySelector('.ho-time')?.textContent).toBe('2.5분 · 01:00 – 03:30');
    const kinds = Array.from(second.querySelectorAll<HTMLElement>('.ho-cue')).map(
      (c) => c.dataset.kind,
    );
    expect(kinds).toEqual(['SCREEN', 'SAY', 'LOOK', 'ASK', 'SQ', 'SA', 'NEXT']);
    expect(second.querySelector('.ho-cue[data-kind="SAY"] .ho-marker')?.textContent).toBe('대사');
    expect(second.querySelector('.ho-cue[data-kind="ASK"] .ho-text')?.textContent).toContain(
      '(10초)',
    );
    // A slide without notes leaves an empty (ruled) note area.
    expect(pages[4]?.querySelector('.ho-note')?.childNodes).toHaveLength(0);
    const terms = document.querySelectorAll('#handout > section.ho-terms dl > div');
    expect(terms).toHaveLength(3);
    expect(terms[0]?.querySelector('dt')?.textContent).toBe('ABAC');
    window.dispatchEvent(new Event('afterprint'));
    expect($('#handout')).toBeNull();
    expect(document.body.classList.contains('handout-mode')).toBe(false);
    expect(pageSize()).toContain('1920px 1080px');
  });

  it('browser-menu printing (beforeprint without a mode) uses lecture mode', () => {
    boot();
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.body.classList.contains('print-lecture')).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-lecture')).toBe(false);
  });

  it('dock print buttons trigger both modes', async () => {
    boot();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    $('#nav-print')?.click();
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('afterprint'));
    $('#nav-handout')?.click();
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  });
});
