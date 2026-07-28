import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSaveDialog, createConfirmDialog, createMenuDialog, renderGameDialog } from '../src/ui/dialogs.js';

test('game confirmation dialog renders accessible branded actions', () => {
  const dialog = createConfirmDialog({
    id: 'sell-player',
    title: '選手を売却しますか？',
    message: '移籍オファーを受諾します。',
    detail: '実行後は取り消せません。',
    confirmLabel: '売却する',
    tone: 'danger'
  });
  const html = renderGameDialog(dialog);
  assert.match(html, /data-game-dialog="sell-player"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /data-dialog-confirm/);
  assert.match(html, /data-dialog-cancel/);
  assert.match(html, /売却する/);
  assert.match(html, /dialog--danger/);
});

test('game menu dialog exposes navigation commands without browser prompts', () => {
  const html = renderGameDialog(createMenuDialog({
    title: 'クラブメニュー',
    items: [
      { label: '戦術', nav: 'tactics' },
      { label: 'セーブを書き出す', command: 'export-save' }
    ]
  }));
  assert.match(html, /data-dialog-nav="tactics"/);
  assert.match(html, /data-dialog-command="export-save"/);
  assert.doesNotMatch(html, /window\.(?:alert|confirm|prompt)/);

  const cloud = renderGameDialog(createCloudSaveDialog({ operation: 'save' }));
  assert.match(cloud, /data-cloud-form/);
  assert.match(cloud, /name="cloudUserId"/);
  assert.match(cloud, /name="cloudPassword"/);
  assert.match(cloud, /data-cloud-action="login"/);
  assert.match(cloud, /data-cloud-action="register"/);
});
