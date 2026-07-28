import { applyLoginFailure, createSessionToken, digestToken, normalizeUserId, sessionCookie, SESSION_TTL_MS, verifyPassword } from '../../_shared/auth.js';
import { json, readJson } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const userId = normalizeUserId(body.userId);
    const now = Date.now();
    const user = await env.GAME_DB.prepare('SELECT id, password_hash AS hash, password_salt AS salt, password_iterations AS iterations, failed_login_count AS failedLoginCount, locked_until AS lockedUntil FROM users WHERE id = ?').bind(userId).first();
    if (!user) return json({ ok: false, message: 'IDまたはパスワードが違います。' }, 401);
    if (Number(user.lockedUntil) > now) return json({ ok: false, message: 'ログインが一時ロックされています。' }, 423);
    if (!(await verifyPassword(body.password, user))) {
      const failed = applyLoginFailure(user, now);
      await env.GAME_DB.prepare('UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?').bind(failed.failedLoginCount, failed.lockedUntil, now, userId).run();
      return json({ ok: false, message: 'IDまたはパスワードが違います。' }, 401);
    }
    const token = createSessionToken();
    const tokenDigest = await digestToken(token);
    await env.GAME_DB.batch([
      env.GAME_DB.prepare('DELETE FROM sessions WHERE user_id = ? OR expires_at <= ?').bind(userId, now),
      env.GAME_DB.prepare('INSERT INTO sessions (id, user_id, token_digest, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), userId, tokenDigest, now + SESSION_TTL_MS, now),
      env.GAME_DB.prepare('UPDATE users SET failed_login_count = 0, locked_until = 0, updated_at = ? WHERE id = ?').bind(now, userId)
    ]);
    return json({ ok: true, userId }, 200, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) { return json({ ok: false, message: error.message }, 400); }
}
