import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague, DEFAULT_TACTICS } from '../src/data/catalog.js';
import { selectBestLineup } from '../src/game/squad.js';
import {
  createLiveMatchSession,
  advanceLiveMatchSession,
  makeLiveSubstitution,
  finalizeLiveMatch,
  simulateAutomaticLiveMatch
} from '../src/game/live-match.js';
import { createDefaultMatchPlan } from '../src/game/match-plan.js';
import { createNewGame, prepareNextWeek, completePreparedWeek } from '../src/game/game-engine.js';

function makeTeam(club, players, tactics = DEFAULT_TACTICS) {
  return {
    club,
    players,
    lineup: selectBestLineup(players, tactics.formation),
    tactics: { ...DEFAULT_TACTICS, ...tactics }
  };
}

const league = generateLeague(createRng('live-match-data'));
const [homeClub, awayClub] = league.clubs;
const homePlayers = league.players.filter((player) => player.clubId === homeClub.id);
const awayPlayers = league.players.filter((player) => player.clubId === awayClub.id);
const home = makeTeam(homeClub, homePlayers);
const away = makeTeam(awayClub, awayPlayers);

function completeSession(seed = 'live-session') {
  let session = createLiveMatchSession({ seed, home, away, userSide: 'home', matchPlan: createDefaultMatchPlan() });
  while (!session.completed) session = advanceLiveMatchSession(session).session;
  return session;
}

test('live match advances through four deterministic decision phases', () => {
  let session = createLiveMatchSession({ seed: 'phases', home, away, userSide: 'home' });
  const minutes = [];
  while (!session.completed) {
    const result = advanceLiveMatchSession(session);
    assert.equal(result.ok, true);
    session = result.session;
    minutes.push(session.minute);
  }
  assert.deepEqual(minutes, [45, 60, 75, 90]);
  assert.equal(session.phaseHistory.length, 4);
  assert.deepEqual(completeSession('phases'), session);
});

test('tactical changes are recorded for the next phase without rewriting completed phases', () => {
  let session = createLiveMatchSession({ seed: 'future-tactics', home, away, userSide: 'home' });
  session = advanceLiveMatchSession(session).session;
  const firstPhase = structuredClone(session.phaseHistory[0]);
  session = advanceLiveMatchSession(session, { tactics: { mentality: 'attacking', pressing: 'very-high', tempo: 'fast' } }).session;
  assert.deepEqual(session.phaseHistory[0], firstPhase);
  assert.equal(session.phaseHistory[1].homeTactics.mentality, 'attacking');
  assert.equal(session.phaseHistory[1].homeTactics.pressing, 'very-high');
});

test('manual substitution replaces a starter, consumes the bench player, and records minutes', () => {
  let session = createLiveMatchSession({ seed: 'manual-sub', home, away, userSide: 'home' });
  session = advanceLiveMatchSession(session).session;
  const outgoing = session.sides.home.lineup.find((entry) => entry.slotPosition !== 'GK');
  const incomingId = session.sides.home.bench[0];
  const result = makeLiveSubstitution(session, { side: 'home', playerOutId: outgoing.playerId, playerInId: incomingId, reason: 'manual' });
  assert.equal(result.ok, true);
  session = result.session;
  assert.equal(session.sides.home.lineup.some((entry) => entry.playerId === incomingId), true);
  assert.equal(session.sides.home.bench.includes(incomingId), false);
  assert.equal(session.substitutions.length, 1);
  const report = finalizeLiveMatch(completeFrom(session));
  const outRating = report.playerRatings.find((rating) => rating.playerId === outgoing.playerId);
  const inRating = report.playerRatings.find((rating) => rating.playerId === incomingId);
  assert.equal(outRating.minutes, 45);
  assert.equal(inRating.minutes, 45);
  assert.equal(inRating.started, false);
});

function completeFrom(initial) {
  let session = initial;
  while (!session.completed) session = advanceLiveMatchSession(session).session;
  return session;
}

test('automatic live match applies a match plan and returns a compatible report', () => {
  const report = simulateAutomaticLiveMatch({
    seed: 'auto-live',
    home,
    away,
    userSide: 'home',
    matchPlan: { ...createDefaultMatchPlan(), fitnessThreshold: 85, maxSubstitutions: 3 }
  });
  assert.equal(report.homePossession + report.awayPossession, 100);
  assert.ok(report.events.some((event) => event.type === 'phase'));
  assert.ok(report.events.some((event) => event.type === 'substitution'));
  assert.ok(report.playerRatings.length >= 22);
  assert.ok(report.playerRatings.every((rating) => Number.isFinite(rating.minutes)));
});

test('prepared week commits the user report exactly once and advances the calendar', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'prepared-week' });
  const prepared = prepareNextWeek(state);
  assert.equal(prepared.ok, true);
  assert.ok(prepared.userFixture);
  assert.equal(state.week, 1);
  const session = createLiveMatchSession({
    seed: prepared.matchSeed,
    home: prepared.home,
    away: prepared.away,
    userSide: prepared.userSide,
    matchPlan: state.matchPlan
  });
  const report = finalizeLiveMatch(completeFrom(session));
  const completed = completePreparedWeek(prepared, report);
  assert.equal(completed.ok, true);
  assert.equal(completed.state.week, 2);
  assert.equal(completed.state.matchReports.length, 1);
  const repeated = completePreparedWeek(prepared, report);
  assert.equal(repeated.ok, false);
});

test('phase ratings are accumulated into final live match ratings instead of remaining at 6.5', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'live-rating-accumulation' });
  const fixture = state.fixtures.find((item) => [item.homeId, item.awayId].includes(state.userClubId));
  const prepared = prepareNextWeek(state);
  let session = createLiveMatchSession({ seed: prepared.matchSeed, home: prepared.home, away: prepared.away, userSide: prepared.userSide, matchPlan: state.matchPlan });
  while (!session.completed) session = advanceLiveMatchSession(session).session;
  const report = finalizeLiveMatch(session);
  assert.equal(report.playerRatings.some((rating) => rating.rating !== 6.5), true);
  assert.equal(report.playerRatings.every((rating) => Number.isFinite(rating.rating)), true);
});

test('final live rating does not add goal and assist bonuses a second time', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'live-rating-no-double' });
  const prepared = prepareNextWeek(state);
  let session = createLiveMatchSession({ seed: prepared.matchSeed, home: prepared.home, away: prepared.away, userSide: prepared.userSide, matchPlan: state.matchPlan });
  while (!session.completed) session = advanceLiveMatchSession(session).session;
  const report = finalizeLiveMatch(session);
  for (const rating of report.playerRatings) assert.ok(rating.rating <= 10 && rating.rating >= 4.2);
});
