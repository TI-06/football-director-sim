const STRING_KEYS = new Set(['name', 'position']);

function datasetFor(row) {
  return row?.dataset ?? row ?? {};
}

function sortValue(row, key) {
  const dataset = datasetFor(row);
  const field = key === 'role' ? 'roleRank' : key;
  if (STRING_KEYS.has(field)) return String(dataset[field] ?? '');
  const value = Number(dataset[field]);
  return Number.isFinite(value) ? value : 0;
}

export function compareSquadRows(left, right, key = 'role', order = 'desc') {
  const leftValue = sortValue(left, key);
  const rightValue = sortValue(right, key);
  let comparison = 0;
  if (typeof leftValue === 'string' || typeof rightValue === 'string') {
    comparison = String(leftValue).localeCompare(String(rightValue), 'ja');
  } else {
    comparison = leftValue - rightValue;
  }
  if (comparison === 0) {
    comparison = String(datasetFor(left).name ?? '').localeCompare(String(datasetFor(right).name ?? ''), 'ja');
  }
  return order === 'asc' ? comparison : -comparison;
}

export function matchesSquadFilters(row, { role = '', position = '' } = {}) {
  const dataset = datasetFor(row);
  return (!role || dataset.role === role) && (!position || dataset.position === position);
}
