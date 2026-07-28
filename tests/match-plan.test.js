import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultMatchPlan,
  normalizeMatchPlan,
  selectAutomaticSubstitutions,
  tacticsForScoreState
} from '../src/game/match-plan.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';

test('default match plan contains tactical reactions and substitution rules', () => {
  const plan = createDefaultMatchPlan();
  assert.equal(plan.automaticSubstitutions, true);
  assert.equal(plan.substitutionMinute, 60);
  assert.equal(plan.maxSubstitutions, 3);
  assert.equal(plan.scoreTactics.leading.mentality, 'cautious');
  assert.equal(plan.scoreTactics.trailing.mentality, 'attacking');
});

test('match plan normalization clamps numeric settings and ignores invalid tactical values', () => {
  const plan = normalizeMatchPlan({
    substitutionMinute: 99,
    fitnessThreshold: 15,
    maxSubstitutions: 9,
    scoreTactics: { trailing: { mentality: 'reckless', pressing: 'very-high' } }
  });
  assert.equal(plan.substitutionMinute, 80);
  assert.equal(plan.fitnessThreshold, 40);
  assert.equal(plan.maxSubstitutions, 5);
  assert.equal(plan.scoreTactics.trailing.mentality, 'attacking');
  assert.equal(plan.scoreTactics.trailing.pressing, 'very-high');
});

test('automatic substitutions prioritize injury then booked risk then low fitness with compatible replacements', () => {
  const starters = [
    { id: 'st', position: 'ST', fitness: 76, age: 28, overall: 78 },
    { id: 'cm', position: 'CM', fitness: 42, age: 25, overall: 75 },
    { id: 'cb', position: 'CB', fitness: 82, age: 30, overall: 80 }
  ];
  const bench = [
    { id: 'bench-st', position: 'ST', fitness: 90, age: 19, overall: 69 },
    { id: 'bench-cm', position: 'CM', fitness: 88, age: 24, overall: 72 },
    { id: 'bench-cb', position: 'CB', fitness: 85, age: 23, overall: 73 }
  ];
  const changes = selectAutomaticSubstitutions({
    starters,
    bench,
    minute: 65,
    plan: { ...createDefaultMatchPlan(), maxSubstitutions: 3 },
    injuredIds: ['st'],
    bookedIds: ['cb'],
    liveRatings: { st: 6.7, cm: 6.1, cb: 6.8 },
    substitutionsUsed: 0
  });
  assert.deepEqual(changes.map((change) => change.playerOutId), ['st', 'cb', 'cm']);
  assert.deepEqual(changes.map((change) => change.playerInId), ['bench-st', 'bench-cb', 'bench-cm']);
  assert.deepEqual(changes.map((change) => change.reason), ['injury', 'booked', 'fitness']);
});

test('score-state tactic reaction overlays only valid configured fields', () => {
  const base = { formation: '4-2-3-1', mentality: 'balanced', pressing: 'normal', tempo: 'normal', passing: 'mixed' };
  const plan = createDefaultMatchPlan();
  const leading = tacticsForScoreState(plan, 'leading', base);
  const trailing = tacticsForScoreState(plan, 'trailing', base);
  assert.equal(leading.formation, '4-2-3-1');
  assert.equal(leading.mentality, 'cautious');
  assert.equal(leading.tempo, 'slow');
  assert.equal(trailing.mentality, 'attacking');
  assert.equal(trailing.pressing, 'very-high');
});

test('new careers persist an editable normalized match plan', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'match-plan-career' });
  assert.equal(state.matchPlan.maxSubstitutions, 3);
  const result = performAction(state, {
    type: 'update-match-plan',
    payload: { substitutionMinute: 72, fitnessThreshold: 55, prioritizeYouth: true }
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.matchPlan.substitutionMinute, 72);
  assert.equal(result.state.matchPlan.fitnessThreshold, 55);
  assert.equal(result.state.matchPlan.prioritizeYouth, true);
});

test('updating one score reaction preserves the other configured score states', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'nested-match-plan' });
  state.matchPlan.scoreTactics.leading = { ...state.matchPlan.scoreTactics.leading, mentality: 'defensive', tempo: 'fast' };
  const beforeLeading = structuredClone(state.matchPlan.scoreTactics.leading);
  const result = performAction(state, {
    type: 'update-match-plan',
    payload: { scoreTactics: { trailing: { mentality: 'positive' } } }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.matchPlan.scoreTactics.leading, beforeLeading);
  assert.equal(result.state.matchPlan.scoreTactics.trailing.mentality, 'positive');
});

test('preserve key players moves an equally tired higher-overall starter up the substitution order', () => {
  const changes = selectAutomaticSubstitutions({
    starters: [
      { id: 'a-rotation', position: 'CM', fitness: 50, age: 27, overall: 68 },
      { id: 'z-key-player', position: 'ST', fitness: 50, age: 29, overall: 84 }
    ],
    bench: [
      { id: 'bench-cm', position: 'CM', fitness: 90, age: 24, overall: 70 },
      { id: 'bench-st', position: 'ST', fitness: 90, age: 24, overall: 72 }
    ],
    minute: 65,
    plan: { ...createDefaultMatchPlan(), maxSubstitutions: 1, preserveKeyPlayers: true },
    liveRatings: {},
    substitutionsUsed: 0
  });
  assert.equal(changes[0].playerOutId, 'z-key-player');
});

test('per-player substitution policy can block automatic replacement', () => {
  const changes = selectAutomaticSubstitutions({
    starters: [{ id: 'key', position: 'ST', fitness: 35, age: 28, overall: 84 }],
    bench: [{ id: 'backup', position: 'ST', fitness: 90, age: 22, overall: 72 }],
    minute: 70,
    plan: { ...createDefaultMatchPlan(), substitutionPolicies: { key: 'never' } },
    liveRatings: { key: 5.2 }
  });
  assert.deepEqual(changes, []);
});

test('after-60 substitution policy blocks replacement before minute 60 and permits it after', () => {
  const input = {
    starters: [{ id: 'key', position: 'CM', fitness: 35, age: 28, overall: 80 }],
    bench: [{ id: 'backup', position: 'CM', fitness: 90, age: 22, overall: 72 }],
    plan: { ...createDefaultMatchPlan(), substitutionMinute: 45, substitutionPolicies: { key: 'after-60' } },
    liveRatings: { key: 5.5 }
  };
  assert.deepEqual(selectAutomaticSubstitutions({ ...input, minute: 55 }), []);
  assert.equal(selectAutomaticSubstitutions({ ...input, minute: 65 })[0].playerOutId, 'key');
});

test('selection and substitution policies can be updated through game actions', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'selection-policy-actions' });
  const playerId = state.lineup.starters[0].playerId;
  const selection = performAction(state, { type: 'set-selection-policy', payload: { playerId, policy: 'starter-fixed' } });
  assert.equal(selection.ok, true);
  assert.equal(selection.state.players.find((player) => player.id === playerId).selectionPolicy, 'starter-fixed');
  const substitution = performAction(selection.state, { type: 'set-substitution-policy', payload: { playerId, policy: 'never' } });
  assert.equal(substitution.ok, true);
  assert.equal(substitution.state.matchPlan.substitutionPolicies[playerId], 'never');
});
