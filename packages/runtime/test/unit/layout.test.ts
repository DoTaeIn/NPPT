import { describe, expect, it } from 'vitest';
import { computeFit } from '../../src/layout';
import { autoDispose, boot } from './helpers';

autoDispose();

function viewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

describe('layout', () => {
  it('computes scale and centring (runtime.md §2)', () => {
    expect(computeFit(1920, 1080, false, false)).toEqual({ scale: 1, left: 0, top: 0 });
    expect(computeFit(1600, 900, false, false).scale).toBeCloseTo(0.8333, 4);
    expect(computeFit(1920, 1200, false, false)).toEqual({ scale: 1, left: 0, top: 60 });
    // Notes panel (420px, right) reduces the free width.
    const n = computeFit(1920, 1080, true, false);
    expect(n.scale).toBeCloseTo(1500 / 1920, 6);
    expect(n.left).toBe(0);
    expect(n.top).toBe(Math.round((1080 - 1080 * (1500 / 1920)) / 2));
    // TOC sidebar (280px, left) shifts the canvas right.
    const t = computeFit(1920, 1080, false, true);
    expect(t.scale).toBeCloseTo(1640 / 1920, 6);
    expect(t.left).toBe(280);
    const both = computeFit(1920, 1080, true, true);
    expect(both.scale).toBeCloseTo(1220 / 1920, 6);
    expect(computeFit(100, 100, false, false).scale).toBeCloseTo(320 / 1920, 6);
  });

  it('rescales the canvas on resize', () => {
    viewport(1920, 1080);
    boot();
    const canvas = document.getElementById('canvas')!;
    expect(canvas.style.transform).toBe('scale(1)');
    viewport(960, 540);
    expect(canvas.style.transform).toBe('scale(0.5)');
    expect(canvas.style.left).toBe('0px');
    viewport(960, 1000);
    expect(canvas.style.top).toBe(`${Math.round((1000 - 540) / 2)}px`);
    expect(document.documentElement.style.getPropertyValue('--marco-scale')).toBe('0.5');
  });

  it('wraps slides in #stage/#canvas when a page lacks them', () => {
    boot('minimal-deck.html', (h) =>
      h
        .replace('<div id="stage"><div id="canvas">', '')
        .replace('</div></div>\n  <script id', '\n  <script id'),
    );
    expect(document.querySelectorAll('#stage > #canvas > section.slide')).toHaveLength(5);
  });
});
