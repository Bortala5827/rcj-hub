// screenshot.js — 批量网页截图（Playwright-core + 系统 Chrome）
// 用法:
//   node screenshot.js                    # 默认 4 个 RCJ 产品 → ./screenshots/
//   node screenshot.js ./my-shots.mjs     # 自定义配置（shots + outDir）
// 依赖: 复用全局 @playwright/cli 的 playwright-core；系统 Google Chrome。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/小样儿/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core');
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const DEFAULT_SHOTS = [
  { url: 'https://955827.xyz/',           name: 'rcj-hub.png',     desc: 'RCJ Hub 总览站' },
  { url: 'https://955827.xyz/solospeak/', name: 'solospeak.png',   desc: 'SoloSpeak 独声练习' },
  { url: 'https://955827.xyz/letout/',    name: 'letout.png',      desc: 'LetOut 情绪出口' },
  { url: 'https://facetalk.955827.xyz/',        name: 'facetalk.png',    desc: 'FaceTalk 面试搭子' },
];

let shots = DEFAULT_SHOTS;
let outDir = 'screenshots';
if (process.argv[2]) {
  const mod = await import(pathToFileURL(path.resolve(process.argv[2])).href);
  const cfg = mod.default || mod;
  if (cfg.shots) shots = cfg.shots;
  if (cfg.outDir) outDir = cfg.outDir;
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport || { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  try {
    await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200); // 等 SPA/图片渲染
    const fp = path.join(outDir, s.name);
    await page.screenshot({ path: fp, fullPage: !!s.fullPage });
    console.log(`✅ ${s.name}  ← ${s.url}（${s.desc || ''}）`);
    results.push(fp);
  } catch (e) {
    console.error(`❌ ${s.name} ${s.url}: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close().catch(() => {});
console.log(`\n完成 ${results.length}/${shots.length} 张，输出目录: ${path.resolve(outDir)}`);
