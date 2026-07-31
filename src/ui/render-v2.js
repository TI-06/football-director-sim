import {
  renderApplication as renderLegacyApplication,
  renderMatchModal,
  renderNewGame
} from './render.js';
import { renderLiveMatchCenterV2 } from './live-match-view-v2.js';
import { renderDashboardV2, renderScheduleV2, decorateLegacyView } from './mobile-screens-v2.js';
import { mobileShellV2 } from './mobile-shell-v2.js';

const VALID_VIEWS = new Set(['dashboard', 'schedule', 'squad', 'transfers', 'tactics', 'academy', 'records', 'secretary', 'club', 'inbox']);

function extractLegacyWorkspace(html) {
  const marker = '<main class="workspace">';
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const contentStart = start + marker.length;
  const end = html.indexOf('</main>', contentStart);
  return end < 0 ? html.slice(contentStart) : html.slice(contentStart, end);
}

function renderContent(state, currentView, uiState) {
  if (currentView === 'dashboard') return renderDashboardV2(state, uiState);
  if (currentView === 'schedule') return renderScheduleV2(state);
  const legacy = renderLegacyApplication(state, currentView, uiState);
  return decorateLegacyView(currentView, extractLegacyWorkspace(legacy));
}

export function renderApplication(state, currentView = 'dashboard', uiState = {}) {
  const safeView = VALID_VIEWS.has(currentView) ? currentView : 'dashboard';
  return mobileShellV2(state, safeView, renderContent(state, safeView, uiState), uiState);
}

export function renderLiveMatchCenter(state, session) {
  return renderLiveMatchCenterV2(state, session);
}

export { renderMatchModal, renderNewGame };
