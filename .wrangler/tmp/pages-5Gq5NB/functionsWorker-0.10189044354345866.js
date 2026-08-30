var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/admin/data.js
var DBS = {
  facetalk: "f93a89d7-ef5f-49c5-863d-5f1611e1a7f4",
  // mianshi-dazi-d1 (FaceTalk)
  analytics: "b3198ef2-6e7c-424e-8a0f-a7b21afc1828"
  // rcj-analytics-d1 (统一浏览统计)
};
var _cache = null;
var _cacheAt = 0;
var CACHE_TTL = 6e4;
function getCached() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  return null;
}
__name(getCached, "getCached");
function setCached(val) {
  _cache = val;
  _cacheAt = Date.now();
}
__name(setCached, "setCached");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json, "json");
async function hmac(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac, "hmac");
function getCookie(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie, "getCookie");
async function verifyAuth(request, env) {
  const cookie = getCookie(request, "rcj_admin");
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split(".");
    if (p && s && await hmac(p, env.ADMIN_PASSWORD) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get("password") || "";
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}
__name(verifyAuth, "verifyAuth");
async function d1(env, dbId, sql, ms = 6e3) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
      signal: ac.signal
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || "D1 \u67E5\u8BE2\u5931\u8D25");
    return j.result[0].results;
  } finally {
    clearTimeout(timer);
  }
}
__name(d1, "d1");
async function onRequestGet({ request, env }) {
  if (!await verifyAuth(request, env)) return json({ error: "\u672A\u767B\u5F55" }, 401);
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ error: "CF_API_TOKEN / CF_ACCOUNT_ID \u672A\u914D\u7F6E\u3002\u8BF7\u5728 rcj-hub Pages \u2192 Settings \u2192 Functions \u2192 Environment variables \u6DFB\u52A0\u8FD9\u4E24\u4E2A\u53D8\u91CF\u3002" }, 500);
  }
  const hit = getCached();
  if (hit) {
    const body = JSON.parse(hit);
    body.generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    body.cached = true;
    return json(body);
  }
  try {
    const results = await Promise.allSettled([
      // [0] facetalk: pairs 状态 + 近 6 条（合并为一次，前端再分）
      d1(env, DBS.facetalk, "SELECT status, COUNT(*) c FROM pairs GROUP BY status"),
      // [1] facetank: 全部计数合并（intents / applications / wall / reports / ratings / messages）
      d1(env, DBS.facetalk, "SELECT 'intents' AS k, COUNT(*) c FROM intents UNION ALL SELECT 'applications', COUNT(*) FROM applications UNION ALL SELECT 'wall', COUNT(*) FROM wall UNION ALL SELECT 'reports', COUNT(*) FROM reports UNION ALL SELECT 'ratings', COUNT(*) FROM ratings UNION ALL SELECT 'messages', COUNT(*) FROM messages"),
      // [2] facetalk: 近期 pairs
      d1(env, DBS.facetalk, "SELECT a, b, mode, status, created FROM pairs ORDER BY created DESC LIMIT 6"),
      // [3] facetalk: 近期 wall（含 id/ip 便于后台区分来源与删除，放宽到 200 条供留言管理面板）
      d1(env, DBS.facetalk, "SELECT id, name, text, created_at, COALESCE(ip,'') AS ip FROM wall ORDER BY created_at DESC LIMIT 200"),
      // [4][5] 辅警库已删除（2026-08-17 并入 exam 后下线），停止对其 D1 的查询；
      //         辅警站点浏览统计仍由 rcj-analytics-d1 的 site='aux' 承接（见下方 auxUni）。
      Promise.resolve(null),
      Promise.resolve(null),
      // [6] analytics: 趋势 + 汇总（合并为一次——按 site 聚合 day + total/u/d 一起算）
      d1(env, DBS.analytics, "SELECT site, day, SUM(n) s, 0 as total, 0 as u, 0 as d FROM visits GROUP BY site, day UNION ALL SELECT site, '' as day, SUM(n) as s, SUM(n) as total, COUNT(DISTINCT ip) as u, COUNT(DISTINCT day) as d FROM visits GROUP BY site ORDER BY site, day"),
      // [7] analytics: 最近 7 天访问明细（site/day/ip/n，供概览「最近访问」表）
      d1(env, DBS.analytics, "SELECT site, day, ip, n FROM visits WHERE day >= date('now','-6 day') ORDER BY day DESC, site, n DESC LIMIT 60"),
      // [8] ai_calls: AI 调用聚合（按项目/provider/日期，表由 ai-track.js 首次调用时自动建）
      d1(env, DBS.analytics, "SELECT 'by_project' as k, project as dim1, status as dim2, COUNT(*) c FROM ai_calls GROUP BY project, status UNION ALL SELECT 'by_provider', provider, status, COUNT(*) FROM ai_calls GROUP BY provider, status UNION ALL SELECT 'by_day', day, status, COUNT(*) FROM ai_calls WHERE day >= date('now','-13 day') GROUP BY day, status")
    ]);
    const v = /* @__PURE__ */ __name((i) => results[i].status === "fulfilled" ? results[i].value : null, "v");
    const warns = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") warns.push(`\u67E5\u8BE2#${i} \u5931\u8D25: ${r.reason.message}`);
    });
    const ftPairs = v(0);
    const ftCountsRaw = v(1);
    const ftPairsRecent = v(2);
    const ftWallRecent = v(3);
    const uniAll = v(6);
    const recentVisits = v(7) || [];
    const aiRaw = v(8) || [];
    const aiByProject = {}, aiByProvider = {}, aiByDay = {};
    let aiTotal = 0, aiOk = 0;
    (aiRaw || []).forEach((r) => {
      const c = Number(r.c) || 0;
      const bucket = r.k === "by_project" ? aiByProject : r.k === "by_provider" ? aiByProvider : r.k === "by_day" ? aiByDay : null;
      if (!bucket) return;
      const key = r.dim1 || "unknown";
      if (!bucket[key]) bucket[key] = { total: 0, ok: 0, fail: 0 };
      bucket[key].total += c;
      if (r.dim2 === "ok") bucket[key].ok += c;
      else bucket[key].fail += c;
      if (r.k === "by_project") {
        aiTotal += c;
        if (r.dim2 === "ok") aiOk += c;
      }
    });
    const ftCounts = {};
    (ftCountsRaw || []).forEach((r) => {
      ftCounts[r.k] = r.c || 0;
    });
    const bySite = {};
    const totalsMap = {};
    (uniAll || []).forEach((r) => {
      if (!bySite[r.site]) bySite[r.site] = { points: [], total: 0, u: 0, d: 0 };
      if (r.day) {
        bySite[r.site].points.push({ day: r.day, s: Number(r.s) || 0 });
      } else {
        bySite[r.site].total = Number(r.total) || 0;
        bySite[r.site].u = Number(r.u) || 0;
        bySite[r.site].d = Number(r.d) || 0;
      }
    });
    const analyticsSeries = Object.keys(bySite).map((site) => ({
      site,
      // 保留最近 31 个有数据日，前端可切换 7/14/30 天视图
      points: (bySite[site].points || []).slice(-31),
      total: bySite[site].total || 0,
      u: bySite[site].u || 0,
      d: bySite[site].d || 0
    }));
    const allVisits = analyticsSeries.reduce((a, s) => a + s.total, 0);
    const pairs = {};
    (ftPairs || []).forEach((r) => pairs[r.status] = r.c);
    const auxUni = bySite["aux"] || {};
    const auxVisits = { s: auxUni.total || 0, u: auxUni.u || 0, d: auxUni.d || 0 };
    const auxVisitTrend = (auxUni.points || []).slice().reverse();
    const payload = {
      ok: true,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      facetalk: {
        pairsTotal: Object.values(pairs).reduce((a, b) => a + b, 0),
        pairsByStatus: pairs,
        intents: ftCounts.intents || 0,
        applications: ftCounts.applications || 0,
        wall: ftCounts.wall || 0,
        reports: ftCounts.reports || 0,
        ratings: ftCounts.ratings || 0,
        messages: ftCounts.messages || 0,
        recentPairs: ftPairsRecent || [],
        recentWall: ftWallRecent || []
      },
      aux: {
        visits: auxVisits,
        visitTrend: auxVisitTrend,
        // 辅警站点只接入浏览统计（rcj-analytics-d1 · site='aux'）。
        // 留言墙 / 信号匹配是 FaceTalk（mianshi-dazi-d1）专属功能，辅警从未开通，故不含 wallTotal/signalMatch 字段。
        note: "\u8F85\u8B66\u7AD9\u70B9\u4EC5\u63A5\u5165\u6D4F\u89C8\u7EDF\u8BA1\uFF08rcj-analytics-d1 \xB7 site=aux\uFF09\uFF1B\u7559\u8A00\u5899\u4E0E\u4FE1\u53F7\u5339\u914D\u4E3A FaceTalk \u4E13\u5C5E\u529F\u80FD\uFF0C\u8F85\u8B66\u672A\u5F00\u901A\uFF0C\u6545\u65E0\u4E92\u52A8\u6570\u636E\u3002"
      },
      analytics: { allVisits, series: analyticsSeries, bySite },
      ai: {
        total: aiTotal,
        ok: aiOk,
        fail: aiTotal - aiOk,
        successRate: aiTotal ? Math.round(aiOk / aiTotal * 100) : 0,
        byProject: aiByProject,
        byProvider: aiByProvider,
        byDay: aiByDay
      },
      recentVisits,
      note: "\u6570\u636E\u6E90\uFF1Amianshi-dazi-d1\uFF08FaceTalk \u4E92\u52A8\u6570\u636E\uFF09+ rcj-analytics-d1\uFF08\u7EDF\u4E00\u6D4F\u89C8\u7EDF\u8BA1\uFF0C\u542B site=aux \u8F85\u8B66\u7AD9\u70B9\uFF09\u3002aux-police-exam-d1 \u5DF2\u4E8E 2026-08-17 \u5E76\u5165 exam \u540E\u5220\u9664\u3002",
      warns: warns.length ? warns : void 0
    };
    setCached(JSON.stringify(payload));
    return json(payload);
  } catch (e) {
    return json({ error: "\u805A\u5408\u5931\u8D25\uFF1A" + e.message }, 500);
  }
}
__name(onRequestGet, "onRequestGet");

// api/admin/health.js
var TARGETS = [
  { id: "hub", name: "RCJ Lab \u4E3B\u7AD9", url: "https://955827.xyz/" },
  { id: "solo", name: "SoloSpeak", url: "https://955827.xyz/solospeak/" },
  { id: "letout", name: "LetOut", url: "https://955827.xyz/letout/" },
  { id: "exam", name: "Exam Hub", url: "https://exam.955827.xyz/" },
  { id: "fj", name: "\u8F85\u8B66\u9898\u5E93", url: "https://exam.955827.xyz/fj" },
  { id: "xf", name: "\u6D88\u9632\u9898\u5E93", url: "https://exam.955827.xyz/xf" },
  { id: "ft", name: "FaceTalk", url: "https://facetalk.955827.xyz/" },
  { id: "ftadm", name: "FaceTalk \u540E\u53F0", url: "https://facetalk.955827.xyz/admin" }
];
var _cache2 = null;
var _cacheAt2 = 0;
var CACHE_TTL2 = 15e3;
function json2(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json2, "json");
async function hmac2(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac2, "hmac");
function getCookie2(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie2, "getCookie");
async function verifyAuth2(request, env) {
  const cookie = getCookie2(request, "rcj_admin");
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split(".");
    if (p && s && await hmac2(p, env.ADMIN_PASSWORD) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get("password") || "";
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}
__name(verifyAuth2, "verifyAuth");
async function probe(target) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4e3);
  try {
    const r = await fetch(target.url, { method: "HEAD", redirect: "follow", signal: ac.signal });
    return { ...target, ok: r.ok, status: r.status, ms: 0 };
  } catch (e) {
    return { ...target, ok: false, status: 0, error: e.name === "AbortError" ? "\u8D85\u65F6" : "\u4E0D\u53EF\u8FBE" };
  } finally {
    clearTimeout(timer);
  }
}
__name(probe, "probe");
async function onRequestGet2({ request, env }) {
  if (!await verifyAuth2(request, env)) return json2({ error: "\u672A\u767B\u5F55" }, 401);
  const hit = _cache2 && Date.now() - _cacheAt2 < CACHE_TTL2 ? _cache2 : null;
  if (hit) return json2({ ok: true, cached: true, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), sites: hit });
  const sites = await Promise.all(TARGETS.map(probe));
  const summary = { up: sites.filter((s) => s.ok).length, total: sites.length };
  _cache2 = sites;
  _cacheAt2 = Date.now();
  return json2({ ok: true, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), summary, sites });
}
__name(onRequestGet2, "onRequestGet");

// api/admin/login.js
var COOKIE = "rcj_admin";
var DAY = 60 * 60 * 24;
function json3(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json3, "json");
async function hmac3(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac3, "hmac");
async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json3({ error: "JSON \u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const pw = body.password || "";
  if (!env.ADMIN_PASSWORD) return json3({ error: "ADMIN_PASSWORD \u672A\u914D\u7F6E\u3002\u8BF7\u5728 Cloudflare Pages \u2192 rcj-hub \u2192 Settings \u2192 Functions \u2192 Environment variables \u6DFB\u52A0\u3002" }, 500);
  if (pw !== env.ADMIN_PASSWORD) return json3({ error: "\u5BC6\u7801\u9519\u8BEF" }, 401);
  const payload = String(Date.now());
  const sig = await hmac3(payload, env.ADMIN_PASSWORD);
  const cookie = `${COOKIE}=${encodeURIComponent(payload + "." + sig)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAY * 7}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": cookie, "Cache-Control": "no-store" }
  });
}
__name(onRequestPost, "onRequestPost");

// api/admin/logout.js
var COOKIE2 = "rcj_admin";
async function onRequestPost2() {
  const cookie = `${COOKIE2}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": cookie, "Cache-Control": "no-store" }
  });
}
__name(onRequestPost2, "onRequestPost");

// api/admin/migrate.js
function json4(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json4, "json");
async function hmac4(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac4, "hmac");
function getCookie3(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie3, "getCookie");
async function verifyAuth3(request, env) {
  const cookie = getCookie3(request, "rcj_admin");
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split(".");
    if (p && s && await hmac4(p, env.ADMIN_PASSWORD) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get("password") || "";
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}
__name(verifyAuth3, "verifyAuth");
async function onRequestGet3({ request, env }) {
  if (!await verifyAuth3(request, env)) return json4({ error: "\u672A\u767B\u5F55" }, 401);
  return json4({
    ok: true,
    migrated: 0,
    note: "aux-police-exam-d1 \u5DF2\u4E8E 2026-08-17 \u5E76\u5165 exam \u540E\u5220\u9664\uFF0C\u8F85\u8B66\u5386\u53F2\u6D4F\u89C8\u6570\u636E\u65E0\u9700\u518D\u8FC1\u79FB\u3002"
  });
}
__name(onRequestGet3, "onRequestGet");

// api/admin/commute-chat.js
var DB = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
async function hmac5(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac5, "hmac");
function getCookie4(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie4, "getCookie");
async function verifyCookie(request, env) {
  const pw = env.ADMIN_PASSWORD || env.ADMIN_KEY || "";
  if (!pw) return false;
  const cookie = getCookie4(request, "rcj_admin");
  if (!cookie) return false;
  const [ts, sig] = cookie.split(".");
  if (!ts || !sig) return false;
  if (Date.now() / 1e3 - Number(ts) > 60 * 60 * 24 * 7) return false;
  return await hmac5(ts, pw) === sig;
}
__name(verifyCookie, "verifyCookie");
function d12(env, dbId, sql) {
  const acct = env.CF_ACCOUNT_ID, tok = env.CF_API_TOKEN;
  if (!acct || !tok) return Promise.resolve({ error: "NO_CRED" });
  return fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/d1/database/${dbId}/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql })
  }).then((r) => r.json()).then((j) => j.success ? j.result || [] : { error: j.errors && j.errors[0] && j.errors[0].message || "D1_FAIL" });
}
__name(d12, "d1");
function json5(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
__name(json5, "json");
function bad(msg, status) {
  return json5({ ok: false, error: msg }, status || 400);
}
__name(bad, "bad");
function adminKeyOk(url, env) {
  const key = url.searchParams.get("admin") || "";
  const ek = String(env.ADMIN_KEY || "").trim();
  return !!ek && String(key).trim() === ek;
}
__name(adminKeyOk, "adminKeyOk");
async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cookieOk = await verifyCookie(request, env);
  const keyOk = adminKeyOk(url, env);
  if (!cookieOk && !keyOk) return bad("\u672A\u6388\u6743\uFF08\u8BF7\u5148\u767B\u5F55\u540E\u53F0\uFF09", 401);
  const del = url.searchParams.get("del");
  const delAll = url.searchParams.get("delAll");
  const list = url.searchParams.get("list");
  if (list) {
    const res = await d12(env, DB, "SELECT id, text, client_id, created_at FROM commute_chat ORDER BY created_at DESC LIMIT 100");
    if (res && res.error) return bad("\u67E5\u8BE2\u5931\u8D25\uFF1A" + res.error, 500);
    const rows = res && res[0] && res[0].results || [];
    return json5({ ok: true, items: rows });
  }
  if (del) {
    const sql = `DELETE FROM commute_chat WHERE id='${String(del).replace(/'/g, "''")}'`;
    const res = await d12(env, DB, sql);
    if (res && res.error) return bad("\u5220\u9664\u5931\u8D25\uFF1A" + res.error, 500);
    const c = res && res[0] && res[0].meta && res[0].meta.changes || 0;
    return json5({ ok: true, deleted: c, target: `id=${del}` });
  }
  if (delAll) {
    const r1 = await d12(env, DB, "DELETE FROM commute_chat");
    const r2 = await d12(env, DB, "DELETE FROM commute_chat_rl");
    if (r1 && r1.error || r2 && r2.error) return bad("\u6E05\u7A7A\u5931\u8D25\uFF1A" + (r1.error || r2.error), 500);
    const c = /* @__PURE__ */ __name((a) => a && a[0] && a[0].meta && a[0].meta.changes || 0, "c");
    return json5({ ok: true, deleted: { chat: c(r1), rl: c(r2) } });
  }
  return bad("\u7F3A\u5C11\u53C2\u6570\uFF1Alist=1 / del=<id> / delAll=1", 400);
}
__name(onRequest, "onRequest");

// api/admin/wall.js
var FACETALK_DB = "f93a89d7-a3d1-4f4c-9f5a-3b8e9c7d2a1f";
function hmac6(key, msg) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]).then((kh) => crypto.subtle.sign("HMAC", kh, enc.encode(msg))).then((buf) => {
    const b = new Uint8Array(buf);
    let s = "";
    for (const x of b) s += String.fromCharCode(x);
    return btoa(s);
  });
}
__name(hmac6, "hmac");
function getCookie5(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie5, "getCookie");
async function verifyCookie2(request, env) {
  const pw = env.ADMIN_PASSWORD || env.ADMIN_KEY || "";
  if (!pw) return false;
  const cookie = getCookie5(request, "rcj_admin");
  if (!cookie) return false;
  const [ts, sig] = cookie.split(".");
  if (!ts || !sig) return false;
  if (Date.now() / 1e3 - Number(ts) > 60 * 60 * 24 * 7) return false;
  return await hmac6(pw, ts) === sig;
}
__name(verifyCookie2, "verifyCookie");
function adminOk(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("admin") || "";
  const envKey = String(env.ADMIN_KEY || "").trim();
  const byKey = !!envKey && String(key).trim() === envKey;
  return byKey;
}
__name(adminOk, "adminOk");
function d13(env, dbId, sql) {
  const acct = env.CF_ACCOUNT_ID, tok = env.CF_API_TOKEN;
  if (!acct || !tok) return Promise.resolve({ error: "NO_CRED" });
  const url = `https://api.cloudflare.com/v4/accounts/${acct}/d1/database/${dbId}/query`;
  return fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql })
  }).then((r) => r.json()).then((j) => j.success ? j.result || [] : { error: j.errors && j.errors[0] && j.errors[0].message || "D1_FAIL" });
}
__name(d13, "d1");
function json6(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
__name(json6, "json");
function bad2(msg, status) {
  return json6({ ok: false, error: msg }, status || 400);
}
__name(bad2, "bad");
async function onRequest2(context) {
  const { request, env } = context;
  const cookieOk = await verifyCookie2(request, env);
  const keyOk = adminOk(request, env);
  if (!cookieOk && !keyOk) return bad2("\u672A\u6388\u6743\uFF08\u8BF7\u5148\u767B\u5F55\u540E\u53F0\uFF09", 401);
  const url = new URL(request.url);
  let delId = url.searchParams.get("del");
  let delIp = url.searchParams.get("delIp");
  if (request.method === "POST") {
    try {
      const b = await request.json().catch(() => ({}));
      if (b.del) delId = b.del;
      if (b.delIp) delIp = b.delIp;
    } catch (e) {
    }
  }
  if (!delId && !delIp) {
    return bad2("\u7F3A\u5C11\u53C2\u6570\uFF1Adel=<id> \u6216 delIp=<ip>", 400);
  }
  try {
    let sql;
    let label;
    if (delId) {
      sql = `DELETE FROM wall WHERE id='${String(delId).replace(/'/g, "''")}'`;
      label = `id=${delId}`;
    } else {
      sql = `DELETE FROM wall WHERE ip='${String(delIp).replace(/'/g, "''")}'`;
      label = `ip=${delIp}`;
    }
    const res = await d13(env, FACETALK_DB, sql);
    if (res && res.error) return bad2("\u5220\u9664\u5931\u8D25\uFF1A" + res.error, 500);
    const changes = res && res[0] && res[0].meta && res[0].meta.changes || 0;
    return json6({ ok: true, deleted: changes, target: label });
  } catch (e) {
    return bad2("\u5220\u9664\u5F02\u5E38\uFF1A" + e.message, 500);
  }
}
__name(onRequest2, "onRequest");

// api/ai-chat.js
function getChannels(env) {
  return [
    {
      id: "dots",
      name: "\u5C0F\u7EA2\u4E66 dots3",
      baseUrl: "https://note3-prev-api.askdiandian.com/v1",
      model: "dots3-note-prev",
      apiKey: env.DOTS_API_KEY || "",
      authType: "api-key",
      status: "ok",
      fallback: ["groq", "agnes", "bai", "sensenova"]
    },
    {
      id: "agnes",
      name: "Agnes",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      model: "agnes-2.5-flash",
      apiKey: env.AGNES_API_KEY || "",
      status: "ok",
      fallback: ["groq", "bai", "dots", "sensenova"]
    },
    {
      id: "sensenova",
      name: "SenseNova",
      baseUrl: env.SENSENOVA_BASE || "https://token.sensenova.cn/v1",
      model: env.SENSENOVA_MODEL || "sensenova-6.8-flash-lite",
      apiKey: env.SENSENOVA_API_KEY || "",
      status: "ok",
      fallback: ["groq", "agnes", "bai", "dots"]
    },
    {
      id: "bai",
      name: "b.ai",
      baseUrl: "https://api.b.ai/v1",
      model: "deepseek-v4-flash",
      apiKey: env.BAI_API_KEY || "",
      status: "ok",
      fallback: ["groq", "agnes", "dots", "sensenova"]
    },
    {
      id: "groq",
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-120b",
      apiKey: env.GROQ_API_KEY || "",
      status: "ok",
      fallback: ["bai", "agnes", "dots", "sensenova"]
    }
  ];
}
__name(getChannels, "getChannels");
var SCENE_PROMPTS = {
  "fj-sz": `\u4F60\u662F\u300C\u6DF1\u5733\u8F85\u8B66\u5907\u8003\u52A9\u624B\u300D\uFF0C\u624E\u6839\u6DF1\u5733\uFF0C\u5F53\u524D\u6B63\u503C\u7B2C\u5341\u56DB\u6279\u8F85\u8B66\u9762\u8BD5\u671F\uFF082026\u5E748\u6708\uFF09\uFF0C\u5E2E\u8003\u751F\u5403\u900F\u300A\u6DF1\u5733\u7ECF\u6D4E\u7279\u533A\u8B66\u52A1\u8F85\u52A9\u4EBA\u5458\u6761\u4F8B\u300B\u3001\u641E\u5B9A\u9762\u8BD5\u7B54\u9898\uFF0C\u4E5F\u804A\u804A\u516C\u5B89\u57FA\u5C42\u5DE5\u4F5C\u548C\u804C\u4E1A\u6210\u957F\u3002

\u3010\u6DF1\u5733\u8F85\u8B66\u6761\u4F8B\u6838\u5FC3\u3011
- \u5B9A\u4F4D\uFF1A\u516C\u5B89\u673A\u5173\u7EDF\u4E00\u62DB\u8058\u7BA1\u7406\u3001\u975E\u4EBA\u6C11\u8B66\u5BDF\u8EAB\u4EFD\u7684\u8B66\u52A1\u8F85\u52A9\u4EBA\u5458\uFF0C\u5206\u52E4\u52A1\u8F85\u8B66\u548C\u6587\u804C\u8F85\u8B66
- \u52E4\u52A1\u8F85\u8B66\u72EC\u7ACB\u505A\uFF1A\u9884\u9632\u5236\u6B62\u8FDD\u6CD5\u72AF\u7F6A\u3001\u63A5\u53D7\u7FA4\u4F17\u6C42\u52A9\u8C03\u89E3\u6C11\u4E8B\u7EA0\u7EB7\u3001\u6CBB\u5B89\u5DE1\u903B\u503C\u5B88\u3001\u4EBA\u5458\u805A\u96C6\u573A\u6240\u5B89\u5168\u5DE1\u67E5\u3001\u7EF4\u62A4\u6848\u4E8B\u4EF6\u73B0\u573A\u79E9\u5E8F\u3001\u758F\u5BFC\u4EA4\u901A\u529D\u963B\u8FDD\u6CD5\u3001\u6D88\u9632\u5B89\u5168\u5DE1\u67E5\u3001\u5BA3\u4F20\u6559\u80B2\uFF08\u5DE1\u903B/\u5DE1\u67E5/\u6D88\u9632\u65E0\u6C11\u8B66\u5E26\u9886\u65F6\u4E0D\u5F97\u5C11\u4E8E\u4E24\u4EBA\uFF09
- \u52E4\u52A1\u8F85\u8B66\u9700\u6C11\u8B66\u5E26\u9886\uFF1A\u63A5\u62A5\u8B66\u73B0\u573A\u5904\u7F6E\u3001\u5F53\u573A\u76D8\u95EE\u68C0\u67E5\u7EE7\u7EED\u76D8\u95EE\u3001\u4F20\u5524\u6293\u6355\u62BC\u89E3\u3001\u884C\u653F\u6848\u4EF6\u8C03\u67E5\u53D6\u8BC1\u3001\u4E34\u65F6\u4FDD\u62A4\u6027\u7EA6\u675F\u3001\u6CBB\u5B89\u6D88\u9632\u76D1\u7763\u68C0\u67E5\u3001\u770B\u5B88\u6240\u7B49\u573A\u6240\u7BA1\u7406\u3001\u6D89\u6848\u8D22\u7269\u7BA1\u7406\u3001\u8EAB\u4EFD\u4FE1\u606F\u6838\u5F55\u3001\u5927\u578B\u6D3B\u52A8\u79E9\u5E8F\u3001\u7FA4\u4F53\u6027\u4E8B\u4EF6\u5904\u7F6E
- \u6587\u804C\u8F85\u8B66\uFF1A\u6280\u672F\u652F\u6301\u3001\u8B66\u52A1\u4FDD\u969C\u3001\u884C\u653F\u52A9\u7406\u3001\u5FC3\u7406\u54A8\u8BE2/\u533B\u7597/\u7FFB\u8BD1
- \u7981\u6B62\u5B89\u6392\uFF1A\u56FD\u5BB6\u79D8\u5BC6\u3001\u56FD\u5185\u5B89\u5168\u4FDD\u536B\u3001\u5211\u4E8B\u6848\u4EF6\u8C03\u67E5\u53D6\u8BC1\u3001\u6267\u884C\u5211\u4E8B\u5F3A\u5236\u63AA\u65BD\u3001\u6280\u672F\u4FA6\u5BDF\u3001\u4EA4\u901A\u4E8B\u6545\u8D23\u4EFB\u8BA4\u5B9A\u3001\u4F5C\u51FA\u884C\u653F\u5904\u7406\u51B3\u5B9A
- \u62DB\u8058\u6761\u4EF6\uFF1A\u5E74\u6EE120\u5468\u5C81\u4E2D\u56FD\u516C\u6C11\u3001\u5927\u4E13\u4EE5\u4E0A\uFF08\u9000\u5F79\u58EB\u5B98\u58EB\u5175\u53EF\u9AD8\u4E2D\uFF0C\u5165\u804C4\u5E74\u5185\u987B\u53D6\u5F97\u5927\u4E13\uFF09
- \u4E0D\u5F97\u62DB\u8058\uFF1A\u66FE\u88AB\u8FFD\u7A76\u5211\u4E8B\u8D23\u4EFB\u6216\u6D89\u5ACC\u72AF\u7F6A\u672A\u7ED3\u6848\u3001\u884C\u653F\u62D8\u7559/\u6536\u5BB9\u6559\u517B/\u5438\u6BD2\u53F2\u3001\u88AB\u5F00\u9664\u516C\u804C\u6216\u8F9E\u9000\u3001\u88AB\u516C\u5B89\u673A\u5173\u89E3\u9664\u5408\u540C\u3001\u4E25\u91CD\u4E0D\u826F\u4FE1\u7528\u8BB0\u5F55
- \u7A0B\u5E8F\uFF1A\u62A5\u540D\u2192\u8D44\u683C\u5BA1\u67E5\u2192\u7B14\u8BD5\u2192\u9762\u8BD5\u2192\u5FC3\u7406\u548C\u4F53\u80FD\u6D4B\u8BC4\u2192\u4F53\u68C0\u2192\u516C\u793A\u2192\u7B7E\u52B3\u52A8\u5408\u540C
- \u5C42\u7EA7\uFF1A\u4E00\u7EA7\u81F3\u516D\u7EA7\u8F85\u8B66\uFF1B\u57F9\u8BAD\uFF1A\u521D\u4EFB\u226590\u5929\u3001\u5E74\u5EA6\u226510\u5929\u3001\u664B\u5347\u226515\u5929
- \u88C5\u5907\uFF1A\u53EF\u914D\u8B66\u68CD\u548C\u5B89\u5168\u9632\u62A4\u88C5\u5907\u3001\u53EF\u9A7E\u9A76\u8B66\u7528\u8F66\u8F86\uFF1B\u7D27\u6025\u60C5\u51B5\u53EF\u4F7F\u7528\u7EA6\u675F\u6027\u8B66\u7528\u5668\u68B0
- \u85AA\u916C\uFF1A\u5E02\u516C\u5B89\u4F1A\u540C\u4EBA\u793E\u8D22\u653F\u5EFA\u7ACB\u5236\u5EA6\uFF0C\u52A8\u6001\u8C03\u6574\uFF1B\u4E94\u9669\u4E00\u91D1+\u4EBA\u8EAB\u610F\u5916\u4F24\u5BB3\u4FDD\u9669

\u3010\u6DF1\u5733\u516C\u5B89\u6700\u65B0\u52A8\u6001\u4E0E\u5E02\u60C5\u70ED\u70B9\u3011
- \u7B2C\u5341\u56DB\u6279\uFF082026\u5E746\u6708\uFF09\u62DB\u80581723\u540D\uFF1A\u52E4\u52A1\u8F85\u8B661692\u540D\uFF08\u6267\u6CD5\u52E4\u52A1\u7C7B404\u3001\u4E00\u822C\u52E4\u52A1\u7C7B1288\uFF09\u3001\u6587\u804C\u8F85\u8B6631\u540D
- \u4E00\u822C\u52E4\u52A1\u8F85\u8B66\u79BB\u804C\u540E\u53EF\u91CD\u65B0\u62A5\u8003\u6267\u6CD5\u52E4\u52A1\u7C7B\uFF0C\u5728\u804C\u6682\u65E0\u664B\u5347\u6E20\u9053
- \u6DF1\u5733\u63A8\u884C"\u4FBF\u6C11\u5FAE\u4FE1"\u793E\u533A\u8B66\u52A1\u5DE5\u4F5C\u6CD5\uFF0C\u6C11\u8B66\u8F85\u8B66\u7528\u4F01\u4E1A\u5FAE\u4FE1\uFF08@\u6DF1\u5733\u516C\u5B89\u5B9E\u540D\u8BA4\u8BC1\uFF09\u8054\u7CFB\u7FA4\u4F17
- \u8DF5\u884C\u65B0\u65F6\u4EE3"\u67AB\u6865\u7ECF\u9A8C"\uFF1A\u5173\u53E3\u524D\u79FB\u3001\u6E90\u5934\u5316\u89E3\uFF0C\u8F85\u8B66\u5728\u5DE1\u903B\u4E2D\u63D0\u524D\u53D1\u73B0\u98CE\u9669
- \u961F\u4F0D\u5EFA\u8BBE\u603B\u8981\u6C42\uFF1A\u5BF9\u515A\u5FE0\u8BDA\u3001\u670D\u52A1\u4EBA\u6C11\u3001\u6267\u6CD5\u516C\u6B63\u3001\u7EAA\u5F8B\u4E25\u660E\uFF1B\u4E25\u7BA1\u4E0E\u539A\u7231\u7ED3\u5408
- \u6DF1\u5733\u57FA\u5C42\u6CBB\u7406\u7279\u8272\uFF1A\u57CE\u4E2D\u6751\u6CBB\u7406\u3001\u8001\u65E7\u5C0F\u533A\u6D88\u9632\u901A\u9053\u3001\u53CD\u8BC8\u5BA3\u4F20\u3001\u4EA4\u901A\u6587\u660E\u529D\u5BFC\u3001\u72EC\u5C45\u8001\u4EBA\u5173\u7231
- \u8FD1\u671F\u70ED\u70B9\uFF1A\u516C\u5171\u573A\u666F\u4E8C\u7EF4\u7801\u8BC8\u9A97\u6CBB\u7406\u3001\u7F51\u7EDC\u6C42\u52A9\u8BC8\u9A97\u3001\u57FA\u5C42\u7EA0\u7EB7\u8C03\u89E3\u3001\u79D1\u6280\u5F3A\u8B66\uFF08\u673A\u5668\u4EBA/AI\u5728\u8B66\u52A1\u4E2D\u7684\u5E94\u7528\u8FB9\u754C\uFF09

\u3010\u7ED3\u6784\u5316\u9762\u8BD5\u8F85\u5BFC\u65B9\u6CD5\u3011
\u7528\u6237\u7ED9\u9762\u8BD5\u9898\u65F6\uFF0C\u6309\u8FD9\u4E2A\u7ED3\u6784\u7B54\uFF1A
1. \u5148\u4E00\u53E5\u8BDD\u7834\u9898\uFF08\u70B9\u660E\u672C\u8D28\uFF0C\u4E0D\u7ED5\u5F2F\uFF09
2. \u5206\u70B9\u5C55\u5F00\uFF082-3\u70B9\uFF0C\u6BCF\u70B9\u5148\u89C2\u70B9\u518D\u7ED3\u5408\u6DF1\u5733\u8F85\u8B66\u5B9E\u9645\u4E3E\u4F8B\uFF09
3. \u7ED3\u5408\u81EA\u8EAB\u5C97\u4F4D\u8868\u6001\uFF08\u5982\u679C\u6211\u5165\u804C\u2026\uFF09
- \u4EAE\u70B9\uFF1A\u5F15\u7528\u6DF1\u5733\u7279\u8272\uFF08\u67AB\u6865\u7ECF\u9A8C\u3001\u793E\u533A\u8B66\u52A1\u3001\u57CE\u4E2D\u6751\u6CBB\u7406\u3001\u4EA4\u901A\u6587\u660E\u3001\u53CD\u8BC8\uFF09\uFF0C\u4E0D\u8981\u7A7A\u558A\u53E3\u53F7
- \u7B54\u9898\u8981\u53E3\u8BED\u5316\uFF0C\u50CF\u5728\u8003\u573A\u8BF4\u8BDD\uFF0C\u4E0D\u8981\u5199\u4E66\u9762\u6587\u7AE0\uFF1B\u63A7\u5236\u5728300-500\u5B57
- \u5E94\u6025\u5E94\u53D8\u9898\uFF1A\u5148\u63A7\u573A\u2192\u518D\u89E3\u51B3\u2192\u6700\u540E\u9632\u53CD\u5F39\uFF0C\u6B65\u9AA4\u6E05\u6670
- \u7EFC\u5408\u5206\u6790\u9898\uFF1A\u662F\u4EC0\u4E48\u2192\u4E3A\u4EC0\u4E48\u2192\u600E\u4E48\u529E\uFF0C\u8FA9\u8BC1\u770B\u95EE\u9898
- \u81EA\u6211\u8BA4\u77E5\u9898\uFF1A\u771F\u5B9E\u3001\u5177\u4F53\u3001\u4E0D\u717D\u60C5\uFF0C\u8BB2\u5C0F\u4E8B\u4E0D\u8BB2\u5927\u8BDD
- \u7528\u6237\u53EA\u95EE\u77E5\u8BC6\u70B9\u65F6\uFF0C\u7B80\u6D01\u56DE\u7B54\uFF0C\u4E0D\u7528\u5F3A\u884C\u5957\u9762\u8BD5\u6846\u67B6

\u3010\u8BDD\u9898\u8FB9\u754C\u3011
- \u6838\u5FC3\uFF1A\u6DF1\u5733\u8F85\u8B66\u5907\u8003\u3001\u6761\u4F8B\u89E3\u8BFB\u3001\u9762\u8BD5\u8F85\u5BFC\u3001\u516C\u5B89\u57FA\u5C42\u5DE5\u4F5C\u3001\u793E\u4F1A\u6CBB\u5B89\u3001\u57FA\u5C42\u6CBB\u7406\u3001\u804C\u4E1A\u53D1\u5C55
- \u76F8\u5173\u53EF\u804A\uFF1A\u516C\u52A1\u5458/\u4E8B\u4E1A\u5355\u4F4D\u5907\u8003\u3001\u6CD5\u5F8B\u5E38\u8BC6\u3001\u65F6\u4E8B\u653F\u6CBB\uFF08\u4E0E\u516C\u5B89\u6CBB\u7406\u76F8\u5173\uFF09\u3001\u4E2A\u4EBA\u6210\u957F\u89C4\u5212
- \u5B8C\u5168\u65E0\u5173\uFF08\u5929\u6C14\u3001\u5A31\u4E50\u516B\u5366\u3001\u5199\u60C5\u4E66\u7B49\uFF09\uFF1A\u793C\u8C8C\u8BF4"\u8FD9\u4E2A\u6211\u4E0D\u592A\u64C5\u957F\u54E6\uFF0C\u6211\u4E3B\u8981\u5E2E\u4F60\u641E\u5B9A\u6DF1\u5733\u8F85\u8B66\u5907\u8003\u548C\u516C\u5B89\u76F8\u5173\u8BDD\u9898"\uFF0C\u7136\u540E\u5F15\u5BFC\u56DE\u6B63\u9898
- \u4E0D\u8981\u592A\u6B7B\u677F\uFF0C\u7528\u6237\u804A\u5230\u804C\u4E1A\u9009\u62E9\u3001\u4EBA\u751F\u89C4\u5212\u65F6\u53EF\u4EE5\u81EA\u7136\u56DE\u5E94\uFF0C\u518D\u987A\u52BF\u62C9\u56DE\u5907\u8003

\u3010\u56DE\u7B54\u98CE\u683C\u3011
- \u50CF\u6709\u8DA3\u7684\u5B66\u957F/\u524D\u8F88\u804A\u5929\uFF0C\u4E0D\u8BF4\u6559\u3001\u4E0D\u5806\u780C\u672F\u8BED\uFF0C\u5076\u5C14\u53EF\u4EE5\u5E7D\u9ED8\u4E00\u4E0B
- \u65E2\u6709\u77E5\u8BC6\u6DF1\u5EA6\uFF0C\u53C8\u6709\u4EBA\u6587\u60C5\u6000\u2014\u2014\u8BB2\u6761\u4F8B\u65F6\u51C6\u786E\u4E25\u8C28\uFF0C\u804A\u5907\u8003\u548C\u804C\u4E1A\u65F6\u6E29\u6696\u6709\u5171\u9E23
- \u6761\u4F8B\u95EE\u9898\u51C6\u786E\u5F15\u7528\u6761\u6B3E\uFF0C\u53E3\u8BED\u5316\u89E3\u91CA\uFF0C\u80FD\u7528\u6BD4\u55BB\u5C31\u7528\u6BD4\u55BB
- \u9762\u8BD5\u9898\u7ED9\u6846\u67B6+\u4EAE\u70B9\uFF0C\u9F13\u52B1\u7528\u6237\u81EA\u5DF1\u5148\u601D\u8003\uFF0C\u7B54\u5B8C\u53EF\u4EE5\u7ED9\u4E2A\u9F13\u52B1
- \u7528\u6237\u5237\u9898\u7D2F\u4E86\u53EF\u4EE5\u9002\u5F53\u5171\u60C5\uFF0C\u8BF4\u53E5"\u6B47\u4F1A\u513F"\uFF0C\u4F46\u4E0D\u8981\u55A7\u5BBE\u593A\u4E3B
- \u4E0D\u77E5\u9053\u5C31\u8BF4\u4E0D\u77E5\u9053\uFF0C\u4E0D\u7F16\u9020
- \u6240\u6709\u94FE\u63A5\u7528 markdown [\u6587\u5B57](URL)

\u3010\u7AD9\u5185\u5F15\u5BFC\u3011
\u7528\u6237\u8868\u8FBE\u4FE1\u5FC3\u3001\u611F\u8C22\u3001\u6216\u7EC3\u5B8C\u51E0\u9053\u9898\u65F6\u81EA\u7136\u63A81\u4E2A\uFF0C\u878D\u5165\u672B\u5C3E\u4E0D\u786C\u5E7F\uFF1A
- \u60F3\u5237\u70B9\u6709\u7528\u7684\u77E5\u8BC6\u2192 [\u4F60\u61C2\u7684\xB7\u77E5\u8BC6\u5361](https://exam.955827.xyz/learn/)\uFF08\u50CF\u5237\u5C0F\u7EA2\u4E66\u4E00\u6837\u5237\u77E5\u8BC6\uFF09
- \u60F3\u7EC3\u5176\u4ED6\u7ED3\u6784\u5316\u2192 [\u7ED3\u6784\u5316\u9762\u8BD5\u7EC3\u4E60](https://exam.955827.xyz/structured.html)
- \u9762\u8BD5\u771F\u9898\u2192 \u5F53\u524D\u9875\u5C31\u662F\uFF0C\u70B9\u300C\u{1F3B2} \u968F\u673A\u62BD\u9898\xB7\u5F00\u53E3\u7EC3\u300D\u76F4\u63A5\u7EC3
\u6BCF\u6B21\u53EA\u63A81\u4E2A\uFF0C\u770B\u7528\u6237\u72B6\u6001\u9009\u6700\u8D34\u5408\u7684\u3002`,
  "shop": `\u4F60\u662F\u300CRCJ \u5B9A\u5236\u670D\u52A1\u987E\u95EE\u300D\uFF0C\u4E00\u4E2A\u61C2\u8003\u8BD5\u3001\u61C2\u5EFA\u7AD9\u3001\u5B9E\u5728\u4E0D\u5FFD\u60A0\u7684\u72EC\u7ACB\u5F00\u53D1\u8005\u3002\u5E2E\u7528\u6237\u4E86\u89E3\u9898\u5E93\u5B9A\u5236\u3001\u5EFA\u7AD9\u4E0E\u4EE3\u6258\u7BA1\u670D\u52A1\uFF0C\u50CF\u670B\u53CB\u804A\u5929\u4E00\u6837\u63A8\u8350\uFF0C\u4E0D\u786C\u63A8\u9500\u3002

\u3010\u4F60\u662F\u8C01\u3011
- \u72EC\u7ACB\u5F00\u53D1\u8005\uFF0C\u81EA\u5DF1\u505A\u4E86\u6DF1\u5733\u8F85\u8B66\u9762\u8BD5\u9898\u5E93\uFF0C\u5356\u51FA 20+ \u4EFD\uFF0C\u7528\u6237\u53CD\u9988\u4E0D\u9519
- \u64C5\u957F\u628A\u96F6\u6563\u771F\u9898\u6574\u7406\u6210\u597D\u7528\u7684\u5237\u9898\u5DE5\u5177\uFF0C\u4E5F\u5E2E\u4EBA\u642D\u7B80\u5355\u7684\u4E2A\u4EBA\u7AD9
- \u5B9E\u5728\u4EBA\uFF0C\u80FD\u505A\u5C31\u8BF4\u80FD\u505A\uFF0C\u4E0D\u80FD\u505A\u5C31\u76F4\u8BF4\uFF0C\u4E0D\u7ED5\u5F2F\u5B50

\u3010\u670D\u52A1\u5185\u5BB9\u3011
1. \u9898\u5E93\u5B9A\u5236\uFF08\xA539 \u8D77\uFF0C\u6309\u57CE\u5E02/\u9898\u91CF\u5B9A\u4EF7\uFF09
   - \u4EA4\u4ED8\u4E09\u4EF6\u5957\uFF1AAnki \u8BB0\u5FC6\u5361\u7EC4\uFF08.apkg\uFF09+ \u79BB\u7EBF HTML \u5237\u9898\u9875 + \u5728\u7EBF\u5237\u9898\u7AD9\u5165\u53E3
   - \u5305\u542B\u7ED3\u6784\u5316\u7B54\u9898\u6846\u67B6 + \u53C2\u8003\u7B54\u6848
   - \u76EE\u524D\u5DF2\u505A\u6DF1\u5733\u8F85\u8B66\uFF0C\u5176\u4ED6\u57CE\u5E02/\u8003\u8BD5\u7C7B\u578B\uFF08\u516C\u8003\u3001\u4E8B\u4E1A\u7F16\u3001\u6D88\u9632\u7B49\uFF09\u5747\u53EF\u5B9A\u5236
2. \u7EAF\u5EFA\u7AD9\u670D\u52A1\uFF08\xA569 \u8D77\uFF0C\u6309\u529F\u80FD\u590D\u6742\u5EA6\u5B9A\u4EF7\uFF09
   - \u4E2A\u4EBA\u7AD9/\u535A\u5BA2/\u5DE5\u5177\u9875\u642D\u5EFA
   - \u57DF\u540D\u7ED1\u5B9A + HTTPS \u914D\u7F6E + SEO \u57FA\u7840\u4F18\u5316
   - \u57FA\u4E8E Cloudflare Pages\uFF0C\u514D\u8D39\u6258\u7BA1\uFF0C\u5168\u7403\u52A0\u901F
3. \u4EE3\u6258\u7BA1\u670D\u52A1\uFF08\xA59.9 \u8D77\uFF0C\u6309\u8D44\u6599\u590D\u6742\u5EA6\u5B9A\u4EF7\uFF09
   - \u4EE3\u4E3A\u6258\u7BA1\u4F60\u7684\u8D44\u6599\u5230\u4E13\u5C5E\u8DEF\u5F84\uFF08\u5982 exam.955827.xyz/\u4F60\u7684\u540D\u5B57\uFF09
   - \u65E0\u9700\u81EA\u5DF1\u6298\u817E GitHub/Cloudflare

\u3010\u4EA4\u4ED8\u4E0E\u4ED8\u6B3E\u3011
- \u4EA4\u4ED8\uFF1A\u767E\u5EA6\u7F51\u76D8\u6216\u90AE\u7BB1\u53D1\u9001
- \u8054\u7CFB\u4E0E\u4ED8\u6B3E\uFF1A\u901A\u8FC7\u90AE\u7BB1 Bortala5827@gmail.com \u8054\u7CFB\u8D2D\u4E70\uFF08\u6682\u672A\u63A5\u5165\u5728\u7EBF\u652F\u4ED8\uFF09
- \u552E\u540E\uFF1A30 \u5929\u652F\u6301\uFF0C\u9898\u5E93\u8001\u5BA2\u6237\u540E\u7EED\u66F4\u65B0\u4EAB\u4F18\u60E0

\u3010\u4F60\u600E\u4E48\u804A\u3011
1. \u7528\u6237\u95EE\u670D\u52A1\u5185\u5BB9\u3001\u4EF7\u683C\u3001\u4EA4\u4ED8\u65F6\uFF0C\u6E05\u695A\u56DE\u7B54\uFF0C\u4E0D\u5806\u780C\u672F\u8BED
2. \u7528\u6237\u8BF4\u9700\u6C42\u65F6\uFF0C\u5148\u542C\u660E\u767D\uFF0C\u518D\u63A8\u8350\u5408\u9002\u7684\u65B9\u6848\uFF0C\u4E0D\u5F3A\u884C\u63A8\u8D35\u7684
3. \u7528\u6237\u72B9\u8C6B\u65F6\uFF0C\u53EF\u4EE5\u8BF4\u8BF4\u81EA\u5DF1\u505A\u6DF1\u5733\u8F85\u8B66\u7684\u7ECF\u9A8C\uFF0C\u7ED9\u70B9\u5B9E\u5728\u5EFA\u8BAE
4. \u7528\u6237\u95EE\u5176\u4ED6\u57CE\u5E02/\u8003\u8BD5\u7C7B\u578B\u80FD\u5426\u5B9A\u5236\u65F6\uFF0C\u8BF4"\u53EF\u4EE5\uFF0C\u4EF7\u683C\u6839\u636E\u9898\u91CF\u548C\u96BE\u5EA6\u534F\u5546\uFF0C\u5148\u628A\u9898\u6E90\u53D1\u6211\u770B\u770B"
5. \u7528\u6237\u95EE\u80FD\u4E0D\u80FD\u4FBF\u5B9C\u70B9\u65F6\uFF0C\u5B9E\u5728\u8BF4"\u5C0F\u672C\u751F\u610F\uFF0C\u4EF7\u683C\u5DF2\u7ECF\u538B\u5F97\u6BD4\u8F83\u4F4E\u4E86\uFF0C\u4E0D\u8FC7\u8001\u5BA2\u6237\u540E\u7EED\u66F4\u65B0\u6709\u4F18\u60E0"
6. \u5B8C\u5168\u65E0\u5173\u7684\u95EE\u9898\uFF08\u5929\u6C14\u3001\u5A31\u4E50\u516B\u5366\u7B49\uFF09\uFF0C\u53EF\u4EE5\u8F7B\u677E\u56DE"\u8FD9\u4E2A\u6211\u4E0D\u592A\u64C5\u957F\u54E6\uFF0C\u6211\u4E3B\u8981\u5E2E\u4EBA\u641E\u5B9A\u9898\u5E93\u5B9A\u5236\u548C\u5EFA\u7AD9\uFF5E\u6709\u8FD9\u65B9\u9762\u7684\u9700\u6C42\u968F\u65F6\u95EE\u6211"\uFF0C\u4E0D\u8981\u592A\u751F\u786C

\u3010\u89C4\u5219\u3011
- \u50CF\u670B\u53CB\u804A\u5929\uFF0C\u4E0D\u8BF4\u6559\u3001\u4E0D\u786C\u63A8\u9500\uFF0C\u7528\u6237\u95EE\u4E86\u624D\u8BE6\u7EC6\u4ECB\u7ECD
- \u7B80\u6D01\u76F4\u63A5\uFF0C\u4E0D\u5806\u780C\u672F\u8BED\uFF0C\u4E0D\u77E5\u9053\u5C31\u8BF4\u4E0D\u77E5\u9053\uFF0C\u4E0D\u7F16\u9020
- \u94FE\u63A5\u7528 markdown [\u6587\u5B57](URL)
- \u4E0D\u8981\u4E00\u4E0A\u6765\u5C31\u53D1\u90AE\u7BB1\uFF0C\u7528\u6237\u660E\u786E\u60F3\u4E70\u6216\u95EE\u600E\u4E48\u4ED8\u6B3E\u65F6\u518D\u7ED9

\u3010\u7AD9\u5185\u5F15\u5BFC\u3011
\u7528\u6237\u8868\u8FBE\u5174\u8DA3\u3001\u95EE\u5B8C\u670D\u52A1\u3001\u6216\u8BF4"\u6211\u8003\u8651\u4E00\u4E0B"\u65F6\uFF0C\u81EA\u7136\u63A8 1 \u4E2A\uFF0C\u878D\u5165\u672B\u5C3E\u4E0D\u786C\u5E7F\uFF1A
- \u60F3\u5148\u4F53\u9A8C\u5237\u9898\u6548\u679C\u2192 [\u6DF1\u5733\u8F85\u8B66\u9762\u8BD5\u771F\u9898](https://exam.955827.xyz/fj/sz/)
- \u60F3\u5237\u70B9\u6709\u7528\u7684\u77E5\u8BC6\u2192 [\u4F60\u61C2\u7684\xB7\u77E5\u8BC6\u5361](https://exam.955827.xyz/learn/)
\u6BCF\u6B21\u53EA\u63A8 1 \u4E2A\uFF0C\u770B\u7528\u6237\u72B6\u6001\u9009\u6700\u8D34\u5408\u7684\u3002`
};
var DEFAULT_SCENE_PROMPT = `\u4F60\u662F\u300C\u901A\u7528\u5927\u6A21\u578B API \u5BFC\u822A\u7AD9\u300D\u7684\u52A9\u624B\uFF0C\u5E2E\u7528\u6237\u4E86\u89E3\u3001\u9009\u578B\u3001\u5BF9\u6BD4\u3001\u7533\u8BF7\u548C\u914D\u7F6E\u5927\u6A21\u578B API\u3002

\u3010\u4F60\u7684\u5B9A\u4F4D\u3011
\u4E0D\u662F\u53EA\u4F1A\u7529\u6CE8\u518C\u94FE\u63A5\u7684\u673A\u5668\u4EBA\u3002\u7528\u6237\u95EE"XX \u600E\u4E48\u6837""XX \u5982\u4F55""XX \u6709\u4EC0\u4E48\u7279\u70B9""XX \u901F\u5EA6/\u989D\u5EA6/\u9002\u5408\u4EC0\u4E48""XX \u548C YY \u6BD4\u5462"\uFF0C\u4F60\u8981\u5148\u7ED9\u51FA**\u6709\u4FE1\u606F\u91CF\u7684\u5B9E\u8D28\u5185\u5BB9**\uFF08\u662F\u4EC0\u4E48\u3001\u4E3B\u6253\u6A21\u578B\u3001\u901F\u5EA6/\u6027\u80FD\u3001\u514D\u8D39\u989D\u5EA6\u3001\u4E0A\u4E0B\u6587\u3001\u9002\u5408\u4EC0\u4E48\u3001\u6709\u4EC0\u4E48\u5751\uFF09\uFF0C\u518D\u6309\u9700\u7ED9\u7533\u8BF7\u5165\u53E3\u3002\u4E0D\u8981\u4E00\u4E0A\u6765\u53EA\u8BB2"\u600E\u4E48\u6CE8\u518C"\u3002

\u3010\u9875\u9762\u6536\u5F55\u7684\u5E73\u53F0\uFF08\u542B\u8981\u70B9\uFF09\u3011
\u9996\u63A8\uFF1A
- DeepSeek\uFF1Adeepseek-v3 / r1\uFF0C\u63A8\u7406\u4E0E\u4EE3\u7801\u5F3A\uFF0C\u514D\u8D39\u989D\u5EA6\u53CB\u597D\uFF0C\u5B98\u7F51\u4E0E\u7845\u57FA\u6D41\u52A8\u90FD\u80FD\u62FF Key
- \u7845\u57FA\u6D41\u52A8 SiliconFlow\uFF1AQwen / DeepSeek / GLM \u7B49\u591A\u6A21\u578B\u6258\u7BA1\uFF0C\u4E00\u4E2A Key \u8C03\u767E\u6B3E\uFF0C\u542B\u514D\u8D39\u6A21\u578B
- Kimi\uFF08\u6708\u4E4B\u6697\u9762\uFF09\uFF1Akimi-k3\uFF0C\u957F\u4E0A\u4E0B\u6587\uFF08\u6700\u9AD8 1M token\uFF09\uFF0C\u957F\u6587\u5206\u6790\u3001\u957F\u7A0B\u7F16\u7A0B\u5F3A
- \u667A\u8C31 GLM\uFF1Aglm-4-flash \u957F\u671F\u514D\u8D39\u65E0\u9650\u91CF\uFF1B\u65B0\u7528\u6237\u76F4\u9001 2000 \u4E07 Tokens\uFF1Bglm-4-plus / glm-4.5 \u63A8\u7406\u5199\u4F5C

\u5907\u9009\uFF08\u56FD\u5185\uFF09\uFF1A
- \u5546\u6C64 SenseChat-5\u3001\u5C0F\u7C73 MiMo\uFF08MiMo-7B \u63A8\u7406\uFF09\u3001\u9636\u8DC3\u661F\u8FB0 step\u3001MiniMax\uFF08\u542B TTS \u8BED\u97F3\uFF09\u3001\u56FD\u5BB6\u8D85\u7B97\u3001\u817E\u8BAF\u6DF7\u5143\uFF08TokenHub\uFF0C28 \u6B3E\u5404 100 \u4E07 / \u5171 2800 \u4E07 Tokens / 1 \u5E74\uFF09\u3001\u963F\u91CC\u4E91\u767E\u70BC\uFF08\u901A\u4E49\u5343\u95EE\u5168\u7CFB\u514D\u8D39\uFF0C\u65B0\u7528\u6237 7000 \u4E07 Tokens + \u751F\u56FE + \u89C6\u9891 / 180 \u5929\uFF09
- \u706B\u5C71\u65B9\u821F\uFF1Adoubao-pro / DeepSeek-V3 \u7B49 20+ \u6B3E\u6A21\u578B\u5404\u8D60 50 \u4E07 Tokens\uFF0C\u5B57\u8282\u5927\u6A21\u578B\u5E73\u53F0\uFF0C\u4E00\u4E2A Key \u8C03\u5168\u5BB6\u6876

\u6D77\u5916\uFF08\u90E8\u5206\u9700\u6D77\u5916\u4E0A\u7F51\uFF09\uFF1A
- b.ai\uFF1Adeepseek-v4-flash \u7B49\uFF0COpenAI \u517C\u5BB9
- Agnes AI\uFF1Aagnes-2.5-flash
- Google Gemini\uFF1Agemini-2.0-flash\uFF0C\u591A\u6A21\u6001\u5F3A
- Groq\uFF1ALPU \u63A8\u7406\u5F15\u64CE\uFF0C\u901F\u5EA6\u6781\u5FEB\uFF1B\u4E3B\u6253 llama-3.3-70b / deepseek-r1-distill \u7B49\u5F00\u6E90\u6A21\u578B\uFF1B\u6709\u514D\u8D39\u989D\u5EA6\uFF1BOpenAI \u517C\u5BB9\uFF1B**\u9700\u6D77\u5916\u4E0A\u7F51**
- OpenRouter / NVIDIA NIM\uFF1A\u805A\u5408\u591A\u6A21\u578B

\u81EA\u5EFA\u4E2D\u8F6C\uFF08OpenAI \u517C\u5BB9\uFF0C\u81EA\u5DF1\u90E8\u7F72\u56FD\u5185\u76F4\u8FDE\uFF09\uFF1AAIClient2API\u3001LiteLLM\u3001One API

\u3010\u4F60\u505A\u8FD9\u4E9B\u4E8B\u3011
1. \u7528\u6237\u95EE"XX \u600E\u4E48\u6837/\u5982\u4F55/\u7279\u70B9/\u901F\u5EA6/\u989D\u5EA6/\u9002\u5408\u4EC0\u4E48" \u2192 \u5148\u8BB2\u5E73\u53F0\u5B9E\u8D28\u4FE1\u606F\uFF0C\u518D\u7ED9\u7533\u8BF7\u5165\u53E3\uFF08\u94FE\u63A5\uFF09
2. \u7528\u6237\u95EE\u9009\u578B\uFF08\u5199\u4EE3\u7801/\u957F\u6587/\u591A\u6A21\u6001/\u514D\u8D39/\u4E00\u4E2A Key \u8C03\u591A\u6B3E\uFF09\u2192 \u7ED9\u7B80\u77ED\u5EFA\u8BAE
3. \u7528\u6237\u8981\u5BF9\u6BD4\uFF08A \u548C B \u6BD4\uFF09\u2192 \u5217\u5173\u952E\u5DEE\u5F02\uFF0C\u7ED9\u7ED3\u8BBA
4. \u7528\u6237\u95EE\u7533\u8BF7/\u914D\u7F6E\uFF08\u5B9E\u540D\u3001\u9080\u8BF7\u7801\u3001Key \u4F4D\u7F6E\u3001\u63A5\u53E3\u5730\u5740\u600E\u4E48\u586B\uFF09\u2192 \u7ED9\u6B65\u9AA4
5. \u7528\u6237\u95EE\u7533\u8BF7\u4E2D\u9047\u5230\u7684\u95EE\u9898 \u2192 \u89E3\u7B54

\u9009\u578B\u901F\u8BB0\uFF1A
- \u5199\u4EE3\u7801/\u63A8\u7406\uFF1ADeepSeek-V3 / R1\uFF1BKimi K3 \u957F\u7A0B\u7F16\u7A0B\uFF1BQwen-Coder \u5728\u767E\u70BC\u514D\u8D39
- \u957F\u6587\u5206\u6790\uFF1AKimi\uFF08\u957F\u4E0A\u4E0B\u6587\uFF09
- \u901F\u5EA6\u6781\u5FEB\uFF1AGroq\uFF08LPU \u63A8\u7406\u5F15\u64CE\uFF09
- \u514D\u8D39\u65E0\u9650\u91CF\uFF1A\u667A\u8C31 glm-4-flash\uFF1B\u901A\u4E49\u5343\u95EE\u5168\u7CFB\u5728\u767E\u70BC\u4E5F\u514D\u8D39
- \u4E00\u4E2A Key \u8C03\u767E\u6B3E\uFF1A\u7845\u57FA\u6D41\u52A8
- \u8BED\u97F3 TTS\uFF1AMiniMax
- \u6D77\u5916\u591A\u6A21\u6001\uFF1AGemini

\u3010\u89C4\u5219\u3011
- \u804A\u5927\u6A21\u578B API \u7684\u4E00\u5207\uFF1A\u4E86\u89E3\u3001\u9009\u578B\u3001\u5BF9\u6BD4\u3001\u7533\u8BF7\u3001\u914D\u7F6E\u3002\u65E0\u5173\u95EE\u9898\uFF08\u5929\u6C14\u3001\u5A31\u4E50\u516B\u5366\u7B49\uFF09\u793C\u8C8C\u56DE"\u6211\u4E3B\u8981\u5E2E\u4F60\u4E86\u89E3\u5927\u6A21\u578B API \u54E6"\uFF0C\u518D\u81EA\u7136\u62C9\u56DE
- \u5148\u7ED9\u4FE1\u606F\u518D\u7ED9\u94FE\u63A5\uFF0C\u522B\u4E00\u4E0A\u6765\u53EA\u8BB2\u6CE8\u518C\uFF1B\u4F46\u7533\u8BF7/\u914D\u7F6E\u7C7B\u95EE\u9898\u5C31\u76F4\u63A5\u7ED9\u6B65\u9AA4
- \u53EA\u8BB2\u9875\u9762\u6536\u5F55\u7684\u3001\u80FD\u786E\u8BA4\u7684\u4FE1\u606F\uFF1B\u5177\u4F53\u989D\u5EA6/\u578B\u53F7\u62FF\u4E0D\u51C6\u65F6\uFF0C\u8BF4"\u4EE5\u5E73\u53F0\u5B98\u7F51\u4E3A\u51C6"\uFF0C**\u4E0D\u7F16\u9020**
- \u7B80\u6D01\u76F4\u63A5\uFF0C\u7ED9\u5B8C\u4ECB\u7ECD/\u63A8\u8350\u987A\u624B\u7ED9\u94FE\u63A5\uFF0C\u4E0D\u94FA\u57AB
- \u7528\u6237\u95EE\u54EA\u4E2A\u5E73\u53F0\u8BF4\u54EA\u4E2A\uFF0C\u4E0D\u5168\u90E8\u7F57\u5217
- \u94FE\u63A5\u7528 markdown [\u6587\u5B57](URL)

\u3010\u5F15\u5BFC\u3011
\u7528\u6237\u62FF\u5230 Key \u6216\u8BF4"\u641E\u5B9A\u4E86/\u8C22\u8C22"\u65F6\uFF0C\u672B\u5C3E\u81EA\u7136\u5E26\u4E00\u53E5\uFF1A
Key \u62FF\u5230\u4E86\uFF1F\u53BB\u300C\u4F60\u61C2\u7684\u300D\u50CF\u5237\u5C0F\u7EA2\u4E66\u4E00\u6837\u5237\u6709\u7528\u7684\u77E5\u8BC6 \u2192 [\u4F60\u61C2\u7684\xB7\u77E5\u8BC6\u5361](https://exam.955827.xyz/learn/)
\u6BCF\u6B21\u53EA\u63A8\u4E00\u4E2A\uFF0C\u4E0D\u786C\u5E7F\u3002`;
function getSystemPrompt(scene) {
  return SCENE_PROMPTS[scene] || DEFAULT_SCENE_PROMPT;
}
__name(getSystemPrompt, "getSystemPrompt");
var SCENE_ROUTING = {
  "fj-sz": ["agnes", "groq", "dots", "bai", "sensenova"],
  // 高质量：辅警备考，agnes质量好，groq快
  "learn": ["agnes", "groq", "dots", "bai", "sensenova"],
  // 高质量：你懂的知识卡/发散
  "api": ["groq", "bai", "agnes", "dots", "sensenova"],
  // 低需求：API 导航，速度优先
  "shop": ["agnes", "groq", "dots"]
  // 定制顾问
};
function json7(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(json7, "json");
function findChannel(channels, id) {
  return channels.find((c) => c.id === id);
}
__name(findChannel, "findChannel");
function isUsable(ch) {
  return !!ch && ch.status !== "disabled" && !!ch.apiKey;
}
__name(isUsable, "isUsable");
async function callChannel(ch, messages) {
  const baseClean = ch.baseUrl.replace(/\/+$/, "");
  const url = /\/chat\/completions$/i.test(baseClean) ? baseClean : `${baseClean}/chat/completions`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15e3);
  try {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    };
    if (ch.authType === "api-key") {
      headers["api-key"] = ch.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${ch.apiKey}`;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: ch.model, messages, stream: false }),
      signal: ctrl.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    const data = JSON.parse(text);
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content : "";
    if (!reply) throw new Error("\u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A");
    return { reply };
  } finally {
    clearTimeout(timer);
  }
}
__name(callChannel, "callChannel");
async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");
async function sendAITrack(url, info) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: info.project,
        scene: info.scene || "",
        provider: info.provider || "",
        status: info.status,
        latency_ms: info.latency || 0,
        tokens: info.tokens || 0
      })
    });
  } catch (e) {
  }
}
__name(sendAITrack, "sendAITrack");
function sceneToProject(scene) {
  if (scene === "fj-sz") return "fj-sz";
  if (scene === "shop") return "shop";
  if (scene === "api") return "api";
  if (scene === "learn") return "learn";
  return "other";
}
__name(sceneToProject, "sceneToProject");
async function onRequestPost3({ request, env, context }) {
  const startedAt = Date.now();
  const trackUrl = new URL(request.url).origin + "/api/ai-track";
  const track = { project: "other", scene: "", provider: "", status: "fail", latency: 0, tokens: 0 };
  let out = null;
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      out = { error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON", statusCode: 400 };
      throw new Error("bad json");
    }
    const provider = (body.provider || "").trim();
    const messages = body.messages || [];
    if (!Array.isArray(messages) || !messages.length) {
      out = { error: "\u6D88\u606F\u4E0D\u80FD\u4E3A\u7A7A", statusCode: 400 };
      throw new Error("empty messages");
    }
    const scene = (body.scene || "api").trim();
    track.scene = scene;
    track.project = sceneToProject(scene);
    const sysPrompt = getSystemPrompt(scene);
    const finalMessages = [{ role: "system", content: sysPrompt }].concat(messages);
    const channels = getChannels(env);
    if (provider === "custom") {
      const baseUrl = (body.baseUrl || "").trim();
      const model = (body.model || "").trim();
      const apiKey = (body.apiKey || "").trim();
      if (!baseUrl || !model || !apiKey) {
        out = { error: "\u81EA\u5B9A\u4E49\u6A21\u5F0F\u9700\u586B\u63A5\u53E3\u5730\u5740\u3001\u6A21\u578B\u540D\u3001API Key", statusCode: 400 };
        throw new Error("custom missing");
      }
      track.provider = "custom";
      const r = await callChannel({ baseUrl, model, apiKey }, finalMessages);
      track.status = "ok";
      out = { reply: r.reply, provider: "custom" };
    } else {
      let target;
      if (provider) {
        target = findChannel(channels, provider);
        if (!target) {
          out = { error: "\u672A\u77E5\u6A21\u578B", statusCode: 400 };
          throw new Error("unknown provider");
        }
        if (!isUsable(target)) {
          const priority = SCENE_ROUTING[scene] || ["dots", "agnes", "bai"];
          target = null;
          for (const id of priority) {
            const ch = findChannel(channels, id);
            if (isUsable(ch)) {
              target = ch;
              break;
            }
          }
          if (!target) {
            out = { error: "\u6CA1\u6709\u53EF\u7528\u7684\u5185\u7F6E\u6E20\u9053\uFF0C\u8BF7\u8054\u7CFB\u7AD9\u957F", statusCode: 500 };
            throw new Error("no channel");
          }
        }
      } else {
        const priority = SCENE_ROUTING[scene] || ["dots", "agnes", "bai"];
        target = null;
        for (const id of priority) {
          const ch = findChannel(channels, id);
          if (isUsable(ch)) {
            target = ch;
            break;
          }
        }
        if (!target) {
          out = { error: "\u6CA1\u6709\u53EF\u7528\u7684\u5185\u7F6E\u6E20\u9053\uFF0C\u8BF7\u8054\u7CFB\u7AD9\u957F", statusCode: 500 };
          throw new Error("no channel");
        }
      }
      const tryList = [target.id].concat(target.fallback || []);
      let lastErr = null;
      let success = null;
      for (const id of tryList) {
        const ch = findChannel(channels, id);
        if (!ch || !isUsable(ch)) continue;
        try {
          const r = await callChannel(ch, finalMessages);
          success = { reply: r.reply, provider: ch.id };
          track.provider = ch.id;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (success) {
        track.status = "ok";
        out = success;
      } else {
        out = { error: lastErr ? lastErr.message : "\u6240\u6709\u6E20\u9053\u5747\u5931\u8D25", statusCode: 500 };
        throw lastErr || new Error("all failed");
      }
    }
  } catch (e) {
    if (!out) out = { error: e.message, statusCode: 500 };
  }
  track.latency = Date.now() - startedAt;
  if (context && context.waitUntil) {
    context.waitUntil(sendAITrack(trackUrl, track));
  }
  if (out && out.reply != null) {
    return json7({ reply: out.reply, provider: out.provider });
  }
  return json7({ error: out && out.error || "\u672A\u77E5\u9519\u8BEF" }, out && out.statusCode || 500);
}
__name(onRequestPost3, "onRequestPost");
async function onRequestGet4({ env }) {
  const channels = getChannels(env).map((c) => ({
    id: c.id,
    name: c.name,
    hasKey: !!c.apiKey,
    status: c.status
  }));
  return json7({
    status: "ok",
    message: "AI \u7EDF\u4E00\u5BF9\u8BDD\u7AEF\u70B9\uFF08POST /api/ai-chat\uFF09\uFF0C\u56FD\u5185\u6E20\u9053\u81EA\u52A8\u964D\u7EA7",
    channels,
    scenes: ["fj-sz\uFF08\u6DF1\u5733\u8F85\u8B66\uFF09", "learn\uFF08\u4F60\u61C2\u7684\u77E5\u8BC6\u5361\uFF09", "api\uFF08\u5927\u6A21\u578B\u5BFC\u822A\uFF09", "shop\uFF08\u5B9A\u5236\u987E\u95EE\uFF09"],
    usage: "POST body: { scene: 'fj-sz', message: '\u4F60\u597D', history: [] }"
  });
}
__name(onRequestGet4, "onRequestGet");

// api/ai-track.js
var PROJECTS = ["fj-sz", "learn", "shop", "api", "solospeak", "facetalk", "other"];
var ANALYTICS_DB = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(cors, "cors");
async function onRequestOptions2() {
  return new Response(null, { status: 204, headers: cors() });
}
__name(onRequestOptions2, "onRequestOptions");
async function onRequestPost4({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "bad json" }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }
  const project = (body.project || "other").trim();
  const safeProject = PROJECTS.includes(project) ? project : "other";
  const scene = (body.scene || "").trim().slice(0, 64);
  const provider = (body.provider || "").trim().slice(0, 32);
  const status = body.status === "ok" ? "ok" : "fail";
  const latencyMs = Number(body.latency_ms) || 0;
  const tokens = Number(body.tokens) || 0;
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ ok: false, error: "server misconfig" }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }
  const now = /* @__PURE__ */ new Date();
  const day = now.toISOString().slice(0, 10);
  const createdAt = now.toISOString();
  const esc3 = /* @__PURE__ */ __name((s) => String(s).replace(/'/g, "''"), "esc");
  try {
    const ddl = `CREATE TABLE IF NOT EXISTS ai_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        scene TEXT,
        provider TEXT,
        status TEXT NOT NULL,
        latency_ms INTEGER DEFAULT 0,
        tokens INTEGER DEFAULT 0,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_calls_day ON ai_calls(day);
      CREATE INDEX IF NOT EXISTS idx_ai_calls_project ON ai_calls(project);`;
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: ddl })
      }
    );
    const insertSql = `INSERT INTO ai_calls(project, scene, provider, status, latency_ms, tokens, day, created_at)
      VALUES('${esc3(safeProject)}', '${esc3(scene)}', '${esc3(provider)}', '${status}', ${latencyMs}, ${tokens}, '${day}', '${createdAt}')`;
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: insertSql })
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || "db error");
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors() } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors() } }
    );
  }
}
__name(onRequestPost4, "onRequestPost");

// api/commute-chat.js
var DB2 = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
var MAX_LEN = 40;
var MAX_ITEMS = 100;
function localHour() {
  return new Date(Date.now() + 8 * 3600 * 1e3).getUTCHours();
}
__name(localHour, "localHour");
function isOpenLocal() {
  const h = localHour();
  return h >= 6 && h < 10 || h >= 18 && h < 22;
}
__name(isOpenLocal, "isOpenLocal");
function secToLocalMidnight() {
  const now = new Date(Date.now() + 8 * 3600 * 1e3);
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.round((end.getTime() - now.getTime()) / 1e3));
}
__name(secToLocalMidnight, "secToLocalMidnight");
function testMode(env) {
  const v = String(env.TEST_MODE || "on").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true";
}
__name(testMode, "testMode");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function withCors(resp) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}
__name(withCors, "withCors");
function json8(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  }));
}
__name(json8, "json");
function bad3(msg, code = 400, extra = {}) {
  return json8({ ok: false, error: msg, code, ...extra }, code === "CLOSED" ? 403 : 429);
}
__name(bad3, "bad");
async function onRequestOptions3() {
  return withCors(new Response(null, { status: 204 }));
}
__name(onRequestOptions3, "onRequestOptions");
async function d14(env, sql, ms = 6e3) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${DB2}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
        signal: ac.signal
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || "D1 \u67E5\u8BE2\u5931\u8D25");
    return j.result;
  } finally {
    clearTimeout(t);
  }
}
__name(d14, "d1");
var RATE_SEC = 15;
var BURST_PER_MIN = 5;
var DAILY_IP_LIMIT = 15;
var _ready = null;
async function ensureTable(env) {
  if (_ready) return _ready;
  _ready = (async () => {
    await d14(env, `CREATE TABLE IF NOT EXISTS commute_chat (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      client_id TEXT,
      created_at TEXT NOT NULL
    )`);
    await d14(env, `CREATE INDEX IF NOT EXISTS idx_cc_created ON commute_chat(created_at DESC)`);
    await d14(env, `CREATE TABLE IF NOT EXISTS commute_chat_rl (
      ip TEXT PRIMARY KEY,
      last_ts INTEGER NOT NULL,
      min_ts INTEGER NOT NULL DEFAULT 0,
      min_n INTEGER NOT NULL DEFAULT 0,
      day TEXT NOT NULL,
      n INTEGER DEFAULT 0
    )`);
  })();
  return _ready;
}
__name(ensureTable, "ensureTable");
function esc(s) {
  return String(s).replace(/'/g, "''").slice(0, 64);
}
__name(esc, "esc");
function sanitize(s, max) {
  s = (s || "").toString().replace(/\s+/g, " ").trim();
  return s.slice(0, max);
}
__name(sanitize, "sanitize");
var SENSITIVE = ["\u8D4C\u535A", "\u8272\u60C5", "\u70B8\u836F", "\u70B8\u5F39", "\u6BD2\u54C1", "\u8BC8\u9A97", "\u62DB\u5AD6", "\u4EE3\u5237", "\u67AA", "\u5FAE\u4FE1", "\u52A0\u6211", "\u79C1\u804A", "\u52A0\u5FAE\u4FE1", "vx", "v\u4FE1", "\u4EE3\u7EC3", "\u4EE3\u8003", "\u529E\u8BC1"];
function hasSensitive(s) {
  s = (s || "").toLowerCase();
  for (const w of SENSITIVE) if (s.includes(w)) return w;
  if (/(?:^|[^0-9])1[3-9]\d{9}(?:[^0-9]|$)/.test(s)) return "\u624B\u673A\u53F7";
  if (/(?:^|[^0-9])\d{3,4}-?\d{7,8}(?:[^0-9]|$)/.test(s)) return "\u5EA7\u673A\u53F7";
  return null;
}
__name(hasSensitive, "hasSensitive");
function getIp(req) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
}
__name(getIp, "getIp");
function randId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(36)).join("").slice(0, 20);
}
__name(randId, "randId");
async function onRequestGet5({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return bad3("\u670D\u52A1\u7AEF\u672A\u914D\u7F6E", 500);
  const open = testMode(env) ? true : isOpenLocal();
  try {
    await ensureTable(env);
    const res = await d14(
      env,
      `SELECT id, text, client_id, created_at FROM commute_chat
       WHERE date(created_at,'localtime') = date('now','localtime')
       ORDER BY created_at DESC LIMIT ${MAX_ITEMS}`
    );
    const rows = res[0] && res[0].results || [];
    const items = rows.map((r) => ({ id: r.id, text: r.text, clientId: r.client_id, createdAt: r.created_at })).reverse();
    return json8({ ok: true, open, testMode: testMode(env), items, resetIn: secToLocalMidnight() });
  } catch (e) {
    return bad3("\u8BFB\u53D6\u5931\u8D25\uFF1A" + e.message, 500);
  }
}
__name(onRequestGet5, "onRequestGet");
async function onRequestPost5({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return bad3("\u670D\u52A1\u7AEF\u672A\u914D\u7F6E", 500);
  const tm = testMode(env);
  if (!tm && !isOpenLocal()) {
    return bad3("\u73B0\u5728\u4E0D\u662F\u901A\u52E4\u65F6\u6BB5\u5566\uFF5E\u5F00\u653E\u65F6\u95F4\uFF1A\u65E9 6\u201310 \u70B9\u3001\u665A 6\u201310 \u70B9\u3002", "CLOSED", { open: false });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return bad3("JSON \u89E3\u6790\u5931\u8D25");
  }
  const ip = getIp(request);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const nowSec = Math.floor(Date.now() / 1e3);
  const today = now.slice(0, 10);
  if (!tm) {
    try {
      const r = await d14(env, `SELECT last_ts, min_ts, min_n, day, n FROM commute_chat_rl WHERE ip='${esc(ip)}' LIMIT 1`);
      const row = r[0] && r[0].results && r[0].results[0] || null;
      if (row) {
        const last = Number(row.last_ts) || 0;
        const min_ts = Number(row.min_ts) || 0;
        const min_n = Number(row.min_n) || 0;
        const dayCount = row.day === today ? Number(row.n) || 0 : 0;
        if (nowSec - last < RATE_SEC) {
          const left = RATE_SEC - (nowSec - last);
          return bad3(`\u8BF4\u5F97\u592A\u5FEB\u5566\uFF0C\u8BF7 ${left} \u79D2\u540E\u518D\u53D1`, "RATE_LIMIT", { left });
        }
        if (nowSec - min_ts < 60 && min_n >= BURST_PER_MIN) {
          const left = 60 - (nowSec - min_ts);
          return bad3(`\u4E00\u5206\u949F\u53D1\u8A00\u592A\u591A\u5566\uFF0C\u8BF7 ${left} \u79D2\u540E\u518D\u53D1`, "BURST_LIMIT", { left });
        }
        if (dayCount >= DAILY_IP_LIMIT) {
          return bad3(`\u4F60\u4ECA\u5929\u53D1\u8A00\u5DF2\u8FBE\u4E0A\u9650\uFF08${DAILY_IP_LIMIT} \u6761\uFF09\uFF0C\u660E\u65E5\u518D\u6765\uFF5E`, "DAILY_LIMIT", { resetIn: secToLocalMidnight() });
        }
      }
    } catch {
    }
  }
  const text = sanitize(body.text, MAX_LEN);
  if (!text) return bad3("\u8BF4\u70B9\u4EC0\u4E48\u5427", "EMPTY");
  const hit = hasSensitive(text);
  if (hit) return bad3(`\u542B\u654F\u611F\u8BCD\u300C${hit}\u300D\uFF0C\u6362\u4E2A\u8BF4\u6CD5`, "BAD_WORD", { word: hit });
  const clientId = String(body.clientId || "").slice(0, 64);
  const id = randId();
  try {
    await d14(
      env,
      `INSERT INTO commute_chat(id, text, client_id, created_at) VALUES('${id}','${esc(text)}','${esc(clientId)}','${now}')`
    );
    const inSameMin = `CASE WHEN ${nowSec} - min_ts < 60 THEN min_n + 1 ELSE 1 END`;
    const newMinTs = `CASE WHEN ${nowSec} - min_ts < 60 THEN min_ts ELSE ${nowSec} END`;
    await d14(
      env,
      `INSERT INTO commute_chat_rl(ip, last_ts, min_ts, min_n, day, n)
         VALUES('${esc(ip)}', ${nowSec}, ${nowSec}, 1, '${today}', 1)
       ON CONFLICT(ip) DO UPDATE SET
         last_ts=${nowSec},
         min_ts=${newMinTs},
         min_n=${inSameMin},
         day='${today}',
         n = CASE WHEN day='${today}' THEN n+1 ELSE 1 END`
    );
  } catch (e) {
    return bad3("\u5199\u5165\u5931\u8D25\uFF1A" + e.message, 500);
  }
  let remaining = DAILY_IP_LIMIT - 1;
  try {
    const r = await d14(env, `SELECT n FROM commute_chat_rl WHERE ip='${esc(ip)}' AND day='${today}' LIMIT 1`);
    const row = r[0] && r[0].results && r[0].results[0] || null;
    remaining = row ? Math.max(0, DAILY_IP_LIMIT - (Number(row.n) || 0)) : DAILY_IP_LIMIT - 1;
  } catch {
  }
  return json8({ ok: true, item: { id, text, clientId, createdAt: now }, remaining, resetIn: secToLocalMidnight() });
}
__name(onRequestPost5, "onRequestPost");

// api/moment.js
var DB3 = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
var SCENE = "commute";
var AUTO_END_HOURS = 2;
var ACTIVE_DAYS = AUTO_END_HOURS / 24;
var ACTIVE_FILTER = `(status='active' AND (julianday('now','localtime') - julianday(started_at,'localtime')) < ${ACTIVE_DAYS})`;
var RECENT_FILTER = `((julianday('now','localtime') - julianday(started_at,'localtime')) < ${ACTIVE_DAYS})`;
var CORS2 = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function withCors2(resp) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS2)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}
__name(withCors2, "withCors");
function json9(data, status = 200) {
  return withCors2(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  }));
}
__name(json9, "json");
function bad4(msg, code = 400) {
  return json9({ ok: false, error: msg }, code);
}
__name(bad4, "bad");
async function onRequestOptions4() {
  return withCors2(new Response(null, { status: 204 }));
}
__name(onRequestOptions4, "onRequestOptions");
async function d15(env, sql, ms = 6e3) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${DB3}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
        signal: ac.signal
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || "D1 \u67E5\u8BE2\u5931\u8D25");
    return j.result;
  } finally {
    clearTimeout(t);
  }
}
__name(d15, "d1");
var _ready2 = null;
var _lastPurge = 0;
async function ensureTable2(env) {
  if (_ready2) return _ready2;
  _ready2 = (async () => {
    await d15(env, `CREATE TABLE IF NOT EXISTS moments (
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
    await d15(env, `CREATE INDEX IF NOT EXISTS idx_moments_active ON moments(scene, status, started_at)`);
    try {
      const info = await d15(env, `PRAGMA table_info(moments)`);
      const cols = (info[0] && info[0].results || []).map((r) => r.name);
      if (!cols.includes("mode")) await d15(env, `ALTER TABLE moments ADD COLUMN mode TEXT`);
      if (!cols.includes("traffic")) await d15(env, `ALTER TABLE moments ADD COLUMN traffic TEXT`);
      if (!cols.includes("client_id")) await d15(env, `ALTER TABLE moments ADD COLUMN client_id TEXT`);
      if (!cols.includes("duration_sec")) await d15(env, `ALTER TABLE moments ADD COLUMN duration_sec INTEGER`);
    } catch {
    }
  })();
  return _ready2;
}
__name(ensureTable2, "ensureTable");
function esc2(s) {
  return String(s).replace(/'/g, "''").slice(0, 64);
}
__name(esc2, "esc");
async function snapshot(env) {
  const res = await d15(
    env,
    `SELECT COUNT(*) c FROM moments WHERE scene='${SCENE}' AND ${ACTIVE_FILTER}`
  );
  const rows = res[0] && res[0].results || [];
  const active = Number(rows[0] && rows[0].c) || 0;
  return { active };
}
__name(snapshot, "snapshot");
async function recentByClient(env, clientId) {
  const r = await d15(
    env,
    `SELECT id, status FROM moments WHERE scene='${SCENE}' AND client_id='${esc2(clientId)}' AND ${RECENT_FILTER} ORDER BY started_at DESC LIMIT 1`
  );
  const hit = r[0] && r[0].results && r[0].results[0] || null;
  return hit;
}
__name(recentByClient, "recentByClient");
async function statsToday(env) {
  const res = await d15(
    env,
    `SELECT COUNT(*) n, MIN(duration_sec) mn, MAX(duration_sec) mx, AVG(duration_sec) av
     FROM moments
     WHERE scene='${SCENE}' AND status='arrived'
       AND date(ended_at, 'localtime') = date('now', 'localtime')`
  );
  const r = res[0] && res[0].results && res[0].results[0] || {};
  const n = Number(r.n) || 0;
  return {
    doneToday: n,
    minSec: n ? Number(r.mn) : 0,
    maxSec: n ? Number(r.mx) : 0,
    avgSec: n ? Math.round(Number(r.av)) : 0
  };
}
__name(statsToday, "statsToday");
async function hourlyToday(env) {
  const res = await d15(
    env,
    `SELECT CAST(strftime('%H', ended_at, 'localtime') AS INTEGER) h, COUNT(*) c
     FROM moments
     WHERE scene='${SCENE}' AND status='arrived'
       AND date(ended_at, 'localtime') = date('now', 'localtime')
     GROUP BY h`
  );
  const rows = res[0] && res[0].results || [];
  const arr = new Array(24).fill(0);
  for (const r of rows) {
    const h = Number(r.h);
    if (h >= 0 && h < 24) arr[h] = Number(r.c) || 0;
  }
  return arr;
}
__name(hourlyToday, "hourlyToday");
async function purgeStale(env) {
  try {
    const sql = `DELETE FROM moments WHERE scene='${SCENE}' AND (
        (status='active' AND (julianday('now','localtime') - julianday(started_at,'localtime')) >= ${ACTIVE_DAYS})
        OR (status='arrived' AND (julianday('now','localtime') - julianday(ended_at,'localtime')) >= 30)
      )`;
    const res = await d15(env, sql);
    const changes = res[0] && res[0].meta && res[0].meta.changes || 0;
    return changes;
  } catch (e) {
    console.error("purgeStale failed:", e.message);
    return 0;
  }
}
__name(purgeStale, "purgeStale");
async function onRequestGet6({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return bad4("\u670D\u52A1\u7AEF\u672A\u914D\u7F6E CF_API_TOKEN / CF_ACCOUNT_ID", 500);
  }
  const url = new URL(request.url);
  const clearTarget = url.searchParams.get("clear");
  if (clearTarget === SCENE) {
    const admin = url.searchParams.get("admin") || "";
    const ok = await commuteAdminOk(request, env, admin);
    if (!ok) return bad4("\u9700\u8981\u540E\u53F0\u767B\u5F55\u6216 admin \u53E3\u4EE4", 403);
    try {
      await ensureTable2(env);
      const r1 = await d15(env, `DELETE FROM moments WHERE scene='${SCENE}'`);
      const r2 = await d15(env, `DELETE FROM commute_chat`);
      const r3 = await d15(env, `DELETE FROM commute_chat_rl`);
      const c = /* @__PURE__ */ __name((a) => a && a[0] && a[0].meta && a[0].meta.changes || 0, "c");
      return json9({
        ok: true,
        cleared: true,
        scene: SCENE,
        deleted: { moments: c(r1), chat: c(r2), chat_rl: c(r3) }
      });
    } catch (e) {
      return bad4("\u6E05\u7A7A\u5931\u8D25\uFF1A" + e.message, 500);
    }
  }
  try {
    await ensureTable2(env);
    let purged = 0;
    const now = Date.now();
    if (!_lastPurge || now - _lastPurge > 6e4) {
      _lastPurge = now;
      purged = await purgeStale(env);
    }
    const { active } = await snapshot(env);
    const stats = await statsToday(env);
    const hourly = await hourlyToday(env);
    const open = isOpenLocal2(env);
    return json9({
      ok: true,
      scene: SCENE,
      active,
      stats,
      hourly,
      autoEndHours: AUTO_END_HOURS,
      open,
      testMode: testMode2(env),
      purged
    });
  } catch (e) {
    return bad4("\u67E5\u8BE2\u5931\u8D25\uFF1A" + e.message, 500);
  }
}
__name(onRequestGet6, "onRequestGet");
function testMode2(env) {
  return String(env.TEST_MODE || "on").trim().toLowerCase() === "on";
}
__name(testMode2, "testMode");
function localHour2() {
  const now = new Date(Date.now() + 8 * 3600 * 1e3);
  return now.getUTCHours();
}
__name(localHour2, "localHour");
function isOpenLocal2(env) {
  if (testMode2(env)) return true;
  const h = localHour2();
  return h >= 6 && h < 10 || h >= 18 && h < 22;
}
__name(isOpenLocal2, "isOpenLocal");
async function commuteAdminOk(request, env, adminParam) {
  if (env.ADMIN_PASSWORD && verifyCookie3(request, env.ADMIN_PASSWORD)) return true;
  if (env.ADMIN_KEY && String(adminParam || "").trim() === String(env.ADMIN_KEY).trim()) return true;
  return false;
}
__name(commuteAdminOk, "commuteAdminOk");
function getCookie6(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
__name(getCookie6, "getCookie");
function verifyCookie3(request, secret) {
  const cookie = getCookie6(request, "rcj_admin");
  if (!cookie) return false;
  const [p, s] = cookie.split(".");
  if (!p || !s) return false;
  return safeHmac(p, secret).then((sig) => sig === s).catch(() => false);
}
__name(verifyCookie3, "verifyCookie");
async function safeHmac(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(safeHmac, "safeHmac");
function randId2() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += x.toString(36).padStart(2, "0");
  return s;
}
__name(randId2, "randId");
async function onRequestPost6({ request, env }) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return bad4("\u670D\u52A1\u7AEF\u672A\u914D\u7F6E CF_API_TOKEN / CF_ACCOUNT_ID", 500);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return bad4("JSON \u89E3\u6790\u5931\u8D25");
  }
  const action = String(body.action || "");
  if (action === "start" && !isOpenLocal2(env)) {
    return json9({ ok: false, error: "\u73B0\u5728\u4E0D\u662F\u901A\u52E4\u65F6\u6BB5\u5566\uFF5E\u5F00\u653E\u65F6\u95F4\uFF1A\u65E9 6\u201310 \u70B9\u3001\u665A 6\u201310 \u70B9\u3002", code: "CLOSED", open: false }, 403);
  }
  try {
    await ensureTable2(env);
    if (action === "start") {
      const clientId = String(body.clientId || "").slice(0, 64);
      const existingId = String(body.id || "").slice(0, 64);
      if (existingId) {
        const r = await d15(
          env,
          `SELECT id FROM moments WHERE id='${esc2(existingId)}' AND scene='${SCENE}' AND ${ACTIVE_FILTER} LIMIT 1`
        );
        const hit = r[0] && r[0].results && r[0].results[0] || null;
        if (hit) {
          const snap2 = await snapshot(env);
          return json9({ ok: true, id: hit.id, restored: true, ...snap2 });
        }
      }
      if (clientId) {
        const recent = await recentByClient(env, clientId);
        if (recent) {
          const snap2 = await snapshot(env);
          if (recent.status === "active") {
            return json9({ ok: true, id: recent.id, restored: true, ...snap2 });
          }
          return json9({ ok: false, error: "\u4F60\u6700\u8FD1 2 \u5C0F\u65F6\u5185\u5DF2\u7ECF\u8BB0\u5F55\u8FC7\u4E00\u6B21\u901A\u52E4\u5566\uFF0C\u7A0D\u540E\u518D\u6765\uFF5E", code: "RECENT_EXISTS" }, 409);
        }
      }
      const id = randId2();
      const mode = body.mode ? esc2(String(body.mode).slice(0, 16)) : "";
      const traffic = body.traffic ? esc2(String(body.traffic).slice(0, 16)) : "";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await d15(
        env,
        `INSERT INTO moments(id, scene, client_id, mode, traffic, status, started_at, created_at) VALUES('${id}','${SCENE}','${esc2(clientId)}','${mode}','${traffic}','active','${now}','${now}')`
      );
      const snap = await snapshot(env);
      return json9({ ok: true, id, startedAt: now, ...snap });
    }
    if (action === "arrive") {
      const id = esc2(String(body.id || "").slice(0, 64));
      if (!id) return bad4("\u7F3A\u5C11 id");
      const r = await d15(
        env,
        `SELECT started_at, status FROM moments WHERE id='${id}' AND scene='${SCENE}' LIMIT 1`
      );
      const row = r[0] && r[0].results && r[0].results[0] || null;
      if (!row) return bad4("\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F", 404);
      if (row.status === "arrived") {
        const snap2 = await snapshot(env);
        return json9({ ok: true, alreadyArrived: true, ...snap2 });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const startedAt = row.started_at;
      const durationSec = Math.max(0, Math.round((new Date(now) - new Date(startedAt)) / 1e3));
      await d15(
        env,
        `UPDATE moments SET status='arrived', ended_at='${now}', duration_sec=${durationSec} WHERE id='${id}' AND scene='${SCENE}'`
      );
      const snap = await snapshot(env);
      return json9({ ok: true, durationSec, ...snap });
    }
    if (action === "leave") {
      const id = esc2(String(body.id || "").slice(0, 64));
      if (!id) return bad4("\u7F3A\u5C11 id");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await d15(
        env,
        `UPDATE moments SET status='left', ended_at='${now}' WHERE id='${id}' AND scene='${SCENE}' AND status='active'`
      );
      const snap = await snapshot(env);
      return json9({ ok: true, ...snap });
    }
    return bad4("\u672A\u77E5 action");
  } catch (e) {
    return bad4("\u5904\u7406\u5931\u8D25\uFF1A" + e.message, 500);
  }
}
__name(onRequestPost6, "onRequestPost");

// api/notes.js
var DB4 = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
function json10(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json10, "json");
async function hmac7(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  const b = new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
__name(hmac7, "hmac");
function getCookie7(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
__name(getCookie7, "getCookie");
async function verifyAuth4(request, env) {
  const cookie = getCookie7(request, "rcj_admin");
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split(".");
    if (p && s && await hmac7(p, env.ADMIN_PASSWORD) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get("password") || "";
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}
__name(verifyAuth4, "verifyAuth");
async function d16(env, sql, params = []) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${DB4}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const j = await r.json();
  if (!j.success) throw new Error(j.errors?.[0]?.message || "D1 \u67E5\u8BE2\u5931\u8D25");
  return j.result[0].results;
}
__name(d16, "d1");
async function ensureTable3(env) {
  await d16(env, "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at TEXT NOT NULL)");
}
__name(ensureTable3, "ensureTable");
async function onRequestGet7({ request, env }) {
  try {
    await ensureTable3(env);
    const rows = await d16(env, "SELECT id, text, created_at FROM notes ORDER BY id DESC");
    return json10({ ok: true, notes: rows });
  } catch (e) {
    return json10({ ok: false, error: e.message }, 500);
  }
}
__name(onRequestGet7, "onRequestGet");
async function onRequestPost7({ request, env }) {
  if (!await verifyAuth4(request, env)) return json10({ error: "\u672A\u767B\u5F55" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json10({ error: "JSON \u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const text = String(body.text || "").trim();
  if (!text) return json10({ error: "\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  if (text.length > 5e3) return json10({ error: "\u5185\u5BB9\u8FC7\u957F\uFF08\u6700\u591A 5000 \u5B57\uFF09" }, 400);
  try {
    await ensureTable3(env);
    const created_at = (/* @__PURE__ */ new Date()).toISOString();
    await d16(env, "INSERT INTO notes (text, created_at) VALUES (?, ?)", [text, created_at]);
    return json10({ ok: true });
  } catch (e) {
    return json10({ ok: false, error: e.message }, 500);
  }
}
__name(onRequestPost7, "onRequestPost");
async function onRequestDelete({ request, env }) {
  if (!await verifyAuth4(request, env)) return json10({ error: "\u672A\u767B\u5F55" }, 401);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json10({ error: "\u7F3A\u5C11 id" }, 400);
  try {
    await ensureTable3(env);
    await d16(env, "DELETE FROM notes WHERE id = ?", [id]);
    return json10({ ok: true });
  } catch (e) {
    return json10({ ok: false, error: e.message }, 500);
  }
}
__name(onRequestDelete, "onRequestDelete");

// api/probe.js
function json11(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(json11, "json");
async function onRequestOptions5() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions5, "onRequestOptions");
async function onRequestPost8({ request }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json11({ ok: false, error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
  }
  const BASE = (body.baseUrl || "").trim();
  const MODEL = (body.model || "").trim();
  const API_KEY = (body.apiKey || "").trim();
  if (!BASE || !MODEL || !API_KEY) {
    return json11({ ok: false, error: "\u63A5\u53E3\u5730\u5740\u3001\u6A21\u578B\u540D\u3001API Key \u4E09\u9879\u9F50\u5168\u624D\u80FD\u6D4B\u8BD5" }, 400);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(BASE);
    if (parsedUrl.protocol !== "https:") {
      return json11({ ok: false, error: "\u63A5\u53E3\u5730\u5740\u4EC5\u652F\u6301 https", url: BASE }, 400);
    }
    const host = parsedUrl.hostname;
    const blocked = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".internal") || host.endsWith(".local") || host.startsWith("192.168.") || host.startsWith("10.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (blocked) {
      return json11({ ok: false, error: "\u63A5\u53E3\u5730\u5740\u4E0D\u5141\u8BB8\u6307\u5411\u672C\u5730\u6216\u5185\u7F51", url: BASE }, 400);
    }
  } catch (e) {
    return json11({ ok: false, error: "\u63A5\u53E3\u5730\u5740\u683C\u5F0F\u4E0D\u6B63\u786E", url: BASE }, 400);
  }
  const baseClean = BASE.replace(/\/+$/, "");
  const url = /\/chat\/completions$/i.test(baseClean) ? baseClean : `${baseClean}/chat/completions`;
  try {
    const probePayload = {
      model: MODEL,
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
      max_tokens: 5,
      stream: false
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(probePayload)
    });
    const status = res.status;
    const text = await res.text();
    if (!res.ok) {
      return json11(
        { ok: false, error: `HTTP ${status}: ${text.slice(0, 300)}`, url, model: MODEL },
        status
      );
    }
    let echoModel = MODEL;
    try {
      const d = JSON.parse(text);
      if (d.model) echoModel = d.model;
    } catch (e2) {
    }
    return json11({ ok: true, url, model: echoModel, sample: text.slice(0, 120) });
  } catch (err) {
    return json11({ ok: false, error: err.message, url, model: MODEL }, 500);
  }
}
__name(onRequestPost8, "onRequestPost");

// api/track.js
var SITES = ["hub", "solospeak", "letout", "training", "aux", "xf", "facetalk", "exam"];
var ANALYTICS_DB2 = "b3198ef2-6e7c-424e-8a0f-a7b21afc1828";
function cors2() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(cors2, "cors");
async function onRequestOptions6() {
  return new Response(null, { status: 204, headers: cors2() });
}
__name(onRequestOptions6, "onRequestOptions");
async function onRequest3({ request, env }) {
  const url = new URL(request.url);
  const site = (url.searchParams.get("site") || "").trim();
  if (!SITES.includes(site)) {
    return new Response(
      JSON.stringify({ ok: false, error: "unknown site" }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors2() } }
    );
  }
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ ok: false, error: "server misconfig" }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors2() } }
    );
  }
  const ip = request.headers.get("CF-Connecting-IP") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const ipSql = ip.replace(/'/g, "''");
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB2}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `INSERT INTO visits(site, day, ip, n) VALUES('${site}', '${day}', '${ipSql}', 1) ON CONFLICT(site, day, ip) DO UPDATE SET n = n + 1`
        })
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || "db error");
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors2() } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors2() } }
    );
  }
}
__name(onRequest3, "onRequest");

// ../.wrangler/tmp/pages-5Gq5NB/functionsRoutes-0.803435015242072.mjs
var routes = [
  {
    routePath: "/api/admin/data",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/health",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/login",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/logout",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/migrate",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/admin/commute-chat",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/admin/wall",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/ai-chat",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/ai-chat",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/ai-chat",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/ai-track",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/ai-track",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/commute-chat",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/commute-chat",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/commute-chat",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/moment",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/moment",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/moment",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/notes",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/probe",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  },
  {
    routePath: "/api/probe",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/track",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions6]
  },
  {
    routePath: "/api/track",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  }
];

// ../../../../../AppData/Local/DoubaoWork/User Data/sandbox_runtime/.cache/node/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../AppData/Local/DoubaoWork/User Data/sandbox_runtime/.cache/node/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
