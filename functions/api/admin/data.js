// rcj-hub · 统一后台数据聚合
// GET /api/admin/data  (需登录：签名 cookie 或 ?password=)
// 服务端用 CF_API_TOKEN + CF_ACCOUNT_ID 读取三个 D1 库，聚合后返回 JSON。
// token 仅存于服务端 env，绝不下发浏览器。

const DBS = {
  hub: 'b18ad841-ee76-4454-97f6-4515f32bb5bf',       // rcj-hub-d1 (友链)
  facetalk: 'f93a89d7-ef5f-49c5-863d-5f1611e1a7f4',  // mianshi-dazi-d1 (FaceTalk)
  aux: 'ab639fbe-39b7-4ea8-bd67-18cdaa133599',        // aux-police-exam-d1 (辅警)
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

async function d1(env, dbId, sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${dbId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(j.errors?.[0]?.message || 'D1 查询失败');
  return j.result[0].results;
}

export async function onRequestGet({ request, env }) {
  if (!(await verifyAuth(request, env))) return json({ error: '未登录' }, 401);
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return json({ error: 'CF_API_TOKEN / CF_ACCOUNT_ID 未配置。请在 rcj-hub Pages → Settings → Functions → Environment variables 添加这两个变量。' }, 500);
  }

  try {
    const [hubLinks, ftPairs, ftIntents, ftApps, ftWall, ftReports, ftRatings, ftMessages, ftPairsRecent, ftWallRecent,
           auxWallCity, auxWallTotal, auxVisits, auxTrend, auxMatch] = await Promise.all([
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
      d1(env, DBS.aux, "SELECT SUM(n) s, COUNT(DISTINCT ip) u, COUNT(DISTINCT day) d FROM visit_counts"),
      d1(env, DBS.aux, "SELECT day, SUM(n) s FROM visit_counts GROUP BY day ORDER BY day DESC LIMIT 14"),
      d1(env, DBS.aux, "SELECT COUNT(*) c FROM signal_match"),
    ]);

    const links = {};
    (hubLinks || []).forEach(r => links[r.status] = r.c);
    const pairs = {};
    (ftPairs || []).forEach(r => pairs[r.status] = r.c);

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
        visits: auxVisits[0] || { s: 0, u: 0, d: 0 },
        visitTrend: (auxTrend || []).reverse(),
        signalMatch: (auxMatch[0] && auxMatch[0].c) || 0,
      },
      note: '数据源：rcj-hub-d1 / mianshi-dazi-d1 / aux-police-exam-d1（均为服务端读取，不含浏览级 CF Analytics）。',
    });
  } catch (e) {
    return json({ error: '聚合失败：' + e.message }, 500);
  }
}
