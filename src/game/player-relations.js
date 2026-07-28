import { clamp, deepClone } from '../core/utils.js';

const PERSONALITIES = ['professional', 'ambitious', 'loyal', 'moody', 'leader', 'mentor', 'fragile'];
const MEETING_EFFECTS = {
  praise: { trust: 6, morale: 5, label: '活躍を褒める' },
  'warn-form': { trust: -2, morale: -3, professionalism: 2, label: '不調を注意する' },
  rest: { trust: 4, morale: 3, fitness: 10, label: '休養を与える' },
  captain: { trust: 8, morale: 6, leadership: 3, label: 'キャプテン任命' },
  'transfer-request': { trust: 2, morale: 1, label: '移籍希望への対応' },
  contract: { trust: 3, morale: 2, label: '契約更新について話す' },
  'playing-time': { trust: 2, morale: 2, label: '出場機会について話す' },
  position: { trust: 1, morale: 1, label: 'ポジション変更について話す' }
};

export function initializePlayerRelations(players, rng) {
  return players.map((player) => ({
    ...player,
    personality: player.personality ?? rng.pick(PERSONALITIES),
    managerTrust: player.managerTrust ?? rng.int(55, 78),
    loyalty: player.loyalty ?? rng.int(45, 88),
    ambition: player.ambition ?? rng.int(35, 92),
    professionalism: player.professionalism ?? rng.int(45, 92),
    pressure: player.pressure ?? rng.int(35, 90),
    leadership: player.leadership ?? rng.int(20, 88),
    teamGroup: player.teamGroup ?? rng.int(1, 4),
    selectionPolicy: player.selectionPolicy ?? 'automatic'
  }));
}

export function holdPlayerMeeting(state, playerId, meetingType) {
  const next = deepClone(state);
  const player = next.players.find((item) => item.id === playerId && item.clubId === next.userClubId);
  const effect = MEETING_EFFECTS[meetingType];
  if (!player || !effect) return { ok: false, state, message: '面談内容が不正です。' };
  player.managerTrust = clamp(player.managerTrust + (effect.trust ?? 0), 0, 100);
  player.morale = clamp(player.morale + (effect.morale ?? 0), 20, 100);
  player.fitness = clamp(player.fitness + (effect.fitness ?? 0), 20, 100);
  player.professionalism = clamp(player.professionalism + (effect.professionalism ?? 0), 0, 100);
  player.leadership = clamp(player.leadership + (effect.leadership ?? 0), 0, 100);
  next.meetingHistory ??= [];
  next.meetingHistory.unshift({ id: `meeting-${next.season}-${next.week}-${player.id}-${meetingType}`, playerId, meetingType, week: next.week });
  return { ok: true, state: next, message: `${player.name}と「${effect.label}」の面談を行いました。` };
}

export function createPromise(state, { playerId, promiseType, target = 1, window = 5, position = null } = {}) {
  const next = deepClone(state);
  const player = next.players.find((item) => item.id === playerId && item.clubId === next.userClubId);
  if (!player || !['starts', 'contract', 'position', 'not-sell'].includes(promiseType)) return { ok: false, state, message: '約束内容が不正です。' };
  next.playerPromises ??= [];
  if (next.playerPromises.some((promise) => promise.playerId === playerId && promise.type === promiseType && promise.status === 'active')) {
    return { ok: false, state, message: '同じ約束が進行中です。' };
  }
  const promise = {
    id: `promise-${next.season}-${next.week}-${playerId}-${promiseType}`,
    playerId,
    type: promiseType,
    target: Math.max(1, Number(target) || 1),
    progress: 0,
    baselineStarts: player.starts ?? 0,
    baselineContractYears: player.contractYears ?? 0,
    position,
    createdWeek: next.week,
    deadlineWeek: next.week + Math.max(1, Number(window) || 1),
    status: 'active'
  };
  next.playerPromises.unshift(promise);
  return { ok: true, state: next, message: `${player.name}との約束を記録しました。` };
}

function fulfill(player, promise) {
  promise.status = 'fulfilled';
  player.managerTrust = clamp(player.managerTrust + 8, 0, 100);
  player.morale = clamp(player.morale + 6, 20, 100);
}

function breakPromise(state, player, promise) {
  promise.status = 'broken';
  player.managerTrust = clamp(player.managerTrust - 15, 0, 100);
  player.morale = clamp(player.morale - 10, 20, 100);
  player.concerns ??= [];
  if (!player.concerns.includes('約束違反')) player.concerns.push('約束違反');
  for (const teammate of state.players.filter((item) => item.clubId === player.clubId && item.id !== player.id && item.teamGroup === player.teamGroup)) {
    teammate.managerTrust = clamp(teammate.managerTrust - 3, 0, 100);
    teammate.morale = clamp(teammate.morale - 2, 20, 100);
  }
}

export function updatePromises(state) {
  const next = deepClone(state);
  next.playerPromises ??= [];
  for (const promise of next.playerPromises) {
    if (promise.status !== 'active') continue;
    const player = next.players.find((item) => item.id === promise.playerId);
    if (!player) continue;
    if (promise.type === 'starts') promise.progress = Math.max(promise.progress ?? 0, (player.starts ?? 0) - (promise.baselineStarts ?? 0));
    if (promise.type === 'contract' && (player.contractYears ?? 0) > (promise.baselineContractYears ?? 0)) promise.progress = promise.target;
    if (promise.progress >= promise.target) fulfill(player, promise);
    else if (next.week > promise.deadlineWeek) breakPromise(next, player, promise);
  }
  return next;
}
