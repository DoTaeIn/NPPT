// `#help`: keyboard map, links to all sources and media credits, engine version and the
// mandatory Attribution line. Always present; there is no option to remove it.
import { $, esc, h } from '../dom';
import { ICON } from '../icons';
import { S, listen, pub, pushOverlay, removeOverlay } from '../state';
import { ATTRIBUTION_LEAD, ATTRIBUTION_URL, RUNTIME_VERSION } from '../version';

let root: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

const k = (...keys: string[]): string => keys.map((x) => `<kbd>${x}</kbd>`).join(' ');

/** Rows of the keyboard map (docs/spec/runtime.md §4): [navigation and panels, ink and print]. */
export function keyRows(student: boolean): Array<Array<[string, string]>> {
  const nav: Array<[string, string]> = [
    [k('→', '↓', 'Space', 'PageDown'), '다음 슬라이드'],
    [k('←', '↑', 'PageUp'), '이전 슬라이드'],
    [`${k('Home')} / ${k('End')}`, '처음 / 마지막 슬라이드'],
    [k('F'), '전체화면 켜기 / 끄기'],
    [k('N'), '발표 노트 열기 / 닫기'],
    [k('M'), '목차 열기 / 닫기'],
    [k('/'), '슬라이드 검색 (Enter로 이동)'],
    [`${k('?')} ${k('H')}`, '도움말'],
    [k('Esc'), '열린 창 닫기, 없으면 펜 끄기'],
  ];
  const ink: Array<[string, string]> = [
    [k('P'), '펜 켜기 / 끄기'],
    [k('L'), '레이저 포인터'],
    [k('E'), '지우개'],
    [k('C'), '현재 슬라이드 필기 지우기'],
    [`${k('1')}–${k('8')}`, '펜 색상 선택'],
    [`${k('Ctrl')}+${k('Z')}`, '필기 되돌리기 (펜 사용 중)'],
    [`${k('Ctrl')}+${k('P')}`, '강의용 인쇄 · 1장 = 1페이지'],
    [`${k('Ctrl')}+${k('Shift')}+${k('P')}`, '해설서 인쇄 · A4 + 노트'],
  ];
  return [student ? nav.filter(([, v]) => !v.startsWith('발표 노트')) : nav, ink];
}

export interface HelpActions {
  allSources(): void;
  mediaCredits(): void;
}

export function buildHelp(a: HelpActions): void {
  const d = S.data;
  const title = d.meta.title || document.title;
  const engine = `${d.engine.name || 'MARCO Engine'}${d.engine.version ? ` v${d.engine.version}` : ''}`;
  const tables = keyRows(S.edition === 'student')
    .map(
      (rows) =>
        `<table class="help-keys"><thead><tr><th>키</th><th>동작</th></tr></thead><tbody>` +
        rows.map(([key, v]) => `<tr><td>${key}</td><td>${v}</td></tr>`).join('') +
        '</tbody></table>',
    )
    .join('');
  const hasMedia = Object.keys(d.assets).length > 0 || d.videos.length > 0;
  root = h(
    'div',
    { id: 'help', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title', hidden: true },
    `<div class="help-card"><header class="dlg-head"><h2 id="help-title">도움말 · 키보드 단축키</h2>` +
      `<button type="button" class="dlg-close help-close" title="닫기 (Esc)">${ICON.close}<span>닫기</span></button></header>` +
      `<div class="help-body"><div class="help-cols">${tables}</div>` +
      `<p class="help-tip">화면 아래쪽에 마우스를 움직이면 조작 막대가 나타납니다. 필기는 슬라이드마다 따로 보관되며, 다른 슬라이드로 갔다가 돌아오면 다시 보입니다.</p>` +
      `<div class="help-links">` +
      `<button type="button" class="help-link" data-help="refs"${d.refs.length ? '' : ' hidden'}>모든 출처 (${d.refs.length})</button>` +
      `<button type="button" class="help-link" data-help="media"${hasMedia ? '' : ' hidden'}>이미지·영상 출처</button></div></div>` +
      `<footer class="help-about"><p class="help-version">${esc(title)} · ${esc(engine)} · 런타임 v${esc(RUNTIME_VERSION)}` +
      `${S.edition === 'student' ? ' · 학생용' : ' · 강의자용'}</p>` +
      `<p class="marco-attribution">${esc(ATTRIBUTION_LEAD)} <a href="${ATTRIBUTION_URL}" target="_blank" rel="noopener noreferrer">${ATTRIBUTION_URL}</a></p>` +
      `</footer></div>`,
  );
  document.body.append(root);
  listen(root, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t === root || t.closest('.help-close')) return toggleHelp(false);
    const link = t.closest<HTMLElement>('[data-help]');
    if (!link) return;
    toggleHelp(false);
    if (link.dataset.help === 'refs') a.allSources();
    else a.mediaCredits();
  });
}

export const isHelpOpen = (): boolean => !!root && !root.hidden;

export function toggleHelp(force?: boolean): void {
  if (!root) return;
  const open = force ?? root.hidden;
  if (open === !root.hidden) return;
  root.hidden = !open;
  if (open) {
    pub('modal');
    returnFocus = document.activeElement as HTMLElement | null;
    pushOverlay('help', () => toggleHelp(false));
    $<HTMLButtonElement>('.help-close', root)?.focus();
  } else {
    removeOverlay('help');
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  pub('ui');
}

export function resetHelp(): void {
  root = null;
  returnFocus = null;
}
