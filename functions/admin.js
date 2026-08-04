// rcj-hub · 友链审核后台（Pages Functions）
// GET  /admin?key=ADMIN_KEY        → 渲染待审核 / 已通过列表
// POST /admin?key=ADMIN_KEY         → action=approve|reject 改状态
// 密码：CF 后台设 secret 名为 ADMIN_KEY（未设则默认 'changeme'，上线前务必改）
// 绑定：wrangler.toml 中 [[d1_databases]] binding = "DB"

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function unauthorized() {
  return new Response('未授权（缺 key 或 key 错误）', { status: 401 });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-admin-key') || '';
  const ADMIN_KEY = env.ADMIN_KEY || 'changeme';
  if (key !== ADMIN_KEY) return unauthorized();

  if (request.method === 'POST') {
    let f;
    try { f = await request.formData(); } catch { return new Response('bad', { status: 400 }); }
    const id = Number(f.get('id'));
    const action = f.get('action');
    if (!id) return new Response('bad', { status: 400 });
    if (action === 'approve') {
      await env.DB.prepare("UPDATE links SET status = 'approved' WHERE id = ?").bind(id).run();
    } else if (action === 'reject') {
      await env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
    }
    return new Response('ok');
  }

  // GET 渲染审核页
  let rows = [];
  try {
    const { results } = await env.DB.prepare('SELECT * FROM links ORDER BY created_at DESC').all();
    rows = results || [];
  } catch {
    rows = [];
  }

  const items = rows.map(function (r) {
    const isApproved = r.status === 'approved';
    const approveBtn = isApproved
      ? '<span class="adm-ok">已通过</span>'
      : '<form method="POST" action="/admin?key=' + esc(key) + '">' +
        '<input type="hidden" name="id" value="' + r.id + '" />' +
        '<input type="hidden" name="action" value="approve" />' +
        '<button type="submit">通过</button></form>';
    return '<li class="adm-item adm-' + esc(r.status) + '">' +
      '<div class="adm-main">' +
        '<b>' + esc(r.name) + '</b>' +
        '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.url) + '</a>' +
        (r.desc ? '<span class="adm-desc">' + esc(r.desc) + '</span>' : '') +
        '<span class="adm-meta">#' + r.id + ' · ' + esc(r.status) + ' · ' + new Date(r.created_at).toLocaleString('zh-CN') + '</span>' +
      '</div>' +
      '<div class="adm-actions">' + approveBtn +
        '<form method="POST" action="/admin?key=' + esc(key) + '">' +
        '<input type="hidden" name="id" value="' + r.id + '" />' +
        '<input type="hidden" name="action" value="reject" />' +
        '<button type="submit" class="danger">删除</button></form>' +
      '</div>' +
    '</li>';
  }).join('');

  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>友链审核 · RCJ Hub</title>' +
    '<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f7f8fa;color:#0f172a;margin:0;padding:32px 20px;}' +
    'h1{font-size:20px;margin:0 0 4px;} .sub{color:#94a3b8;font-size:13px;margin:0 0 24px;}' +
    '.adm-list{list-style:none;padding:0;margin:0;max-width:720px;display:flex;flex-direction:column;gap:12px;}' +
    '.adm-item{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;background:#fff;border:1px solid #ebeef2;border-radius:12px;padding:16px 18px;}' +
    '.adm-pending{border-left:4px solid #f59e0b;} .adm-approved{border-left:4px solid #16a34a;}' +
    '.adm-main{display:flex;flex-direction:column;gap:3px;min-width:0;}' +
    '.adm-main b{font-size:15px;} .adm-main a{font-size:13px;color:#1e88e5;word-break:break-all;}' +
    '.adm-desc{font-size:13px;color:#475569;} .adm-meta{font-size:12px;color:#94a3b8;}' +
    '.adm-actions{display:flex;gap:8px;flex-shrink:0;}' +
    '.adm-actions button{border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;}' +
    '.adm-actions button[type=submit]:not(.danger){background:#1e88e5;color:#fff;}' +
    '.adm-actions .danger{background:#fee2e2;color:#dc2626;} .adm-ok{font-size:13px;color:#16a34a;font-weight:600;}</style>' +
    '</head><body>' +
    '<h1>友链审核 (' + rows.length + ')</h1>' +
    '<p class="sub">「通过」→ 出现在主页友链区；「删除」→ 直接移除。key 已带在链接里，别外泄。</p>' +
    '<ul class="adm-list">' + (items || '<li>暂无</li>') + '</ul>' +
    '</body></html>';

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
