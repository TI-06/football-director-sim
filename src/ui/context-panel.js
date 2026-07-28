import { escapeHtml, icon } from './templates.js';

const PROMISE_LABELS = { starts: '先発起用', contract: '契約更新', position: 'ポジション', 'not-sell': '残留' };

export function buildContextItems(state) {
  if (!state) return [];
  const players = new Map((state.players ?? []).map((player) => [player.id, player]));
  const items = [];
  if (['warning', 'final-warning', 'dismissed'].includes(state.boardEvaluation?.status)) {
    items.push({
      kind: 'board',
      priority: 100,
      title: state.boardEvaluation.status === 'final-warning' ? '理事会から最終警告' : '理事会評価が低下',
      detail: `信頼度 ${state.boardEvaluation.overall ?? 0} / 100`,
      view: 'club'
    });
  }
  for (const promise of (state.playerPromises ?? []).filter((item) => item.status === 'active')) {
    const player = players.get(promise.playerId);
    items.push({ kind: 'promise', priority: 90, title: `${player?.name ?? '選手'}との約束`, detail: `${PROMISE_LABELS[promise.type] ?? promise.type} · 期限 WEEK ${promise.deadlineWeek}`, view: 'squad' });
  }
  for (const offer of (state.managerOffers ?? []).filter((item) => item.status === 'open' && item.expiresWeek >= state.week)) {
    items.push({ kind: 'manager-offer', priority: 80, title: `${offer.clubName}から監督オファー`, detail: `期限 WEEK ${offer.expiresWeek}`, view: 'records' });
  }
  for (const negotiation of (state.transferNegotiations ?? []).filter((item) => item.status === 'open')) {
    items.push({ kind: 'negotiation', priority: 70, title: '移籍交渉が進行中', detail: negotiation.stage === 'agent' ? '選手・代理人との条件交渉' : 'クラブ間条件の回答待ち', view: 'transfers' });
  }
  for (const member of (state.staff ?? []).filter((item) => !item.interim && item.contractWeeks > 0 && item.contractWeeks <= 8)) {
    items.push({ kind: 'staff', priority: 60, title: `${member.name}の契約満了が近い`, detail: `${member.roleLabel} · 残り${member.contractWeeks}週`, view: 'club' });
  }
  const unresolved = (state.inbox ?? []).filter((item) => item.kind === 'decision' && !item.resolved);
  for (const decision of unresolved) items.push({ kind: 'decision', priority: 55, title: decision.title ?? '判断が必要です', detail: decision.message ?? decision.description ?? '受信トレイを確認してください。', view: 'inbox' });
  return items.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function renderContextPanel(state) {
  const items = buildContextItems(state);
  const body = items.length
    ? items.map((item) => `<button class="context-item" type="button" data-nav="${item.view}"><span class="context-item__icon">${icon(item.kind === 'board' ? 'warning' : item.kind === 'manager-offer' ? 'trophy' : item.kind === 'negotiation' ? 'transfer' : 'star', 15)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span></button>`).join('')
    : '<p class="context-panel__empty">現在、優先対応が必要な項目はありません。</p>';
  return `<aside class="context-panel" aria-label="今週の優先事項"><header><small>CONTEXT</small><h2>今週の優先事項</h2></header><div class="context-panel__body">${body}</div></aside>`;
}
