// rcj-hub · 「此刻通勤」实时留言（轻聊天）
// 复用 rcj-analytics-d1（与 moment / track / notes 同一库、同一套 CF_API_TOKEN+CF_ACCOUNT_ID 直连）
//
// 设计约束（用户要求，克制优先）：
//   - 单条文本 ≤ 50 字
//   - 防狂刷：单 IP 发言间隔 ≥ 8 秒，单 IP 单日 ≤ 30 条
//   - 当日即自动清除：用 date(created_at,'localtime')=date('now','localtime') 过滤，跨过本地 0 点旧数据自然不返回
//   - 实时：前端轮询（CF Pages Functions 无 WebSocket 常驻能力，轮询最克制）
//
// 接口：
//   GET  /api/commute-chat  -> { ok, open, items:[{id,text,createdAt}], remaining, resetIn }
//   POST /api/commute-chat  { text }  -> { ok, item } | { ok:false, error, code, left? }

const DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1
const MAX_LEN = 50;
const RATE_SEC = 8;
const DAILY_IP_LIMIT = 30;
const MAX_ITEMS = 100;

// 时段门禁（东八区）：早 6–10 / 晚 18–22
function localHour() {
  return new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
}
function isOpenLocal() {
  const h = localHour();
  return (h >= 6 && h < 10) || (h >= 18 && h < 22);
}
function secToLocalMidnight() {
  // 距离东八区今日 24:00 的秒数（用于"当日清除"提示）
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 1000));
}

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
function bad(msg, code = 400, extra = {}) { return json({ ok: false, error: msg, code, ...extra }, code === 'CLOSED' ? 403 : 429); }

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
    await d1(env, `CREATE TABLE IF NOT EXISTS commute_chat (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      client_id TEXT,
      created_at TEXT NOT NULL
    )`);
    await d1(env, `CREATE INDEX IF NOT EXISTS idx_cc_created ON commute_chat(created_at DESC)`);
    await d1(env, `CREATE TABLE IF NOT EXISTS commute_chat_rl (
      ip TEXT PRIMARY KEY,
      last_ts INTEGER NOT NULL,
      day TEXT NOT NULL,
      n INTEGER DEFAULT 0
    )`);
  })();
  return _ready;
}

function esc(s) { return String(s).replace(/'/g, "''").slice(0, 64); }
function sanitize(s, max) {
  s = (s || '').toString().replace(/\s+/g, ' ').trim();
  return s.slice(0, max);
}
const SENSITIVE = ['赌博', '色情', '炸药', '炸弹', '毒品', '诈骗', '招嫖', '代刷', '枪', '微信', '加我', '私聊', '加微信', 'vx', 'v信', '代练', '代考', '办证'];
function hasSensitive(s) {
  s = (s || '').toLowerCase();
  for (const w of SENSITIVE) if (s.includes(w)) return w;
  if (/(?:^|[^0-9])1[3-9]\d{9}(?:[^0-9]|$)/.test(s)) return '手机号';
  if (/(?:^|[^0-9])\d{3,4}-?\d{7,8}(?:[^0-9]|$)/.test(s)) return '座机号';
  return null;
}
function getIp(req) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
}
function randId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(36)).join('').slice(0, 20);
}

export async function onRequestGet({ env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return bad('服务端未配置', 500);
  try {
    await ensureTable(env);
    const res = await d1(env,
      `SELECT id, text, client_id, created_at FROM commute_chat
       WHERE date(created_at,'localtime') = date('now','localtime')
       ORDER BY created_at DESC LIMIT ${MAX_ITEMS}`);
    const rows = (res[0] && res[0].results) || [];
    const items = rows
      .map((r) => ({ id: r.id, text: r.text, clientId: r.client_id, createdAt: r.created_at }))
      .reverse(); // 旧→新，前端顺序展示
    return json({ ok: true, open: isOpenLocal(), items, resetIn: secToLocalMidnight() });
  } catch (e) {
    return bad('读取失败：' + e.message, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return bad('服务端未配置', 500);
  if (!isOpenLocal()) {
    return bad('现在不是通勤时段啦～开放时间：早 6–10 点、晚 6–10 点。', 'CLOSED', { open: false });
  }
  let body = {};
  try { body = await request.json(); } catch { return bad('JSON 解析失败'); }

  const ip = getIp(request);
  const now = new Date().toISOString();
  const nowSec = Math.floor(Date.now() / 1000);
  const today = now.slice(0, 10);

  // 频率：单 IP ≥ 8s
  try {
    const r = await d1(env, `SELECT last_ts, day, n FROM commute_chat_rl WHERE ip='${esc(ip)}' LIMIT 1`);
    const row = (r[0] && r[0].results && r[0].results[0]) || null;
    if (row) {
      const last = Number(row.last_ts) || 0;
      if (nowSec - last < RATE_SEC) {
        const left = RATE_SEC - (nowSec - last);
        return bad(`说得太快啦，请 ${left} 秒后再发`, 'RATE_LIMIT', { left });
      }
    }
  } catch { /* 限速失败不阻断 */ }

  // 单日配额：单 IP ≤ 30
  try {
    const r = await d1(env, `SELECT n FROM commute_chat_rl WHERE ip='${esc(ip)}' AND day='${today}' LIMIT 1`);
    const row = (r[0] && r[0].results && r[0].results[0]) || null;
    const dayCount = row ? Number(row.n) || 0 : 0;
    if (dayCount >= DAILY_IP_LIMIT) {
      return bad('你今天发言已达上限（30 条），明日再来～', 'DAILY_LIMIT', { resetIn: secToLocalMidnight() });
    }
  } catch { /* 计数失败不阻断 */ }

  // 内容校验
  const text = sanitize(body.text, MAX_LEN);
  if (!text) return bad('说点什么吧', 'EMPTY');
  const hit = hasSensitive(text);
  if (hit) return bad(`含敏感词「${hit}」，换个说法`, 'BAD_WORD', { word: hit });

  const clientId = String(body.clientId || '').slice(0, 64);
  const id = randId();
  try {
    await d1(env,
      `INSERT INTO commute_chat(id, text, client_id, created_at) VALUES('${id}','${esc(text)}','${esc(clientId)}','${now}')`);
    // 更新限速表（upsert：同日 +1，跨日重置）
    await d1(env,
      `INSERT INTO commute_chat_rl(ip, last_ts, day, n) VALUES('${esc(ip)}', ${nowSec}, '${today}', 1)
       ON CONFLICT(ip) DO UPDATE SET last_ts=${nowSec}, day='${today}', n = CASE WHEN day='${today}' THEN n+1 ELSE 1 END`);
  } catch (e) {
    return bad('写入失败：' + e.message, 500);
  }

  // 返回剩余额度
  let remaining = DAILY_IP_LIMIT - 1;
  try {
    const r = await d1(env, `SELECT n FROM commute_chat_rl WHERE ip='${esc(ip)}' AND day='${today}' LIMIT 1`);
    const row = (r[0] && r[0].results && r[0].results[0]) || null;
    remaining = row ? Math.max(0, DAILY_IP_LIMIT - (Number(row.n) || 0)) : DAILY_IP_LIMIT - 1;
  } catch { /* 忽略 */ }

  return json({ ok: true, item: { id, text, clientId, createdAt: now }, remaining, resetIn: secToLocalMidnight() });
}
