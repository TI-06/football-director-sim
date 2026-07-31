import { characterArt } from './characters-v2.js';
import { createLivePitchModel } from './live-match-visual-v2.js';
import { clubBadge, escapeHtml, icon } from './templates.js';

const TACTIC_OPTIONS = Object.freeze({
  formation: { '4-3-3': '4-3-3', '4-2-3-1': '4-2-3-1', '4-4-2': '4-4-2', '3-4-2-1': '3-4-2-1', '5-3-2': '5-3-2' },
  mentality: { defensive: '守備的', cautious: '慎重', balanced: 'バランス', positive: '前向き', attacking: '攻撃的' },
  pressing: { low: '低い', normal: '標準', high: '高い', 'very-high': '非常に高い' },
  tempo: { slow: '遅い', normal: '標準', fast: '速い' },
  passing: { short: 'ショート', mixed: '混合', direct: 'ダイレクト' },
  defensiveLine: { deep: '低い', normal: '標準', high: '高い' },
  focus: { left: '左', balanced: '中央', right: '右', middle: '中央突破' },
  width: { narrow: '狭い', normal: '標準', wide: '広い' }
});

const TACTIC_LABELS = Object.freeze({
  formation: '配置', mentality: '姿勢', pressing: 'プレス', tempo: 'テンポ', passing: 'パス', defensiveLine: '最終ライン', focus: '攻撃重点', width: '幅'
});

function liveSelect(key, current) {
  const options = TACTIC_OPTIONS[key] ?? {};
  return `<label class="fd2-live-control"><span>${TACTIC_LABELS[key] ?? key}</span><select data-live-tactic="${key}">${Object.entries(options).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`;
}

function tokenMarkup(token) {
  const classes = [
    'fd2-player-token',
    `fd2-player-token--${token.side}`,
    token.goalkeeper ? 'is-goalkeeper' : '',
    token.involved ? 'is-involved' : '',
    token.booked ? 'is-booked' : '',
    token.injured ? 'is-injured' : ''
  ].filter(Boolean).join(' ');
  return `<button class="${classes}" type="button" data-live-player-token data-player-id="${escapeHtml(token.id)}" data-player-name="${escapeHtml(token.name)}" data-player-position="${escapeHtml(token.position)}" data-player-number="${token.number}" data-player-fitness="${token.fitness}" data-player-rating="${token.rating}" data-player-booked="${token.booked}" data-player-injured="${token.injured}" aria-label="${escapeHtml(token.name)} 背番号${token.number} 体力${token.fitness}% 評価${token.rating}" style="--fd2-from-x:${token.baseX}%;--fd2-from-y:${token.baseY}%;--fd2-to-x:${token.toX}%;--fd2-to-y:${token.toY}%"><span>${token.number}</span>${token.booked ? '<i aria-label="警告">■</i>' : ''}${token.injured ? '<em aria-label="負傷">＋</em>' : ''}</button>`;
}

function selectedPlayerPanel(player) {
  if (!player) return '<div class="fd2-selected-player" data-selected-live-player><strong>選手をタップ</strong><span>背番号をタップすると詳細を確認できます。</span></div>';
  return `<div class="fd2-selected-player" data-selected-live-player><div><b>${player.number}</b><span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.position)}</small></span></div><dl><div><dt>体力</dt><dd>${player.fitness}%</dd></div><div><dt>評価</dt><dd>${player.rating}</dd></div><div><dt>状態</dt><dd>${player.injured ? '負傷' : player.booked ? '警告' : '通常'}</dd></div></dl></div>`;
}

function eventIcon(type) {
  if (type === 'goal') return '⚽';
  if (type === 'card') return '■';
  if (type === 'injury') return '＋';
  if (type === 'save') return '◆';
  if (type === 'substitution') return '⇄';
  if (type === 'half' || type === 'full') return '⏱';
  return '·';
}

export function renderLiveMatchCenterV2(state, session) {
  const home = session.sides.home.club;
  const away = session.sides.away.club;
  const user = session.sides[session.userSide];
  const players = new Map(user.players.map((player) => [player.id, player]));
  const model = createLivePitchModel(session);
  const duration = session.totals.duration || 1;
  const homePossession = Math.round(session.totals.possessionWeighted.home / duration) || 50;
  const phases = [45, 60, 75, 90];
  const nextMinute = phases[session.phaseIndex] ?? 90;
  const lineupOptions = user.lineup.map((entry) => {
    const player = players.get(entry.playerId);
    return `<option value="${entry.playerId}">${escapeHtml(player?.name ?? '不明')} · ${entry.slotPosition} · 体力${Math.round(session.liveFitness[entry.playerId] ?? 0)} · 評価${Number(session.liveRatings[entry.playerId] ?? 6.5).toFixed(1)}</option>`;
  }).join('');
  const benchOptions = user.bench.map((playerId) => players.get(playerId)).filter(Boolean).map((player) => `<option value="${player.id}">${escapeHtml(player.name)} · ${player.position} · OVR ${player.overall} · 体力${Math.round(session.liveFitness[player.id] ?? player.fitness)}</option>`).join('');
  const recentEvents = (session.events ?? []).slice(-12).reverse();
  const tactics = user.tactics;
  const finished = session.completed;
  return `<div class="modal-backdrop fd2-live-backdrop"><section class="fd2-live" data-live-match role="dialog" aria-modal="true" aria-label="ライブ試合センター">
    <header class="fd2-live__header">
      <div class="fd2-live__clock"><span>${finished ? 'FULL TIME' : 'LIVE'}</span><strong>${session.minute}'</strong><small>${finished ? '試合終了' : `${nextMinute}分まで`}</small></div>
      <div class="fd2-live__score"><div>${clubBadge(home, 'sm')}<span>${escapeHtml(home.shortName || home.name)}</span></div><p><b>${session.score.home}</b><i>–</i><b>${session.score.away}</b></p><div>${clubBadge(away, 'sm')}<span>${escapeHtml(away.shortName || away.name)}</span></div></div>
      <div class="fd2-live__stats"><span>支配率 <b>${homePossession}-${100 - homePossession}</b></span><span>シュート <b>${session.totals.homeShots}-${session.totals.awayShots}</b></span><span>xG <b>${session.totals.homeXg.toFixed(2)}-${session.totals.awayXg.toFixed(2)}</b></span></div>
    </header>
    <div class="fd2-live__body">
      <main class="fd2-live__stage">
        <div class="fd2-vertical-pitch" aria-label="縦型2Dフルコート">
          <span class="fd2-pitch-line fd2-pitch-line--half"></span><span class="fd2-pitch-circle"></span><span class="fd2-pitch-box fd2-pitch-box--top"></span><span class="fd2-pitch-box fd2-pitch-box--bottom"></span>
          ${model.tokens.map(tokenMarkup).join('')}
          <span class="fd2-ball ${model.event ? 'is-moving' : ''}" style="--fd2-ball-x:${model.ball.x}%;--fd2-ball-y:${model.ball.y}%" aria-label="ボール"></span>
        </div>
        ${selectedPlayerPanel(model.focus)}
        <section class="fd2-commentary"><header><strong>実況</strong><span>${escapeHtml(model.event?.text ?? '試合が進行しています')}</span></header><ol>${recentEvents.length ? recentEvents.map((event) => `<li class="fd2-event fd2-event--${escapeHtml(event.type)}"><b>${event.minute}'</b><i>${eventIcon(event.type)}</i><span>${escapeHtml(event.text)}</span></li>`).join('') : '<li><span>キックオフを待っています。</span></li>'}</ol></section>
      </main>
      <aside class="fd2-live__decision">
        <div class="fd2-assistant-callout">${characterArt('mina', { compact: true })}<div><strong>ミナの提案</strong><span>${finished ? '試合結果を確定できます。' : session.minute >= 75 ? '終盤です。攻守の優先順位を決めましょう。' : session.minute >= 60 ? '疲労と評価を見て交代を検討できます。' : session.minute >= 45 ? '前半の内容を踏まえて戦術を調整できます。' : '基本は自動進行です。重要局面だけ判断できます。'}</span></div></div>
        <details class="fd2-live-details" ${finished ? '' : 'open'}><summary>戦術調整</summary><div class="fd2-live-controls">${Object.keys(TACTIC_OPTIONS).map((key) => liveSelect(key, tactics[key])).join('')}</div></details>
        <details class="fd2-live-details"><summary>選手交代 ${user.substitutionsUsed}/5</summary><div class="fd2-substitution"><label><span>交代する選手</span><select data-live-player-out>${lineupOptions}</select></label><label><span>投入する選手</span><select data-live-player-in>${benchOptions}</select></label><button type="button" data-command="live-substitute" ${finished || user.substitutionsUsed >= 5 || !benchOptions ? 'disabled' : ''}>${icon('transfer', 17)} 交代を実行</button></div></details>
        <div class="fd2-live-actions">
          ${finished ? `<button class="fd2-live-primary" type="button" data-command="live-finish">結果を確定</button>` : `<button type="button" data-command="live-skip">結果まで</button><button class="fd2-live-primary" type="button" data-command="live-advance">次の判断まで</button>`}
        </div>
      </aside>
    </div>
  </section></div>`;
}
