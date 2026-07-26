export function createDoubleRoundRobin(teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length < 2 || teamIds.length % 2 !== 0) {
    throw new Error('An even number of at least two teams is required.');
  }
  const rotation = [...teamIds];
  const firstHalf = [];
  const rounds = rotation.length - 1;

  for (let round = 0; round < rounds; round += 1) {
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      const swapHome = (round + index) % 2 === 1;
      const homeId = swapHome ? right : left;
      const awayId = swapHome ? left : right;
      firstHalf.push({
        id: `w${round + 1}-${homeId}-${awayId}`,
        week: round + 1,
        homeId,
        awayId,
        played: false,
        homeGoals: null,
        awayGoals: null,
        reportId: null
      });
    }
    rotation.splice(1, 0, rotation.pop());
  }

  const secondHalf = firstHalf.map((fixture) => ({
    ...fixture,
    id: `w${fixture.week + rounds}-${fixture.awayId}-${fixture.homeId}`,
    week: fixture.week + rounds,
    homeId: fixture.awayId,
    awayId: fixture.homeId,
    played: false,
    homeGoals: null,
    awayGoals: null,
    reportId: null
  }));

  return [...firstHalf, ...secondHalf].sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}

export function getWeekFixtures(fixtures, week) {
  return fixtures.filter((fixture) => fixture.week === week);
}

export function calculateStandings(teamIds, fixtures, teamNames = {}) {
  const rows = new Map(teamIds.map((teamId) => [teamId, {
    teamId,
    name: teamNames[teamId] ?? teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: []
  }]));

  const playedFixtures = fixtures
    .filter((fixture) => fixture.played)
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));

  for (const fixture of playedFixtures) {
    const home = rows.get(fixture.homeId);
    const away = rows.get(fixture.awayId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeGoals;
    home.goalsAgainst += fixture.awayGoals;
    away.goalsFor += fixture.awayGoals;
    away.goalsAgainst += fixture.homeGoals;

    if (fixture.homeGoals > fixture.awayGoals) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
      home.form.push('W');
      away.form.push('L');
    } else if (fixture.homeGoals < fixture.awayGoals) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
      home.form.push('L');
      away.form.push('W');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      home.form.push('D');
      away.form.push('D');
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-5);
  }

  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name, 'en'));
}
