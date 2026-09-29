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
    const pages = document.querySelectorAll('#handout .ho-page');
    expect(pages).toHaveLength(6);
    const first = pages[1]!;
    expect(first.querySelector('.ho-title')?.textContent).toBe(
      '카드 인식, 허용, 문 열림, 사람 통과는 다른 단계다',
    );
    const clone = first.querySelector<HTMLElement>('.ho-shot > section.slide')!;
    expect(clone.classList.contains('active')).toBe(true);
    expect(clone.style.transform).toMatch(/^scale\(0\.36/);
    expect(clone.querySelectorAll('[id]')).toHaveLength(0);
    expect(first.querySelector('.ho-note')?.textContent).toContain('[대사]');
    expect(first.querySelector('.ho-note')?.textContent).toContain('2.5분 · 01:00 – 03:30');
    expect(pages[5]?.classList.contains('ho-terms')).toBe(true);
    expect(pages[5]?.textContent).toContain('PACS');
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
