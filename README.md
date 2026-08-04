# RCJ9527 · 个人主页

`955827.xyz` 的个人主页。Cloudflare Pages 托管，零后端依赖。

## 部署

- 仓库：`github.com/ZHOUQIANG5827/rcj-hub`
- 托管：Cloudflare Pages（自动构建 main 分支，输出目录 `/`）
- 自定义域：`955827.xyz`（CF 自动签发证书 + DNS）

## 内容结构

极简单页，零 JS：

- Header：品牌字标
- Hero：自我介绍 + 入口按钮
- Now：最近在做什么（active / 规划中）
- Vibe Coding 友链征集区：国内开发者项目，支持 GitHub PR 换链（详见 `links.md`）
- Vibe Coding 工具箱（海外）：Cursor / v0 / Bolt.new / Lovable
- 前往 RCJ Exam Hub 胶囊：醒目蓝色按钮
- Footer：邮箱 + 版权

## 友链换链

详见 [`links.md`](./links.md)。提交 PR 到 `links.md` 加你的项目，审核通过后会在主页「Vibe Coding 工具箱（友链）」区块回链。

## 更新

直接改 `index.html` / `assets/hub.v2.css`，commit + push 到 main，CF Pages 自动上线。
**改完线上需 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）拿掉旧缓存。

## 设计原则

- 首页极简单页 HTML，零 JS
- 响应式：手机优先（≤720px 单列）
- RCJ 品牌蓝 `#1e88e5`
