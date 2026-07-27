export function unresolvedDecisionIds(state) {
  return (state?.inbox ?? [])
    .filter((item) => item.kind === 'decision' && !item.resolved)
    .map((item) => item.id);
}

export function autoAdvanceStopReason(previousDecisionIds, state) {
  if (!state) return 'season-complete';
  const currentIds = unresolvedDecisionIds(state);
  if (currentIds.length) {
    const previous = previousDecisionIds instanceof Set ? previousDecisionIds : new Set(previousDecisionIds ?? []);
    return currentIds.some((id) => !previous.has(id)) ? 'decision' : 'pending-decision';
  }
  return state.seasonStatus === 'active' ? null : 'season-complete';
}

export function importantFixtureReason(state) {
  if (!state?.matchPlan?.stopImportantMatches) return null;
  const cupFixture = (state.cup?.fixtures ?? [])
    .find((item) => !item.played && item.week === state.week && [item.homeId, item.awayId].includes(state.userClubId));
  if (cupFixture?.round >= 5) return '全国王者杯の重要試合';
  return null;
}
