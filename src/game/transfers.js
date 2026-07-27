import { deepClone, clamp } from '../core/utils.js';
import { clubWeeklyWages } from './economy.js';

function archiveDepartedPlayer(state, player, departureType, fee = 0) {
  state.history ??= {};
  state.history.departedPlayers ??= [];
  state.history.departedPlayers.unshift({
    ...structuredClone(player),
    departureType,
    departureSeason: state.season ?? 1,
    departureWeek: state.week ?? 1,
    departureFee: fee
  });
  state.history.departedPlayers = state.history.departedPlayers.slice(0, 250);
}


export function buyPlayer(state, playerId) {
  const next = deepClone(state);
  const marketIndex = next.transferMarket.findIndex((player) => player.id === playerId);
  if (marketIndex < 0) return { ok: false, state, message: '移籍市場の選手が見つかりません。' };
  const player = next.transferMarket[marketIndex];
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const squadSize = next.players.filter((item) => item.clubId === club.id).length;
  if (squadSize >= 28) return { ok: false, state, message: 'トップチームの登録上限は28人です。' };
  if (club.transferBudget < player.askingPrice || club.cash < player.askingPrice) return { ok: false, state, message: '移籍金が不足しています。' };
  const currentWages = clubWeeklyWages(next, club.id);
  if (currentWages + player.askingWage > club.wageBudget) return { ok: false, state, message: '給与予算を超過します。' };
  const transferFee = player.askingPrice;
  club.cash -= transferFee;
  club.transferBudget -= transferFee;
  player.clubId = club.id;
  player.wage = player.askingWage;
  player.contractYears = 3;
  player.scouting = 100;
  delete player.askingPrice;
  delete player.askingWage;
  next.players.push(player);
  next.transferMarket.splice(marketIndex, 1);
  next.finances.ledger.unshift({ id: `transfer-buy-${state.week}-${player.id}`, week: state.week, clubId: club.id, type: 'expense', label: `獲得: ${player.name}`, amount: -transferFee, timestamp: Date.now() });
  return { ok: true, state: next, message: `${player.name}を獲得しました。` };
}

export function listPlayerForSale(state, playerId) {
  const next = deepClone(state);
  const player = next.players.find((item) => item.id === playerId && item.clubId === next.userClubId);
  if (!player) return { ok: false, state, message: '選手が見つかりません。' };
  player.listed = !player.listed;
  return { ok: true, state: next, message: player.listed ? `${player.name}を移籍リストへ登録しました。` : `${player.name}を移籍リストから外しました。` };
}

export function sellPlayer(state, playerId, rng) {
  const next = deepClone(state);
  const index = next.players.findIndex((item) => item.id === playerId && item.clubId === next.userClubId);
  if (index < 0) return { ok: false, state, message: '選手が見つかりません。' };
  const player = next.players[index];
  if (!player.listed) return { ok: false, state, message: '先に移籍リストへ登録してください。' };
  const squadSize = next.players.filter((item) => item.clubId === next.userClubId).length;
  if (squadSize <= 18) return { ok: false, state, message: '登録人数が18人を下回るため売却できません。' };
  const fee = Math.round(player.value * rng.float(0.72, 1.08));
  const club = next.clubs.find((item) => item.id === next.userClubId);
  club.cash += fee;
  club.transferBudget += Math.round(fee * (club.saleRetention ?? 0.85));
  archiveDepartedPlayer(next, player, 'transfer', fee);
  next.players.splice(index, 1);
  next.finances.ledger.unshift({ id: `transfer-sale-${state.week}-${player.id}`, week: state.week, clubId: club.id, type: 'income', label: `売却: ${player.name}`, amount: fee, timestamp: Date.now() });
  return { ok: true, state: next, message: `${player.name}を売却しました。` };
}

export function releasePlayer(state, playerId) {
  const next = deepClone(state);
  const index = next.players.findIndex((item) => item.id === playerId && item.clubId === next.userClubId);
  if (index < 0) return { ok: false, state, message: '選手が見つかりません。' };
  const squadSize = next.players.filter((item) => item.clubId === next.userClubId).length;
  if (squadSize <= 18) return { ok: false, state, message: '登録人数が18人を下回るため契約解除できません。' };
  const player = next.players[index];
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const compensation = player.wage * 12;
  if (club.cash < compensation) return { ok: false, state, message: '契約解除の補償金が不足しています。' };
  club.cash -= compensation;
  archiveDepartedPlayer(next, player, 'release', 0);
  next.players.splice(index, 1);
  next.finances.ledger.unshift({ id: `release-${state.week}-${player.id}`, week: state.week, clubId: club.id, type: 'expense', label: `契約解除: ${player.name}`, amount: -compensation, timestamp: Date.now() });
  return { ok: true, state: next, message: `${player.name}との契約を解除しました。補償金は12週分の給与です。` };
}

export function scoutMarketPlayer(state, playerId) {
  const next = deepClone(state);
  const player = next.transferMarket.find((item) => item.id === playerId);
  if (!player) return { ok: false, state, message: '選手が見つかりません。' };
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const cost = Math.max(500_000, 2_000_000 - club.facilities.scouting * 250_000);
  if (club.cash < cost) return { ok: false, state, message: 'スカウト費用が不足しています。' };
  club.cash -= cost;
  player.scouting = 100;
  player.overallEstimate = player.overall;
  player.potentialEstimate = player.potential;
  next.finances.ledger.unshift({ id: `scout-${state.week}-${player.id}`, week: state.week, clubId: club.id, type: 'expense', label: `スカウト: ${player.name}`, amount: -cost, timestamp: Date.now() });
  return { ok: true, state: next, message: `${player.name}の調査が完了しました。` };
}

export function marketEstimate(player, field) {
  if (player.scouting >= 100) return player[field];
  const uncertainty = clamp(Math.round((100 - player.scouting) / 8), 2, 9);
  return `${Math.max(1, player[field] - uncertainty)}–${Math.min(99, player[field] + uncertainty)}`;
}


export function renewPlayerContract(state, playerId, years = 3) {
  const next = deepClone(state);
  const player = next.players.find((item) => item.id === playerId && item.clubId === next.userClubId);
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const duration = clamp(Math.round(Number(years) || 3), 1, 5);
  if (!player || !club) return { ok: false, state, message: '選手が見つかりません。' };
  const signingBonus = Math.round(player.wage * (8 + duration * 2));
  const newWage = Math.round(player.wage * (1.04 + duration * 0.025));
  const currentWages = clubWeeklyWages(next, club.id) - player.wage;
  if (club.cash - signingBonus < (club.reserveCash ?? 0)) return { ok: false, state, message: '契約金を支払うと理事会予備資金を下回ります。' };
  if (currentWages + newWage > club.wageBudget) return { ok: false, state, message: '更新後の給与が給与予算を超えます。' };
  club.cash -= signingBonus;
  player.wage = newWage;
  player.contractYears = duration;
  player.happiness = clamp((player.happiness ?? 60) + 18, 5, 100);
  player.concerns = (player.concerns ?? []).filter((concern) => !/契約/.test(concern));
  player.transferRequest = player.happiness < 35 && player.transferRequest;
  next.finances.ledger.unshift({ id: `renew-${state.week}-${player.id}`, week: state.week, clubId: club.id, type: 'expense', label: `契約更新: ${player.name}`, amount: -signingBonus, timestamp: Date.now() });
  return { ok: true, state: next, message: `${player.name}と${duration}年契約を結びました。` };
}
