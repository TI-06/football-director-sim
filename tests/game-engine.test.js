import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, playNextWeek, performAction } from '../src/game/game-engine.js';
import { serializeGame, deserializeGame } from '../src/game/save.js';

const options = {
  managerName: 'Test Manager',
  clubId: 'jp1-01',
  difficulty: 'normal',
  seed: 'integration-seed'
};

test('new game initializes a playable sixty-club three-division pyramid', () => {
  const state = createNewGame(options);
  assert.equal(state.clubs.length, 60);
  assert.equal(state.clubs.filter((club) => club.division === 1).length, 20);
  assert.equal(state.clubs.filter((club) => club.division === 2).length, 20);
  assert.equal(state.clubs.filter((club) => club.division === 3).length, 20);
  assert.equal(state.week, 1);
  assert.equal(state.fixtures.length, 1140);
  assert.equal(state.tactics.formation, '4-2-3-1');
  assert.equal(state.lineup.starters.length, 11);
  assert.ok(state.inbox.length > 0);
});

test('playing next week records all league results and advances the calendar', () => {
  const state = createNewGame(options);
  const result = playNextWeek(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.week, 2);
  assert.equal(result.state.fixtures.filter((fixture) => fixture.week === 1 && fixture.played).length, 30);
  assert.ok(result.matchReport);
  assert.ok(result.state.matchReports.length >= 1);
});

test('a full season completes without duplicate or missing fixtures', () => {
  let state = createNewGame({ ...options, seed: 'full-season' });
  for (let index = 0; index < 44; index += 1) {
    const result = playNextWeek(state);
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.seasonStatus, 'complete');
  assert.equal(state.fixtures.filter((fixture) => fixture.played).length, 1140);
  assert.equal(state.standings.every((row) => row.played === 38), true);
  assert.equal(state.standings.some((row) => row.teamId === state.userClubId), true);
  assert.equal(state.cup.history.length, 6);
  assert.ok(state.cup.championClubId);
});



test('completed season keeps the final table visible after a third-division promotion', () => {
  let state = createNewGame({ ...options, clubId: 'jp3-01', seed: 'full-season' });
  for (let index = 0; index < 44; index += 1) state = playNextWeek(state).state;
  assert.equal(state.history.seasons[0].movement, 'promoted');
  assert.equal(state.clubs.find((club) => club.id === state.userClubId).division, 2);
  assert.equal(state.standings.some((row) => row.teamId === state.userClubId), true);
  assert.equal(state.standings.every((row) => row.played === 38), true);
});

test('tactics action validates and updates supported fields', () => {
  const state = createNewGame(options);
  const action = performAction(state, {
    type: 'update-tactics',
    payload: { formation: '4-3-3', mentality: 'attacking', pressing: 'high' }
  });
  assert.equal(action.ok, true);
  assert.equal(action.state.tactics.formation, '4-3-3');
  assert.equal(action.state.lineup.starters.length, 11);
});

test('save serialization round trip preserves the state', () => {
  const state = createNewGame(options);
  const advanced = playNextWeek(state).state;
  const serialized = serializeGame(advanced);
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.encoding, 'lzw-base64');
  assert.ok(serialized.length < JSON.stringify(advanced).length * 0.5);
  const restored = deserializeGame(serialized);
  assert.deepEqual(restored, advanced);
  assert.throws(() => deserializeGame('{"schemaVersion":999}'), /unsupported|invalid/i);
});

test('academy receives a deterministic intake every eight completed weeks', () => {
  let state = createNewGame({ ...options, seed: 'academy-intake' });
  const initialCount = state.academy.filter((player) => player.clubId === state.userClubId).length;
  for (let index = 0; index < 8; index += 1) state = playNextWeek(state).state;
  const nextCount = state.academy.filter((player) => player.clubId === state.userClubId).length;
  assert.equal(nextCount, initialCount + 2);
  assert.ok(state.inbox.some((item) => item.category === 'アカデミー' && /新加入/.test(item.title)));
});

test('completed career can start a fresh second season', () => {
  let state = createNewGame({ ...options, seed: 'multi-season' });
  for (let index = 0; index < 44; index += 1) state = playNextWeek(state).state;
  const result = performAction(state, { type: 'start-next-season' });
  assert.equal(result.ok, true);
  assert.equal(result.state.season, 2);
  assert.equal(result.state.week, 1);
  assert.equal(result.state.seasonStatus, 'active');
  assert.equal(result.state.fixtures.length, 1140);
  assert.equal(result.state.fixtures.every((fixture) => !fixture.played), true);
  assert.equal(result.state.standings.length, 20);
  assert.equal(result.state.standings.every((row) => row.played === 0), true);
  assert.equal(result.state.history.seasons.length, 1);
});
