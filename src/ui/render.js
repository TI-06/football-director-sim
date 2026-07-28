import { CLUB_TEMPLATES, DIFFICULTIES, FORMATIONS, TRAINING_FOCUSES } from '../data/catalog.js';
import { getWeekFixtures } from '../game/fixtures.js';
import { PROJECTS, clubProjectCost, clubWeeklyWages, facilityUpgradeCost } from '../game/economy.js';
import { playerSlotScore } from '../game/squad.js';
import { marketEstimate } from '../game/transfers.js';
import { average, formatMoney } from '../core/utils.js';
import { clubBadge, emptyState, escapeHtml, formDots, icon, metricCard, money, progressBar } from './templates.js';
import { DESKTOP_CATEGORIES, categoryForView } from './game-shell.js';
import { renderContextPanel } from './context-panel.js';

export const NAV_ITEMS = [
  ['dashboard', 'ダッシュボード', 'dashboard'],
  ['squad', 'スカッド', 'squad'],
  ['tactics', '戦術・トレーニング', 'tactics'],
  ['schedule', '日程・順位表', 'calendar'],
  ['transfers', '移籍市場', 'transfer'],
  ['academy', 'アカデミー', 'academy'],
  ['records', '記録・タイトル', 'trophy'],
  ['secretary', '秘書レポート', 'star'],
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
  records: ['記録・タイトル', 'シーズン成績、通算成績、個人タイトルを確認します。'],
  secretary: ['秘書レポート', '次戦、選手状態、契約、予算の重要事項を整理します。'],
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
  const candidates = [
    ...(state.fixtures ?? []),
    ...(state.cup?.fixtures ?? [])
  ].filter((fixture) => !fixture.played && fixture.week >= state.week && [fixture.homeId, fixture.awayId].includes(state.userClubId));
  return candidates.sort((a, b) => a.week - b.week)[0] ?? null;
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

const MOBILE_NAV_ITEMS = [
  ['dashboard', 'ホーム', 'dashboard'],
  ['schedule', '試合', 'calendar'],
  ['squad', 'スカッド', 'squad'],
  ['transfers', '移籍', 'transfer']
];

function navHtml(state, currentView, mobile = false) {
  const unresolved = state.inbox.filter((item) => item.kind === 'decision' && !item.resolved).length;
  if (!mobile) {
    const activeCategory = categoryForView(currentView);
    const buttons = DESKTOP_CATEGORIES.map((category) => `<button class="nav__item ${activeCategory === category.id ? 'is-active' : ''}" type="button" data-category="${category.id}" data-nav="${category.view}" aria-current="${activeCategory === category.id ? 'page' : 'false'}">${icon(category.icon, 19)}<span>${escapeHtml(category.label)}</span><kbd>${category.shortcut}</kbd></button>`).join('');
    return `<nav class="nav" aria-label="メインメニュー">${buttons}<span hidden data-nav="${escapeHtml(currentView)}"></span>${unresolved ? `<button class="nav__item nav__item--attention" type="button" data-nav="inbox">${icon('inbox', 19)}<span>要対応</span><b class="nav__badge">${unresolved}</b></button>` : ''}</nav>`;
  }
  const buttons = MOBILE_NAV_ITEMS.map(([id, label, iconName]) => `<button class="nav__item ${currentView === id ? 'is-active' : ''}" type="button" data-nav="${id}" aria-current="${currentView === id ? 'page' : 'false'}">${icon(iconName, 19)}<span>${escapeHtml(label)}</span></button>`).join('');
  const menuButton = `<button class="nav__item ${!MOBILE_NAV_ITEMS.some(([id]) => id === currentView) ? 'is-active' : ''}" type="button" data-command="open-game-menu" aria-label="その他のメニュー">${icon('club', 19)}<span>メニュー</span>${unresolved ? `<b class="nav__badge">${unresolved}</b>` : ''}</button>`;
  return `<nav class="mobile-nav" aria-label="メインメニュー">${buttons}${menuButton}</nav>`;
}

export function renderNewGame() {
  const divisionGroups = [1, 2, 3].map((division) => {
    const clubs = CLUB_TEMPLATES.filter((club) => club.division === division);
    return `<section class="club-division-group"><header><strong>日本${division}部</strong><span>${clubs.length}クラブ</span></header><div class="club-picker">${clubs.map((club, index) => `<label class="club-option">
      <input type="radio" name="clubId" value="${club.id}" ${division === 1 && index === 0 ? 'checked' : ''}>
      <span class="club-option__body">${clubBadge(club, 'md')}<span><span class="club-option__name">${escapeHtml(club.name)}</span><span class="club-option__meta">日本${division}部 · 評判 ${club.reputation}<br>${escapeHtml(club.city)} · ${escapeHtml(club.stadium)}</span></span></span>
    </label>`).join('')}</div></section>`;
  }).join('');
  return `<main class="new-game">
    <div class="new-game__shell">
      <section class="new-game__intro">
        <span class="eyebrow">${icon('trophy', 17)} 日本クラブ経営シミュレーション</span>
        <h1>FOOTBALL <span>DIRECTOR</span></h1>
        <p class="new-game__lead">日本1部・2部・3部の60クラブ、昇格と降格、全国王者杯、選手の成長・不満・引退までを管理する長期キャリアです。</p>
        <ul class="feature-list">
          <li>${icon('calendar')} 3部制・各20クラブ・リーグ38節</li>
          <li>${icon('trophy')} 全60クラブ参加の全国王者杯</li>
          <li>${icon('squad')} 日本語の架空クラブと架空選手</li>
          <li>${icon('star')} 個人成績・タイトル・秘書レポート</li>
        </ul>
        <p class="research-note">実在クラブ・選手・大会名は使用していません。新設クラブでは日本3部から頂点を目指します。</p>
      </section>
      <form id="new-game-form" class="new-game__form">
        <section class="form-section">
          <div class="form-section__title"><h2>監督プロフィール</h2><span>STEP 01</span></div>
          <label class="field"><span>監督名</span><input name="managerName" value="山田 太郎" maxlength="32" required autocomplete="off"></label>
        </section>
        <section class="form-section">
          <div class="form-section__title"><h2>キャリア開始方法</h2><span>STEP 02</span></div>
          <div class="career-mode-picker">
            <label class="difficulty-option"><input type="radio" name="clubMode" value="existing" checked><span><strong>既存クラブを率いる</strong><small>日本1部・2部・3部の60クラブから選択</small></span></label>
            <label class="difficulty-option"><input type="radio" name="clubMode" value="created"><span><strong>新規クラブを設立</strong><small>日本3部から昇格を目指す</small></span></label>
          </div>
          <div data-club-mode-panel="existing" class="existing-club-panel">${divisionGroups}</div>
          <div data-club-mode-panel="created" class="created-club-panel" hidden>
            <div class="field-grid">
              <label class="field"><span>クラブ名</span><input name="clubName" value="横浜みなとSC" maxlength="32" autocomplete="off"></label>
              <label class="field"><span>本拠地</span><input name="homeCity" value="神奈川県" maxlength="24" autocomplete="off"></label>
              <label class="field"><span>クラブカラー</span><input name="primaryColor" type="color" value="#16a34a"></label>
              <label class="field"><span>クラブ方針</span><select name="clubPhilosophy"><option value="balanced">総合型</option><option value="youth">育成重視</option><option value="pressing">前線プレス</option><option value="possession">保持重視</option></select></label>
            </div>
            <p class="form-help">新設クラブは日本3部の1枠と入れ替わり、初期戦力と資金は3部水準になります。</p>
          </div>
        </section>
        <section class="form-section">
          <div class="form-section__title"><h2>ゲーム設定</h2><span>STEP 03</span></div>
          <div class="difficulty-picker">${Object.values(DIFFICULTIES).map((difficulty) => `<label class="difficulty-option"><input type="radio" name="difficulty" value="${difficulty.id}" ${difficulty.id === 'normal' ? 'checked' : ''}><span><strong>${escapeHtml(difficulty.label)}</strong><small>${difficulty.id === 'casual' ? '経営に余裕があり、AI補強も穏やか。' : difficulty.id === 'hard' ? '厳しい予算と高精度のAI補強。' : '標準的な経営バランス。'}</small></span></label>`).join('')}</div>
          <label class="field" style="margin-top:14px"><span>ワールドシード</span><input name="seed" value="日本リーグ2026" maxlength="48" required><small>同じシードなら初期選手と日程が再現されます。</small></label>
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
  return `<div class="app-shell app-shell--three-column">
    <aside class="sidebar">
      <div class="sidebar__brand"><span class="sidebar__brand-mark">FD</span><div><strong>Football Director</strong><small>CAREER MODE</small></div></div>
      <div class="sidebar__club">${clubBadge(club, 'sm')}<div><strong>${escapeHtml(club.name)}</strong><span>${escapeHtml(club.divisionName)} · ${escapeHtml(state.managerName)}監督</span></div></div>
      ${navHtml(state, currentView)}
      <button class="sidebar__collapse" type="button" data-command="toggle-sidebar" aria-label="サイドバーを折りたたむ">${icon('menu', 16)}<span>メニューを縮小</span></button>
      <div class="sidebar__footer">
        <button class="sidebar__utility" type="button" data-command="cloud-save">${icon('save', 17)}<span>クラウドへ保存</span></button>
        <button class="sidebar__utility" type="button" data-command="cloud-load">${icon('upload', 17)}<span>クラウドから読込</span></button>
        <button class="sidebar__utility" type="button" data-command="export-save">${icon('download', 17)}<span>セーブを書き出す</span></button>
        <button class="sidebar__utility" type="button" data-command="import-save">${icon('upload', 17)}<span>セーブを読み込む</span></button>
        <button class="sidebar__utility" type="button" data-command="reset-game">${icon('reset', 17)}<span>キャリアをリセット</span></button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar__context"><small>SEASON ${state.season} · WEEK ${Math.min(state.week, state.seasonWeeks ?? 44)} / ${state.seasonWeeks ?? 44}</small><h1>${escapeHtml(title)}</h1>${autoMessage}</div>
        <div class="topbar__actions">
          <div class="date-chip">${icon('calendar', 16)} ${escapeHtml(state.currentDate)}</div>
          ${autoAdvanceControl(state, uiState)}
          <button class="btn btn--primary" type="button" data-command="${state.seasonStatus === 'active' ? 'play-week' : 'start-next-season'}" ${uiState.autoAdvanceActive ? 'disabled' : ''}>${icon(state.seasonStatus === 'active' ? 'play' : 'trophy', 17)}<span>${state.seasonStatus === 'active' ? '次の試合へ' : '次シーズンを開始'}</span></button>
        </div>
      </header>
      <main class="content">${content}</main>
      ${navHtml(state, currentView, true)}
    </div>
    ${renderContextPanel(state)}
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
      <div class="next-match__top"><span>${escapeHtml(fixture.competitionName ?? (fixture.competition === 'cup' ? '全国王者杯' : club.divisionName))} · WEEK ${fixture.week}</span><span>${home.id === state.userClubId ? 'HOME' : 'AWAY'} · ${escapeHtml(home.id === state.userClubId ? club.stadium : opponent.stadium)}</span></div>
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

  return `<div class="game-command-hub">${pageHeader('dashboard')}
    <section class="metrics-grid">
      ${metricCard('リーグ順位', `${position}位`, `勝点 ${state.standings.find((row) => row.teamId === state.userClubId)?.points ?? 0}`, 'trophy')}
      ${metricCard('クラブ資金', money(club.cash), `移籍予算 ${money(club.transferBudget)}`, 'money')}
      ${metricCard('取締役会の信頼', `${club.boardConfidence}%`, club.objective, 'pulse', club.boardConfidence < 45 ? 'danger' : '')}
      ${metricCard('チーム状態', `${metrics.morale} / ${metrics.fitness}`, `士気 / 体力 · 負傷 ${metrics.injuries}人`, 'squad', metrics.injuries >= 3 ? 'warning' : '')}
    </section>
    <section class="dashboard-quick-actions" aria-label="クイック操作">
      <button type="button" data-nav="squad">${icon('squad', 20)}<span><strong>先発を確認</strong><small>配置・体力・役割</small></span></button>
      <button type="button" data-nav="tactics">${icon('tactics', 20)}<span><strong>試合プラン</strong><small>戦術と交代条件</small></span></button>
      <button type="button" data-nav="secretary">${icon('star', 20)}<span><strong>秘書レポート</strong><small>今週の要注意事項</small></span></button>
      <button type="button" data-nav="inbox">${icon('inbox', 20)}<span><strong>受信トレイ</strong><small>未処理 ${unresolved.length}件</small></span></button>
    </section>
    <section class="grid-2" style="margin-top:14px">
      ${matchCard}
      <article class="card"><div class="card__header"><div><h3>順位表</h3><p>上位6クラブ</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="schedule">全体を見る</button></div><div class="card__body"><table class="mini-table"><thead><tr><th>#</th><th>クラブ</th><th>試</th><th>差</th><th>勝点</th></tr></thead><tbody>${miniRows}</tbody></table></div></article>
    </section>
    <section class="grid-equal" style="margin-top:14px">
      <article class="card"><div class="card__header"><div><h3>優先受信トレイ</h3><p>未処理の判断事項</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="inbox">すべて見る</button></div><div class="card__body">${unresolved.length ? `<div class="alert-list">${unresolved.map((item) => `<div class="alert-item"><span class="alert-item__icon">${icon('inbox', 16)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · WEEK ${item.week}</span></div><button type="button" data-nav="inbox">${icon('chevron', 16)}</button></div>`).join('')}</div>` : emptyState('未処理事項はありません', '次の試合へ進むと新しい連絡が届くことがあります。')}</div></article>
      <article class="card"><div class="card__header"><div><h3>スカッドアラート</h3><p>起用前に確認したい状態</p></div><button class="btn btn--ghost btn--sm" type="button" data-nav="squad">スカッドへ</button></div><div class="card__body">${alerts.length ? `<div class="alert-list">${alerts.map((item) => `<div class="alert-item"><span class="alert-item__icon">${icon('warning', 16)}</span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><button type="button" data-nav="${item.view}">${icon('chevron', 16)}</button></div>`).join('')}</div>` : emptyState('大きな問題はありません', '先発候補のコンディションは整っています。', 'squad')}</div></article>
    </section>
    <div class="mobile-continue-bar"><div><small>${fixture ? `${escapeHtml(fixture.competitionName ?? club.divisionName)} · WEEK ${fixture.week}` : `SEASON ${state.season}`}</small><strong>${fixture ? '次の試合を指揮する' : '次シーズンへ進む'}</strong></div><button class="btn btn--primary" type="button" data-command="${state.seasonStatus === 'active' ? 'play-week' : 'start-next-season'}" ${uiState.autoAdvanceActive ? 'disabled' : ''}>${icon(state.seasonStatus === 'active' ? 'play' : 'trophy', 18)} 進む</button></div>
  </div>`;
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
  return `<div class="card squad-formation-sticky"><div class="card__header"><div><h3>先発フォーメーション</h3><p>${escapeHtml(state.tactics.formation)} · 選手カードをドラッグして配置変更</p></div><div class="formation-quick-actions"><label><span>フォーメーション</span><select class="control-select" data-formation-quick>${Object.keys(FORMATIONS).map((value) => `<option value="${value}" ${state.tactics.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="btn btn--secondary btn--sm" type="button" data-action="auto-lineup">自動編成</button></div></div>
    <div class="card__body"><div class="pitch"><span class="pitch-box pitch-box--top"></span><span class="pitch-box pitch-box--bottom"></span>
      ${state.lineup.starters.map((entry) => {
        const selected = players.find((player) => player.id === entry.playerId);
        const candidates = players
          .filter((player) => player.injuryWeeks <= 0 && !player.suspended)
          .sort((a, b) => playerSlotScore(b, entry.slotPosition) - playerSlotScore(a, entry.slotPosition));
        const mobileX = Math.max(8, Math.min(92, 50 + ((entry.x - 50) * 1.2)));
        const mobileY = entry.y >= 84 ? 91 : entry.y >= 60 ? 71 : entry.y >= 42 ? 50 : entry.y >= 23 ? 30 : 9;
        return `<div class="pitch-slot" style="left:${entry.x}%;top:${entry.y}%;--slot-mobile-x:${mobileX.toFixed(1)}%;--slot-mobile-y:${mobileY.toFixed(1)}%" data-drop-slot="${entry.slotId}" data-slot-position="${entry.slotPosition}"><div class="pitch-player" draggable="true" data-drag-player="${selected?.id ?? ''}" data-source-slot="${entry.slotId}" tabindex="0" aria-label="${escapeHtml(selected?.name ?? '未設定')}をドラッグ"><div class="pitch-player__top"><span class="pitch-player__pos">${entry.slotPosition}</span><span class="pitch-player__roles">${roleBadges(state, entry.playerId)}</span><span class="pitch-player__rating">${selected?.overall ?? '–'}</span></div><strong class="pitch-player__name">${escapeHtml(selected?.name ?? '未設定')}</strong><select class="pitch-player__select" aria-label="${entry.slotPosition}の選手" data-lineup-slot="${entry.slotId}">${candidates.map((player) => `<option value="${player.id}" ${player.id === entry.playerId ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></div></div>`;
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
      const concernText = player.transferRequest ? '移籍希望' : player.concerns?.[0] ?? '';
      const status = player.injuryWeeks > 0 ? `<span class="status-tag status-tag--injured">負傷 ${player.injuryWeeks}週</span>` : player.suspended ? '<span class="status-tag status-tag--injured">出場停止</span>' : player.retirementAnnounced ? '<span class="status-tag status-tag--listed">今季限りで引退</span>' : player.transferRequest ? '<span class="status-tag status-tag--injured">移籍希望</span>' : player.listed ? '<span class="status-tag status-tag--listed">売却候補</span>' : `<span class="status-tag">幸福度 ${player.happiness ?? player.morale}</span>${concernText ? `<small class="player-concern">${escapeHtml(concernText)}</small>` : ''}`;
      return `<tr data-squad-player="${player.id}" data-drag-player="${player.id}" draggable="${available}" data-name="${escapeHtml(player.name.toLowerCase())}" data-position="${player.position}" data-role="${roleKey}" data-role-rank="${roleRank}" data-overall="${player.overall}" data-potential="${player.potential}" data-fitness="${player.fitness}" data-morale="${player.morale}" data-age="${player.age}" data-wage="${player.wage}" class="${available ? 'is-draggable' : 'is-unavailable'}"><td><span class="drag-handle" title="フォーメーションへドラッグ" aria-hidden="true">⋮⋮</span></td><td><span class="player-name"><span class="player-avatar">${escapeHtml(player.name.split(' ').map((part) => part[0]).join('').slice(0,2))}</span><span><strong>${escapeHtml(player.name)}</strong><span>${player.age}歳 · ${player.appearances}試合 ${player.goals}得点 · ${escapeHtml(player.personality ?? '標準')} / 信頼${player.managerTrust ?? 50}</span></span></span></td><td><span class="position-tag">${player.position}</span> <span class="selection-role">${role}</span>${roleBadges(state, player.id)}</td><td><span class="rating-number">${player.overall}</span></td><td>${player.potential}</td><td>${status}</td><td>${player.fitness}${progressBar(player.fitness, '体力', player.fitness < 50 ? 'danger' : player.fitness < 70 ? 'warning' : 'accent')}</td><td>${player.morale}${progressBar(player.morale, '士気', player.morale < 50 ? 'danger' : 'accent')}</td><td>${money(player.wage)}</td><td>${player.contractYears}年</td><td><div class="actions actions--management"><label class="inline-control"><span>起用</span><select data-selection-policy data-player-id="${player.id}"><option value="automatic" ${player.selectionPolicy === 'automatic' ? 'selected' : ''}>自動</option><option value="starter-fixed" ${player.selectionPolicy === 'starter-fixed' ? 'selected' : ''}>先発固定</option><option value="bench-fixed" ${player.selectionPolicy === 'bench-fixed' ? 'selected' : ''}>控え固定</option><option value="excluded-fixed" ${player.selectionPolicy === 'excluded-fixed' ? 'selected' : ''}>登録外固定</option></select></label><label class="inline-control"><span>交代</span><select data-substitution-policy data-player-id="${player.id}"><option value="automatic" ${(state.matchPlan?.substitutionPolicies?.[player.id] ?? 'automatic') === 'automatic' ? 'selected' : ''}>自動</option><option value="never" ${state.matchPlan?.substitutionPolicies?.[player.id] === 'never' ? 'selected' : ''}>交代しない</option><option value="after-60" ${state.matchPlan?.substitutionPolicies?.[player.id] === 'after-60' ? 'selected' : ''}>60分以降</option></select></label><button class="btn btn--ghost btn--sm" type="button" data-action="hold-player-meeting" data-player-id="${player.id}">褒める</button><button class="btn btn--ghost btn--sm" type="button" data-action="create-player-promise" data-player-id="${player.id}">先発を約束</button><button class="btn ${isCaptain ? 'btn--selected' : 'btn--ghost'} btn--sm" type="button" data-action="set-captain" data-player-id="${player.id}" aria-pressed="${isCaptain}" ${!starterIds.has(player.id) ? 'disabled' : ''}>主将${isCaptain ? ' ✓' : ''}</button><button class="btn ${isPenalty ? 'btn--selected' : 'btn--ghost'} btn--sm" type="button" data-action="set-penalty" data-player-id="${player.id}" aria-pressed="${isPenalty}" ${!starterIds.has(player.id) ? 'disabled' : ''}>PK${isPenalty ? ' ✓' : ''}</button><button class="btn ${player.listed ? 'btn--danger' : 'btn--ghost'} btn--sm" type="button" data-action="list-player" data-player-id="${player.id}">${player.listed ? '解除' : '売却候補'}</button>${player.listed ? `<button class="btn btn--secondary btn--sm" type="button" data-action="sell-player" data-player-id="${player.id}">売却交渉</button>` : ''}<button class="btn btn--ghost btn--sm" type="button" data-action="renew-contract" data-player-id="${player.id}">契約更新</button><button class="btn btn--ghost btn--sm" type="button" data-action="release-player" data-player-id="${player.id}" title="補償金: ${money(player.wage * 12)}">契約解除</button></div></td></tr>`;
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

function matchPlanNumberControl(key, label, value, min, max, suffix) {
  return `<label class="match-plan-control"><span>${escapeHtml(label)}</span><div><input type="range" min="${min}" max="${max}" value="${value}" data-match-plan-key="${key}"><output>${value}${suffix}</output></div></label>`;
}

function matchPlanReaction(stateName, label, plan) {
  const mentalityOptions = TACTIC_LABELS.mentality[1];
  const pressingOptions = TACTIC_LABELS.pressing[1];
  const tempoOptions = TACTIC_LABELS.tempo[1];
  const reaction = plan.scoreTactics[stateName];
  const select = (key, options) => `<select class="control-select" data-match-plan-score="${stateName}" data-match-plan-score-key="${key}">${Object.entries(options).map(([value, text]) => `<option value="${value}" ${reaction[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  return `<div class="score-reaction"><strong>${escapeHtml(label)}</strong><label><span>姿勢</span>${select('mentality', mentalityOptions)}</label><label><span>プレス</span>${select('pressing', pressingOptions)}</label><label><span>テンポ</span>${select('tempo', tempoOptions)}</label></div>`;
}

function renderMatchPlan(state) {
  const plan = state.matchPlan;
  return `<article class="card match-plan-card"><div class="card__header"><div><h3>試合プランと自動交代</h3><p>手動試合と自動進行の両方で使用します</p></div><span class="position-tag">MATCH PLAN</span></div><div class="card__body">
    <div class="match-plan-grid">
      ${matchPlanNumberControl('substitutionMinute', '交代を始める時間', plan.substitutionMinute, 45, 80, '分')}
      ${matchPlanNumberControl('fitnessThreshold', '疲労交代の体力基準', plan.fitnessThreshold, 40, 85, '%')}
      ${matchPlanNumberControl('maxSubstitutions', '自動交代の上限', plan.maxSubstitutions, 0, 5, '人')}
      <label class="match-plan-switch"><input type="checkbox" data-match-plan-key="automaticSubstitutions" ${plan.automaticSubstitutions ? 'checked' : ''}><span><strong>自動交代を使う</strong><small>負傷、警告、疲労、低評価の順に判断</small></span></label>
      <label class="match-plan-switch"><input type="checkbox" data-match-plan-key="prioritizeYouth" ${plan.prioritizeYouth ? 'checked' : ''}><span><strong>若手を優先</strong><small>同程度なら23歳以下を投入</small></span></label>
      <label class="match-plan-switch"><input type="checkbox" data-match-plan-key="preserveKeyPlayers" ${plan.preserveKeyPlayers ? 'checked' : ''}><span><strong>主力を温存</strong><small>リード時は疲労した中心選手を早めに交代</small></span></label>
      <label class="match-plan-switch"><input type="checkbox" data-match-plan-key="protectBooked" ${plan.protectBooked ? 'checked' : ''}><span><strong>警告選手を保護</strong><small>2枚目の警告リスクを交代順位へ反映</small></span></label>
      <label class="match-plan-switch"><input type="checkbox" data-match-plan-key="stopImportantMatches" ${plan.stopImportantMatches ? 'checked' : ''}><span><strong>重要試合は手動</strong><small>全国王者杯の準決勝・決勝で自動進行を停止</small></span></label>
    </div>
    <div class="score-reaction-grid"><h4>スコア状況ごとの指示</h4>${matchPlanReaction('leading', 'リード時', plan)}${matchPlanReaction('drawing', '同点時', plan)}${matchPlanReaction('trailing', 'ビハインド時', plan)}</div>
  </div></article>`;
}

function renderSetPieces(state) {
  const plan = state.setPieces;
  const templates = {
    attackingCorner: [['near-post','ニア'],['far-post','ファー'],['crowd-center','中央密集'],['short-corner','ショート']],
    defendingCorner: [['zonal','ゾーン'],['man-marking','マンマーク'],['counter-ready','カウンター']],
    attackingFreeKick: [['direct','直接'],['cross','クロス'],['short','ショート']],
    defendingFreeKick: [['wall','壁重視'],['zonal','ゾーン'],['counter-ready','カウンター']],
    longThrow: [['box-target','ボックス投入'],['short-retain','保持']]
  };
  const labels = { attackingCorner:'攻撃CK', defendingCorner:'守備CK', attackingFreeKick:'攻撃FK', defendingFreeKick:'守備FK', longThrow:'ロングスロー' };
  return `<article class="card set-piece-card"><div class="card__header"><div><h3>セットプレー</h3><p>習熟度 ${Math.round(plan.familiarity)} · 練習配分 ${plan.trainingShare}%</p></div><span class="position-tag">SET PIECES</span></div><div class="card__body"><div class="set-piece-grid">${Object.entries(templates).map(([key, options]) => `<label><span>${labels[key]}</span><select class="control-select" data-set-piece-key="${key}">${options.map(([value,label]) => `<option value="${value}" ${plan.routines[key].template === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`).join('')}<label><span>週間練習配分</span><select class="control-select" data-set-piece-training>${[0,10,20,30,40].map((value) => `<option value="${value}" ${plan.trainingShare === value ? 'selected' : ''}>${value}%</option>`).join('')}</select></label></div></div></article>`;
}

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
    </section>
    <section style="margin-top:14px">${renderMatchPlan(state)}</section><section style="margin-top:14px">${renderSetPieces(state)}</section>`;
}

function standingsTable(state, division = userClub(state).division) {
  const rows = state.standingsByDivision?.[division] ?? [];
  return `<div class="table-wrap"><table class="data-table standings-table"><thead><tr><th>#</th><th>クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th><th>勝点</th></tr></thead><tbody>${rows.map((row, index) => {
    const club = clubById(state, row.teamId);
    const zone = index < 3 ? 'position-number--top' : index >= 17 && division < 3 ? 'position-number--danger' : '';
    return `<tr class="${row.teamId === state.userClubId ? 'is-user' : ''}"><td><span class="position-number ${zone}">${index + 1}</span></td><td><span class="team-cell">${clubBadge(club, 'sm')}<span><strong>${escapeHtml(club.name)}</strong></span></span></td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td><td><strong>${row.points}</strong></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function userFixtureList(state) {
  const league = (state.fixtures ?? []).filter((fixture) => [fixture.homeId, fixture.awayId].includes(state.userClubId));
  const cupHistory = (state.cup?.history ?? []).flatMap((round) => round.fixtures ?? []);
  const cupCurrent = state.cup?.fixtures ?? [];
  const fixtures = [...league, ...cupHistory, ...cupCurrent]
    .filter((fixture, index, all) => all.findIndex((item) => item.id === fixture.id) === index)
    .sort((a, b) => a.week - b.week);
  return fixtures.map((fixture) => {
    const home = clubById(state, fixture.homeId);
    const away = clubById(state, fixture.awayId);
    const label = fixture.competitionName ?? (fixture.competition === 'cup' ? '全国王者杯' : home?.divisionName ?? 'リーグ');
    return `<div class="fixture-row"><span class="fixture-competition">W${fixture.week}<small>${escapeHtml(label)}</small></span><div class="fixture-team fixture-team--home"><span>${escapeHtml(home?.name ?? '未定')}</span>${home ? clubBadge(home, 'sm') : ''}</div><div class="fixture-score ${fixture.played ? '' : 'fixture-score--upcoming'}">${fixture.played ? `${fixture.homeGoals} – ${fixture.awayGoals}${fixture.penaltyWinnerId ? ' (PK)' : ''}` : '予定'}</div><div class="fixture-team">${away ? clubBadge(away, 'sm') : ''}<span>${escapeHtml(away?.name ?? '未定')}</span></div>${fixture.played && fixture.reportId ? `<button class="btn btn--ghost btn--sm" type="button" data-open-report="${fixture.reportId}">詳細</button>` : '<span></span>'}</div>`;
  }).join('');
}

function renderSchedule(state) {
  const cupChampion = state.cup?.championClubId ? clubById(state, state.cup.championClubId)?.name : null;
  return `${pageHeader('schedule')}<section class="division-standings-grid">${[1,2,3].map((division) => `<article class="card"><div class="card__header"><div><h3>日本${division}部</h3><p>上位3クラブが昇格圏、下位3クラブが降格圏</p></div></div>${standingsTable(state, division)}</article>`).join('')}</section><section class="grid-equal" style="margin-top:14px"><article class="card"><div class="card__header"><div><h3>自クラブ全日程</h3><p>リーグ38節＋全国王者杯</p></div></div><div class="fixture-scroll">${userFixtureList(state)}</div></article><article class="card"><div class="card__header"><div><h3>全国王者杯</h3><p>全60クラブ参加・一発勝負</p></div></div><div class="card__body"><div class="attribute-row"><span>現在ラウンド</span><strong>${state.cup?.round ?? '終了'}</strong></div><div class="attribute-row"><span>残存クラブ</span><strong>${state.cup?.activeClubIds?.length ?? 0}</strong></div><div class="attribute-row"><span>優勝クラブ</span><strong>${escapeHtml(cupChampion ?? '未決定')}</strong></div>${(state.cup?.history ?? []).length ? `<div class="cup-round-list">${state.cup.history.map((round) => `<div><span>${escapeHtml(round.roundName ?? `第${round.round}回戦`)}</span><strong>${round.fixtures.length}試合</strong></div>`).join('')}</div>` : emptyState('大会はこれからです', '最初のカップ週までリーグ戦を進めてください。', 'trophy')}</div></article></section>`;
}

function renderScoutingHub(state) {
  const shortlist = new Set((state.scoutingNetwork?.shortlist ?? []).map((item) => item.playerId));
  const negotiations = (state.transferNegotiations ?? []).filter((item) => ['open', 'countered'].includes(item.status));
  const negotiationHtml = negotiations.length ? `<div class="negotiation-list">${negotiations.map((negotiation) => { const player=state.transferMarket.find((item)=>item.id===negotiation.playerId); return `<div class="negotiation-row"><span><strong>${escapeHtml(player?.name ?? '交渉中の選手')}</strong><small>${negotiation.stage === 'agent' ? '代理人交渉' : negotiation.status === 'countered' ? `再提示要求 ${money(negotiation.counterFee)}` : 'クラブ回答待ち'} · 期限 WEEK ${negotiation.stage === 'agent' ? negotiation.agentDeadlineWeek : negotiation.deadlineWeek}</small></span>${negotiation.stage === 'agent' ? `<button class="btn btn--primary btn--sm" type="button" data-action="submit-agent-offer" data-negotiation-id="${negotiation.id}" data-wage="${player?.askingWage ?? player?.wage ?? 0}">要求条件で契約</button>` : `<button class="btn btn--secondary btn--sm" type="button" data-action="respond-club-offer" data-negotiation-id="${negotiation.id}">回答を確認</button>`}</div>`; }).join('')}</div>` : emptyState('進行中の交渉はありません','候補選手へクラブ間オファーを提示してください。','transfer');
  return `<section class="grid-equal scouting-hub"><article class="card"><div class="card__header"><div><h3>地域別スカウト網</h3><p>知識を蓄積すると推定範囲が狭まります</p></div></div><div class="card__body region-grid">${Object.values(state.scoutingNetwork?.regions ?? {}).map((region) => { const regionalCandidate = state.transferMarket?.find((item) => !item.region || item.region === region.region); return `<div class="region-card"><strong>${escapeHtml(region.region)}</strong><span>知識 ${region.knowledge} · 報告 ${region.reports}</span>${regionalCandidate ? `<button class="btn btn--ghost btn--sm" type="button" data-action="scout-regional-player" data-player-id="${regionalCandidate.id}" data-region="${escapeHtml(region.region)}">候補を視察</button>` : ''}</div>`; }).join('')}</div></article><article class="card"><div class="card__header"><div><h3>候補リスト</h3><p>${shortlist.size}名を追跡中</p></div></div><div class="card__body">${shortlist.size ? `<div class="shortlist-summary">${(state.scoutingNetwork.shortlist ?? []).slice(0,5).map((item) => { const player=state.transferMarket.find((candidate)=>candidate.id===item.playerId); return `<div><strong>${escapeHtml(player?.name ?? '候補選手')}</strong><span>${escapeHtml(item.neededPosition)} · ${item.scoutingProgress}%</span></div>`; }).join('')}</div>` : emptyState('候補リストは空です','市場の選手を候補へ追加してください。','search')}</div></article></section><article class="card" style="margin-top:14px"><div class="card__header"><div><h3>移籍・代理人交渉</h3><p>クラブ間合意後に選手条件を提示します</p></div></div><div class="card__body">${negotiationHtml}</div></article>`;
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
    ${renderScoutingHub(state)}
    <article class="card" style="margin-top:14px"><div class="filter-bar"><label class="field"><span>選手名</span><input data-market-search placeholder="検索"></label><label class="field"><span>ポジション</span><select data-market-position><option value="">すべて</option>${['GK','RB','LB','CB','DM','CM','AM','RW','LW','ST'].map((position) => `<option>${position}</option>`).join('')}</select></label></div><div class="table-wrap"><table class="data-table"><thead><tr><th>選手</th><th>POS</th><th>OVR</th><th>POT</th><th>スカウト</th><th>移籍金</th><th>給与</th><th>操作</th></tr></thead><tbody>
      ${sorted.map((player) => `<tr data-market-row data-name="${escapeHtml(player.name.toLowerCase())}" data-position="${player.position}"><td><span class="player-name"><span class="player-avatar">${escapeHtml(player.name.split(' ').map((part) => part[0]).join('').slice(0,2))}</span><span><strong>${escapeHtml(player.name)}</strong><span>${player.age}歳 · ${player.contractYears}年契約希望</span></span></span></td><td><span class="position-tag">${player.position}</span></td><td><span class="rating-number">${marketEstimate(player, 'overall')}</span></td><td>${marketEstimate(player, 'potential')}</td><td><span class="scout-confidence">${progressBar(player.scouting, 'スカウト精度')} ${player.scouting}%</span></td><td><span class="transfer-price">${money(player.askingPrice)}</span></td><td>${money(player.askingWage)}</td><td><div class="actions">${player.scouting < 100 ? `<button class="btn btn--ghost btn--sm" type="button" data-action="scout-player" data-player-id="${player.id}">${icon('search', 13)} 調査</button>` : ''}<button class="btn btn--ghost btn--sm" type="button" data-action="toggle-shortlist" data-player-id="${player.id}">${state.scoutingNetwork?.shortlist?.some((item) => item.playerId === player.id) ? '候補解除' : '候補追加'}</button><button class="btn btn--primary btn--sm" type="button" data-action="create-club-offer" data-player-id="${player.id}" data-fee="${player.askingPrice}">交渉開始</button></div></td></tr>`).join('')}
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

function playerStatTable(state, players, career = false) {
  const sorted = [...players].sort((a, b) => {
    const left = career ? (a.clubCareerStats?.goals ?? 0) : (a.goals ?? 0);
    const right = career ? (b.clubCareerStats?.goals ?? 0) : (b.goals ?? 0);
    return right - left || a.name.localeCompare(b.name, 'ja');
  });
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>選手</th><th>所属</th><th>出場</th><th>得点</th><th>アシスト</th><th>評価</th><th>MOM</th></tr></thead><tbody>${sorted.slice(0, 40).map((player) => {
    const club = player.clubId ? clubById(state, player.clubId) : null;
    const stats = career ? player.clubCareerStats ?? {} : player;
    return `<tr><td><strong>${escapeHtml(player.name)}</strong><span class="selection-role">${escapeHtml(player.position ?? '–')}</span></td><td>${escapeHtml(club?.shortName ?? (player.clubId === state.userClubId ? userClub(state).shortName : '退団'))}</td><td>${stats.appearances ?? 0}</td><td><strong>${stats.goals ?? 0}</strong></td><td>${stats.assists ?? 0}</td><td>${career ? '–' : (player.seasonRating ?? 0).toFixed(1)}</td><td>${stats.manOfTheMatch ?? 0}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function historicalUserPlayers(state) {
  const sources = [
    ...userPlayers(state),
    ...(state.history?.departedPlayers ?? []),
    ...(state.history?.retiredPlayers ?? [])
  ];
  const unique = new Map();
  for (const player of sources) {
    if (!player?.id) continue;
    const hasUserHistory = player.clubId === state.userClubId || (player.seasonHistory ?? []).some((entry) => entry.clubId === state.userClubId);
    if (!hasUserHistory) continue;
    if (!unique.has(player.id)) unique.set(player.id, player);
  }
  return [...unique.values()];
}

function userSeasonRows(state, players) {
  const rows = [];
  for (const player of players) {
    const seen = new Set();
    for (const entry of player.seasonHistory ?? []) {
      if (entry.clubId !== state.userClubId) continue;
      const key = `${player.id}:${entry.season}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ playerId: player.id, playerName: player.name, position: player.position, ...entry });
    }
    const currentlyAtUserClub = player.clubId === state.userClubId && state.players.some((item) => item.id === player.id);
    const departedThisSeason = player.clubId === state.userClubId && player.departureSeason === state.season;
    const currentKey = `${player.id}:${state.season}`;
    if ((currentlyAtUserClub || departedThisSeason) && !seen.has(currentKey)) {
      rows.push({
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        season: state.season,
        clubId: state.userClubId,
        division: userClub(state).division,
        appearances: player.appearances ?? 0,
        starts: player.starts ?? 0,
        minutes: player.minutes ?? 0,
        goals: player.goals ?? 0,
        assists: player.assists ?? 0,
        cleanSheets: player.cleanSheets ?? 0,
        manOfTheMatch: player.manOfTheMatch ?? 0,
        averageRating: player.seasonRating ?? 0
      });
    }
  }
  return rows.sort((a, b) => b.season - a.season || (b.goals ?? 0) - (a.goals ?? 0) || a.playerName.localeCompare(b.playerName, 'ja'));
}

function clubCareerPlayers(state) {
  const players = historicalUserPlayers(state);
  const rows = userSeasonRows(state, players);
  const totals = new Map(players.map((player) => [player.id, {
    id: player.id,
    name: player.name,
    position: player.position,
    clubId: state.userClubId,
    clubCareerStats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, manOfTheMatch: 0 }
  }]));
  for (const row of rows) {
    const player = totals.get(row.playerId);
    if (!player) continue;
    player.clubCareerStats.appearances += row.appearances ?? 0;
    player.clubCareerStats.goals += row.goals ?? 0;
    player.clubCareerStats.assists += row.assists ?? 0;
    player.clubCareerStats.cleanSheets += row.cleanSheets ?? 0;
    player.clubCareerStats.manOfTheMatch += row.manOfTheMatch ?? 0;
  }
  return [...totals.values()].filter((player) => player.clubCareerStats.appearances > 0 || player.clubCareerStats.goals > 0);
}

function clubRecordCards(state, players) {
  const leaders = {
    appearances: [...players].sort((a, b) => (b.clubCareerStats.appearances ?? 0) - (a.clubCareerStats.appearances ?? 0))[0],
    goals: [...players].sort((a, b) => (b.clubCareerStats.goals ?? 0) - (a.clubCareerStats.goals ?? 0))[0],
    assists: [...players].sort((a, b) => (b.clubCareerStats.assists ?? 0) - (a.clubCareerStats.assists ?? 0))[0],
    cleanSheets: [...players].filter((player) => player.position === 'GK').sort((a, b) => (b.clubCareerStats.cleanSheets ?? 0) - (a.clubCareerStats.cleanSheets ?? 0))[0]
  };
  return `<section class="metrics-grid">${metricCard('最多出場', leaders.appearances?.name ?? '–', `${leaders.appearances?.clubCareerStats.appearances ?? 0}試合`, 'squad')}${metricCard('最多得点', leaders.goals?.name ?? '–', `${leaders.goals?.clubCareerStats.goals ?? 0}得点`, 'trophy')}${metricCard('最多アシスト', leaders.assists?.name ?? '–', `${leaders.assists?.clubCareerStats.assists ?? 0}アシスト`, 'star')}${metricCard('最多無失点', leaders.cleanSheets?.name ?? '–', `${leaders.cleanSheets?.clubCareerStats.cleanSheets ?? 0}試合`, 'shield')}</section>`;
}

function seasonHistoryTable(rows) {
  if (!rows.length) return emptyState('シーズン別成績はまだありません', '試合を進めると選手ごとのシーズン記録が蓄積されます。', 'calendar');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>シーズン</th><th>選手</th><th>部門</th><th>出場</th><th>得点</th><th>アシスト</th><th>評価</th></tr></thead><tbody>${rows.slice(0, 160).map((row) => `<tr><td>S${row.season}</td><td><strong>${escapeHtml(row.playerName)}</strong><span class="selection-role">${escapeHtml(row.position ?? '–')}</span></td><td>日本${row.division ?? '–'}部</td><td>${row.appearances ?? 0}</td><td><strong>${row.goals ?? 0}</strong></td><td>${row.assists ?? 0}</td><td>${(row.averageRating ?? 0).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderManagerCareer(state) {
  const profile = state.managerProfile;
  const offers = (state.managerOffers ?? []).filter((item) => item.status === 'open' && item.expiresWeek >= state.week);
  return `<section class="grid-equal manager-career"><article class="card"><div class="card__header"><div><h3>監督プロフィール</h3><p>${escapeHtml(profile.birthplace)} · 得意 ${escapeHtml(profile.preferredTactic)}</p></div><span class="prospect-score">${profile.level}</span></div><div class="card__body"><div class="attribute-row"><span>評判</span><strong>${Math.round(profile.reputation)}</strong></div><div class="attribute-row"><span>通算</span><strong>${profile.matches}試合 ${profile.wins}勝 ${profile.draws}分 ${profile.losses}敗</strong></div><div class="attribute-row"><span>若手育成</span><strong>${profile.youthDevelopment}</strong></div><div class="attribute-row"><span>財務評価</span><strong>${profile.financeRating}</strong></div></div></article><article class="card"><div class="card__header"><div><h3>監督オファー</h3><p>評判と実績に応じて届きます</p></div></div><div class="card__body">${offers.length ? offers.map((offer) => `<div class="manager-offer"><span><strong>${escapeHtml(offer.clubName)}</strong><small>日本${offer.division}部 · 期限 WEEK ${offer.expiresWeek}</small></span><button class="btn btn--primary btn--sm" type="button" data-action="accept-manager-offer" data-offer-id="${offer.id}">就任する</button></div>`).join('') : emptyState('現在オファーはありません','結果を積み重ねると他クラブから届きます。','trophy')}</div></article></section>`;
}

function renderRecords(state) {
  const current = [...state.players];
  const careerPlayers = clubCareerPlayers(state);
  const seasonRows = userSeasonRows(state, historicalUserPlayers(state));
  const awards = state.history?.awards ?? [];
  const scorer = [...state.players].sort((a,b)=>(b.goals??0)-(a.goals??0))[0];
  const assister = [...state.players].sort((a,b)=>(b.assists??0)-(a.assists??0))[0];
  return `${pageHeader('records')}${renderManagerCareer(state)}<section class="metrics-grid" style="margin-top:14px">${metricCard('現在の得点王', scorer?.name ?? '–', `${scorer?.goals ?? 0}得点`, 'trophy')}${metricCard('現在のアシスト王', assister?.name ?? '–', `${assister?.assists ?? 0}アシスト`, 'star')}${metricCard('歴代シーズン', `${state.history?.seasons?.length ?? 0}`, '完了したシーズン', 'calendar')}${metricCard('引退・退団選手', `${(state.history?.retiredPlayers?.length ?? 0) + (state.history?.departedPlayers?.length ?? 0)}名`, 'クラブ在籍記録を保存', 'squad')}</section>
    <div class="page-header page-header--compact" style="margin-top:22px"><div><h2>クラブ通算記録</h2><p>${escapeHtml(userClub(state).name)}で残した成績を、現役・退団・引退選手を通して集計します。</p></div></div>
    ${clubRecordCards(state, careerPlayers)}
    <section class="grid-equal" style="margin-top:14px"><article class="card"><div class="card__header"><div><h3>今季個人成績</h3><p>全3部のランキング</p></div></div>${playerStatTable(state, current, false)}</article><article class="card"><div class="card__header"><div><h3>自クラブ通算成績</h3><p>現役・退団・引退選手を含む</p></div></div>${careerPlayers.length ? playerStatTable(state, careerPlayers, true) : emptyState('通算記録はまだありません', '試合を進めるとクラブ記録が蓄積されます。', 'squad')}</article></section>
    <article class="card" style="margin-top:14px"><div class="card__header"><div><h3>シーズン別成績</h3><p>自クラブ在籍時の個人成績履歴</p></div></div>${seasonHistoryTable(seasonRows)}</article>
    <article class="card" style="margin-top:14px"><div class="card__header"><div><h3>個人タイトル履歴</h3><p>得点王・アシスト王・年間MVP・若手・GK・ベストXI</p></div></div><div class="card__body">${awards.length ? awards.map((award) => `<section class="award-season"><h4>シーズン ${award.season}</h4><div class="award-grid"><div><span>得点王</span><strong>${escapeHtml(award.topScorer?.playerName ?? '–')}</strong><small>${award.topScorer?.value ?? 0}得点</small></div><div><span>アシスト王</span><strong>${escapeHtml(award.topAssists?.playerName ?? '–')}</strong><small>${award.topAssists?.value ?? 0}</small></div><div><span>年間MVP</span><strong>${escapeHtml(award.playerOfTheYear?.playerName ?? '–')}</strong><small>${award.playerOfTheYear?.value ?? 0}</small></div><div><span>最優秀若手</span><strong>${escapeHtml(award.bestYoungPlayer?.playerName ?? '–')}</strong></div><div><span>最優秀GK</span><strong>${escapeHtml(award.bestGoalkeeper?.playerName ?? '–')}</strong></div></div></section>`).join('') : emptyState('まだ個人タイトルはありません', 'シーズン終了時に各賞が記録されます。', 'trophy')}</div></article>`;
}

function renderSecretary(state) {
  const report = state.secretaryReport;
  if (!report) return `${pageHeader('secretary')}${emptyState('レポートを準備中です', '次の週へ進むと秘書が情報を整理します。', 'star')}`;
  return `${pageHeader('secretary')}<section class="metrics-grid">${metricCard('次戦', report.nextMatch?.opponentName ?? '予定なし', report.nextMatch ? `${report.nextMatch.competition} · WEEK ${report.nextMatch.week}` : 'シーズン終了', 'calendar')}${metricCard('平均体力', `${report.squad.averageFitness}%`, `負傷 ${report.squad.injured}名`, 'pulse', report.squad.averageFitness < 60 ? 'warning' : '')}${metricCard('移籍希望', `${report.squad.unhappy}名`, '不満と契約を確認', 'squad', report.squad.unhappy ? 'danger' : '')}${metricCard('配分可能現金', money(report.budgets.availableCash), `予備資金 ${money(report.budgets.reserveCash)}`, 'money')}</section><article class="card" style="margin-top:14px"><div class="card__header"><div><h3>秘書からの優先報告</h3><p>WEEK ${report.generatedWeek}時点</p></div></div><div class="card__body">${report.alerts.length ? `<div class="alert-list">${report.alerts.map((alert) => `<div class="alert-item"><span class="alert-item__icon">${icon(alert.type === 'budget' ? 'money' : alert.type === 'contract' ? 'calendar' : 'warning', 16)}</span><div><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail)}</span></div><button type="button" data-nav="${alert.view}">${icon('chevron', 16)}</button></div>`).join('')}</div>` : emptyState('緊急事項はありません', '選手状態・契約・予算に大きな問題はありません。', 'star')}</div></article><section class="grid-equal" style="margin-top:14px"><article class="card"><div class="card__header"><div><h3>次戦メモ</h3></div></div><div class="card__body">${report.nextMatch ? `<div class="attribute-row"><span>対戦相手</span><strong>${escapeHtml(report.nextMatch.opponentName)}</strong></div><div class="attribute-row"><span>大会</span><strong>${escapeHtml(report.nextMatch.competition)}</strong></div><div class="attribute-row"><span>会場</span><strong>${report.nextMatch.home ? 'ホーム' : 'アウェイ'}</strong></div><div class="attribute-row"><span>相手評判</span><strong>${report.nextMatch.opponentReputation}</strong></div>` : emptyState('次戦はありません', 'シーズン日程が完了しています。', 'calendar')}</div></article><article class="card"><div class="card__header"><div><h3>予算メモ</h3></div></div><div class="card__body"><div class="attribute-row"><span>現金</span><strong>${money(report.budgets.cash)}</strong></div><div class="attribute-row"><span>移籍予算</span><strong>${money(report.budgets.transferBudget)}</strong></div><div class="attribute-row"><span>給与予算</span><strong>${money(report.budgets.wageBudget)}</strong></div><button class="btn btn--secondary" type="button" data-nav="club">クラブ経営を開く</button></div></article></section>`;
}

const FACILITY_META = {
  training: ['トレーニングセンター', '選手の成長率と戦術理解の向上に影響します。', 'tactics'],
  academy: ['ユースアカデミー', '若手の初期能力・ポテンシャル・成長率に影響します。', 'academy'],
  scouting: ['スカウト部門', '移籍候補の情報精度と調査費用に影響します。', 'search'],
  stadium: ['スタジアム', '収容人数とホームゲーム収入を増加させます。', 'club']
};

function renderBoardAndStaff(state) {
  const evaluation = state.boardEvaluation;
  const staff = state.staff ?? [];
  const market = (state.staffMarket ?? []).slice(0, 9);
  return `<section class="grid-equal club-life-hub"><article class="card"><div class="card__header"><div><h3>理事会評価</h3><p>${evaluation.status === 'secure' ? '安定' : evaluation.status === 'warning' ? '警告' : evaluation.status === 'final-warning' ? '最終警告' : '解任'}</p></div><span class="prospect-score">${evaluation.overall}</span></div><div class="card__body"><div class="objective-actions">${[['safe','安全'],['standard','標準'],['challenge','挑戦']].map(([level,label]) => `<button class="btn ${evaluation.objective?.level === level ? 'btn--selected' : 'btn--ghost'} btn--sm" type="button" data-action="choose-season-objective" data-level="${level}">${label}</button>`).join('')}</div><div class="board-axis-grid">${Object.entries(evaluation.axes).map(([axis,value]) => `<span><small>${escapeHtml(axis)}</small><strong>${Math.round(value)}</strong></span>`).join('')}</div></div></article><article class="card"><div class="card__header"><div><h3>スタッフ部門</h3><p>任命済み ${staff.length}名</p></div></div><div class="card__body"><div class="staff-list">${staff.slice(0,9).map((member) => `<div><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.roleLabel)} · 能力${member.ability} · 残${member.contractWeeks}週${member.interim ? ' · 代行' : ''}</small></span></div>`).join('')}</div><h4>市場候補</h4><div class="staff-market">${market.map((candidate) => `<button type="button" data-action="appoint-staff" data-staff-id="${candidate.id}"><span><strong>${escapeHtml(candidate.name)}</strong><small>${escapeHtml(candidate.roleLabel)} · 能力${candidate.ability}</small></span><b>${money(candidate.signingFee)}</b></button>`).join('')}</div></div></article></section>`;
}

function renderClub(state) {
  const club = userClub(state);
  const wages = clubWeeklyWages(state, club.id);
  const ledger = state.finances.ledger.filter((item) => item.clubId === club.id).slice(0, 20);
  const available = Math.max(0, club.cash - (club.reserveCash ?? 0));
  const allocationOptions = [50_000_000, 100_000_000, 300_000_000];
  return `${pageHeader('club')}${renderBoardAndStaff(state)}<section class="metrics-grid" style="margin-top:14px">${metricCard('現金残高', money(club.cash), `理事会予備 ${money(club.reserveCash ?? 0)}`, 'money')}${metricCard('移籍予算', money(club.transferBudget), `配分可能 ${money(available)}`, 'transfer')}${metricCard('週間給与', money(wages), `上限 ${money(club.wageBudget)}`, 'pulse', wages > club.wageBudget * .9 ? 'warning' : '')}${metricCard('所属リーグ', club.divisionName, `取締役会 ${club.boardConfidence}%`, 'trophy')}</section><article class="card" style="margin-top:14px"><div class="card__header"><div><h3>移籍予算の追加配分</h3><p>現金から予備資金を残して補強予算へ移します</p></div></div><div class="card__body"><div class="budget-actions">${allocationOptions.map((amount) => `<button class="btn btn--secondary" type="button" data-action="allocate-transfer-budget" data-amount="${amount}" ${available < amount ? 'disabled' : ''}>${money(amount)}を配分</button>`).join('')}</div></div></article><section class="facility-grid" style="margin-top:14px">${Object.entries(FACILITY_META).map(([id,[title,description,iconName]]) => { const level=club.facilities[id]; const cost=facilityUpgradeCost(club,id); return `<article class="card facility-card"><div class="facility-card__top"><div><span class="eyebrow">${icon(iconName,15)} FACILITY</span><h3 style="margin-top:9px">${title}</h3><p>${description}</p></div><span class="prospect-score">${level}</span></div><div class="level-dots">${Array.from({length:5},(_,index)=>`<span class="level-dot ${index<level?'is-filled':''}"></span>`).join('')}</div><button class="btn btn--secondary" type="button" data-action="upgrade-facility" data-facility="${id}" ${cost===null||club.cash<cost?'disabled':''}>${cost===null?'最大レベル':`強化 ${money(cost)}`}</button></article>`; }).join('')}</section><section class="project-grid" style="margin-top:14px">${Object.entries(PROJECTS).map(([id,project])=>{ const level=club.projects?.[id]??0; const cost=clubProjectCost(club,id); return `<article class="card facility-card"><div class="facility-card__top"><div><span class="eyebrow">LONG TERM PROJECT</span><h3>${escapeHtml(project.label)}</h3><p>レベル${level} · 週間維持費 ${money(project.weeklyMaintenance*level)}</p></div><span class="prospect-score">${level}</span></div><button class="btn btn--secondary" type="button" data-action="invest-project" data-project-id="${id}" ${club.cash-cost<(club.reserveCash??0)?'disabled':''}>投資 ${money(cost)}</button></article>`;}).join('')}</section><section class="grid-equal" style="margin-top:14px"><article class="card"><div class="card__header"><div><h3>財務履歴</h3><p>直近20件</p></div></div>${ledger.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>週</th><th>項目</th><th>区分</th><th>金額</th></tr></thead><tbody>${ledger.map((item)=>`<tr><td>W${item.week}</td><td>${escapeHtml(item.label)}</td><td>${item.type==='income'?'収入':'支出'}</td><td class="${item.amount>=0?'text-accent':'text-danger'}">${item.amount>=0?'+':''}${formatMoney(item.amount)}</td></tr>`).join('')}</tbody></table></div>`:emptyState('財務履歴はありません','試合週を進めると記録されます。','money')}</article><article class="card"><div class="card__header"><div><h3>クラブプロフィール</h3><p>${escapeHtml(club.city)} · ${escapeHtml(club.stadium)}</p></div>${clubBadge(club,'md')}</div><div class="card__body"><div class="attribute-row"><span>評判</span><strong>${club.reputation}</strong></div><div class="attribute-row"><span>スポンサー週間収入</span><strong>${money(club.sponsorWeekly)}</strong></div><div class="attribute-row"><span>スタジアム収容</span><strong>${club.capacity.toLocaleString('ja-JP')}人</strong></div><div class="attribute-row"><span>売却益還元率</span><strong>${Math.round((club.saleRetention??.75)*100)}%</strong></div></div></article></section>`;
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
    case 'records': return renderRecords(state);
    case 'secretary': return renderSecretary(state);
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

function liveSelect(key, current, options) {
  return `<label><span>${escapeHtml(TACTIC_LABELS[key]?.[0] ?? key)}</span><select class="control-select" data-live-tactic="${key}">${Object.entries(options).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`;
}

function liveMatchPitch(session) {
  const home = session.sides.home;
  const away = session.sides.away;
  const renderSide = (side, sideName) => {
    const players = new Map(side.players.map((player) => [player.id, player]));
    return side.lineup.map((entry) => {
      const player = players.get(entry.playerId);
      const y = sideName === 'home' ? entry.y : 100 - entry.y;
      const fitness = Math.round(session.liveFitness[entry.playerId] ?? player?.fitness ?? 0);
      return `<span class="live-pitch-player live-pitch-player--${sideName}" style="left:${entry.x}%;top:${y}%" title="${escapeHtml(player?.name ?? '')} · 体力${fitness}"><b>${escapeHtml((player?.name ?? '–').replace(/\s/g, '').slice(-2))}</b><small>${fitness}</small></span>`;
    }).join('');
  };
  return `<div class="live-pitch" aria-label="2D試合盤"><span class="live-pitch__half"></span><span class="live-pitch__circle"></span><span class="live-pitch__box live-pitch__box--top"></span><span class="live-pitch__box live-pitch__box--bottom"></span><span class="live-ball" style="left:${48 + (session.score.home - session.score.away) * 3}%;top:${session.minute < 45 ? 54 : 46}%">⚽</span>${renderSide(home, 'home')}${renderSide(away, 'away')}</div>`;
}

export function renderLiveMatchCenter(state, session) {
  const home = session.sides.home.club;
  const away = session.sides.away.club;
  const user = session.sides[session.userSide];
  const userPlayers = new Map(user.players.map((player) => [player.id, player]));
  const possessionDuration = session.totals.duration || 1;
  const homePossession = Math.round(session.totals.possessionWeighted.home / possessionDuration) || 50;
  const awayPossession = 100 - homePossession;
  const phases = [45, 60, 75, 90];
  const nextMinute = phases[session.phaseIndex] ?? 90;
  const recentEvents = session.events.slice(-12).reverse();
  const lineupOptions = user.lineup
    .map((entry) => {
      const player = userPlayers.get(entry.playerId);
      return `<option value="${entry.playerId}">${escapeHtml(player?.name ?? '不明')} · ${entry.slotPosition} · 体力${Math.round(session.liveFitness[entry.playerId] ?? 0)} · 評価${session.liveRatings[entry.playerId] ?? 6.5}</option>`;
    }).join('');
  const benchOptions = user.bench
    .map((playerId) => userPlayers.get(playerId))
    .filter(Boolean)
    .map((player) => `<option value="${player.id}">${escapeHtml(player.name)} · ${player.position} · OVR ${player.overall} · 体力${Math.round(session.liveFitness[player.id] ?? player.fitness)}</option>`).join('');
  const tactics = user.tactics;
  const timeline = [
    ['前半', 45], ['60分', 60], ['75分', 75], ['終了', 90]
  ].map(([label, minute], index) => `<span class="live-phase ${session.phaseIndex > index ? 'is-complete' : session.phaseIndex === index ? 'is-current' : ''}"><b>${label}</b><small>${minute}'</small></span>`).join('');
  const finished = session.completed;
  return `<div class="modal-backdrop live-match-backdrop"><section class="live-match-center" data-live-match role="dialog" aria-modal="true" aria-label="ライブ試合センター">
    <header class="live-match-header"><div class="live-match-header__meta"><span class="live-pill">${finished ? 'FULL TIME' : 'TACTICAL LIVE'}</span><span>${session.minute}' · 交代 ${user.substitutionsUsed}/5</span></div><div class="live-match-scoreboard"><div>${clubBadge(home, 'md')}<strong>${escapeHtml(home.name)}</strong></div><p><b>${session.score.home}</b><span>–</span><b>${session.score.away}</b><small>${finished ? '試合終了' : `${nextMinute}分まで進行`}</small></p><div>${clubBadge(away, 'md')}<strong>${escapeHtml(away.name)}</strong></div></div><div class="live-phase-track">${timeline}</div></header>
    <div class="live-match-layout">
      <main class="live-match-stage">
        ${liveMatchPitch(session)}
        <div class="live-match-stat-strip"><span><small>支配率</small><strong>${homePossession}% - ${awayPossession}%</strong></span><span><small>シュート</small><strong>${session.totals.homeShots} - ${session.totals.awayShots}</strong></span><span><small>xG</small><strong>${session.totals.homeXg.toFixed(2)} - ${session.totals.awayXg.toFixed(2)}</strong></span></div>
        <section class="live-commentary"><div class="section-mini-header"><strong>試合の流れ</strong><span>最新の出来事</span></div>${recentEvents.length ? recentEvents.map((event) => `<div class="live-commentary__item live-commentary__item--${event.type}"><time>${event.minute}'</time><span>${eventIcon(event.type)}</span><p>${escapeHtml(event.text)}</p></div>`).join('') : '<p class="muted">キックオフを待っています。</p>'}</section>
      </main>
      <aside class="live-command-panel">
        <div class="live-command-panel__title"><span class="eyebrow">MANAGER COMMAND</span><h3>${finished ? '試合結果' : '次の区間への指示'}</h3><p>${finished ? '結果を確定してクラブへ戻ります。' : '変更は次の区間だけに反映されます。'}</p></div>
        ${finished ? `<div class="live-final-summary"><strong>${session.score[session.userSide]}得点</strong><span>交代${user.substitutionsUsed}人 · 警告${session.totals[session.userSide === 'home' ? 'homeCards' : 'awayCards']}枚</span></div>` : `<div class="live-tactics-grid">
          ${liveSelect('formation', tactics.formation, Object.fromEntries(Object.keys(FORMATIONS).map((value) => [value, value])))}
          ${liveSelect('mentality', tactics.mentality, TACTIC_LABELS.mentality[1])}
          ${liveSelect('pressing', tactics.pressing, TACTIC_LABELS.pressing[1])}
          ${liveSelect('tempo', tactics.tempo, TACTIC_LABELS.tempo[1])}
          ${liveSelect('passing', tactics.passing, TACTIC_LABELS.passing[1])}
          ${liveSelect('defensiveLine', tactics.defensiveLine, TACTIC_LABELS.defensiveLine[1])}
          ${liveSelect('focus', tactics.focus, TACTIC_LABELS.focus[1])}
          ${liveSelect('width', tactics.width, TACTIC_LABELS.width[1])}
        </div><div class="live-substitution"><div class="section-mini-header"><strong>手動交代</strong><span>残り ${Math.max(0, 5 - user.substitutionsUsed)}人</span></div><label><span>OUT</span><select class="control-select" data-live-player-out><option value="">交代する選手</option>${lineupOptions}</select></label><label><span>IN</span><select class="control-select" data-live-player-in><option value="">投入する選手</option>${benchOptions}</select></label><button class="btn btn--secondary btn--wide" type="button" data-command="live-substitute" ${!benchOptions || user.substitutionsUsed >= 5 ? 'disabled' : ''}>選手交代を実行</button></div>`}
      </aside>
    </div>
    <footer class="live-match-actions">${finished ? `<button class="btn btn--primary" type="button" data-command="live-finish">結果を確定して戻る</button>` : `<button class="btn btn--ghost" type="button" data-command="live-skip">残りを自動で進める</button><button class="btn btn--primary" type="button" data-command="live-advance">${nextMinute}分まで進める ${icon('play', 17)}</button>`}</footer>
  </section></div>`;
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
