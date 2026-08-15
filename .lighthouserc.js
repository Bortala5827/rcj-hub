/**
 * Lighthouse CI 配置（RCJ Hub）
 * ---------------------------------------------------------------
 * 检查：Performance / Accessibility / Best Practices / SEO。
 * 当前主站非完整 PWA（无 manifest + SW），故不加入 PWA 断言。
 *
 * 浏览器：本地用本机真实 Google Chrome；CI 用 setup-chrome 安装的 Chrome。
 *   - chromePath：默认读取 CHROME_PATH 环境变量；未设置时由 Lighthouse 自动探测系统 Chrome。
 *   - 第一阶段用「warn」阈值：发现真实低分项并报警，但不阻断构建（不为了 100 分改产品）。
 *
 * 服务器：由外部（本地或 CI 脚本）先启动静态服务，本配置只指向其 URL，
 *   不自行托管 —— 避免 LHCI 失败时遗留僵尸进程占用端口。
 *   本地：先 `npm run serve` 或 `npx http-server -p 4200 -c-1 .`，再 `npm run lighthouse`。
 *
 * 本地运行：npm run lighthouse
 * CI 运行：gh Actions 的 "Lighthouse CI" 步骤（npx lhci autorun）
 */
const BASE = process.env.LH_BASE_URL || 'http://localhost:4200';

module.exports = {
  ci: {
    collect: {
      url: [`${BASE}/`, `${BASE}/assets.html`],
      chromePath: process.env.CHROME_PATH || undefined,
      puppeteerLaunchOptions: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      },
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      // 不接 LHCI 服务器，报告保存到本地目录供下载查看
      target: 'filesystem',
      outputDir: './lighthouse-report',
    },
  },
};
