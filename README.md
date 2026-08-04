# RCJ9527 · 个人主页

`955827.xyz` 的个人主页。Cloudflare Pages 托管，零后端依赖。

## 部署

- 仓库：`github.com/ZHOUQIANG5827/rcj-hub`
- 托管：Cloudflare Pages（自动构建 main 分支，输出目录 `/`）
- 自定义域：`955827.xyz`（CF 自动签发证书 + DNS）

## 内容结构

极简单页，零 JS：

- Header：品牌 + 锚点导航（Vibe Coding）
- Hero：自我介绍 + 入口按钮（免费真题库 / 面试搭子）
- Now：最近在做什么（active / 规划中）
- Vibe Coding：暂留空
- Writing：博客空状态
- Contact：GitHub / 邮箱 / Exam Hub / 面试搭子
- Footer：邮箱 + 闲鱼/公众号 RCJ9527

## 更新

直接改 `index.html` / `assets/hub.v2.css`，commit + push 到 main，CF Pages 自动上线。
**改完线上需 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）拿掉旧缓存。

## 设计原则

- 首页极简单页 HTML，零 JS
- 响应式：手机优先（≤720px 单列）
- RCJ 品牌蓝 `#1e88e5`
