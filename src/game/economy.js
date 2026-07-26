import { deepClone, clamp } from '../core/utils.js';

export function clubWeeklyWages(state, clubId) {
  return state.players
    .filter((player) => player.clubId === clubId)
    .reduce((sum, player) => sum + (player.wage || 0), 0);
}

function addLedger(state, clubId, type, label, amount, week = state.week) {
  state.finances ??= { ledger: [] };
  state.finances.ledger.unshift({ id: `ledger-${week}-${type}-${state.finances.ledger.length}`, week, clubId, type, label, amount, timestamp: Date.now() });
  state.finances.ledger = state.finances.ledger.slice(0, 100);
}

export function settleWeeklyFinances(state, { userHomeMatch = false, won = false, drawn = false } = {}) {
  const next = deepClone(state);
  const club = next.clubs.find((item) => item.id === next.userClubId);
  if (!club) return next;
  const wages = clubWeeklyWages(next, club.id);
  const sponsor = club.sponsorWeekly;
  const attendanceRate = clamp(0.57 + club.fanMood / 240 + (won ? 0.05 : drawn ? 0.01 : -0.02), 0.45, 0.98);
  const gate = userHomeMatch ? Math.round(club.capacity * attendanceRate * club.ticketPrice) : 0;
  const performance = won ? 3_000_000 : drawn ? 1_000_000 : 0;
  club.cash += sponsor + gate + performance - wages;
  addLedger(next, club.id, 'income', 'スポンサー収入', sponsor);
  if (gate) addLedger(next, club.id, 'income', 'ホームゲーム入場料', gate);
  if (performance) addLedger(next, club.id, 'income', won ? '勝利ボーナス' : '引分ボーナス', performance);
  addLedger(next, club.id, 'expense', '選手給与', -wages);
  return next;
}

export const FACILITY_COSTS = {
  training: [0, 90_000_000, 160_000_000, 270_000_000, 430_000_000],
  academy: [0, 75_000_000, 140_000_000, 240_000_000, 390_000_000],
  scouting: [0, 60_000_000, 115_000_000, 200_000_000, 330_000_000],
  stadium: [0, 150_000_000, 260_000_000, 430_000_000, 700_000_000]
};

export function facilityUpgradeCost(club, facility) {
  const current = club.facilities[facility] ?? 1;
  if (current >= 5) return null;
  return FACILITY_COSTS[facility]?.[current] ?? null;
}

export function upgradeFacility(state, facility) {
  const next = deepClone(state);
  const club = next.clubs.find((item) => item.id === next.userClubId);
  if (!club || !Object.hasOwn(club.facilities, facility)) return { ok: false, state, message: '施設が見つかりません。' };
  const cost = facilityUpgradeCost(club, facility);
  if (cost === null) return { ok: false, state, message: 'この施設は最大レベルです。' };
  if (club.cash < cost) return { ok: false, state, message: '施設投資に必要な資金が不足しています。' };
  club.cash -= cost;
  club.facilities[facility] += 1;
  if (facility === 'stadium') club.capacity = Math.round(club.capacity * 1.12);
  addLedger(next, club.id, 'expense', `施設強化: ${facility}`, -cost);
  return { ok: true, state: next, message: '施設を強化しました。' };
}
