import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInteger, formatRating, formatXg } from '../src/core/utils.js';

test('fitness and morale values render as rounded integers', () => {
  assert.equal(formatInteger(72.49), '72');
  assert.equal(formatInteger(72.5), '73');
});

test('player ratings render with exactly one decimal place', () => {
  assert.equal(formatRating(6), '6.0');
  assert.equal(formatRating(7.26), '7.3');
});

test('xG values render with exactly two decimal places', () => {
  assert.equal(formatXg(0), '0.00');
  assert.equal(formatXg(1.236), '1.24');
});
