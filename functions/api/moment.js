// rcj-hub · 「天涯共此时」此刻实验后端
// 复用 rcj-analytics-d1（与 track.js / notes.js 同一库、同一套 CF_API_TOKEN+CF_ACCOUNT_ID 直连）
// 第一版场景固定：commute（通勤）
//
// 接口：
//   GET  /api/moment                       -> { ok, scene, active, byCity:{city:n}, totalToday }
//   POST /api/moment  {action:'start',city} -> { ok, id, startedAt, active, byCity }
//   POST /api/moment  {action:'arrive',id}  -> { ok, durationSec, active, byCity }
//   POST /api/moment  {action:'leave',id}   -> 兜底：用户手动结束（不计入到达）
//
// 自动超时：active 定义为 (status='active' AND started_at 在 2 小时内)
// 用 SQL 的 (julianday('now')-julianday(started_at)) < 2/24 过滤——
// 不依赖独立 cron，用户离开页面也不影响实时计数准确性。

const DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const SCENE = 'commute';
const AUTO_END_HOURS = 2;
const ACTIVE_DAYS = AUTO_END_HOURS / 24;
const ACTIVE_FILTER = `(status='active' AND (julianday('now') - julianday(started_at)) < ${ACTIVE_DAYS})`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}
function json(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  }));
}
function bad(msg, code = 400) { return json({ ok: false, error: msg }, code); }

export async function onRequestOptions() {
  return withCors(new Response(null, { status: 204 }));
}

async function d1(env, sql, ms = 6000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${DB}/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
        signal: ac.signal,
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || 'D1 查询失败');
    return j.result;
  } finally { clearTimeout(t); }
}

let _ready = null;
async function ensureTable(env) {
  if (_ready) return _ready;
  _ready = (async () => {
    await d1(env, `CREATE TABLE IF NOT EXISTS moments (
      id TEXT PRIMARY KEY,
      scene TEXT NOT NULL,
      city TEXT,
      mode TEXT,
      traffic TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL
    )`);
    await d1(env, `CREATE INDEX IF NOT EXISTS idx_moments_active ON moments(scene, status, started_at)`);
    // 兼容旧表（v1 上线时无 mode/traffic 列）：探测后幂等补加
    try {
      const info = await d1(env, `PRAGMA table_info(moments)`);
      const cols = (info[0] && info[0].results || []).map((r) => r.name);
      if (!cols.includes('mode')) await d1(env, `ALTER TABLE moments ADD COLUMN mode TEXT`);
      if (!cols.includes('traffic')) await d1(env, `ALTER TABLE moments ADD COLUMN traffic TEXT`);
    } catch { /* PRAGMA 不支持时忽略，新表已有列 */ }
  })();
  return _ready;
}

// 安全转义：D1 REST SQL 用单引号包裹字符串，避免注入
function esc(s) { return String(s).replace(/'/g, "''").slice(0, 64); }

async function snapshot(env) {
  const res = await d1(env,
    `SELECT city, COUNT(*) c FROM moments WHERE scene='${SCENE}' AND ${ACTIVE_FILTER} GROUP BY city`);
  const rows = (res[0] && res[0].results) || [];
  const byCity = {};
  let active = 0;
  for (const r of rows) {
    const n = Number(r.c) || 0;
    byCity[r.city || '未填'] = n;
    active += n;
  }
  return { active, byCity };
}

export async function onRequestGet({ env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return bad('服务端未配置 CF_API_TOKEN / CF_ACCOUNT_ID', 500);
  }
  try {
    await ensureTable(env);
    const { active, byCity } = await snapshot(env);
    return json({ ok: true, scene: SCENE, active, byCity, autoEndHours: AUTO_END_HOURS });
  } catch (e) {
    return bad('查询失败：' + e.message, 500);
  }
}

function randId() {
  // 16 字节随机 → base36
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += x.toString(36).padStart(2, '0');
  return s;
}

export async function onRequestPost({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return bad('服务端未配置 CF_API_TOKEN / CF_ACCOUNT_ID', 500);
  }
  let body = {};
  try { body = await request.json(); } catch { return bad('JSON 解析失败'); }
  const action = String(body.action || '');

  try {
    await ensureTable(env);

    if (action === 'start') {
      // 1) 同 session 已有未结束？直接恢复（idempotent），避免重复计数
      const existingId = String(body.id || '').slice(0, 64);
      if (existingId) {
        const r = await d1(env,
          `SELECT id FROM moments WHERE id='${esc(existingId)}' AND scene='${SCENE}' AND ${ACTIVE_FILTER} LIMIT 1`);
        const hit = (r[0] && r[0].results && r[0].results[0]) || null;
        if (hit) {
          const snap = await snapshot(env);
          return json({ ok: true, id: hit.id, restored: true, ...snap });
        }
      }
      const id = randId();
      const city = body.city ? esc(String(body.city).slice(0, 16)) : '';
      const mode = body.mode ? esc(String(body.mode).slice(0, 16)) : '';
      const traffic = body.traffic ? esc(String(body.traffic).slice(0, 16)) : '';
      const now = new Date().toISOString();
      await d1(env,
        `INSERT INTO moments(id, scene, city, mode, traffic, status, started_at, created_at) VALUES('${id}','${SCENE}','${city}','${mode}','${traffic}','active','${now}','${now}')`);
      const snap = await snapshot(env);
      return json({ ok: true, id, startedAt: now, ...snap });
    }

    if (action === 'arrive') {
      const id = esc(String(body.id || '').slice(0, 64));
      if (!id) return bad('缺少 id');
      const r = await d1(env,
        `SELECT started_at, status FROM moments WHERE id='${id}' AND scene='${SCENE}' LIMIT 1`);
      const row = (r[0] && r[0].results && r[0].results[0]) || null;
      if (!row) return bad('记录不存在或已结束', 404);
      if (row.status === 'arrived') {
        // 二次 arrive 直接返回当前快照，不重复写
        const snap = await snapshot(env);
        return json({ ok: true, alreadyArrived: true, ...snap });
      }
      const now = new Date().toISOString();
      const startedAt = row.started_at;
      const durationSec = Math.max(0, Math.round((new Date(now) - new Date(startedAt)) / 1000));
      await d1(env,
        `UPDATE moments SET status='arrived', ended_at='${now}' WHERE id='${id}' AND scene='${SCENE}'`);
      const snap = await snapshot(env);
      return json({ ok: true, durationSec, ...snap });
    }

    if (action === 'leave') {
      // 用户主动撤销：标记为 left，不计 arrive
      const id = esc(String(body.id || '').slice(0, 64));
      if (!id) return bad('缺少 id');
      const now = new Date().toISOString();
      await d1(env,
        `UPDATE moments SET status='left', ended_at='${now}' WHERE id='${id}' AND scene='${SCENE}' AND status='active'`);
      const snap = await snapshot(env);
      return json({ ok: true, ...snap });
    }

    return bad('未知 action');
  } catch (e) {
    return bad('处理失败：' + e.message, 500);
  }
}
