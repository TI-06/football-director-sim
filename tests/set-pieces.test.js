import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultSetPieces, normalizeSetPieces, setPieceModifier } from '../src/game/set-pieces.js';

test('default set-piece plan covers attacking and defending corners free kicks and long throws', () => {
  const plan = createDefaultSetPieces();
  assert.deepEqual(Object.keys(plan.routines).sort(), ['attackingCorner', 'attackingFreeKick', 'defendingCorner', 'defendingFreeKick', 'longThrow'].sort());
});

test('set-piece normalization rejects unknown templates and clamps familiarity', () => {
  const plan = normalizeSetPieces({ familiarity: 140, routines: { attackingCorner: { template: 'unknown' } } });
  assert.equal(plan.familiarity, 100);
  assert.equal(plan.routines.attackingCorner.template, 'near-post');
});

test('higher familiarity and staff ability improve set-piece modifier without exceeding eight percent', () => {
  const low = setPieceModifier({ ...createDefaultSetPieces(), familiarity: 20 }, 40);
  const high = setPieceModifier({ ...createDefaultSetPieces(), familiarity: 95 }, 90);
  assert.ok(high.attack > low.attack);
  assert.ok(high.attack <= 0.08);
  assert.ok(high.defense <= 0.08);
});
