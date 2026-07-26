import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame, playNextWeek, performAction } from '../src/game/game-engine.js';
import { serializeGame, deserializeGame } from '../src/game/save.js';

const options = {
  managerName: 'Test Manager',
  clubId: 'northbridge-fc',
  clubName: 'Northbridge FC',
  difficulty: 'normal',
  seed: 'integration-seed'
};

test('new game initializes a playable eight-club league', () => {
  const state = createNewGame(options);
  assert.equal(state.clubs.length, 8);
  assert.equal(state.week, 1);
  assert.equal(state.fixtures.length, 56);
  assert.equal(state.tactics.formation, '4-2-3-1');
  assert.equal(state.lineup.starters.length, 11);
  assert.ok(state.inbox.length > 0);
});

test('playing next week records all league results and advances the calendar', () => {
  const state = createNewGame(options);
  const result = playNextWeek(state);
  assert.equal(result.ok, true);
  assert.equal(result.state.week, 2);
  assert.equal(result.state.fixtures.filter((fixture) => fixture.week === 1 && fixture.played).length, 4);
  assert.ok(result.matchReport);
  assert.ok(result.state.matchReports.length >= 1);
});

test('a full season completes without duplicate or missing fixtures', () => {
  let state = createNewGame({ ...options, seed: 'full-season' });
  for (let index = 0; index < 14; index += 1) {
    const result = playNextWeek(state);
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.seasonStatus, 'complete');
  assert.equal(state.fixtures.filter((fixture) => fixture.played).length, 56);
  assert.equal(state.standings.every((row) => row.played === 14), true);
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
  const restored = deserializeGame(serializeGame(advanced));
  assert.deepEqual(restored, advanced);
  assert.throws(() => deserializeGame('{"schemaVersion":999}'), /unsupported|invalid/i);
});

test('academy receives a deterministic intake every four completed weeks', () => {
  let state = createNewGame({ ...options, seed: 'academy-intake' });
  const initialCount = state.academy.filter((player) => player.clubId === state.userClubId).length;
  for (let index = 0; index < 4; index += 1) state = playNextWeek(state).state;
  const nextCount = state.academy.filter((player) => player.clubId === state.userClubId).length;
  assert.equal(nextCount, initialCount + 2);
  assert.ok(state.inbox.some((item) => item.category === 'アカデミー' && /新加入/.test(item.title)));
});

test('completed career can start a fresh second season', () => {
  let state = createNewGame({ ...options, seed: 'multi-season' });
  for (let index = 0; index < 14; index += 1) state = playNextWeek(state).state;
  const result = performAction(state, { type: 'start-next-season' });
  assert.equal(result.ok, true);
  assert.equal(result.state.season, 2);
  assert.equal(result.state.week, 1);
  assert.equal(result.state.seasonStatus, 'active');
  assert.equal(result.state.fixtures.length, 56);
  assert.equal(result.state.fixtures.every((fixture) => !fixture.played), true);
  assert.equal(result.state.standings.every((row) => row.played === 0), true);
  assert.equal(result.state.history.seasons.length, 1);
});
