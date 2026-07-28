import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/random.js';
import { createMatchEnvironment, environmentModifiers, travelFatigue } from '../src/game/match-environment.js';
import { createRivalries, derbyEffects, isDerby } from '../src/game/rivalries.js';

test('match environment contains weather pitch temperature travel home advantage and referee', () => {
  const environment = createMatchEnvironment(createRng('environment'), { city: '東京', capacity: 30000 }, { city: '沖縄' });
  for (const key of ['weather', 'pitch', 'temperature', 'travelDistance', 'homeAdvantage', 'referee']) assert.ok(key in environment);
});

test('environment tactical modifiers are capped to plus or minus eight percent', () => {
  const modifiers = environmentModifiers({ weather: '強雨', pitch: '荒れている', temperature: 35, travelDistance: 2200, homeAdvantage: 100, referee: { cardTendency: 100 } });
  for (const value of Object.values(modifiers)) assert.ok(value >= -0.08 && value <= 0.08);
});

test('long-distance travel and consecutive away matches increase fatigue', () => {
  assert.ok(travelFatigue(1800, 2, 30) > travelFatigue(150, 0, 20));
});

test('rivalry list identifies derbies and increases pressure cards and supporter impact', () => {
  const clubs = [{ id: 'a', city: '東京', name: 'A' }, { id: 'b', city: '東京', name: 'B' }, { id: 'c', city: '大阪', name: 'C' }];
  const rivalries = createRivalries(clubs);
  assert.equal(isDerby(rivalries, 'a', 'b'), true);
  assert.equal(isDerby(rivalries, 'a', 'c'), false);
  const effects = derbyEffects(rivalries, 'a', 'b');
  assert.ok(effects.cardRate > 1);
  assert.ok(effects.supporterWeight > 1);
});
