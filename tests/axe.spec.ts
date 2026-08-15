import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { RCJ_HUB_PAGES } from './sites';

/**
 * 无障碍测试（axe-core）
 * ---------------------------------------------------------------
 * 覆盖：button / input / label / heading / link / ARIA /
 *       color contrast / duplicate id / 页面结构。
 * 重点页面：首页 + 核心功能页（资产库）+ 主要表单/音频页（SoloSpeak / LetOut）。
 *
 * 原则：不为了让测试通过而关闭真实问题。有任何违规，测试如实失败并列出详情。
 * 若运行后发现真实可改进项，回到产品代码修复，而不是在规则里 exclude。
 */

// 仅 rcj-hub 本地承载的页面参与（不含线上子站）
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
        // 失败信息里带完整违规清单，便于定位修复
        expect(results.violations, `发现无障碍问题:\n${detail}`).toEqual([]);
      } else {
        expect(results.violations).toEqual([]);
      }
    });
  }
});
