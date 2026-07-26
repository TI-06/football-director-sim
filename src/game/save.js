export const SAVE_SCHEMA_VERSION = 1;

export function serializeGame(state) {
  if (!state || state.schemaVersion !== SAVE_SCHEMA_VERSION) {
    throw new Error('Invalid game state.');
  }
  return JSON.stringify(state, null, 2);
}

export function deserializeGame(text) {
  let parsed;
  try {
    parsed = typeof text === 'string' ? JSON.parse(text) : structuredClone(text);
  } catch {
    throw new Error('Invalid save data.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid save data.');
  if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('Unsupported save schema version.');
  const requiredArrays = ['clubs', 'players', 'academy', 'fixtures', 'inbox', 'matchReports'];
  if (requiredArrays.some((key) => !Array.isArray(parsed[key]))) throw new Error('Invalid save data structure.');
  if (!parsed.userClubId || !parsed.tactics || !parsed.lineup) throw new Error('Invalid save data structure.');
  return parsed;
}
