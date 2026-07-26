import test from 'node:test';
import assert from 'node:assert/strict';
import { createDoubleRoundRobin, calculateStandings, getWeekFixtures } from '../src/game/fixtures.js';

const teams = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

test('eight teams create fourteen weeks and fifty-six fixtures', () => {
  const fixtures = createDoubleRoundRobin(teams);
  assert.equal(fixtures.length, 56);
  assert.equal(Math.max(...fixtures.map((fixture) => fixture.week)), 14);
  for (let week = 1; week <= 14; week += 1) {
    const matches = getWeekFixtures(fixtures, week);
    assert.equal(matches.length, 4);
    const participants = matches.flatMap((fixture) => [fixture.homeId, fixture.awayId]);
    assert.equal(new Set(participants).size, 8);
  }
});

test('each pairing occurs once at each home ground', () => {
  const fixtures = createDoubleRoundRobin(teams);
  for (let left = 0; left < teams.length; left += 1) {
    for (let right = left + 1; right < teams.length; right += 1) {
      const pair = fixtures.filter((fixture) =>
        [fixture.homeId, fixture.awayId].includes(teams[left]) &&
        [fixture.homeId, fixture.awayId].includes(teams[right]));
      assert.equal(pair.length, 2);
      assert.notEqual(pair[0].homeId, pair[1].homeId);
    }
  }
});

test('standings use points, goal difference, goals scored, then name', () => {
  const fixtures = [
    { id: '1', week: 1, homeId: 'a', awayId: 'b', played: true, homeGoals: 2, awayGoals: 0 },
    { id: '2', week: 1, homeId: 'c', awayId: 'd', played: true, homeGoals: 1, awayGoals: 0 },
    { id: '3', week: 2, homeId: 'a', awayId: 'c', played: true, homeGoals: 0, awayGoals: 1 },
    { id: '4', week: 2, homeId: 'b', awayId: 'd', played: true, homeGoals: 2, awayGoals: 0 }
  ];
  const names = { a: 'Alpha', b: 'Beta', c: 'Cobalt', d: 'Delta' };
  const table = calculateStandings(Object.keys(names), fixtures, names);
  assert.equal(table[0].teamId, 'c');
  assert.equal(table[1].teamId, 'a');
  assert.equal(table[2].teamId, 'b');
  assert.equal(table[3].teamId, 'd');
  assert.equal(table[0].points, 6);
});
