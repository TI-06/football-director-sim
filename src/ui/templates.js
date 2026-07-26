import { formatMoney } from '../core/utils.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function icon(name, size = 20) {
  const paths = {
    dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z"/>',
    squad: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    tactics: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 7.5 11 16M16 7.5 13 16M8 6h8"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    transfer: '<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/>',
    academy: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m7 11.5-2 6.5 7 3 7-3-2-6.5M21 9v6"/>',
    club: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
    inbox: '<path d="M4 4h16v16H4z"/><path d="M4 14h4l2 3h4l2-3h4"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    warning: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M8 8h8M9 12h6M12 8v9"/>',
    pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4"/>',
    arrowUp: '<path d="m18 15-6-6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    star: '<path d="m12 2 3 6 7 .9-5 4.8 1.2 6.8L12 17.3 5.8 20.5 7 13.7 2 8.9 9 8z"/>'
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.dashboard}</svg>`;
}

export function clubBadge(club, size = 'md') {
  return `<span class="club-badge club-badge--${size}" style="--club-primary:${escapeHtml(club.primary)};--club-secondary:${escapeHtml(club.secondary)}" aria-label="${escapeHtml(club.name)}">
    <span>${escapeHtml(club.shortName)}</span>
  </span>`;
}

export function metricCard(label, value, meta = '', iconName = 'pulse', tone = '') {
  return `<article class="metric-card ${tone ? `metric-card--${tone}` : ''}">
    <div class="metric-card__icon">${icon(iconName, 19)}</div>
    <div><p class="metric-card__label">${escapeHtml(label)}</p><p class="metric-card__value">${value}</p>${meta ? `<p class="metric-card__meta">${meta}</p>` : ''}</div>
  </article>`;
}

export function formDots(form = []) {
  if (!form.length) return '<span class="muted">–</span>';
  return `<span class="form-dots" aria-label="直近成績 ${form.join(',')}">${form.map((result) => `<span class="form-dot form-dot--${result.toLowerCase()}">${result}</span>`).join('')}</span>`;
}

export function progressBar(value, label = '', tone = 'accent') {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="progress" aria-label="${escapeHtml(label)} ${safe}%"><span class="progress__fill progress__fill--${tone}" style="width:${safe}%"></span></div>`;
}

export function money(value) {
  return escapeHtml(formatMoney(value));
}

export function sectionHeader(title, description = '', action = '') {
  return `<header class="section-header"><div><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${action}</header>`;
}

export function emptyState(title, body, iconName = 'inbox') {
  return `<div class="empty-state">${icon(iconName, 34)}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}
