import { clubBadge, escapeHtml, icon } from './templates.js';

const PRIMARY_ITEMS = [
  ['dashboard', 'ホーム', 'dashboard'],
  ['schedule', '試合', 'calendar'],
  ['squad', '編成', 'squad'],
  ['transfers', '移籍', 'transfer']
];

const DESKTOP_ITEMS = [
  ['dashboard', 'ホーム', 'dashboard'],
  ['tactics', '戦術', 'tactics'],
  ['schedule', '試合', 'calendar'],
  ['squad', '編成', 'squad'],
  ['transfers', '移籍', 'transfer'],
  ['club', '経営', 'club'],
  ['records', '記録', 'trophy']
];

const VIEW_GROUP = {
  dashboard: 'dashboard', secretary: 'dashboard', inbox: 'dashboard',
  schedule: 'schedule', tactics: 'schedule',
  squad: 'squad', academy: 'squad',
  transfers: 'transfers',
  club: 'menu', records: 'menu'
};

function userClub(state) {
  return state.clubs.find((club) => club.id === state.userClubId);
}

function navItem(id, label, iconName, active, desktop = false) {
  const classes = desktop ? 'fd2-desktop-nav__item' : 'fd2-nav__item nav__item';
  return `<button class="${classes} ${active ? 'is-active' : ''}" type="button" data-nav="${id}" aria-current="${active ? 'page' : 'false'}">${icon(iconName, 20)}<span>${escapeHtml(label)}</span></button>`;
}

export function mobileShellV2(state, currentView, content, uiState = {}) {
  const club = userClub(state);
  const active = VIEW_GROUP[currentView] ?? 'dashboard';
  const unresolved = (state.inbox ?? []).filter((item) => item.kind === 'decision' && !item.resolved).length;
  const primary = PRIMARY_ITEMS.map(([id, label, iconName]) => navItem(id, label, iconName, active === id)).join('');
  const desktop = DESKTOP_ITEMS.map(([id, label, iconName]) => navItem(id, label, iconName, currentView === id, true)).join('');
  const menu = `<button class="fd2-nav__item nav__item ${active === 'menu' ? 'is-active' : ''}" type="button" data-command="open-game-menu" aria-label="その他のメニュー">${icon('club', 20)}<span>メニュー</span>${unresolved ? `<b class="fd2-nav__badge">${unresolved}</b>` : ''}</button>`;
  return `<div class="fd2-shell app-shell">
    <header class="fd2-topbar topbar">
      <div class="fd2-topbar__club">${clubBadge(club, 'sm')}<div><strong>${escapeHtml(club.name)}</strong><span>${escapeHtml(club.divisionName)} · S${state.season} W${state.week}</span></div></div>
      <div class="fd2-topbar__actions">
        ${uiState.autoAdvanceActive ? `<span class="fd2-auto-status">${icon('pulse', 14)} 自動進行中</span>` : ''}
        <button type="button" data-command="cloud-save" aria-label="クラウドへ保存">${icon('save', 18)}</button>
      </div>
    </header>
    <nav class="fd2-desktop-nav sidebar" aria-label="PCメニュー">${desktop}</nav>
    <main class="fd2-main content" data-current-view="${escapeHtml(currentView)}">${content}</main>
    <nav class="fd2-nav mobile-nav" aria-label="メインメニュー">${primary}${menu}</nav>
  </div>`;
}
