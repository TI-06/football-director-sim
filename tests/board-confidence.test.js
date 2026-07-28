import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardEvaluation, chooseSeasonObjective, updateBoardEvaluation } from '../src/game/board-confidence.js';
import { createNewGame, performAction } from '../src/game/game-engine.js';

test('board evaluation exposes league cup finance youth style local stars and supporter axes', () => {
  const evaluation = createBoardEvaluation({ boardConfidence: 65, fanMood: 72, philosophy: 'balanced' });
  assert.deepEqual(Object.keys(evaluation.axes).sort(), ['attack', 'cup', 'finance', 'league', 'local', 'stars', 'supporters', 'youth'].sort());
  assert.equal(evaluation.overall, 65);
});

test('challenge objective increases budget reward and required score', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'board-objective' });
  const before = state.clubs.find((club) => club.id === state.userClubId).transferBudget;
  const result = performAction(state, { type: 'choose-season-objective', payload: { level: 'challenge' } });
  assert.equal(result.ok, true);
  assert.equal(result.state.boardEvaluation.objective.level, 'challenge');
  assert.ok(result.state.boardEvaluation.objective.requiredScore > 60);
  const challengeBudget = result.state.clubs.find((club) => club.id === state.userClubId).transferBudget;
  assert.ok(challengeBudget > before);
  const switched = chooseSeasonObjective(result.state, 'safe');
  const safeBudget = switched.state.clubs.find((club) => club.id === state.userClubId).transferBudget;
  assert.equal(safeBudget, Math.round(before * 1.02));
  const repeated = chooseSeasonObjective(switched.state, 'safe');
  assert.equal(repeated.state.clubs.find((club) => club.id === state.userClubId).transferBudget, safeBudget);
});

test('low multi-axis score escalates from warning to final warning and dismissal', () => {
  let evaluation = createBoardEvaluation({ boardConfidence: 65, fanMood: 65, philosophy: 'balanced' });
  evaluation = updateBoardEvaluation(evaluation, Object.fromEntries(Object.keys(evaluation.axes).map((key) => [key, 20])));
  assert.equal(evaluation.status, 'warning');
  evaluation = updateBoardEvaluation(evaluation, Object.fromEntries(Object.keys(evaluation.axes).map((key) => [key, 10])));
  assert.equal(evaluation.status, 'final-warning');
  evaluation = updateBoardEvaluation(evaluation, Object.fromEntries(Object.keys(evaluation.axes).map((key) => [key, 0])));
  assert.equal(evaluation.status, 'dismissed');
});
