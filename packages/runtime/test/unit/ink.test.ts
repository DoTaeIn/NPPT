import { describe, expect, it } from 'vitest';
import { INK, strokesOf } from '../../src/ink/pen';
import { $, autoDispose, boot, press } from './helpers';

autoDispose();

function draw(points: Array<[number, number]>): void {
  const cv = $('#pen-canvas')!;
  const [first, ...rest] = points;
  const ev = (type: string, [x, y]: [number, number]): PointerEvent =>
    new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  cv.dispatchEvent(ev('pointerdown', first!));
  for (const p of rest) cv.dispatchEvent(ev('pointermove', p));
  cv.dispatchEvent(ev('pointerup', rest[rest.length - 1] || first!));
}

describe('ink', () => {
  it('injects the pen and laser canvases inside #canvas', () => {
    boot();
    expect($('#canvas > #pen-canvas')).not.toBeNull();
    expect($('#canvas > #laser-canvas')).not.toBeNull();
    expect($('#pen-toolbar')?.querySelectorAll('.color-btn')).toHaveLength(8);
    expect($('#pen-toolbar')?.querySelectorAll('[data-tool]')).toHaveLength(8);
  });

  it('keeps strokes per slide and restores them on return', () => {
    const m = boot();
    press('p');
    draw([
      [10, 10],
      [20, 20],
      [30, 25],
    ]);
    expect(strokesOf(0)).toHaveLength(1);
    expect(strokesOf(0)[0]).toMatchObject({ tool: 'pen', pts: [10, 10, 20, 20, 30, 25] });
    m.next();
    expect(strokesOf()).toEqual([]);
    draw([
      [5, 5],
      [6, 6],
    ]);
    m.prev();
    expect(strokesOf()).toHaveLength(1);
    expect(strokesOf(1)).toHaveLength(1);
  });

  it('draws shapes, supports undo (Ctrl+Z) and clear (C)', () => {
    boot();
    press('p');
    $<HTMLButtonElement>('#pen-toolbar [data-tool="rect"]')?.click();
    expect(INK.tool).toBe('rect');
    draw([
      [100, 100],
      [150, 140],
      [200, 180],
    ]);
    expect(strokesOf()[0]).toMatchObject({ tool: 'rect', pts: [100, 100, 200, 180] });
    draw([[300, 300]]);
    expect(strokesOf()).toHaveLength(1);
    $<HTMLButtonElement>('#pen-toolbar [data-tool="arrow"]')?.click();
    draw([
      [0, 0],
      [50, 50],
    ]);
    expect(strokesOf()).toHaveLength(2);
    press('z', { ctrlKey: true });
    expect(strokesOf()).toHaveLength(1);
    press('c');
    expect(strokesOf()).toHaveLength(0);
  });

  it('places text with the text tool', () => {
    boot();
    press('p');
    $<HTMLButtonElement>('#pen-toolbar [data-tool="text"]')?.click();
    draw([[400, 300]]);
    const box = $<HTMLInputElement>('#canvas > .ink-text')!;
    expect(box).not.toBeNull();
    box.value = '핵심';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect($('#canvas > .ink-text')).toBeNull();
    expect(strokesOf()[0]).toMatchObject({ tool: 'text', text: '핵심', pts: [400, 300] });
  });

  it('ignores pointer input while the pen is off', () => {
    boot();
    draw([
      [1, 1],
      [2, 2],
    ]);
    expect(strokesOf()).toEqual([]);
  });

  it('size slider and toolbar close button', () => {
    boot();
    press('p');
    const range = $<HTMLInputElement>('#pen-size')!;
    range.value = '12';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(INK.size).toBe(12);
    expect($('#pen-size-v')?.textContent).toBe('12');
    $<HTMLButtonElement>('#pen-toolbar [data-act="close"]')?.click();
    expect(INK.on).toBe(false);
    expect($('#pen-toolbar')?.classList.contains('open')).toBe(false);
  });
});
