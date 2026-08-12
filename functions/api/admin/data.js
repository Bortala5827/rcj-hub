// rcj-hub · 统一后台数据聚合
// GET /api/admin/data  (需登录：签名 cookie 或 ?password=)
// 服务端用 CF_API_TOKEN + CF_ACCOUNT_ID 读取各 D1 库，聚合后返回 JSON。
// token 仅存于服务端 env，绝不下发浏览器。

const DBS = {
  hub: 'b18ad841-ee76-4454-97f6-4515f32bb5bf',       // rcj-hub-d1 (友链)
  facetalk: 'f93a89d7-ef5f-49c5-863d-5f1611e1a7f4',  // mianshi-dazi-d1 (FaceTalk)
  aux: 'ab639fbe-39b7-4ea8-bd67-18cdaa133599',        // aux-police-exam-d1 (辅警)
  analytics: 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828',  // rcj-analytics-d1 (统一浏览统计)
};

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

async function d1(env, dbId, sql, ms = 8000) {
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

  try {
    const results = await Promise.allSettled([
      d1(env, DBS.hub, "SELECT status, COUNT(*) c FROM links GROUP BY status"),
      d1(env, DBS.facetalk, "SELECT status, COUNT(*) c FROM pairs GROUP BY status"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM intents"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM applications"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM wall"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM reports"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM ratings"),
      d1(env, DBS.facetalk, "SELECT COUNT(*) c FROM messages"),
      d1(env, DBS.facetalk, "SELECT a, b, mode, status, created FROM pairs ORDER BY created DESC LIMIT 6"),
      d1(env, DBS.facetalk, "SELECT name, text, created_at FROM wall ORDER BY created_at DESC LIMIT 6"),
      d1(env, DBS.aux, "SELECT city, COUNT(*) c FROM wall GROUP BY city ORDER BY c DESC"),
      d1(env, DBS.aux, "SELECT COUNT(*) c FROM wall"),
      d1(env, DBS.analytics, "SELECT site, day, SUM(n) s FROM visits GROUP BY site, day ORDER BY day"),
      d1(env, DBS.analytics, "SELECT site, SUM(n) total, COUNT(DISTINCT ip) u, COUNT(DISTINCT day) d FROM visits GROUP BY site"),
      d1(env, DBS.aux, "SELECT COUNT(*) c FROM signal_match"),
    ]);
    const v = (i) => results[i].status === 'fulfilled' ? results[i].value : null;
    const warns = [];
    results.forEach((r, i) => { if (r.status === 'rejected') warns.push(`查询#${i} 失败: ${r.reason.message}`); });

    const hubLinks = v(0), ftPairs = v(1), ftIntents = v(2), ftApps = v(3), ftWall = v(4),
          ftReports = v(5), ftRatings = v(6), ftMessages = v(7), ftPairsRecent = v(8),
          ftWallRecent = v(9), auxWallCity = v(10), auxWallTotal = v(11),
          uniRaw = v(12), uniTotals = v(13), auxMatch = v(14);

    // —— 统一浏览统计：按 site 聚合 ——
    const bySite = {};
    (uniRaw || []).forEach(r => {
      bySite[r.site] = bySite[r.site] || { points: [] };
      bySite[r.site].points.push({ day: r.day, s: Number(r.s) || 0 });
    });
    (uniTotals || []).forEach(r => {
      bySite[r.site] = bySite[r.site] || {};
      bySite[r.site].total = Number(r.total) || 0;
      bySite[r.site].u = Number(r.u) || 0;
      bySite[r.site].d = Number(r.d) || 0;
    });
    const analyticsSeries = Object.keys(bySite).map(site => ({
      site,
      points: (bySite[site].points || []).slice(-14),
      total: bySite[site].total || 0,
      u: bySite[site].u || 0,
      d: bySite[site].d || 0,
    }));
    const allVisits = analyticsSeries.reduce((a, s) => a + s.total, 0);

    const links = {};
    (hubLinks || []).forEach(r => links[r.status] = r.c);
    const pairs = {};
    (ftPairs || []).forEach(r => pairs[r.status] = r.c);

    // 辅警面板兼容：从统一库取 aux 站点数据
    const auxUni = bySite['aux'] || {};
    const auxVisits = { s: auxUni.total || 0, u: auxUni.u || 0, d: auxUni.d || 0 };
    const auxVisitTrend = (auxUni.points || []).slice().reverse();

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      links: {
        total: Object.values(links).reduce((a, b) => a + b, 0),
        pending: links.pending || 0,
        approved: links.approved || 0,
        rejected: links.rejected || 0,
      },
      facetalk: {
        pairsTotal: Object.values(pairs).reduce((a, b) => a + b, 0),
        pairsByStatus: pairs,
        intents: (ftIntents[0] && ftIntents[0].c) || 0,
        applications: (ftApps[0] && ftApps[0].c) || 0,
        wall: (ftWall[0] && ftWall[0].c) || 0,
        reports: (ftReports[0] && ftReports[0].c) || 0,
        ratings: (ftRatings[0] && ftRatings[0].c) || 0,
        messages: (ftMessages[0] && ftMessages[0].c) || 0,
        recentPairs: ftPairsRecent || [],
        recentWall: ftWallRecent || [],
      },
      aux: {
        wallTotal: (auxWallTotal[0] && auxWallTotal[0].c) || 0,
        wallByCity: auxWallCity || [],
        visits: auxVisits,
        visitTrend: auxVisitTrend,
        signalMatch: (auxMatch[0] && auxMatch[0].c) || 0,
      },
      analytics: {
        allVisits,
        series: analyticsSeries,
        bySite,
      },
      note: '数据源：rcj-hub-d1 / mianshi-dazi-d1 / aux-police-exam-d1（互动数据）+ rcj-analytics-d1（统一浏览统计，hub/solospeak/letout/training/aux/xf/facetalk/exam 共用）。',
      warns: warns.length ? warns : undefined,
    });
  } catch (e) {
    return json({ error: '聚合失败：' + e.message }, 500);
  }
}
