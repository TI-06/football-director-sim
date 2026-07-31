import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/game/game-engine.js';
import { deserializeGame, serializeGame, SAVE_SCHEMA_VERSION } from '../src/game/save.js';
import { CloudSaveClient, MAX_SAVE_BYTES, validateSavePayload } from '../src/services/cloud-save.js';
import { applyLoginFailure, hashPassword, normalizeUserId, rotateSessions, verifyPassword } from '../functions/_shared/auth.js';

test('cloud account IDs are normalized and reject unsafe values', () => {
  assert.equal(normalizeUserId('  Taku_01  '), 'taku_01');
  assert.throws(() => normalizeUserId('a'), /ID/);
  assert.throws(() => normalizeUserId('bad id!'), /ID/);
});

test('PBKDF2 password hash verifies the correct password and rejects another', async () => {
  const record = await hashPassword('correct horse battery staple', new Uint8Array(16).fill(7));
  assert.equal(await verifyPassword('correct horse battery staple', record), true);
  assert.equal(await verifyPassword('wrong password', record), false);
  assert.equal(record.iterations, 120000);
});

test('five failed logins lock the account for fifteen minutes', () => {
  let account = { failedLoginCount: 0, lockedUntil: 0 };
  const now = 1_000_000;
  for (let count = 0; count < 5; count += 1) account = applyLoginFailure(account, now);
  assert.equal(account.failedLoginCount, 5);
  assert.equal(account.lockedUntil, now + 15 * 60 * 1000);
});

test('same-account login replaces old and expired sessions', () => {
  const sessions = [
    { id: 'old', userId: 'u1', expiresAt: 9999 },
    { id: 'other', userId: 'u2', expiresAt: 9999 },
    { id: 'expired', userId: 'u3', expiresAt: 100 }
  ];
  const rotated = rotateSessions(sessions, 'u1', { id: 'new', userId: 'u1', expiresAt: 12000 }, 1000);
  assert.deepEqual(rotated.map((item) => item.id).sort(), ['new', 'other']);
});

test('cloud save payload accepts four MiB and rejects anything larger', () => {
  assert.equal(validateSavePayload('a'.repeat(MAX_SAVE_BYTES)).length, MAX_SAVE_BYTES);
  assert.throws(() => validateSavePayload('a'.repeat(MAX_SAVE_BYTES + 1)), /4 MiB/);
});

test('cloud client sends same-origin credentials for register login load save and logout', async () => {
  const calls = [];
  const client = new CloudSaveClient(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ ok: true, save: null }) };
  });
  await client.register('taku_01', 'password123');
  await client.login('taku_01', 'password123');
  await client.save('{}');
  await client.load();
  await client.logout();
  assert.equal(calls.length, 5);
  assert.equal(calls.every((call) => call.init.credentials === 'same-origin'), true);
});

test('schema version four round-trips all club-life scouting match-culture state boundaries', () => {
  const state = createNewGame({ clubId: 'jp1-01', seed: 'cloud-schema' });
  assert.equal(SAVE_SCHEMA_VERSION, 4);
  const restored = deserializeGame(serializeGame(state));
  for (const key of ['staff', 'playerPromises', 'boardEvaluation', 'managerProfile', 'scoutingNetwork', 'transferNegotiations', 'loans', 'setPieces', 'rivalries']) assert.ok(key in restored);
});
