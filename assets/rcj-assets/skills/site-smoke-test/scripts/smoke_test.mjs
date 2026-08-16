// smoke_test.mjs — 通用网站冒烟测试引擎（Playwright-core，复用已装 Chromium）
//
// 用途：遍历多路径/多城市页面，抓控制台报错/页面异常、检查 SPA 渲染、桌面+移动端截图，
//       输出 Markdown 报告。每次改代码前跑一遍，本地拦 bug。
//
// 运行（Windows Git Bash）：
//   C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe smoke_test.m.js
//
// 配置：编辑下方 BASE / PAGES / AI_BTN_SELECTOR 即可。
// 维护：没精力搞真题的城市设 built:false，题库就绪改 true 即纳入测试。

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/小样儿/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
import fs from 'node:fs';
import path from 'node:path';

// ════════════════════════════════════════════════════════════
// ★ 配置区 —— 只需改这里 ★
// ════════════════════════════════════════════════════════════

const BASE = 'https://fj.rcj9527.dpdns.org'; // 被测域名

// path: 路由段（''=根 Hub）；name: 报告显示名；expectKw: 正文应含关键词；
// hub: 是否为总入口（正文偏短属正常）；minBody: 视为正常的最小正文长度；built: false=暂不测
const PAGES = [
  { path: '',     name: 'RCJ 华南 Hub（总入口）', expectKw: '辅警',            hub: true,  minBody: 100,  built: true },
  { path: 'sz',   name: '深圳',                  expectKw: '深圳',            hub: false, minBody: 5000, built: true },
  { path: 'hz',   name: '惠州',                  expectKw: '惠州',            hub: false, minBody: 5000, built: true },
  { path: 'gd',   name: '广东省统考',            expectKw: '广东',            hub: false, minBody: 5000, built: true },
  { path: 'ms',   name: '辅警结构化面试专区',    expectKw: '面试',            hub: false, minBody: 5000, built: true },
  // —— 以下未建（没精力搞真题，待题库就绪改 built:true 即可）——
  // { path: 'cd',   name: '成都',   expectKw: '成都', hub: false, minBody: 5000, built: false },
  // { path: 'wh',   name: '武汉',   expectKw: '武汉', hub: false, minBody: 5000, built: false },
  // { path: 'hb',   name: '淮北',   expectKw: '淮北', hub: false, minBody: 5000, built: false },
  // { path: 'hz02', name: '湖州',   expectKw: '湖州', hub: false, minBody: 5000, built: false },
];

const AI_BTN_SELECTOR = '#examAiAnalyzeBtn'; // 可选：特定按钮存在性检查（无则跳过）
const OUT = 'smoke_report';                  // 输出目录

// ════════════════════════════════════════════════════════════
// ★ 引擎（一般不用改）★
// ════════════════════════════════════════════════════════════

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

function findChrome() {
  const root = 'C:/Users/小样儿/AppData/Local/ms-playwright';
  if (!fs.existsSync(root)) return undefined;
  const candidates = [
    'chromium-1228/chrome-win64/chrome.exe',
    'chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe',
  ];
  for (const rel of candidates) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) return p;
  }
  for (const d of fs.readdirSync(root)) {
    for (const name of ['chrome.exe', 'chrome-headless-shell.exe']) {
      const p = path.join(root, d, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

async function testPage(browser, pg) {
  const url = pg.path ? `${BASE}/${pg.path}/` : `${BASE}/`;
  const errors = [];
  const r = {
    path: pg.path || '(root)', name: pg.name, expectKw: pg.expectKw, url,
    status: 'OK', title: '', bodyLen: 0, hasKw: null, aiBtn: false, errors, note: '',
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.split('\n')[0]));
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    r.status = resp ? resp.status() : '?';
    await page.waitForTimeout(2000); // 等 SPA 拉数据渲染
    r.title = await page.title();
    r.bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
    r.hasKw = await page.evaluate(kw => document.body.innerText.includes(kw), pg.expectKw);
    if (AI_BTN_SELECTOR) r.aiBtn = await page.evaluate(sel => !!document.querySelector(sel), AI_BTN_SELECTOR);
    await page.screenshot({ path: path.join(OUT, 'shots', `${pg.path || 'root'}_desktop.png`) });
  } catch (e) {
    r.status = 'FAIL: ' + e.message.split('\n')[0];
  }
  try {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mpage = await mctx.newPage();
    await mpage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mpage.waitForTimeout(1500);
    await mpage.screenshot({ path: path.join(OUT, 'shots', `${pg.path || 'root'}_mobile.png`) });
    await mctx.close();
  } catch (_) { /* 移动端截图失败不影响主结果 */ }
  await ctx.close();
  return r;
}

function health(r, pg) {
  if (String(r.status).startsWith('FAIL')) return { icon: '🔴', tag: '访问失败' };
  if (r.errors.length > 0) return { icon: '🔴', tag: '控制台报错' };
  if (!pg.hub && r.bodyLen < pg.minBody) return { icon: '🟡', tag: `正文偏短(${r.bodyLen}<${pg.minBody})` };
  if (!pg.hub && !r.hasKw) return { icon: '🟡', tag: `缺关键词「${r.expectKw}」` };
  return { icon: '✅', tag: '正常' };
}

// ════════════════════════════════════════════════════════════
// ★ 执行 ★
// ════════════════════════════════════════════════════════════

const exe = findChrome();
console.log('chromium:', exe || '(default)');
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

const active = PAGES.filter(p => p.built);
const planned = PAGES.filter(p => !p.built);
const results = [];
for (const pg of active) {
  process.stdout.write(`testing /${pg.path || '(root)'} ... `);
  const r = await testPage(browser, pg);
  const h = health(r, pg);
  console.log(`${h.icon} ${h.tag} | errors=${r.errors.length} bodyLen=${r.bodyLen}`);
  results.push(r);
}

// 报告（先写，避免 close 抛错导致数据丢失）
const now = new Date().toLocaleString('zh-CN');
let md = `# 冒烟测试报告\n\n`;
md += `生成时间：${now}  \n测试域名：${BASE}  \n测试页面：${active.length} 个（${active.map(p => p.name).join('、')}）  \n\n`;

md += `## 汇总\n\n`;
md += `| 路径 | 名称 | 健康 | HTTP | 控制台错误 | 正文长度 | 含关键词 | 截图 |\n`;
md += `|---|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const pg = active.find(p => (p.path || '') === (r.path === '(root)' ? '' : r.path));
  const h = health(r, pg || {});
  const dp = r.path === '(root)' ? '/' : '/'+r.path+'/';
  md += `| ${dp} | ${r.name} | ${h.icon} ${h.tag} | ${r.status} | ${r.errors.length} | ${r.bodyLen} | ${r.hasKw ? '✅' : '❓'} | [桌面](shots/${r.path === '(root)' ? 'root' : r.path}_desktop.png) / [移动](shots/${r.path === '(root)' ? 'root' : r.path}_mobile.png) |\n`;
}
if (planned.length) {
  md += `\n> 📝 未纳入测试（暂未建页面）：` + planned.map(p => `/${p.path}/`).join('、') + `\n`;
}
md += `\n## 详情\n\n`;
for (const r of results) {
  const pg = active.find(p => (p.path || '') === (r.path === '(root)' ? '' : r.path));
  const h = health(r, pg || {});
  const dp = r.path === '(root)' ? '/' : '/'+r.path+'/';
  md += `### ${dp}  (${r.name})\n`;
  md += `- 状态：${h.icon} ${h.tag}　HTTP：${r.status}　正文长度：${r.bodyLen}\n`;
  md += `- 标题：\`${r.title}\`\n`;
  md += `- 关键词「${r.expectKw}」：${r.hasKw ? '✅ 命中' : '❓ 未命中'}\n`;
  if (AI_BTN_SELECTOR) md += `- 按钮(${AI_BTN_SELECTOR})：${r.aiBtn ? '✅ 存在' : '— 未出现'}\n`;
  if (r.errors.length) {
    md += `- ❌ 控制台/页面错误（${r.errors.length}）：\n`;
    for (const e of r.errors.slice(0, 10)) md += `  - \`${e}\`\n`;
  } else {
    md += `- 控制台：无错误 ✅\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(OUT, 'report.md'), md, 'utf-8');
console.log(`\n报告已生成：${path.join(OUT, 'report.md')}`);
console.log(`截图目录：${path.join(OUT, 'shots')}`);

try { await browser.close(); } catch (e) { console.warn('browser.close 警告（报告已生成）：', e.message.split('\n')[0]); }
