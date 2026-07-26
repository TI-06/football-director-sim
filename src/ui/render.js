import { CLUB_TEMPLATES, DIFFICULTIES, FORMATIONS, TRAINING_FOCUSES } from '../data/catalog.js';
import { getWeekFixtures } from '../game/fixtures.js';
import { playerSlotScore } from '../game/squad.js';
import { clubWeeklyWages, facilityUpgradeCost } from '../game/economy.js';
import { marketEstimate } from '../game/transfers.js';
import { average, formatMoney } from '../core/utils.js';
import { clubBadge, emptyState, escapeHtml, formDots, icon, metricCard, money, progressBar } from './templates.js';

export const NAV_ITEMS = [
  ['dashboard', 'ダッシュボード', 'dashboard'],
  ['squad', 'スカッド', 'squad'],
  ['tactics', '戦術・トレーニング', 'tactics'],
  ['schedule', '日程・順位表', 'calendar'],
  ['transfers', '移籍市場', 'transfer'],
  ['academy', 'アカデミー', 'academy'],
  ['club', 'クラブ経営', 'club'],
  ['inbox', '受信トレイ', 'inbox']
];

const PAGE_META = {
  dashboard: ['ダッシュボード', '今週の判断材料とクラブ状況を確認します。'],
  squad: ['スカッド', '先発・控え・役割を管理します。'],
  tactics: ['戦術・トレーニング', 'プレーモデルと週間育成方針を設定します。'],
  schedule: ['日程・順位表', 'リーグ全体の結果と今後の対戦を確認します。'],
  transfers: ['移籍市場', 'スカウト情報、移籍金、給与予算を見ながら補強します。'],
  academy: ['ユースアカデミー', '将来の主力候補を育成し、トップチームへ昇格させます。'],
  club: ['クラブ経営', '財務、施設、取締役会、サポーター状況を管理します。'],
  inbox: ['受信トレイ', '選手、スタッフ、取締役会から届いた判断事項を処理します。']
};

function clubById(state, id) {
  return state.clubs.find((club) => club.id === id);
}

function userClub(state) {
  return clubById(state, state.userClubId);
}

function userPlayers(state) {
  return state.players.filter((player) => player.clubId === state.userClubId);
}

function currentPosition(state) {
  return state.standings.findIndex((row) => row.teamId === state.userClubId) + 1;
}

function resultForReport(report, clubId) {
  const isHome = report.homeClubId === clubId;
  const goals = isHome ? report.homeGoals : report.awayGoals;
  const conceded = isHome ? report.awayGoals : report.homeGoals;
  return goals > conceded ? 'W' : goals === conceded ? 'D' : 'L';
}

function nextFixture(state) {
  if (state.seasonStatus !== 'active') return null;
  return getWeekFixtures(state.fixtures, state.week).find((fixture) => [fixture.homeId, fixture.awayId].includes(state.userClubId)) ?? null;
}

function overallSquadMetrics(state) {
  const players = userPlayers(state);
  return {
    morale: Math.round(average(players.map((player) => player.morale))),
    fitness: Math.round(average(players.map((player) => player.fitness))),
    overall: Math.round(average(players.map((player) => player.overall))),
    injuries: players.filter((player) => player.injuryWeeks > 0).length
  };
}

function navHtml(state, currentView, mobile = false) {
  const unresolved = state.inbox.filter((item) => item.kind === 'decision' && !item.resolved).length;
  return `<nav class="${mobile ? 'mobile-nav' : 'nav'}" aria-label="メインメニュー">
    ${NAV_ITEMS.map(([id, label, iconName]) => `<button class="nav__item ${currentView === id ? 'is-active' : ''}" type="button" data-nav="${id}" aria-current="${currentView === id ? 'page' : 'false'}">
      ${icon(iconName, mobile ? 18 : 19)}<span>${escapeHtml(label)}</span>${id === 'inbox' && unresolved ? `<b class="nav__badge">${unresolved}</b>` : ''}
    </button>`).join('')}
  </nav>`;
}

export function renderNewGame() {
  return `<main class="new-game">
    <div class="new-game__shell">
      <section class="new-game__intro">
        <span class="eyebrow">${icon('trophy', 17)} Football management simulation</span>
        <h1>FOOTBALL <span>DIRECTOR</span></h1>
        <p class="new-game__lead">戦術だけでは勝てない。選手の疲労、移籍予算、若手の成長、取締役会の期待まで判断し、14試合のシーズンを戦い抜くクラブ経営シミュレーションです。</p>
        <ul class="feature-list">
          <li>${icon('tactics')} 5つのフォーメーションと戦術相性</li>
          <li>${icon('transfer')} スカウト精度つき移籍市場</li>
          <li>${icon('academy')} ユース育成と施設投資</li>
          <li>${icon('pulse')} xG・実況・負傷を含む試合エンジン</li>
        </ul>
        <p class="research-note">実在クラブ・選手・画像は使用していません。ゲームデータはすべてシードから生成され、ブラウザ内に保存されます。</p>
      </section>
      <form id="new-game-form" class="new-game__form">
        <section class="form-section">
          <div class="form-section__title"><h2>監督プロフィール</h2><span>STEP 01</span></div>
          <div class="field-grid">
            <label class="field"><span>監督名</span><input name="managerName" value="Tak Manager" maxlength="32" required autocomplete="off"></label>
            <label class="field"><span>クラブ表示名</span><input name="clubName" value="Northbridge FC" maxlength="32" required autocomplete="off"></label>
          </div>
        </section>
        <section class="form-section">
          <div class="form-section__title"><h2>クラブを選択</h2><span>STEP 02</span></div>
          <div class="club-picker">
            ${CLUB_TEMPLATES.map((club, index) => `<label class="club-option">
              <input type="radio" name="clubId" value="${club.id}" ${index === 0 ? 'checked' : ''}>
              <span class="club-option__body">${clubBadge(club, 'md')}<span><span class="club-option__name">${escapeHtml(club.name)}</span><span class="club-option__meta">評判 ${club.reputation} / ${escapeHtml(club.style)}<br>${escapeHtml(club.stadium)} · ${club.capacity.toLocaleString('ja-JP')}席</span></span></span>
            </label>`).join('')}
          </div>
        </section>
        <section class="form-section">
          <div class="form-section__title"><h2>ゲーム設定</h2><span>STEP 03</span></div>
          <div class="difficulty-picker">
            ${Object.values(DIFFICULTIES).map((difficulty) => `<label class="difficulty-option"><input type="radio" name="difficulty" value="${difficulty.id}" ${difficulty.id === 'normal' ? 'checked' : ''}><span><strong>${escapeHtml(difficulty.label)}</strong><small>${difficulty.id === 'casual' ? '資金に余裕。取締役会も寛容。' : difficulty.id === 'hard' ? '少ない予算と強い対戦相手。' : '標準的な経営バランス。'}</small></span></label>`).join('')}
          </div>
          <label class="field" style="margin-top:14px"><span>ワールドシード</span><input name="seed" value="director-2026" maxlength="48" required><small>同じシードなら同じ初期選手・日程になります。</small></label>
        </section>
        <button class="btn btn--primary btn--wide" type="submit">${icon('play')} キャリアを開始</button>
      </form>
    </div>
  </main>`;
}

function autoAdvanceControl(state, uiState = {}, compact = false) {
  if (state.seasonStatus !== 'active') return '';
  const active = Boolean(uiState.autoAdvanceActive);
  return `<button class="btn ${active ? 'btn--danger' : compact ? 'btn--secondary' : 'btn--ghost'} ${compact ? 'btn--sm' : ''}" type="button" data-command="toggle-auto-advance" aria-pressed="${active}">${icon(active ? 'pause' : 'play', compact ? 15 : 17)}<span>${active ? '自動進行を停止' : '自動進行'}</span></button>`;
}

function appShell(state, currentView, content, uiState = {}) {
  const club = userClub(state);
  const [title] = PAGE_META[currentView] ?? PAGE_META.dashboard;
  const autoMessage = uiState.autoAdvanceMessage
    ? `<div class="auto-advance-status ${uiState.autoAdvanceActive ? 'is-active' : ''}" role="status">${icon('pulse', 14)}<span>${escapeHtml(uiState.autoAdvanceMessage)}</span></div>`
    : '';
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar__brand"><span class="sidebar__brand-mark">FD</span><div><strong>Football Director</strong><small>CAREER MODE</small></div></div>
      <div class="sidebar__club">${clubBadge(club, 'sm')}<div><strong>${escapeHtml(club.name)}</strong><span>${escapeHtml(state.managerName)}監督</span></div></div>
      ${navHtml(state, currentView)}
      <div class="sidebar__footer">
        <button class="sidebar__utility" type="button" data-command="export-save">${icon('download', 17)}<span>セーブを書き出す</span></button>
        <button class="sidebar__utility" type="button" data-command="import-save">${icon('upload', 17)}<span>セーブを読み込む</span></button>
        <button class="sidebar__utility" type="button" data-command="reset-game">${icon('reset', 17)}<span>キャリアをリセット</span></button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar__context"><small>SEASON ${state.season} · WEEK ${Math.min(state.week, 14)}</small><h1>${escapeHtml(title)}</h1>${autoMessage}</div>
        <div class="topbar__actions">
          <div class="date-chip">${icon('calendar', 16)} ${escapeHtml(state.currentDate)}</div>
          ${autoAdvanceControl(state, uiState)}
          <button class="btn btn--primary" type="button" data-command="${state.seasonStatus === 'active' ? 'play-week' : 'start-next-season'}" ${uiState.autoAdvanceActive ? 'disabled' : ''}>${icon(state.seasonStatus === 'active' ? 'play' : 'trophy', 17)}<span>${state.seasonStatus === 'active' ? '次の試合へ' : '次シーズンを開始'}</span></button>
        </div>
      </header>
      <main class="content">${content}</main>
      ${navHtml(state, currentView, true)}
    </div>
  </div>`;
}

function pageHeader(view, action = '') {
  const [title, description] = PAGE_META[view];
  return `<div class="page-header"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${action ? `<div class="page-header__actions">${action}</div>` : ''}</div>`;
}

function renderDashboard(state, uiState = {}) {
  const club = userClub(state);
  const metrics = overallSquadMetrics(state);
  const position = currentPosition(state);
  const fixture = nextFixture(state);
  const recentUserReports = state.matchReports.filter((report) => [report.homeClubId, report.awayClubId].includes(state.userClubId)).slice(0, 5);
  const form = recentUserReports.map((report) => resultForReport(report, state.userClubId)).reverse();
  const unresolved = state.inbox.filter((item) => item.kind === 'decision' && !item.resolved).slice(0, 3);
  const alerts = [
    ...userPlayers(state).filter((player) => player.injuryWeeks > 0).map((player) => ({ title: `${player.name}が負傷中`, detail: `${player.injuryName} · あと${player.injuryWeeks}週`, view: 'squad', tone: 'danger' })),
    ...userPlayers(state).filter((player) => player.fitness < 52 && player.injuryWeeks <= 0).slice(0, 3).map((player) => ({ title: `${player.name}の疲労が高い`, detail: `コンディション ${player.fitness}`, view: 'tactics', tone: 'warning' })),
    ...userPlayers(state).filter((player) => player.contractYears <= 1).slice(0, 2).map((player) => ({ title: `${player.name}の契約が残り1年`, detail: '契約方針の検討が必要', view: 'squad', tone: 'warning' }))
  ].slice(0, 5);

  let matchCard = `<article class="card season-complete"><div class="card__body">${emptyState('シーズン終了', '最終順位とクラブ経営結果を確認し、準備ができたら次シーズンへ進めます。', 'trophy')}<button class="btn btn--primary btn--wide" type="button" data-command="start-next-season">${icon('trophy', 17)} 次シーズンを開始</button></div></article>`;
  if (fixture) {
    const home = clubById(state, fixture.homeId);
    const away = clubById(state, fixture.awayId);
    const opponent = home.id === state.userClubId ? away : home;
    const opponentPlayers = state.players.filter((player) => player.clubId === opponent.id);
    const opponentOverall = Math.round(average(opponentPlayers.map((player) => player.overall)));
    matchCard = `<article class="card next-match">
      <div class="next-match__top"><span>LEAGUE · MATCHWEEK ${fixture.week}</span><span>${home.id === state.userClubId ? 'HOME' : 'AWAY'} · ${escapeHtml(home.id === state.userClubId ? club.stadium : opponent.stadium)}</span></div>
      <div class="next-match__teams">
        <div class="next-team">${clubBadge(home, 'lg')}<strong>${escapeHtml(home.name)}</strong></div>
        <span class="versus">VS</span>
        <div class="next-team">${clubBadge(away, 'lg')}<strong>${escapeHtml(away.name)}</strong></div>
      </div>
      <div class="next-match__footer">
        <div class="opponent-scout"><div>相手平均OVR<strong>${opponentOverall}</strong></div><div>基本戦術<strong>${escapeHtml(opponent.tactics.formation)} / ${escapeHtml(opponent.style)}</strong></div><div>自軍フォーム<strong>${formDots(form)}</strong></div></div>
        <div class="next-match__actions">${autoAdvanceControl(state, uiState, true)}<button class="btn btn--primary" type="button" data-command="play-week" ${uiState.autoAdvanceActive ? 'disabled' : ''}>${icon('play', 17)} 試合を開始</button></div>
      </div>
    </article>`;
  }

  const miniRows = state.standings.slice(0, 6).map((row, index) => {
    const rowClub = clubById(state, row.teamId);
    return `<tr class="${row.teamId === state.userClubId ? 'is-user' : ''}"><td>${index + 1}</td><td><span class="team-cell">${clubBadge(rowClub, 'sm')}<span>${escapeHtml(rowClub.name)}</span></span></td><td>${row.played}</td><td>${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('');

  return `${pageHeader('dashboard')}
    <section class="metrics-grid">
      ${metricCard('リーグ順位', `${position}位`, `勝点 ${state.standings.find((row) => row.teamId === state.userClubId)?.points ?? 0}`, 'trophy')}
      ${metricCard('クラブ資金', money(club.cash), `移籍予算 ${money(club.transferBudget)}`, 'money')}
      ${metricCard('取締役会の信頼', `${club.boardConfidence}%`, club.objective, 'pulse', club.boardConfidence < 45 ? 'danger' : '')}
      ${metricCard('チーム状態', `${metrics.morale} / ${metrics.fitness}`, `士気 / 体力 · 負傷 ${metrics.injuries}人`, 'squad', metrics.injuries >= 3 ? 'warning' : '')}
    </section>
    <section class="grid-2" style="margin-top:14px">
      ${matchCard}
      <article class="card"><div class="card__header"><div><h3>順位表</h3><p>上位6クラブ</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="schedule">全体を見る</button></div><div class="card__body"><table class="mini-table"><thead><tr><th>#</th><th>クラブ</th><th>試</th><th>差</th><th>勝点</th></tr></thead><tbody>${miniRows}</tbody></table></div></article>
    </section>
    <section class="grid-equal" style="margin-top:14px">
      <article class="card"><div class="card__header"><div><h3>優先受信トレイ</h3><p>未処理の判断事項</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="inbox">すべて見る</button></div><div class="card__body">${unresolved.length ? `<div class="alert-list">${unresolved.map((item) => `<div class="alert-item"><span class="alert-item__icon">${icon('inbox', 16)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · WEEK ${item.week}</span></div><button type="button" data-nav="inbox">${icon('chevron', 16)}</button></div>`).join('')}</div>` : emptyState('未処理事項はありません', '次の試合へ進むと新しい連絡が届くことがあります。')}</div></article>
      <article class="card"><div class="card__header"><div><h3>スカッドアラート</h3><p>起用前に確認したい状態</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="squad">スカッドへ</button></div><div class="card__body">${alerts.length ? `<div class="alert-list">${alerts.map((item) => `<div class="alert-item"><span class="alert-item__icon">${icon('warning', 16)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><button type="button" data-nav="${item.view}">${icon('chevron', 16)}</button></div>`).join('')}</div>` : emptyState('大きな問題はありません', '先発候補のコンディションは整っています。', 'squad')}</div></article>
    </section>`;
}

function roleBadges(state, playerId) {
  const badges = [];
  if (state.lineup.captainId === playerId) badges.push('<span class="role-badge role-badge--captain" title="キャプテン">C</span>');
  if (state.lineup.penaltyTakerId === playerId) badges.push('<span class="role-badge role-badge--penalty" title="PKキッカー">PK</span>');
  return badges.join('');
}

function lineupPitch(state) {
  const players = userPlayers(state);
  const captain = players.find((player) => player.id === state.lineup.captainId);
  const penaltyTaker = players.find((player) => player.id === state.lineup.penaltyTakerId);
  return `<div class="card"><div class="card__header"><div><h3>先発フォーメーション</h3><p>${escapeHtml(state.tactics.formation)} · 選手カードをドラッグして配置変更</p></div><button class="btn btn--secondary btn--sm" type="button" data-action="auto-lineup">自動編成</button></div>
    <div class="card__body"><div class="pitch"><span class="pitch-box pitch-box--top"></span><span class="pitch-box pitch-box--bottom"></span>
      ${state.lineup.starters.map((entry) => {
        const selected = players.find((player) => player.id === entry.playerId);
        const candidates = players
          .filter((player) => player.injuryWeeks <= 0 && !player.suspended)
          .sort((a, b) => playerSlotScore(b, entry.slotPosition) - playerSlotScore(a, entry.slotPosition));
        return `<div class="pitch-slot" style="left:${entry.x}%;top:${entry.y}%" data-drop-slot="${entry.slotId}" data-slot-position="${entry.slotPosition}"><div class="pitch-player" draggable="true" data-drag-player="${selected?.id ?? ''}" data-source-slot="${entry.slotId}" tabindex="0" aria-label="${escapeHtml(selected?.name ?? '未設定')}をドラッグ"><div class="pitch-player__top"><span class="pitch-player__pos">${entry.slotPosition}</span><span class="pitch-player__roles">${roleBadges(state, entry.playerId)}</span><span class="pitch-player__rating">${selected?.overall ?? '–'}</span></div><strong class="pitch-player__name">${escapeHtml(selected?.name ?? '未設定')}</strong><select class="pitch-player__select" aria-label="${entry.slotPosition}の選手" data-lineup-slot="${entry.slotId}">${candidates.map((player) => `<option value="${player.id}" ${player.id === entry.playerId ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></div></div>`;
      }).join('')}
    </div></div>
    <div class="role-summary"><div class="role-summary__item"><span class="role-badge role-badge--captain">C</span><span>キャプテン<strong>${escapeHtml(captain?.name ?? '未設定')}</strong><small>${captain ? `${captain.position} · OVR ${captain.overall}` : '先発から選択'}</small></span></div><div class="role-summary__item"><span class="role-badge role-badge--penalty">PK</span><span>PKキッカー<strong>${escapeHtml(penaltyTaker?.name ?? '未設定')}</strong><small>${penaltyTaker ? `${penaltyTaker.position} · OVR ${penaltyTaker.overall}` : '先発から選択'}</small></span></div><div class="role-summary__item"><span class="role-summary__count">${state.lineup.bench.length}</span><span>控え登録<strong>${state.lineup.bench.length}名</strong><small>表からドラッグ可能</small></span></div></div>
  </div>`;
}

function playerTable(state) {
  const players = [...userPlayers(state)].sort((a, b) => a.position.localeCompare(b.position) || b.overall - a.overall);
  const starterIds = new Set(state.lineup.starters.map((entry) => entry.playerId));
  const benchIds = new Set(state.lineup.bench);
  const positions = [...new Set(players.map((player) => player.position))].sort();
  return `<article class="card"><div class="card__header"><div><h3>トップチーム</h3><p>${players.length}名 · 先発11名 / 控え${state.lineup.bench.length}名</p></div></div>
    <div class="squad-controls" aria-label="選手一覧の並べ替えと絞り込み">
      <label><span>並び順</span><select class="control-select" data-squad-sort><option value="role">起用状況</option><option value="position">ポジション</option><option value="overall">総合値 OVR</option><option value="potential">ポテンシャル</option><option value="fitness">体力</option><option value="morale">士気</option><option value="age">年齢</option><option value="wage">給与</option><option value="name">名前</option></select></label>
      <label><span>方向</span><select class="control-select" data-squad-order><option value="desc">高い順 / 優先順</option><option value="asc">低い順 / 逆順</option></select></label>
      <label><span>起用</span><select class="control-select" data-squad-role-filter><option value="">すべて</option><option value="starter">先発</option><option value="bench">控え</option><option value="outside">登録外</option></select></label>
      <label><span>ポジション</span><select class="control-select" data-squad-position-filter><option value="">すべて</option>${positions.map((position) => `<option value="${position}">${position}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th aria-label="ドラッグ"></th><th>選手</th><th>役割</th><th>OVR</th><th>POT</th><th>状態</th><th>体力</th><th>士気</th><th>給与</th><th>契約</th><th>操作</th></tr></thead><tbody data-squad-table-body>
    ${players.map((player) => {
      const roleKey = starterIds.has(player.id) ? 'starter' : benchIds.has(player.id) ? 'bench' : 'outside';
      const role = roleKey === 'starter' ? '先発' : roleKey === 'bench' ? '控え' : '登録外';
      const roleRank = roleKey === 'starter' ? 3 : roleKey === 'bench' ? 2 : 1;
      const available = player.injuryWeeks <= 0 && !player.suspended;
      const isCaptain = state.lineup.captainId === player.id;
      const isPenalty = state.lineup.penaltyTakerId === player.id;
      const status = player.injuryWeeks > 0 ? `<span class="status-tag status-tag--injured">負傷 ${player.injuryWeeks}週</span>` : player.suspended ? '<span class="status-tag status-tag--injured">出場停止</span>' : player.listed ? '<span class="status-tag status-tag--listed">売却候補</span>' : '<span class="status-tag">起用可</span>';
      return `<tr data-squad-player="${player.id}" data-drag-player="${player.id}" draggable="${available}" data-name="${escapeHtml(player.name.toLowerCase())}" data-position="${player.position}" data-role="${roleKey}" data-role-rank="${roleRank}" data-overall="${player.overall}" data-potential="${player.potential}" data-fitness="${player.fitness}" data-morale="${player.morale}" data-age="${player.age}" data-wage="${player.wage}" class="${available ? 'is-draggable' : 'is-unavailable'}"><td><span class="drag-handle" title="フォーメーションへドラッグ" aria-hidden="true">⋮⋮</span></td><td><span class="player-name"><span class="player-avatar">${escapeHtml(player.name.split(' ').map((part) => part[0]).join('').slice(0,2))}</span><span><strong>${escapeHtml(player.name)}</strong><span>${player.age}歳 · ${player.appearances}試合 ${player.goals}得点</span></span></span></td><td><span class="position-tag">${player.position}</span> <span class="selection-role">${role}</span>${roleBadges(state, player.id)}</td><td><span class="rating-number">${player.overall}</span></td><td>${player.potential}</td><td>${status}</td><td>${player.fitness}${progressBar(player.fitness, '体力', player.fitness < 50 ? 'danger' : player.fitness < 70 ? 'warning' : 'accent')}</td><td>${player.morale}${progressBar(player.morale, '士気', player.morale < 50 ? 'danger' : 'accent')}</td><td>${money(player.wage)}</td><td>${player.contractYears}年</td><td><div class="actions"><button class="btn ${isCaptain ? 'btn--selected' : 'btn--ghost'} btn--sm" type="button" data-action="set-captain" data-player-id="${player.id}" aria-pressed="${isCaptain}" ${!starterIds.has(player.id) ? 'disabled' : ''}>主将${isCaptain ? ' ✓' : ''}</button><button class="btn ${isPenalty ? 'btn--selected' : 'btn--ghost'} btn--sm" type="button" data-action="set-penalty" data-player-id="${player.id}" aria-pressed="${isPenalty}" ${!starterIds.has(player.id) ? 'disabled' : ''}>PK${isPenalty ? ' ✓' : ''}</button><button class="btn ${player.listed ? 'btn--danger' : 'btn--ghost'} btn--sm" type="button" data-action="list-player" data-player-id="${player.id}">${player.listed ? '解除' : '売却候補'}</button>${player.listed ? `<button class="btn btn--secondary btn--sm" type="button" data-action="sell-player" data-player-id="${player.id}">売却交渉</button>` : ''}<button class="btn btn--ghost btn--sm" type="button" data-action="release-player" data-player-id="${player.id}" title="補償金: ${money(player.wage * 12)}">契約解除</button></div></td></tr>`;
    }).join('')}
  </tbody></table></div></article>`;
}

function renderSquad(state) {
  return `${pageHeader('squad', `<button class="btn btn--secondary" type="button" data-action="auto-lineup">${icon('squad', 17)} ベストXI</button>`)}<div class="squad-layout">${lineupPitch(state)}${playerTable(state)}</div>`;
}

const TACTIC_LABELS = {
  mentality: ['メンタリティ', { defensive: '守備的', cautious: '慎重', balanced: '標準', positive: '前向き', attacking: '攻撃的' }, '攻守のリスク配分。攻撃的ほど得点機会と失点リスクが増えます。'],
  tempo: ['テンポ', { slow: '遅い', normal: '標準', fast: '速い' }, '速いテンポはチャンスを増やす代わりに疲労が大きくなります。'],
  passing: ['パス方針', { short: 'ショート', mixed: 'ミックス', direct: 'ダイレクト' }, 'ショートは保持、ダイレクトは素早い前進を重視します。'],
  width: ['攻撃幅', { narrow: '狭い', normal: '標準', wide: '広い' }, '中央の人数とサイドの活用バランスを設定します。'],
  pressing: ['プレッシング', { low: '低い', normal: '標準', high: '高い', 'very-high': '超積極的' }, '高いプレスは奪取機会、カード、疲労を同時に増やします。'],
  defensiveLine: ['守備ライン', { deep: '低い', normal: '標準', high: '高い' }, '高いラインは圧力を強めますが、背後のスペースが生まれます。'],
  focus: ['攻撃の重点', { left: '左', balanced: 'バランス', right: '右', middle: '中央' }, '相手の弱点や自軍の主力に合わせて攻撃経路を調整します。']
};

function renderTactics(state) {
  const players = userPlayers(state);
  const metrics = overallSquadMetrics(state);
  const risk = (state.tactics.pressing === 'very-high' ? 35 : state.tactics.pressing === 'high' ? 20 : 8) + (state.tactics.mentality === 'attacking' ? 25 : state.tactics.mentality === 'positive' ? 12 : 0);
  return `${pageHeader('tactics', `<button class="btn btn--secondary" type="button" data-action="auto-lineup">${icon('squad', 17)} 戦術に合わせて編成</button>`)}
    <section class="metrics-grid">
      ${metricCard('戦術理解', `${state.tactics.familiarity}%`, state.tactics.familiarity >= 80 ? '高い再現性' : '継続トレーニングが必要', 'tactics')}
      ${metricCard('平均コンディション', `${metrics.fitness}%`, `負傷 ${metrics.injuries}人`, 'pulse', metrics.fitness < 65 ? 'warning' : '')}
      ${metricCard('平均年齢', `${average(players.map((player) => player.age)).toFixed(1)}歳`, `23歳以下 ${players.filter((player) => player.age <= 23).length}人`, 'academy')}
      ${metricCard('戦術リスク', `${Math.min(100, risk)}%`, '攻撃性・プレス強度から算出', 'warning', risk >= 50 ? 'warning' : '')}
    </section>
    <section class="grid-2" style="margin-top:14px">
      <article class="card"><div class="card__header"><div><h3>チーム戦術</h3><p>変更は即時保存されます</p></div></div><div class="card__body"><div class="tactics-grid">
        <div class="tactic-control"><label for="tactic-formation"><span>フォーメーション</span><span class="position-tag">基本形</span></label><select id="tactic-formation" class="control-select" data-tactic-key="formation">${Object.keys(FORMATIONS).map((value) => `<option value="${value}" ${state.tactics.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select><p>フォーメーション変更時は適性と状態から自動で先発を再編成します。</p></div>
        ${Object.entries(TACTIC_LABELS).map(([key, [label, options, description]]) => `<div class="tactic-control"><label for="tactic-${key}"><span>${label}</span></label><select id="tactic-${key}" class="control-select" data-tactic-key="${key}">${Object.entries(options).map(([value, text]) => `<option value="${value}" ${state.tactics[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select><p>${description}</p></div>`).join('')}
      </div></div></article>
      <article class="card"><div class="card__header"><div><h3>週間トレーニング</h3><p>次の試合週に効果を適用</p></div></div><div class="card__body"><div class="training-options">
        ${Object.entries(TRAINING_FOCUSES).map(([id, focus]) => `<label class="training-option"><input type="radio" name="trainingFocus" value="${id}" data-training-focus ${state.trainingFocus === id ? 'checked' : ''}><span class="training-option__body"><span class="training-option__icon">${icon(id === 'recovery' ? 'pulse' : id === 'youth' ? 'academy' : 'tactics', 17)}</span><span><strong>${escapeHtml(focus.label)}</strong><small>${escapeHtml(focus.description)}</small></span><span class="training-option__check"></span></span></label>`).join('')}
      </div></div></article>
    </section>`;
}

function standingsTable(state) {
  return `<div class="table-wrap"><table class="data-table standings-table"><thead><tr><th>#</th><th>クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th><th>勝点</th><th>フォーム</th></tr></thead><tbody>${state.standings.map((row, index) => {
    const club = clubById(state, row.teamId);
    return `<tr class="${row.teamId === state.userClubId ? 'is-user' : ''}"><td><span class="position-number ${index < 3 ? 'position-number--top' : ''}">${index + 1}</span></td><td><span class="team-cell">${clubBadge(club, 'sm')}<span><strong>${escapeHtml(club.name)}</strong></span></span></td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td><td><strong>${row.points}</strong></td><td>${formDots(row.form)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function fixtureList(state) {
  return Array.from({ length: 14 }, (_, index) => index + 1).map((week) => {
    const fixtures = getWeekFixtures(state.fixtures, week);
    return `<section class="fixture-week"><div class="fixture-week__label">MATCHWEEK ${week} ${week === Math.min(state.week, 14) && state.seasonStatus === 'active' ? '· NEXT' : ''}</div>${fixtures.map((fixture) => {
      const home = clubById(state, fixture.homeId);
      const away = clubById(state, fixture.awayId);
      const isUser = [fixture.homeId, fixture.awayId].includes(state.userClubId);
      return `<div class="fixture-row" ${isUser ? 'style="background:rgba(16,185,129,.035)"' : ''}><div class="fixture-team fixture-team--home"><span>${escapeHtml(home.name)}</span>${clubBadge(home, 'sm')}</div><div class="fixture-score ${fixture.played ? '' : 'fixture-score--upcoming'}">${fixture.played ? `${fixture.homeGoals} – ${fixture.awayGoals}` : '予定'}</div><div class="fixture-team">${clubBadge(away, 'sm')}<span>${escapeHtml(away.name)}</span></div>${fixture.played && fixture.reportId ? `<button class="btn btn--ghost btn--sm" type="button" data-open-report="${fixture.reportId}">詳細</button>` : '<span></span>'}</div>`;
    }).join('')}</section>`;
  }).join('');
}

function renderSchedule(state) {
  return `${pageHeader('schedule')}<section class="grid-2"><article class="card"><div class="card__header"><div><h3>リーグ順位表</h3><p>勝点 → 得失点差 → 得点の順で順位決定</p></div></div>${standingsTable(state)}</article><article class="card"><div class="card__header"><div><h3>全日程</h3><p>ダブルラウンドロビン · 全14節</p></div></div><div style="max-height:720px;overflow:auto">${fixtureList(state)}</div></article></section>`;
}

function renderTransfers(state) {
  const club = userClub(state);
  const wages = clubWeeklyWages(state, club.id);
  const sorted = [...state.transferMarket].sort((a, b) => b.overall - a.overall);
  return `${pageHeader('transfers')}
    <section class="metrics-grid">
      ${metricCard('移籍予算', money(club.transferBudget), `現金 ${money(club.cash)}`, 'money')}
      ${metricCard('給与使用率', `${Math.round(wages / club.wageBudget * 100)}%`, `${money(wages)} / ${money(club.wageBudget)}`, 'pulse', wages > club.wageBudget * .9 ? 'warning' : '')}
      ${metricCard('スカウト施設', `LEVEL ${club.facilities.scouting}`, '調査費用と精度に影響', 'search')}
      ${metricCard('登録人数', `${userPlayers(state).length} / 28`, '18人未満にはできません', 'squad')}
    </section>
    <article class="card" style="margin-top:14px"><div class="filter-bar"><label class="field"><span>選手名</span><input data-market-search placeholder="検索"></label><label class="field"><span>ポジション</span><select data-market-position><option value="">すべて</option>${['GK','RB','LB','CB','DM','CM','AM','RW','LW','ST'].map((position) => `<option>${position}</option>`).join('')}</select></label></div><div class="table-wrap"><table class="data-table"><thead><tr><th>選手</th><th>POS</th><th>OVR</th><th>POT</th><th>スカウト</th><th>移籍金</th><th>給与</th><th>操作</th></tr></thead><tbody>
      ${sorted.map((player) => `<tr data-market-row data-name="${escapeHtml(player.name.toLowerCase())}" data-position="${player.position}"><td><span class="player-name"><span class="player-avatar">${escapeHtml(player.name.split(' ').map((part) => part[0]).join('').slice(0,2))}</span><span><strong>${escapeHtml(player.name)}</strong><span>${player.age}歳 · ${player.contractYears}年契約希望</span></span></span></td><td><span class="position-tag">${player.position}</span></td><td><span class="rating-number">${marketEstimate(player, 'overall')}</span></td><td>${marketEstimate(player, 'potential')}</td><td><span class="scout-confidence">${progressBar(player.scouting, 'スカウト精度')} ${player.scouting}%</span></td><td><span class="transfer-price">${money(player.askingPrice)}</span></td><td>${money(player.askingWage)}</td><td><div class="actions">${player.scouting < 100 ? `<button class="btn btn--ghost btn--sm" type="button" data-action="scout-player" data-player-id="${player.id}">${icon('search', 13)} 調査</button>` : ''}<button class="btn btn--primary btn--sm" type="button" data-action="buy-player" data-player-id="${player.id}">獲得</button></div></td></tr>`).join('')}
    </tbody></table></div></article>`;
}

function renderAcademy(state) {
  const club = userClub(state);
  const prospects = state.academy.filter((player) => player.clubId === state.userClubId).sort((a, b) => b.potential - a.potential);
  return `${pageHeader('academy')}
    <section class="metrics-grid">
      ${metricCard('アカデミー施設', `LEVEL ${club.facilities.academy}`, '成長率と新加入選手に影響', 'academy')}
      ${metricCard('在籍候補', `${prospects.length}名`, `16歳以上 ${prospects.filter((player) => player.age >= 16).length}名`, 'squad')}
      ${metricCard('最高ポテンシャル', prospects.length ? Math.max(...prospects.map((player) => player.potential)) : '–', 'スカウト評価', 'star')}
      ${metricCard('週間方針', TRAINING_FOCUSES[state.trainingFocus]?.label ?? state.trainingFocus, state.trainingFocus === 'youth' ? '育成ボーナス適用中' : '若手育成で成長加速', 'tactics')}
    </section>
    ${prospects.length ? `<section class="prospect-grid" style="margin-top:14px">${prospects.map((player) => `<article class="card prospect-card"><div class="prospect-card__top"><div><span class="position-tag">${player.position}</span><h3 style="margin-top:9px">${escapeHtml(player.name)}</h3><p>${player.age}歳 · スカウト精度 ${player.scouting}%</p></div><span class="prospect-score">${player.overall}</span></div><div class="attribute-row"><span>ポテンシャル</span><strong>${player.potential}</strong></div>${progressBar((player.overall / player.potential) * 100, '成長進捗')}<div class="attribute-row"><span>攻撃 / 守備 / パス</span><strong>${player.attack} / ${player.defense} / ${player.passing}</strong></div><div class="attribute-row"><span>推定市場価値</span><strong>${money(player.value)}</strong></div><button class="btn btn--secondary" type="button" data-action="promote-prospect" data-player-id="${player.id}" ${player.age < 16 ? 'disabled' : ''}>${player.age < 16 ? '昇格可能年齢まで待つ' : 'トップチームへ昇格'}</button></article>`).join('')}</section>` : emptyState('アカデミーに選手がいません', '4週ごとのユース加入を待つか、育成施設を強化してください。', 'academy')}`;
}

const FACILITY_META = {
  training: ['トレーニングセンター', '選手の成長率と戦術理解の向上に影響します。', 'tactics'],
  academy: ['ユースアカデミー', '若手の初期能力・ポテンシャル・成長率に影響します。', 'academy'],
  scouting: ['スカウト部門', '移籍候補の情報精度と調査費用に影響します。', 'search'],
  stadium: ['スタジアム', '収容人数とホームゲーム収入を増加させます。', 'club']
};

function renderClub(state) {
  const club = userClub(state);
  const wages = clubWeeklyWages(state, club.id);
  const ledger = state.finances.ledger.filter((item) => item.clubId === club.id).slice(0, 20);
  return `${pageHeader('club')}
    <section class="metrics-grid">
      ${metricCard('現金残高', money(club.cash), `移籍予算 ${money(club.transferBudget)}`, 'money')}
      ${metricCard('週間給与', money(wages), `上限 ${money(club.wageBudget)}`, 'pulse', wages > club.wageBudget * .9 ? 'warning' : '')}
      ${metricCard('取締役会', `${club.boardConfidence}%`, `目標: ${escapeHtml(club.objective)}`, 'club', club.boardConfidence < 45 ? 'danger' : '')}
      ${metricCard('ファン評価', `${club.fanMood}%`, `${club.capacity.toLocaleString('ja-JP')}席 · ${money(club.ticketPrice)}`, 'squad')}
    </section>
    <section class="facility-grid" style="margin-top:14px">${Object.entries(FACILITY_META).map(([id, [title, description, iconName]]) => {
      const level = club.facilities[id];
      const cost = facilityUpgradeCost(club, id);
      return `<article class="card facility-card"><div class="facility-card__top"><div><span class="eyebrow">${icon(iconName, 15)} FACILITY</span><h3 style="margin-top:9px">${title}</h3><p>${description}</p></div><span class="prospect-score">${level}</span></div><div class="level-dots">${Array.from({length:5}, (_, index) => `<span class="level-dot ${index < level ? 'is-filled' : ''}"></span>`).join('')}</div><button class="btn btn--secondary" type="button" data-action="upgrade-facility" data-facility="${id}" ${cost === null || club.cash < cost ? 'disabled' : ''}>${cost === null ? '最大レベル' : `強化 ${money(cost)}`}</button></article>`;
    }).join('')}</section>
    <section class="grid-equal" style="margin-top:14px"><article class="card"><div class="card__header"><div><h3>財務履歴</h3><p>直近20件</p></div></div>${ledger.length ? `<div class="table-wrap"><table class="data-table" style="min-width:520px"><thead><tr><th>週</th><th>項目</th><th>区分</th><th>金額</th></tr></thead><tbody>${ledger.map((item) => `<tr><td>W${item.week}</td><td>${escapeHtml(item.label)}</td><td>${item.type === 'income' ? '<span class="text-accent">収入</span>' : '<span class="text-danger">支出</span>'}</td><td class="${item.amount >= 0 ? 'text-accent' : 'text-danger'}">${item.amount >= 0 ? '+' : ''}${formatMoney(item.amount)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('財務履歴はありません', '試合週を進めると収入と支出が記録されます。', 'money')}</article><article class="card"><div class="card__header"><div><h3>クラブプロフィール</h3><p>${escapeHtml(club.city)} · ${escapeHtml(club.stadium)}</p></div>${clubBadge(club, 'md')}</div><div class="card__body"><div class="attribute-row"><span>評判</span><strong>${club.reputation}</strong></div>${progressBar(club.reputation, 'クラブ評判')}<div class="attribute-row"><span>スポンサー週間収入</span><strong>${money(club.sponsorWeekly)}</strong></div><div class="attribute-row"><span>スタジアム収容</span><strong>${club.capacity.toLocaleString('ja-JP')}人</strong></div><div class="attribute-row"><span>チケット価格</span><strong>${money(club.ticketPrice)}</strong></div><div class="attribute-row"><span>基本スタイル</span><strong>${escapeHtml(club.style)}</strong></div></div></article></section>`;
}

function renderInbox(state) {
  const sorted = [...state.inbox].sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.week - a.week);
  return `${pageHeader('inbox')}<div class="inbox-list">${sorted.length ? sorted.map((item) => {
    const selected = item.choices?.find((choice) => choice.id === item.selectedChoiceId);
    return `<article class="card inbox-card ${item.resolved ? 'is-resolved' : ''}"><span class="inbox-card__rail"></span><div class="inbox-card__content"><div class="inbox-card__meta"><span>${escapeHtml(item.category)} · WEEK ${item.week}</span><span>${item.resolved ? '処理済み' : '判断が必要'}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p>${item.kind === 'decision' && !item.resolved ? `<div class="choice-grid">${item.choices.map((choice) => `<button class="choice-button" type="button" data-action="resolve-event" data-event-id="${item.id}" data-choice-id="${choice.id}"><strong>${escapeHtml(choice.label)}</strong><span>${escapeHtml(choice.description)}</span></button>`).join('')}</div>` : selected ? `<span class="resolved-choice">選択: ${escapeHtml(selected.label)}</span>` : ''}</div></article>`;
  }).join('') : emptyState('受信トレイは空です', '試合週を進めるとクラブ内外から連絡が届きます。')}</div>`;
}

function renderView(state, currentView, uiState = {}) {
  switch (currentView) {
    case 'squad': return renderSquad(state);
    case 'tactics': return renderTactics(state);
    case 'schedule': return renderSchedule(state);
    case 'transfers': return renderTransfers(state);
    case 'academy': return renderAcademy(state);
    case 'club': return renderClub(state);
    case 'inbox': return renderInbox(state);
    default: return renderDashboard(state, uiState);
  }
}

export function renderApplication(state, currentView = 'dashboard', uiState = {}) {
  return appShell(state, currentView, renderView(state, currentView, uiState), uiState);
}

function eventIcon(type) {
  if (type === 'goal') return '⚽';
  if (type === 'card') return '■';
  if (type === 'injury') return '+';
  if (type === 'save') return '◆';
  if (type === 'substitution') return '⇄';
  if (type === 'half' || type === 'full') return '⏱';
  return '·';
}

export function renderMatchModal(state, report, replay = false) {
  const home = clubById(state, report.homeClubId);
  const away = clubById(state, report.awayClubId);
  const statRows = [
    ['ポゼッション', report.homePossession, report.awayPossession, '%'],
    ['シュート', report.homeShots, report.awayShots, ''],
    ['枠内', report.homeShotsOnTarget, report.awayShotsOnTarget, ''],
    ['xG', report.homeXg, report.awayXg, ''],
    ['コーナー', report.corners.home, report.corners.away, ''],
    ['警告', report.homeCards, report.awayCards, '']
  ];
  return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="試合センター"><div class="match-modal" data-match-modal data-replay="${replay}">
    <section class="match-hero"><div class="match-hero__top"><span class="live-pill">${replay ? 'REPLAY' : 'LIVE MATCH'}</span><span class="match-minute" data-match-minute>${replay ? '90:00' : '00:00'}</span></div><div class="match-scoreboard"><div class="match-club">${clubBadge(home, 'lg')}<strong>${escapeHtml(home.name)}</strong></div><div class="match-score"><span data-score-home>${replay ? report.homeGoals : 0}</span><span>–</span><span data-score-away>${replay ? report.awayGoals : 0}</span></div><div class="match-club">${clubBadge(away, 'lg')}<strong>${escapeHtml(away.name)}</strong></div></div><div class="match-progress"><span data-match-progress style="width:${replay ? 100 : 0}%"></span></div></section>
    <section class="match-body"><div class="commentary" data-commentary>${report.events.map((event, index) => `<div class="commentary-event commentary-event--${event.type} ${replay ? 'is-visible' : ''}" data-match-event data-index="${index}" data-minute="${event.minute}" data-side="${event.side}" data-type="${event.type}"><span class="commentary-event__minute">${event.minute}'</span><span class="commentary-event__type">${eventIcon(event.type)}</span><p>${escapeHtml(event.text)}</p></div>`).join('')}</div><aside class="match-sidepanel match-result-only ${replay ? 'is-visible' : ''}" data-match-results><div class="card__header" style="padding:0 0 14px;margin-bottom:14px"><div><h3>マッチスタッツ</h3><p>マン・オブ・ザ・マッチ ${escapeHtml(report.manOfTheMatch?.playerName ?? '–')} ${report.manOfTheMatch?.rating ?? ''}</p></div></div>${statRows.map(([label, left, right, suffix]) => { const total = Number(left) + Number(right) || 1; return `<div class="match-stat"><strong>${left}${suffix}</strong><div><div style="margin-bottom:5px;color:var(--muted)">${label}</div><div class="match-stat__bar"><span style="width:${Number(left)/total*100}%"></span><span style="width:${Number(right)/total*100}%"></span></div></div><strong>${right}${suffix}</strong></div>`; }).join('')}</aside></section>
    <footer class="match-actions">${!replay ? `<button class="btn btn--ghost" type="button" data-match-skip>結果へスキップ</button>` : ''}<button class="btn btn--primary" type="button" data-match-close ${!replay ? 'disabled' : ''}>試合センターを閉じる</button></footer>
  </div></div>`;
}
