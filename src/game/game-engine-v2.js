import * as legacy from './game-engine.js?legacy=1';
import { applyPostMatchBalance } from './balance-v2.js';

export const createNewGame = legacy.createNewGame;
export const prepareNextWeek = legacy.prepareNextWeek;

export function completePreparedWeek(prepared, userReport = null) {
  const result = legacy.completePreparedWeek(prepared, userReport);
  if (!result.ok || !result.state || !userReport) return result;
  return { ...result, state: applyPostMatchBalance(result.state, userReport) };
}

export function playNextWeek(state) {
  const result = legacy.playNextWeek(state);
  if (!result.ok || !result.state || !result.matchReport) return result;
  return { ...result, state: applyPostMatchBalance(result.state, result.matchReport) };
}

export function performAction(state, action) {
  return legacy.performAction(state, action);
}
