import { clamp, deepClone } from '../core/utils.js';

export const BALANCE_V2 = Object.freeze({
  fitnessFloor: 14,
  longAppearanceFatigue: 2,
  fixedStarterFatigue: 1,
  winMoraleDampening: 1,
  moraleResultDelta: Object.freeze({ win: 3, draw: 1, loss: -3 }),
  highRatingMoraleBonus: 2,
  lowRatingMoralePenalty: -2,
  targetSeasonHours: Object.freeze({ min: 5, max: 8 }),
  matchMinutes: Object.freeze({ normalMin: 2, normalMax: 4, importantMin: 4, importantMax: 6 })
});

export function moraleDeltaForMatch(result, rating) {
  const resultDelta = BALANCE_V2.moraleResultDelta[result] ?? 0;
  const ratingDelta = rating >= 7.5
    ? BALANCE_V2.highRatingMoraleBonus
    : rating < 5.8
      ? BALANCE_V2.lowRatingMoralePenalty
      : 0;
  return resultDelta + ratingDelta;
}

export function seasonTempoWithinTarget(hours) {
  return hours >= BALANCE_V2.targetSeasonHours.min && hours <= BALANCE_V2.targetSeasonHours.max;
}

function userResult(report, userClubId) {
  if (!report || ![report.homeClubId, report.awayClubId].includes(userClubId)) return null;
  const isHome = report.homeClubId === userClubId;
  const scored = isHome ? report.homeGoals : report.awayGoals;
  const conceded = isHome ? report.awayGoals : report.homeGoals;
  return scored > conceded ? 'win' : scored === conceded ? 'draw' : 'loss';
}

export function applyPostMatchBalance(state, report) {
  if (!state || !report) return state;
  const next = deepClone(state);
  const result = userResult(report, next.userClubId);
  if (!result) return next;
  const playerMap = new Map(next.players.map((player) => [player.id, player]));
  for (const rating of report.playerRatings ?? []) {
    const player = playerMap.get(rating.playerId);
    if (!player || player.clubId !== next.userClubId) continue;
    const minutes = Number.isFinite(rating.minutes) ? rating.minutes : 90;
    const longAppearance = minutes >= 60 ? BALANCE_V2.longAppearanceFatigue : 0;
    const fixedStarter = player.selectionPolicy === 'starter-fixed' && rating.started !== false
      ? BALANCE_V2.fixedStarterFatigue
      : 0;
    player.fitness = clamp(player.fitness - longAppearance - fixedStarter, BALANCE_V2.fitnessFloor, 100);
    if (result === 'win') player.morale = clamp(player.morale - BALANCE_V2.winMoraleDampening, 20, 100);
  }
  next.balanceVersion = 2;
  return next;
}
