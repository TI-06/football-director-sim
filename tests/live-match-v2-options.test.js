import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, prepareNextWeek } from '../src/game/game-engine.js';
import { createLiveMatchSession } from '../src/game/live-match.js';
import { renderLiveMatchCenterV2 } from '../src/ui/live-match-view-v2.js';

test('live match formation selector exposes only catalog formations', () => {
  const state = createNewGame({ seed: 'live-formations-v2', clubId: 'jp1-01' });
  const prepared = prepareNextWeek(state);
  const session = createLiveMatchSession({
    seed: prepared.matchSeed,
    home: prepared.home,
    away: prepared.away,
    userSide: prepared.userSide,
    matchPlan: state.matchPlan
  });
  const html = renderLiveMatchCenterV2(state, session);
  assert.match(html, /value="5-3-2"/);
  assert.doesNotMatch(html, /value="3-5-2"/);
  assert.match(html, /data-command="live-substitute"/);
});
