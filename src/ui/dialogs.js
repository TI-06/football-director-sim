import { escapeHtml, icon } from './templates.js';

function normalizeTone(tone) {
  return ['normal', 'danger', 'warning'].includes(tone) ? tone : 'normal';
}

export function createConfirmDialog({
  id = 'confirmation',
  title,
  message,
  detail = '',
  confirmLabel = '実行する',
  cancelLabel = 'キャンセル',
  tone = 'normal'
}) {
  return {
    type: 'confirm',
    id,
    title: String(title ?? '確認'),
    message: String(message ?? ''),
    detail: String(detail ?? ''),
    confirmLabel: String(confirmLabel),
    cancelLabel: String(cancelLabel),
    tone: normalizeTone(tone)
  };
}

export function createMenuDialog({ title = 'クラブメニュー', message = '移動先やセーブ操作を選択します。', items = [] } = {}) {
  return {
    type: 'menu',
    id: 'game-menu',
    title: String(title),
    message: String(message),
    detail: '',
    tone: 'normal',
    items: items
      .filter((item) => item?.label && (item.nav || item.command))
      .map((item) => ({
        label: String(item.label),
        description: String(item.description ?? ''),
        icon: String(item.icon ?? 'chevron'),
        nav: item.nav ? String(item.nav) : '',
        command: item.command ? String(item.command) : '',
        danger: Boolean(item.danger)
      }))
  };
}

function renderMenuItems(items) {
  return `<div class="game-menu-list">${items.map((item) => `<button class="game-menu-item ${item.danger ? 'game-menu-item--danger' : ''}" type="button" ${item.nav ? `data-dialog-nav="${escapeHtml(item.nav)}"` : `data-dialog-command="${escapeHtml(item.command)}"`}>
    <span class="game-menu-item__icon">${icon(item.icon, 19)}</span>
    <span><strong>${escapeHtml(item.label)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span>
    ${icon('chevron', 16)}
  </button>`).join('')}</div>`;
}

export function renderGameDialog(dialog) {
  const titleId = `game-dialog-title-${escapeHtml(dialog.id)}`;
  const descriptionId = `game-dialog-description-${escapeHtml(dialog.id)}`;
  const isMenu = dialog.type === 'menu';
  return `<div class="modal-backdrop game-dialog-backdrop" data-dialog-backdrop>
    <section class="game-dialog dialog--${escapeHtml(dialog.tone)}" data-game-dialog="${escapeHtml(dialog.id)}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${descriptionId}">
      <header class="game-dialog__header">
        <span class="game-dialog__mark">${icon(dialog.tone === 'danger' ? 'warning' : isMenu ? 'dashboard' : 'star', 22)}</span>
        <div><span class="eyebrow">FOOTBALL DIRECTOR</span><h2 id="${titleId}">${escapeHtml(dialog.title)}</h2></div>
        <button class="game-dialog__close" type="button" data-dialog-cancel aria-label="閉じる">${icon('close', 18)}</button>
      </header>
      <div class="game-dialog__body" id="${descriptionId}">
        ${dialog.message ? `<p class="game-dialog__message">${escapeHtml(dialog.message)}</p>` : ''}
        ${dialog.detail ? `<p class="game-dialog__detail">${escapeHtml(dialog.detail)}</p>` : ''}
        ${isMenu ? renderMenuItems(dialog.items) : ''}
      </div>
      ${isMenu ? '' : `<footer class="game-dialog__actions"><button class="btn btn--ghost" type="button" data-dialog-cancel>${escapeHtml(dialog.cancelLabel)}</button><button class="btn ${dialog.tone === 'danger' ? 'btn--danger' : 'btn--primary'}" type="button" data-dialog-confirm>${escapeHtml(dialog.confirmLabel)}</button></footer>`}
    </section>
  </div>`;
}
