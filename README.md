# RCJ9527 · 个人主页 + 考试题库 + 自媒体矩阵枢纽

`955827.xyz` 的个人品牌脸面 + 旗下站点导流枢纽 + Vibe Coding 小工具。Cloudflare Pages 托管，零后端依赖。

## 部署

- 仓库：`github.com/ZHOUQIANG5827/rcj-hub`
- 托管：Cloudflare Pages（自动构建 main 分支，输出目录 `/`）
- 自定义域：`955827.xyz`（CF 自动签发证书 + DNS）

## 内容结构

- 顶部 Header：品牌 + 锚点导航（产品矩阵 / Vibe Coding / 友链交换）
- Hero：**承接全网流量，引流到 RCJ Exam Hub** —— 主 CTA「免费真题库」+「面试搭子」
- Now：最近在做什么（面试搭子 / 体测体能培训规划中）
- **产品矩阵（流量漏斗）**：免费引流（Exam Hub 真题库 / 面试搭子）→ 付费转化（辅警 / 消防定制题库）→ 预留体测与体能培训卡（公检法体测 / 消防员长周期体能培训，标记「规划中」）
- Vibe Coding 工具箱（外站 8 个链接）
- **友链交换（GitHub PR 换链）**：通过 PR 接受友链交换，互相导流 + 加权 SEO
- Footer：联系邮箱 + 闲鱼 / 公众号 RCJ9527

### 核心策略

1. **承接全网流量 → 引流到 RCJ Exam Hub**（免费真题库作顶层流量入口）
2. **Vibe Coding 工具箱 + 友链交换**：通过 GitHub PR 换链，白嫖开发者流量与 SEO 权重
3. **变现分层**：辅警 / 消防定制题库为付费主力；体测与体能培训为预留的线下转化产品

### 友链交换（links.md）

`links.md` 是友链交换的提交入口：贡献者在文件里按格式加一行自己的站点并提 PR，合并后其站点出现在首页「友链交换」区。规则详见 `links.md`。

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
