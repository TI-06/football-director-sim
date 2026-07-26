import { createRng } from '../core/random.js';
import { clamp, deepClone, dateForWeek } from '../core/utils.js';
import { CLUB_TEMPLATES, DEFAULT_TACTICS, FORMATIONS, generateAcademyIntake, generateLeague, generateTransferMarket } from '../data/catalog.js';
import { createDoubleRoundRobin, calculateStandings, getWeekFixtures } from './fixtures.js';
import { selectBestLineup, validateLineup, replaceStarter } from './squad.js';
import { simulateMatch } from './match-engine.js';
import { settleWeeklyFinances, upgradeFacility } from './economy.js';
import { applyWeeklyTraining, promoteProspect, recoverPlayers } from './development.js';
import { buyPlayer, listPlayerForSale, releasePlayer, scoutMarketPlayer, sellPlayer } from './transfers.js';
import { generateWeeklyEvent, resolveEvent } from './events.js';
import { SAVE_SCHEMA_VERSION } from './save.js';

const TACTIC_OPTIONS = {
  formation: Object.keys(FORMATIONS),
  mentality: ['defensive', 'cautious', 'balanced', 'positive', 'attacking'],
  tempo: ['slow', 'normal', 'fast'],
  passing: ['short', 'mixed', 'direct'],
  width: ['narrow', 'normal', 'wide'],
  pressing: ['low', 'normal', 'high', 'very-high'],
  defensiveLine: ['deep', 'normal', 'high'],
  focus: ['left', 'balanced', 'right', 'middle']
};

function seasonStartDate(season) {
  return `${2025 + Number(season)}-08-01`;
}

function clubMap(state) {
  return Object.fromEntries(state.clubs.map((club) => [club.id, club.name]));
}

function userClub(state) {
  return state.clubs.find((club) => club.id === state.userClubId);
}

function clubPlayers(state, clubId) {
  return state.players.filter((player) => player.clubId === clubId);
}

function buildTeam(state, clubId) {
  const club = state.clubs.find((item) => item.id === clubId);
  const players = clubPlayers(state, clubId);
  const isUser = clubId === state.userClubId;
  const tactics = isUser ? state.tactics : { ...DEFAULT_TACTICS, ...club.tactics, familiarity: 75 };
  let lineup = isUser ? state.lineup : selectBestLineup(players, tactics.formation);
  if (!validateLineup(players, lineup, tactics.formation).valid) lineup = selectBestLineup(players, tactics.formation);
  if (isUser) state.lineup = lineup;
  return { club, players, lineup, tactics };
}

function updatePlayerAfterMatch(player, rating, result, fatigue) {
  const previousAppearances = player.appearances || 0;
  player.appearances = previousAppearances + 1;
  player.seasonRating = previousAppearances === 0
    ? rating.rating
    : Math.round(((player.seasonRating * previousAppearances + rating.rating) / player.appearances) * 10) / 10;
  player.goals = (player.goals || 0) + rating.goals;
  player.assists = (player.assists || 0) + rating.assists;
  player.yellowCards = (player.yellowCards || 0) + rating.cards;
  if (player.yellowCards >= 3) {
    player.suspended = true;
    player.yellowCards = 0;
  }
  player.fitness = clamp(player.fitness - fatigue, 18, 100);
  const resultDelta = result === 'win' ? 4 : result === 'draw' ? 1 : -4;
  player.morale = clamp(player.morale + resultDelta + (rating.rating >= 7.5 ? 2 : rating.rating < 5.8 ? -2 : 0), 20, 100);
  player.form = clamp(player.form + resultDelta + Math.round((rating.rating - 6.5) * 2), 20, 100);
}

function applyReport(state, report) {
  const homeResult = report.homeGoals > report.awayGoals ? 'win' : report.homeGoals === report.awayGoals ? 'draw' : 'loss';
  const awayResult = homeResult === 'win' ? 'loss' : homeResult === 'loss' ? 'win' : 'draw';
  const playerMap = new Map(state.players.map((player) => [player.id, player]));
  for (const rating of report.playerRatings) {
    const player = playerMap.get(rating.playerId);
    if (!player) continue;
    const result = rating.side === 'home' ? homeResult : awayResult;
    const fatigue = rating.side === 'home' ? report.fatigueImpact.home : report.fatigueImpact.away;
    updatePlayerAfterMatch(player, rating, result, fatigue);
    if (player.position === 'GK') {
      const conceded = rating.side === 'home' ? report.awayGoals : report.homeGoals;
      if (conceded === 0) player.cleanSheets = (player.cleanSheets || 0) + 1;
    }
  }
  for (const injury of report.injuries) {
    const player = playerMap.get(injury.playerId);
    if (!player) continue;
    player.injuryWeeks = Math.max(player.injuryWeeks || 0, injury.weeks);
    player.injuryName = injury.name;
  }
  const homeClub = state.clubs.find((club) => club.id === report.homeClubId);
  const awayClub = state.clubs.find((club) => club.id === report.awayClubId);
  if (homeClub && awayClub) {
    const homeDelta = homeResult === 'win' ? 3 : homeResult === 'draw' ? 0 : -3;
    const awayDelta = awayResult === 'win' ? 3 : awayResult === 'draw' ? 0 : -3;
    homeClub.fanMood = clamp(homeClub.fanMood + homeDelta, 20, 100);
    awayClub.fanMood = clamp(awayClub.fanMood + awayDelta, 20, 100);
    if (homeClub.id === state.userClubId) homeClub.boardConfidence = clamp(homeClub.boardConfidence + homeDelta, 0, 100);
    if (awayClub.id === state.userClubId) awayClub.boardConfidence = clamp(awayClub.boardConfidence + awayDelta, 0, 100);
  }
}

function createWelcomeInbox(club, managerName) {
  return [
    {
      id: 'welcome-board',
      kind: 'message',
      category: '取締役会',
      title: `${club.name}へようこそ`,
      body: `${managerName}監督、今季の目標は「${club.objective}」です。チーム編成、戦術、育成、財務のすべてをあなたに任せます。`,
      week: 1,
      resolved: true,
      createdAt: Date.now()
    },
    {
      id: 'welcome-scout',
      kind: 'message',
      category: 'スカウト',
      title: '移籍候補リストを提出しました',
      body: '能力が未確定の選手はスカウトを実行すると正確な評価が表示されます。給与予算にも注意してください。',
      week: 1,
      resolved: true,
      createdAt: Date.now()
    }
  ];
}

export function createNewGame({ managerName = 'Manager', clubId = 'northbridge-fc', clubName, difficulty = 'normal', seed = `career-${Date.now()}` } = {}) {
  if (!CLUB_TEMPLATES.some((club) => club.id === clubId)) throw new Error('Unknown club selection.');
  const rng = createRng(seed);
  const league = generateLeague(rng, difficulty, clubId);
  const selected = league.clubs.find((club) => club.id === clubId);
  if (clubName?.trim()) {
    selected.name = clubName.trim().slice(0, 32);
    selected.shortName = selected.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || selected.shortName;
  }
  const players = league.players.filter((player) => player.clubId === clubId);
  const tactics = { ...DEFAULT_TACTICS, ...selected.tactics, familiarity: 72 };
  const lineup = selectBestLineup(players, tactics.formation);
  const fixtures = createDoubleRoundRobin(league.clubs.map((club) => club.id));
  const state = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: '1.0.0',
    seed: String(seed),
    difficulty,
    managerName: managerName.trim().slice(0, 32) || 'Manager',
    userClubId: clubId,
    season: 1,
    week: 1,
    currentDate: seasonStartDate(1),
    seasonStatus: 'active',
    clubs: league.clubs,
    players: league.players,
    academy: league.academy,
    transferMarket: generateTransferMarket(rng, 28, 1),
    fixtures,
    standings: calculateStandings(league.clubs.map((club) => club.id), fixtures, clubMap({ clubs: league.clubs })),
    tactics,
    lineup,
    trainingFocus: 'balanced',
    inbox: createWelcomeInbox(selected, managerName),
    matchReports: [],
    finances: { ledger: [] },
    history: { events: [], seasons: [] },
    lastMatchReportId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  return state;
}

function awardSeasonPrize(state) {
  const next = deepClone(state);
  const position = next.standings.findIndex((row) => row.teamId === next.userClubId) + 1;
  const prizes = [220_000_000, 160_000_000, 120_000_000, 90_000_000, 70_000_000, 55_000_000, 45_000_000, 35_000_000];
  const prize = prizes[position - 1] ?? 30_000_000;
  const club = userClub(next);
  club.cash += prize;
  club.transferBudget += Math.round(prize * 0.6);
  next.finances.ledger.unshift({ id: `season-prize-${next.season}`, week: 14, clubId: club.id, type: 'income', label: `リーグ${position}位賞金`, amount: prize, timestamp: Date.now() });
  next.inbox.unshift({ id: `season-summary-${next.season}`, kind: 'message', category: 'シーズン', title: `シーズン終了：${position}位`, body: `最終順位は${position}位でした。賞金がクラブ財務へ反映されました。`, week: 14, resolved: true, createdAt: Date.now() });
  next.history.seasons.unshift({ season: next.season, position, points: next.standings.find((row) => row.teamId === next.userClubId)?.points ?? 0 });
  return next;
}

export function playNextWeek(state) {
  if (!state || state.seasonStatus !== 'active' || state.week > 14) {
    return { ok: false, state, message: 'このシーズンの全試合は終了しています。', matchReport: null };
  }
  let next = recoverPlayers(state);
  const training = applyWeeklyTraining(next, next.trainingFocus, createRng(`${next.seed}:training:${next.season}:${next.week}`));
  next = training.state;
  const week = next.week;
  const fixtures = getWeekFixtures(next.fixtures, week);
  let userReport = null;

  for (const fixture of fixtures) {
    const home = buildTeam(next, fixture.homeId);
    const away = buildTeam(next, fixture.awayId);
    const report = simulateMatch({ seed: `${next.seed}:season:${next.season}:week:${week}:${fixture.id}`, home, away });
    const storedFixture = next.fixtures.find((item) => item.id === fixture.id);
    storedFixture.played = true;
    storedFixture.homeGoals = report.homeGoals;
    storedFixture.awayGoals = report.awayGoals;
    storedFixture.reportId = report.id;
    applyReport(next, report);
    next.matchReports.unshift({ ...report, week, season: next.season, playedAt: Date.now() });
    if ([fixture.homeId, fixture.awayId].includes(next.userClubId)) userReport = report;
  }

  next.standings = calculateStandings(next.clubs.map((club) => club.id), next.fixtures, clubMap(next));
  const userFixture = fixtures.find((fixture) => [fixture.homeId, fixture.awayId].includes(next.userClubId));
  if (userFixture && userReport) {
    const isHome = userFixture.homeId === next.userClubId;
    const userGoals = isHome ? userReport.homeGoals : userReport.awayGoals;
    const opponentGoals = isHome ? userReport.awayGoals : userReport.homeGoals;
    next = settleWeeklyFinances(next, { userHomeMatch: isHome, won: userGoals > opponentGoals, drawn: userGoals === opponentGoals });
    next.lastMatchReportId = userReport.id;
  }

  next = generateWeeklyEvent(next, createRng(`${next.seed}:event:${next.season}:${week}`));
  if (week % 4 === 0) {
    const newPlayers = generateTransferMarket(createRng(`${next.seed}:market:${next.season}:${week}`), 8, week + 1);
    next.transferMarket = [...newPlayers, ...next.transferMarket].slice(0, 32);
    const club = userClub(next);
    const intake = generateAcademyIntake(createRng(`${next.seed}:academy:${next.season}:${week}`), club, 2, `${next.season}-${week}`);
    next.academy.push(...intake);
    next.inbox.unshift({
      id: `academy-intake-${next.season}-${week}`,
      kind: 'message',
      category: 'アカデミー',
      title: 'ユース候補が新加入しました',
      body: `${intake.map((player) => player.name).join('、')}の2名がアカデミーへ加入しました。スカウト評価と成長状況を確認してください。`,
      week,
      resolved: true,
      createdAt: Date.now()
    });
  }
  next.week += 1;
  next.currentDate = dateForWeek(seasonStartDate(next.season), next.week);
  next.updatedAt = Date.now();
  if (week === 14) {
    next.seasonStatus = 'complete';
    next = awardSeasonPrize(next);
  }
  const userPlayers = clubPlayers(next, next.userClubId);
  if (!validateLineup(userPlayers, next.lineup, next.tactics.formation).valid) {
    next.lineup = selectBestLineup(userPlayers, next.tactics.formation);
  }
  return { ok: true, state: next, message: '試合週を完了しました。', matchReport: userReport, trainingSummary: training.summary };
}

export function startNextSeason(state) {
  if (!state || state.seasonStatus !== 'complete') return { ok: false, state, message: '現在のシーズンが終了していません。' };
  const next = deepClone(state);
  next.season += 1;
  next.week = 1;
  next.currentDate = seasonStartDate(next.season);
  next.seasonStatus = 'active';
  next.fixtures = createDoubleRoundRobin(next.clubs.map((club) => club.id));
  next.standings = calculateStandings(next.clubs.map((club) => club.id), next.fixtures, clubMap(next));
  next.transferMarket = generateTransferMarket(createRng(`${next.seed}:market:${next.season}:opening`), 28, 1);
  next.lastMatchReportId = null;
  next.tactics.familiarity = clamp(next.tactics.familiarity - 8, 35, 100);
  for (const club of next.clubs) {
    club.boardConfidence = clamp(club.boardConfidence + (club.id === next.userClubId ? 2 : 0), 20, 95);
    club.fanMood = clamp(club.fanMood + 2, 20, 95);
  }
  for (const player of next.players) {
    player.age += 1;
    player.contractYears = Math.max(1, player.contractYears - 1);
    player.injuryWeeks = 0;
    player.injuryName = '';
    player.suspended = false;
    player.yellowCards = 0;
    player.appearances = 0;
    player.goals = 0;
    player.assists = 0;
    player.cleanSheets = 0;
    player.seasonRating = 0;
    player.fitness = clamp(player.fitness + 18, 72, 100);
    player.morale = clamp(player.morale + 4, 35, 95);
    player.form = 65;
  }
  for (const prospect of next.academy) {
    prospect.age += 1;
    prospect.fitness = clamp(prospect.fitness + 15, 75, 100);
  }
  next.lineup = selectBestLineup(clubPlayers(next, next.userClubId), next.tactics.formation);
  next.inbox.unshift({
    id: `season-opening-${next.season}`,
    kind: 'message',
    category: '取締役会',
    title: `シーズン${next.season}が開幕します`,
    body: '日程、選手コンディション、移籍市場が更新されました。新シーズンの目標達成へ向けて準備してください。',
    week: 1,
    resolved: true,
    createdAt: Date.now()
  });
  next.updatedAt = Date.now();
  return { ok: true, state: next, message: `シーズン${next.season}を開始しました。` };
}

export function performAction(state, action) {
  if (!state || !action?.type) return { ok: false, state, message: '無効な操作です。' };
  const payload = action.payload ?? {};
  switch (action.type) {
    case 'start-next-season': return startNextSeason(state);
    case 'update-tactics': {
      const next = deepClone(state);
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'familiarity') continue;
        if (TACTIC_OPTIONS[key]?.includes(value)) next.tactics[key] = value;
      }
      if (payload.formation && FORMATIONS[payload.formation]) {
        next.lineup = selectBestLineup(clubPlayers(next, next.userClubId), payload.formation);
        next.tactics.familiarity = Math.max(35, next.tactics.familiarity - 8);
      }
      next.updatedAt = Date.now();
      return { ok: true, state: next, message: '戦術を更新しました。' };
    }
    case 'update-training': {
      const next = deepClone(state);
      const allowed = ['balanced', 'attacking', 'defending', 'fitness', 'recovery', 'youth'];
      if (!allowed.includes(payload.focus)) return { ok: false, state, message: 'トレーニング方針が不正です。' };
      next.trainingFocus = payload.focus;
      userClub(next).trainingFocus = payload.focus;
      return { ok: true, state: next, message: '今週のトレーニング方針を変更しました。' };
    }
    case 'auto-lineup': {
      const next = deepClone(state);
      next.lineup = selectBestLineup(clubPlayers(next, next.userClubId), next.tactics.formation);
      return { ok: true, state: next, message: 'コンディションを考慮して自動編成しました。' };
    }
    case 'replace-starter': {
      const next = deepClone(state);
      next.lineup = replaceStarter(next.lineup, payload.slotId, payload.playerId, clubPlayers(next, next.userClubId), next.tactics.formation);
      const validation = validateLineup(clubPlayers(next, next.userClubId), next.lineup, next.tactics.formation);
      if (!validation.valid) return { ok: false, state, message: validation.errors[0] };
      return { ok: true, state: next, message: '先発メンバーを変更しました。' };
    }
    case 'set-captain': {
      const next = deepClone(state);
      if (!next.lineup.starters.some((entry) => entry.playerId === payload.playerId)) return { ok: false, state, message: '先発選手を指定してください。' };
      next.lineup.captainId = payload.playerId;
      return { ok: true, state: next, message: 'キャプテンを変更しました。' };
    }
    case 'set-penalty-taker': {
      const next = deepClone(state);
      if (!next.lineup.starters.some((entry) => entry.playerId === payload.playerId)) return { ok: false, state, message: '先発選手を指定してください。' };
      next.lineup.penaltyTakerId = payload.playerId;
      return { ok: true, state: next, message: 'PKキッカーを変更しました。' };
    }
    case 'buy-player': return buyPlayer(state, payload.playerId);
    case 'list-player': return listPlayerForSale(state, payload.playerId);
    case 'sell-player': return sellPlayer(state, payload.playerId, createRng(`${state.seed}:sale:${state.week}:${payload.playerId}`));
    case 'release-player': {
      const result = releasePlayer(state, payload.playerId);
      if (!result.ok) return result;
      const next = result.state;
      next.lineup = selectBestLineup(clubPlayers(next, next.userClubId), next.tactics.formation);
      return { ...result, state: next };
    }
    case 'scout-player': return scoutMarketPlayer(state, payload.playerId);
    case 'promote-prospect': return promoteProspect(state, payload.playerId);
    case 'upgrade-facility': return upgradeFacility(state, payload.facility);
    case 'resolve-event': return resolveEvent(state, payload.eventId, payload.choiceId);
    default: return { ok: false, state, message: '未対応の操作です。' };
  }
}
