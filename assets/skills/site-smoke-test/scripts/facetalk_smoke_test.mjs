// facetalk_smoke_test.mjs — FaceTalk 面试搭子（facetalk.955827.xyz）冒烟测试
// 复用 @playwright/cli 自带的 playwright-core + 已装 chromium，无需额外安装。
//
// 运行（Windows）：
//   cd C:/Users/小样儿/WorkBuddy/2026-08-07-18-42-35
//   C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe facetalk_smoke_test.mjs
//
// 测试项：
//   1) 页面加载无控制台报错 / 页面异常
//   2) 标题含「面试搭子」、正文渲染（含关键词、正文长度达标）
//   3) 初始可见元素：发个意图标题、发布意图按钮、城市/会议链接输入
//   4) 点击「发布意图」展开表单后，校验岗位选项 / 模式切换 / 一句话输入是否渲染
//   5) 交互 A：空表单提交 → 应优雅校验（不崩、不抛未捕获异常）
//   6) 交互 B：选岗位+填城市后提交 → 观察跳转/成功/报错
//   7) 桌面(1280x800) + 移动(390x844) 截图

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/小样儿/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://facetalk.955827.xyz';
const TITLE_KW = '面试搭子';
const BODY_KW = '面试搭子';
const MIN_BODY = 400;
const OUT = 'facetalk_smoke_report';
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 在页面中统计「可见文案」命中数（输入框/textarea 的 placeholder/value 也算）
async function countVisibleText(page, kw) {
  return page.evaluate(k => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let c = 0;
    while (walker.nextNode()) {
      const t = walker.currentNode;
      if (t.nodeValue && t.nodeValue.includes(k)) {
        const el = t.parentElement;
        const isInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
        if (isInput) { c++; continue; }
        // 可见性：自身或任一祖先 offsetParent 非 null
        let p = el, vis = false;
        while (p && p !== document.body) {
          if (p.offsetParent !== null) { vis = true; break; }
          p = p.parentElement;
        }
        if (vis || el.offsetParent !== null) c++;
      }
    }
    return c;
  }, kw);
}

async function main() {
  const exe = findChrome();
  console.log('chromium:', exe || '(default)');
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  const errors = [];
  const result = { url: BASE, status: '?', title: '', bodyLen: 0, hasKw: null,
    elementsInitial: {}, elementsForm: {}, interactions: {}, errors, shots: {}, note: '' };

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.split('\n')[0]));

  let loadOk = true;
  try {
    const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    result.status = resp ? resp.status() : '?';
    await page.waitForTimeout(2500);
    result.title = await page.title();
    result.bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
    result.hasKw = await page.evaluate(kw => document.body.innerText.includes(kw), BODY_KW);
    await page.screenshot({ path: path.join(OUT, 'shots', 'desktop.png') });
    result.shots.desktop = 'shots/desktop.png';
  } catch (e) {
    loadOk = false;
    result.status = 'FAIL: ' + e.message.split('\n')[0];
  }

  if (loadOk) {
    // —— 初始可见元素 ——
    const initialChecks = {
      '发个意图标题': '发个意图',
      '发布意图按钮': '发布意图',
      '城市输入': '城市',
      '会议链接输入': '会议链接',
    };
    for (const [label, kw] of Object.entries(initialChecks)) {
      result.elementsInitial[label] = (await countVisibleText(page, kw)) > 0;
    }

    // —— 交互 A：空表单点「发布意图」（同时展开表单）——
    try {
      const before = errors.length;
      const btn = page.getByRole('button', { name: /发布意图/ }).first();
      await btn.click({ timeout: 5000 });
      await sleep(1200);
      const afterErr = errors.length - before;
      const bodyNow = await page.evaluate(() => document.body.innerText.slice(0, 400));
      const validationHit = /(请|必填|选择|填写|不能为空|invalid|required)/i.test(bodyNow);
      result.interactions.emptySubmit = {
        newConsoleErrors: afterErr,
        validationHintShown: validationHit,
        note: afterErr === 0 ? '空提交未引发控制台报错（优雅）' : `空提交产生 ${afterErr} 条控制台报错`,
        bodySnippet: bodyNow.replace(/\s+/g, ' ').slice(0, 160),
      };
    } catch (e) {
      result.interactions.emptySubmit = { error: e.message.split('\n')[0] };
    }

    // —— 展开表单后，校验岗位/模式/一句话 ——
    const formChecks = {
      '岗位-公务员': '公务员',
      '岗位-辅警': '辅警',
      '岗位-消防': '消防',
      '岗位-书记员': '书记员',
      '岗位-社区工作者': '社区工作者',
      '岗位-三支一扶': '三支一扶',
      '岗位-其他': '其他',
      '模式-语音优先': '语音优先',
      '模式-视频': '视频',
      '一句话输入': '一句话',
    };
    for (const [label, kw] of Object.entries(formChecks)) {
      result.elementsForm[label] = (await countVisibleText(page, kw)) > 0;
    }

    // —— 交互 B：选岗位(辅警)+填城市 → 发布意图 ——
    try {
      const before = errors.length;
      const postCard = page.locator('label, div, button, span').filter({ hasText: /辅警/ }).first();
      await postCard.click({ timeout: 5000 }).catch(() => {});
      const inp = page.locator('input').first();
      await inp.fill('深圳', { timeout: 5000 }).catch(() => {});
      const btn = page.getByRole('button', { name: /发布意图/ }).first();
      await btn.click({ timeout: 5000 });
      await sleep(1800);
      const urlAfter = page.url();
      const afterErr = errors.length - before;
      const bodyNow = await page.evaluate(() => document.body.innerText.slice(0, 500));
      result.interactions.fillSubmit = {
        urlAfter,
        navigated: urlAfter.replace(/\/+$/, '') !== BASE.replace(/\/+$/, ''),
        newConsoleErrors: afterErr,
        bodySnippet: bodyNow.replace(/\s+/g, ' ').slice(0, 200),
        note: afterErr === 0 ? '填充提交未引发控制台报错' : `填充提交产生 ${afterErr} 条控制台报错`,
      };
    } catch (e) {
      result.interactions.fillSubmit = { error: e.message.split('\n')[0] };
    }
  }

  // —— 移动端截图 ——
  try {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mpage = await mctx.newPage();
    await mpage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);
    await mpage.screenshot({ path: path.join(OUT, 'shots', 'mobile.png') });
    result.shots.mobile = 'shots/mobile.png';
    await mctx.close();
  } catch (e) {
    result.note += ' 移动端截图失败：' + e.message.split('\n')[0];
  }

  await ctx.close();

  // —— 健康度判定 ——
  let overall;
  if (!loadOk) overall = { icon: '🔴', tag: '访问失败' };
  else if (errors.length > 0) overall = { icon: '🔴', tag: '控制台报错' };
  else if (!result.hasKw) overall = { icon: '🟡', tag: `缺关键词「${BODY_KW}」` };
  else if (result.bodyLen < MIN_BODY) overall = { icon: '🟡', tag: `正文偏短(${result.bodyLen}<${MIN_BODY})` };
  else overall = { icon: '✅', tag: '正常' };

  // —— 报告 ——
  const now = new Date().toLocaleString('zh-CN');
  let md = `# FaceTalk 面试搭子 冒烟测试报告\n\n`;
  md += `生成时间：${now}  \n测试域名：${BASE}  \n\n`;
  md += `## 总评\n\n**${overall.icon} ${overall.tag}**\n\n`;
  md += `- HTTP 状态：${result.status}\n`;
  md += `- 页面标题：\`${result.title}\`\n`;
  md += `- 正文长度：${result.bodyLen}（阈值 ${MIN_BODY}）\n`;
  md += `- 关键词「${BODY_KW}」：${result.hasKw ? '✅ 命中' : '❓ 未命中'}\n`;
  md += `- 控制台/页面错误：${errors.length} 条\n`;
  md += `- 截图：[桌面](shots/desktop.png) / [移动](shots/mobile.png)\n\n`;

  md += `## 关键元素存在性\n\n`;
  md += `### 初始加载即可见\n\n| 元素 | 存在 |\n|---|---|\n`;
  for (const [label, present] of Object.entries(result.elementsInitial)) {
    md += `| ${label} | ${present ? '✅' : '❓ 未找到'} |\n`;
  }
  md += `\n### 点击「发布意图」展开表单后\n\n| 元素 | 存在 |\n|---|---|\n`;
  for (const [label, present] of Object.entries(result.elementsForm)) {
    md += `| ${label} | ${present ? '✅' : '❓ 未找到'} |\n`;
  }
  md += `\n> 说明：岗位/模式/一句话 等选项为渐进式显示，需点击「发布意图」展开表单后才渲染，故分两阶段校验。\n\n`;

  md += `## 交互测试\n\n`;
  md += `### A. 空表单提交「发布意图」\n`;
  if (result.interactions.emptySubmit?.error) {
    md += `- ❌ 交互异常：${result.interactions.emptySubmit.error}\n`;
  } else {
    const s = result.interactions.emptySubmit;
    md += `- 新增控制台错误：${s.newConsoleErrors}\n`;
    md += `- 是否出现校验提示：${s.validationHintShown ? '✅ 是' : '⚠️ 未见明显提示'}\n`;
    md += `- 说明：${s.note}\n`;
    if (s.bodySnippet) md += `- 提交后正文片段：\`${s.bodySnippet}\`\n`;
  }
  md += `\n### B. 选岗位+填城市后提交\n`;
  if (result.interactions.fillSubmit?.error) {
    md += `- ❌ 交互异常：${result.interactions.fillSubmit.error}\n`;
  } else {
    const s = result.interactions.fillSubmit;
    md += `- 是否跳转：${s.navigated ? `✅ → ${s.urlAfter}` : '否（停留在原页）'}\n`;
    md += `- 新增控制台错误：${s.newConsoleErrors}\n`;
    md += `- 说明：${s.note}\n`;
    if (s.bodySnippet) md += `- 提交后正文片段：\`${s.bodySnippet}\`\n`;
  }
  md += `\n`;

  if (errors.length) {
    md += `## 控制台/页面错误明细\n\n`;
    for (const e of errors.slice(0, 20)) md += `- \`${e}\`\n`;
  } else {
    md += `## 控制台\n\n无错误 ✅\n`;
  }

  fs.writeFileSync(path.join(OUT, 'report.md'), md, 'utf-8');
  console.log(`\n总评：${overall.icon} ${overall.tag} | HTTP ${result.status} | errors=${errors.length} | bodyLen=${result.bodyLen}`);
  console.log(`报告：${path.join(OUT, 'report.md')}`);
  console.log(`截图：${path.join(OUT, 'shots')}`);

  try { await browser.close(); } catch (e) { console.warn('browser.close 警告（报告已生成）'); }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
