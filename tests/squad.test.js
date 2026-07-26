import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague } from '../src/data/catalog.js';
import { selectBestLineup, validateLineup, lineupRating, replaceStarter } from '../src/game/squad.js';

const league = generateLeague(createRng('squad-test'));
const club = league.clubs[0];
const players = league.players.filter((player) => player.clubId === club.id);

test('auto selection returns eleven unique eligible starters and seven bench players', () => {
  const lineup = selectBestLineup(players, '4-2-3-1');
  assert.equal(lineup.starters.length, 11);
  assert.equal(new Set(lineup.starters.map((entry) => entry.playerId)).size, 11);
  assert.equal(lineup.bench.length, 7);
  assert.equal(validateLineup(players, lineup, '4-2-3-1').valid, true);
});

test('injured and suspended players are excluded by auto selection', () => {
  const unavailable = players.map((player, index) => ({
    ...player,
    injuryWeeks: index < 2 ? 3 : player.injuryWeeks,
    suspended: index === 2
  }));
  const lineup = selectBestLineup(unavailable, '4-3-3');
  const chosen = new Set(lineup.starters.map((entry) => entry.playerId));
  assert.equal(chosen.has(unavailable[0].id), false);
  assert.equal(chosen.has(unavailable[1].id), false);
  assert.equal(chosen.has(unavailable[2].id), false);
});

test('playing players in compatible positions rates higher', () => {
  const lineup = selectBestLineup(players, '4-4-2');
  const good = lineupRating(players, lineup, '4-4-2');
  const swapped = structuredClone(lineup);
  const goalkeeper = swapped.starters.find((entry) => entry.slotPosition === 'GK');
  const striker = swapped.starters.find((entry) => entry.slotPosition === 'ST');
  [goalkeeper.playerId, striker.playerId] = [striker.playerId, goalkeeper.playerId];
  const bad = lineupRating(players, swapped, '4-4-2');
  assert.ok(good > bad + 5);
});

test('replacing a role holder keeps captain and penalty assignments on starters', () => {
  const lineup = selectBestLineup(players, '4-2-3-1');
  const roleHolderId = lineup.captainId;
  lineup.penaltyTakerId = roleHolderId;
  const roleHolderSlot = lineup.starters.find((entry) => entry.playerId === roleHolderId);
  const incomingId = lineup.bench[0];

  const changed = replaceStarter(lineup, roleHolderSlot.slotId, incomingId, players, '4-2-3-1');
  const starterIds = new Set(changed.starters.map((entry) => entry.playerId));

  assert.equal(changed.starters.length, 11);
  assert.equal(starterIds.size, 11);
  assert.equal(starterIds.has(changed.captainId), true);
  assert.equal(starterIds.has(changed.penaltyTakerId), true);
  assert.equal(changed.captainId, incomingId);
  assert.equal(changed.penaltyTakerId, incomingId);
});

test('dropping one starter onto another slot swaps them without duplicates', () => {
  const lineup = selectBestLineup(players, '4-3-3');
  const [first, second] = lineup.starters.slice(1, 3);
  const changed = replaceStarter(lineup, second.slotId, first.playerId, players, '4-3-3');

  assert.equal(changed.starters.find((entry) => entry.slotId === first.slotId).playerId, second.playerId);
  assert.equal(changed.starters.find((entry) => entry.slotId === second.slotId).playerId, first.playerId);
  assert.equal(new Set(changed.starters.map((entry) => entry.playerId)).size, 11);
});
