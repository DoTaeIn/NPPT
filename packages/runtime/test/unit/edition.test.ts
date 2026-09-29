import { describe, expect, it, vi } from 'vitest';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();

describe('editions', () => {
  it('student edition: no notes data, N disabled, notes button hidden', () => {
    const m = boot('minimal-deck.student.html');
    expect(document.documentElement.dataset.edition).toBe('student');
    expect(m.data.notes).toBeUndefined();
    expect($('#notes-panel')).toBeNull();
    expect($('#nav-notes')?.hidden).toBe(true);
    press('n');
    expect(document.body.classList.contains('notes-open')).toBe(false);
    expect($('#marco-toast')?.textContent).toContain('발표 노트가 없습니다');
    m.toggleNotes();
    expect(document.body.classList.contains('notes-open')).toBe(false);
    expect($('#help')?.textContent).not.toContain('발표 노트 열기');
  });

  it('student edition ignores notes a build left in the data', () => {
    const m = boot('minimal-deck.html', (h) =>
      h.replace('data-edition="instructor"', 'data-edition="student"'),
    );
    expect(m.data.notes).toBeUndefined();
    expect($('#notes-panel')).toBeNull();
  });

  it('falls back to meta.edition when html[data-edition] is absent', () => {
    boot('minimal-deck.html', (h) =>
      h
        .replace(' data-edition="instructor"', '')
        .replace('"edition": "instructor"', '"edition": "student"'),
    );
    expect(document.documentElement.dataset.edition).toBe('student');
    expect($('#nav-notes')?.hidden).toBe(true);
  });

  it('student handout prints thumbnails with an empty note area', async () => {
    const m = boot('minimal-deck.student.html');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    m.print('handout');
    await vi.waitFor(() => expect(print).toHaveBeenCalled());
    expect(document.querySelectorAll('#handout .ho-shot')).toHaveLength(5);
    expect(document.querySelectorAll('#handout .ho-note.ho-blank')).toHaveLength(5);
    expect($('#handout')?.textContent).not.toContain('[화면]');
  });

  it('instructor edition shows the notes button', () => {
    boot();
    expect($('#nav-notes')?.hidden).toBe(false);
    expect($('#notes-panel')).not.toBeNull();
  });
});
