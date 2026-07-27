import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague } from '../src/data/catalog.js';
import {
  processPlayerLifecycle,
  updatePlayerHappiness,
  calculateSeasonAwards,
  snapshotSeasonStats,
  runAiClubDevelopment
} from '../src/game/career.js';
import { buildSecretaryReport } from '../src/game/secretary.js';

function stateFixture(seed = 'career') {
  const league = generateLeague(createRng(seed));
  const userClubId = league.clubs.find((club) => club.division === 3).id;
  return {
    seed,
    season: 2,
    week: 30,
    userClubId,
    clubs: league.clubs,
    players: league.players,
    academy: league.academy,
    inbox: [],
    history: { seasons: [], awards: [], retiredPlayers: [] },
    fixtures: [],
    cup: { fixtures: [], eliminatedClubIds: [] },
    standingsByDivision: { 1: [], 2: [], 3: [] },
    standings: []
  };
}

test('player lifecycle ages players, declines veterans, and retires deterministic veterans', () => {
  const state = stateFixture('retirement');
  const veteran = state.players.find((player) => player.clubId === state.userClubId && player.position !== 'GK');
  veteran.age = 39;
  veteran.overall = 72;
  veteran.potential = 72;
  veteran.retirementAnnounced = true;
  const result = processPlayerLifecycle(state, createRng('retirement-lifecycle'));
  assert.equal(result.state.players.some((player) => player.id === veteran.id), false);
  assert.ok(result.retired.some((player) => player.id === veteran.id));
});



test('a user-club player who announces retirement remains available and creates an inbox notice', () => {
  const state = stateFixture('retirement-announcement');
  const player = state.players.find((item) => item.clubId === state.userClubId && item.position !== 'GK');
  state.players = [player];
  player.age = 34;
  player.overall = 70;
  player.potential = 70;
  player.retirementAnnounced = false;
  const chanceResults = [false, true, false];
  const rng = {
    chance: () => chanceResults.shift() ?? false,
    int: (min) => min
  };
  const result = processPlayerLifecycle(state, rng);
  const updated = result.state.players.find((item) => item.id === player.id);
  assert.ok(updated);
  assert.equal(updated.retirementAnnounced, true);
  assert.ok(result.state.inbox.some((item) => item.category === '選手' && item.title.includes(player.name) && /引退/.test(item.title)));
});

test('lack of playing time and poor morale can create a transfer request', () => {
  const state = stateFixture('unhappy');
  const player = state.players.find((item) => item.clubId === state.userClubId && item.age >= 24);
  player.appearances = 0;
  player.starts = 0;
  player.morale = 25;
  player.contractYears = 1;
  player.happiness = 30;
  const next = updatePlayerHappiness(state, createRng('unhappy-week'));
  const updated = next.players.find((item) => item.id === player.id);
  assert.ok(updated.happiness < 35);
  assert.equal(updated.transferRequest, true);
  assert.ok(updated.concerns.length > 0);
});

test('season stats are snapshotted and awards identify leading players', () => {
  const state = stateFixture('awards');
  const players = state.players.filter((player) => player.clubId === state.userClubId).slice(0, 3);
  players[0].goals = 18;
  players[0].assists = 4;
  players[0].seasonRating = 7.6;
  players[0].appearances = 30;
  players[1].goals = 6;
  players[1].assists = 15;
  players[1].seasonRating = 7.3;
  players[1].appearances = 32;
  players[2].age = 20;
  players[2].goals = 10;
  players[2].seasonRating = 7.5;
  players[2].appearances = 24;
  const awards = calculateSeasonAwards(state);
  assert.equal(awards.topScorer.playerId, players[0].id);
  assert.equal(awards.topAssists.playerId, players[1].id);
  assert.equal(awards.bestYoungPlayer.playerId, players[2].id);
  const snapshotted = snapshotSeasonStats(state);
  assert.equal(snapshotted.players.find((player) => player.id === players[0].id).seasonHistory.length, 1);
});

test('secretary report highlights fixture, fitness, contracts, unrest, and budgets', () => {
  const state = stateFixture('secretary');
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const player = state.players.find((item) => item.clubId === state.userClubId);
  player.injuryWeeks = 2;
  player.transferRequest = true;
  player.contractYears = 1;
  state.fixtures = [{ id: 'next', week: 30, homeId: state.userClubId, awayId: state.clubs.find((item) => item.division === club.division && item.id !== club.id).id, played: false, competition: 'league' }];
  const report = buildSecretaryReport(state);
  assert.ok(report.alerts.some((item) => /負傷/.test(item.title)));
  assert.ok(report.alerts.some((item) => /移籍希望/.test(item.title)));
  assert.ok(report.alerts.some((item) => /契約/.test(item.title)));
  assert.ok(report.nextMatch);
  assert.equal(typeof report.budgets.transferBudget, 'number');
});


test('AI clubs recruit stronger players between seasons while preserving squad size', () => {
  const state = stateFixture('ai-recruitment');
  const aiClub = state.clubs.find((club) => club.id !== state.userClubId && club.division === 1);
  aiClub.cash = 5_000_000_000;
  aiClub.transferBudget = 2_000_000_000;
  const squad = state.players.filter((player) => player.clubId === aiClub.id);
  const weakest = [...squad].sort((a, b) => a.overall - b.overall)[0];
  weakest.overall = 40;
  weakest.potential = 45;
  const next = runAiClubDevelopment(state, createRng('ai-recruitment-window'));
  const updated = next.players.filter((player) => player.clubId === aiClub.id);
  assert.equal(updated.length, squad.length);
  assert.equal(updated.some((player) => player.id === weakest.id), false);
  assert.ok(updated.some((player) => player.id.startsWith('ai-signing-')));
});
