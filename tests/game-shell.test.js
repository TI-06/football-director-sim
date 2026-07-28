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

test('responsive shell uses compact desktop geometry and four stable breakpoints', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns:\s*216px\s+minmax\(0,\s*1fr\)\s+264px/);
  assert.match(css, /\.topbar\s*\{[^}]*height:\s*64px/);
  assert.match(css, /@media \(max-width: 1279px\)[\s\S]*?\.context-panel\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*?\.app-shell[^}]*grid-template-columns:\s*82px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.app-shell\s*\{[^}]*display:\s*block/);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/);
});

test('mobile layout fixes navigation to five columns and keeps cards within the page', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.mobile-nav\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.mobile-nav\s*\{[^}]*overflow-x:\s*hidden/);
  assert.ok(css.lastIndexOf('.metrics-grid { grid-template-columns: 1fr;') > css.lastIndexOf('.metrics-grid { display: flex;'));
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.card\s*\{[^}]*min-width:\s*0/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.squad-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});


test('dashboard places quick actions before the match workspace', () => {
  const state = createNewGame({ seed: 'dashboard-priority', clubId: 'jp1-01' });
  const html = renderApplication(state, 'dashboard');
  assert.ok(html.indexOf('dashboard-quick-actions') < html.indexOf('next-match'));
});

test('mobile primary controls expose forty-four pixel touch targets', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.btn,\s*\.btn--sm\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.alert-item button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.actions--management \.btn\s*\{[^}]*min-width:\s*44px/);
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

test('responsive browser audit defines seven Playwright projects', () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['test:responsive'], 'playwright test');
  assert.equal(packageJson.scripts['test:responsive:update'], 'playwright test --update-snapshots');
  const config = fs.readFileSync(new URL('../playwright.config.mjs', import.meta.url), 'utf8');
  for (const project of ['desktop-large', 'desktop', 'desktop-small', 'tablet', 'mobile', 'mobile-small', 'mobile-min']) {
    assert.match(config, new RegExp(`name: '${project}'`));
  }
});

test('mobile pitch spreads lineup cards with dedicated coordinates', () => {
  const state = createNewGame({ seed: 'mobile-pitch-spacing', clubId: 'jp1-01' });
  const html = renderApplication(state, 'squad');
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(html, /--slot-mobile-x:\s*[\d.]+%/);
  assert.match(html, /--slot-mobile-y:\s*[\d.]+%/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.pitch-slot\s*\{[^}]*left:\s*var\(--slot-mobile-x\)[^}]*top:\s*var\(--slot-mobile-y\)[^}]*width:\s*clamp\(48px,\s*15vw,\s*54px\)/);
  const mobileRows = [...html.matchAll(/--slot-mobile-y:([\d.]+)%/g)].map((match) => Number(match[1]));
  assert.deepEqual([...new Set(mobileRows)].sort((a, b) => a - b), [9, 30, 50, 71, 91]);
});
