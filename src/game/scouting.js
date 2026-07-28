import { clamp, deepClone } from '../core/utils.js';
import { staffEffects } from './staff.js';

export const REGIONS = ['北海道・東北', '関東', '中部', '関西', '中国・四国', '九州・沖縄'];

export function createScoutingNetwork(rng) {
  return {
    regions: Object.fromEntries(REGIONS.map((region) => [region, { region, knowledge: rng.int(12, 32), assignedStaffId: null, reports: 0 }])),
    shortlist: []
  };
}

export function scoutingEstimate(player, field, progress = 0, knowledge = 0) {
  const value = Number(player?.[field] ?? 0);
  const confidence = clamp((Number(progress) + Number(knowledge)) / 2, 0, 100);
  const ratio = ['value', 'wage', 'askingPrice', 'askingWage'].includes(field) ? 0.55 * (1 - confidence / 115) : null;
  const uncertainty = ratio === null ? Math.max(1, Math.ceil((100 - confidence) / 9)) : Math.max(1, Math.round(value * ratio));
  return { min: Math.max(0, Math.round(value - uncertainty)), max: Math.round(value + uncertainty) };
}

export function scoutRegionalPlayer(state, playerId, region) {
  const next = deepClone(state);
  const player = next.transferMarket?.find((item) => item.id === playerId);
  const regional = next.scoutingNetwork?.regions?.[region];
  if (!player || !regional || (player.region && player.region !== region)) return { ok: false, state, message: '地域または選手が不正です。' };
  const effects = staffEffects(next.staff);
  const progress = Math.round(20 + effects.scoutingAccuracy * 35 + regional.knowledge * 0.08);
  player.region = region;
  player.scouting = clamp((player.scouting ?? 0) + progress, 0, 100);
  regional.knowledge = clamp(regional.knowledge + 4, 0, 100);
  regional.reports += 1;
  return { ok: true, state: next, message: `${player.name}の地域視察を進めました。` };
}

export function toggleShortlist(state, playerId, { priority = 'medium', neededPosition = null } = {}) {
  const next = deepClone(state);
  const player = next.transferMarket?.find((item) => item.id === playerId);
  if (!player) return { ok: false, state, message: '候補選手が見つかりません。' };
  next.scoutingNetwork ??= createScoutingNetwork({ int: () => 20 });
  const existing = next.scoutingNetwork.shortlist.findIndex((item) => item.playerId === playerId);
  if (existing >= 0) {
    next.scoutingNetwork.shortlist.splice(existing, 1);
    return { ok: true, state: next, message: `${player.name}を候補リストから外しました。` };
  }
  const price = scoutingEstimate(player, 'askingPrice', player.scouting ?? 0, next.scoutingNetwork.regions[player.region]?.knowledge ?? 20);
  next.scoutingNetwork.shortlist.unshift({
    playerId,
    priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
    neededPosition: neededPosition ?? player.position,
    estimatedPrice: price,
    scoutingProgress: player.scouting ?? 0,
    competingClubs: [],
    agentAttitude: player.personality === 'ambitious' ? '強気' : '標準',
    reason: `${neededPosition ?? player.position}の戦力・年齢構成を補える候補`
  });
  return { ok: true, state: next, message: `${player.name}を候補リストへ追加しました。` };
}
