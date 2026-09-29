import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../../src/api';
import { init } from '../../src/init';
import type { PluginCtx, SlideChangeDetail } from '../../src/types';
import { $, autoDispose, boot, loadFixture } from './helpers';

autoDispose();

describe('plugins', () => {
  it('renders a placeholder for an unknown widget', () => {
    boot();
    const w = $('[data-widget="abac"]')!;
    expect(w.classList.contains('widget-missing')).toBe(true);
    expect(w.querySelector('.widget-placeholder')?.textContent).toContain('위젯 · abac');
  });

  it('mounts a plugin registered after init, with params and context', () => {
    const m = boot();
    const mount = vi.fn((el: HTMLElement, _params: unknown, _ctx: PluginCtx) => {
      el.append(Object.assign(document.createElement('p'), { className: 'abac-ui', textContent: 'ABAC' }));
    });
    m.registerPlugin('abac', { mount });
    expect(mount).toHaveBeenCalledTimes(1);
    const [el, params, ctx] = mount.mock.calls[0]!;
    expect(el.dataset.widget).toBe('abac');
    expect(params).toEqual({ conditions: 4 });
    expect(ctx.slide?.id).toBe('s-03');
    expect(ctx.slideIndex).toBe(2);
    expect(ctx.data.refs).toHaveLength(3);
    expect(ctx.edition).toBe('instructor');
    expect(el.querySelector('.widget-placeholder')).toBeNull();
    expect(el.classList.contains('widget-missing')).toBe(false);
    expect(el.dataset.mounted).toBe('abac');
    m.registerPlugin('abac', { mount });
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it('mounts plugins registered before init (bundles concatenated after the core)', () => {
    loadFixture();
    window.MARCO = createApi();
    const mount = vi.fn();
    window.MARCO.registerPlugin('abac', { mount });
    expect(mount).not.toHaveBeenCalled();
    init();
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it('shows an error placeholder when mount throws', () => {
    const m = boot();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.registerPlugin('abac', {
      mount() {
        throw new Error('boom');
      },
    });
    expect($('[data-widget="abac"] .widget-placeholder')?.textContent).toContain('오류');
  });

  it('gives plugins slide-change subscriptions and the dialog', () => {
    const m = boot();
    let ctx: PluginCtx | null = null;
    m.registerPlugin('abac', { mount: (_el, _p, c) => (ctx = c) });
    const seen: SlideChangeDetail[] = [];
    const off = ctx!.onSlideChange((d) => seen.push(d));
    m.next();
    off();
    m.next();
    expect(seen).toEqual([{ index: 1, id: 's-02' }]);
    ctx!.openDialog('위젯', '<p>본문</p>');
    expect($('#dialog')?.hidden).toBe(false);
    expect($('#dialog')?.dataset.kind).toBe('widget');
    ctx!.closeDialog();
    expect($('#dialog')?.hidden).toBe(true);
    ctx!.goId('s-05');
    expect(m.cur).toBe(4);
  });

  it('rejects invalid registrations', () => {
    const m = boot();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    m.registerPlugin('', { mount: () => undefined });
    m.registerPlugin('x', {} as never);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
