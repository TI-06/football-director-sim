import { hashPassword, normalizeUserId } from '../../_shared/auth.js';
import { json, readJson } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const userId = normalizeUserId(body.userId);
    const existing = await env.GAME_DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
    if (existing) return json({ ok: false, message: 'このIDは使用されています。' }, 409);
    const password = await hashPassword(body.password);
    await env.GAME_DB.prepare('INSERT INTO users (id, password_hash, password_salt, password_iterations, failed_login_count, locked_until, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)')
      .bind(userId, password.hash, password.salt, password.iterations, Date.now(), Date.now()).run();
    return json({ ok: true, userId }, 201);
  } catch (error) { return json({ ok: false, message: error.message }, 400); }
}
