/**
 * Lighthouse CI 配置
 * 检查：Performance / Accessibility / Best Practices / SEO。
 * 浏览器：本地用本机真实 Google Chrome；CI 用 setup-chrome 安装的 Chrome。
 * 第一阶段用「warn」阈值：发现真实低分项并报警，但不阻断构建（不为了 100 分改产品）。
 * 服务器：由外部（scripts/lhci-serve.mjs）先启动静态服务，本配置只指向其 URL，
 *   不自行托管 —— 避免 LHCI 失败时遗留僵尸进程占用端口。
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
      target: 'filesystem',
      outputDir: './lighthouse-report',
    },
  },
};
