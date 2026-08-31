// rcj-hub · Sing to Me（0元购）端点
// 玩法：用户在 shop 页为我唱一首歌（录音）→ 我（管理员）送她资料。
// 链路：shop 录音 + 选档位(0/9.9/39/69) + 选资料 + 邮箱
//       → POST /api/sing（语音存 R2 rcj-sing，元数据存 rcj-analytics-d1.sing_requests）
//       → 主后台 955827.xyz/admin 审核（站点状态卡片深链）→ 通过/拒绝/已发
//       → 管理员用自己 Google 邮箱手动把资料发给用户
// 数据清除：clean 清除 30 天前已处理记录 + 删对应 R2 语音（亦可接 cron 自动）
//
// POST /api/sing                 公共提交 {email,tier,materials[],audio(base64),audioType}
// GET  /api/sing?list=1[&only=pending]  需登录，列出
// GET  /api/sing/audio/<id>             需登录，播放语音
// POST /api/sing?id=<id>&action=approve|reject|sent  需登录
// GET  /api/sing?clean=1         需登录，清除 30 天前已处理 + 删 R2

const ANALYTICS_DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const DAY = 24 * 60 * 60 * 1000;
const TIERS = ['0', '9.9', '39', '69'];
const MATERIALS = ['anki', 'app', 'offline', 'ndd', 'jgh', 'fj', 'xf'];
const MAX_AUDIO = 6 * 1024 * 1024; // 6MB 上限，防滥用

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors() },
  });
}
async function d1(env, sql) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { error: 'NO_CRED' };
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json();
  if (!j.success) return { error: (j.errors && j.errors[0] && j.errors[0].message) || 'D1_FAIL' };
  return j.result || [];
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
    const [ts, sig] = cookie.split('.');
    if (!ts || !sig) return false;
    if (Date.now() - Number(ts) > 7 * DAY) return false; // 毫秒过期
    if ((await hmac(ts, env.ADMIN_PASSWORD)) === sig) return true;
  }
  return false;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname; // /api/sing 或 /api/sing/audio/<id>

  // ── 播放语音（需登录）──
  let m = path.match(/^\/api\/sing\/audio\/(.+)$/);
  if (m) {
    if (!(await verifyAuth(request, env))) return json({ ok: false, error: '未登录' }, 401);
    const key = decodeURIComponent(m[1]) + '.webm';
    if (!env.SING_R2) return json({ ok: false, error: 'R2 未绑定' }, 500);
    const obj = await env.SING_R2.get(key);
    if (!obj) return new Response('not found', { status: 404 });
    return new Response(obj.body, {
      headers: { 'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'audio/webm', 'Cache-Control': 'no-store' },
    });
  }

  // ── 公共提交 ──
  if (request.method === 'POST' && !url.searchParams.get('id') && !url.searchParams.get('list') && !url.searchParams.get('clean')) {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON 格式错误' }, 400); }
    const email = String(body.email || '').trim().slice(0, 120);
    const tier = String(body.tier || '').trim();
    const materials = Array.isArray(body.materials) ? body.materials.map(x => String(x)).filter(x => MATERIALS.includes(x)).slice(0, 10) : [];
    const audio = String(body.audio || '');
    const audioType = String(body.audioType || 'webm').slice(0, 10);
    if (!TIERS.includes(tier)) return json({ ok: false, error: '档位无效' }, 400);
    if (!materials.length) return json({ ok: false, error: '请至少选一份想要的资料' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: '邮箱格式不对' }, 400);
    if (!audio) return json({ ok: false, error: '没收到录音，先唱一首吧 🎤' }, 400);
    // base64 → bytes
    let bytes;
    try {
      const bin = atob(audio.indexOf(',') >= 0 ? audio.split(',')[1] : audio);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      bytes = arr;
    } catch { return json({ ok: false, error: '录音数据损坏' }, 400); }
    if (bytes.length > MAX_AUDIO) return json({ ok: false, error: '录音太大啦（≤6MB）' }, 400);

    const ip = (request.headers.get('CF-Connecting-IP') || '0.0.0.0').replace(/'/g, "''");
    const id = 'sg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const now = Date.now();

    // 限流：同 IP 最多 3 条待审核
    const wait = await d1(env, `SELECT COUNT(*) c FROM sing_requests WHERE ip='${ip}' AND status='pending'`);
    if (wait && !wait.error && (wait[0] && wait[0].c || 0) >= 3) return json({ ok: false, error: '待审核太多啦，先等等前面处理完' }, 429);

    const r = await d1(env, `CREATE TABLE IF NOT EXISTS sing_requests (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, tier TEXT NOT NULL DEFAULT '0',
      materials TEXT DEFAULT '[]', audio_key TEXT DEFAULT '', status TEXT DEFAULT 'pending',
      created INTEGER NOT NULL, decided_at INTEGER DEFAULT 0, ip TEXT DEFAULT ''
    )`);
    if (r && r.error) return json({ ok: false, error: '建表失败' }, 500);

    // 语音存 R2
    let audioKey = '';
    if (env.SING_R2) {
      try {
        await env.SING_R2.put(id + '.webm', bytes, { httpMetadata: { contentType: 'audio/webm' } });
        audioKey = id + '.webm';
      } catch (e) { return json({ ok: false, error: '语音存储失败：' + e.message }, 500); }
    } else {
      return json({ ok: false, error: '语音存储暂不可用（R2 未绑定）' }, 500);
    }

    const ins = await d1(env, `INSERT INTO sing_requests (id, email, tier, materials, audio_key, status, created, ip) VALUES ('${id}','${email.replace(/'/g, "''")}','${tier}','${JSON.stringify(materials).replace(/'/g, "''")}','${audioKey}','pending',${now},'${ip}')`);
    if (ins && ins.error) return json({ ok: false, error: '存储失败' }, 500);
    return json({ ok: true, id, msg: '收到啦！我会听你唱的歌，然后给你送资料 🎁' });
  }

  // ── 后台操作（需登录）──
  if (request.method === 'GET' || request.method === 'POST') {
    if (!(await verifyAuth(request, env))) return json({ ok: false, error: '未登录' }, 401);

    // 列表
    if (request.method === 'GET' && url.searchParams.get('list')) {
      const onlyPending = url.searchParams.get('only') === 'pending';
      const sql = `SELECT id, email, tier, materials, audio_key, status, created, decided_at FROM sing_requests ${onlyPending ? "WHERE status='pending'" : ''} ORDER BY created DESC LIMIT 200`;
      const r = await d1(env, sql);
      if (r && r.error) return json({ ok: false, error: r.error }, 500);
      const rows = (r && r[0] && r[0].results) || [];
      return json({ ok: true, list: rows.map(x => ({
        id: x.id, email: x.email, tier: x.tier, materials: (x.materials || '[]'),
        status: x.status, created: x.created | 0, decidedAt: x.decided_at | 0, audioKey: x.audio_key || '',
      })) });
    }
    // 审核操作
    if (request.method === 'POST' && url.searchParams.get('id')) {
      const id = String(url.searchParams.get('id') || '').replace(/'/g, "''");
      const action = String(url.searchParams.get('action') || '').trim();
      const now = Date.now();
      if (action === 'approve') { const r = await d1(env, `UPDATE sing_requests SET status='approved', decided_at=${now} WHERE id='${id}'`); if (r && r.error) return json({ ok: false, error: r.error }, 500); return json({ ok: true, status: 'approved' }); }
      if (action === 'reject') { const r = await d1(env, `UPDATE sing_requests SET status='rejected', decided_at=${now} WHERE id='${id}'`); if (r && r.error) return json({ ok: false, error: r.error }, 500); return json({ ok: true, status: 'rejected' }); }
      if (action === 'sent') { const r = await d1(env, `UPDATE sing_requests SET status='sent', decided_at=${now} WHERE id='${id}'`); if (r && r.error) return json({ ok: false, error: r.error }, 500); return json({ ok: true, status: 'sent' }); }
      return json({ ok: false, error: '未知操作' }, 400);
    }
    // 清理 30 天前已处理 + 删 R2
    if (request.method === 'GET' && url.searchParams.get('clean')) {
      const cutoff = Date.now() - 30 * DAY;
      const r = await d1(env, `SELECT id, audio_key FROM sing_requests WHERE status<>'pending' AND decided_at>0 AND decided_at<${cutoff}`);
      if (r && r.error) return json({ ok: false, error: r.error }, 500);
      const rows = (r && r[0] && r[0].results) || [];
      let delR2 = 0;
      if (env.SING_R2) { for (const x of rows) { if (x.audio_key) { try { await env.SING_R2.delete(x.audio_key); delR2++; } catch {} } } }
      const d = await d1(env, `DELETE FROM sing_requests WHERE status<>'pending' AND decided_at>0 AND decided_at<${cutoff}`);
      const n = (d && d[0] && d[0].meta && d[0].meta.changes) || 0;
      return json({ ok: true, cleaned: n, r2Deleted: delR2 });
    }
  }
  return json({ ok: false, error: 'method' }, 405);
}
