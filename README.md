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

两种加入方式：① GitHub PR 换链（详见 [`links.md`](./links.md)）；② 不会用 GitHub 的用户直接在主页 `#vibe` 表单留言，我筛选后加入。

### 非 GitHub 用户投稿（页面表单 + D1 收件箱）

代码已就绪，但需要在 Cloudflare 后台做 3 步才激活：

1. **建 D1 数据库**：CF 后台 → Workers & Pages → D1 → Create → 命名 `rcj-hub-links` → 在控制台执行 `schema.sql`（`CREATE TABLE links ...`）。
2. **绑 Functions**：CF 后台 → rcj-hub 项目 → Settings → Functions → D1 bindings → 加绑定 `DB` → 选刚建的 `rcj-hub-links`。
3. **设审核密码**：rcj-hub 项目 → Settings → Environment variables → 加 `ADMIN_KEY`（生产环境）→ 值设一个只有你知道的强密码。

> 绑定改动后必须去 **Deployments → Retry latest deployment** 让绑定干净地 bake 进新部署。

激活后：
- 访客在 `#vibe` 表单提交 → 写入 D1（`status='pending'`）
- 你打开 `https://955827.xyz/admin?key=你的ADMIN_KEY` → 点「通过」即出现在主页友链区，「删除」即移除
- 主页友链区由 `/api/links` 动态读取 `approved` 记录渲染

防垃圾：表单含 honeypot 隐藏字段 + 同 IP 60s 限 1 次；提交即 `pending` 不立即显示。

## 更新

直接改 `index.html` / `assets/hub.v2.css`，commit + push 到 main，CF Pages 自动上线。
**改完线上需 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）拿掉旧缓存。

## 设计原则

- 首页极简单页 HTML，零 JS
- 响应式：手机优先（≤720px 单列）
- RCJ 品牌蓝 `#1e88e5`
