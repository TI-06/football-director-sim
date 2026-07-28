import { clamp, deepClone } from '../core/utils.js';

const AXES = ['league', 'cup', 'finance', 'youth', 'attack', 'local', 'stars', 'supporters'];
const OBJECTIVES = {
  safe: { level: 'safe', label: '安全', requiredScore: 48, budgetMultiplier: 1.02, reputationReward: 1 },
  standard: { level: 'standard', label: '標準', requiredScore: 60, budgetMultiplier: 1.08, reputationReward: 3 },
  challenge: { level: 'challenge', label: '挑戦', requiredScore: 72, budgetMultiplier: 1.18, reputationReward: 7 }
};

export function createBoardEvaluation(club = {}) {
  const initial = clamp(Number(club.boardConfidence ?? 65), 0, 100);
  const axes = Object.fromEntries(AXES.map((axis) => [axis, axis === 'supporters' ? clamp(Number(club.fanMood ?? initial), 0, 100) : initial]));
  return { axes, weights: Object.fromEntries(AXES.map((axis) => [axis, 1])), overall: initial, status: 'secure', lowScoreWeeks: 0, objective: OBJECTIVES.standard };
}

export function updateBoardEvaluation(evaluation, changes = {}) {
  const next = deepClone(evaluation);
  for (const axis of AXES) if (Number.isFinite(Number(changes[axis]))) next.axes[axis] = clamp(Number(changes[axis]), 0, 100);
  const weighted = AXES.reduce((sum, axis) => sum + next.axes[axis] * (next.weights?.[axis] ?? 1), 0);
  const weightTotal = AXES.reduce((sum, axis) => sum + (next.weights?.[axis] ?? 1), 0);
  next.overall = Math.round(weighted / weightTotal);
  next.lowScoreWeeks = next.overall < 45 ? (next.lowScoreWeeks ?? 0) + 1 : 0;
  if (next.lowScoreWeeks >= 3) next.status = 'dismissed';
  else if (next.lowScoreWeeks >= 2) next.status = 'final-warning';
  else if (next.lowScoreWeeks >= 1) next.status = 'warning';
  else next.status = 'secure';
  return next;
}

export function chooseSeasonObjective(state, level) {
  const objective = OBJECTIVES[level];
  if (!objective) return { ok: false, state, message: 'シーズン目標が不正です。' };
  const next = deepClone(state);
  next.boardEvaluation ??= createBoardEvaluation(next.clubs.find((club) => club.id === next.userClubId));
  const club = next.clubs.find((item) => item.id === next.userClubId);
  if (!club) return { ok: false, state, message: 'クラブが見つかりません。' };
  if (next.boardEvaluation.objectiveSeason !== next.season) {
    next.boardEvaluation.objectiveBaseTransferBudget = club.transferBudget;
    next.boardEvaluation.objectiveSeason = next.season;
  }
  const baseBudget = Number(next.boardEvaluation.objectiveBaseTransferBudget ?? club.transferBudget);
  next.boardEvaluation.objective = objective;
  club.transferBudget = Math.round(baseBudget * objective.budgetMultiplier);
  return { ok: true, state: next, message: `今季目標を「${objective.label}」に設定しました。` };
}
