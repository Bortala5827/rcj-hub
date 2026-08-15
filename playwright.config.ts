import { defineConfig, devices } from '@playwright/test';

/**
 * RCJ Hub · 标准 Web 自动化测试配置
 * ---------------------------------------------------------------
 * 浏览器策略（关键）：
 *  - 本地（WorkBuddy / 你本机）：使用你已安装的「真实 Google Chrome」
 *    → 通过 channel: "chrome" 调用，绝不下载 Playwright 自带 Chromium。
 *  - CI（GitHub Actions）：无你的本机 Chrome，由 Actions 自行安装
 *    chromium 作为测试环境（CI 环境变量存在时自动切换）。
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const isCI = !!process.env.CI;
const isLocalServer = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
// 本地用本机真实 Chrome；CI 用 Actions 自带 chromium
const useChromeChannel = !isCI;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never', attach: 'on-failure' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    headless: process.env.HEADED ? false : true,
    // 失败自动保存：截图 + Trace + 视频（满足「测试失败自动保存」要求）
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // 音频页（SoloSpeak / LetOut）需要麦克风权限；用假设备避免无麦克风报错
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--no-sandbox',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        ...(useChromeChannel ? { channel: 'chrome' } : {}),
      },
    },
  ],
  // 仅当目标是本地静态服务时才由 Playwright 托管服务器；
  // 测试线上站点（BASE_URL 为 https 域名）时不托管，直接打线上。
  webServer: isLocalServer
    ? {
        command: 'npx http-server -p 4173 -c-1 .',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,
});
