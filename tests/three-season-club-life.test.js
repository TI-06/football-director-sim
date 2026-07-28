import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, playNextWeek, startNextSeason } from '../src/game/game-engine.js';
import { deserializeGame, serializeGame } from '../src/game/save.js';

function simulateThreeSeasons() {
  let state = createNewGame({ seed: 'three-season-club-life', clubId: 'jp3-01', managerName: '長期運用 監督' });
  for (let season = 1; season <= 3; season += 1) {
    while (state.seasonStatus === 'active') {
      const result = playNextWeek(state);
      assert.equal(result.ok, true, result.message);
      state = result.state;
    }
    if (season < 3) {
      const next = startNextSeason(state);
      assert.equal(next.ok, true, next.message);
      state = next.state;
    }
  }
  return state;
}

const longRunState = simulateThreeSeasons();

test('three-season career keeps all club-life scouting and match-culture systems operational', () => {
  assert.equal(longRunState.season, 3);
  assert.equal(longRunState.seasonStatus, 'complete');
  assert.equal(longRunState.managerProfile.matches > 100, true);
  assert.equal(longRunState.staff.length >= 3, true);
  assert.deepEqual(new Set(longRunState.staff.map((member) => member.role)), new Set(['head', 'medical', 'secretary']));
  assert.equal(Object.keys(longRunState.scoutingNetwork.regions).length, 6);
  assert.equal(longRunState.setPieces.familiarity > 55, true);
  assert.equal(Array.isArray(longRunState.rivalries), true);
  assert.equal(longRunState.matchReports.length > 0, true);
  assert.equal(longRunState.players.filter((player) => player.clubId === longRunState.userClubId).length >= 18, true);
});

test('three-season schema-v3 save remains below cloud limit and round-trips manager and club state', () => {
  const serialized = serializeGame(longRunState);
  assert.equal(Buffer.byteLength(serialized, 'utf8') <= 4 * 1024 * 1024, true);
  const restored = deserializeGame(serialized);
  assert.equal(restored.season, longRunState.season);
  assert.deepEqual(restored.managerProfile, longRunState.managerProfile);
  assert.deepEqual(restored.boardEvaluation, longRunState.boardEvaluation);
  assert.deepEqual(restored.setPieces, longRunState.setPieces);
  assert.equal(restored.players.length, longRunState.players.length);
});
