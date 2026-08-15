// 一次性站点核验：用本机真实 Google Chrome 实开页面，截图 + 抓错误
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const OUT = process.env.OUT || '/tmp/rcj-shots';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

// 已知环境依赖（CF 运行时埋点 / 外部域名），不计为页面错误
const KNOWN = ['api/track', '955827.xyz', 'favicon'];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const failedReq = [];

  async function audit(name, viewport, scroll) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (KNOWN.some((k) => t.includes(k))) return;
      errors.push(`[${name}][console] ${t}`);
    });
    page.on('pageerror', (e) => errors.push(`[${name}][pageerror] ${e.message}`));
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (KNOWN.some((k) => u.includes(k))) return;
      failedReq.push(`[${name}][reqfail] ${u} :: ${r.failure() && r.failure().errorText}`);
    });

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => errors.push(`[${name}][goto] ${e.message}`));
    await page.waitForTimeout(1800); // 等入场动画

    // 图片加载检查
    const imgs = await page.evaluate(() => {
      return Array.from(document.images).map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight }));
    });
    const broken = imgs.filter((i) => i.w === 0);

    await page.screenshot({ path: `${OUT}/${name}-top.png` });
    if (scroll) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${name}-mid.png` });
    }
    console.log(`[${name}] images=${imgs.length} broken=${broken.length}`, broken.map((b) => b.src).join(', '));
    await ctx.close();
  }

  await audit('desktop', { width: 1280, height: 800 }, true);
  await audit('mobile', { width: 390, height: 844 }, true);

  await browser.close();
  console.log('\n=== ERRORS (' + errors.length + ') ===');
  errors.forEach((e) => console.log(e));
  console.log('\n=== FAILED REQUESTS (' + failedReq.length + ') ===');
  failedReq.forEach((e) => console.log(e));
  process.exit(errors.length ? 1 : 0);
})();
