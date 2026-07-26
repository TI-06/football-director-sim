import { deepClone, clamp } from '../core/utils.js';

const FOCUS = {
  balanced: { fitness: 2, morale: 1, growth: 0.14, attack: 0.08, defense: 0.08, passing: 0.08, risk: 0.025 },
  attacking: { fitness: -2, morale: 1, growth: 0.15, attack: 0.24, defense: 0.02, passing: 0.14, risk: 0.045 },
  defending: { fitness: -2, morale: 1, growth: 0.15, attack: 0.02, defense: 0.24, passing: 0.1, risk: 0.04 },
  fitness: { fitness: 8, morale: 0, growth: 0.11, attack: 0.02, defense: 0.02, passing: 0.02, risk: 0.06 },
  recovery: { fitness: 12, morale: 2, growth: 0.03, attack: 0, defense: 0, passing: 0, risk: 0.008 },
  youth: { fitness: -1, morale: 2, growth: 0.22, attack: 0.09, defense: 0.09, passing: 0.12, risk: 0.03 }
};

function maybeGrow(player, focus, facilityLevel, rng, youthBoost = false) {
  if (player.overall >= player.potential) return;
  const ageFactor = player.age <= 20 ? 1.7 : player.age <= 23 ? 1.25 : player.age <= 27 ? 0.55 : 0.12;
  const probability = clamp(focus.growth * ageFactor * (1 + facilityLevel * 0.08) * (youthBoost ? 1.45 : 1), 0, 0.8);
  if (rng.chance(probability)) {
    player.overall = clamp(player.overall + 1, 1, player.potential);
    const options = ['attack', 'defense', 'passing', 'pace', 'physical'];
    const chosen = rng.pick(options);
    player[chosen] = clamp(player[chosen] + 1, 1, 99);
  }
}

export function applyWeeklyTraining(state, focusId = 'balanced', rng) {
  const next = deepClone(state);
  const focus = FOCUS[focusId] ?? FOCUS.balanced;
  const club = next.clubs.find((item) => item.id === next.userClubId);
  if (!club) return { state: next, summary: { improved: 0, injuries: 0, injuryRisk: focus.risk } };
  club.trainingFocus = focusId;
  const beforeOverall = new Map(next.players.map((player) => [player.id, player.overall]));
  let injuries = 0;
  const seniors = next.players.filter((player) => player.clubId === club.id);
  for (const player of seniors) {
    player.fitness = clamp(player.fitness + focus.fitness, 20, 100);
    player.morale = clamp(player.morale + focus.morale, 20, 100);
    player.form = clamp(player.form + (focusId === 'balanced' ? 1 : 0), 20, 100);
    if (rng.chance(focus.attack)) player.attack = clamp(player.attack + 1, 1, 99);
    if (rng.chance(focus.defense)) player.defense = clamp(player.defense + 1, 1, 99);
    if (rng.chance(focus.passing)) player.passing = clamp(player.passing + 1, 1, 99);
    maybeGrow(player, focus, club.facilities.training, rng, focusId === 'youth' && player.age <= 23);
    const injuryRisk = focus.risk * Math.max(0.25, (110 - player.fitness) / 45);
    if (player.injuryWeeks <= 0 && rng.chance(injuryRisk)) {
      player.injuryWeeks = rng.int(1, 2);
      player.injuryName = 'トレーニング中の筋疲労';
      injuries += 1;
    }
  }
  for (const prospect of next.academy.filter((player) => player.clubId === club.id)) {
    prospect.morale = clamp(prospect.morale + focus.morale, 20, 100);
    maybeGrow(prospect, focus, club.facilities.academy, rng, focusId === 'youth');
  }
  next.tactics ??= { familiarity: 70 };
  next.tactics.familiarity = clamp((next.tactics.familiarity ?? 70) + (focusId === 'balanced' ? 2 : focusId === 'recovery' ? 0 : 1), 30, 100);
  const improved = seniors.filter((player) => player.overall > beforeOverall.get(player.id)).length;
  return { state: next, summary: { improved, injuries, injuryRisk: focus.risk } };
}

export function recoverPlayers(state) {
  const next = deepClone(state);
  for (const player of next.players) {
    if (player.injuryWeeks > 0) {
      player.injuryWeeks -= 1;
      if (player.injuryWeeks <= 0) player.injuryName = '';
    }
    if (player.suspended) player.suspended = false;
    player.fitness = clamp(player.fitness + (player.injuryWeeks > 0 ? 4 : 7), 20, 100);
  }
  return next;
}

export function promoteProspect(state, prospectId) {
  const next = deepClone(state);
  const index = next.academy.findIndex((player) => player.id === prospectId && player.clubId === next.userClubId);
  if (index < 0) return { ok: false, state, message: 'アカデミー選手が見つかりません。' };
  const prospect = next.academy[index];
  if (prospect.age < 16) return { ok: false, state, message: '16歳未満の選手は昇格できません。' };
  const squadSize = next.players.filter((player) => player.clubId === next.userClubId).length;
  if (squadSize >= 28) return { ok: false, state, message: 'トップチームの登録上限は28人です。' };
  prospect.wage = Math.max(180_000, Math.round(prospect.overall ** 2 * 65));
  prospect.contractYears = 3;
  prospect.scouting = 100;
  next.players.push(prospect);
  next.academy.splice(index, 1);
  return { ok: true, state: next, message: `${prospect.name}をトップチームへ昇格させました。` };
}
