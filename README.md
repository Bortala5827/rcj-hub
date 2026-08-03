# RCJ9527 · 个人主页 + 考试题库 + 自媒体矩阵枢纽

`955827.xyz` 的个人品牌脸面 + 旗下站点导流枢纽 + Vibe Coding 小工具。Cloudflare Pages 托管，零后端依赖。

## 部署

- 仓库：`github.com/ZHOUQIANG5827/rcj-hub`
- 托管：Cloudflare Pages（自动构建 main 分支，输出目录 `/`）
- 自定义域：`955827.xyz`（CF 自动签发证书 + DNS）

## 内容结构

- 顶部 Hero：RCJ9527 品牌 + 一句话定位（考试题库 × 自媒体矩阵）
- Now：最近在做什么（自媒体矩阵 / 专职消防员题库 / 辅警题库 / Vibe Coding 工具 / 博客）
- Projects：做过的项目卡片
  - 🏛️ 国考/省考/事业编真题库（免费引流）
  - 🛡️ 辅警/民辅警题库（定制主力）
  - 🚒 政府/企业消防员（定制主力）
  - 🎬 自媒体矩阵（公众号/小红书/视频号/抖音）
  - 🛠️ 静态站/Anki 制卡实操教程
  - 🤝 面试搭子 MVP（粘贴会议链接一键组队）
  - 🔗 **HTML → 分享链接** 工具（`/share/`，见下）
- Contact：公众号 / 闲鱼 / 小红书 / 视频号 / GitHub

## 子页面 / 工具

### `/share/` — HTML → 分享链接（Vibe Coding 工具）

把 vibe coding 生成的 HTML 一键变成可分享链接：

- `share/index.html`：粘贴 / 上传 HTML → 实时预览 → 生成带内容的分享链接
- `share/view.html`：读链接 `#v=` 片段，沙箱渲染分享的 HTML
- `share/lz-string.min.js`：本地内置的 LZ-string（压缩，CDN 被墙也能用）

设计：**纯前端、无服务器**，HTML 内容编码进 URL 片段，复制发给任何人直接打开。大文件（链接 > 3 万字符）建议先精简。

## 更新

直接改 `index.html` / `assets/*.css`，或新增子目录（如 `share/`），commit + push 到 main，CF Pages 自动上线。
**改完线上需 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）拿掉旧缓存。

## 设计原则

- 首页极简单页 HTML，零 JS
- 响应式：手机优先（≤640px 单列）
- RCJ 品牌蓝 `#1e88e5`
- 子工具（/share）自包含，独立样式与脚本
