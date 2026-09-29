import { describe, expect, it, vi } from 'vitest';
import { init } from '../../src/init';
import { ATTRIBUTION, RUNTIME_VERSION } from '../../src/version';
import { autoDispose, boot, loadFixture } from './helpers';

autoDispose();

describe('window.MARCO', () => {
  it('exposes exactly the members of runtime.md §7', () => {
    const m = boot();
    expect(window.MARCO).toBe(m);
    expect(Object.keys(m).sort()).toEqual(
      [
        'about',
        'cur',
        'data',
        'go',
        'goId',
        'next',
        'prev',
        'print',
        'registerPlugin',
        'slides',
        'toggleFullscreen',
        'toggleHelp',
        'toggleNotes',
        'toggleToc',
        'version',
      ].sort(),
    );
    expect(m.version).toBe(RUNTIME_VERSION);
    expect(m.slides.map((s) => s.id)).toEqual(['s-01', 's-02', 's-03', 's-04', 's-05']);
    expect(m.data.meta.title).toBe('물리보안 · 출입통제 IAM');
  });

  it('about() returns the engine version and the Attribution', () => {
    const m = boot();
    const text = m.about();
    expect(text).toContain(`v${RUNTIME_VERSION}`);
    expect(text).toContain('MARCO Engine v0.1.0');
    expect(text).toContain(ATTRIBUTION);
  });

  it('dispatches marco:ready and is idempotent', () => {
    loadFixture();
    const ready = vi.fn();
    document.addEventListener('marco:ready', ready);
    const a = init();
    const b = init();
    expect(a).toBe(b);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#nav-dock')).toHaveLength(1);
    expect(document.querySelectorAll('#marco-chrome')).toHaveLength(1);
    document.removeEventListener('marco:ready', ready);
  });

  it('toggleToc and toggleNotes change the canvas scale', () => {
    const m = boot();
    const canvas = document.getElementById('canvas')!;
    const before = canvas.style.transform;
    m.toggleNotes();
    expect(canvas.style.transform).not.toBe(before);
    m.toggleNotes();
    m.toggleToc();
    expect(document.body.classList.contains('toc-open')).toBe(true);
    expect(canvas.style.transform).not.toBe(before);
  });
});
