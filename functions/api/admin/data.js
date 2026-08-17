// rcj-hub · 统一后台数据聚合
// GET /api/admin/data  (需登录：签名 cookie 或 ?password=)
// 服务端用 CF_API_TOKEN + CF_ACCOUNT_ID 读取各 D1 库，聚合后返回 JSON。
// token 仅存于服务端 env，绝不下发浏览器。
//
// v3: 加 60s 内存缓存(避免每次 15 并发 D1 查询) + 合并 SQL(15→10) + 整体超时

const DBS = {
  facetalk: 'f93a89d7-ef5f-49c5-863d-5f1611e1a7f4',  // mianshi-dazi-d1 (FaceTalk)
  analytics: 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828',  // rcj-analytics-d1 (统一浏览统计)
};

// ── 服务端内存缓存（60s TTL，单 Worker 隔离足够用）──
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000; // 60 秒

function getCached() {
  if (_cache && (Date.now() - _cacheAt) < CACHE_TTL) return _cache;
  return null;
}
function setCached(val) { _cache = val; _cacheAt = Date.now(); }

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
function getCookie(req, name) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
async function verifyAuth(request, env) {
  const cookie = getCookie(request, 'rcj_admin');
  if (cookie && env.ADMIN_PASSWORD) {
    const [p, s] = cookie.split('.');
    if (p && s && (await hmac(p, env.ADMIN_PASSWORD)) === s) return true;
  }
  const url = new URL(request.url);
  const pw = url.searchParams.get('password') || '';
  if (pw && pw === env.ADMIN_PASSWORD) return true;
  return false;
}

async function d1(env, dbId, sql, ms = 6000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: ac.signal,
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || 'D1 查询失败');
    return j.result[0].results;
  } finally { clearTimeout(timer); }
}

export async function onRequestGet({ request, env }) {
  if (!(await verifyAuth(request, env))) return json({ error: '未登录' }, 401);
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ error: 'CF_API_TOKEN / CF_ACCOUNT_ID 未配置。请在 rcj-hub Pages → Settings → Functions → Environment variables 添加这两个变量。' }, 500);
  }

  // ── 缓存命中直接返回 ──
  const hit = getCached();
  if (hit) {
    const body = JSON.parse(hit); // 浅拷贝避免污染
    body.generatedAt = new Date().toISOString(); // 更新时间戳
    body.cached = true;
    return json(body);
  }

  try {
    // ── 合并后 9 个并发查询 ──
    const results = await Promise.allSettled([
      // [0] facetalk: pairs 状态 + 近 6 条（合并为一次，前端再分）
      d1(env, DBS.facetalk, "SELECT status, COUNT(*) c FROM pairs GROUP BY status"),
      // [1] facetank: 全部计数合并（intents / applications / wall / reports / ratings / messages）
      d1(env, DBS.facetalk, "SELECT 'intents' AS k, COUNT(*) c FROM intents UNION ALL SELECT 'applications', COUNT(*) FROM applications UNION ALL SELECT 'wall', COUNT(*) FROM wall UNION ALL SELECT 'reports', COUNT(*) FROM reports UNION ALL SELECT 'ratings', COUNT(*) FROM ratings UNION ALL SELECT 'messages', COUNT(*) FROM messages"),
      // [2] facetalk: 近期 pairs
      d1(env, DBS.facetalk, "SELECT a, b, mode, status, created FROM pairs ORDER BY created DESC LIMIT 6"),
      // [3] facetalk: 近期 wall
      d1(env, DBS.facetalk, "SELECT name, text, created_at FROM wall ORDER BY created_at DESC LIMIT 6"),
      // [4][5] 辅警库已删除（2026-08-17 并入 exam 后下线），停止对其 D1 的查询；
      //         辅警站点浏览统计仍由 rcj-analytics-d1 的 site='aux' 承接（见下方 auxUni）。
      Promise.resolve(null),
      Promise.resolve(null),
      // [6] analytics: 趋势 + 汇总（合并为一次——按 site 聚合 day + total/u/d 一起算）
      d1(env, DBS.analytics, "SELECT site, day, SUM(n) s, 0 as total, 0 as u, 0 as d FROM visits GROUP BY site, day UNION ALL SELECT site, '' as day, SUM(n) as s, SUM(n) as total, COUNT(DISTINCT ip) as u, COUNT(DISTINCT day) as d FROM visits GROUP BY site ORDER BY site, day"),
    ]);

    const v = (i) => results[i].status === 'fulfilled' ? results[i].value : null;
    const warns = [];
    results.forEach((r, i) => { if (r.status === 'rejected') warns.push(`查询#${i} 失败: ${r.reason.message}`); });

    const ftPairs      = v(0);
    const ftCountsRaw  = v(1); // [{k,c}, ...]
    const ftPairsRecent= v(2);
    const ftWallRecent = v(3);
    const uniAll       = v(6); // 合并的趋势+汇总

    // ── 解析 facetalk 计数 ──
    const ftCounts = {};
    (ftCountsRaw || []).forEach(r => { ftCounts[r.k] = (r.c || 0); });

    // ── 统一浏览统计：从合并结果拆分趋势和汇总 ──
    const bySite = {};
    const totalsMap = {};
    (uniAll || []).forEach(r => {
      if (!bySite[r.site]) bySite[r.site] = { points: [], total: 0, u: 0, d: 0 };
      if (r.day) {
        bySite[r.site].points.push({ day: r.day, s: Number(r.s) || 0 });
      } else {
        // 汇总行：day=''
        bySite[r.site].total = Number(r.total) || 0;
        bySite[r.site].u = Number(r.u) || 0;
        bySite[r.site].d = Number(r.d) || 0;
      }
    });
    const analyticsSeries = Object.keys(bySite).map(site => ({
      site,
      points: (bySite[site].points || []).slice(-14),
      total: bySite[site].total || 0,
      u: bySite[site].u || 0,
      d: bySite[site].d || 0,
    }));
    const allVisits = analyticsSeries.reduce((a, s) => a + s.total, 0);

    const pairs = {};
    (ftPairs || []).forEach(r => pairs[r.status] = r.c);

    // 辅警面板兼容：从统一库取 aux 站点数据
    const auxUni = bySite['aux'] || {};
    const auxVisits = { s: auxUni.total || 0, u: auxUni.u || 0, d: auxUni.d || 0 };
    const auxVisitTrend = (auxUni.points || []).slice().reverse();

    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
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
        recentWall: ftWallRecent || [],
      },
      aux: {
        visits: auxVisits,
        visitTrend: auxVisitTrend,
        // 辅警站点只接入浏览统计（rcj-analytics-d1 · site='aux'）。
        // 留言墙 / 信号匹配是 FaceTalk（mianshi-dazi-d1）专属功能，辅警从未开通，故不含 wallTotal/signalMatch 字段。
        note: '辅警站点仅接入浏览统计（rcj-analytics-d1 · site=aux）；留言墙与信号匹配为 FaceTalk 专属功能，辅警未开通，故无互动数据。',
      },
      analytics: { allVisits, series: analyticsSeries, bySite },
      note: '数据源：mianshi-dazi-d1（FaceTalk 互动数据）+ rcj-analytics-d1（统一浏览统计，含 site=aux 辅警站点）。aux-police-exam-d1 已于 2026-08-17 并入 exam 后删除。',
      warns: warns.length ? warns : undefined,
    };

    // 写缓存
    setCached(JSON.stringify(payload));

    return json(payload);
  } catch (e) {
    return json({ error: '聚合失败：' + e.message }, 500);
  }
}
