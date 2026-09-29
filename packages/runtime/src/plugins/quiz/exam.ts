// Exam mode: start panel (time limit) → every selected question in a scrollable in-slide form with
// a countdown → 제출 (or time out: auto-submit) → per-area summary dialog → review with answers,
// explanations and refs → 다시 풀기. State lives in memory for this widget only.
import { clamp, esc, h, pad2 } from '../../dom';
import type { PluginCtx } from '../../types';
import type { Instance } from './cards';
import {
  areaLabel,
  clock,
  scoreExam,
  shuffled,
  type ExamResult,
  type Item,
  type QuizParams,
} from './model';
import { EMPTY_HTML, feedbackHtml, optsHtml, txt, verdictOf } from './view';

type Phase = 'idle' | 'running' | 'review';

export function mountExam(el: HTMLElement, pool: Item[], ctx: PluginCtx, p: QuizParams): Instance {
  const known = (id: string): boolean => ctx.data.refs.some((r) => r.id === id);
  const answers = new Map<string, number>();
  let phase: Phase = 'idle';
  let minutes = p.minutes;
  let items = pool;
  let started = 0;
  let deadline = 0;
  let used = 0;
  let timer = 0;
  let auto = false;
  let result: ExamResult | null = null;
  const root = h('div', { class: 'mq mq-exam' });
  el.append(root);

  const left = (): number => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
    root.querySelector<T>(sel);
  const stop = (): void => {
    window.clearInterval(timer);
    timer = 0;
  };

  function itemHtml(it: Item, i: number): string {
    const picked = answers.get(it.id);
    const review = phase === 'review';
    const state = review ? verdictOf(it, picked) : picked !== undefined ? 'answered' : '';
    const area = areaLabel(it);
    return (
      `<li class="mq-item" data-q="${esc(it.id)}"${state ? ` data-state="${state}"` : ''}>` +
      `<p class="mq-item-head"><span class="mq-no">${pad2(i + 1)}</span>` +
      `${area ? `<span class="mq-area">${esc(area)}</span>` : ''}</p>` +
      `<p class="mq-q">${txt(it.q)}</p>${optsHtml(it, picked, review)}` +
      `${review ? feedbackHtml(it, picked, known) : ''}</li>`
    );
  }

  function render(): void {
    root.dataset.phase = phase;
    if (!pool.length) {
      root.innerHTML = EMPTY_HTML;
      return;
    }
    if (phase === 'idle') {
      const per = 100 % pool.length === 0 ? `문항당 ${100 / pool.length}점 · ` : '';
      root.innerHTML =
        `<div class="mq-start"><p class="mq-kicker">시험 모드</p>` +
        `<h3 class="mq-title">${pool.length}문항 자가 진단</h3>` +
        `<p class="mq-lead">제한 시간 안에 풀고 <b>제출</b>하면 영역별로 자동 채점합니다. 시간이 끝나면 자동으로 제출됩니다.</p>` +
        `<div class="mq-minutes" role="group" aria-label="제한 시간">` +
        `<button type="button" class="mq-btn mq-min" data-d="-1" aria-label="1분 줄이기">−</button>` +
        `<b class="mq-min-val">${minutes}분</b>` +
        `<button type="button" class="mq-btn mq-min" data-d="1" aria-label="1분 늘리기">+</button></div>` +
        `<p class="mq-meta">${per}100점 만점 · 영역별 채점</p>` +
        `<button type="button" class="mq-btn primary mq-begin">시험 시작 ▶</button></div>`;
      return;
    }
    const bar =
      phase === 'review' && result
        ? `<b class="mq-bar-title">채점 결과 · <span class="mq-total">${result.score}점</span></b>` +
          `<span class="mq-progress">정답 ${result.correct} / ${result.total} · 소요 ${clock(used)}</span>` +
          `<button type="button" class="mq-btn mq-summary">결과 요약</button>` +
          `<button type="button" class="mq-btn primary mq-retry">다시 풀기</button>`
        : `<b class="mq-bar-title">시험 진행 중</b>` +
          `<span class="mq-progress">응답 <b class="mq-count">${answers.size}</b> / ${items.length}</span>` +
          `<span class="mq-timer" role="timer" aria-label="남은 시간">${clock(left())}</span>` +
          `<button type="button" class="mq-btn primary mq-submit">제출</button>`;
    root.innerHTML = `<div class="mq-bar">${bar}</div><ol class="mq-list">${items.map(itemHtml).join('')}</ol>`;
  }

  function tick(): void {
    const s = left();
    const t = $('.mq-timer');
    if (t) {
      t.textContent = clock(s);
      t.classList.toggle('is-warn', s <= 60);
    }
    if (s <= 0) submit(true);
  }

  function start(): void {
    stop();
    items = p.shuffle ? shuffled(pool) : pool.slice();
    answers.clear();
    result = null;
    auto = false;
    started = Date.now();
    deadline = started + minutes * 60_000;
    phase = 'running';
    render();
    timer = window.setInterval(tick, 1000);
    ctx.events.emit('start', { minutes, total: items.length });
  }

  function summary(): void {
    if (!result) return;
    const r = result;
    const ratio = (a: { correct: number; total: number }): number => a.correct / (a.total || 1);
    const weak =
      r.areas.length > 1 ? r.areas.reduce((a, b) => (ratio(b) < ratio(a) ? b : a)) : null;
    const rows = r.areas
      .map((a) => {
        const pct = Math.round(ratio(a) * 100);
        return (
          `<tr${a === weak ? ' class="is-weak"' : ''}><th scope="row">${esc(a.name)}</th>` +
          `<td>${a.correct} / ${a.total}</td><td><span class="mq-meter"><i style="width:${pct}%"></i></span>${pct}%</td></tr>`
        );
      })
      .join('');
    const box = h(
      'div',
      { class: 'mq-dlg mq-result' },
      (auto ? '<p class="mq-note">시간이 종료되어 자동 제출되었습니다.</p>' : '') +
        `<p class="mq-score"><b>${r.score}</b><span>/ 100점</span></p>` +
        `<p class="mq-grade">${r.grade} · 정답 ${r.correct} / ${r.total} · 응답 ${r.answered} · 소요 ${clock(used)}</p>` +
        `<table class="mq-areas"><thead><tr><th scope="col">영역</th><th scope="col">정답</th><th scope="col">정답률</th></tr></thead><tbody>${rows}</tbody></table>` +
        (weak && weak.correct < weak.total
          ? `<p class="mq-weak">가장 약한 영역: <b>${esc(weak.name)}</b> — 해설부터 확인하세요.</p>`
          : '') +
        `<div class="mq-actions"><button type="button" class="mq-btn mq-review">문항별 해설 보기</button>` +
        `<button type="button" class="mq-btn primary mq-retry">다시 풀기</button></div>`,
    );
    box.addEventListener('click', (e) => {
      const b = (e.target as Element).closest('button');
      if (b?.classList.contains('mq-review')) {
        ctx.closeDialog();
        const list = $('.mq-list');
        if (list) list.scrollTop = 0;
      } else if (b?.classList.contains('mq-retry')) {
        ctx.closeDialog();
        reset();
      }
    });
    ctx.openDialog('채점 결과', box, { kind: 'quiz' });
  }

  function submit(isAuto: boolean): void {
    if (phase !== 'running') return;
    stop();
    auto = isAuto;
    used = Math.min(minutes * 60, Math.round((Date.now() - started) / 1000));
    result = scoreExam(items, answers);
    phase = 'review';
    render();
    ctx.events.emit('submit', { ...result, auto, seconds: used });
    // A time-out while the class is on another slide updates the form without popping a dialog.
    if (!isAuto || !ctx.slide || ctx.slide.classList.contains('active')) summary();
  }

  function reset(): void {
    stop();
    answers.clear();
    result = null;
    phase = 'idle';
    render();
    $<HTMLButtonElement>('.mq-begin')?.focus();
  }

  function select(b: HTMLElement): void {
    const li = b.closest<HTMLElement>('.mq-item');
    const id = li?.dataset.q;
    if (!li || id === undefined) return;
    answers.set(id, Number(b.dataset.i));
    li.dataset.state = 'answered';
    li.querySelectorAll('.mq-opt').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    const n = $('.mq-count');
    if (n) n.textContent = String(answers.size);
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    const c = b.classList;
    if (c.contains('mq-begin')) start();
    else if (c.contains('mq-min')) {
      minutes = clamp(minutes + Number(b.dataset.d), 1, 180);
      $('.mq-min-val')!.textContent = `${minutes}분`;
    } else if (c.contains('mq-opt') && phase === 'running') select(b);
    else if (c.contains('mq-submit')) submit(false);
    else if (c.contains('mq-summary')) summary();
    else if (c.contains('mq-retry')) reset();
    else if (c.contains('mq-ref')) ctx.openSources([b.dataset.ref || '']);
  });

  render();
  return {
    destroy() {
      stop();
      root.remove();
    },
  };
}
