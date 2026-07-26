import { deepClone, clamp } from '../core/utils.js';

const EVENT_TEMPLATES = [
  {
    key: 'sponsor-activation',
    title: 'スポンサーから追加施策の提案',
    category: '経営',
    body: '地域イベントへの選手派遣を条件に、今週の追加協賛金が提示されています。選手の休養時間は減ります。',
    choices: [
      { id: 'accept', label: '参加する', description: '資金 +1,500万円 / 主力の疲労 +3', effects: { cash: 15_000_000, fitness: -3, fanMood: 3 } },
      { id: 'decline', label: '断る', description: 'コンディションを優先 / ファン評価 -1', effects: { fanMood: -1 } }
    ]
  },
  {
    key: 'player-unrest',
    title: '控え選手から出場機会の要求',
    category: '選手',
    body: '出場時間が少ない選手が面談を求めています。約束は士気に影響します。',
    choices: [
      { id: 'promise', label: '次戦の起用を約束', description: 'チーム士気 +3 / 取締役会の信頼 -1', effects: { morale: 3, boardConfidence: -1 } },
      { id: 'merit', label: '競争を求める', description: '士気 -2 / 戦術理解 +2', effects: { morale: -2, familiarity: 2 } }
    ]
  },
  {
    key: 'press-conference',
    title: '記者会見：今季の目標',
    category: 'メディア',
    body: '記者から順位目標を問われています。強気な発言はファンを沸かせますが、取締役会の期待も高まります。',
    choices: [
      { id: 'bold', label: '優勝を目指す', description: 'ファン評価 +5 / 取締役会の要求上昇', effects: { fanMood: 5, boardConfidence: -2 } },
      { id: 'steady', label: '一戦ずつ戦う', description: '取締役会の信頼 +2', effects: { boardConfidence: 2 } }
    ]
  },
  {
    key: 'academy-breakthrough',
    title: 'アカデミーで急成長の兆し',
    category: '育成',
    body: '育成スタッフが、有望株への個別プログラムを提案しています。短期的な費用と引き換えに成長を後押しできます。',
    choices: [
      { id: 'invest', label: '個別育成へ投資', description: '費用 -800万円 / 有望株の能力向上', effects: { cash: -8_000_000, academyBoost: 2 } },
      { id: 'standard', label: '通常プログラムを継続', description: '変化なし', effects: {} }
    ]
  },
  {
    key: 'recovery-day',
    title: 'メディカル部門から休養日の提案',
    category: '医療',
    body: '連戦による疲労が蓄積しています。全体休養に切り替えるか、予定どおり強度を保つか判断してください。',
    choices: [
      { id: 'rest', label: '全体休養', description: '体力 +6 / 戦術理解 -1', effects: { fitness: 6, familiarity: -1 } },
      { id: 'train', label: '予定どおり実施', description: '戦術理解 +2 / 体力 -2', effects: { familiarity: 2, fitness: -2 } }
    ]
  }
];

export function generateWeeklyEvent(state, rng) {
  const next = deepClone(state);
  const unresolved = next.inbox.some((item) => item.kind === 'decision' && !item.resolved);
  if (unresolved || !rng.chance(0.4)) return next;
  const template = rng.pick(EVENT_TEMPLATES);
  const id = `event-${next.season ?? 1}-${next.week}-${template.key}-${next.inbox.length}`;
  next.inbox.unshift({ ...deepClone(template), id, kind: 'decision', week: next.week, resolved: false, selectedChoiceId: null, createdAt: Date.now() });
  return next;
}

function applyEffects(state, effects, rng) {
  const club = state.clubs.find((item) => item.id === state.userClubId);
  const players = state.players.filter((player) => player.clubId === state.userClubId);
  if (effects.cash) club.cash += effects.cash;
  if (effects.fanMood) club.fanMood = clamp(club.fanMood + effects.fanMood, 0, 100);
  if (effects.boardConfidence) club.boardConfidence = clamp(club.boardConfidence + effects.boardConfidence, 0, 100);
  if (effects.morale) players.forEach((player) => { player.morale = clamp(player.morale + effects.morale, 0, 100); });
  if (effects.fitness) players.forEach((player) => { player.fitness = clamp(player.fitness + effects.fitness, 10, 100); });
  if (effects.familiarity) state.tactics.familiarity = clamp(state.tactics.familiarity + effects.familiarity, 20, 100);
  if (effects.academyBoost) {
    const prospects = state.academy.filter((player) => player.clubId === state.userClubId);
    const target = rng.pick(prospects);
    if (target) {
      target.overall = clamp(target.overall + effects.academyBoost, 1, target.potential);
      target.potential = clamp(target.potential + 1, target.overall, 95);
    }
  }
}

export function resolveEvent(state, eventId, choiceId) {
  const next = deepClone(state);
  const event = next.inbox.find((item) => item.id === eventId);
  if (!event) return { ok: false, state, message: 'イベントが見つかりません。' };
  if (event.resolved) return { ok: false, state, message: 'このイベントは解決済みです。' };
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, state, message: '選択肢が見つかりません。' };
  const club = next.clubs.find((item) => item.id === next.userClubId);
  const cashEffect = choice.effects?.cash ?? 0;
  if (cashEffect < 0 && club.cash + cashEffect < 0) return { ok: false, state, message: 'この判断に必要な資金が不足しています。' };
  applyEffects(next, choice.effects ?? {}, { pick: (items) => items[Math.abs(event.id.length) % items.length] });
  event.resolved = true;
  event.selectedChoiceId = choiceId;
  event.resolvedAt = Date.now();
  next.history.events.unshift({ eventId, choiceId, title: event.title, week: next.week });
  return { ok: true, state: next, message: `${event.title}を処理しました。` };
}
