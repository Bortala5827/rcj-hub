// rcj-hub · 「天涯共此时」此刻实验后端
// 复用 rcj-analytics-d1（与 track.js / notes.js 同一库、同一套 CF_API_TOKEN+CF_ACCOUNT_ID 直连）
// 第一版场景固定：commute（通勤）
//
// 接口：
//   GET  /api/moment                  -> { ok, scene, active, stats:{doneToday,minSec,maxSec,avgSec} }
//   POST /api/moment  {action:'start', clientId, mode?, traffic?}
//                                       -> { ok, id, startedAt, active } 或 { ok:false, error:'已有进行中的记录' }
//   POST /api/moment  {action:'arrive', id}   -> { ok, durationSec, active }
//   POST /api/moment  {action:'leave', id}    -> 兜底：用户手动结束（不计入到达）
//
// 自动超时：active 定义为 (status='active' AND started_at 在 2 小时内)
// 用 SQL 的 (julianday('now')-julianday(started_at)) < 2/24 过滤——
// 不依赖独立 cron，用户离开页面也不影响实时计数准确性。
//
// 防刷：web 端无微信 openid，用 clientId（浏览器 localStorage 生成）做软唯一性——
// 同一 clientId 在 2h 内只能有 1 条 active 记录，避免单浏览器无限刷「我出发了」。

const DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const SCENE = 'commute';
const AUTO_END_HOURS = 2;
const ACTIVE_DAYS = AUTO_END_HOURS / 24;
// 注意：started_at 存的是 UTC（toISOString），必须用 localtime 对齐，否则东八区会把 2h 算成 10h 才失效
const ACTIVE_FILTER = `(status='active' AND (julianday('now','localtime') - julianday(started_at,'localtime')) < ${ACTIVE_DAYS})`;
// 防连点：同一 clientId 在 2 小时内只要有任意一条记录（active 或刚 arrived）就不允许再新建
const RECENT_FILTER = `((julianday('now','localtime') - julianday(started_at,'localtime')) < ${ACTIVE_DAYS})`;

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
    // 兼容旧表（v1 上线时无 mode/traffic/client_id 列）：探测后幂等补加
    try {
      const info = await d1(env, `PRAGMA table_info(moments)`);
      const cols = (info[0] && info[0].results || []).map((r) => r.name);
      if (!cols.includes('mode')) await d1(env, `ALTER TABLE moments ADD COLUMN mode TEXT`);
      if (!cols.includes('traffic')) await d1(env, `ALTER TABLE moments ADD COLUMN traffic TEXT`);
      if (!cols.includes('client_id')) await d1(env, `ALTER TABLE moments ADD COLUMN client_id TEXT`);
      if (!cols.includes('duration_sec')) await d1(env, `ALTER TABLE moments ADD COLUMN duration_sec INTEGER`);
    } catch { /* PRAGMA 不支持时忽略，新表已有列 */ }
  })();
  return _ready;
}

// 安全转义：D1 REST SQL 用单引号包裹字符串，避免注入
function esc(s) { return String(s).replace(/'/g, "''").slice(0, 64); }

async function snapshot(env) {
  const res = await d1(env,
    `SELECT COUNT(*) c FROM moments WHERE scene='${SCENE}' AND ${ACTIVE_FILTER}`);
  const rows = (res[0] && res[0].results) || [];
  const active = Number(rows[0] && rows[0].c) || 0;
  return { active };
}

// 该 clientId 在 2h 内是否已有记录（active 或刚 arrived）→ 用于防刷/防连点
async function recentByClient(env, clientId) {
  const r = await d1(env,
    `SELECT id, status FROM moments WHERE scene='${SCENE}' AND client_id='${esc(clientId)}' AND ${RECENT_FILTER} ORDER BY started_at DESC LIMIT 1`);
  const hit = (r[0] && r[0].results && r[0].results[0]) || null;
  return hit;
}

// 今日已完成（arrived）的通勤统计：次数 / 最短 / 最长 / 平均时长
async function statsToday(env) {
  const res = await d1(env,
    `SELECT COUNT(*) n, MIN(duration_sec) mn, MAX(duration_sec) mx, AVG(duration_sec) av
     FROM moments
     WHERE scene='${SCENE}' AND status='arrived'
       AND date(ended_at, 'localtime') = date('now', 'localtime')`);
  const r = (res[0] && res[0].results && res[0].results[0]) || {};
  const n = Number(r.n) || 0;
  return {
    doneToday: n,
    minSec: n ? Number(r.mn) : 0,
    maxSec: n ? Number(r.mx) : 0,
    avgSec: n ? Math.round(Number(r.av)) : 0,
  };
}

// 今日按小时统计「完成通勤人数」（东八区小时 0-23），用于折线图
async function hourlyToday(env) {
  const res = await d1(env,
    `SELECT CAST(strftime('%H', ended_at, 'localtime') AS INTEGER) h, COUNT(*) c
     FROM moments
     WHERE scene='${SCENE}' AND status='arrived'
       AND date(ended_at, 'localtime') = date('now', 'localtime')
     GROUP BY h`);
  const rows = (res[0] && res[0].results) || [];
  const arr = new Array(24).fill(0);
  for (const r of rows) {
    const h = Number(r.h);
    if (h >= 0 && h < 24) arr[h] = Number(r.c) || 0;
  }
  return arr;
}

export async function onRequestGet({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return bad('服务端未配置 CF_API_TOKEN / CF_ACCOUNT_ID', 500);
  }
  // 管理端点：清空 commute 场景的全部记录（需 ADMIN_KEY，CF 环境变量）
  const url = new URL(request.url);
  // 临时探测：回显 CF_ACCOUNT_ID（非 secret，仅用于自助加变量时定位 account）
  if (url.searchParams.get('probe') === '1') {
    return json({ ok: true, accountId: env.CF_ACCOUNT_ID, hasToken: !!env.CF_API_TOKEN });
  }
  const clearTarget = url.searchParams.get('clear');
  if (clearTarget === SCENE) {
    const admin = url.searchParams.get('admin') || '';
    const ok = String(admin).trim() === String(env.ADMIN_KEY || '').trim() && !!env.ADMIN_KEY;
    if (!ok) return bad('需要 admin 口令', 403);
    try {
      await ensureTable(env);
      await d1(env, `DELETE FROM moments WHERE scene='${SCENE}'`);
      return json({ ok: true, cleared: true, scene: SCENE });
    } catch (e) {
      return bad('清空失败：' + e.message, 500);
    }
  }
  try {
    await ensureTable(env);
    const { active } = await snapshot(env);
    const stats = await statsToday(env);
    const hourly = await hourlyToday(env);
    const open = isOpenLocal(env);
    return json({
      ok: true, scene: SCENE, active, stats, hourly,
      autoEndHours: AUTO_END_HOURS, open, testMode: testMode(env),
    });
  } catch (e) {
    return bad('查询失败：' + e.message, 500);
  }
}

// 时段门禁：仅早高峰 6–10、晚高峰 18–22 开放（东八区 localtime）
// TEST_MODE=on 时全时段开放（开发/测试期；用的人多了再关闭，自动回到门禁）。
function testMode(env) {
  return String(env.TEST_MODE || 'on').trim().toLowerCase() === 'on';
}
function localHour() {
  // CF 运行时为 UTC，手动加 8h 取东八区小时
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.getUTCHours();
}
function isOpenLocal(env) {
  if (testMode(env)) return true; // 测试期：始终开放
  const h = localHour();
  return (h >= 6 && h < 10) || (h >= 18 && h < 22);
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

  // 时段门禁：测试期全开放；否则仅早 6–10 / 晚 18–22 开放提交（东八区）。
  if (action === 'start' && !isOpenLocal(env)) {
    return json({ ok: false, error: '现在不是通勤时段啦～开放时间：早 6–10 点、晚 6–10 点。', code: 'CLOSED', open: false }, 403);
  }

 try {
    await ensureTable(env);

    if (action === 'start') {
      const clientId = String(body.clientId || '').slice(0, 64);

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

      // 2) 防刷 + 防连点：同一 clientId 在 2h 内已有任意记录（active 或刚 arrived），拒绝新建。
      //    这能拦住"到了之后又点我出发了"以及"狂点提交"，每天早/晚高峰各只计一次。
      if (clientId) {
        const recent = await recentByClient(env, clientId);
        if (recent) {
          const snap = await snapshot(env);
          // 若是仍在进行中则恢复；否则提示稍后再发（已记录过本次通勤）
          if (recent.status === 'active') {
            return json({ ok: true, id: recent.id, restored: true, ...snap });
          }
          return json({ ok: false, error: '你最近 2 小时内已经记录过一次通勤啦，稍后再来～', code: 'RECENT_EXISTS' }, 409);
        }
      }

      const id = randId();
      const mode = body.mode ? esc(String(body.mode).slice(0, 16)) : '';
      const traffic = body.traffic ? esc(String(body.traffic).slice(0, 16)) : '';
      const now = new Date().toISOString();
      await d1(env,
        `INSERT INTO moments(id, scene, client_id, mode, traffic, status, started_at, created_at) VALUES('${id}','${SCENE}','${esc(clientId)}','${mode}','${traffic}','active','${now}','${now}')`);
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
        `UPDATE moments SET status='arrived', ended_at='${now}', duration_sec=${durationSec} WHERE id='${id}' AND scene='${SCENE}'`);
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
