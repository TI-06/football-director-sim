export const BALANCE_V2 = Object.freeze({
  fitnessFloor: 14,
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
