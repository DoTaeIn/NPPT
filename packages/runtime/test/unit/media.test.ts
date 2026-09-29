import { describe, expect, it } from 'vitest';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();

describe('dialogs and media', () => {
  it('source-link opens the sources dialog with id · title links', () => {
    const m = boot();
    m.next();
    $('#s-02 .source-link')?.click();
    expect($('#dialog')?.hidden).toBe(false);
    expect($('#dialog')?.dataset.kind).toBe('sources');
    expect($('#dialog-title')?.textContent).toBe('참고 출처');
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#dialog .dlg-sources a'));
    expect(links.map((a) => a.textContent)).toEqual(['S04 · NIST PACS · PIV', 'S13 · Axis Secure Entry']);
    expect(links[0]?.getAttribute('href')).toBe('https://csrc.nist.gov/pubs/sp/800/116/r1/final');
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
    press('Escape');
    expect($('#dialog')?.hidden).toBe(true);
  });

  it('image-open shows the slide image with title and credit', () => {
    const m = boot();
    m.go(2);
    $('#s-03 .image-open')?.click();
    expect($('#dialog')?.dataset.kind).toBe('image');
    expect($('#dialog-title')?.textContent).toBe('사옥의 3선 방어 개념도');
    const img = $<HTMLImageElement>('#dialog .dlg-image')!;
    expect(img.getAttribute('src')).toBe($<HTMLImageElement>('#s-03 figure img')?.getAttribute('src'));
    expect(img.alt).toBe('사옥 외곽, 로비, 핵심구역의 3선 방어 개념도');
    expect($('#dialog .dlg-caption')?.textContent).toContain('생성 개념도');
  });

  it('video-open embeds youtube-nocookie with the start time (http/https)', () => {
    const m = boot();
    m.go(2);
    $('#s-03 .video-open')?.click();
    expect($('#dialog')?.dataset.kind).toBe('video');
    const src = $<HTMLIFrameElement>('#dialog iframe')?.getAttribute('src') || '';
    expect(src.startsWith('https://www.youtube-nocookie.com/embed/tTAISQqmxWQ?start=441')).toBe(true);
    expect($('#dialog')?.textContent).toContain('인터넷 연결이 필요합니다');
    $<HTMLButtonElement>('#dialog .dlg-close')?.click();
    expect($('#dialog iframe')).toBeNull();
  });

  it('closes on a backdrop click and restores focus', () => {
    const m = boot();
    m.next();
    const btn = $<HTMLButtonElement>('#s-02 .source-link')!;
    btn.focus();
    btn.click();
    $('#dialog')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect($('#dialog')?.hidden).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  it('turns the pen off when a dialog opens', () => {
    const m = boot();
    press('p');
    expect(document.body.classList.contains('pen-on')).toBe(true);
    m.next();
    $('#s-02 .source-link')?.click();
    expect(document.body.classList.contains('pen-on')).toBe(false);
  });
});
