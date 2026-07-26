import { FORMATIONS } from '../data/catalog.js';
import { average, clamp } from '../core/utils.js';

const GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'RB', 'LB', 'RWB', 'LWB'],
  MID: ['DM', 'CM', 'AM', 'RM', 'LM'],
  WIDE: ['RW', 'LW', 'RM', 'LM', 'RWB', 'LWB'],
  ATT: ['ST', 'AM', 'RW', 'LW']
};

export function positionCompatibility(player, slotPosition) {
  if (!player) return 0;
  if (player.position === slotPosition) return 1;
  if (player.secondaryPositions?.includes(slotPosition)) return 0.9;
  if (slotPosition === 'CB' && ['DM', 'RB', 'LB'].includes(player.position)) return 0.72;
  if (slotPosition === 'RB' && ['RWB', 'CB', 'RM'].includes(player.position)) return 0.75;
  if (slotPosition === 'LB' && ['LWB', 'CB', 'LM'].includes(player.position)) return 0.75;
  if (slotPosition === 'RWB' && ['RB', 'RM', 'RW'].includes(player.position)) return 0.8;
  if (slotPosition === 'LWB' && ['LB', 'LM', 'LW'].includes(player.position)) return 0.8;
  if (slotPosition === 'DM' && ['CM', 'CB'].includes(player.position)) return 0.82;
  if (slotPosition === 'CM' && ['DM', 'AM', 'RM', 'LM'].includes(player.position)) return 0.84;
  if (slotPosition === 'AM' && ['CM', 'ST', 'RW', 'LW'].includes(player.position)) return 0.82;
  if (slotPosition === 'RW' && ['RM', 'LW', 'AM'].includes(player.position)) return 0.84;
  if (slotPosition === 'LW' && ['LM', 'RW', 'AM'].includes(player.position)) return 0.84;
  if (slotPosition === 'RM' && ['RW', 'CM', 'RWB'].includes(player.position)) return 0.82;
  if (slotPosition === 'LM' && ['LW', 'CM', 'LWB'].includes(player.position)) return 0.82;
  if (slotPosition === 'ST' && ['AM', 'RW', 'LW'].includes(player.position)) return 0.72;
  if (slotPosition === 'GK' || player.position === 'GK') return 0.12;
  const playerGroup = Object.values(GROUPS).find((group) => group.includes(player.position));
  const slotGroup = Object.values(GROUPS).find((group) => group.includes(slotPosition));
  return playerGroup === slotGroup ? 0.58 : 0.38;
}

export function playerSlotScore(player, slotPosition) {
  const compatibility = positionCompatibility(player, slotPosition);
  const condition = player.fitness * 0.12 + player.form * 0.08 + player.morale * 0.05;
  const roleAttribute = slotPosition === 'GK'
    ? player.keeping
    : ['CB', 'RB', 'LB', 'RWB', 'LWB', 'DM'].includes(slotPosition)
      ? player.defense * 0.48 + player.physical * 0.18 + player.passing * 0.12
      : ['CM', 'AM', 'RM', 'LM'].includes(slotPosition)
        ? player.passing * 0.42 + player.attack * 0.22 + player.pace * 0.12
        : player.attack * 0.48 + player.pace * 0.2 + player.passing * 0.1;
  return (player.overall * 0.58 + roleAttribute * 0.32 + condition * 0.1) * compatibility;
}

export function selectBestLineup(players, formationId = '4-2-3-1') {
  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-2-3-1'];
  const eligible = players.filter((player) => player.injuryWeeks <= 0 && !player.suspended);
  const used = new Set();
  const starters = [];

  const orderedSlots = [...formation.slots].sort((a, b) => (a.position === 'GK' ? -1 : b.position === 'GK' ? 1 : 0));
  for (const slot of orderedSlots) {
    const candidates = eligible
      .filter((player) => !used.has(player.id))
      .sort((a, b) => playerSlotScore(b, slot.position) - playerSlotScore(a, slot.position));
    const selected = candidates[0];
    if (!selected) continue;
    used.add(selected.id);
    starters.push({ slotId: slot.id, slotPosition: slot.position, playerId: selected.id, x: slot.x, y: slot.y });
  }

  starters.sort((a, b) => formation.slots.findIndex((slot) => slot.id === a.slotId) - formation.slots.findIndex((slot) => slot.id === b.slotId));
  const bench = eligible
    .filter((player) => !used.has(player.id))
    .sort((a, b) => b.overall + b.form * 0.1 - (a.overall + a.form * 0.1))
    .slice(0, 7)
    .map((player) => player.id);
  return { starters, bench, captainId: starters.find((entry) => players.find((player) => player.id === entry.playerId)?.position !== 'GK')?.playerId ?? starters[0]?.playerId ?? null, penaltyTakerId: starters.find((entry) => entry.slotPosition === 'ST')?.playerId ?? starters[0]?.playerId ?? null };
}

export function validateLineup(players, lineup, formationId = '4-2-3-1') {
  const errors = [];
  const formation = FORMATIONS[formationId];
  if (!formation) errors.push('Unsupported formation.');
  if (!lineup || lineup.starters?.length !== 11) errors.push('Exactly eleven starters are required.');
  const ids = lineup?.starters?.map((entry) => entry.playerId) ?? [];
  if (new Set(ids).size !== ids.length) errors.push('A player cannot occupy multiple starting slots.');
  const playerMap = new Map(players.map((player) => [player.id, player]));
  for (const id of ids) {
    const player = playerMap.get(id);
    if (!player) errors.push(`Unknown player: ${id}`);
    else if (player.injuryWeeks > 0 || player.suspended) errors.push(`${player.name} is unavailable.`);
  }
  const expectedSlots = new Set(formation?.slots.map((slot) => slot.id) ?? []);
  const actualSlots = new Set(lineup?.starters?.map((entry) => entry.slotId) ?? []);
  if ([...expectedSlots].some((slotId) => !actualSlots.has(slotId))) errors.push('Formation slots are incomplete.');
  return { valid: errors.length === 0, errors };
}

export function lineupRating(players, lineup, formationId = '4-2-3-1') {
  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-2-3-1'];
  const map = new Map(players.map((player) => [player.id, player]));
  const scores = lineup.starters.map((entry) => {
    const player = map.get(entry.playerId);
    const slot = formation.slots.find((candidate) => candidate.id === entry.slotId);
    return playerSlotScore(player, slot?.position ?? entry.slotPosition);
  });
  return clamp(average(scores), 1, 99);
}

export function replaceStarter(lineup, slotId, playerId, players, formationId) {
  const next = structuredClone(lineup);
  const existingSlot = next.starters.find((entry) => entry.playerId === playerId);
  const target = next.starters.find((entry) => entry.slotId === slotId);
  if (!target) return next;
  if (existingSlot) {
    [existingSlot.playerId, target.playerId] = [target.playerId, existingSlot.playerId];
  } else {
    const oldPlayer = target.playerId;
    target.playerId = playerId;
    next.bench = next.bench.filter((id) => id !== playerId);
    if (oldPlayer) next.bench.unshift(oldPlayer);
    next.bench = next.bench.slice(0, 7);
    if (next.captainId === oldPlayer) next.captainId = playerId;
    if (next.penaltyTakerId === oldPlayer) next.penaltyTakerId = playerId;
  }
  const formation = FORMATIONS[formationId] ?? FORMATIONS['4-2-3-1'];
  for (const entry of next.starters) {
    const slot = formation.slots.find((item) => item.id === entry.slotId);
    if (slot) Object.assign(entry, { slotPosition: slot.position, x: slot.x, y: slot.y });
  }
  return next;
}
