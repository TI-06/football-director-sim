import { clamp, deepClone } from '../core/utils.js';

const CLAUSE_KEYS = ['installments', 'appearanceBonus', 'promotionBonus', 'titleBonus', 'sellOnPercent', 'buyback', 'loanFee', 'wageShare', 'purchaseOption'];

function activeClauses(clauses = {}) {
  return CLAUSE_KEYS.filter((key) => Number(clauses[key]) > 0 || clauses[key] === true);
}

export function createClubOffer(state, { playerId, immediateFee = 0, clauses = {}, offerType = 'permanent' } = {}) {
  if (activeClauses(clauses).length > 3) return { ok: false, state, message: '追加条項は最大3件です。' };
  const player = state.transferMarket?.find((item) => item.id === playerId);
  if (!player || !['permanent', 'loan'].includes(offerType) || Number(immediateFee) < 0) return { ok: false, state, message: 'クラブ間オファーが不正です。' };
  const next = deepClone(state);
  next.transferNegotiations ??= [];
  const negotiation = {
    id: `negotiation-${next.season}-${next.week}-${playerId}`,
    playerId,
    stage: 'club',
    status: 'open',
    offerType,
    immediateFee: Math.round(Number(immediateFee) || 0),
    clauses: deepClone(clauses),
    createdWeek: next.week,
    deadlineWeek: next.week + 2,
    attemptsRemaining: 2
  };
  next.transferNegotiations = next.transferNegotiations.filter((item) => item.playerId !== playerId || item.status !== 'open');
  next.transferNegotiations.unshift(negotiation);
  return { ok: true, state: next, negotiation, message: `${player.name}へクラブ間オファーを提示しました。` };
}

export function respondToClubOffer(state, negotiationId, rng) {
  const next = deepClone(state);
  const negotiation = next.transferNegotiations?.find((item) => item.id === negotiationId && item.stage === 'club' && item.status === 'open');
  const player = negotiation ? next.transferMarket.find((item) => item.id === negotiation.playerId) : null;
  if (!negotiation || !player) return { ok: false, state, message: '交渉が見つかりません。' };
  const clauseValue = activeClauses(negotiation.clauses).reduce((sum, key) => sum + (key === 'sellOnPercent' ? Number(negotiation.clauses[key]) * player.askingPrice * 0.006 : Number(negotiation.clauses[key]) || 0), 0);
  const threshold = negotiation.offerType === 'loan' ? Math.min(5_000_000, player.askingPrice * 0.08) : player.askingPrice * 0.88;
  const accepted = negotiation.immediateFee + clauseValue >= threshold || rng.chance(0.08);
  if (!accepted) {
    negotiation.attemptsRemaining -= 1;
    negotiation.status = negotiation.attemptsRemaining > 0 ? 'countered' : 'rejected';
    negotiation.counterFee = Math.round(player.askingPrice * 0.96);
    return { ok: false, state: next, negotiation, message: 'クラブ間オファーは受諾されませんでした。' };
  }
  negotiation.stage = 'agent';
  negotiation.clubAcceptedWeek = next.week;
  negotiation.agentDeadlineWeek = next.week + (player.personality === 'ambitious' ? 1 : 2);
  return { ok: true, state: next, negotiation, message: 'クラブ間合意に達し、代理人交渉へ進みました。' };
}

export function submitAgentOffer(state, negotiationId, { wage = 0, years = 3, signingBonus = 0, role = 'rotation', releaseClause = 0 } = {}) {
  const next = deepClone(state);
  const negotiation = next.transferNegotiations?.find((item) => item.id === negotiationId && item.stage === 'agent' && item.status === 'open');
  const playerIndex = negotiation ? next.transferMarket.findIndex((item) => item.id === negotiation.playerId) : -1;
  if (!negotiation || playerIndex < 0) return { ok: false, state, message: '代理人交渉が見つかりません。' };
  const player = next.transferMarket[playerIndex];
  const requestedWage = Number(player.askingWage ?? player.wage ?? 0);
  if (Number(wage) < requestedWage * 0.92 || Number(years) < 1 || Number(years) > 5) return { ok: false, state, message: '代理人の要求を満たしていません。' };
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const totalDue = negotiation.immediateFee + Math.max(0, Number(signingBonus) || 0);
  if (!club || club.cash < totalDue || club.transferBudget < negotiation.immediateFee) return { ok: false, state, message: '移籍・契約資金が不足しています。' };
  if (next.players.some((item) => item.id === player.id)) return { ok: false, state, message: '選手はすでに登録されています。' };
  club.cash -= totalDue;
  club.transferBudget -= negotiation.immediateFee;
  const signed = { ...player, clubId: next.userClubId, wage: Math.round(Number(wage)), contractYears: clamp(Math.round(Number(years)), 1, 5), squadRole: role, releaseClause: Math.max(0, Number(releaseClause) || 0), scouting: 100 };
  delete signed.askingPrice;
  delete signed.askingWage;
  next.players.push(signed);
  next.transferMarket.splice(playerIndex, 1);
  negotiation.status = 'completed';
  negotiation.stage = 'completed';
  negotiation.agentOffer = { wage: signed.wage, years: signed.contractYears, signingBonus, role, releaseClause };
  next.loans ??= [];
  if (negotiation.offerType === 'loan') {
    const wageShare = clamp(Number(negotiation.clauses.wageShare ?? 50), 0, 100);
    next.loans.push({ id: `loan-${player.id}-${next.season}`, playerId: player.id, parentClubId: player.clubId ?? 'market', loanClubId: next.userClubId, wageShare, appearances: 0, starts: 0, purchaseOption: Number(negotiation.clauses.purchaseOption ?? 0), endSeason: next.season });
  }
  next.finances.ledger.unshift({ id: `negotiated-buy-${next.week}-${player.id}`, week: next.week, clubId: club.id, type: 'expense', label: `交渉獲得: ${player.name}`, amount: -totalDue, timestamp: Date.now() });
  return { ok: true, state: next, negotiation, message: `${player.name}との契約に合意しました。` };
}

export function expireNegotiations(state) {
  const next = deepClone(state);
  for (const negotiation of next.transferNegotiations ?? []) {
    if (negotiation.status !== 'open') continue;
    const deadline = negotiation.stage === 'agent' ? negotiation.agentDeadlineWeek : negotiation.deadlineWeek;
    if (next.week > deadline) negotiation.status = 'expired';
  }
  return next;
}
