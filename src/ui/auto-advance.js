import { isDerby } from '../game/rivalries.js';

export function unresolvedDecisionIds(state) {
  return (state?.inbox ?? [])
    .filter((item) => item.kind === 'decision' && !item.resolved)
    .map((item) => item.id);
}

export function operationalStopReason(state) {
  if ((state?.playerPromises ?? []).some((item) => item.status === 'active' && item.deadlineWeek <= state.week + 1)) return 'promise';
  if (['warning', 'final-warning', 'dismissed'].includes(state?.boardEvaluation?.status)) return 'board-warning';
  if ((state?.managerOffers ?? []).some((item) => item.status === 'open' && item.expiresWeek >= state.week)) return 'manager-offer';
  if ((state?.transferNegotiations ?? []).some((item) => item.status === 'open')) return 'negotiation';
  if ((state?.staff ?? []).some((item) => !item.interim && item.contractWeeks > 0 && item.contractWeeks <= 4)) return 'staff-contract';
  return null;
}

export function autoAdvanceStopReason(previousDecisionIds, state) {
  if (!state) return 'season-complete';
  const currentIds = unresolvedDecisionIds(state);
  if (currentIds.length) {
    const previous = previousDecisionIds instanceof Set ? previousDecisionIds : new Set(previousDecisionIds ?? []);
    return currentIds.some((id) => !previous.has(id)) ? 'decision' : 'pending-decision';
  }
  const operation = operationalStopReason(state);
  if (operation) return operation;
  return state.seasonStatus === 'active' ? null : 'season-complete';
}

function currentUserFixture(state) {
  return [...(state?.fixtures ?? []), ...(state?.cup?.fixtures ?? [])]
    .find((item) => !item.played && item.week === state.week && [item.homeId, item.awayId].includes(state.userClubId));
}

export function importantFixtureReason(state) {
  if (!state?.matchPlan?.stopImportantMatches) return null;
  const fixture = currentUserFixture(state);
  if (fixture?.round >= 5 && (fixture.competition === 'cup' || (state.cup?.fixtures ?? []).includes(fixture))) return '全国王者杯の重要試合';
  if (fixture && isDerby(state.rivalries ?? [], fixture.homeId, fixture.awayId)) return 'ダービーマッチ';
  return null;
}
