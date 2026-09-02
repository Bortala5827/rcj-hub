// rcj-lab · AI 调用统一埋点接收端（公开，无需登录）
// POST /api/ai-track  body: {project, scene, provider, status, latency_ms, tokens}
//   → 写入 rcj-analytics-d1.ai_calls（与 visits 同库，统一后台可查）
// 各 AI 端点（ai-chat / gemini 等）在调用完成后异步 fire-and-forget 发到这里，
// 失败静默，不影响主流程。匿名：只存项目/渠道/状态/耗时，不存用户内容、不存 IP。

const PROJECTS = ['fj-sz', 'learn', 'shop', 'api', 'solospeak', 'facetalk', 'other'];
const ANALYTICS_DB = 'b3198ef2-6e7c-424e-8a0f-a7b21afc1828'; // rcj-analytics-d1

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'bad json' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...cors() } });
  }

  const project = (body.project || 'other').trim();
  const safeProject = PROJECTS.includes(project) ? project : 'other';
  const scene = (body.scene || '').trim().slice(0, 64);
  const provider = (body.provider || '').trim().slice(0, 32);
  const status = body.status === 'ok' ? 'ok' : 'fail';
  const latencyMs = Number(body.latency_ms) || 0;
  const tokens = Number(body.tokens) || 0;

  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return new Response(JSON.stringify({ ok: false, error: 'server misconfig' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors() } });
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const createdAt = now.toISOString();

  const esc = (s) => String(s).replace(/'/g, "''");

  try {
    // 幂等建表 + 索引（表已存在时为 no-op）
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
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: ddl }),
      }
    );

    const insertSql = `INSERT INTO ai_calls(project, scene, provider, status, latency_ms, tokens, day, created_at)
      VALUES('${esc(safeProject)}', '${esc(scene)}', '${esc(provider)}', '${status}', ${latencyMs}, ${tokens}, '${day}', '${createdAt}')`;

    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${ANALYTICS_DB}/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: insertSql }),
      }
    );
    const j = await r.json();
    if (!j.success) throw new Error(j.errors?.[0]?.message || 'db error');

    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
  } catch (e) {
    // 埋点失败静默，不影响调用方
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors() } });
  }
}
