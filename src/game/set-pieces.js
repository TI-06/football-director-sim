import { clamp, deepClone } from '../core/utils.js';

const TEMPLATES = {
  attackingCorner: ['near-post', 'far-post', 'crowd-center', 'short-corner'],
  defendingCorner: ['zonal', 'man-marking', 'counter-ready'],
  attackingFreeKick: ['direct', 'cross', 'short'],
  defendingFreeKick: ['wall', 'zonal', 'counter-ready'],
  longThrow: ['box-target', 'short-retain']
};

export function createDefaultSetPieces() {
  return {
    familiarity: 55,
    trainingShare: 10,
    routines: {
      attackingCorner: { template: 'near-post', kickerId: null, firstTargetId: null, secondTargetId: null, counterPlayers: 2 },
      defendingCorner: { template: 'zonal', markerMode: 'zonal', counterPlayers: 1 },
      attackingFreeKick: { template: 'direct', kickerId: null, firstTargetId: null },
      defendingFreeKick: { template: 'wall', markerMode: 'zonal' },
      longThrow: { template: 'box-target', throwerId: null, firstTargetId: null }
    }
  };
}

export function normalizeSetPieces(input = {}) {
  const defaults = createDefaultSetPieces();
  const next = deepClone(defaults);
  next.familiarity = clamp(Number(input.familiarity ?? defaults.familiarity), 0, 100);
  next.trainingShare = clamp(Number(input.trainingShare ?? defaults.trainingShare), 0, 40);
  for (const [key, fallback] of Object.entries(defaults.routines)) {
    const candidate = input.routines?.[key] ?? {};
    next.routines[key] = { ...fallback, ...candidate };
    if (!TEMPLATES[key].includes(candidate.template)) next.routines[key].template = fallback.template;
    next.routines[key].counterPlayers = clamp(Number(next.routines[key].counterPlayers ?? fallback.counterPlayers ?? 0), 0, 4);
  }
  return next;
}

export function setPieceModifier(plan, coachingAbility = 50) {
  const normalized = normalizeSetPieces(plan);
  const quality = (normalized.familiarity * 0.72 + clamp(coachingAbility, 0, 100) * 0.28) / 100;
  return {
    attack: clamp((quality - 0.35) * 0.1, -0.03, 0.08),
    defense: clamp((quality - 0.4) * 0.085, -0.03, 0.08),
    familiarityGain: clamp(normalized.trainingShare / 40 * 3, 0, 3)
  };
}

export function trainSetPieces(state) {
  const next = deepClone(state);
  next.setPieces = normalizeSetPieces(next.setPieces);
  next.setPieces.familiarity = clamp(next.setPieces.familiarity + setPieceModifier(next.setPieces, 60).familiarityGain, 0, 100);
  return next;
}
