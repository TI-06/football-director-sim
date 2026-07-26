import { clamp } from '../core/utils.js';

export const DIFFICULTIES = {
  casual: { id: 'casual', label: 'カジュアル', budgetMultiplier: 1.3, opponentBoost: -2, boardTolerance: 12 },
  normal: { id: 'normal', label: 'スタンダード', budgetMultiplier: 1, opponentBoost: 0, boardTolerance: 0 },
  hard: { id: 'hard', label: 'ハード', budgetMultiplier: 0.78, opponentBoost: 3, boardTolerance: -10 }
};

export const CLUB_TEMPLATES = [
  { id: 'northbridge-fc', name: 'Northbridge FC', shortName: 'NBR', city: 'ノースブリッジ', primary: '#10b981', secondary: '#052e2b', reputation: 68, style: 'balanced', stadium: 'Crown Park', capacity: 24200 },
  { id: 'redhaven-athletic', name: 'Redhaven Athletic', shortName: 'RHA', city: 'レッドヘイブン', primary: '#ef4444', secondary: '#3f0d12', reputation: 75, style: 'pressing', stadium: 'Forge Arena', capacity: 31000 },
  { id: 'azure-city', name: 'Azure City', shortName: 'AZC', city: 'アジュール', primary: '#38bdf8', secondary: '#082f49', reputation: 78, style: 'possession', stadium: 'Oceanic Bowl', capacity: 35400 },
  { id: 'ironvale-united', name: 'Ironvale United', shortName: 'IVU', city: 'アイアンベイル', primary: '#94a3b8', secondary: '#1e293b', reputation: 70, style: 'direct', stadium: 'Foundry Ground', capacity: 27500 },
  { id: 'goldcrest-rovers', name: 'Goldcrest Rovers', shortName: 'GCR', city: 'ゴールドクレスト', primary: '#f59e0b', secondary: '#451a03', reputation: 65, style: 'counter', stadium: 'Sunfield', capacity: 21800 },
  { id: 'violet-orbit', name: 'Violet Orbit', shortName: 'VOR', city: 'ヴァイオレット', primary: '#a78bfa', secondary: '#2e1065', reputation: 72, style: 'technical', stadium: 'Orbit Dome', capacity: 29200 },
  { id: 'forest-guardians', name: 'Forest Guardians', shortName: 'FGD', city: 'グリーンウッド', primary: '#22c55e', secondary: '#052e16', reputation: 63, style: 'youth', stadium: 'Canopy Field', capacity: 19600 },
  { id: 'silverport-1899', name: 'Silverport 1899', shortName: 'S99', city: 'シルバーポート', primary: '#e2e8f0', secondary: '#334155', reputation: 80, style: 'elite', stadium: 'Harbour National', capacity: 40100 }
];

export const FORMATIONS = {
  '4-2-3-1': {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      ['GK', 'GK', 50, 90], ['LB', 'LB', 16, 68], ['LCB', 'CB', 39, 73], ['RCB', 'CB', 61, 73], ['RB', 'RB', 84, 68],
      ['LDM', 'DM', 39, 52], ['RDM', 'DM', 61, 52], ['LAM', 'LW', 20, 33], ['CAM', 'AM', 50, 38], ['RAM', 'RW', 80, 33], ['ST', 'ST', 50, 14]
    ].map(([id, position, x, y]) => ({ id, position, x, y }))
  },
  '4-3-3': {
    id: '4-3-3', label: '4-3-3', slots: [
      ['GK', 'GK', 50, 90], ['LB', 'LB', 16, 68], ['LCB', 'CB', 39, 73], ['RCB', 'CB', 61, 73], ['RB', 'RB', 84, 68],
      ['LCM', 'CM', 30, 48], ['CM', 'CM', 50, 55], ['RCM', 'CM', 70, 48], ['LW', 'LW', 19, 25], ['ST', 'ST', 50, 16], ['RW', 'RW', 81, 25]
    ].map(([id, position, x, y]) => ({ id, position, x, y }))
  },
  '4-4-2': {
    id: '4-4-2', label: '4-4-2', slots: [
      ['GK', 'GK', 50, 90], ['LB', 'LB', 16, 68], ['LCB', 'CB', 39, 73], ['RCB', 'CB', 61, 73], ['RB', 'RB', 84, 68],
      ['LM', 'LM', 18, 45], ['LCM', 'CM', 40, 49], ['RCM', 'CM', 60, 49], ['RM', 'RM', 82, 45], ['LST', 'ST', 40, 18], ['RST', 'ST', 60, 18]
    ].map(([id, position, x, y]) => ({ id, position, x, y }))
  },
  '3-4-2-1': {
    id: '3-4-2-1', label: '3-4-2-1', slots: [
      ['GK', 'GK', 50, 90], ['LCB', 'CB', 28, 70], ['CB', 'CB', 50, 75], ['RCB', 'CB', 72, 70],
      ['LWB', 'LWB', 12, 49], ['LCM', 'CM', 40, 52], ['RCM', 'CM', 60, 52], ['RWB', 'RWB', 88, 49],
      ['LAM', 'AM', 36, 31], ['RAM', 'AM', 64, 31], ['ST', 'ST', 50, 13]
    ].map(([id, position, x, y]) => ({ id, position, x, y }))
  },
  '5-3-2': {
    id: '5-3-2', label: '5-3-2', slots: [
      ['GK', 'GK', 50, 90], ['LWB', 'LWB', 10, 61], ['LCB', 'CB', 31, 70], ['CB', 'CB', 50, 75], ['RCB', 'CB', 69, 70], ['RWB', 'RWB', 90, 61],
      ['LCM', 'CM', 31, 46], ['CM', 'DM', 50, 52], ['RCM', 'CM', 69, 46], ['LST', 'ST', 39, 18], ['RST', 'ST', 61, 18]
    ].map(([id, position, x, y]) => ({ id, position, x, y }))
  }
};

export const DEFAULT_TACTICS = {
  formation: '4-2-3-1',
  mentality: 'balanced',
  tempo: 'normal',
  passing: 'mixed',
  width: 'normal',
  pressing: 'normal',
  defensiveLine: 'normal',
  focus: 'balanced',
  familiarity: 72
};

const FIRST_NAMES = ['Ren', 'Haru', 'Sora', 'Kai', 'Leo', 'Noah', 'Luca', 'Theo', 'Mateo', 'Eli', 'Jun', 'Riku', 'Yuto', 'Kota', 'Finn', 'Milo', 'Ari', 'Nico', 'Iker', 'Toma', 'Rayan', 'Dario', 'Enzo', 'Owen', 'Rui', 'Kenji', 'Akira', 'Shin', 'Marco', 'Luis'];
const LAST_NAMES = ['Aoki', 'Mercer', 'Santos', 'Ishida', 'Bennett', 'Keller', 'Costa', 'Morita', 'Vega', 'Foster', 'Silva', 'Kobayashi', 'Ortega', 'Mori', 'Walsh', 'Conti', 'Nakamura', 'Reed', 'Alvarez', 'Tanaka', 'Rossi', 'Cole', 'Park', 'Navarro', 'Sato', 'Hughes', 'Kim', 'Moretti', 'Ito', 'Blake'];
const POSITION_PLAN = ['GK', 'GK', 'RB', 'LB', 'CB', 'CB', 'CB', 'CB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM', 'RW', 'LW', 'RM', 'LM', 'ST', 'ST', 'ST'];

const SECONDARY = {
  GK: [], RB: ['RWB', 'CB'], LB: ['LWB', 'CB'], CB: ['DM'], DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'LW', 'RW'],
  RW: ['RM', 'LW', 'AM'], LW: ['LM', 'RW', 'AM'], RM: ['RW', 'CM'], LM: ['LW', 'CM'], RWB: ['RB', 'RM'], LWB: ['LB', 'LM'], ST: ['AM']
};

function playerAttributes(position, overall, rng) {
  const noise = () => rng.int(-7, 7);
  const base = {
    attack: overall + noise(),
    defense: overall + noise(),
    passing: overall + noise(),
    pace: overall + noise(),
    physical: overall + noise(),
    keeping: 18 + rng.int(0, 12)
  };
  if (position === 'GK') return { attack: 14 + rng.int(0, 10), defense: overall - 8, passing: overall - 12, pace: overall - 18, physical: overall - 2, keeping: overall + rng.int(-3, 3) };
  if (['CB', 'RB', 'LB', 'RWB', 'LWB', 'DM'].includes(position)) {
    base.defense += 8;
    base.physical += 4;
    base.attack -= 6;
  }
  if (['AM', 'RW', 'LW', 'RM', 'LM'].includes(position)) {
    base.attack += 5;
    base.passing += 5;
    base.pace += 5;
    base.defense -= 8;
  }
  if (position === 'ST') {
    base.attack += 10;
    base.pace += 3;
    base.defense -= 12;
  }
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, clamp(Math.round(value), 1, 99)]));
}

function createPlayer(rng, clubId, position, index, baseOverall, prefix = 'p') {
  const age = rng.int(position === 'GK' ? 20 : 18, position === 'GK' ? 35 : 33);
  const overall = clamp(baseOverall + rng.int(-7, 7), 48, 88);
  const potential = clamp(overall + rng.int(age <= 21 ? 5 : 0, age <= 23 ? 14 : 6), overall, 93);
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  const value = Math.round((overall ** 3) * (potential / 70) * Math.max(0.55, (35 - age) / 16) * 950);
  const wage = Math.round((overall ** 2) * 105 + rng.int(0, 180_000));
  return {
    id: `${prefix}-${clubId}-${index}`,
    clubId,
    name,
    age,
    position,
    secondaryPositions: SECONDARY[position] ?? [],
    overall,
    potential,
    ...playerAttributes(position, overall, rng),
    form: rng.int(58, 78),
    morale: rng.int(62, 84),
    fitness: rng.int(78, 100),
    wage,
    value,
    contractYears: rng.int(1, 5),
    injuryWeeks: 0,
    injuryName: '',
    suspended: false,
    yellowCards: 0,
    listed: false,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    seasonRating: 0,
    scouting: 100
  };
}

export function generateLeague(rng, difficulty = 'normal', userClubId = 'northbridge-fc') {
  const difficultyConfig = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  const clubs = CLUB_TEMPLATES.map((template, index) => {
    const baseCash = 760_000_000 + template.reputation * 6_500_000;
    return {
      ...template,
      cash: Math.round(baseCash * difficultyConfig.budgetMultiplier),
      transferBudget: Math.round((260_000_000 + template.reputation * 3_200_000) * difficultyConfig.budgetMultiplier),
      wageBudget: Math.round(26_000_000 + template.reputation * 240_000),
      boardConfidence: clamp(68 + difficultyConfig.boardTolerance + rng.int(-5, 6), 35, 95),
      fanMood: rng.int(60, 80),
      facilities: {
        training: clamp(1 + Math.floor((template.reputation - 55) / 10), 1, 5),
        academy: template.style === 'youth' ? 4 : clamp(1 + Math.floor((template.reputation - 58) / 12), 1, 5),
        scouting: clamp(1 + Math.floor((template.reputation - 60) / 12), 1, 5),
        stadium: clamp(1 + Math.floor(template.capacity / 10_000), 1, 5)
      },
      objective: index < 2 ? '優勝争い' : index < 5 ? '上位4位' : '残留',
      sponsorWeekly: 7_500_000 + template.reputation * 90_000,
      ticketPrice: 3200 + Math.round(template.reputation * 18),
      trainingFocus: 'balanced',
      tactics: { ...DEFAULT_TACTICS, formation: template.style === 'direct' ? '4-4-2' : template.style === 'counter' ? '5-3-2' : template.style === 'pressing' ? '4-3-3' : '4-2-3-1' }
    };
  });

  const players = [];
  const academy = [];
  for (const club of clubs) {
    const baseOverall = 55 + Math.round(club.reputation * 0.25) + (club.id === userClubId ? 0 : difficultyConfig.opponentBoost);
    POSITION_PLAN.forEach((position, index) => players.push(createPlayer(rng, club.id, position, index + 1, baseOverall)));
    const academyPositions = rng.shuffle(['GK', 'CB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST']);
    for (let index = 0; index < 6; index += 1) {
      const position = academyPositions[index];
      const prospect = createPlayer(rng, club.id, position, index + 1, baseOverall - 15, 'academy');
      prospect.age = rng.int(15, 18);
      prospect.overall = clamp(prospect.overall - rng.int(5, 12), 40, 68);
      prospect.potential = clamp(prospect.overall + rng.int(15, 30) + club.facilities.academy, 67, 94);
      prospect.wage = 0;
      prospect.value = Math.round(prospect.value * 0.25);
      prospect.scouting = rng.int(45, 75);
      academy.push(prospect);
    }
  }
  return { clubs, players, academy };
}

export function generateAcademyIntake(rng, club, count = 2, intakeId = '1') {
  const positions = rng.shuffle(['GK', 'RB', 'LB', 'CB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST']);
  const baseOverall = 43 + Math.round(club.reputation * 0.16) + club.facilities.academy;
  return Array.from({ length: count }, (_, index) => {
    const prospect = createPlayer(rng, club.id, positions[index % positions.length], index + 1, baseOverall, `academy-intake-${intakeId}`);
    prospect.age = rng.int(15, 17);
    prospect.overall = clamp(prospect.overall - rng.int(5, 10), 40, 67);
    prospect.potential = clamp(prospect.overall + rng.int(16, 29) + club.facilities.academy, 68, 95);
    prospect.wage = 0;
    prospect.value = Math.round(prospect.value * 0.22);
    prospect.contractYears = 0;
    prospect.scouting = clamp(42 + club.facilities.scouting * 7 + rng.int(-5, 8), 40, 88);
    return prospect;
  });
}

export function generateTransferMarket(rng, count = 28, week = 1) {
  const positions = ['GK', 'RB', 'LB', 'CB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
  return Array.from({ length: count }, (_, index) => {
    const player = createPlayer(rng, 'market', rng.pick(positions), week * 100 + index + 1, rng.int(58, 79), 'market');
    player.clubId = null;
    player.askingPrice = Math.round(player.value * rng.float(0.9, 1.25));
    player.askingWage = Math.round(player.wage * rng.float(0.9, 1.2));
    player.scouting = rng.int(35, 80);
    return player;
  });
}

export const TRAINING_FOCUSES = {
  balanced: { label: 'バランス', description: '全体を無理なく底上げ' },
  attacking: { label: '攻撃', description: '決定力・創造性を強化' },
  defending: { label: '守備', description: '守備組織・対人を強化' },
  fitness: { label: 'フィジカル', description: '体力回復と走力を強化' },
  recovery: { label: 'リカバリー', description: '疲労と負傷リスクを軽減' },
  youth: { label: '若手育成', description: '23歳以下とアカデミーを優先' }
};
