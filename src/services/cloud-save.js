export const MAX_SAVE_BYTES = 4 * 1024 * 1024;

export function validateSavePayload(payload) {
  if (typeof payload !== 'string') throw new Error('セーブデータが不正です。');
  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > MAX_SAVE_BYTES) throw new Error('クラウドセーブは4 MiB以下にしてください。');
  return payload;
}

export class CloudSaveClient {
  constructor(fetchImpl = globalThis.fetch?.bind(globalThis)) {
    if (!fetchImpl) throw new Error('fetch is required.');
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await this.fetchImpl(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message ?? `クラウド操作に失敗しました（${response.status}）。`);
    return data;
  }

  register(userId, password) { return this.request('/api/auth/register', { method: 'POST', body: { userId, password } }); }
  login(userId, password) { return this.request('/api/auth/login', { method: 'POST', body: { userId, password } }); }
  logout() { return this.request('/api/auth/logout', { method: 'POST', body: {} }); }
  load() { return this.request('/api/save'); }
  save(save) { return this.request('/api/save', { method: 'PUT', body: { save: validateSavePayload(save) } }); }
}
