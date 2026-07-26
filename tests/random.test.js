import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, hashString } from '../src/core/random.js';
import { clamp, formatMoney, deepClone } from '../src/core/utils.js';

test('equal seeds produce equal deterministic sequences', () => {
  const a = createRng('same-seed');
  const b = createRng('same-seed');
  const first = Array.from({ length: 8 }, () => a.next());
  const second = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(first, second);
});

test('rng integer values stay inside inclusive range', () => {
  const rng = createRng(42);
  for (let index = 0; index < 200; index += 1) {
    const value = rng.int(3, 7);
    assert.ok(value >= 3 && value <= 7);
  }
});

test('hash and utility helpers are stable', () => {
  assert.equal(hashString('football'), hashString('football'));
  assert.notEqual(hashString('football'), hashString('football!'));
  assert.equal(clamp(120, 0, 100), 100);
  assert.equal(clamp(-5, 0, 100), 0);
  assert.match(formatMoney(125000000), /億円|125,000,000/);
  const original = { nested: { value: 1 } };
  const cloned = deepClone(original);
  cloned.nested.value = 2;
  assert.equal(original.nested.value, 1);
});
