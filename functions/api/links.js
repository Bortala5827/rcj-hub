// rcj-hub · 友链公开读取（Pages Functions）
// GET /api/links  → 返回 status='approved' 的友链（主页动态渲染）
// 绑定：wrangler.toml 中 [[d1_databases]] binding = "DB"

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT name, url, desc FROM links WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100"
    ).all();
    return new Response(JSON.stringify(results || []), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch {
    // D1 未绑定 / 未建表时优雅降级，不让主页崩
    return new Response('[]', { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
}
