import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, playNextWeek } from '../src/game/game-engine.js';
import { renderApplication, renderMatchModal, renderNewGame } from '../src/ui/render.js';

test('new game renderer includes all setup controls', () => {
  const html = renderNewGame();
  assert.match(html, /new-game-form/);
  assert.match(html, /name="clubId"/);
  assert.match(html, /name="difficulty"/);
  assert.match(html, /キャリアを開始/);
});

test('all application views render with core navigation', () => {
  const state = createNewGame({ seed: 'ui-render', clubId: 'northbridge-fc' });
  for (const view of ['dashboard', 'squad', 'tactics', 'schedule', 'transfers', 'academy', 'club', 'inbox']) {
    const html = renderApplication(state, view);
    assert.match(html, /app-shell/);
    assert.match(html, new RegExp(`data-nav="${view}"`));
    assert.doesNotMatch(html, />undefined</);
  }
});

test('match modal renders score data and commentary events', () => {
  const state = createNewGame({ seed: 'ui-match', clubId: 'northbridge-fc' });
  const played = playNextWeek(state);
  const html = renderMatchModal(played.state, played.matchReport, true);
  assert.match(html, /match-scoreboard/);
  assert.match(html, /data-match-event/);
  assert.match(html, /マッチスタッツ/);
});

test('squad view exposes drag targets, role state, and sorting controls', () => {
  const state = createNewGame({ seed: 'ui-squad-controls', clubId: 'northbridge-fc' });
  const html = renderApplication(state, 'squad');
  assert.match(html, /data-drag-player=/);
  assert.match(html, /data-drop-slot=/);
  assert.match(html, /data-squad-sort/);
  assert.match(html, /data-squad-role-filter/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /role-badge--captain/);
  assert.match(html, /role-badge--penalty/);
});

test('application renders active auto-advance controls and status', () => {
  const state = createNewGame({ seed: 'ui-auto-advance', clubId: 'northbridge-fc' });
  const html = renderApplication(state, 'dashboard', {
    autoAdvanceActive: true,
    autoAdvanceMessage: 'WEEK 3を自動進行中'
  });
  assert.match(html, /data-command="toggle-auto-advance"/);
  assert.match(html, /自動進行を停止/);
  assert.match(html, /WEEK 3を自動進行中/);
});
