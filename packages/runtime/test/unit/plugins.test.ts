import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../../src/api';
import { dispose, init } from '../../src/init';
import { BUNDLED } from '../../src/plugins/bundled';
import { definePlugin } from '../../src/plugins/define';
import { BUNDLED_PLUGINS, parseParams } from '../../src/plugins/registry';
import type { Plugin, PluginCtx, SlideChangeDetail } from '../../src/types';
import { $, autoDispose, boot, loadFixture, press } from './helpers';

autoDispose();

describe('plugins', () => {
  it('renders a placeholder for an unknown widget', () => {
    boot();
    const w = $('[data-widget="abac"]')!;
    expect(w.classList.contains('widget-missing')).toBe(true);
    expect(w.querySelector('.widget-placeholder')?.textContent).toContain('위젯 · abac');
    expect(w.textContent).toContain(
      "'abac' 플러그인이 없습니다. marco-runtime.all.js에도 포함되지 않은",
    );
  });

  it('says when marco-runtime.all.js would provide a missing plugin', () => {
    boot();
    const w = $('[data-widget="quiz"]')!;
    expect(w.classList.contains('widget-missing')).toBe(true);
    expect(w.textContent).toContain("이 덱에 'quiz' 플러그인이 포함되지 않았습니다");
    expect(w.textContent).toContain('marco-runtime.all.js(또는 plugins/quiz.js)');
  });

  it('BUNDLED_PLUGINS names exactly the plugins built into marco-runtime.all.js', () => {
    expect(BUNDLED.map((p) => p.name)).toEqual([...BUNDLED_PLUGINS]);
  });

  it('mounts in document order at init, once per element, with the object form', () => {
    loadFixture(undefined, (h) =>
      h.replace('data-widget="abac"', 'data-widget="probe" data-params=\'{"n":0}\''),
    );
    window.MARCO = createApi();
    const order: string[] = [];
    window.MARCO.registerPlugin({
      name: 'quiz',
      mount: (el) => order.push(`quiz:${el.id}`),
    });
    window.MARCO.registerPlugin('probe', { mount: (el) => order.push(`probe:${el.id}`) });
    expect(order).toEqual([]);
    init();
    expect(order).toEqual(['probe:s-03-b3', 'quiz:s-06-b1', 'quiz:s-06-b2']);
    expect($('#s-06-b1')?.dataset.mounted).toBe('quiz');
    window.MARCO.registerPlugin({ name: 'quiz', mount: (el) => order.push(`again:${el.id}`) });
    expect(order).toHaveLength(3);
  });

  it('parses data-params as a JSON object and falls back to {}', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = document.createElement('div');
    el.dataset.widget = 'x';
    expect(parseParams(el)).toEqual({});
    el.dataset.params = '{"mode":"exam","ids":["Q01"],"minutes":10}';
    expect(parseParams(el)).toEqual({ mode: 'exam', ids: ['Q01'], minutes: 10 });
    expect(warn).not.toHaveBeenCalled();
    for (const bad of ['{mode:exam}', '[1,2]', '42', 'null']) {
      el.dataset.params = bad;
      expect(parseParams(el)).toEqual({});
    }
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it('injects plugin styles once, emits plugin events and unmounts on teardown', () => {
    const m = boot();
    const unmount = vi.fn();
    const ctxs: PluginCtx[] = [];
    m.registerPlugin({
      name: 'quiz',
      mount(el, _p, ctx) {
        ctx.registerStyles('.probe{color:red}');
        ctx.registerStyles('.ignored{color:blue}');
        ctxs.push(ctx);
      },
      unmount,
    });
    expect(ctxs.map((c) => c.slideId)).toEqual(['s-06', 's-06']);
    expect(ctxs[0]!.name).toBe('quiz');
    const styles = document.querySelectorAll('style[data-marco-plugin="quiz"]');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.id).toBe('marco-plugin-quiz');
    expect(styles[0]!.textContent).toBe('.probe{color:red}');

    const heard = vi.fn();
    document.addEventListener('marco:quiz:ping', (e) => heard((e as CustomEvent).detail));
    ctxs[1]!.events.emit('ping', { n: 1 });
    expect(heard).toHaveBeenCalledWith({ n: 1 });
    const slides: SlideChangeDetail[] = [];
    ctxs[0]!.events.on<SlideChangeDetail>('slidechange', (d) => slides.push(d));
    m.goId('s-06');
    expect(slides).toEqual([{ index: 5, id: 's-06' }]);

    ctxs[0]!.openSources(['S30']);
    expect($('#dialog')?.dataset.kind).toBe('sources');
    expect($('#dialog-body')?.textContent).toContain('S30 · NIST ABAC');

    const aborted = vi.fn();
    ctxs[0]!.signal.addEventListener('abort', aborted);
    dispose();
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(unmount.mock.calls.map((c) => (c[0] as HTMLElement).id)).toEqual(['s-06-b1', 's-06-b2']);
    expect(aborted).toHaveBeenCalled();
    expect(document.querySelectorAll('style[data-marco-plugin]')).toHaveLength(0);
  });

  it('routes keys to the open plugin dialog without breaking Esc or navigation', () => {
    const m = boot();
    let ctx: PluginCtx | null = null;
    m.registerPlugin('abac', { mount: (_el, _p, c) => (ctx = c) });
    const keys: string[] = [];
    const onClose = vi.fn();
    ctx!.openDialog('위젯', '<p>본문</p>', {
      kind: 'probe',
      onKey: (e) => {
        keys.push(e.key);
        return e.key === '2';
      },
      onClose,
    });
    expect($('#dialog')?.dataset.kind).toBe('probe');
    expect(press('2').defaultPrevented).toBe(true);
    expect(press('x').defaultPrevented).toBe(false);
    press('ArrowRight');
    expect(m.cur).toBe(0);
    expect(keys).toEqual(['2', 'x', 'ArrowRight']);
    press('Escape');
    expect($('#dialog')?.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    press('2');
    expect(keys).toHaveLength(3);
    press('ArrowRight');
    expect(m.cur).toBe(1);
  });

  it('calls onClose when another dialog replaces a plugin dialog', () => {
    const m = boot();
    let ctx: PluginCtx | null = null;
    m.registerPlugin('abac', { mount: (_el, _p, c) => (ctx = c) });
    const onClose = vi.fn();
    ctx!.openDialog('위젯', '<p>본문</p>', { onClose });
    expect($('#dialog')?.dataset.kind).toBe('widget');
    ctx!.openSources(['S04']);
    expect(onClose).toHaveBeenCalledTimes(1);
    ctx!.closeDialog();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('plugin bundles register on window.MARCO or queue until the core boots', async () => {
    loadFixture();
    const mount = vi.fn();
    const probe: Plugin = { name: 'abac', mount };
    definePlugin(probe);
    expect(window.MARCO_PLUGINS).toEqual([probe]);
    vi.resetModules();
    await import('../../src/main');
    // The fresh module graph has its own state; tear it down with its own dispose().
    const fresh = await import('../../src/init');
    expect(window.MARCO_PLUGINS).toEqual([]);
    expect(mount).toHaveBeenCalledTimes(1);
    const late = vi.fn();
    definePlugin({ name: 'quiz', mount: late });
    expect(late).toHaveBeenCalledTimes(2);
    fresh.dispose();
    delete window.MARCO_PLUGINS;
  });

  it('mounts a plugin registered after init, with params and context', () => {
    const m = boot();
    const mount = vi.fn((el: HTMLElement, _params: unknown, _ctx: PluginCtx) => {
      el.append(
        Object.assign(document.createElement('p'), { className: 'abac-ui', textContent: 'ABAC' }),
      );
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
