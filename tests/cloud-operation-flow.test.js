import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateCloudAction } from '../src/ui/cloud-operations.js';

test('new cloud account is registered and logged in before save access', async () => {
  const calls = [];
  const client = {
    register: async (...args) => calls.push(['register', ...args]),
    login: async (...args) => calls.push(['login', ...args])
  };

  await authenticateCloudAction(client, 'register', 'taku_01', 'password123');

  assert.deepEqual(calls, [
    ['register', 'taku_01', 'password123'],
    ['login', 'taku_01', 'password123']
  ]);
});

test('existing cloud account only logs in', async () => {
  const calls = [];
  const client = {
    register: async (...args) => calls.push(['register', ...args]),
    login: async (...args) => calls.push(['login', ...args])
  };

  await authenticateCloudAction(client, 'login', 'taku_01', 'password123');

  assert.deepEqual(calls, [['login', 'taku_01', 'password123']]);
});
