import { createRng } from '../core/random.js';
import { deepClone } from '../core/utils.js';
import { createDoubleRoundRobin, calculateStandings } from './fixtures.js';

export const CUP_ROUND_WEEKS = [4, 9, 14, 20, 27, 35];
export const SEASON_WEEKS = 44;
export const LEAGUE_WEEKS = Array.from({ length: SEASON_WEEKS }, (_, index) => index + 1)
  .filter((week) => !CUP_ROUND_WEEKS.includes(week));

function leagueFixturesForDivision(clubs, division) {
  const ids = clubs.filter((club) => club.division === division).map((club) => club.id);
  return createDoubleRoundRobin(ids).map((fixture) => ({
    ...fixture,
    id: `d${division}-${fixture.id}`,
    round: fixture.week,
    week: LEAGUE_WEEKS[fixture.week - 1],
    competition: 'league',
    competitionName: `日本${division}部`,
    division
  }));
}

function cupFixture(homeId, awayId, round, index) {
  return {
    id: `cup-r${round}-${index + 1}-${homeId}-${awayId}`,
    competition: 'cup',
    competitionName: '全国王者杯',
    round,
    week: CUP_ROUND_WEEKS[round - 1],
    homeId,
    awayId,
    played: false,
    homeGoals: null,
    awayGoals: null,
    reportId: null,
    qualifiedId: null,
    penaltyWinnerId: null
  };
}

export function createSeasonCompetitions(clubs, seed) {
  const leagueFixtures = [1, 2, 3].flatMap((division) => leagueFixturesForDivision(clubs, division));
  const rng = createRng(`${seed}:national-cup`);
  const entrants = rng.shuffle(clubs.map((club) => club.id));
  const byeCandidates = [...clubs].sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id)).slice(0, 4).map((club) => club.id);
  const byes = byeCandidates;
  const firstRoundEntrants = entrants.filter((id) => !byes.includes(id));
  const fixtures = [];
  for (let index = 0; index < firstRoundEntrants.length; index += 2) {
    fixtures.push(cupFixture(firstRoundEntrants[index], firstRoundEntrants[index + 1], 1, index / 2));
  }
  return {
    leagueFixtures,
    cup: {
      name: '全国王者杯',
      round: 1,
      fixtures,
      byes,
      eliminatedClubIds: [],
      championClubId: null,
      history: []
    }
  };
}

export function calculateDivisionStandings(clubs, leagueFixtures) {
  const names = Object.fromEntries(clubs.map((club) => [club.id, club.name]));
  return Object.fromEntries([1, 2, 3].map((division) => {
    const ids = clubs.filter((club) => club.division === division).map((club) => club.id);
    const fixtures = leagueFixtures.filter((fixture) => fixture.division === division);
    return [division, calculateStandings(ids, fixtures, names)];
  }));
}

export function competitionFixturesForWeek(state, week) {
  return [
    ...(state.fixtures ?? []).filter((fixture) => fixture.week === week),
    ...(state.cup?.fixtures ?? []).filter((fixture) => fixture.week === week)
  ];
}

export function resolveCupQualification(fixture, rng) {
  if (fixture.homeGoals > fixture.awayGoals) return fixture.homeId;
  if (fixture.awayGoals > fixture.homeGoals) return fixture.awayId;
  return rng.chance(0.5) ? fixture.homeId : fixture.awayId;
}

export function advanceCup(cup, seed) {
  const next = deepClone(cup);
  const current = next.fixtures.filter((fixture) => fixture.round === next.round);
  if (!current.length || current.some((fixture) => !fixture.played)) return next;
  const winners = current.map((fixture) => fixture.qualifiedId);
  const entrants = next.round === 1 ? [...next.byes, ...winners] : winners;
  next.history.push({ round: next.round, fixtures: current.map((fixture) => ({ ...fixture })) });
  next.eliminatedClubIds.push(...current.map((fixture) => fixture.homeId === fixture.qualifiedId ? fixture.awayId : fixture.homeId));
  if (entrants.length === 1) {
    next.championClubId = entrants[0];
    return next;
  }
  const round = next.round + 1;
  const rng = createRng(`${seed}:cup-round:${round}`);
  const shuffled = rng.shuffle(entrants);
  next.round = round;
  next.fixtures = shuffled.reduce((fixtures, homeId, index) => {
    if (index % 2 === 0) fixtures.push(cupFixture(homeId, shuffled[index + 1], round, index / 2));
    return fixtures;
  }, []);
  return next;
}

export function applyPromotionAndRelegation(clubs, standingsByDivision) {
  const next = deepClone(clubs);
  const movements = [];
  for (const division of [2, 3]) {
    for (const row of (standingsByDivision[division] ?? []).slice(0, 3)) {
      const club = next.find((item) => item.id === row.teamId);
      if (!club) continue;
      movements.push({ clubId: club.id, direction: 'promoted', fromDivision: division, toDivision: division - 1 });
      club.division = division - 1;
      club.divisionName = `日本${division - 1}部`;
      club.reputation = Math.min(90, club.reputation + 4);
    }
  }
  for (const division of [1, 2]) {
    for (const row of (standingsByDivision[division] ?? []).slice(-3)) {
      const club = next.find((item) => item.id === row.teamId);
      if (!club) continue;
      movements.push({ clubId: club.id, direction: 'relegated', fromDivision: division, toDivision: division + 1 });
      club.division = division + 1;
      club.divisionName = `日本${division + 1}部`;
      club.reputation = Math.max(35, club.reputation - 3);
    }
  }
  return { clubs: next, movements };
}
