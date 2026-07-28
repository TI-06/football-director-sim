import { completePreparedWeek, createNewGame, performAction, playNextWeek, prepareNextWeek } from '../game/game-engine.js';
import { advanceLiveMatchSession, createLiveMatchSession, finalizeLiveMatch, makeLiveSubstitution } from '../game/live-match.js';
import { deserializeGame, serializeGame } from '../game/save.js';
import { CloudSaveClient } from '../services/cloud-save.js';
import { autoAdvanceStopReason, importantFixtureReason, operationalStopReason, unresolvedDecisionIds } from './auto-advance.js';
import { authenticateCloudAction } from './cloud-operations.js';
import { shortcutView } from './game-shell.js';
import { renderApplication, renderLiveMatchCenter, renderMatchModal, renderNewGame } from './render.js';
import { createCloudSaveDialog, createConfirmDialog, createMenuDialog, renderGameDialog } from './dialogs.js';
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
let preparedWeek = null;
let liveMatchSession = null;
let dialogConfirmHandler = null;
let dialogReturnFocus = null;
const cloudClient = new CloudSaveClient();

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

function closeDialog() {
  const root = elements().modalRoot;
  const dialog = root.querySelector('[data-game-dialog]');
  if (!dialog) return false;
  root.innerHTML = '';
  dialogConfirmHandler = null;
  document.body.style.overflow = '';
  if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus();
  dialogReturnFocus = null;
  return true;
}

function openDialog(dialog, onConfirm = null) {
  const { modalRoot } = elements();
  dialogReturnFocus = document.activeElement;
  dialogConfirmHandler = onConfirm;
  modalRoot.innerHTML = renderGameDialog(dialog);
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => modalRoot.querySelector('[data-dialog-confirm], [data-dialog-nav], [data-dialog-command], [data-dialog-cancel]')?.focus(), 0);
}

function confirmAction(options, handler) {
  openDialog(createConfirmDialog(options), () => {
    closeDialog();
    handler();
  });
}

function openCloudDialog(operation) {
  if (operation === 'save' && !state) return;
  openDialog(createCloudSaveDialog({ operation }));
}

async function runCloudOperation(action) {
  const form = elements().modalRoot.querySelector('[data-cloud-form]');
  if (!form) return;
  const data = new FormData(form);
  const userId = data.get('cloudUserId');
  const password = data.get('cloudPassword');
  const operation = form.dataset.cloudOperation;
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await authenticateCloudAction(cloudClient, action, userId, password);
    if (operation === 'save') {
      await cloudClient.save(serializeGame(state));
      closeDialog();
      notify(action === 'register' ? 'IDを登録してクラウドへ保存しました。' : 'クラウドへ保存しました。');
      return;
    }
    const result = await cloudClient.load();
    if (!result.save) throw new Error('このIDにはクラウドセーブがありません。');
    cancelAutoAdvance();
    state = deserializeGame(result.save);
    currentView = 'dashboard';
    persist();
    closeDialog();
    render();
    notify('クラウドセーブを読み込みました。');
  } catch (error) {
    notify(error.message, 'error');
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function openGameMenu() {
  openDialog(createMenuDialog({
    title: 'クラブメニュー',
    message: 'よく使う画面は下のナビに固定されています。その他の機能はこちらから開けます。',
    items: [
      { label: '戦術・試合プラン', description: '戦術と自動交代条件', icon: 'tactics', nav: 'tactics' },
      { label: 'ユースアカデミー', description: '若手の育成と昇格', icon: 'academy', nav: 'academy' },
      { label: '記録・タイトル', description: '個人成績と歴代記録', icon: 'trophy', nav: 'records' },
      { label: '秘書レポート', description: '今週の重要事項', icon: 'star', nav: 'secretary' },
      { label: 'クラブ経営', description: '財務・施設・投資', icon: 'club', nav: 'club' },
      { label: '受信トレイ', description: '判断イベントと連絡', icon: 'inbox', nav: 'inbox' },
      { label: 'クラウドへ保存', description: 'ID・パスワードで1枠保存', icon: 'save', command: 'cloud-save' },
      { label: 'クラウドから読み込む', description: '別端末のキャリアを復元', icon: 'upload', command: 'cloud-load' },
      { label: 'セーブを書き出す', icon: 'download', command: 'export-save' },
      { label: 'セーブを読み込む', icon: 'upload', command: 'import-save' },
      { label: 'キャリアをリセット', icon: 'reset', command: 'reset-game', danger: true }
    ]
  }));
}

function renderLiveMatch() {
  if (!liveMatchSession) return;
  elements().modalRoot.innerHTML = renderLiveMatchCenter(state, liveMatchSession);
  document.body.style.overflow = 'hidden';
}

function collectLiveTactics() {
  return Object.fromEntries([...elements().modalRoot.querySelectorAll('[data-live-tactic]')].map((control) => [control.dataset.liveTactic, control.value]));
}

function beginLiveWeek() {
  const prepared = prepareNextWeek(state);
  if (!prepared.ok) {
    notify(prepared.message, 'error');
    return;
  }
  if (!prepared.userFixture) {
    const completed = completePreparedWeek(prepared, null);
    if (!completed.ok) {
      notify(completed.message, 'error');
      return;
    }
    state = completed.state;
    persist();
    render();
    return;
  }
  preparedWeek = prepared;
  liveMatchSession = createLiveMatchSession({
    seed: prepared.matchSeed,
    home: prepared.home,
    away: prepared.away,
    userSide: prepared.userSide,
    matchPlan: state.matchPlan
  });
  renderLiveMatch();
}

function advanceLiveMatch() {
  if (!liveMatchSession || liveMatchSession.completed) return;
  const result = advanceLiveMatchSession(liveMatchSession, { tactics: collectLiveTactics(), autoPlan: true });
  if (!result.ok) {
    notify(result.message, 'error');
    return;
  }
  liveMatchSession = result.session;
  renderLiveMatch();
}

function skipLiveMatch() {
  if (!liveMatchSession) return;
  let next = liveMatchSession;
  while (!next.completed) {
    const result = advanceLiveMatchSession(next, { autoPlan: true });
    if (!result.ok) {
      notify(result.message, 'error');
      return;
    }
    next = result.session;
  }
  liveMatchSession = next;
  renderLiveMatch();
}

function substituteLivePlayer() {
  if (!liveMatchSession) return;
  const root = elements().modalRoot;
  const playerOutId = root.querySelector('[data-live-player-out]')?.value;
  const playerInId = root.querySelector('[data-live-player-in]')?.value;
  if (!playerOutId || !playerInId) {
    notify('交代する選手と投入する選手を選んでください。', 'error');
    return;
  }
  const result = makeLiveSubstitution(liveMatchSession, {
    side: liveMatchSession.userSide,
    playerOutId,
    playerInId,
    reason: 'manual'
  });
  if (!result.ok) {
    notify(result.message, 'error');
    return;
  }
  liveMatchSession = result.session;
  renderLiveMatch();
  notify(result.message);
}

function finishLiveWeek() {
  if (!preparedWeek || !liveMatchSession?.completed) return;
  const report = finalizeLiveMatch(liveMatchSession);
  const completed = completePreparedWeek(preparedWeek, report);
  if (!completed.ok) {
    notify(completed.message, 'error');
    return;
  }
  state = completed.state;
  preparedWeek = null;
  liveMatchSession = null;
  elements().modalRoot.innerHTML = '';
  document.body.style.overflow = '';
  persist();
  render();
  notify('試合結果を確定しました。');
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
  if (!state || liveMatchSession) return;
  if (autoAdvanceActive) cancelAutoAdvance();
  beginLiveWeek();
}

function runAutoAdvanceStep() {
  if (!autoAdvanceActive || !state) return;
  const importantReason = importantFixtureReason(state);
  if (importantReason) {
    stopAutoAdvance(`${importantReason}のため手動指揮へ切り替えました。`, { notifyUser: true });
    return;
  }
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
  if (stopReason) {
    const messages = { promise: '期限が近い選手との約束', 'board-warning': '理事会からの警告', 'manager-offer': '監督オファー', negotiation: '進行中の移籍交渉', 'staff-contract': 'スタッフの契約満了' };
    stopAutoAdvance(`${messages[stopReason] ?? '重要事項'}を確認するため自動進行を停止しました。`, { notifyUser: true });
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
  const operation = operationalStopReason(state);
  if (operation) {
    autoAdvanceMessage = '今週の優先事項を確認すると自動進行できます。';
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
  if (command === 'cloud-save') return openCloudDialog('save');
  if (command === 'cloud-load') return openCloudDialog('load');
  if (command === 'open-game-menu') return openGameMenu();
  if (command === 'toggle-sidebar') {
    document.body.classList.toggle('sidebar-collapsed');
    return;
  }
  if (command === 'reset-game') {
    confirmAction({
      id: 'reset-career',
      title: 'キャリアを最初からやり直しますか？',
      message: '現在のクラブ、選手、シーズン記録をこの端末から削除します。',
      detail: 'この操作は取り消せません。必要なら先にセーブを書き出してください。',
      confirmLabel: 'キャリアを削除',
      tone: 'danger'
    }, () => {
      cancelAutoAdvance();
      closeMatch();
      preparedWeek = null;
      liveMatchSession = null;
      localStorage.removeItem(STORAGE_KEY);
      state = null;
      currentView = 'dashboard';
      render();
      notify('キャリアをリセットしました。');
    });
    return;
  }

  const actionElement = event.target.closest('[data-action]');
  if (actionElement) {
    const action = actionElement.dataset.action;
    const playerId = actionElement.dataset.playerId;
    const player = state?.players.find((item) => item.id === playerId) ?? state?.transferMarket.find((item) => item.id === playerId);
    if (action === 'auto-lineup') return applyAction('auto-lineup');
    if (action === 'set-captain') return applyAction('set-captain', { playerId });
    if (action === 'set-penalty') return applyAction('set-penalty-taker', { playerId });
    if (action === 'list-player') return applyAction('list-player', { playerId });
    if (action === 'sell-player') {
      confirmAction({ id: 'sell-player', title: `${player?.name ?? '選手'}を売却しますか？`, message: '届いている移籍オファーを受諾し、選手をクラブから放出します。', detail: '売却益の一部が移籍予算へ還元されます。', confirmLabel: 'オファーを受諾', tone: 'warning' }, () => applyAction('sell-player', { playerId }));
      return;
    }
    if (action === 'release-player') {
      confirmAction({ id: 'release-player', title: `${player?.name ?? '選手'}との契約を解除しますか？`, message: '12週分の給与を補償金として支払い、選手を自由契約にします。', detail: 'スカッド人数と残り資金を確認してください。', confirmLabel: '契約を解除', tone: 'danger' }, () => applyAction('release-player', { playerId }));
      return;
    }
    if (action === 'hold-player-meeting') return applyAction('hold-player-meeting', { playerId, meetingType: 'praise' });
    if (action === 'create-player-promise') return applyAction('create-player-promise', { playerId, promiseType: 'starts', target: 3, window: 5 });
    if (action === 'appoint-staff') return applyAction('appoint-staff', { staffId: actionElement.dataset.staffId });
    if (action === 'choose-season-objective') return applyAction('choose-season-objective', { level: actionElement.dataset.level });
    if (action === 'accept-manager-offer') return applyAction('accept-manager-offer', { offerId: actionElement.dataset.offerId });
    if (action === 'toggle-shortlist') return applyAction('toggle-shortlist', { playerId, priority: 'medium', neededPosition: player?.position });
    if (action === 'scout-regional-player') return applyAction('scout-regional-player', { playerId, region: actionElement.dataset.region });
    if (action === 'create-club-offer') {
      const fee = Number(actionElement.dataset.fee ?? player?.askingPrice ?? 0);
      confirmAction({ id: 'club-offer', title: `${player?.name ?? '選手'}へオファーしますか？`, message: `即時移籍金 ${Math.round(fee / 10_000)}万円を提示します。`, detail: 'クラブ回答後、合意した場合は代理人交渉へ進みます。', confirmLabel: 'クラブへ提示' }, () => applyAction('create-club-offer', { playerId, immediateFee: fee, clauses: {}, offerType: 'permanent' }));
      return;
    }
    if (action === 'respond-club-offer') return applyAction('respond-club-offer', { negotiationId: actionElement.dataset.negotiationId });
    if (action === 'submit-agent-offer') return applyAction('submit-agent-offer', { negotiationId: actionElement.dataset.negotiationId, wage: Number(actionElement.dataset.wage), years: 3, signingBonus: 0, role: 'rotation', releaseClause: 0 });
    if (action === 'scout-player') return applyAction('scout-player', { playerId });
    if (action === 'buy-player') {
      confirmAction({ id: 'buy-player', title: `${player?.name ?? '選手'}を獲得しますか？`, message: '移籍金と給与条件に合意してトップチームへ迎えます。', detail: player ? `OVR ${player.overall} · ${player.position} · ${player.age}歳` : '', confirmLabel: '獲得を決定' }, () => applyAction('buy-player', { playerId }));
      return;
    }
    if (action === 'promote-prospect') return applyAction('promote-prospect', { playerId });
    if (action === 'renew-contract') {
      confirmAction({ id: 'renew-contract', title: `${player?.name ?? '選手'}と契約更新しますか？`, message: '3年契約を提示します。更新時には契約金が発生します。', confirmLabel: '3年契約を提示' }, () => applyAction('renew-contract', { playerId, years: 3 }));
      return;
    }
    if (action === 'allocate-transfer-budget') {
      const amount = Number(actionElement.dataset.amount);
      confirmAction({ id: 'allocate-budget', title: '補強予算を追加しますか？', message: `${Math.round(amount / 100_000_000)}億円をクラブ現金から移籍予算へ振り替えます。`, detail: 'クラブの予備資金は維持されます。', confirmLabel: '予算を配分' }, () => applyAction('allocate-transfer-budget', { amount }));
      return;
    }
    if (action === 'invest-project') {
      confirmAction({ id: 'invest-project', title: '長期プロジェクトへ投資しますか？', message: 'クラブの成長効果とともに毎週の維持費も増加します。', confirmLabel: '投資を実行' }, () => applyAction('invest-project', { projectId: actionElement.dataset.projectId }));
      return;
    }
    if (action === 'upgrade-facility') {
      confirmAction({ id: 'upgrade-facility', title: '施設を強化しますか？', message: 'クラブ資金を使用して施設レベルを引き上げます。', confirmLabel: '施設を強化' }, () => applyAction('upgrade-facility', { facility: actionElement.dataset.facility }));
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
  if (event.target.matches('[data-match-plan-key]')) {
    const key = event.target.dataset.matchPlanKey;
    const value = event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value);
    applyAction('update-match-plan', { [key]: value });
    return;
  }
  if (event.target.matches('[data-match-plan-score]')) {
    const scoreState = event.target.dataset.matchPlanScore;
    const key = event.target.dataset.matchPlanScoreKey;
    applyAction('update-match-plan', { scoreTactics: { [scoreState]: { [key]: event.target.value } } });
    return;
  }
  if (event.target.matches('[data-selection-policy]')) {
    applyAction('set-selection-policy', { playerId: event.target.dataset.playerId, policy: event.target.value });
    return;
  }
  if (event.target.matches('[data-substitution-policy]')) {
    applyAction('set-substitution-policy', { playerId: event.target.dataset.playerId, policy: event.target.value });
    return;
  }
  if (event.target.matches('[data-set-piece-key]')) {
    applyAction('update-set-pieces', { routines: { [event.target.dataset.setPieceKey]: { template: event.target.value } } });
    return;
  }
  if (event.target.matches('[data-set-piece-training]')) {
    applyAction('update-set-pieces', { trainingShare: Number(event.target.value) });
    return;
  }
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
  if (event.target.matches('input[type="range"][data-match-plan-key]')) {
    const output = event.target.closest('.match-plan-control')?.querySelector('output');
    if (output) output.textContent = `${event.target.value}${event.target.dataset.matchPlanKey === 'substitutionMinute' ? '分' : event.target.dataset.matchPlanKey === 'fitnessThreshold' ? '%' : '人'}`;
  }
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
  modalRoot.addEventListener('click', async (event) => {
    const cloudAction = event.target.closest('[data-cloud-action]')?.dataset.cloudAction;
    if (cloudAction) {
      await runCloudOperation(cloudAction);
      return;
    }
    const dialogNav = event.target.closest('[data-dialog-nav]');
    if (dialogNav) {
      const view = dialogNav.dataset.dialogNav;
      closeDialog();
      currentView = view;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const dialogCommand = event.target.closest('[data-dialog-command]')?.dataset.dialogCommand;
    if (dialogCommand) {
      closeDialog();
      if (dialogCommand === 'export-save') exportSave();
      if (dialogCommand === 'import-save') elements().importInput.click();
      if (dialogCommand === 'cloud-save') openCloudDialog('save');
      if (dialogCommand === 'cloud-load') openCloudDialog('load');
      if (dialogCommand === 'reset-game') handleClick({ target: app.querySelector('[data-command="reset-game"]') ?? document.createElement('span') });
      return;
    }
    if (event.target.closest('[data-dialog-confirm]')) {
      const handler = dialogConfirmHandler;
      if (handler) handler();
      else closeDialog();
      return;
    }
    if (event.target.closest('[data-dialog-cancel]')) {
      closeDialog();
      return;
    }
    if (event.target.closest('[data-command="live-advance"]')) return advanceLiveMatch();
    if (event.target.closest('[data-command="live-substitute"]')) return substituteLivePlayer();
    if (event.target.closest('[data-command="live-skip"]')) return skipLiveMatch();
    if (event.target.closest('[data-command="live-finish"]')) return finishLiveWeek();
    if (event.target.closest('[data-match-skip]')) {
      const reportId = state.lastMatchReportId;
      const report = state.matchReports.find((item) => item.id === reportId);
      if (report) finishMatchPlayback(report);
      return;
    }
    if (event.target.closest('[data-match-close]')) {
      closeMatch();
      return;
    }
    if (event.target.matches('[data-dialog-backdrop]')) closeDialog();
    if (event.target.classList.contains('modal-backdrop') && !liveMatchSession) {
      const closeButton = modalRoot.querySelector('[data-match-close]');
      if (closeButton && !closeButton.disabled) closeMatch();
    }
  });
  document.addEventListener('keydown', (event) => {
    const dialog = modalRoot.querySelector('[data-game-dialog]');
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.matches('input, select, textarea') || target.isContentEditable);
    if (!dialog && !liveMatchSession && !editing && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const view = shortcutView(event.key);
      if (view) {
        event.preventDefault();
        currentView = view;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    if (event.key === 'Escape') {
      if (dialog) {
        closeDialog();
        return;
      }
      if (liveMatchSession) return;
      const closeButton = modalRoot.querySelector('[data-match-close]');
      if (closeButton && !closeButton.disabled) closeMatch();
    }
    if (event.key === 'Tab' && dialog) {
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

export function boot() {
  state = readStoredGame();
  render();
  bindEvents();
}
