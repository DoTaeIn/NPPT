// Quiz plugin (`<div class="widget" data-widget="quiz" data-params='{…}'>`), ported from the week 5
// deck: cards mode (card → question dialog with verdict, explanation and refs) and exam mode
// (timed self-scoring form with per-area results). Questions come from `#lecture-data` `quiz`.
import type { Plugin } from '../../types';
import { mountCards, type Instance } from './cards';
import { mountExam } from './exam';
import { normalizeItems, parseQuizParams, selectItems, shuffled } from './model';
import { QUIZ_CSS } from './styles';

const instances = new WeakMap<HTMLElement, Instance>();

export const quizPlugin: Plugin = {
  name: 'quiz',
  mount(el, params, ctx) {
    ctx.registerStyles(QUIZ_CSS);
    const p = parseQuizParams(params);
    const items = selectItems(normalizeItems(ctx.data.quiz), p);
    el.classList.add('mq-host');
    const inst =
      p.mode === 'exam'
        ? mountExam(el, items, ctx, p)
        : mountCards(el, p.shuffle ? shuffled(items) : items, ctx);
    instances.set(el, inst);
    ctx.signal.addEventListener('abort', () => quizPlugin.unmount!(el), { once: true });
  },
  unmount(el) {
    instances.get(el)?.destroy();
    instances.delete(el);
    el.classList.remove('mq-host');
  },
};
