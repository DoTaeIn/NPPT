import { describe, expect, it, vi } from 'vitest';
import { INK, strokesOf } from '../../src/ink/pen';
import { PEN_COLORS } from '../../src/labels';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();

const body = (): DOMTokenList => document.body.classList;

describe('keyboard map', () => {
  it('navigates with arrows, space, page keys, Home and End', () => {
    const m = boot();
    for (const k of ['ArrowRight', 'ArrowDown', ' ', 'PageDown']) press(k);
    expect(m.cur).toBe(4);
    press('ArrowLeft');
    press('ArrowUp');
    press('PageUp');
    expect(m.cur).toBe(1);
    press('End');
    expect(m.cur).toBe(4);
    press('Home');
    expect(m.cur).toBe(0);
  });

  it('prevents the default action of handled keys only', () => {
    boot();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(press('x').defaultPrevented).toBe(false);
  });

  it('toggles TOC (M), notes (N), help (? / H) and search (/)', () => {
    boot();
    press('m');
    expect(body().contains('toc-open')).toBe(true);
    expect($('#toc-sidebar')?.getAttribute('aria-hidden')).toBe('false');
    press('M');
    expect(body().contains('toc-open')).toBe(false);
    press('n');
    expect(body().contains('notes-open')).toBe(true);
    press('N');
    expect(body().contains('notes-open')).toBe(false);
    press('?');
    expect($('#help')?.hidden).toBe(false);
    press('h');
    expect($('#help')?.hidden).toBe(true);
    press('/');
    expect($('#search')?.hidden).toBe(false);
    expect(document.activeElement?.id).toBe('search-input');
  });

  it('controls ink: P pen, L laser, E eraser, 1–8 colour, C clear', () => {
    boot();
    press('p');
    expect(body().contains('pen-on')).toBe(true);
    expect(INK.on).toBe(true);
    press('l');
    expect(body().contains('laser-on')).toBe(true);
    expect(INK.on).toBe(false);
    press('e');
    expect(INK.tool).toBe('eraser');
    expect(INK.on).toBe(true);
    expect(body().contains('laser-on')).toBe(false);
    press('3');
    expect(INK.color).toBe(PEN_COLORS[2]?.c);
    expect(INK.tool).toBe('pen');
    press('8');
    expect(INK.color).toBe(PEN_COLORS[7]?.c);
    press('P');
    expect(INK.on).toBe(false);
    press('c');
    expect(strokesOf()).toEqual([]);
  });

  it('Esc closes the topmost overlay first, then exits pen', () => {
    boot();
    press('p');
    press('m');
    press('/');
    expect($('#search')?.hidden).toBe(false);
    press('Escape');
    expect($('#search')?.hidden).toBe(true);
    expect(body().contains('toc-open')).toBe(true);
    press('Escape');
    expect(body().contains('toc-open')).toBe(false);
    expect(INK.on).toBe(true);
    press('Escape');
    expect(INK.on).toBe(false);
  });

  it('opening a modal (help) turns the pen off; Esc closes it', () => {
    boot();
    press('p');
    press('?');
    expect(INK.on).toBe(false);
    expect($('#help')?.hidden).toBe(false);
    press('ArrowRight');
    expect(window.MARCO?.cur).toBe(0);
    press('Escape');
    expect($('#help')?.hidden).toBe(true);
  });

  it('ignores keys while typing in an input', () => {
    const m = boot();
    const input = document.createElement('input');
    $('#s-01')?.append(input);
    input.focus();
    press('ArrowRight', {}, input);
    press('m', {}, input);
    expect(m.cur).toBe(0);
    expect(body().contains('toc-open')).toBe(false);
  });

  it('leaves Space on a focused button to the button', () => {
    const m = boot();
    const b = $('#nav-help')!;
    press(' ', {}, b);
    expect(m.cur).toBe(0);
  });

  it('maps letter keys by physical key when a Korean IME is active', () => {
    boot();
    press('ㅡ', { code: 'KeyM' });
    expect(body().contains('toc-open')).toBe(true);
  });

  it('swallows navigation while a dialog is open', () => {
    const m = boot();
    m.next();
    $('#s-02 .source-link')?.click();
    expect($('#dialog')?.hidden).toBe(false);
    press('ArrowRight');
    expect(m.cur).toBe(1);
    press('Escape');
    expect($('#dialog')?.hidden).toBe(true);
  });

  it('Ctrl+P prints the lecture mode and Ctrl+Shift+P the handout', async () => {
    boot();
    const classes: string[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      classes.push(document.body.className);
    });
    press('p', { ctrlKey: true });
    expect(print).toHaveBeenCalledTimes(1);
    expect(classes[0]).toContain('print-lecture');
    window.dispatchEvent(new Event('afterprint'));
    press('P', { ctrlKey: true, shiftKey: true });
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(2));
    expect(classes[1]).toContain('handout-mode');
    expect($('#handout')).not.toBeNull();
  });
});
