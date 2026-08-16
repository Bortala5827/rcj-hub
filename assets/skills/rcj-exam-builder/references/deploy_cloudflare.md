# 部署到 Cloudflare Pages（GitHub 托管）

把生成的静态站（HTML 外壳 + `data-*.js` + `_headers`）推到 GitHub，再用 Cloudflare Pages 托管，得到可分享的在线版。全程免费、自带 HTTPS、全球 CDN、改完 push 自动重新部署。

## 1. 准备仓库
- 在 GitHub 新建一个仓库（如 `aux-police-quiz`）。
- 本地站点目录放进仓库根，至少包含：
  - `written.html` / `index.html`（或你的页面外壳）
  - `data-written.js` / `data-interview.js`（`build_data.py` 产物）
  - `_headers`（直接复制 `assets/headers_template.txt`）
  - 可选：`data-written.json` / `data-interview.json`（可编辑源，方便以后改题）

## 2. 推送 GitHub
```bash
git init
git add .
git commit -m "init quiz site"
git remote add origin https://github.com/<你>/<仓库>.git
git push -u origin main
```

## 3. Cloudflare Pages 连接
1. 登录 Cloudflare → **Workers & Pages** → **Create** → **Pages** → **连接到 Git**。
2. 授权并选中你的 GitHub 仓库。
3. 构建设置（纯静态、无构建步骤）：
   - **Framework preset**：无 / None
   - **Build command**：留空
   - **Build output directory**：`/`（根目录，因为 HTML 就在根）
4. 点 **Save and Deploy**。几秒后得到 `https://<项目>.pages.dev` 域名。

## 4. _headers（缓存策略）
仓库根放 `_headers`（复制 `assets/headers_template.txt`）：
- `/*.html` 短缓存，改文案/功能快速生效。
- `/data-*.js` 长缓存 + `immutable`，二次访问直击本地；CDN 自动 Brotli 压缩。

> 改了题库且文件名不变时，把 `data.js` 改名（如 `data.v2.js`）破缓存，HTML 同步改引用。

## 5. 自定义域名（可选）
Cloudflare Pages → **Custom domains** → 填你的域名 → 按提示加 DNS 记录（CNAME 到 `<项目>.pages.dev`）。

## 6. 更新题库流程
1. 改 `data.json`（或直接替换源 CSV 重新 ingest）。
2. `python build_data.py data.json -o data.js` 重建运行时。
3. `git add . && git commit -m "更新题库" && git push` → Cloudflare 自动重新部署。
