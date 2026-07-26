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
