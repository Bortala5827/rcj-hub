// 通勤聊天管理端点（rcj-analytics-d1 · commute_chat 表）
// 鉴权：后台登录 cookie（rcj_admin，HMAC-SHA256）或明文 ADMIN_KEY 任一通过
// 用法：
//   GET  /api/admin/commute-chat?list=1            列出最近 100 条
//   GET  /api/admin/commute-chat?del=<id>         删除单条
//   GET  /api/admin/commute-chat?delAll=1         清空所有聊天（含 commute_chat_rl 限流表）
const DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1

function hmacHex(key, msg) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(kh => crypto.subtle.sign('HMAC', kh, enc.encode(msg)))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

async function verifyCookie(request, env) {
  const pw = env.ADMIN_PASSWORD || env.ADMIN_KEY || '';
  if (!pw) return false;
  const ck = request.headers.get('Cookie') || '';
  const m = ck.match(/rcj_admin=([^;]+)/);
  if (!m) return false;
  const [ts, sig] = m[1].split('.');
  if (!ts || !sig) return false;
  if (Date.now() / 1000 - Number(ts) > 60 * 60 * 24 * 7) return false;
  const expect = await hmacHex(pw, ts);
  if (expect.length !== sig.length) return false;
  let ok = 1;
  for (let i = 0; i < expect.length; i++) ok &= (expect.charCodeAt(i) === sig.charCodeAt(i));
  return ok === 1;
}

function d1(env, dbId, sql) {
  const acct = env.CF_ACCOUNT_ID, tok = env.CF_API_TOKEN;
  if (!acct || !tok) return Promise.resolve({ error: 'NO_CRED' });
  return fetch(`https://api.cloudflare.com/v4/accounts/${acct}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  }).then(r => r.json()).then(j => j.success ? (j.result || []) : { error: (j.errors && j.errors[0] && j.errors[0].message) || 'D1_FAIL' });
}

function json(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function bad(msg, status) { return json({ ok: false, error: msg }, status || 400); }

function adminKeyOk(url, env) {
  const key = url.searchParams.get('admin') || '';
  const ek = String(env.ADMIN_KEY || '').trim();
  return !!ek && String(key).trim() === ek;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cookieOk = await verifyCookie(request, env);
  const keyOk = adminKeyOk(url, env);
  if (!cookieOk && !keyOk) return bad('未授权（请先登录后台）', 401);

  const del = url.searchParams.get('del');
  const delAll = url.searchParams.get('delAll');
  const list = url.searchParams.get('list');

  if (list) {
    const res = await d1(env, DB, "SELECT id, text, client_id, created_at FROM commute_chat ORDER BY created_at DESC LIMIT 100");
    if (res && res.error) return bad('查询失败：' + res.error, 500);
    const rows = (res && res[0] && res[0].results) || [];
    return json({ ok: true, items: rows });
  }

  if (del) {
    const sql = `DELETE FROM commute_chat WHERE id='${String(del).replace(/'/g, "''")}'`;
    const res = await d1(env, DB, sql);
    if (res && res.error) return bad('删除失败：' + res.error, 500);
    const c = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
    return json({ ok: true, deleted: c, target: `id=${del}` });
  }

  if (delAll) {
    const r1 = await d1(env, DB, "DELETE FROM commute_chat");
    const r2 = await d1(env, DB, "DELETE FROM commute_chat_rl");
    if ((r1 && r1.error) || (r2 && r2.error)) return bad('清空失败：' + (r1.error || r2.error), 500);
    const c = (a) => (a && a[0] && a[0].meta && a[0].meta.changes) || 0;
    return json({ ok: true, deleted: { chat: c(r1), rl: c(r2) } });
  }

  return bad('缺少参数：list=1 / del=<id> / delAll=1', 400);
}
