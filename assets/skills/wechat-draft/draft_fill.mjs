// draft_fill.mjs — 公众号推文草稿自动填充（Playwright-core + CDP 连接用户 Chrome）
//
// ★★★ 正确运行方式（PowerShell，必须在同一个命令中）★★★
//   Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 5
//   Remove-Item 'C:\Users\小样儿\AppData\Local\Google\Chrome\User Data\Singleton*' -Force -ErrorAction SilentlyContinue
//   Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\小样儿\AppData\Local\Google\Chrome\User Data','--profile-directory=Profile 2','--no-first-run','--no-default-browser-check','about:blank'
//   Start-Sleep 5; & 'C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe' draft_fill.mjs ./draft.md
//
// 关键规则（2026-08-11 验证）：
//   1. Chrome 启动和 Node.js CDP 连接必须在同一个 PowerShell 命令中，否则 Chrome 可能在中间退出
//   2. CDP URL 用 127.0.0.1，不能用 localhost（IPv6 问题）
//   3. Chrome 必须完全关闭后再启动带调试端口的实例
//   4. Profile 2 是有微信公众号登录态的 Chrome Profile
//   5. 编辑器页面可能显示"请重新登录"，需要检查登录态

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/小样儿/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
import fs from 'node:fs';
import path from 'node:path';

// ═══ 配置 ═══
const CDP_URL    = 'http://127.0.0.1:9222';  // 必须 127.0.0.1
const EDITOR_URL = 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0';
const MP_HOME    = 'https://mp.weixin.qq.com/';
const OUT        = 'draft_report';

// ═══ Markdown → HTML ═══
function md2html(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const html = [];
  let inCode = false, codeBuf = [];
  const flushCode = () => {
    if (codeBuf.length) { html.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`); codeBuf = []; }
  };
  for (const L of lines) {
    const t = L.trim();
    if (t.startsWith('```')) { if (inCode) { inCode = false; flushCode(); } else { flushCode(); inCode = true; } continue; }
    if (inCode) { codeBuf.push(L); continue; }
    if (!t) { if (html.length && html[html.length - 1] !== '<p></p>') html.push('<p></p>'); continue; }
    let inline = esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    if (/^#{1,4}\s/.test(t)) { const lv = t.match(/^#+/)[0].length; html.push(`<h${lv}>${inline.replace(/^#+\s/, '')}</h${lv}>`); }
    else if (/^[-*]\s/.test(t)) { html.push(`<li>${inline.replace(/^[-*]\s/, '')}</li>`); }
    else if (/^>\s?/.test(t)) { html.push(`<blockquote>${inline.replace(/^>\s?/, '')}</blockquote>`); }
    else if (/^!\[[^\]]*\]/.test(t)) { html.push(`<p style="color:#8a919f;background:#f5f6f7;padding:14px;border-radius:8px;text-align:center;">🖼 ${inline.replace(/^!\[([^\]]*)\]\([^)]*\)/, '$1')}（配图：需在后台手动插入）</p>`); }
    else { html.push(`<p>${inline}</p>`); }
  }
  flushCode();
  return html.join('\n');
}

function parseDraft(file) {
  const md = fs.readFileSync(file, 'utf-8');
  const title = (md.match(/^#\s*(.+)$/m) || [])[1]?.trim() || '';
  const author = (md.match(/^作者[:：]\s*(.+)$/m) || [])[1]?.trim() || 'RCJ9527';
  const bodyMd = md.replace(/^#\s*.+$/m, '').replace(/^作者[:：].+$/m, '');
  return { title, author, bodyHtml: md2html(bodyMd), bodyLen: bodyMd.replace(/\s+/g, '').length };
}

// ═══ 主流程 ═══
const draftFile = process.argv[2] || 'draft.md';
if (!fs.existsSync(draftFile)) { console.error('❌ 找不到草稿文件:', draftFile, '\n   用法: node draft_fill.mjs ./draft.md'); process.exit(1); }
const { title, author, bodyHtml, bodyLen } = parseDraft(draftFile);
if (!title) { console.error('❌ 草稿缺少一级标题'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

console.log('┌─ 推文草稿自动填充（CDP 模式）──');
console.log(`│ 标题: ${title}（${title.length} 字）`);
console.log(`│ 作者: ${author}`);
console.log(`│ 正文: ${bodyLen} 字`);
console.log('└────────────────────────────');

// CDP 连接
console.log('\n[CDP] 连接 Chrome…');
const browser = await chromium.connectOverCDP(CDP_URL);
const ctx = browser.contexts()[0] || await browser.newContext();
const page = ctx.pages()[0] || await ctx.newPage();
console.log('✅ CDP 连接成功');

// 先访问首页提取 token（关键：编辑器 URL 必须带 token 参数）
console.log('\n[1/5] 提取 token 并检查登录态…');
await page.goto(MP_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);

const homeUrl = page.url();
const tokenMatch = homeUrl.match(/token=(\d+)/);
const token = tokenMatch ? tokenMatch[1] : '';

// 检查是否在登录页
const isLoginPage = await page.evaluate(() => {
  return /cgi-bin\/loginpage/.test(location.href) || /扫码/.test(document.body?.innerText || '');
});

if (isLoginPage || !token) {
  console.log('⚠️ 未登录或无法提取 token！请手动在 Chrome 中扫码登录微信公众号，然后重新运行此脚本');
  process.exit(1);
}
console.log(`  ✅ 已登录，token: ${token}`);

// 构建带 token 的编辑器 URL
const EDITOR_URL_WITH_TOKEN = `${EDITOR_URL}&token=${token}`;
await page.goto(EDITOR_URL_WITH_TOKEN, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const loginCheck = await page.evaluate(() => {
  const body = document.body?.innerText || '';
  const hasTitle = !!document.querySelector('#title, input[placeholder*="标题"]');
  const hasEditor = !!document.querySelector('.ProseMirror, [contenteditable="true"]');
  const isRelogin = body.includes('请重新登录') || body.includes('登录已过期');
  return { ready: !isRelogin && (hasTitle || hasEditor), isRelogin, body: body.slice(0, 200) };
});

if (loginCheck.isRelogin || !loginCheck.ready) {
  console.log('⚠️ 编辑器登录态过期！页面内容:', loginCheck.body);
  console.log('请手动在 Chrome 中扫码登录微信公众号，然后重新运行此脚本');
  process.exit(1);
}
console.log('✅ 编辑器登录态正常');

// 填标题 / 作者
console.log('[2/5] 填标题/作者…');
const titleInput = page.locator('#title').first();
if (await titleInput.isVisible().catch(() => false)) {
  await titleInput.fill(title);
  console.log('  ✅ 标题已填');
} else {
  console.warn('  ⚠️ 未找到标题输入框，请检查 03_editor.png');
}
const authorInput = page.locator('#author').first();
if (await authorInput.isVisible().catch(() => false)) {
  await authorInput.fill(author);
  console.log('  ✅ 作者已填:', author);
}

// 填正文
console.log('[3/5] 填充正文…');
const editorSel = '.ProseMirror, #js_editor, [contenteditable="true"]';
const editor = page.locator(editorSel).first();
if (await editor.isVisible().catch(() => false)) {
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mp.weixin.qq.com' }).catch(() => {});
  const plain = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  await page.evaluate(async ({ html, plain }) => {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
  }, { html: bodyHtml, plain });
  await editor.click();
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '04_body_filled.png') });
  const filled = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    return el ? el.innerText.trim().length : 0;
  }, editorSel);
  console.log(`  ✅ 正文已粘贴，编辑器内 ${filled} 字符`);
} else {
  console.warn('  ⚠️ 未找到正文编辑器');
}

// 保存草稿
console.log('[4/5] 保存为草稿…');
let saved = false;
try {
  const saveBtn = page.getByText('保存为草稿', { exact: false }).first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(3500);
    saved = true;
  }
} catch (_) {}
if (!saved) {
  saved = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, .weui-desktop-btn, [role="button"]')];
    const t = btns.find(b => /草稿/.test(b.innerText || ''));
    if (t) { t.click(); return true; }
    return false;
  });
  if (saved) await page.waitForTimeout(3500);
}
await page.screenshot({ path: path.join(OUT, '05_saved.png') });
console.log(`  ${saved ? '✅ 已保存草稿' : '⚠️ 未找到保存按钮，请人工保存'}`);

console.log('\n[5/5] 完成 ✔');
console.log('校验截图目录:', path.resolve(OUT));
console.log('下一步：公众号后台 → 草稿箱 → 审核正文 → 补封面/配图 → 手动群发');
