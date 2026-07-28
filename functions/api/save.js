import { requireSession } from '../_shared/auth.js';
import { json, readJson } from '../_shared/http.js';

const MAX_SAVE_BYTES = 4 * 1024 * 1024;

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env.GAME_DB);
  if (!session) return json({ ok: false, message: 'ログインが必要です。' }, 401);
  const row = await env.GAME_DB.prepare('SELECT payload AS save, updated_at AS updatedAt FROM saves WHERE user_id = ?').bind(session.userId).first();
  return json({ ok: true, save: row?.save ?? null, updatedAt: row?.updatedAt ?? null });
}

export async function onRequestPut({ request, env }) {
  const session = await requireSession(request, env.GAME_DB);
  if (!session) return json({ ok: false, message: 'ログインが必要です。' }, 401);
  try {
    const body = await readJson(request);
    if (typeof body.save !== 'string' || new TextEncoder().encode(body.save).byteLength > MAX_SAVE_BYTES) return json({ ok: false, message: 'クラウドセーブは4 MiB以下にしてください。' }, 413);
    const now = Date.now();
    await env.GAME_DB.prepare('INSERT INTO saves (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at').bind(session.userId, body.save, now).run();
    return json({ ok: true, updatedAt: now });
  } catch (error) { return json({ ok: false, message: error.message }, 400); }
}
