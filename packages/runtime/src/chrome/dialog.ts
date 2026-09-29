// Generic modal `#dialog` used for sources, media credits, image popup, video and plugins.
import { $, h } from '../dom';
import { ICON } from '../icons';
import { listen, pub, pushOverlay, removeOverlay } from '../state';
import type { DialogOptions } from '../types';

let root: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;
/** Options of the dialog that is currently shown (its key handler and close callback). */
let active: DialogOptions | null = null;

function release(): void {
  const a = active;
  active = null;
  a?.onClose?.();
}

/** Offers a key to the open dialog's `onKey`; true when it handled it. */
export const dialogKey = (e: KeyboardEvent): boolean => !!active?.onKey?.(e);

export function buildDialog(): void {
  root = h(
    'div',
    {
      id: 'dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'dialog-title',
      hidden: true,
    },
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

export function openDialog(
  title: string,
  content: string | Node,
  opts: string | DialogOptions = 'detail',
): void {
  if (!root) return;
  const o = typeof opts === 'string' ? { kind: opts } : opts;
  release();
  pub('modal');
  if (!isDialogOpen()) returnFocus = document.activeElement as HTMLElement | null;
  $('#dialog-title', root)!.textContent = title;
  const b = $('#dialog-body', root)!;
  b.replaceChildren();
  if (typeof content === 'string') b.innerHTML = content;
  else b.append(content);
  b.scrollTop = 0;
  root.dataset.kind = o.kind || 'detail';
  active = o;
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
  release();
}

export function resetDialog(): void {
  active = null;
  root = null;
  returnFocus = null;
}
