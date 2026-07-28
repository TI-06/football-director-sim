import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createNewGame } from '../src/game/game-engine.js';
import { renderApplication } from '../src/ui/render.js';
import { DESKTOP_CATEGORIES, shortcutView } from '../src/ui/game-shell.js';
import { buildContextItems } from '../src/ui/context-panel.js';
import { importantFixtureReason, operationalStopReason } from '../src/ui/auto-advance.js';

test('desktop shell uses six categories and a three-column command layout', () => {
  const state = createNewGame({ seed: 'desktop-shell', clubId: 'jp1-01' });
  const html = renderApplication(state, 'dashboard');
  assert.equal(DESKTOP_CATEGORIES.length, 6);
  assert.match(html, /app-shell--three-column/);
  assert.match(html, /context-panel/);
  for (const category of DESKTOP_CATEGORIES) assert.match(html, new RegExp(`data-category="${category.id}"`));
  assert.match(renderApplication(state, 'squad'), /data-selection-policy/);
  assert.match(renderApplication(state, 'squad'), /data-substitution-policy/);
  assert.match(renderApplication(state, 'squad'), /data-action="hold-player-meeting"/);
  assert.match(renderApplication(state, 'club'), /data-action="appoint-staff"/);
  assert.match(renderApplication(state, 'club'), /data-action="choose-season-objective"/);
  assert.match(renderApplication(state, 'transfers'), /data-action="toggle-shortlist"/);
  assert.match(renderApplication(state, 'transfers'), /data-action="create-club-offer"/);
  assert.match(renderApplication(state, 'tactics'), /data-set-piece-key/);
  state.managerOffers = [{ id: 'offer-ui', clubName: '北東京FC', status: 'open', expiresWeek: state.week + 2 }];
  assert.match(renderApplication(state, 'records'), /data-action="accept-manager-offer"/);
});

test('desktop keyboard shortcuts map to the six primary categories', () => {
  assert.deepEqual(['h', 'm', 's', 't', 'c', 'r'].map(shortcutView), ['dashboard', 'schedule', 'squad', 'transfers', 'club', 'records']);
  assert.equal(shortcutView('x'), null);
});

test('context panel prioritizes actionable promises board warnings and manager offers', () => {
  const state = createNewGame({ seed: 'context-items', clubId: 'jp1-01' });
  const player = state.players.find((item) => item.clubId === state.userClubId);
  state.playerPromises = [{ id: 'promise-1', playerId: player.id, type: 'starts', status: 'active', deadlineWeek: state.week + 1 }];
  state.boardEvaluation.status = 'warning';
  state.managerOffers = [{ id: 'offer-1', clubName: '新宿ユナイテッド', status: 'open', expiresWeek: state.week + 2 }];
  const items = buildContextItems(state);
  assert.ok(items.length <= 5);
  assert.deepEqual(items.slice(0, 3).map((item) => item.kind), ['board', 'promise', 'manager-offer']);
});

test('auto advance stops for unresolved club operations and derby matches', () => {
  const state = createNewGame({ seed: 'operational-stops', clubId: 'jp1-01' });
  state.playerPromises = [{ id: 'promise-1', status: 'active', deadlineWeek: state.week }];
  assert.equal(operationalStopReason(state), 'promise');
  state.playerPromises = [];
  state.boardEvaluation.status = 'final-warning';
  assert.equal(operationalStopReason(state), 'board-warning');
  state.boardEvaluation.status = 'secure';
  state.managerOffers = [{ id: 'offer-1', status: 'open', expiresWeek: state.week + 1 }];
  assert.equal(operationalStopReason(state), 'manager-offer');

  const fixture = state.fixtures.find((item) => item.week === state.week && [item.homeId, item.awayId].includes(state.userClubId));
  state.rivalries = [{ id: 'rivalry-1', clubIds: [fixture.homeId, fixture.awayId], intensity: 80 }];
  state.managerOffers = [];
  assert.equal(importantFixtureReason(state), 'ダービーマッチ');
});

test('responsive shell hides the context rail and prevents horizontal overflow on mobile', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns:\s*238px\s+minmax\(0,\s*1fr\)\s+300px/);
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\.context-panel\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.app-shell\s*\{[^}]*display:\s*block/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/);
});

test('regional scouting buttons select a candidate compatible with each region', () => {
  const state = createNewGame({ seed: 'regional-scout-ui', clubId: 'jp1-01' });
  const [kantoPlayer, unassignedPlayer] = state.transferMarket;
  kantoPlayer.region = '関東';
  delete unassignedPlayer.region;

  const html = renderApplication(state, 'transfers');

  assert.match(html, new RegExp(`data-player-id="${unassignedPlayer.id}" data-region="北海道・東北"`));
  assert.match(html, new RegExp(`data-player-id="${kantoPlayer.id}" data-region="関東"`));
});
