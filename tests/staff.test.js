import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';
import { STAFF_ROLES, createStaffMarket, ensureEssentialStaff, staffEffects } from '../src/game/staff.js';

test('staff market contains all nine football department roles', () => {
  const market = createStaffMarket(createRng('staff-market'), 27);
  assert.equal(market.length, 27);
  assert.deepEqual(new Set(market.map((staff) => staff.role)), new Set(STAFF_ROLES));
});

test('staff effects combine coaching medical scouting and secretary quality', () => {
  const effects = staffEffects([
    { role: 'head', ability: 80 },
    { role: 'fitness', ability: 70 },
    { role: 'medical', ability: 90 },
    { role: 'scout', ability: 75 },
    { role: 'secretary', ability: 65 }
  ]);
  assert.ok(effects.trainingMultiplier > 1);
  assert.ok(effects.fitnessRecovery > 0);
  assert.ok(effects.medicalReduction >= 1);
  assert.ok(effects.scoutingAccuracy > 0);
  assert.ok(effects.secretaryPriority > 0);
});

test('appointing staff spends cash and replaces the same role', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'staff-appointment' });
  const candidate = state.staffMarket.find((staff) => staff.role === 'attack');
  const before = state.clubs.find((club) => club.id === state.userClubId).cash;
  const result = performAction(state, { type: 'appoint-staff', payload: { staffId: candidate.id } });
  assert.equal(result.ok, true);
  assert.equal(result.state.staff.filter((staff) => staff.role === 'attack').length, 1);
  assert.ok(result.state.clubs.find((club) => club.id === state.userClubId).cash < before);
});

test('essential vacancies receive eight-week interim staff', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'staff-interim' });
  state.staff = state.staff.filter((staff) => !['head', 'medical', 'secretary'].includes(staff.role));
  const restored = ensureEssentialStaff(state);
  for (const role of ['head', 'medical', 'secretary']) {
    const interim = restored.staff.find((staff) => staff.role === role);
    assert.equal(interim.interim, true);
    assert.equal(interim.contractWeeks, 8);
  }
});
