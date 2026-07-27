import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, prepareNextWeek } from '../src/game/game-engine.js';
import { createLiveMatchSession, advanceLiveMatchSession } from '../src/game/live-match.js';
import { renderApplication, renderLiveMatchCenter } from '../src/ui/render.js';

test('live match center renders decision controls, tactical inputs, and substitutions', () => {
  const state = createNewGame({ seed: 'live-ui', clubId: 'jp1-01' });
  const prepared = prepareNextWeek(state);
  let session = createLiveMatchSession({
    seed: prepared.matchSeed,
    home: prepared.home,
    away: prepared.away,
    userSide: prepared.userSide,
    matchPlan: state.matchPlan
  });
  session = advanceLiveMatchSession(session).session;
  const html = renderLiveMatchCenter(state, session);
  assert.match(html, /data-live-match/);
  assert.match(html, /data-live-tactic="mentality"/);
  assert.match(html, /data-live-tactic="pressing"/);
  assert.match(html, /data-live-player-out/);
  assert.match(html, /data-live-player-in/);
  assert.match(html, /data-command="live-advance"/);
  assert.match(html, /前半終了|45分/);
});

test('mobile shell uses five primary actions and dashboard behaves like a command hub', () => {
  const state = createNewGame({ seed: 'mobile-shell', clubId: 'jp1-01' });
  const html = renderApplication(state, 'dashboard');
  const mobileNav = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  const actions = mobileNav.match(/<button/g) ?? [];
  assert.equal(actions.length, 5);
  assert.match(mobileNav, /data-nav="dashboard"/);
  assert.match(mobileNav, /data-nav="schedule"/);
  assert.match(mobileNav, /data-nav="squad"/);
  assert.match(mobileNav, /data-nav="transfers"/);
  assert.match(mobileNav, /data-command="open-game-menu"/);
  assert.match(html, /game-command-hub/);
  assert.match(html, /mobile-continue-bar/);
});

test('tactics page exposes editable automatic substitution and score reaction plan', () => {
  const state = createNewGame({ seed: 'match-plan-ui', clubId: 'jp1-01' });
  const html = renderApplication(state, 'tactics');
  assert.match(html, /data-match-plan-key="substitutionMinute"/);
  assert.match(html, /data-match-plan-key="fitnessThreshold"/);
  assert.match(html, /data-match-plan-key="automaticSubstitutions"/);
  assert.match(html, /data-match-plan-score="leading"/);
  assert.match(html, /data-match-plan-score="trailing"/);
});
