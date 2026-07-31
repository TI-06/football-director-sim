import { escapeHtml, icon, clubBadge } from './templates.js';

export function statusBadge(label, tone = 'neutral', detail = '') {
  return `<span class="fd2-status fd2-status--${tone}"><b>${escapeHtml(label)}</b>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>`;
}

export function metricTile(label, value, detail = '', tone = 'neutral') {
  return `<article class="fd2-metric fd2-metric--${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</article>`;
}

export function sectionHeader(title, description = '', action = '') {
  return `<header class="fd2-section-header"><div><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${action}</header>`;
}

export function actionButton({ label, command = '', nav = '', iconName = 'play', tone = 'primary', disabled = false, extra = '' }) {
  const attrs = command ? `data-command="${command}"` : nav ? `data-nav="${nav}"` : '';
  return `<button class="fd2-action fd2-action--${tone}" type="button" ${attrs} ${disabled ? 'disabled' : ''} ${extra}>${icon(iconName, 18)}<span>${escapeHtml(label)}</span></button>`;
}

export function matchCard({ fixture, home, away, userClubId, label = '次戦', detail = '', action = true }) {
  if (!fixture || !home || !away) return '';
  const isHome = fixture.homeId === userClubId;
  return `<article class="fd2-match-card">
    <div class="fd2-match-card__meta"><span>${escapeHtml(label)}</span><b>${escapeHtml(detail || `WEEK ${fixture.week}`)}</b></div>
    <div class="fd2-match-card__teams">
      <div>${clubBadge(home, 'md')}<strong>${escapeHtml(home.shortName || home.name)}</strong></div>
      <p><span>${isHome ? 'HOME' : 'AWAY'}</span><b>VS</b><small>${fixture.competition === 'cup' ? '全国王者杯' : 'リーグ戦'}</small></p>
      <div>${clubBadge(away, 'md')}<strong>${escapeHtml(away.shortName || away.name)}</strong></div>
    </div>
    ${action ? `<button class="fd2-match-card__start" type="button" data-command="play-week">${icon('play', 18)} 試合を開始</button>` : ''}
  </article>`;
}

export function emptyPanel(title, body) {
  return `<div class="fd2-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`;
}

export function legacyPanel(content, className = '') {
  return `<section class="fd2-legacy-panel ${className}">${content}</section>`;
}
