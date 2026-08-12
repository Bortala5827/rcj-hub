// rcj-hub · 统一后台登出
// POST → 清除 rcj_admin cookie

const COOKIE = 'rcj_admin';

export async function onRequestPost() {
  const cookie = `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}
