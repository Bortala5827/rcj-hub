import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { RCJ_HUB_PAGES } from './sites';

/**
 * 无障碍测试（axe-core）
 * 覆盖：button / input / label / heading / link / ARIA / color contrast / duplicate id / 结构
 * 原则：不为了让测试通过而关闭真实问题。有任何违规，测试如实失败并列出详情。
 */

const AXE_PAGES = RCJ_HUB_PAGES.filter((p) => p.path);

test.describe('无障碍合规（axe-core）', () => {
  for (const site of AXE_PAGES) {
    test(`无障碍无违规：${site.name}`, async ({ page }) => {
      await page.goto(site.path!);
      await page.waitForLoadState('networkidle').catch(() => {});

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      if (results.violations.length > 0) {
        const detail = results.violations
          .map((v) => `• [${v.id}] ${v.impact} — ${v.help}\n    ${v.helpUrl}`)
          .join('\n');
        expect(results.violations, `发现无障碍问题:\n${detail}`).toEqual([]);
      } else {
        expect(results.violations).toEqual([]);
      }
    });
  }
});
