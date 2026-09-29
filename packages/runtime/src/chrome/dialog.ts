// Generic modal `#dialog` used for sources, media credits, image popup and video.
import { $, h } from '../dom';
import { ICON } from '../icons';
import { listen, pub, pushOverlay, removeOverlay } from '../state';

let root: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

export function buildDialog(): void {
  root = h(
    'div',
    { id: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-title', hidden: true },
    `<div class="dlg-card"><header class="dlg-head"><h2 id="dialog-title"></h2>` +
      `<button type="button" class="dlg-close" title="닫기 (Esc)">${ICON.close}<span>닫기</span></button>` +
      `</header><div id="dialog-body" class="dlg-body"></div></div>`,
  );
  document.body.append(root);
  listen($('.dlg-close', root)!, 'click', closeDialog);
  listen<MouseEvent>(root, 'click', (e) => {
    if (e.target === root) closeDialog();
  });
}

export const isDialogOpen = (): boolean => !!root && !root.hidden;

export function openDialog(title: string, content: string | Node, kind = 'detail'): void {
  if (!root) return;
  pub('modal');
  if (!isDialogOpen()) returnFocus = document.activeElement as HTMLElement | null;
  $('#dialog-title', root)!.textContent = title;
  const b = $('#dialog-body', root)!;
  b.replaceChildren();
  if (typeof content === 'string') b.innerHTML = content;
  else b.append(content);
  b.scrollTop = 0;
  root.dataset.kind = kind;
  root.hidden = false;
  document.body.classList.add('dialog-open');
  pushOverlay('dialog', closeDialog);
  $<HTMLButtonElement>('.dlg-close', root)?.focus();
}

export function closeDialog(): void {
  removeOverlay('dialog');
  if (!root || root.hidden) return;
  root.hidden = true;
  // Removing the body also removes any iframe, which stops a playing video.
  $('#dialog-body', root)?.replaceChildren();
  document.body.classList.remove('dialog-open');
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}

export function resetDialog(): void {
  root = null;
  returnFocus = null;
}
