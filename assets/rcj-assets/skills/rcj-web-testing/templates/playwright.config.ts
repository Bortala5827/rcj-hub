import { defineConfig, devices } from '@playwright/test';

/**
 * RCJ 标准 Web 自动化测试配置
 * 浏览器策略：
 *  - 本地：用本机真实 Google Chrome（channel: "chrome"），绝不下载 Playwright Chromium。
 *  - CI：无本机 Chrome，由 Actions 自行装 chromium（CI 环境变量存在时自动切换）。
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const isCI = !!process.env.CI;
const isLocalServer = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
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
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
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
  webServer: isLocalServer
    ? {
        command: 'npx http-server -p 4173 -c-1 .',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,
});
