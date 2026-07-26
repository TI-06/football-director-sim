import { createRng } from '../core/random.js';
import { average, clamp, round } from '../core/utils.js';
import { lineupRating, positionCompatibility } from './squad.js';

const ATTACK_POSITIONS = ['ST', 'AM', 'RW', 'LW', 'RM', 'LM'];
const MIDFIELD_POSITIONS = ['DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW'];
const DEFENCE_POSITIONS = ['CB', 'RB', 'LB', 'RWB', 'LWB', 'DM'];

const TACTIC_VALUES = {
  mentality: {
    defensive: { attack: -5, defence: 6, possession: -3, risk: -0.12 },
    cautious: { attack: -2, defence: 3, possession: -1, risk: -0.05 },
    balanced: { attack: 0, defence: 0, possession: 0, risk: 0 },
    positive: { attack: 3, defence: -1, possession: 2, risk: 0.08 },
    attacking: { attack: 6, defence: -4, possession: 3, risk: 0.16 }
  },
  pressing: {
    low: { attack: -1, defence: -1, volume: -0.8, fatigue: 5, cards: -0.3 },
    normal: { attack: 0, defence: 0, volume: 0, fatigue: 8, cards: 0 },
    high: { attack: 2, defence: 1, volume: 1.2, fatigue: 11, cards: 0.6 },
    'very-high': { attack: 4, defence: 1, volume: 2.2, fatigue: 15, cards: 1.1 }
  },
  tempo: {
    slow: { attack: -1, possession: 3, volume: -0.5, fatigue: -1 },
    normal: { attack: 0, possession: 0, volume: 0, fatigue: 0 },
    fast: { attack: 2, possession: -1, volume: 1, fatigue: 2 }
  }
};

function chosenPlayers(team) {
  const playerMap = new Map(team.players.map((player) => [player.id, player]));
  return team.lineup.starters
    .map((entry) => ({ player: playerMap.get(entry.playerId), slot: entry.slotPosition }))
    .filter((entry) => entry.player);
}

function unitRating(entries, positions, attribute) {
  const relevant = entries.filter((entry) => positions.includes(entry.slot));
  if (!relevant.length) return average(entries.map((entry) => entry.player[attribute] ?? entry.player.overall));
  return average(relevant.map((entry) => {
    const compatibility = positionCompatibility(entry.player, entry.slot);
    return (entry.player[attribute] * 0.68 + entry.player.overall * 0.32) * compatibility;
  }));
}

function teamMetrics(team) {
  const entries = chosenPlayers(team);
  const mentality = TACTIC_VALUES.mentality[team.tactics.mentality] ?? TACTIC_VALUES.mentality.balanced;
  const pressing = TACTIC_VALUES.pressing[team.tactics.pressing] ?? TACTIC_VALUES.pressing.normal;
  const tempo = TACTIC_VALUES.tempo[team.tactics.tempo] ?? TACTIC_VALUES.tempo.normal;
  const condition = average(entries.map(({ player }) => player.fitness * 0.5 + player.morale * 0.3 + player.form * 0.2));
  const familiarity = team.tactics.familiarity ?? 70;
  const attack = unitRating(entries, ATTACK_POSITIONS, 'attack') + mentality.attack + pressing.attack + tempo.attack;
  const midfield = unitRating(entries, MIDFIELD_POSITIONS, 'passing') + mentality.possession + tempo.possession;
  const defence = unitRating(entries, DEFENCE_POSITIONS, 'defense') + mentality.defence + pressing.defence;
  const goalkeeper = average(entries.filter((entry) => entry.slot === 'GK').map((entry) => entry.player.keeping || entry.player.overall)) || 55;
  const base = lineupRating(team.players, team.lineup, team.tactics.formation);
  const conditionModifier = (condition - 75) * 0.12;
  const familiarityModifier = (familiarity - 65) * 0.08;
  return {
    attack: attack + conditionModifier + familiarityModifier,
    midfield: midfield + conditionModifier * 0.6 + familiarityModifier,
    defence: defence + conditionModifier + familiarityModifier,
    goalkeeper: goalkeeper + conditionModifier,
    base,
    condition,
    chanceVolume: pressing.volume + tempo.volume,
    fatigue: clamp(pressing.fatigue + tempo.fatigue + (mentality.risk > 0.1 ? 2 : 0), 3, 20),
    cardFactor: pressing.cards + (mentality.risk > 0.1 ? 0.3 : 0),
    risk: mentality.risk
  };
}

function poisson(lambda, rng) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng.next();
  } while (product > limit && count < 12);
  return Math.max(0, count - 1);
}

function weightedPlayer(entries, rng, purpose = 'goal') {
  const candidates = entries.filter(({ slot }) => slot !== 'GK');
  return rng.weighted(candidates, ({ player, slot }) => {
    if (purpose === 'assist') return Math.max(1, player.passing + (MIDFIELD_POSITIONS.includes(slot) ? 16 : 0));
    return Math.max(1, player.attack + (ATTACK_POSITIONS.includes(slot) ? 22 : 0));
  })?.player;
}

function eventText(type, clubName, playerName, minute, extra = '') {
  const templates = {
    goal: [`${playerName}がゴール前で冷静に流し込んだ！`, `${playerName}の鋭い一撃がネットを揺らす！`, `${clubName}、鮮やかな連係から${playerName}が決めた！`],
    shot: [`${playerName}がミドルを狙う。`, `${clubName}が素早く攻め込み${playerName}がシュート。`, `${playerName}がペナルティエリア内で右足を振り抜く。`],
    save: [`GKが素晴らしい反応でセーブ。`, `決定的なシュートを守護神が止めた。`, `鋭いシュートだったがGKがコースを読んだ。`],
    card: [`${playerName}にイエローカード。`, `${playerName}の遅れたタックルに警告。`, `主審が${playerName}へカードを提示。`],
    injury: [`${playerName}がピッチに座り込んだ。交代が必要そうだ。`, `${playerName}が接触で負傷。スタッフが駆けつける。`],
    kickoff: [`キックオフ。${extra}`, `試合開始。両チームが慎重に入る。`],
    half: [`前半終了。${extra}`, `ハーフタイム。監督の修正が勝負を分ける。`],
    full: [`試合終了。${extra}`, `フルタイム。${extra}`]
  };
  const list = templates[type] ?? ['試合が動く。'];
  return list[Math.abs(minute + clubName.length + playerName.length) % list.length];
}

function createTeamEvents({ side, goals, shots, shotsOnTarget, cards, injuries, team, rng }) {
  const entries = chosenPlayers(team);
  const clubName = team.club.name;
  const events = [];
  const usedGoalMinutes = new Set();
  for (let index = 0; index < goals; index += 1) {
    let minute = rng.int(4, 89);
    while (usedGoalMinutes.has(minute)) minute = clamp(minute + 1, 1, 90);
    usedGoalMinutes.add(minute);
    const scorer = weightedPlayer(entries, rng, 'goal');
    const assister = rng.chance(0.72) ? weightedPlayer(entries.filter((entry) => entry.player.id !== scorer?.id), rng, 'assist') : null;
    events.push({
      minute,
      type: 'goal',
      side,
      clubId: team.club.id,
      playerId: scorer?.id ?? null,
      playerName: scorer?.name ?? 'Unknown',
      assistId: assister?.id ?? null,
      assistName: assister?.name ?? null,
      text: eventText('goal', clubName, scorer?.name ?? 'Unknown', minute)
    });
  }
  const nonGoalOnTarget = Math.max(0, shotsOnTarget - goals);
  for (let index = 0; index < Math.min(nonGoalOnTarget, 5); index += 1) {
    const minute = rng.int(2, 89);
    const shooter = weightedPlayer(entries, rng, 'goal');
    events.push({ minute, type: 'save', side, clubId: team.club.id, playerId: shooter?.id ?? null, playerName: shooter?.name ?? '', text: eventText('save', clubName, shooter?.name ?? '', minute) });
  }
  const offTarget = Math.max(0, shots - shotsOnTarget);
  for (let index = 0; index < Math.min(offTarget, 4); index += 1) {
    const minute = rng.int(2, 89);
    const shooter = weightedPlayer(entries, rng, 'goal');
    events.push({ minute, type: 'shot', side, clubId: team.club.id, playerId: shooter?.id ?? null, playerName: shooter?.name ?? '', text: eventText('shot', clubName, shooter?.name ?? '', minute) });
  }
  for (let index = 0; index < cards; index += 1) {
    const minute = rng.int(8, 89);
    const offender = rng.pick(entries)?.player;
    events.push({ minute, type: 'card', side, clubId: team.club.id, playerId: offender?.id ?? null, playerName: offender?.name ?? '', text: eventText('card', clubName, offender?.name ?? '', minute) });
  }
  for (const injury of injuries) {
    events.push({ minute: injury.minute, type: 'injury', side, clubId: team.club.id, playerId: injury.playerId, playerName: injury.playerName, injuryWeeks: injury.weeks, injuryName: injury.name, text: eventText('injury', clubName, injury.playerName, injury.minute) });
  }
  return events;
}

function substitutionEvents(team, side, rng) {
  const playerMap = new Map(team.players.map((player) => [player.id, player]));
  const starters = rng.shuffle(team.lineup.starters
    .map((entry) => playerMap.get(entry.playerId))
    .filter((player) => player && player.position !== 'GK'));
  const bench = rng.shuffle((team.lineup.bench ?? [])
    .map((playerId) => playerMap.get(playerId))
    .filter((player) => player && player.position !== 'GK' && player.injuryWeeks <= 0 && !player.suspended));
  const count = Math.min(rng.int(1, 3), starters.length, bench.length);
  return Array.from({ length: count }, (_, index) => {
    const playerOut = starters[index];
    const playerIn = bench[index];
    const minute = clamp(58 + index * 9 + rng.int(-3, 4), 50, 86);
    return {
      minute,
      type: 'substitution',
      side,
      clubId: team.club.id,
      playerOutId: playerOut.id,
      playerOutName: playerOut.name,
      playerInId: playerIn.id,
      playerInName: playerIn.name,
      text: `${team.club.name}が選手交代。${playerOut.name}に代えて${playerIn.name}を投入する。`
    };
  });
}

function injuriesFor(team, metrics, rng) {
  const entries = chosenPlayers(team);
  const probability = clamp(0.035 + Math.max(0, metrics.fatigue - 9) * 0.004 + Math.max(0, 70 - metrics.condition) * 0.0015, 0.02, 0.16);
  if (!rng.chance(probability)) return [];
  const candidate = rng.weighted(entries, ({ player }) => Math.max(1, 105 - player.fitness))?.player;
  if (!candidate) return [];
  const weeks = rng.weighted([{ value: 1, weight: 5 }, { value: 2, weight: 4 }, { value: 3, weight: 2 }, { value: 5, weight: 1 }], (item) => item.weight).value;
  const names = weeks >= 4 ? ['ハムストリング損傷', '足首靱帯損傷'] : weeks >= 2 ? ['ふくらはぎの張り', '足首捻挫'] : ['打撲', '筋疲労'];
  return [{ playerId: candidate.id, playerName: candidate.name, minute: rng.int(12, 84), weeks, name: rng.pick(names) }];
}

function playerRatings(home, away, score, events, rng) {
  const make = (team, side) => chosenPlayers(team).map(({ player, slot }) => {
    const goals = events.filter((event) => event.type === 'goal' && event.playerId === player.id).length;
    const assists = events.filter((event) => event.type === 'goal' && event.assistId === player.id).length;
    const cards = events.filter((event) => event.type === 'card' && event.playerId === player.id).length;
    const teamGoals = side === 'home' ? score.home : score.away;
    const conceded = side === 'home' ? score.away : score.home;
    const resultBonus = teamGoals > conceded ? 0.35 : teamGoals === conceded ? 0.05 : -0.28;
    const defensiveBonus = ['GK', 'CB', 'RB', 'LB', 'RWB', 'LWB', 'DM'].includes(slot) && conceded === 0 ? 0.45 : 0;
    const rating = clamp(6.15 + resultBonus + goals * 1.15 + assists * 0.55 + defensiveBonus - cards * 0.22 + rng.float(-0.38, 0.38), 4.2, 10);
    return { playerId: player.id, playerName: player.name, clubId: team.club.id, side, rating: round(rating, 1), goals, assists, cards };
  });
  return [...make(home, 'home'), ...make(away, 'away')].sort((a, b) => b.rating - a.rating);
}

export function simulateMatch({ seed, home, away }) {
  const rng = createRng(seed);
  const homeMetrics = teamMetrics(home);
  const awayMetrics = teamMetrics(away);
  const homePossessionRaw = 50 + (homeMetrics.midfield - awayMetrics.midfield) * 0.45 + 2.5 + rng.float(-4, 4);
  const homePossession = clamp(Math.round(homePossessionRaw), 32, 68);
  const awayPossession = 100 - homePossession;

  const homeXg = clamp(
    1.18 + (homeMetrics.attack - (awayMetrics.defence * 0.72 + awayMetrics.goalkeeper * 0.28)) / 18 + 0.22 + homeMetrics.chanceVolume * 0.12 + homeMetrics.risk - awayMetrics.risk * 0.25 + rng.float(-0.22, 0.22),
    0.18,
    4.2
  );
  const awayXg = clamp(
    1.08 + (awayMetrics.attack - (homeMetrics.defence * 0.72 + homeMetrics.goalkeeper * 0.28)) / 18 + awayMetrics.chanceVolume * 0.12 + awayMetrics.risk - homeMetrics.risk * 0.25 + rng.float(-0.22, 0.22),
    0.15,
    4
  );

  const homeGoals = poisson(homeXg, rng);
  const awayGoals = poisson(awayXg, rng);
  const homeShots = Math.max(homeGoals, Math.round(homeXg * 4.4 + 4 + homeMetrics.chanceVolume + rng.float(-1.5, 2.5)));
  const awayShots = Math.max(awayGoals, Math.round(awayXg * 4.4 + 4 + awayMetrics.chanceVolume + rng.float(-1.5, 2.5)));
  const homeShotsOnTarget = clamp(Math.max(homeGoals, Math.round(homeShots * clamp(0.34 + (homeMetrics.attack - awayMetrics.goalkeeper) * 0.003, 0.27, 0.52) + rng.float(-1, 1))), homeGoals, homeShots);
  const awayShotsOnTarget = clamp(Math.max(awayGoals, Math.round(awayShots * clamp(0.34 + (awayMetrics.attack - homeMetrics.goalkeeper) * 0.003, 0.27, 0.52) + rng.float(-1, 1))), awayGoals, awayShots);
  const homeCards = clamp(poisson(1.05 + homeMetrics.cardFactor * 0.45, rng), 0, 6);
  const awayCards = clamp(poisson(1.15 + awayMetrics.cardFactor * 0.45, rng), 0, 6);
  const homeInjuries = injuriesFor(home, homeMetrics, rng);
  const awayInjuries = injuriesFor(away, awayMetrics, rng);

  const events = [
    { minute: 0, type: 'kickoff', side: 'neutral', text: eventText('kickoff', home.club.name, '', 0, `${home.club.name} vs ${away.club.name}`) },
    ...createTeamEvents({ side: 'home', goals: homeGoals, shots: homeShots, shotsOnTarget: homeShotsOnTarget, cards: homeCards, injuries: homeInjuries, team: home, rng }),
    ...createTeamEvents({ side: 'away', goals: awayGoals, shots: awayShots, shotsOnTarget: awayShotsOnTarget, cards: awayCards, injuries: awayInjuries, team: away, rng }),
    ...substitutionEvents(home, 'home', rng),
    ...substitutionEvents(away, 'away', rng),
    { minute: 45, type: 'half', side: 'neutral', text: eventText('half', home.club.name, '', 45, '前半のデータを確認する。') },
    { minute: 90, type: 'full', side: 'neutral', text: eventText('full', home.club.name, '', 90, `${home.club.name} ${homeGoals}-${awayGoals} ${away.club.name}`) }
  ].sort((a, b) => a.minute - b.minute || (a.type === 'kickoff' ? -1 : b.type === 'full' ? -1 : 0));

  const ratings = playerRatings(home, away, { home: homeGoals, away: awayGoals }, events, rng);
  return {
    id: `report-${String(seed).replace(/[^a-zA-Z0-9-]/g, '-')}`,
    seed: String(seed),
    homeClubId: home.club.id,
    awayClubId: away.club.id,
    homeGoals,
    awayGoals,
    homePossession,
    awayPossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeXg: round(homeXg, 2),
    awayXg: round(awayXg, 2),
    homeCards,
    awayCards,
    corners: { home: clamp(Math.round(homeShots * 0.32 + rng.float(-1, 2)), 0, 12), away: clamp(Math.round(awayShots * 0.32 + rng.float(-1, 2)), 0, 12) },
    fatigueImpact: { home: homeMetrics.fatigue, away: awayMetrics.fatigue },
    injuries: [...homeInjuries.map((item) => ({ ...item, clubId: home.club.id })), ...awayInjuries.map((item) => ({ ...item, clubId: away.club.id }))],
    events,
    playerRatings: ratings,
    manOfTheMatch: ratings[0] ?? null,
    metrics: { home: homeMetrics, away: awayMetrics }
  };
}
