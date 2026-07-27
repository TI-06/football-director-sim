import { clamp, deepClone } from '../core/utils.js';
import { generateTransferMarket } from '../data/catalog.js';

const SEASON_STAT_KEYS = ['appearances', 'starts', 'minutes', 'goals', 'assists', 'cleanSheets', 'manOfTheMatch'];

function careerStats(player) {
  return {
    appearances: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    manOfTheMatch: 0,
    ...(player.careerStats ?? {})
  };
}

function awardEntry(player, value) {
  return player ? { playerId: player.id, playerName: player.name, clubId: player.clubId, value } : null;
}

function compareNumber(field) {
  return (a, b) => (b[field] ?? 0) - (a[field] ?? 0) || (b.seasonRating ?? 0) - (a.seasonRating ?? 0) || a.name.localeCompare(b.name, 'ja');
}

export function snapshotSeasonStats(state) {
  const next = deepClone(state);
  for (const player of next.players) {
    player.seasonHistory ??= [];
    player.seasonHistory.unshift({
      season: next.season,
      clubId: player.clubId,
      division: next.clubs.find((club) => club.id === player.clubId)?.division ?? null,
      appearances: player.appearances ?? 0,
      starts: player.starts ?? 0,
      minutes: player.minutes ?? 0,
      goals: player.goals ?? 0,
      assists: player.assists ?? 0,
      cleanSheets: player.cleanSheets ?? 0,
      manOfTheMatch: player.manOfTheMatch ?? 0,
      averageRating: player.seasonRating ?? 0
    });
    player.seasonHistory = player.seasonHistory.slice(0, 20);
  }
  return next;
}

export function calculateSeasonAwards(state) {
  const eligible = state.players.filter((player) => (player.appearances ?? 0) > 0);
  const topScorerPlayer = [...eligible].sort(compareNumber('goals'))[0] ?? null;
  const topAssistsPlayer = [...eligible].sort(compareNumber('assists'))[0] ?? null;
  const mvpPlayer = [...eligible].sort((a, b) => (b.seasonRating ?? 0) - (a.seasonRating ?? 0) || (b.appearances ?? 0) - (a.appearances ?? 0))[0] ?? null;
  const young = eligible.filter((player) => player.age <= 21).sort((a, b) => (b.seasonRating ?? 0) - (a.seasonRating ?? 0) || (b.goals ?? 0) - (a.goals ?? 0))[0] ?? null;
  const keeper = eligible.filter((player) => player.position === 'GK').sort((a, b) => (b.cleanSheets ?? 0) - (a.cleanSheets ?? 0) || (b.seasonRating ?? 0) - (a.seasonRating ?? 0))[0] ?? null;
  const positions = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
  const used = new Set();
  const bestEleven = positions.map((position) => {
    const candidates = eligible
      .filter((player) => !used.has(player.id) && (player.position === position || player.secondaryPositions?.includes(position)))
      .sort((a, b) => (b.seasonRating ?? 0) - (a.seasonRating ?? 0) || (b.appearances ?? 0) - (a.appearances ?? 0));
    const player = candidates[0] ?? eligible.filter((item) => !used.has(item.id)).sort((a, b) => (b.seasonRating ?? 0) - (a.seasonRating ?? 0))[0];
    if (player) used.add(player.id);
    return awardEntry(player, player?.seasonRating ?? 0);
  }).filter(Boolean);
  return {
    season: state.season,
    topScorer: awardEntry(topScorerPlayer, topScorerPlayer?.goals ?? 0),
    topAssists: awardEntry(topAssistsPlayer, topAssistsPlayer?.assists ?? 0),
    playerOfTheYear: awardEntry(mvpPlayer, mvpPlayer?.seasonRating ?? 0),
    bestYoungPlayer: awardEntry(young, young?.seasonRating ?? 0),
    bestGoalkeeper: awardEntry(keeper, keeper?.cleanSheets ?? 0),
    bestEleven
  };
}

export function updatePlayerHappiness(state, rng) {
  const next = deepClone(state);
  const elapsedLeagueRounds = Math.max(1, Math.min(38, next.week - 1));
  for (const player of next.players) {
    const concerns = [];
    let delta = 0;
    const expectedAppearances = Math.max(3, Math.round(elapsedLeagueRounds * (player.overall >= 72 ? 0.65 : 0.42)));
    if ((player.appearances ?? 0) < expectedAppearances * 0.45 && player.age >= 22) {
      concerns.push('出場機会が少ない');
      delta -= 6;
    }
    if ((player.morale ?? 60) < 40) {
      concerns.push('士気が低下している');
      delta -= 5;
    }
    if ((player.contractYears ?? 0) <= 1) {
      concerns.push('契約更新を望んでいる');
      delta -= 3;
    }
    if (player.listed) {
      concerns.push('移籍リスト登録に不満');
      delta -= 4;
    }
    if ((player.appearances ?? 0) >= expectedAppearances && (player.morale ?? 60) >= 65) delta += 2;
    player.happiness = clamp((player.happiness ?? player.morale ?? 65) + delta, 5, 100);
    player.concerns = concerns;
    if (!player.transferRequest && (player.happiness <= 30 || (concerns.length >= 3 && rng.chance(0.55)))) {
      player.transferRequest = true;
      player.listed = true;
      if (player.clubId === next.userClubId) {
        next.inbox.unshift({
          id: `transfer-request-${next.season}-${next.week}-${player.id}`,
          kind: 'message',
          category: '選手',
          title: `${player.name}が移籍を希望しています`,
          body: `不満理由：${concerns.join('、') || 'クラブ環境への不満'}。面談や契約更新、出場機会の見直しが必要です。`,
          week: next.week,
          resolved: true,
          createdAt: Date.now()
        });
      }
    }
  }
  return next;
}

export function processPlayerLifecycle(state, rng) {
  let next = snapshotSeasonStats(state);
  const retired = [];
  const announced = [];
  const survivors = [];
  for (const player of next.players) {
    player.careerStats = careerStats(player);
    player.age += 1;
    player.contractYears = Math.max(0, (player.contractYears ?? 1) - 1);
    const declineStart = player.position === 'GK' ? 34 : 30;
    if (player.age <= 23 && player.overall < player.potential) {
      const growth = rng.chance(0.7) ? rng.int(0, 2) : 0;
      player.overall = Math.min(player.potential, player.overall + growth);
    } else if (player.age > declineStart) {
      const decline = 1 + Math.floor((player.age - declineStart) / 3) + (rng.chance(0.35) ? 1 : 0);
      player.overall = clamp(player.overall - decline, 38, 99);
      player.potential = Math.max(player.overall, player.potential - Math.max(1, decline - 1));
    }
    const retirementAge = player.position === 'GK' ? 39 : 36;
    if (!player.retirementAnnounced && player.age >= retirementAge - 1 && rng.chance(0.28 + Math.max(0, player.age - retirementAge) * 0.16)) {
      player.retirementAnnounced = true;
      announced.push({ id: player.id, name: player.name, clubId: player.clubId, age: player.age });
    }
    const retires = player.retirementAnnounced && (player.age >= retirementAge || rng.chance(0.72));
    if (retires) {
      retired.push({ id: player.id, name: player.name, position: player.position, age: player.age, clubId: player.clubId, careerStats: player.careerStats, seasonHistory: player.seasonHistory });
      continue;
    }
    for (const key of SEASON_STAT_KEYS) player[key] = 0;
    player.seasonRating = 0;
    player.yellowCards = 0;
    player.suspended = false;
    player.injuryWeeks = 0;
    player.injuryName = '';
    player.fitness = clamp(player.fitness + 20, 74, 100);
    player.form = 65;
    player.transferRequest = player.contractYears === 0 ? true : Boolean(player.transferRequest && player.happiness < 45);
    survivors.push(player);
  }
  next.players = survivors;
  next.history ??= {};
  next.history.retiredPlayers ??= [];
  next.history.retiredPlayers.unshift(...retired);
  next.history.retiredPlayers = next.history.retiredPlayers.slice(0, 250);
  for (const player of announced.filter((item) => item.clubId === next.userClubId && survivors.some((survivor) => survivor.id === item.id))) {
    next.inbox.unshift({
      id: `retirement-announcement-${next.season}-${player.id}`,
      kind: 'message',
      category: '選手',
      title: `${player.name}が今季限りでの引退を表明しました`,
      body: `${player.name}は今シーズンを最後に現役を退く意向です。残された試合での起用を検討してください。`,
      week: next.week,
      resolved: true,
      createdAt: Date.now()
    });
  }
  return { state: next, retired, announced };
}

export function runAiClubDevelopment(state, rng) {
  const next = deepClone(state);
  next.history ??= {};
  next.history.aiTransfers ??= [];
  for (const club of next.clubs) {
    if (club.id === next.userClubId) continue;
    let players = next.players.filter((player) => player.clubId === club.id);
    const investment = (club.facilities?.training ?? 1) + (club.projects?.analytics ?? 0);
    for (const player of players) {
      if (player.age <= 25 && player.overall < player.potential && rng.chance(0.18 + investment * 0.025)) {
        player.overall = Math.min(player.potential, player.overall + 1);
      }
      player.morale = clamp((player.morale ?? 65) + rng.int(-2, 3), 35, 92);
    }

    const plannedSignings = club.division === 1 ? 2 : 1;
    const candidates = generateTransferMarket(rng, 24, next.season * 10_000 + Number(club.id.replace(/\D/g, '') || 0));
    for (let signing = 0; signing < plannedSignings; signing += 1) {
      players = next.players.filter((player) => player.clubId === club.id);
      const weakest = [...players]
        .filter((player) => player.age >= 24 || player.potential <= player.overall + 3)
        .sort((a, b) => a.overall - b.overall || b.age - a.age)[0]
        ?? [...players].sort((a, b) => a.overall - b.overall)[0];
      if (!weakest) break;
      const candidate = candidates
        .filter((player) => player.position === weakest.position && player.overall >= weakest.overall + 2)
        .sort((a, b) => b.overall - a.overall || a.askingPrice - b.askingPrice)[0];
      if (!candidate) break;
      const fee = candidate.askingPrice;
      if (club.transferBudget < fee || club.cash - fee < (club.reserveCash ?? 0)) break;

      const weakestIndex = next.players.findIndex((player) => player.id === weakest.id);
      if (weakestIndex < 0) break;
      club.cash -= fee;
      club.transferBudget -= fee;
      candidate.id = `ai-signing-${next.season + 1}-${club.id}-${signing + 1}`;
      candidate.clubId = club.id;
      candidate.wage = candidate.askingWage;
      candidate.contractYears = 3;
      candidate.scouting = 100;
      candidate.happiness = 72;
      candidate.concerns = [];
      candidate.transferRequest = false;
      candidate.listed = false;
      delete candidate.askingPrice;
      delete candidate.askingWage;
      next.players.splice(weakestIndex, 1, candidate);
      candidates.splice(candidates.indexOf(candidate), 1);
      next.history.aiTransfers.unshift({
        season: next.season + 1,
        clubId: club.id,
        playerId: candidate.id,
        playerName: candidate.name,
        replacedPlayerId: weakest.id,
        fee
      });
    }

    const divisionBoost = club.division === 1 ? 1.08 : club.division === 2 ? 1 : 0.92;
    club.cash = Math.round(club.cash * divisionBoost + club.sponsorWeekly * 12);
    club.transferBudget = Math.max(club.transferBudget, Math.round((club.cash - club.reserveCash) * 0.24));
  }
  next.history.aiTransfers = next.history.aiTransfers.slice(0, 300);
  return next;
}
