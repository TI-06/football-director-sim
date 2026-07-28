import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';
import { initializePlayerRelations, updatePromises } from '../src/game/player-relations.js';

test('player relations initialize personality trust loyalty and one of four groups', () => {
  const players = initializePlayerRelations([
    { id: 'p1', age: 19 }, { id: 'p2', age: 27 }, { id: 'p3', age: 32 }
  ], createRng('relations'));
  for (const player of players) {
    assert.ok(player.personality);
    assert.ok(Number.isFinite(player.managerTrust));
    assert.ok(Number.isFinite(player.loyalty));
    assert.ok(player.teamGroup >= 1 && player.teamGroup <= 4);
  }
});

test('praising a player improves trust and morale', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'meeting-praise' });
  const player = state.players.find((item) => item.clubId === state.userClubId);
  const beforeTrust = player.managerTrust;
  const beforeMorale = player.morale;
  const result = performAction(state, { type: 'hold-player-meeting', payload: { playerId: player.id, meetingType: 'praise' } });
  const updated = result.state.players.find((item) => item.id === player.id);
  assert.equal(result.ok, true);
  assert.ok(updated.managerTrust > beforeTrust);
  assert.ok(updated.morale > beforeMorale);
});

test('starter promise records deadline target and progress', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'promise-create' });
  const playerId = state.players.find((item) => item.clubId === state.userClubId).id;
  const result = performAction(state, {
    type: 'create-player-promise',
    payload: { playerId, promiseType: 'starts', target: 3, window: 5 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.playerPromises[0].deadlineWeek, state.week + 5);
  assert.equal(result.state.playerPromises[0].target, 3);
  assert.equal(result.state.playerPromises[0].progress, 0);
});

test('fulfilled promise raises trust and marks completion', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'promise-fulfilled' });
  const player = state.players.find((item) => item.clubId === state.userClubId);
  const before = player.managerTrust;
  state.playerPromises = [{ id: 'promise-1', playerId: player.id, type: 'starts', target: 1, progress: 1, deadlineWeek: state.week, status: 'active' }];
  const updated = updatePromises(state);
  assert.equal(updated.playerPromises[0].status, 'fulfilled');
  assert.ok(updated.players.find((item) => item.id === player.id).managerTrust > before);
});

test('broken promise lowers trust and spreads unrest to the same team group', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'promise-broken' });
  const squad = state.players.filter((item) => item.clubId === state.userClubId);
  squad[1].teamGroup = squad[0].teamGroup;
  const beforeTarget = squad[0].managerTrust;
  const beforeMate = squad[1].managerTrust;
  state.playerPromises = [{ id: 'promise-2', playerId: squad[0].id, type: 'starts', target: 3, progress: 0, deadlineWeek: state.week - 1, status: 'active' }];
  const updated = updatePromises(state);
  assert.equal(updated.playerPromises[0].status, 'broken');
  assert.ok(updated.players.find((item) => item.id === squad[0].id).managerTrust < beforeTarget);
  assert.ok(updated.players.find((item) => item.id === squad[1].id).managerTrust < beforeMate);
});
