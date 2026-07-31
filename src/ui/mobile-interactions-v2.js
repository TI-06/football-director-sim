let selectedSquadPlayerId = null;
let selectedSquadElement = null;

function clearSquadSelection() {
  selectedSquadElement?.classList.remove('is-tap-selected');
  selectedSquadPlayerId = null;
  selectedSquadElement = null;
}

function updateLivePlayerPanel(token) {
  const panel = document.querySelector('[data-selected-live-player]');
  if (!panel) return;
  const status = token.dataset.playerInjured === 'true' ? '負傷' : token.dataset.playerBooked === 'true' ? '警告' : '通常';
  panel.innerHTML = `<div><b>${token.dataset.playerNumber}</b><span><strong>${token.dataset.playerName}</strong><small>${token.dataset.playerPosition}</small></span></div><dl><div><dt>体力</dt><dd>${token.dataset.playerFitness}%</dd></div><div><dt>評価</dt><dd>${token.dataset.playerRating}</dd></div><div><dt>状態</dt><dd>${status}</dd></div></dl>`;
  document.querySelectorAll('[data-live-player-token].is-selected').forEach((item) => item.classList.remove('is-selected'));
  token.classList.add('is-selected');
}

function selectSquadPlayer(element) {
  const playerId = element.dataset.dragPlayer;
  if (!playerId) return;
  if (selectedSquadPlayerId === playerId) {
    clearSquadSelection();
    return;
  }
  clearSquadSelection();
  selectedSquadPlayerId = playerId;
  selectedSquadElement = element;
  element.classList.add('is-tap-selected');
  document.querySelectorAll('[data-drop-slot]').forEach((slot) => slot.classList.add('is-tap-drop-ready'));
}

function placeSelectedPlayer(slot) {
  if (!selectedSquadPlayerId || !slot.dataset.dropSlot) return false;
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', selectedSquadPlayerId);
    slot.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  } catch {
    return false;
  } finally {
    document.querySelectorAll('[data-drop-slot]').forEach((item) => item.classList.remove('is-tap-drop-ready'));
    clearSquadSelection();
  }
  return true;
}

document.addEventListener('click', (event) => {
  const liveToken = event.target.closest('[data-live-player-token]');
  if (liveToken) {
    updateLivePlayerPanel(liveToken);
    return;
  }
  const slot = event.target.closest('[data-drop-slot]');
  if (slot && selectedSquadPlayerId && placeSelectedPlayer(slot)) return;
  const squadPlayer = event.target.closest('[data-drag-player]');
  if (squadPlayer && !event.target.closest('button, input, select, a')) selectSquadPlayer(squadPlayer);
});

document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('fd2-page-hidden', document.hidden);
});
