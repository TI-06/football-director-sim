import { average } from '../core/utils.js';

export function buildSecretaryReport(state) {
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const players = state.players.filter((player) => player.clubId === state.userClubId);
  const allFixtures = [...(state.fixtures ?? []), ...(state.cup?.fixtures ?? [])];
  const fixture = allFixtures
    .filter((item) => !item.played && item.week >= state.week && [item.homeId, item.awayId].includes(state.userClubId))
    .sort((a, b) => a.week - b.week)[0] ?? null;
  const opponentId = fixture ? (fixture.homeId === state.userClubId ? fixture.awayId : fixture.homeId) : null;
  const opponent = state.clubs.find((item) => item.id === opponentId) ?? null;
  const alerts = [];
  const injured = players.filter((player) => player.injuryWeeks > 0);
  const tired = players.filter((player) => player.fitness < 55);
  const requests = players.filter((player) => player.transferRequest);
  const contracts = players.filter((player) => player.contractYears <= 1);
  if (injured.length) alerts.push({ type: 'injury', title: `負傷者が${injured.length}名います`, detail: injured.slice(0, 4).map((player) => `${player.name}（${player.injuryWeeks}週）`).join('、'), view: 'squad' });
  if (tired.length) alerts.push({ type: 'fitness', title: `体力55未満の選手が${tired.length}名います`, detail: tired.slice(0, 4).map((player) => player.name).join('、'), view: 'squad' });
  if (requests.length) alerts.push({ type: 'unrest', title: `移籍希望が${requests.length}件あります`, detail: requests.slice(0, 4).map((player) => player.name).join('、'), view: 'squad' });
  if (contracts.length) alerts.push({ type: 'contract', title: `契約残り1年以下が${contracts.length}名います`, detail: contracts.slice(0, 4).map((player) => player.name).join('、'), view: 'squad' });
  const availableCash = Math.max(0, club.cash - (club.reserveCash ?? 0));
  if (availableCash > 100_000_000 && club.transferBudget < availableCash * 0.25) alerts.push({ type: 'budget', title: '移籍予算へ配分できる現金があります', detail: '理事会予備資金を除いた範囲で予算を追加できます。', view: 'club' });
  return {
    generatedWeek: state.week,
    nextMatch: fixture ? {
      fixtureId: fixture.id,
      week: fixture.week,
      competition: fixture.competitionName ?? (fixture.competition === 'cup' ? '全国王者杯' : club.divisionName),
      home: fixture.homeId === state.userClubId,
      opponentId,
      opponentName: opponent?.name ?? '未定',
      opponentReputation: opponent?.reputation ?? 0
    } : null,
    squad: {
      count: players.length,
      averageFitness: Math.round(average(players.map((player) => player.fitness))),
      averageMorale: Math.round(average(players.map((player) => player.morale))),
      injured: injured.length,
      unhappy: requests.length
    },
    budgets: {
      cash: club.cash,
      reserveCash: club.reserveCash ?? 0,
      transferBudget: club.transferBudget,
      wageBudget: club.wageBudget,
      availableCash
    },
    alerts
  };
}
