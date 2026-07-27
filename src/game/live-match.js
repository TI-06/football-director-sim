import { clamp, deepClone, round } from '../core/utils.js';
import { simulateMatch } from './match-engine.js';
import {
  createDefaultMatchPlan,
  normalizeMatchPlan,
  selectAutomaticSubstitutions,
  tacticsForScoreState
} from './match-plan.js';

const PHASES = [
  { start: 0, end: 45, label: '前半終了' },
  { start: 45, end: 60, label: '60分' },
  { start: 60, end: 75, label: '75分' },
  { start: 75, end: 90, label: '試合終了' }
];

const TACTIC_KEYS = ['formation', 'mentality', 'pressing', 'tempo', 'passing', 'defensiveLine', 'focus', 'width'];

function playerMap(side) {
  return new Map(side.players.map((player) => [player.id, player]));
}

function makeSide(team) {
  return {
    club: deepClone(team.club),
    players: deepClone(team.players),
    lineup: deepClone(team.lineup.starters),
    bench: deepClone(team.lineup.bench ?? []),
    tactics: deepClone(team.tactics),
    substitutionsUsed: 0
  };
}

function createParticipants(sides) {
  const participants = {};
  for (const sideName of ['home', 'away']) {
    for (const entry of sides[sideName].lineup) {
      participants[entry.playerId] = {
        playerId: entry.playerId,
        side: sideName,
        slotPosition: entry.slotPosition,
        started: true,
        enteredAt: 0,
        exitedAt: null
      };
    }
  }
  return participants;
}

function createFitness(sides) {
  const fitness = {};
  for (const side of Object.values(sides)) {
    for (const player of side.players) fitness[player.id] = player.fitness;
  }
  return fitness;
}

function createRatings(participants) {
  return Object.fromEntries(Object.keys(participants).map((playerId) => [playerId, 6.5]));
}

export function createLiveMatchSession({ seed, home, away, userSide = 'home', matchPlan = createDefaultMatchPlan() }) {
  const sides = { home: makeSide(home), away: makeSide(away) };
  return {
    id: `live-${String(seed).replace(/[^a-zA-Z0-9-]/g, '-')}`,
    seed: String(seed),
    userSide,
    matchPlan: normalizeMatchPlan(matchPlan),
    phaseIndex: 0,
    minute: 0,
    completed: false,
    committed: false,
    score: { home: 0, away: 0 },
    totals: {
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homeXg: 0,
      awayXg: 0,
      homeCards: 0,
      awayCards: 0,
      corners: { home: 0, away: 0 },
      possessionWeighted: { home: 0, away: 0 },
      duration: 0,
      fatigue: { home: 0, away: 0 }
    },
    sides,
    participants: createParticipants(sides),
    liveFitness: createFitness(sides),
    liveRatings: createRatings(createParticipants(sides)),
    bookedIds: { home: [], away: [] },
    injuredIds: { home: [], away: [] },
    injuries: [],
    substitutions: [],
    events: [{ minute: 0, type: 'kickoff', side: 'neutral', text: `キックオフ。${home.club.name} vs ${away.club.name}` }],
    phaseHistory: []
  };
}

function teamForPhase(side) {
  return {
    club: side.club,
    players: side.players,
    lineup: { starters: side.lineup, bench: side.bench },
    tactics: side.tactics
  };
}

function relevantPhaseEvents(report, duration, start) {
  return report.events
    .filter((event) => !['kickoff', 'half', 'full', 'substitution'].includes(event.type) && event.minute <= duration)
    .map((event) => ({ ...event, minute: clamp(start + Math.max(1, event.minute), start + 1, start + duration) }));
}

function applyEventEffects(session, events) {
  for (const event of events) {
    if (event.type === 'goal' && event.playerId) session.liveRatings[event.playerId] = round((session.liveRatings[event.playerId] ?? 6.5) + 0.85, 1);
    if (event.type === 'goal' && event.assistId) session.liveRatings[event.assistId] = round((session.liveRatings[event.assistId] ?? 6.5) + 0.4, 1);
    if (event.type === 'card' && event.playerId) {
      session.liveRatings[event.playerId] = round((session.liveRatings[event.playerId] ?? 6.5) - 0.2, 1);
      if (!session.bookedIds[event.side].includes(event.playerId)) session.bookedIds[event.side].push(event.playerId);
    }
    if (event.type === 'injury' && event.playerId) {
      if (!session.injuredIds[event.side].includes(event.playerId)) session.injuredIds[event.side].push(event.playerId);
      session.injuries.push({
        playerId: event.playerId,
        playerName: event.playerName,
        clubId: session.sides[event.side].club.id,
        minute: event.minute,
        weeks: event.injuryWeeks ?? 1,
        name: event.injuryName ?? '打撲'
      });
    }
  }
}

function phaseStats(report, events, duration) {
  const fraction = duration / 90;
  const count = (side, type) => events.filter((event) => event.side === side && event.type === type).length;
  const homeGoals = count('home', 'goal');
  const awayGoals = count('away', 'goal');
  const homeOnTarget = homeGoals + count('home', 'save');
  const awayOnTarget = awayGoals + count('away', 'save');
  const homeShots = Math.max(homeOnTarget + count('home', 'shot'), Math.round(report.homeShots * fraction));
  const awayShots = Math.max(awayOnTarget + count('away', 'shot'), Math.round(report.awayShots * fraction));
  return {
    homeGoals,
    awayGoals,
    homeShots,
    awayShots,
    homeShotsOnTarget: Math.min(homeShots, Math.max(homeGoals, homeOnTarget)),
    awayShotsOnTarget: Math.min(awayShots, Math.max(awayGoals, awayOnTarget)),
    homeXg: round(report.homeXg * fraction, 2),
    awayXg: round(report.awayXg * fraction, 2),
    homeCards: count('home', 'card'),
    awayCards: count('away', 'card'),
    corners: {
      home: Math.round(report.corners.home * fraction),
      away: Math.round(report.corners.away * fraction)
    },
    possession: { home: report.homePossession, away: report.awayPossession },
    fatigue: {
      home: report.fatigueImpact.home * fraction,
      away: report.fatigueImpact.away * fraction
    }
  };
}

function updateFitness(session, phase) {
  for (const sideName of ['home', 'away']) {
    const amount = phase.fatigue[sideName];
    for (const entry of session.sides[sideName].lineup) {
      session.liveFitness[entry.playerId] = round(clamp((session.liveFitness[entry.playerId] ?? 75) - amount, 10, 100), 1);
    }
  }
}

function addPhaseTotals(session, phase, duration) {
  session.score.home += phase.homeGoals;
  session.score.away += phase.awayGoals;
  for (const key of ['homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget', 'homeCards', 'awayCards']) session.totals[key] += phase[key];
  session.totals.homeXg = round(session.totals.homeXg + phase.homeXg, 2);
  session.totals.awayXg = round(session.totals.awayXg + phase.awayXg, 2);
  session.totals.corners.home += phase.corners.home;
  session.totals.corners.away += phase.corners.away;
  session.totals.possessionWeighted.home += phase.possession.home * duration;
  session.totals.possessionWeighted.away += phase.possession.away * duration;
  session.totals.duration += duration;
  session.totals.fatigue.home += phase.fatigue.home;
  session.totals.fatigue.away += phase.fatigue.away;
}

function applyTacticInstruction(session, tactics) {
  if (!tactics) return;
  const side = session.sides[session.userSide];
  for (const key of TACTIC_KEYS) {
    if (tactics[key] !== undefined) side.tactics[key] = tactics[key];
  }
}

function scoreState(session, sideName) {
  const own = session.score[sideName];
  const other = session.score[sideName === 'home' ? 'away' : 'home'];
  return own > other ? 'leading' : own < other ? 'trailing' : 'drawing';
}

function applyAutomaticForSide(session, sideName, plan) {
  const side = session.sides[sideName];
  const map = playerMap(side);
  const starters = side.lineup.map((entry) => ({ ...map.get(entry.playerId), fitness: session.liveFitness[entry.playerId] }));
  const bench = side.bench.map((playerId) => ({ ...map.get(playerId), fitness: session.liveFitness[playerId] })).filter(Boolean);
  const changes = selectAutomaticSubstitutions({
    starters,
    bench,
    minute: session.minute,
    plan,
    injuredIds: session.injuredIds[sideName],
    bookedIds: session.bookedIds[sideName],
    liveRatings: session.liveRatings,
    substitutionsUsed: side.substitutionsUsed
  });
  let next = session;
  for (const change of changes) {
    const result = makeLiveSubstitution(next, { side: sideName, ...change });
    if (!result.ok) break;
    next = result.session;
  }
  return next;
}

export function advanceLiveMatchSession(session, instruction = {}) {
  if (!session || session.completed) return { ok: false, session, message: '試合は終了しています。' };
  let next = deepClone(session);
  applyTacticInstruction(next, instruction.tactics);
  const phaseDef = PHASES[next.phaseIndex];
  const duration = phaseDef.end - phaseDef.start;
  const homeTeam = teamForPhase(next.sides.home);
  const awayTeam = teamForPhase(next.sides.away);
  const report = simulateMatch({ seed: `${next.seed}:phase:${next.phaseIndex}`, home: homeTeam, away: awayTeam });
  const events = relevantPhaseEvents(report, duration, phaseDef.start);
  const stats = phaseStats(report, events, duration);
  addPhaseTotals(next, stats, duration);
  applyEventEffects(next, events);
  updateFitness(next, stats);
  next.events.push(...events);
  next.minute = phaseDef.end;
  next.phaseHistory.push({
    index: next.phaseIndex,
    start: phaseDef.start,
    end: phaseDef.end,
    label: phaseDef.label,
    homeTactics: deepClone(next.sides.home.tactics),
    awayTactics: deepClone(next.sides.away.tactics),
    scoreAfter: deepClone(next.score),
    stats
  });
  next.events.push({ minute: phaseDef.end, type: 'phase', side: 'neutral', text: phaseDef.label });
  next.phaseIndex += 1;
  next.completed = next.phaseIndex >= PHASES.length;

  if (!next.completed) {
    if (instruction.autoPlan !== false) {
      const userPlan = next.matchPlan;
      next.sides[next.userSide].tactics = tacticsForScoreState(userPlan, scoreState(next, next.userSide), next.sides[next.userSide].tactics);
      next = applyAutomaticForSide(next, next.userSide, userPlan);
      const aiSide = next.userSide === 'home' ? 'away' : 'home';
      next = applyAutomaticForSide(next, aiSide, { ...createDefaultMatchPlan(), fitnessThreshold: 70, preserveKeyPlayers: false });
    }
  } else {
    next.events.push({ minute: 90, type: 'full', side: 'neutral', text: `試合終了。${next.sides.home.club.name} ${next.score.home}-${next.score.away} ${next.sides.away.club.name}` });
  }
  next.events.sort((left, right) => left.minute - right.minute || (left.type === 'kickoff' ? -1 : right.type === 'full' ? -1 : 0));
  return { ok: true, session: next, message: next.completed ? '試合終了' : `${phaseDef.label}で停止しました。` };
}

function replacementSlot(side, playerOutId) {
  return side.lineup.find((entry) => entry.playerId === playerOutId);
}

export function makeLiveSubstitution(session, { side, playerOutId, playerInId, reason = 'manual' } = {}) {
  if (!session || session.completed) return { ok: false, session, message: '試合は終了しています。' };
  if (!['home', 'away'].includes(side)) return { ok: false, session, message: '交代するチームが不正です。' };
  const next = deepClone(session);
  const team = next.sides[side];
  if (team.substitutionsUsed >= 5) return { ok: false, session, message: '交代枠を使い切っています。' };
  const slot = replacementSlot(team, playerOutId);
  if (!slot) return { ok: false, session, message: '交代する先発選手が見つかりません。' };
  if (!team.bench.includes(playerInId)) return { ok: false, session, message: '投入する選手がベンチにいません。' };
  const map = playerMap(team);
  const outgoing = map.get(playerOutId);
  const incoming = map.get(playerInId);
  if (!outgoing || !incoming) return { ok: false, session, message: '選手データが見つかりません。' };

  slot.playerId = playerInId;
  team.bench = team.bench.filter((id) => id !== playerInId);
  team.substitutionsUsed += 1;
  next.participants[playerOutId].exitedAt = next.minute;
  next.participants[playerInId] = {
    playerId: playerInId,
    side,
    slotPosition: slot.slotPosition,
    started: false,
    enteredAt: next.minute,
    exitedAt: null
  };
  next.liveRatings[playerInId] ??= 6.5;
  const event = {
    minute: next.minute,
    type: 'substitution',
    side,
    clubId: team.club.id,
    playerOutId,
    playerOutName: outgoing.name,
    playerInId,
    playerInName: incoming.name,
    reason,
    text: `${team.club.name}が選手交代。${outgoing.name}に代えて${incoming.name}を投入する。`
  };
  next.substitutions.push(event);
  next.events.push(event);
  return { ok: true, session: next, message: '選手交代を反映しました。' };
}

function participantRatings(session) {
  const homeWon = session.score.home > session.score.away;
  const awayWon = session.score.away > session.score.home;
  const playerLookup = new Map([...session.sides.home.players, ...session.sides.away.players].map((player) => [player.id, player]));
  return Object.values(session.participants).map((participant) => {
    const player = playerLookup.get(participant.playerId);
    const exit = participant.exitedAt ?? 90;
    const minutes = clamp(exit - participant.enteredAt, 0, 90);
    const goals = session.events.filter((event) => event.type === 'goal' && event.playerId === participant.playerId).length;
    const assists = session.events.filter((event) => event.type === 'goal' && event.assistId === participant.playerId).length;
    const cards = session.events.filter((event) => event.type === 'card' && event.playerId === participant.playerId).length;
    const won = participant.side === 'home' ? homeWon : awayWon;
    const lost = participant.side === 'home' ? awayWon : homeWon;
    const base = session.liveRatings[participant.playerId] ?? 6.5;
    const rating = clamp(base + (won ? 0.25 : lost ? -0.2 : 0) + goals * 0.25 + assists * 0.15, 4.2, 10);
    return {
      playerId: participant.playerId,
      playerName: player?.name ?? '不明',
      clubId: session.sides[participant.side].club.id,
      side: participant.side,
      rating: round(rating, 1),
      goals,
      assists,
      cards,
      minutes,
      started: participant.started
    };
  }).sort((left, right) => right.rating - left.rating || right.minutes - left.minutes);
}

export function finalizeLiveMatch(session) {
  if (!session?.completed) throw new Error('試合が終了していません。');
  const duration = session.totals.duration || 90;
  const homePossession = clamp(Math.round(session.totals.possessionWeighted.home / duration), 30, 70);
  const awayPossession = 100 - homePossession;
  const ratings = participantRatings(session);
  return {
    id: `report-${session.id}`,
    seed: session.seed,
    homeClubId: session.sides.home.club.id,
    awayClubId: session.sides.away.club.id,
    homeGoals: session.score.home,
    awayGoals: session.score.away,
    homePossession,
    awayPossession,
    homeShots: session.totals.homeShots,
    awayShots: session.totals.awayShots,
    homeShotsOnTarget: session.totals.homeShotsOnTarget,
    awayShotsOnTarget: session.totals.awayShotsOnTarget,
    homeXg: round(session.totals.homeXg, 2),
    awayXg: round(session.totals.awayXg, 2),
    homeCards: session.totals.homeCards,
    awayCards: session.totals.awayCards,
    corners: deepClone(session.totals.corners),
    fatigueImpact: { home: round(session.totals.fatigue.home, 1), away: round(session.totals.fatigue.away, 1) },
    injuries: deepClone(session.injuries),
    events: deepClone(session.events),
    substitutions: deepClone(session.substitutions),
    playerRatings: ratings,
    manOfTheMatch: ratings[0] ?? null,
    metrics: {
      home: { condition: round(Object.values(session.liveFitness).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.keys(session.liveFitness).length), 1) },
      away: {}
    },
    phaseHistory: deepClone(session.phaseHistory)
  };
}

export function simulateAutomaticLiveMatch(input) {
  let session = createLiveMatchSession(input);
  while (!session.completed) {
    const state = scoreState(session, session.userSide);
    const tactics = tacticsForScoreState(session.matchPlan, state, session.sides[session.userSide].tactics);
    session = advanceLiveMatchSession(session, { tactics, autoPlan: true }).session;
  }
  return finalizeLiveMatch(session);
}
