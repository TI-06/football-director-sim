export const SAVE_SCHEMA_VERSION = 4;

const SAVE_FORMAT = 'football-director-save-v4';
const SAVE_ENCODING = 'lzw-base64';
const MAX_CODE = 65_534;
const LEGACY_SAVE_ERROR = '旧バージョンのセーブデータはこの版では読み込めません。';

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function compressLzw(text) {
  const input = new TextEncoder().encode(text);
  if (!input.length) return '';
  let dictionary = new Map();
  let nextCode = 256;
  const codes = [];
  let phrase = String.fromCharCode(input[0]);

  for (let index = 1; index < input.length; index += 1) {
    const character = String.fromCharCode(input[index]);
    const combined = phrase + character;
    if (dictionary.has(combined)) {
      phrase = combined;
      continue;
    }
    codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase));
    if (nextCode <= MAX_CODE) {
      dictionary.set(combined, nextCode);
      nextCode += 1;
    } else {
      dictionary = new Map();
      nextCode = 256;
    }
    phrase = character;
  }
  codes.push(phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase));

  const bytes = new Uint8Array(codes.length * 2);
  for (let index = 0; index < codes.length; index += 1) {
    bytes[index * 2] = codes[index] >>> 8;
    bytes[index * 2 + 1] = codes[index] & 255;
  }
  return bytesToBase64(bytes);
}

function decompressLzw(value) {
  if (!value) return '';
  const bytes = base64ToBytes(value);
  if (bytes.length % 2 !== 0) throw new Error('Invalid compressed save data.');
  const codes = new Uint16Array(bytes.length / 2);
  for (let index = 0; index < codes.length; index += 1) {
    codes[index] = (bytes[index * 2] << 8) | bytes[index * 2 + 1];
  }
  if (!codes.length) return '';

  let dictionary = [];
  let nextCode = 256;
  let phrase = String.fromCharCode(codes[0]);
  const output = [phrase];
  for (let index = 1; index < codes.length; index += 1) {
    const code = codes[index];
    let entry;
    if (code < 256) entry = String.fromCharCode(code);
    else if (dictionary[code] !== undefined) entry = dictionary[code];
    else if (code === nextCode) entry = phrase + phrase[0];
    else throw new Error('Invalid compressed save data.');

    output.push(entry);
    if (nextCode <= MAX_CODE) {
      dictionary[nextCode] = phrase + entry[0];
      nextCode += 1;
    } else {
      dictionary = [];
      nextCode = 256;
    }
    phrase = entry;
  }
  const binary = output.join('');
  const decoded = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) decoded[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(decoded);
}

function validateState(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid save data.');
  if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error(LEGACY_SAVE_ERROR);
  const requiredArrays = ['clubs', 'players', 'academy', 'fixtures', 'inbox', 'matchReports', 'staff', 'playerPromises', 'transferNegotiations', 'loans', 'rivalries'];
  if (requiredArrays.some((key) => !Array.isArray(parsed[key]))) throw new Error('Invalid save data structure.');
  if (!parsed.userClubId || !parsed.tactics || !parsed.lineup || !parsed.cup || !parsed.standingsByDivision || !parsed.boardEvaluation || !parsed.managerProfile || !parsed.scoutingNetwork || !parsed.setPieces) throw new Error('Invalid save data structure.');
  return parsed;
}

export function serializeGame(state) {
  validateState(state);
  const payload = compressLzw(JSON.stringify(state));
  return JSON.stringify({
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    encoding: SAVE_ENCODING,
    data: payload
  });
}

export function deserializeGame(text) {
  let parsed;
  try {
    parsed = typeof text === 'string' ? JSON.parse(text) : structuredClone(text);
    if (parsed?.format && parsed.format !== SAVE_FORMAT) throw new Error(LEGACY_SAVE_ERROR);
    if (parsed?.format === SAVE_FORMAT) {
      if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION || parsed.encoding !== SAVE_ENCODING || typeof parsed.data !== 'string') {
        throw new Error(LEGACY_SAVE_ERROR);
      }
      parsed = JSON.parse(decompressLzw(parsed.data));
    }
  } catch (error) {
    if (/旧バージョン/.test(error?.message ?? '')) throw error;
    throw new Error('Invalid save data.');
  }
  return validateState(parsed);
}
