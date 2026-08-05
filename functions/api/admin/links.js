// rcj-hub · 友链审核 API
// GET  /api/admin/links?password=xxx          → 列出待审核
// POST /api/admin/links                       → { password, action: "approve"|"delete", id }
// 绑定：ADMIN_PASSWORD 环境变量

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function checkAuth(env, password) {
  const correct = env.ADMIN_PASSWORD;
  if (!correct) return json({ error: 'ADMIN_PASSWORD 未配置。请在 Cloudflare Pages → Settings → Environment variables 中添加。' }, 500);
  if (password !== correct) return json({ error: '密码错误' }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const password = url.searchParams.get('password') || '';
  const authErr = checkAuth(env, password);
  if (authErr) return authErr;

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, url, desc, status, created_at FROM links WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50"
    ).all();
    return json({ ok: true, pending: results || [] });
  } catch {
    return json({ error: '数据库查询失败' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }

  const { password, action, id } = body;
  const authErr = checkAuth(env, password || '');
  if (authErr) return authErr;

  if (!id || !action) return json({ error: '缺少 id 或 action' }, 400);

  try {
    if (action === 'approve') {
      await env.DB.prepare("UPDATE links SET status = 'approved' WHERE id = ?").bind(id).run();
      return json({ ok: true, msg: '已通过' });
    }
    if (action === 'delete') {
      await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
      return json({ ok: true, msg: '已删除' });
    }
    return json({ error: 'action 只能是 approve 或 delete' }, 400);
  } catch (e) {
    return json({ error: '数据库操作失败: ' + e.message }, 500);
  }
}
