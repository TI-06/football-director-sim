export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

export async function readJson(request) {
  try { return await request.json(); } catch { throw new Error('JSON本文が不正です。'); }
}

export function methodNotAllowed() { return json({ ok: false, message: 'Method not allowed.' }, 405, { Allow: 'GET, POST, PUT' }); }
