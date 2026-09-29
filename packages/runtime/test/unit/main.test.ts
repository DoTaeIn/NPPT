// The bundle entry, loaded as a fresh module graph like the IIFE in a deck.
import { describe, expect, it, vi } from 'vitest';
import { autoDispose, loadFixture } from './helpers';

autoDispose();

describe('main entry', () => {
  it('boots once when the document is already parsed and never twice', async () => {
    loadFixture();
    expect(document.readyState).not.toBe('loading');
    vi.resetModules();
    await import('../../src/main');
    expect(window.MARCO?.slides).toHaveLength(6);
    expect(document.querySelectorAll('#nav-dock')).toHaveLength(1);
    expect(document.documentElement.dataset.marco).toBe('ready');
    const first = window.MARCO;
    vi.resetModules();
    await import('../../src/main');
    expect(window.MARCO).toBe(first);
    expect(document.querySelectorAll('#nav-dock')).toHaveLength(1);
  });
});
