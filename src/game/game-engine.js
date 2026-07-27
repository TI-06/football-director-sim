import { createRng } from '../core/random.js';
import { clamp, deepClone, dateForWeek } from '../core/utils.js';
import { CLUB_TEMPLATES, DEFAULT_TACTICS, FORMATIONS, generateAcademyIntake, generateLeague, generateTransferMarket } from '../data/catalog.js';
import {
  SEASON_WEEKS,
  createSeasonCompetitions,
  calculateDivisionStandings,
  competitionFixturesForWeek,
  resolveCupQualification,
  advanceCup,
  applyPromotionAndRelegation
} from './competitions.js';
import { selectBestLineup, validateLineup, replaceStarter } from './squad.js';
import { simulateMatch } from './match-engine.js';
import {
  settleWeeklyFinances,
  upgradeFacility,
  allocateTransferBudget,
  investClubProject,
  revalueSeasonBudgets
} from './economy.js';
import { applyWeeklyTraining, promoteProspect, recoverPlayers } from './development.js';
import {
  buyPlayer,
  listPlayerForSale,
  releasePlayer,
  renewPlayerContract,
  scoutMarketPlayer,
  sellPlayer
} from './transfers.js';
import { generateWeeklyEvent, resolveEvent } from './events.js';
import {
  calculateSeasonAwards,
  processPlayerLifecycle,
  runAiClubDevelopment,
  updatePlayerHappiness
} from './career.js';
import { buildSecretaryReport } from './secretary.js';
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
  return `${2025 + Number(season)}-02-01`;
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

function userDivision(state) {
  return userClub(state)?.division ?? 3;
}

function syncUserStandings(state) {
  state.standings = state.standingsByDivision?.[userDivision(state)] ?? [];
}

function buildTeam(state, clubId) {
  const club = state.clubs.find((item) => item.id === clubId);
  const players = clubPlayers(state, clubId);
  const isUser = clubId === state.userClubId;
  const tactics = isUser ? state.tactics : { ...DEFAULT_TACTICS, ...club.tactics, familiarity: 72 + (club.projects?.analytics ?? 0) * 2 };
  let lineup = isUser ? state.lineup : selectBestLineup(players, tactics.formation);
  if (!validateLineup(players, lineup, tactics.formation).valid) lineup = selectBestLineup(players, tactics.formation);
  if (isUser) state.lineup = lineup;
  return { club, players, lineup, tactics };
}

function ensureCareerStats(player) {
  player.careerStats ??= { appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, manOfTheMatch: 0 };
}

function updatePlayerAfterMatch(player, rating, result, fatigue) {
  ensureCareerStats(player);
  const previousAppearances = player.appearances || 0;
  player.appearances = previousAppearances + 1;
  player.starts = (player.starts || 0) + 1;
  player.minutes = (player.minutes || 0) + 90;
  player.seasonRating = previousAppearances === 0
    ? rating.rating
    : Math.round(((player.seasonRating * previousAppearances + rating.rating) / player.appearances) * 10) / 10;
  player.goals = (player.goals || 0) + rating.goals;
  player.assists = (player.assists || 0) + rating.assists;
  player.yellowCards = (player.yellowCards || 0) + rating.cards;
  player.careerStats.appearances += 1;
  player.careerStats.starts += 1;
  player.careerStats.minutes += 90;
  player.careerStats.goals += rating.goals;
  player.careerStats.assists += rating.assists;
  if (player.yellowCards >= 4) {
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
      if (conceded === 0) {
        player.cleanSheets = (player.cleanSheets || 0) + 1;
        player.careerStats.cleanSheets += 1;
      }
    }
  }
  const mom = playerMap.get(report.manOfTheMatch?.playerId);
  if (mom) {
    ensureCareerStats(mom);
    mom.manOfTheMatch = (mom.manOfTheMatch || 0) + 1;
    mom.careerStats.manOfTheMatch += 1;
  }
  for (const injury of report.injuries) {
    const player = playerMap.get(injury.playerId);
    if (!player) continue;
    const medicalReduction = state.clubs.find((club) => club.id === player.clubId)?.projects?.medical ?? 0;
    player.injuryWeeks = Math.max(player.injuryWeeks || 0, Math.max(1, injury.weeks - Math.floor(medicalReduction / 2)));
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

function createWelcomeInbox(club, managerName, clubMode) {
  return [
    {
      id: 'welcome-board',
      kind: 'message',
      category: '取締役会',
      title: `${club.name}へようこそ`,
      body: `${managerName}監督、${club.divisionName}での今季目標は「${club.objective}」です。${clubMode === 'created' ? '新設クラブとして3部から頂点を目指してください。' : 'クラブの歴史に新しい章を加えてください。'}`,
      week: 1,
      resolved: true,
      createdAt: Date.now()
    },
    {
      id: 'welcome-secretary',
      kind: 'message',
      category: '秘書',
      title: '週間レポートを準備しました',
      body: '次戦、選手状態、契約、不満、予算を秘書画面にまとめます。重要事項がある週は確認してください。',
      week: 1,
      resolved: true,
      createdAt: Date.now()
    },
    {
      id: 'welcome-cup',
      kind: 'message',
      category: '大会',
      title: '全国王者杯の組み合わせが決定しました',
      body: '1部から3部までの60クラブが参加します。リーグ戦とは別の日程でノックアウト戦が行われます。',
      week: 1,
      resolved: true,
      createdAt: Date.now()
    }
  ];
}

function customClubConfig(options) {
  if (options.clubMode !== 'created') return null;
  return {
    name: options.clubName,
    city: options.homeCity,
    primary: options.primaryColor,
    philosophy: options.clubPhilosophy
  };
}

export function createNewGame({
  managerName = '監督',
  clubMode = 'existing',
  clubId = CLUB_TEMPLATES[0].id,
  clubName,
  homeCity,
  primaryColor = '#16a34a',
  clubPhilosophy = 'balanced',
  difficulty = 'normal',
  seed = `career-${Date.now()}`
} = {}) {
  const customClub = customClubConfig({ clubMode, clubName, homeCity, primaryColor, clubPhilosophy });
  const selectedClubId = customClub ? 'created-club' : clubId;
  if (!customClub && !CLUB_TEMPLATES.some((club) => club.id === selectedClubId)) throw new Error('クラブの選択が不正です。');
  const rng = createRng(seed);
  const league = generateLeague(rng, difficulty, selectedClubId, customClub);
  const selected = league.clubs.find((club) => club.id === selectedClubId);
  if (!selected) throw new Error('選択したクラブを生成できませんでした。');
  const players = league.players.filter((player) => player.clubId === selectedClubId);
  const tactics = { ...DEFAULT_TACTICS, ...selected.tactics, familiarity: 72 };
  const lineup = selectBestLineup(players, tactics.formation);
  const competitions = createSeasonCompetitions(league.clubs, `${seed}:season:1`);
  const standingsByDivision = calculateDivisionStandings(league.clubs, competitions.leagueFixtures);
  const state = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: '2.0.0',
    seed: String(seed),
    difficulty,
    managerName: String(managerName || '監督').trim().slice(0, 32) || '監督',
    clubMode,
    userClubId: selectedClubId,
    season: 1,
    week: 1,
    seasonWeeks: SEASON_WEEKS,
    currentDate: seasonStartDate(1),
    seasonStatus: 'active',
    clubs: league.clubs,
    players: league.players,
    academy: league.academy,
    transferMarket: generateTransferMarket(rng, 40, 1),
    fixtures: competitions.leagueFixtures,
    cup: competitions.cup,
    standingsByDivision,
    standings: standingsByDivision[selected.division],
    tactics,
    lineup,
    trainingFocus: 'balanced',
    inbox: createWelcomeInbox(selected, managerName, clubMode),
    matchReports: [],
    finances: { ledger: [] },
    history: { events: [], seasons: [], awards: [], retiredPlayers: [], movements: [] },
    lastMatchReportId: null,
    secretaryReport: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.secretaryReport = buildSecretaryReport(state);
  return state;
}

function userCupResult(state) {
  if (state.cup.championClubId === state.userClubId) return '優勝';
  const history = state.cup.history ?? [];
  for (const round of history) {
    const fixture = round.fixtures.find((item) => [item.homeId, item.awayId].includes(state.userClubId));
    if (fixture && fixture.qualifiedId !== state.userClubId) return `${round.round}回戦敗退`;
  }
  return state.cup.fixtures.some((fixture) => [fixture.homeId, fixture.awayId].includes(state.userClubId)) ? '勝ち残り' : 'シードまたは敗退';
}

function awardSeason(state) {
  const next = deepClone(state);
  const club = userClub(next);
  const division = club.division;
  const table = next.standingsByDivision[division] ?? [];
  const position = table.findIndex((row) => row.teamId === next.userClubId) + 1;
  const basePrize = division === 1 ? 520_000_000 : division === 2 ? 260_000_000 : 130_000_000;
  const prize = Math.max(Math.round(basePrize * 0.18), Math.round(basePrize * (1 - (position - 1) * 0.038)));
  const cupChampionBonus = next.cup.championClubId === next.userClubId ? 300_000_000 : 0;
  club.cash += prize + cupChampionBonus;
  club.transferBudget += Math.round((prize + cupChampionBonus) * (club.saleRetention ?? 0.82));
  next.finances.ledger.unshift({ id: `season-prize-${next.season}`, week: SEASON_WEEKS, clubId: club.id, type: 'income', label: `${club.divisionName}${position}位賞金`, amount: prize, timestamp: Date.now() });
  if (cupChampionBonus) next.finances.ledger.unshift({ id: `cup-prize-${next.season}`, week: SEASON_WEEKS, clubId: club.id, type: 'income', label: '全国王者杯優勝賞金', amount: cupChampionBonus, timestamp: Date.now() });
  const awards = calculateSeasonAwards(next);
  next.history.awards.unshift(awards);
  const movementResult = applyPromotionAndRelegation(next.clubs, next.standingsByDivision);
  next.clubs = movementResult.clubs;
  next.history.movements.unshift({ season: next.season, movements: movementResult.movements });
  const userMovement = movementResult.movements.find((item) => item.clubId === next.userClubId);
  next.history.seasons.unshift({
    season: next.season,
    division,
    position,
    points: table.find((row) => row.teamId === next.userClubId)?.points ?? 0,
    cupResult: userCupResult(next),
    movement: userMovement?.direction ?? null
  });
  next.inbox.unshift({
    id: `season-summary-${next.season}`,
    kind: 'message',
    category: 'シーズン',
    title: `シーズン終了：${club.divisionName}${position}位`,
    body: `最終順位は${position}位、全国王者杯は「${userCupResult(next)}」でした。${userMovement ? (userMovement.direction === 'promoted' ? '昇格が決定しました。' : '降格が決定しました。') : '来季も同じ部門で戦います。'}`,
    week: SEASON_WEEKS,
    resolved: true,
    createdAt: Date.now()
  });
  next.seasonStatus = 'complete';
  return next;
}

function storeUserReport(state, report, fixture, week) {
  const isUserMatch = [fixture.homeId, fixture.awayId].includes(state.userClubId);
  if (!isUserMatch) return;
  state.matchReports.unshift({ ...report, competition: fixture.competition, competitionName: fixture.competitionName, round: fixture.round, week, season: state.season, playedAt: Date.now() });
  state.matchReports = state.matchReports.slice(0, 120);
  state.lastMatchReportId = report.id;
}

function playFixture(state, fixture, week) {
  const home = buildTeam(state, fixture.homeId);
  const away = buildTeam(state, fixture.awayId);
  const report = simulateMatch({ seed: `${state.seed}:season:${state.season}:week:${week}:${fixture.id}`, home, away });
  const storedFixture = fixture.competition === 'cup'
    ? state.cup.fixtures.find((item) => item.id === fixture.id)
    : state.fixtures.find((item) => item.id === fixture.id);
  storedFixture.played = true;
  storedFixture.homeGoals = report.homeGoals;
  storedFixture.awayGoals = report.awayGoals;
  if (fixture.competition === 'cup') {
    const qualifiedId = resolveCupQualification(storedFixture, createRng(`${state.seed}:penalties:${state.season}:${fixture.id}`));
    storedFixture.qualifiedId = qualifiedId;
    if (report.homeGoals === report.awayGoals) {
      storedFixture.penaltyWinnerId = qualifiedId;
      report.penaltyWinnerId = qualifiedId;
      report.penalties = qualifiedId === fixture.homeId ? { home: 5, away: 4 } : { home: 4, away: 5 };
    }
  }
  const isUserMatch = [fixture.homeId, fixture.awayId].includes(state.userClubId);
  storedFixture.reportId = isUserMatch ? report.id : null;
  applyReport(state, report);
  storeUserReport(state, report, fixture, week);
  return isUserMatch ? report : null;
}

export function playNextWeek(state) {
  if (!state || state.seasonStatus !== 'active' || state.week > SEASON_WEEKS) {
    return { ok: false, state, message: 'このシーズンの全日程は終了しています。', matchReport: null };
  }
  let next = recoverPlayers(state);
  const training = applyWeeklyTraining(next, next.trainingFocus, createRng(`${next.seed}:training:${next.season}:${next.week}`));
  next = training.state;
  const week = next.week;
  const fixtures = competitionFixturesForWeek(next, week);
  let userReport = null;

  for (const fixture of fixtures) {
    const report = playFixture(next, fixture, week);
    if (report) userReport = report;
  }

  if (fixtures.some((fixture) => fixture.competition === 'league')) {
    next.standingsByDivision = calculateDivisionStandings(next.clubs, next.fixtures);
    syncUserStandings(next);
  }
  if (fixtures.some((fixture) => fixture.competition === 'cup')) {
    next.cup = advanceCup(next.cup, `${next.seed}:season:${next.season}`);
  }

  const userFixture = fixtures.find((fixture) => [fixture.homeId, fixture.awayId].includes(next.userClubId));
  if (userFixture && userReport) {
    const isHome = userFixture.homeId === next.userClubId;
    const userGoals = isHome ? userReport.homeGoals : userReport.awayGoals;
    const opponentGoals = isHome ? userReport.awayGoals : userReport.homeGoals;
    const won = userGoals > opponentGoals || (userGoals === opponentGoals && userReport.penaltyWinnerId === next.userClubId);
    next = settleWeeklyFinances(next, { userHomeMatch: isHome, won, drawn: userGoals === opponentGoals && !userReport.penaltyWinnerId });
  } else {
    next = settleWeeklyFinances(next, { userHomeMatch: false });
  }

  next = generateWeeklyEvent(next, createRng(`${next.seed}:event:${next.season}:${week}`));
  if (week % 4 === 0) {
    next = updatePlayerHappiness(next, createRng(`${next.seed}:happiness:${next.season}:${week}`));
    const newPlayers = generateTransferMarket(createRng(`${next.seed}:market:${next.season}:${week}`), 10, next.season * 100 + week);
    next.transferMarket = [...newPlayers, ...next.transferMarket].slice(0, 48);
  }
  if (week % 8 === 0) {
    const club = userClub(next);
    const intake = generateAcademyIntake(createRng(`${next.seed}:academy:${next.season}:${week}`), club, 2, `${next.season}-${week}`);
    next.academy.push(...intake);
    next.inbox.unshift({
      id: `academy-intake-${next.season}-${week}`,
      kind: 'message',
      category: 'アカデミー',
      title: 'ユース候補が新加入しました',
      body: `${intake.map((player) => player.name).join('、')}の2名がアカデミーへ加入しました。`,
      week,
      resolved: true,
      createdAt: Date.now()
    });
  }

  next.week += 1;
  next.currentDate = dateForWeek(seasonStartDate(next.season), next.week);
  next.updatedAt = Date.now();
  if (week === SEASON_WEEKS) next = awardSeason(next);
  const players = clubPlayers(next, next.userClubId);
  if (!validateLineup(players, next.lineup, next.tactics.formation).valid) next.lineup = selectBestLineup(players, next.tactics.formation);
  next.secretaryReport = buildSecretaryReport(next);
  return { ok: true, state: next, message: fixtures.length ? '試合週を完了しました。' : '準備週を完了しました。', matchReport: userReport, trainingSummary: training.summary };
}

function replenishSquads(state) {
  const next = deepClone(state);
  for (const [clubIndex, club] of next.clubs.entries()) {
    const players = next.players.filter((player) => player.clubId === club.id);
    const missing = Math.max(0, 22 - players.length);
    if (!missing) continue;
    const replacements = generateTransferMarket(createRng(`${next.seed}:replacement:${next.season}:${club.id}`), missing, next.season * 1000 + clubIndex);
    for (const [index, player] of replacements.entries()) {
      player.id = `replacement-${next.season}-${club.id}-${index + 1}`;
      player.clubId = club.id;
      player.wage = Math.round(player.askingWage * 0.82);
      player.contractYears = 3;
      player.scouting = 100;
      player.happiness = 70;
      player.concerns = [];
      player.transferRequest = false;
      delete player.askingPrice;
      delete player.askingWage;
      next.players.push(player);
    }
  }
  return next;
}

export function startNextSeason(state) {
  if (!state || state.seasonStatus !== 'complete') return { ok: false, state, message: '現在のシーズンが終了していません。' };
  const previousSeason = state.history.seasons[0];
  let lifecycle = processPlayerLifecycle(state, createRng(`${state.seed}:lifecycle:${state.season + 1}`));
  let next = lifecycle.state;
  next = runAiClubDevelopment(next, createRng(`${state.seed}:ai-development:${state.season + 1}`));
  next = replenishSquads(next);
  next.season += 1;
  next.week = 1;
  next.currentDate = seasonStartDate(next.season);
  next.seasonStatus = 'active';
  const competitions = createSeasonCompetitions(next.clubs, `${next.seed}:season:${next.season}`);
  next.fixtures = competitions.leagueFixtures;
  next.cup = competitions.cup;
  next.standingsByDivision = calculateDivisionStandings(next.clubs, next.fixtures);
  syncUserStandings(next);
  next = revalueSeasonBudgets(next, previousSeason?.position ?? 10);
  next.transferMarket = generateTransferMarket(createRng(`${next.seed}:market:${next.season}:opening`), 40, next.season * 100);
  next.lastMatchReportId = null;
  next.tactics.familiarity = clamp(next.tactics.familiarity - 8, 35, 100);
  for (const club of next.clubs) {
    club.boardConfidence = clamp(club.boardConfidence + (club.id === next.userClubId ? 2 : 0), 20, 95);
    club.fanMood = clamp(club.fanMood + 2, 20, 95);
  }
  for (const prospect of next.academy) {
    prospect.age += 1;
    prospect.fitness = clamp(prospect.fitness + 15, 75, 100);
  }
  next.academy = next.academy.filter((prospect) => prospect.age <= 20);
  next.lineup = selectBestLineup(clubPlayers(next, next.userClubId), next.tactics.formation);
  const retirementText = lifecycle.retired.length ? `今季は${lifecycle.retired.length}名が現役を引退しました。` : '今季の引退者はいません。';
  next.inbox.unshift({
    id: `season-opening-${next.season}`,
    kind: 'message',
    category: '取締役会',
    title: `シーズン${next.season}が開幕します`,
    body: `${userClub(next).divisionName}の日程、全国王者杯、予算が更新されました。${retirementText}`,
    week: 1,
    resolved: true,
    createdAt: Date.now()
  });
  next.updatedAt = Date.now();
  next.secretaryReport = buildSecretaryReport(next);
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
      next.secretaryReport = buildSecretaryReport(next);
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
    case 'renew-contract': return renewPlayerContract(state, payload.playerId, payload.years);
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
    case 'allocate-transfer-budget': return allocateTransferBudget(state, payload.amount);
    case 'invest-project': return investClubProject(state, payload.projectId);
    case 'resolve-event': return resolveEvent(state, payload.eventId, payload.choiceId);
    default: return { ok: false, state, message: '未対応の操作です。' };
  }
}
