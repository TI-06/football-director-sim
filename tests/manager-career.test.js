import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';
import { createManagerProfile, generateManagerOffers, recordManagerMatch } from '../src/game/manager-career.js';

test('manager profile stores identity reputation level and career totals', () => {
  const profile = createManagerProfile({ name: '拓海', age: 36, birthplace: '沖縄', preferredTactic: '4-2-3-1' });
  assert.equal(profile.name, '拓海');
  assert.equal(profile.age, 36);
  assert.equal(profile.birthplace, '沖縄');
  assert.equal(profile.matches, 0);
  assert.ok(profile.reputation > 0);
});

test('recording manager results updates totals and reputation', () => {
  let profile = createManagerProfile({ name: '拓海' });
  const before = profile.reputation;
  profile = recordManagerMatch(profile, 'win', { youthStarter: true, financialResult: 2 });
  assert.equal(profile.matches, 1);
  assert.equal(profile.wins, 1);
  assert.equal(profile.youthDevelopment, 1);
  assert.ok(profile.reputation > before);
});

test('reputable managers receive offers from other clubs', () => {
  const state = createNewGame({ clubId: 'jp3-01', seed: 'manager-offers' });
  state.managerProfile.reputation = 78;
  const offers = generateManagerOffers(state, createRng('manager-offers-rng'));
  assert.ok(offers.length >= 1);
  assert.equal(offers.some((offer) => offer.clubId !== state.userClubId), true);
});

test('accepting manager offer preserves career and switches controlled club', () => {
  const state = createNewGame({ clubId: 'jp3-01', seed: 'manager-switch' });
  const target = state.clubs.find((club) => club.id !== state.userClubId && club.division === 2);
  state.managerOffers = [{ id: 'offer-1', clubId: target.id, expiresWeek: 4, status: 'open' }];
  state.managerProfile.matches = 18;
  state.playerPromises = [{ id: 'old-promise', status: 'active' }];
  state.meetingHistory = [{ id: 'old-meeting' }];
  state.scoutingNetwork.shortlist = [{ playerId: 'old-target' }];
  state.boardEvaluation.overall = 1;
  const previousStaffNames = state.staff.map((member) => member.name);
  const result = performAction(state, { type: 'accept-manager-offer', payload: { offerId: 'offer-1' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.userClubId, target.id);
  assert.equal(result.state.managerProfile.matches, 18);
  assert.equal(result.state.lineup.starters.length, 11);
  assert.equal(result.state.boardEvaluation.overall, target.boardConfidence);
  assert.deepEqual(result.state.playerPromises, []);
  assert.deepEqual(result.state.meetingHistory, []);
  assert.deepEqual(result.state.scoutingNetwork.shortlist, []);
  assert.notDeepEqual(result.state.staff.map((member) => member.name), previousStaffNames);
});
