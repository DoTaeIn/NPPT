import { describe, expect, it, vi } from 'vitest';
import type { SlideChangeDetail } from '../../src/types';
import { init } from '../../src/init';
import { $, autoDispose, boot, loadFixture } from './helpers';

autoDispose();

const active = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('section.slide.active'));

describe('navigation', () => {
  it('shows exactly one active slide with number and progress', () => {
    const m = boot();
    expect(m.cur).toBe(0);
    expect(active().map((s) => s.id)).toEqual(['s-01']);
    expect($('#s-01 > .slide-no')?.textContent).toBe('01 / 06');
    expect($<HTMLElement>('#s-01 > .slide-progress')?.style.width).toBe('16.67%');
    expect($('#nav-count')?.textContent).toBe('01 / 06');
    expect($<HTMLButtonElement>('#nav-prev')?.disabled).toBe(true);
  });

  it('moves with next/prev/go/goId and dispatches marco:slidechange', () => {
    const m = boot();
    const seen: SlideChangeDetail[] = [];
    document.addEventListener('marco:slidechange', (e) =>
      seen.push((e as CustomEvent<SlideChangeDetail>).detail),
    );
    m.next();
    expect(m.cur).toBe(1);
    expect(seen).toEqual([{ index: 1, id: 's-02' }]);
    expect(active().map((s) => s.id)).toEqual(['s-02']);
    expect(document.querySelectorAll('.slide-no')).toHaveLength(1);
    expect($('#s-02 > .slide-no')?.textContent).toBe('02 / 06');
    expect($<HTMLElement>('#s-02 > .slide-progress')?.style.width).toBe('33.33%');
    m.goId('s-04');
    expect(m.cur).toBe(3);
    m.goId('#s-02');
    expect(m.cur).toBe(1);
    m.goId('missing');
    expect(m.cur).toBe(1);
    m.prev();
    expect(m.cur).toBe(0);
    expect(seen.map((d) => d.index)).toEqual([1, 3, 1, 0]);
  });

  it('clamps at both ends without firing events', () => {
    const m = boot();
    const spy = vi.fn();
    document.addEventListener('marco:slidechange', spy);
    m.prev();
    m.go(-5);
    expect(m.cur).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    m.go(99);
    expect(m.cur).toBe(5);
    m.next();
    expect(m.cur).toBe(5);
    expect(spy).toHaveBeenCalledTimes(1);
    expect($('#nav-count')?.textContent).toBe('06 / 06');
    expect($<HTMLButtonElement>('#nav-next')?.disabled).toBe(true);
    m.go(Number.NaN);
    expect(m.cur).toBe(0);
  });

  it('syncs the URL hash and starts from it', () => {
    const m = boot();
    m.go(2);
    expect(location.hash).toBe('#s-03');
  });

  it('starts at the slide named by the hash', () => {
    loadFixture();
    history.replaceState(null, '', '/#4');
    const m = init();
    expect(m.cur).toBe(3);
    expect(active().map((s) => s.id)).toEqual(['s-04']);
  });

  it('dock buttons navigate', () => {
    const m = boot();
    $('#nav-next')?.click();
    $('#nav-next')?.click();
    expect(m.cur).toBe(2);
    $('#nav-prev')?.click();
    expect(m.cur).toBe(1);
  });
});
