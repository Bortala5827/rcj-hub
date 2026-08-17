// rcj-hub · 一次性迁移：把辅警库历史 visit_counts 并入统一库（site='aux'）
// GET /api/admin/migrate  (需后台登录)
// 幂等：INSERT OR REPLACE，重复执行安全。仅管理员可触发。

const DBS = {
  // aux: 'ab639fbe-39b7-4ea8-bd67-18cdaa133599',  // aux-police-exam-d1 —— 已于 2026-08-17 并入 exam 后删除，本迁移脚本随之作废
  analytics: 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828',  // rcj-analytics-d1
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
async function hmac(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
async function verifyAuth(request, env) {
  const cookie = getCookie(request, 'rcj_admin');
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split('.');
    if (p && s && (await hmac(p, env.ADMIN_PASSWORD)) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get('password') || '';
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}
async function d1(env, dbId, sql, ms = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: ac.signal,
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || 'D1 查询失败');
    return j.result[0].results;
  } finally { clearTimeout(timer); }
}

export async function onRequestGet({ request, env }) {
  if (!(await verifyAuth(request, env))) return json({ error: '未登录' }, 401);
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return json({ error: 'CF 环境变量未配置' }, 500);
  try {
    const rows = await d1(env, DBS.aux, "SELECT ip, day, n FROM visit_counts");
    if (!rows.length) return json({ ok: true, migrated: 0, note: '辅警库无历史浏览数据' });
    // 分批写入统一库（每批 200 行，避免单条 SQL 过长）
    const BATCH = 200;
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const vals = chunk.map(r => `('aux',${JSON.stringify(r.day)},${JSON.stringify(r.ip)},${Number(r.n) || 1})`).join(',');
      await d1(env, DBS.analytics, `INSERT OR REPLACE INTO visits(site,day,ip,n) VALUES ${vals}`);
      done += chunk.length;
    }
    const tot = await d1(env, DBS.analytics, "SELECT site, SUM(n) s, COUNT(DISTINCT ip) u FROM visits WHERE site='aux' GROUP BY site");
    return json({ ok: true, migrated: done, unifiedAux: tot[0] || null });
  } catch (e) {
    return json({ error: '迁移失败：' + e.message }, 500);
  }
}
