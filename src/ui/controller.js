import { createNewGame, performAction, playNextWeek } from '../game/game-engine.js';
import { deserializeGame, serializeGame } from '../game/save.js';
import { autoAdvanceStopReason, unresolvedDecisionIds } from './auto-advance.js';
import { renderApplication, renderMatchModal, renderNewGame } from './render.js';
import { compareSquadRows, matchesSquadFilters } from './squad-controls.js';

const STORAGE_KEY = 'football-director-save-v2';
const AUTO_ADVANCE_DELAY = 650;

let state = null;
let currentView = 'dashboard';
let matchTimer = null;
let autoAdvanceTimer = null;
let autoAdvanceActive = false;
let autoAdvanceMessage = '';
let draggedPlayerId = null;
let draggedElement = null;

const squadViewState = {
  sort: 'role',
  order: 'desc',
  role: '',
  position: ''
};

function elements() {
  return {
    app: document.querySelector('#app'),
    modalRoot: document.querySelector('#modal-root'),
    toastRegion: document.querySelector('#toast-region'),
    importInput: document.querySelector('#save-import')
  };
}

function readStoredGame() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? deserializeGame(text) : null;
  } catch (error) {
    console.warn('Save load failed:', error);
    return null;
  }
}

function persist() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeGame(state));
  } catch (error) {
    console.warn('Autosave failed:', error);
    notify('自動保存に失敗しました。ブラウザの保存容量を確認してください。', 'error');
  }
}

function render() {
  const { app } = elements();
  app.innerHTML = state
    ? renderApplication(state, currentView, { autoAdvanceActive, autoAdvanceMessage })
    : renderNewGame();
  document.title = state ? `${state.clubs.find((club) => club.id === state.userClubId)?.name ?? 'Football Director'} | Football Director` : 'Football Director';
  if (state && currentView === 'squad') applySquadFilters(false);
}

function notify(message, type = 'success') {
  const { toastRegion } = elements();
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
  toast.innerHTML = `${type === 'error' ? '⚠' : '✓'} <span>${String(message).replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>`;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function clearAutoAdvanceTimer() {
  if (autoAdvanceTimer) window.clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = null;
}

function cancelAutoAdvance(message = '') {
  clearAutoAdvanceTimer();
  autoAdvanceActive = false;
  autoAdvanceMessage = message;
}

function stopAutoAdvance(message, { notifyUser = false, navigateToInbox = false, type = 'success' } = {}) {
  cancelAutoAdvance(message);
  if (navigateToInbox) currentView = 'inbox';
  render();
  if (notifyUser) notify(message, type);
}

function applyAction(type, payload = {}) {
  if (autoAdvanceActive) cancelAutoAdvance('操作により自動進行を停止しました。');
  const result = performAction(state, { type, payload });
  if (!result.ok) {
    notify(result.message, 'error');
    return false;
  }
  state = result.state;
  persist();
  render();
  notify(result.message);
  return true;
}

function exportSave() {
  if (!state) return;
  const blob = new Blob([serializeGame(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const clubName = state.clubs.find((club) => club.id === state.userClubId)?.shortName ?? 'club';
  anchor.href = url;
  anchor.download = `football-director-${clubName.toLowerCase()}-s${state.season}-w${state.week}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  notify('セーブデータを書き出しました。');
}

async function importSave(file) {
  try {
    cancelAutoAdvance();
    const next = deserializeGame(await file.text());
    state = next;
    currentView = 'dashboard';
    persist();
    render();
    notify('セーブデータを読み込みました。');
  } catch (error) {
    notify(`読み込みに失敗しました: ${error.message}`, 'error');
  } finally {
    elements().importInput.value = '';
  }
}

function clearMatchTimer() {
  if (matchTimer) window.clearInterval(matchTimer);
  matchTimer = null;
}

function finishMatchPlayback(report) {
  const modal = elements().modalRoot.querySelector('[data-match-modal]');
  if (!modal) return;
  modal.querySelectorAll('[data-match-event]').forEach((item) => item.classList.add('is-visible'));
  modal.querySelector('[data-match-minute]').textContent = '90:00';
  modal.querySelector('[data-match-progress]').style.width = '100%';
  modal.querySelector('[data-score-home]').textContent = String(report.homeGoals);
  modal.querySelector('[data-score-away]').textContent = String(report.awayGoals);
  modal.querySelector('[data-match-results]').classList.add('is-visible');
  modal.querySelector('[data-match-close]').disabled = false;
  const commentary = modal.querySelector('[data-commentary]');
  commentary.scrollTop = commentary.scrollHeight;
  clearMatchTimer();
}

function startMatchPlayback(report) {
  clearMatchTimer();
  const modal = elements().modalRoot.querySelector('[data-match-modal]');
  if (!modal || modal.dataset.replay === 'true') return;
  const events = [...modal.querySelectorAll('[data-match-event]')];
  let index = 0;
  let homeScore = 0;
  let awayScore = 0;
  matchTimer = window.setInterval(() => {
    const item = events[index];
    if (!item) {
      finishMatchPlayback(report);
      return;
    }
    item.classList.add('is-visible');
    const minute = Number(item.dataset.minute);
    modal.querySelector('[data-match-minute]').textContent = `${String(minute).padStart(2, '0')}:00`;
    modal.querySelector('[data-match-progress]').style.width = `${Math.min(100, minute / 90 * 100)}%`;
    if (item.dataset.type === 'goal') {
      if (item.dataset.side === 'home') homeScore += 1;
      if (item.dataset.side === 'away') awayScore += 1;
      modal.querySelector('[data-score-home]').textContent = String(homeScore);
      modal.querySelector('[data-score-away]').textContent = String(awayScore);
    }
    const commentary = modal.querySelector('[data-commentary]');
    commentary.scrollTop = commentary.scrollHeight;
    index += 1;
  }, 280);
}

function openMatch(report, replay = false) {
  const { modalRoot } = elements();
  modalRoot.innerHTML = renderMatchModal(state, report, replay);
  document.body.style.overflow = 'hidden';
  if (!replay) startMatchPlayback(report);
}

function closeMatch() {
  clearMatchTimer();
  elements().modalRoot.innerHTML = '';
  document.body.style.overflow = '';
}

function playWeek() {
  if (!state) return;
  if (autoAdvanceActive) cancelAutoAdvance();
  const result = playNextWeek(state);
  if (!result.ok) {
    notify(result.message, 'error');
    return;
  }
  state = result.state;
  autoAdvanceMessage = '';
  persist();
  render();
  if (result.matchReport) openMatch(result.matchReport, false);
}

function runAutoAdvanceStep() {
  if (!autoAdvanceActive || !state) return;
  const week = state.week;
  const decisionsBefore = new Set(unresolvedDecisionIds(state));
  autoAdvanceMessage = `WEEK ${week}を自動進行中`;
  render();

  const result = playNextWeek(state);
  if (!result.ok) {
    stopAutoAdvance(result.message, { notifyUser: true, type: 'error' });
    return;
  }

  state = result.state;
  persist();
  const stopReason = autoAdvanceStopReason(decisionsBefore, state);
  if (stopReason === 'decision' || stopReason === 'pending-decision') {
    stopAutoAdvance(`WEEK ${week}の試合後に判断イベントが発生しました。`, { notifyUser: true, navigateToInbox: true });
    return;
  }
  if (stopReason === 'season-complete') {
    stopAutoAdvance(`シーズン${state.season}の全試合が終了しました。`, { notifyUser: true });
    return;
  }

  autoAdvanceMessage = `WEEK ${week}完了。次の試合を準備しています。`;
  render();
  autoAdvanceTimer = window.setTimeout(runAutoAdvanceStep, AUTO_ADVANCE_DELAY);
}

function startAutoAdvance() {
  if (!state || state.seasonStatus !== 'active') {
    notify('進行できるシーズンがありません。', 'error');
    return;
  }
  if (unresolvedDecisionIds(state).length) {
    currentView = 'inbox';
    autoAdvanceMessage = '未処理の判断イベントを解決すると自動進行できます。';
    render();
    notify(autoAdvanceMessage, 'error');
    return;
  }
  closeMatch();
  clearAutoAdvanceTimer();
  autoAdvanceActive = true;
  autoAdvanceMessage = `WEEK ${state.week}から自動進行を開始します。`;
  render();
  autoAdvanceTimer = window.setTimeout(runAutoAdvanceStep, 180);
}

function toggleAutoAdvance() {
  if (autoAdvanceActive) {
    stopAutoAdvance('自動進行を停止しました。', { notifyUser: true });
  } else {
    startAutoAdvance();
  }
}

function filterMarket() {
  const search = document.querySelector('[data-market-search]')?.value.trim().toLowerCase() ?? '';
  const position = document.querySelector('[data-market-position]')?.value ?? '';
  document.querySelectorAll('[data-market-row]').forEach((row) => {
    const nameMatches = !search || row.dataset.name.includes(search);
    const positionMatches = !position || row.dataset.position === position;
    row.hidden = !(nameMatches && positionMatches);
  });
}

function applySquadFilters(readControls = true) {
  const body = document.querySelector('[data-squad-table-body]');
  if (!body) return;
  const sortControl = document.querySelector('[data-squad-sort]');
  const orderControl = document.querySelector('[data-squad-order]');
  const roleControl = document.querySelector('[data-squad-role-filter]');
  const positionControl = document.querySelector('[data-squad-position-filter]');

  if (readControls) {
    squadViewState.sort = sortControl?.value ?? squadViewState.sort;
    squadViewState.order = orderControl?.value ?? squadViewState.order;
    squadViewState.role = roleControl?.value ?? squadViewState.role;
    squadViewState.position = positionControl?.value ?? squadViewState.position;
  } else {
    if (sortControl) sortControl.value = squadViewState.sort;
    if (orderControl) orderControl.value = squadViewState.order;
    if (roleControl) roleControl.value = squadViewState.role;
    if (positionControl) positionControl.value = squadViewState.position;
  }

  const rows = [...body.querySelectorAll('[data-squad-player]')];
  rows.sort((left, right) => compareSquadRows(left, right, squadViewState.sort, squadViewState.order));
  for (const row of rows) {
    row.hidden = !matchesSquadFilters(row, { role: squadViewState.role, position: squadViewState.position });
    body.append(row);
  }
}

function clearDragState() {
  if (draggedElement) draggedElement.classList.remove('is-dragging');
  document.querySelectorAll('[data-drop-slot]').forEach((slot) => slot.classList.remove('is-drop-ready', 'is-drag-over'));
  draggedPlayerId = null;
  draggedElement = null;
}

function handleDragStart(event) {
  if (event.target.closest('button, input, select')) {
    event.preventDefault();
    return;
  }
  const source = event.target.closest('[data-drag-player][draggable="true"]');
  if (!source) return;
  draggedPlayerId = source.dataset.dragPlayer;
  draggedElement = source;
  source.classList.add('is-dragging');
  document.querySelectorAll('[data-drop-slot]').forEach((slot) => slot.classList.add('is-drop-ready'));
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedPlayerId);
}

function handleDragOver(event) {
  const slot = event.target.closest('[data-drop-slot]');
  if (!slot || !draggedPlayerId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('[data-drop-slot].is-drag-over').forEach((item) => {
    if (item !== slot) item.classList.remove('is-drag-over');
  });
  slot.classList.add('is-drag-over');
}

function handleDragLeave(event) {
  const slot = event.target.closest('[data-drop-slot]');
  if (!slot || slot.contains(event.relatedTarget)) return;
  slot.classList.remove('is-drag-over');
}

function handleDrop(event) {
  const slot = event.target.closest('[data-drop-slot]');
  if (!slot) return;
  event.preventDefault();
  const playerId = draggedPlayerId || event.dataTransfer.getData('text/plain');
  const slotId = slot.dataset.dropSlot;
  clearDragState();
  if (playerId && slotId) applyAction('replace-starter', { slotId, playerId });
}

function handleClick(event) {
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    currentView = nav.dataset.nav;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const command = event.target.closest('[data-command]')?.dataset.command;
  if (command === 'play-week') return playWeek();
  if (command === 'toggle-auto-advance') return toggleAutoAdvance();
  if (command === 'start-next-season') return applyAction('start-next-season');
  if (command === 'export-save') return exportSave();
  if (command === 'import-save') return elements().importInput.click();
  if (command === 'reset-game') {
    if (window.confirm('現在のキャリアを削除して最初から始めますか？')) {
      cancelAutoAdvance();
      closeMatch();
      localStorage.removeItem(STORAGE_KEY);
      state = null;
      currentView = 'dashboard';
      render();
      notify('キャリアをリセットしました。');
    }
    return;
  }

  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    const playerId = actionElement.dataset.playerId;
    if (action === 'auto-lineup') return applyAction('auto-lineup');
    if (action === 'set-captain') return applyAction('set-captain', { playerId });
    if (action === 'set-penalty') return applyAction('set-penalty-taker', { playerId });
    if (action === 'list-player') return applyAction('list-player', { playerId });
    if (action === 'sell-player') {
      if (window.confirm('移籍オファーを受けてこの選手を売却しますか？')) applyAction('sell-player', { playerId });
      return;
    }
    if (action === 'release-player') {
      if (window.confirm('12週分の給与を補償金として支払い、この選手との契約を解除しますか？')) applyAction('release-player', { playerId });
      return;
    }
    if (action === 'scout-player') return applyAction('scout-player', { playerId });
    if (action === 'buy-player') {
      if (window.confirm('移籍金と給与条件に合意して獲得しますか？')) applyAction('buy-player', { playerId });
      return;
    }
    if (action === 'promote-prospect') return applyAction('promote-prospect', { playerId });
    if (action === 'renew-contract') {
      if (window.confirm('3年契約で更新しますか？更新時に契約金が発生します。')) applyAction('renew-contract', { playerId, years: 3 });
      return;
    }
    if (action === 'allocate-transfer-budget') {
      const amount = Number(actionElement.dataset.amount);
      if (window.confirm(`${Math.round(amount / 100_000_000)}億円を移籍予算へ配分しますか？`)) applyAction('allocate-transfer-budget', { amount });
      return;
    }
    if (action === 'invest-project') {
      if (window.confirm('継続投資を実行しますか？毎週の維持費も増加します。')) applyAction('invest-project', { projectId: actionElement.dataset.projectId });
      return;
    }
    if (action === 'upgrade-facility') {
      if (window.confirm('クラブ資金を使って施設を強化しますか？')) applyAction('upgrade-facility', { facility: actionElement.dataset.facility });
      return;
    }
    if (action === 'resolve-event') return applyAction('resolve-event', { eventId: actionElement.dataset.eventId, choiceId: actionElement.dataset.choiceId });
  }

  const reportButton = event.target.closest('[data-open-report]');
  if (reportButton) {
    const report = state.matchReports.find((item) => item.id === reportButton.dataset.openReport);
    if (report) openMatch(report, true);
  }
}

function handleChange(event) {
  if (event.target.matches('[data-lineup-slot]')) {
    applyAction('replace-starter', { slotId: event.target.dataset.lineupSlot, playerId: event.target.value });
    return;
  }
  if (event.target.matches('[data-tactic-key]')) {
    applyAction('update-tactics', { [event.target.dataset.tacticKey]: event.target.value });
    return;
  }
  if (event.target.matches('[data-formation-quick]')) {
    applyAction('update-tactics', { formation: event.target.value });
    return;
  }
  if (event.target.matches('[data-training-focus]')) {
    applyAction('update-training', { focus: event.target.value });
    return;
  }
  if (event.target.matches('[data-market-position]')) {
    filterMarket();
    return;
  }
  if (event.target.matches('[data-squad-sort], [data-squad-order], [data-squad-role-filter], [data-squad-position-filter]')) {
    applySquadFilters(true);
    return;
  }
  if (event.target.matches('input[name="clubMode"]')) {
    const mode = event.target.value;
    document.querySelectorAll('[data-club-mode-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.clubModePanel !== mode;
    });
    const created = mode === 'created';
    for (const name of ['clubName', 'homeCity']) {
      const input = document.querySelector(`[name="${name}"]`);
      if (input) input.required = created;
    }
    return;
  }
}

function handleInput(event) {
  if (event.target.matches('[data-market-search]')) filterMarket();
}

function handleSubmit(event) {
  if (!event.target.matches('#new-game-form')) return;
  event.preventDefault();
  const data = new FormData(event.target);
  try {
    cancelAutoAdvance();
    state = createNewGame({
      managerName: data.get('managerName'),
      clubMode: data.get('clubMode'),
      clubName: data.get('clubName'),
      homeCity: data.get('homeCity'),
      primaryColor: data.get('primaryColor'),
      clubPhilosophy: data.get('clubPhilosophy'),
      clubId: data.get('clubId'),
      difficulty: data.get('difficulty'),
      seed: data.get('seed')
    });
    currentView = 'dashboard';
    persist();
    render();
    notify('新しいキャリアを開始しました。');
  } catch (error) {
    notify(error.message, 'error');
  }
}

function bindEvents() {
  const { app, modalRoot, importInput } = elements();
  app.addEventListener('click', handleClick);
  app.addEventListener('change', handleChange);
  app.addEventListener('input', handleInput);
  app.addEventListener('submit', handleSubmit);
  app.addEventListener('dragstart', handleDragStart);
  app.addEventListener('dragover', handleDragOver);
  app.addEventListener('dragleave', handleDragLeave);
  app.addEventListener('drop', handleDrop);
  app.addEventListener('dragend', clearDragState);
  importInput.addEventListener('change', () => {
    const [file] = importInput.files;
    if (file) importSave(file);
  });
  modalRoot.addEventListener('click', (event) => {
    if (event.target.closest('[data-match-skip]')) {
      const reportId = state.lastMatchReportId;
      const report = state.matchReports.find((item) => item.id === reportId);
      if (report) finishMatchPlayback(report);
    }
    if (event.target.closest('[data-match-close]')) closeMatch();
    if (event.target.classList.contains('modal-backdrop')) {
      const closeButton = modalRoot.querySelector('[data-match-close]');
      if (closeButton && !closeButton.disabled) closeMatch();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const closeButton = modalRoot.querySelector('[data-match-close]');
      if (closeButton && !closeButton.disabled) closeMatch();
    }
  });
}

export function boot() {
  state = readStoredGame();
  render();
  bindEvents();
}
