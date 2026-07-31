import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNewGame, prepareNextWeek } from '../src/game/game-engine.js';
import { playNextWeek as playNextWeekV2 } from '../src/game/game-engine-v2.js';
import { createLiveMatchSession, advanceLiveMatchSession } from '../src/game/live-match.js';
import { SAVE_SCHEMA_VERSION, deserializeGame, serializeGame } from '../src/game/save.js';
import { applyPostMatchBalance, moraleDeltaForMatch, seasonTempoWithinTarget } from '../src/game/balance-v2.js';
import { characterArt } from '../src/ui/characters-v2.js';
import { createLivePitchModel } from '../src/ui/live-match-visual-v2.js';
import { renderApplication, renderLiveMatchCenter } from '../src/ui/render-v2.js';

const root = new URL('..', import.meta.url);

test('new save boundary uses schema 4 and rejects old wrappers explicitly', () => {
  const state = createNewGame({ seed: 'save-v4', clubId: 'jp1-01' });
  assert.equal(SAVE_SCHEMA_VERSION, 4);
  assert.equal(state.schemaVersion, 4);
  const wrapper = JSON.parse(serializeGame(state));
  assert.equal(wrapper.format, 'football-director-save-v4');
  assert.throws(() => deserializeGame(JSON.stringify({ format: 'football-director-save', schemaVersion: 3, encoding: 'lzw-base64', data: '' })), /旧バージョン/);
});

test('character art is integrated without mutation observer enhancement', () => {
  const html = characterArt('mina');
  assert.match(html, /data-character="mina"/);
  assert.match(html, /data:image\/webp;base64/);
  assert.doesNotMatch(html, /MutationObserver/);
});

test('mobile application renders five primary navigation actions and dashboard command hub', () => {
  const state = createNewGame({ seed: 'mobile-v2', clubId: 'jp1-01' });
  const html = renderApplication(state, 'dashboard');
  const nav = html.match(/<nav class="fd2-nav mobile-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.equal((nav.match(/<button/g) ?? []).length, 5);
  assert.match(nav, /data-nav="dashboard"/);
  assert.match(nav, /data-nav="schedule"/);
  assert.match(nav, /data-nav="squad"/);
  assert.match(nav, /data-nav="transfers"/);
  assert.match(nav, /data-command="open-game-menu"/);
  assert.match(html, /game-command-hub/);
  assert.match(html, /data-character="mina"/);
});

test('secondary screens embed only the legacy workspace and not a second application shell', () => {
  const state = createNewGame({ seed: 'single-shell-v2', clubId: 'jp1-01' });
  const html = renderApplication(state, 'tactics');
  assert.equal((html.match(/class="fd2-shell app-shell"/g) ?? []).length, 1);
  assert.equal((html.match(/<main class="fd2-main content"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /app-shell--three-column/);
});

test('vertical live pitch renders 22 lightweight numbered tokens and event model', () => {
  const state = createNewGame({ seed: 'live-v2', clubId: 'jp1-01' });
  const prepared = prepareNextWeek(state);
  let session = createLiveMatchSession({
    seed: prepared.matchSeed,
    home: prepared.home,
    away: prepared.away,
    userSide: prepared.userSide,
    matchPlan: state.matchPlan
  });
  session = advanceLiveMatchSession(session).session;
  const model = createLivePitchModel(session);
  assert.equal(model.tokens.length, 22);
  assert.ok(model.tokens.every((token) => Number.isFinite(Number(token.number))));
  const html = renderLiveMatchCenter(state, session);
  assert.equal((html.match(/data-live-player-token/g) ?? []).length, 22);
  assert.match(html, /fd2-vertical-pitch/);
  assert.match(html, /data-live-tactic="mentality"/);
  assert.match(html, /data-command="live-advance"/);
  assert.match(html, /data-live-player-out/);
  assert.match(html, /data-live-player-in/);
});

test('balance calibration targets five to eight hour seasons', () => {
  assert.equal(seasonTempoWithinTarget(5), true);
  assert.equal(seasonTempoWithinTarget(8), true);
  assert.equal(seasonTempoWithinTarget(4.9), false);
  assert.equal(moraleDeltaForMatch('win', 8), 5);
  assert.equal(moraleDeltaForMatch('loss', 5.5), -5);
});

test('post-match balance adds fatigue pressure and dampens repeated win morale growth', () => {
  const state = createNewGame({ seed: 'balance-v2', clubId: 'jp1-01' });
  const player = state.players.find((item) => item.clubId === state.userClubId);
  player.fitness = 80;
  player.morale = 75;
  player.selectionPolicy = 'starter-fixed';
  const report = {
    homeClubId: state.userClubId,
    awayClubId: state.clubs.find((club) => club.id !== state.userClubId).id,
    homeGoals: 2,
    awayGoals: 0,
    playerRatings: [{ playerId: player.id, minutes: 90, started: true }]
  };
  const calibrated = applyPostMatchBalance(state, report);
  const nextPlayer = calibrated.players.find((item) => item.id === player.id);
  assert.equal(nextPlayer.fitness, 77);
  assert.equal(nextPlayer.morale, 74);
  assert.equal(calibrated.balanceVersion, 2);
  assert.equal(player.fitness, 80);
});

test('calibrated weekly progression applies balance after the actual user match', () => {
  const state = createNewGame({ seed: 'balance-wrapper-v2', clubId: 'jp1-01' });
  const result = playNextWeekV2(state);
  assert.equal(result.ok, true);
  assert.ok(result.matchReport);
  assert.equal(result.state.balanceVersion, 2);
});

test('mobile style contract includes fixed five-tab navigation and reduced motion', async () => {
  const css = await readFile(new URL('src/mobile-game-v2.css', root), 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(5/);
  assert.match(css, /@media \(max-width:\s*360px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.fd2-player-token/);
});
