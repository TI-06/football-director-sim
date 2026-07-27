import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSquadRows, matchesSquadFilters } from '../src/ui/squad-controls.js';
import { autoAdvanceStopReason, unresolvedDecisionIds } from '../src/ui/auto-advance.js';

function row(dataset) {
  return { dataset };
}

test('squad row comparator sorts numeric values and role priority', () => {
  const starter = row({ name: 'alpha', roleRank: '3', overall: '71' });
  const bench = row({ name: 'beta', roleRank: '2', overall: '84' });
  const players = [bench, starter].sort((a, b) => compareSquadRows(a, b, 'role', 'desc'));
  assert.equal(players[0], starter);

  players.sort((a, b) => compareSquadRows(a, b, 'overall', 'desc'));
  assert.equal(players[0], bench);
});

test('squad filters match role and position independently', () => {
  const player = row({ role: 'starter', position: 'CM' });
  assert.equal(matchesSquadFilters(player, { role: 'starter', position: 'CM' }), true);
  assert.equal(matchesSquadFilters(player, { role: 'bench', position: 'CM' }), false);
  assert.equal(matchesSquadFilters(player, { role: '', position: '' }), true);
});

test('auto advance stops for a newly created decision and season completion', () => {
  const before = { seasonStatus: 'active', inbox: [] };
  const after = { seasonStatus: 'active', inbox: [{ id: 'event-1', kind: 'decision', resolved: false }] };
  assert.deepEqual(unresolvedDecisionIds(before), []);
  assert.equal(autoAdvanceStopReason(new Set(), after), 'decision');
  assert.equal(autoAdvanceStopReason(new Set(['event-1']), after), 'pending-decision');
  assert.equal(autoAdvanceStopReason(new Set(), { ...after, seasonStatus: 'complete', inbox: [] }), 'season-complete');
  assert.equal(autoAdvanceStopReason(new Set(), { ...after, seasonStatus: 'complete' }), 'decision');
});

test('auto advance identifies important late-round cup fixtures for the user club', async () => {
  const { importantFixtureReason } = await import('../src/ui/auto-advance.js');
  const state = {
    week: 35,
    userClubId: 'club-a',
    matchPlan: { stopImportantMatches: true },
    fixtures: [],
    cup: { fixtures: [{ week: 35, round: 6, homeId: 'club-a', awayId: 'club-b', played: false }] }
  };
  assert.equal(importantFixtureReason(state), '全国王者杯の重要試合');
  assert.equal(importantFixtureReason({ ...state, matchPlan: { stopImportantMatches: false } }), null);
});
