// rcj-hub · 友链投稿接收（Pages Functions）
// POST /api/link  → 写入 D1，status='pending'
// 绑定：wrangler.toml 中 [[d1_databases]] binding = "DB"

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '表单格式错误' }, 400);
  }

  const name = String(form.get('name') || '').trim();
  const url = String(form.get('url') || '').trim();
  const desc = String(form.get('desc') || '').trim();
  const hp = String(form.get('company') || '').trim(); // honeypot

  if (hp) return json({ ok: false, error: 'spam' }, 400); // 机器人填了隐藏字段
  if (name.length < 1 || name.length > 40) return json({ ok: false, error: '项目名 1-40 字' }, 400);
  if (!/^https?:\/\/[\w.-]+\.[a-z]{2,}.*/i.test(url)) return json({ ok: false, error: '网址格式不对' }, 400);
  if (desc.length > 120) return json({ ok: false, error: '介绍过长' }, 400);

  // 速率限制：同 IP 60s 内最多 1 次
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const since = Date.now() - 60000;
  try {
    const recent = await env.DB.prepare('SELECT COUNT(*) AS c FROM links WHERE ip = ? AND created_at > ?')
      .bind(ip, since).first();
    if (recent && recent.c > 0) return json({ ok: false, error: '提交太频繁，请稍后再试' }, 429);

    await env.DB.prepare('INSERT INTO links (name, url, desc, status, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(name, url, desc, 'pending', ip, Date.now()).run();
  } catch (e) {
    return json({ ok: false, error: '存储失败' }, 500);
  }

  return json({ ok: true, msg: '已收到，筛选通过后会出现在友链区' });
}
