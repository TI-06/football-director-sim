import { createRng } from '../core/random.js';
import { clamp, deepClone } from '../core/utils.js';
import { createBoardEvaluation } from './board-confidence.js';
import { createDefaultMatchPlan } from './match-plan.js';
import { createScoutingNetwork } from './scouting.js';
import { createDefaultSetPieces } from './set-pieces.js';
import { selectBestLineup } from './squad.js';
import { createInitialStaff, createStaffMarket } from './staff.js';

export function createManagerProfile({ name = '監督', age = 35, birthplace = '日本', preferredTactic = '4-2-3-1' } = {}) {
  return {
    name: String(name || '監督').trim() || '監督', age: clamp(Number(age) || 35, 25, 75), birthplace, preferredTactic,
    reputation: 42, level: 1, experience: 0, matches: 0, wins: 0, draws: 0, losses: 0,
    promotions: 0, leagueTitles: 0, cupTitles: 0, youthDevelopment: 0, financeRating: 50, playerManagement: 55,
    clubHistory: []
  };
}

export function recordManagerMatch(profile, result, { youthStarter = false, financialResult = 0, pressureMatch = false } = {}) {
  const next = deepClone(profile);
  next.matches += 1;
  if (result === 'win') next.wins += 1;
  else if (result === 'draw') next.draws += 1;
  else next.losses += 1;
  if (youthStarter) next.youthDevelopment += 1;
  next.financeRating = clamp(next.financeRating + Number(financialResult || 0), 0, 100);
  const delta = result === 'win' ? 1.8 : result === 'draw' ? 0.3 : -0.8;
  next.reputation = clamp(next.reputation + delta + (pressureMatch && result === 'win' ? 1.2 : 0), 1, 100);
  next.experience += result === 'win' ? 30 : result === 'draw' ? 18 : 12;
  next.level = Math.max(1, Math.floor(next.experience / 500) + 1);
  return next;
}

export function generateManagerOffers(state, rng) {
  const reputation = state.managerProfile?.reputation ?? 0;
  if (reputation < 55) return [];
  const current = state.clubs.find((club) => club.id === state.userClubId);
  const candidates = state.clubs.filter((club) => club.id !== state.userClubId && club.reputation <= reputation + 12 && club.reputation >= Math.max(35, reputation - 22));
  const count = reputation >= 80 ? 3 : reputation >= 68 ? 2 : 1;
  return rng.shuffle(candidates).slice(0, count).map((club, index) => ({
    id: `manager-offer-${state.season}-${state.week}-${club.id}-${index}`,
    clubId: club.id,
    clubName: club.name,
    currentDivision: current?.division,
    division: club.division,
    wage: Math.round((400_000 + club.reputation ** 2 * 700) / 10_000) * 10_000,
    expiresWeek: state.week + 3,
    status: 'open'
  }));
}

export function acceptManagerOffer(state, offerId) {
  const next = deepClone(state);
  const offer = next.managerOffers?.find((item) => item.id === offerId && item.status === 'open' && item.expiresWeek >= next.week);
  if (!offer) return { ok: false, state, message: '有効な監督オファーが見つかりません。' };
  const previousClubId = next.userClubId;
  const target = next.clubs.find((club) => club.id === offer.clubId);
  if (!target) return { ok: false, state, message: '移籍先クラブが見つかりません。' };
  offer.status = 'accepted';
  next.userClubId = target.id;
  next.managerProfile.clubHistory ??= [];
  next.managerProfile.clubHistory.unshift({ clubId: previousClubId, leftSeason: next.season, leftWeek: next.week });
  const clubRng = createRng(`${next.seed}:manager-switch:${next.season}:${next.week}:${target.id}`);
  next.tactics = { ...next.tactics, ...target.tactics };
  next.lineup = selectBestLineup(next.players.filter((player) => player.clubId === target.id), next.tactics.formation);
  next.matchPlan = createDefaultMatchPlan();
  next.staff = createInitialStaff(clubRng.fork('staff'));
  next.staffMarket = createStaffMarket(clubRng.fork('staff-market'), 27);
  next.playerPromises = [];
  next.meetingHistory = [];
  next.boardEvaluation = createBoardEvaluation(target);
  next.scoutingNetwork = createScoutingNetwork(clubRng.fork('scouting'));
  next.transferNegotiations = [];
  next.setPieces = createDefaultSetPieces();
  next.nextMatchEnvironment = null;
  next.activeMatch = null;
  next.managerOffers = [];
  next.secretaryReport = null;
  return { ok: true, state: next, message: `${target.name}の監督に就任しました。` };
}
