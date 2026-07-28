import { clamp, deepClone } from '../core/utils.js';

const VALID = {
  mentality: ['defensive', 'cautious', 'balanced', 'positive', 'attacking'],
  pressing: ['low', 'normal', 'high', 'very-high'],
  tempo: ['slow', 'normal', 'fast'],
  passing: ['short', 'mixed', 'direct'],
  defensiveLine: ['deep', 'normal', 'high'],
  focus: ['left', 'balanced', 'right', 'middle'],
  formation: ['4-2-3-1', '4-3-3', '4-4-2', '3-5-2', '5-3-2']
};

const POSITION_GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'RB', 'LB', 'RWB', 'LWB', 'DM'],
  MID: ['DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW'],
  ATT: ['ST', 'AM', 'RW', 'LW', 'RM', 'LM']
};

function roleGroup(position) {
  if (position === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(position)) return 'DEF';
  if (['DM', 'CM', 'AM', 'RM', 'LM'].includes(position)) return 'MID';
  return 'ATT';
}

function replacementScore(player, outgoing, plan) {
  const group = roleGroup(outgoing.position);
  const compatible = POSITION_GROUPS[group].includes(player.position) ? 35 : 0;
  const exact = player.position === outgoing.position ? 28 : 0;
  const youth = plan.prioritizeYouth ? Math.max(0, 24 - player.age) * 1.2 : 0;
  return compatible + exact + player.overall * 0.45 + player.fitness * 0.25 + youth;
}

export function createDefaultMatchPlan() {
  return {
    automaticSubstitutions: true,
    substitutionMinute: 60,
    fitnessThreshold: 62,
    maxSubstitutions: 3,
    protectBooked: true,
    prioritizeYouth: false,
    preserveKeyPlayers: true,
    stopImportantMatches: true,
    substitutionPolicies: {},
    scoreTactics: {
      leading: { mentality: 'cautious', pressing: 'normal', tempo: 'slow', passing: 'short', defensiveLine: 'normal', focus: 'balanced' },
      drawing: { mentality: 'balanced', pressing: 'normal', tempo: 'normal', passing: 'mixed', defensiveLine: 'normal', focus: 'balanced' },
      trailing: { mentality: 'attacking', pressing: 'very-high', tempo: 'fast', passing: 'direct', defensiveLine: 'high', focus: 'middle' }
    }
  };
}

function normalizeTacticBlock(input, fallback) {
  const next = { ...fallback };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (VALID[key]?.includes(value)) next[key] = value;
  }
  return next;
}

export function normalizeMatchPlan(input = {}) {
  const defaults = createDefaultMatchPlan();
  return {
    automaticSubstitutions: input.automaticSubstitutions ?? defaults.automaticSubstitutions,
    substitutionMinute: clamp(Number(input.substitutionMinute ?? defaults.substitutionMinute), 45, 80),
    fitnessThreshold: clamp(Number(input.fitnessThreshold ?? defaults.fitnessThreshold), 40, 85),
    maxSubstitutions: clamp(Number(input.maxSubstitutions ?? defaults.maxSubstitutions), 0, 5),
    protectBooked: input.protectBooked ?? defaults.protectBooked,
    prioritizeYouth: input.prioritizeYouth ?? defaults.prioritizeYouth,
    preserveKeyPlayers: input.preserveKeyPlayers ?? defaults.preserveKeyPlayers,
    stopImportantMatches: input.stopImportantMatches ?? defaults.stopImportantMatches,
    substitutionPolicies: Object.fromEntries(Object.entries(input.substitutionPolicies ?? {}).filter(([, value]) => ['automatic', 'never', 'after-60'].includes(value))),
    scoreTactics: {
      leading: normalizeTacticBlock(input.scoreTactics?.leading, defaults.scoreTactics.leading),
      drawing: normalizeTacticBlock(input.scoreTactics?.drawing, defaults.scoreTactics.drawing),
      trailing: normalizeTacticBlock(input.scoreTactics?.trailing, defaults.scoreTactics.trailing)
    }
  };
}

export function tacticsForScoreState(plan, scoreState, baseTactics) {
  const normalized = normalizeMatchPlan(plan);
  return { ...deepClone(baseTactics), ...(normalized.scoreTactics[scoreState] ?? {}) };
}

function reasonFor(player, context, plan) {
  if (context.injuredIds.has(player.id)) return { reason: 'injury', priority: 400 };
  if (plan.protectBooked && context.bookedIds.has(player.id)) return { reason: 'booked', priority: 300 };
  if (player.fitness <= plan.fitnessThreshold) {
    const keyPlayerPriority = plan.preserveKeyPlayers ? Math.max(0, Number(player.overall ?? 0) - 65) * 0.4 : 0;
    return { reason: 'fitness', priority: 200 + (plan.fitnessThreshold - player.fitness) + keyPlayerPriority };
  }
  const rating = Number(context.liveRatings[player.id] ?? 6.5);
  if (rating < 6.1) return { reason: 'rating', priority: 100 + (6.1 - rating) * 10 };
  return null;
}

export function selectAutomaticSubstitutions({
  starters = [],
  bench = [],
  minute = 0,
  plan = createDefaultMatchPlan(),
  injuredIds = [],
  bookedIds = [],
  liveRatings = {},
  substitutionsUsed = 0
} = {}) {
  const normalized = normalizeMatchPlan(plan);
  if (!normalized.automaticSubstitutions || minute < normalized.substitutionMinute) return [];
  const availableSlots = Math.max(0, normalized.maxSubstitutions - substitutionsUsed);
  if (!availableSlots) return [];
  const context = { injuredIds: new Set(injuredIds), bookedIds: new Set(bookedIds), liveRatings };
  const candidates = starters
    .filter((player) => {
      const policy = normalized.substitutionPolicies[player.id] ?? 'automatic';
      if (policy === 'never') return false;
      if (policy === 'after-60' && minute < 60) return false;
      return player.position !== 'GK' || context.injuredIds.has(player.id);
    })
    .map((player) => ({ player, detail: reasonFor(player, context, normalized) }))
    .filter((item) => item.detail)
    .sort((left, right) => right.detail.priority - left.detail.priority || left.player.id.localeCompare(right.player.id));
  const remainingBench = [...bench];
  const changes = [];
  for (const candidate of candidates) {
    if (changes.length >= availableSlots || !remainingBench.length) break;
    remainingBench.sort((left, right) => replacementScore(right, candidate.player, normalized) - replacementScore(left, candidate.player, normalized) || left.id.localeCompare(right.id));
    const replacement = remainingBench.shift();
    changes.push({
      playerOutId: candidate.player.id,
      playerInId: replacement.id,
      reason: candidate.detail.reason
    });
  }
  return changes;
}
