import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { generateLeague, DEFAULT_TACTICS } from '../src/data/catalog.js';
import { selectBestLineup } from '../src/game/squad.js';
import { simulateMatch } from '../src/game/match-engine.js';

function makeTeam(club, players, tactics = DEFAULT_TACTICS) {
  return {
    club,
    players,
    lineup: selectBestLineup(players, tactics.formation),
    tactics: { ...DEFAULT_TACTICS, ...tactics }
  };
}

const league = generateLeague(createRng('match-data'));
const [homeClub, awayClub] = league.clubs;
const homePlayers = league.players.filter((player) => player.clubId === homeClub.id);
const awayPlayers = league.players.filter((player) => player.clubId === awayClub.id);

test('same seed and inputs produce identical match report', () => {
  const context = {
    seed: 'deterministic-match',
    home: makeTeam(homeClub, homePlayers),
    away: makeTeam(awayClub, awayPlayers)
  };
  assert.deepEqual(simulateMatch(context), simulateMatch(context));
});

test('match report contains valid football statistics and ordered timeline', () => {
  const report = simulateMatch({
    seed: 'valid-match',
    home: makeTeam(homeClub, homePlayers),
    away: makeTeam(awayClub, awayPlayers)
  });
  assert.ok(report.homeGoals >= 0 && report.awayGoals >= 0);
  assert.equal(report.homePossession + report.awayPossession, 100);
  assert.ok(report.homeShots >= report.homeShotsOnTarget);
  assert.ok(report.awayShots >= report.awayShotsOnTarget);
  assert.ok(report.homeXg >= 0 && report.awayXg >= 0);
  assert.ok(report.events.every((event, index, events) => index === 0 || event.minute >= events[index - 1].minute));
  assert.ok(report.playerRatings.length >= 22);
});

test('stronger home team wins more often across a seed sample', () => {
  const boostedHome = homePlayers.map((player) => ({ ...player, overall: Math.min(94, player.overall + 14) }));
  let homeWins = 0;
  let awayWins = 0;
  for (let index = 0; index < 120; index += 1) {
    const report = simulateMatch({
      seed: `sample-${index}`,
      home: makeTeam(homeClub, boostedHome),
      away: makeTeam(awayClub, awayPlayers)
    });
    if (report.homeGoals > report.awayGoals) homeWins += 1;
    if (report.awayGoals > report.homeGoals) awayWins += 1;
  }
  assert.ok(homeWins > awayWins * 1.8);
});

test('high press creates more chances but more fatigue than low block', () => {
  const aggressive = makeTeam(homeClub, homePlayers, { pressing: 'very-high', tempo: 'fast', mentality: 'attacking' });
  const cautious = makeTeam(awayClub, awayPlayers, { pressing: 'low', tempo: 'slow', mentality: 'defensive' });
  let aggressiveShots = 0;
  let cautiousShots = 0;
  let aggressiveFatigue = 0;
  let cautiousFatigue = 0;
  for (let index = 0; index < 80; index += 1) {
    const report = simulateMatch({ seed: `press-${index}`, home: aggressive, away: cautious });
    aggressiveShots += report.homeShots;
    cautiousShots += report.awayShots;
    aggressiveFatigue += report.fatigueImpact.home;
    cautiousFatigue += report.fatigueImpact.away;
  }
  assert.ok(aggressiveShots > cautiousShots);
  assert.ok(aggressiveFatigue > cautiousFatigue);
});

test('match timeline includes automatic substitutions from both benches', () => {
  const report = simulateMatch({
    seed: 'substitution-match',
    home: makeTeam(homeClub, homePlayers),
    away: makeTeam(awayClub, awayPlayers)
  });
  const substitutions = report.events.filter((event) => event.type === 'substitution');
  assert.ok(substitutions.some((event) => event.side === 'home'));
  assert.ok(substitutions.some((event) => event.side === 'away'));
  assert.ok(substitutions.every((event) => event.playerInId && event.playerOutId));
});
