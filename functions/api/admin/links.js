// rcj-hub · 友链审核 API
// GET  /api/admin/links?password=xxx   → 列出友链
// POST /api/admin/links                → { password?, action: "approve"|"revoke"|"delete", id }
// 鉴权：签名 cookie（统一登录）优先，向后兼容 password 参数
// 绑定：ADMIN_PASSWORD 环境变量 + D1 绑定 DB(rcj-hub-d1)

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
async function getPassword(request) {
  const url = new URL(request.url);
  let pw = url.searchParams.get('password') || '';
  if (!pw) { try { const b = await request.clone().json(); pw = b.password || ''; } catch {} }
  return pw;
}
async function checkAuth(request, env) {
  const cookie = getCookie(request, 'rcj_admin');
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split('.');
    if (p && s && (await hmac(p, env.ADMIN_PASSWORD)) === s) return null;
  }
  const pw = await getPassword(request);
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD 未配置。请在 Cloudflare Pages → Settings → Environment variables 中添加。' }, 500);
  if (pw !== env.ADMIN_PASSWORD) return json({ error: '密码错误' }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const authErr = await checkAuth(request, env);
  if (authErr) return authErr;
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, url, desc, status, created_at FROM links ORDER BY created_at DESC LIMIT 100"
    ).all();
    return json({ ok: true, links: results || [] });
  } catch {
    return json({ error: '数据库查询失败' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const authErr = await checkAuth(request, env);
  if (authErr) return authErr;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }
  const { action, id } = body;
  if (!id || !action) return json({ error: '缺少 id 或 action' }, 400);

  try {
    if (action === 'approve') {
      await env.DB.prepare("UPDATE links SET status = 'approved' WHERE id = ?").bind(id).run();
      return json({ ok: true, msg: '已通过' });
    }
    if (action === 'revoke') {
      await env.DB.prepare("UPDATE links SET status = 'pending' WHERE id = ?").bind(id).run();
      return json({ ok: true, msg: '已撤回' });
    }
    if (action === 'delete') {
      await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
      return json({ ok: true, msg: '已删除' });
    }
    return json({ error: 'action 只能是 approve / revoke / delete' }, 400);
  } catch (e) {
    return json({ error: '数据库操作失败: ' + e.message }, 500);
  }
}
