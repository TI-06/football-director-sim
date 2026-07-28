import { clearSessionCookie, digestToken, parseCookie } from '../../_shared/auth.js';
import { json } from '../../_shared/http.js';

export async function onRequestPost({ request, env }) {
  const token = parseCookie(request);
  if (token) await env.GAME_DB.prepare('DELETE FROM sessions WHERE token_digest = ?').bind(await digestToken(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
