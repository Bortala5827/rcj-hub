---
title: rcj-screenshots
summary: 批量网页截图（Playwright-core + 系统 Chrome）：给任意 URL 列表截图，推文配图 / 产品演示 / 冒烟验证通用。默认内置 4 个 RCJ 产品，支持外部配置
read_when:
  - 批量截图
  - 网页截图配图
  - 产品截图
  - 推文配图
---

# rcj-screenshots — 批量网页截图

## 何时用

- 给推文 / 文档 / 演示批量截网页图（默认内置 4 个 RCJ 产品：Hub / SoloSpeak / LetOut / FaceTalk）
- 产品改版后截图留档
- 快速截图做冒烟验证

## 用法

```bash
# 默认 4 个 RCJ 产品，输出到 ./screenshots/
C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe screenshot.js

# 自定义配置（见 shots.example.mjs）
C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe screenshot.js ./my-shots.mjs
```

外部配置格式（ESM）：

```js
export const shots = [
  { url: 'https://facetalk.955827.xyz/', name: 'facetalk-mobile.png', desc: 'FaceTalk 移动端', viewport: { width: 390, height: 844 }, fullPage: true },
];
export const outDir = 'screenshots';
```

## 依赖

- 复用全局 `@playwright/cli` 自带 `playwright-core`（无需 npm install）
- 系统 Google Chrome（`C:/Program Files/Google/Chrome/Application/chrome.exe`）

## 注意

- **截图不回传 AI**（省 token，Trae 教训）——截图只落盘，需要时由 AI 读文件
- 公众号封面另用 **PNG 900×383 无水印** 规格（wechat-draft 技能负责），不走本技能
- 微信要求正文配图进其 CDN，本技能产出的图需在公众号后台手动上传
