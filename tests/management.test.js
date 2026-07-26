import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague, generateTransferMarket } from '../src/data/catalog.js';
import { settleWeeklyFinances, upgradeFacility } from '../src/game/economy.js';
import { applyWeeklyTraining, recoverPlayers, promoteProspect } from '../src/game/development.js';
import { buyPlayer, listPlayerForSale } from '../src/game/transfers.js';
import { generateWeeklyEvent, resolveEvent } from '../src/game/events.js';

function makeState() {
  const rng = createRng('management');
  const league = generateLeague(rng);
  const userClub = league.clubs[0];
  return {
    seed: 'management',
    week: 2,
    userClubId: userClub.id,
    clubs: league.clubs,
    players: league.players,
    academy: league.academy,
    transferMarket: generateTransferMarket(rng, 12, 1),
    finances: { ledger: [] },
    inbox: [],
    history: { events: [] }
  };
}

test('weekly finances add revenue, subtract wages, and create ledger entries', () => {
  const state = makeState();
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const before = club.cash;
  const next = settleWeeklyFinances(state, { userHomeMatch: true, won: true });
  const afterClub = next.clubs.find((item) => item.id === next.userClubId);
  assert.notEqual(afterClub.cash, before);
  assert.ok(next.finances.ledger.length >= 3);
});

test('fitness training improves condition but carries greater injury risk metadata', () => {
  const state = makeState();
  const result = applyWeeklyTraining(state, 'fitness', createRng('training'));
  const beforePlayers = state.players.filter((player) => player.clubId === state.userClubId);
  const afterPlayers = result.state.players.filter((player) => player.clubId === state.userClubId);
  const beforeAverage = beforePlayers.reduce((sum, player) => sum + player.fitness, 0) / beforePlayers.length;
  const afterAverage = afterPlayers.reduce((sum, player) => sum + player.fitness, 0) / afterPlayers.length;
  assert.ok(afterAverage >= beforeAverage);
  assert.ok(result.summary.injuryRisk >= 0);
});

test('recovery reduces injury duration and fatigue', () => {
  const state = makeState();
  const player = state.players.find((item) => item.clubId === state.userClubId);
  player.injuryWeeks = 2;
  player.fitness = 45;
  const next = recoverPlayers(state);
  const recovered = next.players.find((item) => item.id === player.id);
  assert.equal(recovered.injuryWeeks, 1);
  assert.ok(recovered.fitness > 45);
});

test('buying a player validates cash and wage budget', () => {
  const state = makeState();
  const target = state.transferMarket[0];
  const result = buyPlayer(state, target.id);
  assert.equal(result.ok, true);
  assert.equal(result.state.transferMarket.some((player) => player.id === target.id), false);
  assert.equal(result.state.players.some((player) => player.id === target.id && player.clubId === state.userClubId), true);
});

test('listing and academy promotion update player status', () => {
  const state = makeState();
  const senior = state.players.find((player) => player.clubId === state.userClubId);
  const listed = listPlayerForSale(state, senior.id);
  assert.equal(listed.ok, true);
  assert.equal(listed.state.players.find((player) => player.id === senior.id).listed, true);
  const prospect = state.academy.find((player) => player.clubId === state.userClubId);
  prospect.age = 17;
  const promoted = promoteProspect(state, prospect.id);
  assert.equal(promoted.ok, true);
  assert.equal(promoted.state.players.some((player) => player.id === prospect.id), true);
});

test('facility upgrade spends cash and raises a level', () => {
  const state = makeState();
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const beforeCash = club.cash;
  const beforeLevel = club.facilities.training;
  const result = upgradeFacility(state, 'training');
  assert.equal(result.ok, true);
  const updated = result.state.clubs.find((item) => item.id === state.userClubId);
  assert.equal(updated.facilities.training, beforeLevel + 1);
  assert.ok(updated.cash < beforeCash);
});

test('weekly event can be resolved and applies choice effects once', () => {
  const state = makeState();
  const generated = generateWeeklyEvent(state, createRng('event-seed'));
  assert.ok(generated.inbox.length >= state.inbox.length);
  const event = generated.inbox.find((item) => item.kind === 'decision');
  assert.ok(event);
  const resolved = resolveEvent(generated, event.id, event.choices[0].id);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.inbox.find((item) => item.id === event.id).resolved, true);
  const repeated = resolveEvent(resolved.state, event.id, event.choices[0].id);
  assert.equal(repeated.ok, false);
});

test('selected club does not receive opponent difficulty boost', async () => {
  const { generateLeague } = await import('../src/data/catalog.js');
  const normal = generateLeague(createRng('difficulty-selected'), 'normal', 'azure-city');
  const hard = generateLeague(createRng('difficulty-selected'), 'hard', 'azure-city');
  const averageOverall = (league, clubId) => {
    const players = league.players.filter((player) => player.clubId === clubId);
    return players.reduce((sum, player) => sum + player.overall, 0) / players.length;
  };
  assert.equal(averageOverall(normal, 'azure-city'), averageOverall(hard, 'azure-city'));
  assert.ok(averageOverall(hard, 'redhaven-athletic') > averageOverall(normal, 'redhaven-athletic'));
});

test('transfer ledger records the actual agreed fee', () => {
  const state = makeState();
  const target = state.transferMarket[0];
  const fee = target.askingPrice;
  const result = buyPlayer(state, target.id);
  assert.equal(result.ok, true);
  assert.equal(result.state.finances.ledger[0].amount, -fee);
});

test('event choice cannot create an unapproved negative cash balance', () => {
  const state = makeState();
  state.clubs.find((club) => club.id === state.userClubId).cash = 1;
  state.inbox.unshift({
    id: 'expensive-event', kind: 'decision', title: '高額投資', body: '', category: '経営', week: 2, resolved: false,
    choices: [{ id: 'pay', label: '支払う', description: '', effects: { cash: -10_000_000 } }]
  });
  const result = resolveEvent(state, 'expensive-event', 'pay');
  assert.equal(result.ok, false);
  assert.match(result.message, /資金/);
});

test('releasing a player pays compensation and removes him from the squad', async () => {
  const { releasePlayer } = await import('../src/game/transfers.js');
  const state = makeState();
  const player = state.players.find((item) => item.clubId === state.userClubId && item.position !== 'GK');
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const expectedCompensation = player.wage * 12;
  const beforeCash = club.cash;
  const result = releasePlayer(state, player.id);
  assert.equal(result.ok, true);
  assert.equal(result.state.players.some((item) => item.id === player.id), false);
  assert.equal(result.state.clubs.find((item) => item.id === state.userClubId).cash, beforeCash - expectedCompensation);
  assert.equal(result.state.finances.ledger[0].amount, -expectedCompensation);
});

test('weekly event generation can produce a deterministic quiet week', () => {
  const state = makeState();
  const generated = generateWeeklyEvent(state, createRng('director-2026:event:1:1'));
  assert.equal(generated.inbox.length, 0);
});

test('an unresolved decision blocks additional weekly events', () => {
  const state = makeState();
  state.inbox.unshift({
    id: 'pending-decision', kind: 'decision', title: 'Pending', body: '', category: '経営', week: 1,
    resolved: false, choices: [{ id: 'ok', label: 'OK', description: '', effects: {} }]
  });
  const generated = generateWeeklyEvent(state, createRng('unresolved-0'));
  assert.equal(generated.inbox.length, 1);
  assert.equal(generated.inbox[0].id, 'pending-decision');
});
