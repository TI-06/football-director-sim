import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';
import { REGIONS, createScoutingNetwork, scoutingEstimate } from '../src/game/scouting.js';

test('scouting network tracks all six Japanese regions', () => {
  const network = createScoutingNetwork(createRng('network'));
  assert.deepEqual(Object.keys(network.regions), REGIONS);
  assert.equal(network.shortlist.length, 0);
});

test('scouting estimate narrows as progress and regional knowledge rise', () => {
  const player = { overall: 76, potential: 84, value: 180_000_000, wage: 1_200_000 };
  const wide = scoutingEstimate(player, 'overall', 10, 10);
  const narrow = scoutingEstimate(player, 'overall', 80, 80);
  assert.ok((wide.max - wide.min) > (narrow.max - narrow.min));
  assert.ok(narrow.min <= 76 && narrow.max >= 76);
});

test('regional scouting increases knowledge and player progress', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'regional-scouting' });
  const player = state.transferMarket[0];
  player.region = '関東';
  player.scouting = 0;
  const before = state.scoutingNetwork.regions['関東'].knowledge;
  const result = performAction(state, { type: 'scout-regional-player', payload: { playerId: player.id, region: '関東' } });
  assert.equal(result.ok, true);
  assert.ok(result.state.transferMarket.find((item) => item.id === player.id).scouting > 0);
  assert.ok(result.state.scoutingNetwork.regions['関東'].knowledge > before);
});

test('shortlist stores priority position estimate and recommendation', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'shortlist' });
  const player = state.transferMarket[0];
  const result = performAction(state, { type: 'toggle-shortlist', payload: { playerId: player.id, priority: 'high', neededPosition: 'ST' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.scoutingNetwork.shortlist[0].playerId, player.id);
  assert.equal(result.state.scoutingNetwork.shortlist[0].priority, 'high');
  assert.ok(result.state.scoutingNetwork.shortlist[0].reason);
});
