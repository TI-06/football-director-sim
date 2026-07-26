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
