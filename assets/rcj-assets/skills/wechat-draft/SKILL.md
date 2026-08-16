---
title: wechat-draft
summary: 公众号推文草稿流水线——AI 按模板产内容，Playwright 驱动本地 Chrome 自动填公众号草稿（标题/作者/正文），分步截图校验，只存草稿绝不群发
read_when:
  - 写公众号推文草稿
  - 生成公众号推文内容
  - 自动填充公众号后台草稿
---

# wechat-draft — 公众号推文草稿流水线

## 何时用

- 要写公众号推文（贴图 ≤800 字 / 深度长文 1500–2500 字）并填进后台草稿箱
- 需要「AI 写内容 + 本地浏览器自动填草稿」的完整流水线

## 组成

| 文件 | 作用 |
|---|---|
| `content-schema.json` | **meta.json 数据 Schema**（标准流水线入口）：标题/作者/摘要/封面/分节/配图/截图配置 |
| `build.js` | 从 meta.json 渲染推文 HTML（AI 只写数据，脚本做渲染——省 token 架构） |
| `draft_fill.mjs` | Playwright 脚本：持久登录 → 新建图文 → 填标题/作者 → Markdown→HTML 粘贴 → 截图校验 → 存草稿 |
| `content-template.md` | 内容模板：标题公式、正文结构、字数规则、配图占位、合规清单 |
| `SOP.md` | 完整流程与角色分工 |

## 用法（两条路径）

### 快速路径：draft.md

1. 按 `content-template.md` 产出 `draft.md`
2. `node draft_fill.mjs ./draft.md`（首次弹 Chrome 扫码一次，之后登录态复用）
3. 脚本自动：新建图文 → 填标题/作者 → Markdown→HTML 粘贴（格式保真）→ 分步截图（`draft_report/`）→ 存草稿
4. 人工在后台审核、补封面/配图、手动群发

### 标准路径：meta.json 驱动（推荐，省 token）

1. AI 只生成 `meta.json`（按 `content-schema.json` 结构，内容数据不写 HTML）
2. `node build.js ./meta.json` → 渲染出推文 HTML（含标题/摘要/封面位/正文/配图占位）
3. 配图用 `rcj-screenshots` 技能批量截图（截图不回传 AI）
4. 产物统一放 `wechat-xhs-content/`；封面用 **PNG 900×383 无水印**（后台手动上传）
5. 填草稿：`draft_fill.mjs`（或直接把 HTML 粘进后台）

## 红线

- 只点「保存为草稿」，**绝不自动群发**
- 依赖：Node ≥ 22（WorkBuddy 内置管理版）、全局 `@playwright/cli` 的 `playwright-core`（无需 npm install）、本地 Google Chrome
