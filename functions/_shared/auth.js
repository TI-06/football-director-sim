const encoder = new TextEncoder();
export const PBKDF2_ITERATIONS = 120_000;
export const SESSION_COOKIE = 'fds_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function derive(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function normalizeUserId(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(normalized)) throw new Error('IDは3～32文字の英数字・_・-で入力してください。');
  return normalized;
}

export async function hashPassword(password, salt = randomBytes(16)) {
  if (String(password ?? '').length < 8) throw new Error('パスワードは8文字以上で入力してください。');
  const hash = await derive(String(password), salt, PBKDF2_ITERATIONS);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(hash), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const derived = await derive(String(password), base64ToBytes(record.salt), Number(record.iterations) || PBKDF2_ITERATIONS);
  const expected = base64ToBytes(record.hash);
  if (derived.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < derived.length; index += 1) mismatch |= derived[index] ^ expected[index];
  return mismatch === 0;
}

export function applyLoginFailure(account, now = Date.now()) {
  const failedLoginCount = Number(account.failedLoginCount ?? account.failed_login_count ?? 0) + 1;
  return { ...account, failedLoginCount, lockedUntil: failedLoginCount >= 5 ? now + 15 * 60 * 1000 : Number(account.lockedUntil ?? account.locked_until ?? 0) };
}

export function rotateSessions(sessions, userId, newSession, now = Date.now()) {
  return [...sessions.filter((session) => session.userId !== userId && Number(session.expiresAt) > now), newSession];
}

export async function digestToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return bytesToBase64(new Uint8Array(digest));
}

export function createSessionToken() {
  return bytesToBase64(randomBytes(32)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function parseCookie(request, name = SESSION_COOKIE) {
  const cookie = request.headers.get('Cookie') ?? '';
  const pair = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

export function sessionCookie(token, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function requireSession(request, db, now = Date.now()) {
  const token = parseCookie(request);
  if (!token) return null;
  const tokenDigest = await digestToken(token);
  const session = await db.prepare('SELECT id, user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_digest = ?').bind(tokenDigest).first();
  if (!session || Number(session.expiresAt) <= now) return null;
  return session;
}
