import { createNewGame, performAction, playNextWeek } from '../game/game-engine.js';
import { deserializeGame, serializeGame } from '../game/save.js';
import { renderApplication, renderMatchModal, renderNewGame } from './render.js';

const STORAGE_KEY = 'football-director-save-v1';

let state = null;
let currentView = 'dashboard';
let matchTimer = null;

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
  app.innerHTML = state ? renderApplication(state, currentView) : renderNewGame();
  document.title = state ? `${state.clubs.find((club) => club.id === state.userClubId)?.name ?? 'Football Director'} | Football Director` : 'Football Director';
}

function notify(message, type = 'success') {
  const { toastRegion } = elements();
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : ''}`;
  toast.innerHTML = `${type === 'error' ? '⚠' : '✓'} <span>${String(message).replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</span>`;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function applyAction(type, payload = {}) {
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
  const result = playNextWeek(state);
  if (!result.ok) {
    notify(result.message, 'error');
    return;
  }
  state = result.state;
  persist();
  render();
  if (result.matchReport) openMatch(result.matchReport, false);
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
  if (command === 'start-next-season') return applyAction('start-next-season');
  if (command === 'export-save') return exportSave();
  if (command === 'import-save') return elements().importInput.click();
  if (command === 'reset-game') {
    if (window.confirm('現在のキャリアを削除して最初から始めますか？')) {
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
  if (event.target.matches('[data-training-focus]')) {
    applyAction('update-training', { focus: event.target.value });
    return;
  }
  if (event.target.matches('[data-market-position]')) {
    filterMarket();
    return;
  }
  if (event.target.matches('input[name="clubId"]')) {
    const template = event.target.closest('.club-option')?.querySelector('.club-option__name')?.textContent;
    const clubName = document.querySelector('input[name="clubName"]');
    if (template && clubName) clubName.value = template;
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
    state = createNewGame({
      managerName: data.get('managerName'),
      clubName: data.get('clubName'),
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
