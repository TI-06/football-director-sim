export const DESKTOP_CATEGORIES = [
  { id: 'home', label: 'ホーム', view: 'dashboard', icon: 'dashboard', shortcut: 'H' },
  { id: 'match', label: '試合', view: 'schedule', icon: 'calendar', shortcut: 'M' },
  { id: 'team', label: 'チーム', view: 'squad', icon: 'squad', shortcut: 'S' },
  { id: 'transfers', label: '移籍', view: 'transfers', icon: 'transfer', shortcut: 'T' },
  { id: 'club', label: 'クラブ', view: 'club', icon: 'club', shortcut: 'C' },
  { id: 'career', label: 'キャリア', view: 'records', icon: 'trophy', shortcut: 'R' }
];

const VIEW_CATEGORY = {
  dashboard: 'home', inbox: 'home', secretary: 'home',
  schedule: 'match', tactics: 'match',
  squad: 'team', academy: 'team',
  transfers: 'transfers', club: 'club', records: 'career'
};

export function categoryForView(view) {
  return VIEW_CATEGORY[view] ?? 'home';
}

export function shortcutView(key) {
  const normalized = String(key ?? '').toUpperCase();
  return DESKTOP_CATEGORIES.find((category) => category.shortcut === normalized)?.view ?? null;
}
