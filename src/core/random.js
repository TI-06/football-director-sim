export function hashString(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed = Date.now()) {
  const nextValue = mulberry32(hashString(seed));
  const api = {
    next() {
      return nextValue();
    },
    int(min, max) {
      const lower = Math.ceil(Math.min(min, max));
      const upper = Math.floor(Math.max(min, max));
      return Math.floor(nextValue() * (upper - lower + 1)) + lower;
    },
    float(min = 0, max = 1) {
      return min + nextValue() * (max - min);
    },
    chance(probability) {
      return nextValue() < probability;
    },
    pick(items) {
      if (!Array.isArray(items) || items.length === 0) return undefined;
      return items[Math.floor(nextValue() * items.length)];
    },
    shuffle(items) {
      const result = [...items];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(nextValue() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }
      return result;
    },
    weighted(items, weightSelector = (item) => item.weight ?? 1) {
      if (!Array.isArray(items) || items.length === 0) return undefined;
      const weights = items.map((item) => Math.max(0, Number(weightSelector(item)) || 0));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total <= 0) return api.pick(items);
      let cursor = nextValue() * total;
      for (let index = 0; index < items.length; index += 1) {
        cursor -= weights[index];
        if (cursor <= 0) return items[index];
      }
      return items.at(-1);
    },
    fork(label) {
      return createRng(`${seed}:${label}:${Math.floor(nextValue() * 1e9)}`);
    }
  };
  return api;
}
