// Cloudflare Pages 旧部署自动清理（GitHub Action 版）
// 完整分页，每项目按创建时间保留最新 KEEP 个部署（不限成功/失败状态），
// 永远保护当前线上激活部署(latest_deployment.id)。
// token / 账户 / 保留数均来自环境变量（GitHub Secrets / env），绝不写死。
// 用法(cron 或手动): TOKEN=xxx ACCT=xxx KEEP=3 node cleanup-pages.mjs
const TOKEN = process.env.TOKEN;
const ACCT = process.env.ACCT;
const KEEP = parseInt(process.env.KEEP || '3', 10);
const DRY = process.env.DRY === '1';
const BASE = 'https://api.cloudflare.com/client/v4';

if (!TOKEN || !ACCT) { console.error('缺少 TOKEN / ACCT 环境变量'); process.exit(1); }

async function api(path, opts = {}) {
  let r = await fetch(BASE + path, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) } });
  if (r.status === 429) { await new Promise(s => setTimeout(s, 3000)); r = await fetch(BASE + path, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) } }); }
  const j = await r.json();
  if (!j.success) throw new Error(`${r.status} ${JSON.stringify(j.errors)}`);
  return j;
}

async function allDeployments(name) {
  const out = []; let page = 1;
  while (true) {
    const j = await api(`/accounts/${ACCT}/pages/projects/${name}/deployments?per_page=25&page=${page}`);
    out.push(...j.result);
    if (j.result.length < 25) break;
    page++;
  }
  return out;
}

const sleep = ms => new Promise(s => setTimeout(s, ms));

async function deleteOne(name, id) {
  if (DRY) return;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await api(`/accounts/${ACCT}/pages/projects/${name}/deployments/${id}`, { method: 'DELETE' });
      return;
    } catch (e) {
      if (e.message.includes('429') && attempt < 3) { await sleep(3000); continue; }
      throw e;
    }
  }
}

(async () => {
  const projects = (await api(`/accounts/${ACCT}/pages/projects`)).result;
  console.log(`账户下共 ${projects.length} 个 Pages 项目，每项目按创建时间保留最新 ${KEEP} 个部署（不限状态）${DRY ? '（DRY-RUN 预览，不删除）' : ''}\n`);
  const summary = [];
  for (const p of projects) {
    const activeId = p.latest_deployment ? p.latest_deployment.id : null;
    let deps;
    try { deps = await allDeployments(p.name); } catch (e) { console.error(`✗ ${p.name} 列出失败: ${e.message}`); summary.push([p.name, 'ERR', '-', '-', e.message]); continue; }
    const sorted = deps.slice().sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
    const keepIds = new Set(sorted.slice(0, KEEP).map(d => d.id));
    if (activeId) keepIds.add(activeId);
    const toDelete = sorted.filter(d => !keepIds.has(d.id));
    console.log(`• ${p.name.padEnd(20)} 总部署=${deps.length}  保留=${keepIds.size}  待删=${toDelete.length}`);
    let done = 0;
    for (const d of toDelete) {
      try { await deleteOne(p.name, d.id); done++; if (!DRY && done % 20 === 0) await sleep(500); }
      catch (e) { console.error(`  ✗ 删 ${p.name}/${d.short_id} 失败: ${e.message}`); }
    }
    summary.push([p.name, deps.length, keepIds.size, toDelete.length, DRY ? '(预览)' : `已删 ${done}`]);
  }
  console.log('\n===== 结果汇总 =====');
  console.log('项目'.padEnd(20), '部署数', '保留', '待删', '结果');
  for (const r of summary) console.log(r[0].padEnd(20), String(r[1]).padEnd(6), String(r[2]).padEnd(4), String(r[3]).padEnd(4), r[4]);
})();
