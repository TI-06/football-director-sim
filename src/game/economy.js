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
  const projects = club.projects ?? {};
  const maintenance = Object.entries(PROJECTS).reduce((sum, [key, project]) => sum + (projects[key] ?? 0) * project.weeklyMaintenance, 0)
    + Object.values(club.facilities ?? {}).reduce((sum, level) => sum + level * 180_000, 0);
  const commercial = (projects.commercial ?? 0) * 1_100_000;
  club.cash += sponsor + gate + performance + commercial - wages - maintenance;
  addLedger(next, club.id, 'income', 'スポンサー収入', sponsor);
  if (gate) addLedger(next, club.id, 'income', 'ホームゲーム入場料', gate);
  if (performance) addLedger(next, club.id, 'income', won ? '勝利ボーナス' : '引分ボーナス', performance);
  if (commercial) addLedger(next, club.id, 'income', '商業部門収入', commercial);
  addLedger(next, club.id, 'expense', '選手給与', -wages);
  if (maintenance) addLedger(next, club.id, 'expense', '施設・部門維持費', -maintenance);
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


export const PROJECTS = {
  medical: { label: '医療体制', baseCost: 120_000_000, growth: 1.55, weeklyMaintenance: 450_000 },
  analytics: { label: 'データ分析部門', baseCost: 100_000_000, growth: 1.5, weeklyMaintenance: 380_000 },
  commercial: { label: '商業部門', baseCost: 150_000_000, growth: 1.6, weeklyMaintenance: 520_000 },
  community: { label: '地域活動', baseCost: 80_000_000, growth: 1.45, weeklyMaintenance: 260_000 },
  expansion: { label: 'スタジアム拡張', baseCost: 300_000_000, growth: 1.72, weeklyMaintenance: 700_000 }
};

export function clubProjectCost(club, projectId) {
  const project = PROJECTS[projectId];
  if (!project) return null;
  const level = club.projects?.[projectId] ?? 0;
  return Math.round(project.baseCost * (project.growth ** level));
}

export function allocateTransferBudget(state, amount) {
  const next = deepClone(state);
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const value = Math.round(Number(amount));
  if (!club || !Number.isFinite(value) || value <= 0) return { ok: false, state, message: '配分額が不正です。' };
  const reserve = club.reserveCash ?? Math.round(club.cash * 0.25);
  if (club.cash - value < reserve) return { ok: false, state, message: '理事会予備資金を下回るため配分できません。' };
  club.cash -= value;
  club.transferBudget += value;
  addLedger(next, club.id, 'expense', '移籍予算へ配分', -value);
  return { ok: true, state: next, message: '現金から移籍予算へ配分しました。' };
}

export function investClubProject(state, projectId) {
  const next = deepClone(state);
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const project = PROJECTS[projectId];
  if (!club || !project) return { ok: false, state, message: '投資先が見つかりません。' };
  club.projects ??= { medical: 0, analytics: 0, commercial: 0, community: 0, expansion: 0 };
  const cost = clubProjectCost(club, projectId);
  if (club.cash - cost < (club.reserveCash ?? 0)) return { ok: false, state, message: '理事会予備資金を確保すると投資資金が不足します。' };
  club.cash -= cost;
  club.projects[projectId] += 1;
  if (projectId === 'expansion') club.capacity = Math.round(club.capacity * 1.08 + 1_500);
  if (projectId === 'community') club.fanMood = clamp(club.fanMood + 4, 20, 100);
  addLedger(next, club.id, 'expense', `継続投資: ${project.label}`, -cost);
  return { ok: true, state: next, message: `${project.label}へ投資しました。` };
}

export function revalueSeasonBudgets(state, position = 10) {
  const next = deepClone(state);
  for (const club of next.clubs) {
    const divisionFactor = club.division === 1 ? 1 : club.division === 2 ? 0.68 : 0.42;
    const performanceFactor = club.id === next.userClubId ? clamp(1.18 - position * 0.018, 0.78, 1.18) : 1;
    club.reserveCash = Math.round(Math.max(80_000_000, club.cash * (club.division === 1 ? 0.3 : 0.24)));
    const allocatable = Math.max(0, club.cash - club.reserveCash);
    club.transferBudget = Math.round(Math.max(club.transferBudget * 0.35, allocatable * 0.3 * divisionFactor * performanceFactor));
    club.wageBudget = Math.round((22_000_000 + club.reputation * 230_000) * divisionFactor * performanceFactor);
  }
  return next;
}
