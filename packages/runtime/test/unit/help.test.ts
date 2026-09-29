import { describe, expect, it } from 'vitest';
import { ATTRIBUTION, RUNTIME_VERSION } from '../../src/version';
import { $, autoDispose, boot } from './helpers';

autoDispose();

describe('help overlay', () => {
  it('is always present and carries the Attribution verbatim with a link', () => {
    const m = boot();
    const help = $('#help')!;
    expect(help).not.toBeNull();
    expect(help.hidden).toBe(true);
    expect(ATTRIBUTION).toBe(
      'Powered by MARCO — Created by DoTaeIn, Original project: https://github.com/DoTaeIn/Marco',
    );
    expect($('#help .marco-attribution')?.textContent).toBe(ATTRIBUTION);
    const a = $<HTMLAnchorElement>('#help .marco-attribution a')!;
    expect(a.getAttribute('href')).toBe('https://github.com/DoTaeIn/Marco');
    expect(a.textContent).toBe('https://github.com/DoTaeIn/Marco');
    m.toggleHelp();
    expect(help.hidden).toBe(false);
  });

  it('shows the engine and runtime versions and the keyboard map', () => {
    boot();
    const text = $('#help')?.textContent || '';
    expect(text).toContain('MARCO Engine v0.1.0');
    expect(text).toContain(`런타임 v${RUNTIME_VERSION}`);
    for (const label of [
      '다음 슬라이드',
      '목차 열기',
      '발표 노트 열기',
      '해설서 인쇄',
      '레이저 포인터',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('links to all sources and media credits', () => {
    const m = boot();
    m.toggleHelp();
    $<HTMLButtonElement>('#help [data-help="refs"]')?.click();
    expect($('#help')?.hidden).toBe(true);
    expect($('#dialog-title')?.textContent).toBe('모든 출처');
    expect(document.querySelectorAll('#dialog .dlg-sources li')).toHaveLength(3);
    m.toggleHelp();
    $<HTMLButtonElement>('#help [data-help="media"]')?.click();
    expect($('#dialog-title')?.textContent).toBe('이미지·영상 출처');
    expect($('#dialog')?.textContent).toContain('사옥의 3선 방어 개념도');
    expect($('#dialog')?.textContent).toContain('Intro to Physical Security Bypass');
  });
});
