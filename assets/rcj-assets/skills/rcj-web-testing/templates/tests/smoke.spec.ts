import { test, expect, type Page } from '@playwright/test';
import {
  RCJ_HUB_PAGES,
  ECOSYSTEM_LIVE,
  INCLUDE_ECOSYSTEM,
  KNOWN_RUNTIME_PATHS,
  type SitePage,
} from './sites';

/** 挂载控制台 / 网络监听，收集真实错误（不静默忽略） */
function attachListeners(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: { url: string; status?: number; error?: string }[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location();
    const url = (loc && loc.url) || '';
    if (KNOWN_RUNTIME_PATHS.some((p) => url.includes(p))) return; // 标记但不算失败
    consoleErrors.push(`[console.error] ${msg.text()}  (${url})`);
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[uncaught exception] ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (KNOWN_RUNTIME_PATHS.some((p) => u.includes(p))) return;
    failedRequests.push({ url: u, error: req.failure()?.errorText ?? 'requestfailed' });
  });
  page.on('response', (res) => {
    const u = res.url();
    if (res.status() >= 400 && !KNOWN_RUNTIME_PATHS.some((p) => u.includes(p))) {
      failedRequests.push({ url: u, status: res.status() });
    }
  });

  return { consoleErrors, failedRequests };
}

function fullUrl(site: SitePage): string {
  return site.url ?? site.path!;
}

test.describe('主站 + 子路径 · 页面 / 控制台 / 网络', () => {
  for (const site of RCJ_HUB_PAGES) {
    test(`页面正常打开且无错误：${site.name}`, async ({ page }) => {
      const { consoleErrors, failedRequests } = attachListeners(page);

      const res = await page.goto(fullUrl(site), { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `${site.name} HTTP 状态应 < 400`).toBeLessThan(400);

      const title = await page.title();
      expect(title.trim().length, `${site.name} 的 <title> 不应为空`).toBeGreaterThan(0);

      const bodyText = (await page.locator('body').innerText()).trim();
      expect(bodyText.length, `${site.name} 主体应有可见内容`).toBeGreaterThan(20);

      await page.waitForLoadState('networkidle').catch(() => {});

      expect(consoleErrors, `JS 控制台错误:\n${consoleErrors.join('\n')}`).toEqual([]);
      const failSummary = failedRequests
        .map((f) => `${f.url} ${f.status ?? ''} ${f.error ?? ''}`)
        .join('\n');
      expect(failedRequests, `资源 / 请求加载失败:\n${failSummary}`).toEqual([]);
    });
  }

  test('主导航与内部链接可达', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) =>
        as
          .map((a) => (a as HTMLAnchorElement).getAttribute('href') || '')
          .filter(
            (h) =>
              h &&
              !h.startsWith('http') &&
              !h.startsWith('//') &&
              !h.startsWith('#') &&
              !h.startsWith('mailto:') &&
              !h.startsWith('javascript:'),
          ),
      );
    const unique = Array.from(new Set(hrefs)).slice(0, 15);
    expect(unique.length, '首页应至少存在一个内部导航链接').toBeGreaterThan(0);

    for (const href of unique) {
      const target = href.startsWith('/') ? href : `/${href}`;
      const r = await page.request.get(target);
      expect(r.status(), `内部链接 ${target} 应可访问`).toBeLessThan(400);
    }
  });

  test('子路径可达且刷新后保持一致', async ({ page }) => {
    for (const sub of ['/solospeak/', '/letout/', '/training/']) {
      const r = await page.goto(sub, { waitUntil: 'domcontentloaded' });
      expect(r?.status(), `${sub} 应可访问`).toBeLessThan(400);
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(page.url()).toContain(sub.replace(/\/$/, ''));
    }
  });
});

test.describe('功能 · 音频能力（SoloSpeak / LetOut）', () => {
  for (const site of RCJ_HUB_PAGES.filter((s) => s.hasAudio)) {
    test(`可在授权下获取麦克风音频轨道：${site.name}`, async ({ page }) => {
      await page.goto(fullUrl(site));
      const ok = await page.evaluate(async () => {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          return true;
        } catch {
          return false;
        }
      });
      expect(ok, `${site.name} 应能获取麦克风（用假设备，不应报错）`).toBe(true);
    });
  }
});

const ecosystemDescribe = INCLUDE_ECOSYSTEM ? test.describe : test.describe.skip;
ecosystemDescribe('生态子站 · Live Smoke（TEST_LIVE_ECOSYSTEM=1 时启用）', () => {
  for (const site of ECOSYSTEM_LIVE) {
    test(`子站可访问：${site.name}`, async ({ request }) => {
      const r = await request.get(site.url!);
      expect(r.status(), `${site.name} 应可访问`).toBeLessThan(400);
    });
  }
});
