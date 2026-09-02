// rcj-lab · 统一后台登录
// POST { password } → 校验 ADMIN_PASSWORD → 签发 HMAC 签名 cookie
// cookie 名称 rcj_admin = "<timestamp>.<hmac>"，用 ADMIN_PASSWORD 作 HMAC key

const COOKIE = 'rcj_admin';
const DAY = 60 * 60 * 24;

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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }
  const pw = body.password || '';
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD 未配置。请在 Cloudflare Pages → rcj-lab → Settings → Functions → Environment variables 添加。' }, 500);
  if (pw !== env.ADMIN_PASSWORD) return json({ error: '密码错误' }, 401);

  const payload = String(Date.now()); // 毫秒时间戳（data/health/wall/commute 均按毫秒校验）
  const sig = await hmac(payload, env.ADMIN_PASSWORD);
  const cookie = `${COOKIE}=${encodeURIComponent(payload + '.' + sig)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAY}`; // 1 天有效期，到期需重新登录
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}
