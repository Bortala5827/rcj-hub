// 订单管理端点（orders 表，存在 rcj-analytics-d1）
// 鉴权：后台登录 cookie（rcj_admin，HMAC-SHA256）或明文 ADMIN_KEY 任一通过
// 用法：
//   POST /api/admin/order  body: { id:<订单id>, action:'collect' }  把定金订单标记为「余款已收」(status→paid, balance→0)
//   POST /api/admin/order  body: { id:<订单id>, action:'setStatus', status:'paid'|'deposit'|'pending' }
//   POST /api/admin/order  body: { id:<订单id>, action:'delete' }  删除订单（不可逆）
const ANALYTICS_DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1

function hmac(key, msg) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(kh => crypto.subtle.sign('HMAC', kh, enc.encode(msg)))
    .then(buf => {
      const b = new Uint8Array(buf);
      let s = '';
      for (const x of b) s += String.fromCharCode(x);
      return btoa(s);
    });
}
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
async function verifyCookie(request, env) {
  const pw = env.ADMIN_PASSWORD || env.ADMIN_KEY || '';
  if (!pw) return false;
  const cookie = getCookie(request, 'rcj_admin');
  if (!cookie) return false;
  const [ts, sig] = cookie.split('.');
  if (!ts || !sig) return false;
  if (Date.now() - Number(ts) > 7 * 24 * 60 * 60 * 1000) return false;
  return (await hmac(ts, pw)) === sig;
}
function adminOk(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('admin') || '';
  const envKey = String(env.ADMIN_KEY || '').trim();
  return !!envKey && String(key).trim() === envKey;
}
function d1(env, dbId, sql) {
  const acct = env.CF_ACCOUNT_ID, tok = env.CF_API_TOKEN;
  if (!acct || !tok) return Promise.resolve({ error: 'NO_CRED' });
  return fetch(`https://api.cloudflare.com/v4/accounts/${acct}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  }).then(r => r.json()).then(j => j.success ? (j.result || []) : { error: (j.errors && j.errors[0] && j.errors[0].message) || 'D1_FAIL' });
}
function json(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
function bad(msg, status) { return json({ ok: false, error: msg }, status || 400); }
const esc = s => String(s == null ? '' : s).replace(/'/g, "''");

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return bad('仅支持 POST', 405);
  const cookieOk = await verifyCookie(request, env);
  const keyOk = adminOk(request, env);
  if (!cookieOk && !keyOk) return bad('未授权（请先登录后台）', 401);

  let body;
  try { body = await request.json(); } catch { return bad('JSON 格式错误'); }
  const id = String(body.id || '').trim();
  if (!id) return bad('缺少订单 id');

  const action = body.action;
  try {
    if (action === 'collect') {
      // 定金 → 余款已收：状态置 paid，余款清零（金额仍按定金记，前端汇总时 paid 用全款计算）
      const res = await d1(env, ANALYTICS_DB, `UPDATE orders SET status='paid', balance=0 WHERE id='${esc(id)}'`);
      if (res && res.error) return bad('更新失败：' + res.error, 500);
      const changes = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
      return json({ ok: true, changes, id });
    }
    if (action === 'setStatus') {
      const status = String(body.status || '');
      if (!['paid', 'deposit', 'pending'].includes(status)) return bad('非法状态');
      const res = await d1(env, ANALYTICS_DB, `UPDATE orders SET status='${esc(status)}' WHERE id='${esc(id)}'`);
      if (res && res.error) return bad('更新失败：' + res.error, 500);
      const changes = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
      return json({ ok: true, changes, id, status });
    }
    if (action === 'delete') {
      // 删除订单（测试数据清理/误单撤销，不可逆）
      const res = await d1(env, ANALYTICS_DB, `DELETE FROM orders WHERE id='${esc(id)}'`);
      if (res && res.error) return bad('删除失败：' + res.error, 500);
      const changes = (res && res[0] && res[0].meta && res[0].meta.changes) || 0;
      return json({ ok: true, changes, id });
    }
    return bad('未知 action');
  } catch (e) {
    return bad('异常：' + e.message, 500);
  }
}
