import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague } from '../src/data/catalog.js';
import {
  CUP_ROUND_WEEKS,
  SEASON_WEEKS,
  createSeasonCompetitions,
  applyPromotionAndRelegation
} from '../src/game/competitions.js';

test('season competition schedule has thirty-eight league rounds and six cup dates', () => {
  const league = generateLeague(createRng('competitions'));
  const competitions = createSeasonCompetitions(league.clubs, 'competitions');
  assert.equal(SEASON_WEEKS, 44);
  assert.deepEqual(CUP_ROUND_WEEKS, [4, 9, 14, 20, 27, 35]);
  for (const division of [1, 2, 3]) {
    const fixtures = competitions.leagueFixtures.filter((fixture) => fixture.division === division);
    assert.equal(fixtures.length, 380);
    assert.equal(new Set(fixtures.map((fixture) => fixture.week)).size, 38);
  }
  assert.equal(competitions.cup.round, 1);
  assert.equal(competitions.cup.fixtures.length, 28);
  assert.equal(competitions.cup.byes.length, 4);
});

test('promotion and relegation moves three clubs between each adjacent division', () => {
  const league = generateLeague(createRng('promotion'));
  const standingsByDivision = {};
  for (const division of [1, 2, 3]) {
    standingsByDivision[division] = league.clubs
      .filter((club) => club.division === division)
      .map((club, index) => ({ teamId: club.id, points: 100 - index }));
  }
  const before = Object.fromEntries(league.clubs.map((club) => [club.id, club.division]));
  const result = applyPromotionAndRelegation(league.clubs, standingsByDivision);
  assert.equal(result.movements.filter((item) => item.direction === 'promoted').length, 6);
  assert.equal(result.movements.filter((item) => item.direction === 'relegated').length, 6);
  assert.equal(result.clubs.filter((club) => club.division === 1).length, 20);
  assert.equal(result.clubs.filter((club) => club.division === 2).length, 20);
  assert.equal(result.clubs.filter((club) => club.division === 3).length, 20);
  assert.ok(result.movements.some((item) => before[item.clubId] !== item.toDivision));
});
