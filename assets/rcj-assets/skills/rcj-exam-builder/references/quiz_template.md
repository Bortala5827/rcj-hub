# 推荐部署结构（RCJ Exam Template：模板分离 + 可编辑配置 + Actions 自动构建）

> 适用：想把「题库 → 在线刷题站」做成**一套可复用模板**的人。
> 核心思想（吸收了「统一 JSON 缓存 + 模板分离 + 导出分支」的好思路，但保留笔试/面试富结构）：
> 1. `data-*.json` 是**唯一源**，改题只动它；`build_data.py` 把它编译成 `data-*.js`（全局变量）与 `config.js`，**不重复解析文本**。
> 2. 查看器 `index.html`（= `viewer.html` 模板）与数据解耦——改样式只动 HTML，换题库只重跑脚本。
> 3. 站点配置抽成 `template-config.json`，非程序员也能改（标题/闲鱼号/倒计时），由脚本编译成 `config.js`。
> 4. `.github/workflows/auto-build.yml` 让「在 GitHub 网页改 `data-*.json` → 自动重建 → Cloudflare 重部署」一键完成。

---

## 1. 目录结构

```
rcj-exam-template/
├── README.md                    # 通用部署指南（给用户看）
├── SETUP.md                     # 配置说明（如何加新题库 / 改配置）
├── index.html                   # 通用查看器（= assets/viewer.html，自动识别笔试/面试）
├── data-interview.js            # 面试运行时（由 data-interview.json 生成，window.DATA_INTERVIEW）
├── data-interview.json          # 面试题源（可编辑）
├── data-written.js              # 笔试题运行时（window.DATA_WRITTEN）
├── data-written.json            # 笔试题源（可编辑）
├── config.js                    # 站点配置（由 template-config.json 生成，window.SITE_CONFIG）
├── _headers                     # Cloudflare 缓存配置（= assets/headers_template.txt）
├── build_data.py                # 脚本：JSON → JS（= assets/build_data.py）
├── template-config.json         # 模板配置（题库名、类型等，可编辑）
└── .github/
    └── workflows/
        └── auto-build.yml       # GitHub Actions 自动构建（= assets/auto-build.yml）
```

把这个目录**整个推到 GitHub**，Cloudflare Pages 连仓库即可托管。

---

## 2. 首次初始化（从 skill 资产搭起来）

```bash
# 进入你的站点目录（如 ~/Desktop/quiz-template）
cp assets/viewer.html           index.html
cp assets/build_data.py         build_data.py
cp assets/headers_template.txt  _headers
cp assets/template-config.sample.json  template-config.json

# 把你的题库源放进来（笔试 900 题 / 面试 138 题 等）
cp 你的笔试.json   data-written.json
cp 你的面试.json   data-interview.json

# 生成运行时 JS（双全局变量，合并站关键）
python build_data.py data-written.json   -o data-written.js   --global-name DATA_WRITTEN   --minify --config template-config.json --emit-config config.js
python build_data.py data-interview.json -o data-interview.js --global-name DATA_INTERVIEW --minify

# Actions 自动构建（可选；见第 4 节 PAT 权限坑）
mkdir -p .github/workflows
cp assets/auto-build.yml .github/workflows/auto-build.yml
```

> ⚠️ **`template-config.json` 不要 `fetch()` 读**：`file://` 双击打开时 fetch 被 CORS 拦截。
> 正确姿势是 `build_data.py --config` 把它编译成 `config.js`（`window.SITE_CONFIG`），HTML 读这个全局变量——离线双击、网页端、部署端三处都通。

---

## 3. 改配置（不改 HTML）

编辑 `template-config.json` 的字段，重跑带 `--config` 的那条命令即可：

| 字段 | 含义 | 示例 |
|---|---|---|
| `siteTitle` | 站点标题 | `考试刷题 · 在线版` |
| `siteEmoji` | 标题 emoji | `📚` |
| `subtitle` | 副标题 | `笔试 + 面试 真题合集` |
| `xianyuCode` | 闲鱼号（引流，可选） | 留空则关闭闲鱼模块 |
| `promoTitle` / `promoText` | 推广 banner 文案 | `需要离线完整版？` |
| `footerText` | 页脚声明 | `以官方公告为准` |
| `timerSeconds` | 随机抽题倒计时秒数 | `180`（3 分钟） |
| `datasets` | 题库清单（供 Actions 识别） | 见样例 |

`viewer.html` 里写成 `var CONFIG = window.SITE_CONFIG || {内联默认值}`，**读不到 config.js 时回退内联默认值**，所以即使忘了生成 config.js 也不会崩。

---

## 4. 加题 / 改答案

**方式 A：本地改（推荐调试阶段）**
1. 编辑 `data-written.json` / `data-interview.json`（加对象 / 改字段，保存）。
2. 重跑第 2 节的 `build_data.py`（对应那条），重新生成 `data-*.js`。
3. `git add -A && git commit && git push` → Cloudflare 自动重部署。

**方式 B：GitHub 网页直接改（需 Actions）**
1. 在 GitHub 网页打开 `data-interview.json`，点铅笔图标改完提交。
2. `auto-build.yml` 自动跑 `build_data.py` 重建 `data-*.js` + `config.js` 并 commit。
3. Cloudflare 检测到新提交，自动重部署。

> ⚠️ **PAT 权限坑**：推送含 `.github/workflows/*.yml` 的 commit，需要 GitHub Token 带 **`workflow` scope**（仅有 `repo` 会被拒，报 `403 refusing to allow a Personal Access Token to create or update workflow ... without 'workflow' scope`）。
> 解决：① 给 Token 勾选 `workflow` 再推；② 或暂时 `git rm -r .github/workflows` 后提交再推（站点照常可用，Actions 以后拿到带 `workflow` scope 的 Token 再补）。

---

## 5. Cloudflare Pages 托管（3 步）

1. 登录 dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选择你的仓库 → 构建设置：**Build command 留空**，**Build output directory 填 `/`**（根目录就是这个文件夹）。
3. 部署完得 `https://你的仓库.pages.dev`；以后改题 `git push` / 网页改 JSON 自动重部署。

> 自定义域名：Pages 项目里 **Custom domains** → 填域名 → 按提示加 DNS 解析即可。
> 录音功能：浏览器安全策略下 `file://` 双击常被拦麦克风，**部署到 Cloudflare 的 HTTPS 后用录音最稳**。

---

## 6. 换一套题（复用，不重新调试）

把新的 `data-interview.json` / `data-written.json` 替换进来，按需改 `template-config.json` 的 `siteTitle` / `xianyuCode`，重跑 `build_data.py`，`git push` 即更新。笔试同理（字段见 `references/schema.md`）。**HTML 模板零改动**。

---

## 7. README 与 SETUP 规范（通用化，P8/P9）

产品仓库的 `README.md` / `SETUP.md` **不绑定任何具体考试**，统一介绍 RCJ Exam Template 能力：

- **README** 覆盖：模板定位（可复用静态考试学习系统）、适用场景（辅警 / 消防 / 应征入伍 / 军队文职 / 公考 / 任意考试）、四类产物（在线版 / 离线版 / Anki 卡包 / GitHub 自动部署）、快速开始。
- **SETUP** 覆盖：新建考试项目、修改标题/副标题、更换封面(`cover`)/Logo(`logo`)、修改配色(`themeColor`)、配置闲鱼引流(`enabledModules.xianyu`)、新增年份题库、Cloudflare Pages 部署流程、Actions 自动构建（PAT `workflow` scope 坑）。
- 页脚统一显示「Powered by RCJ Exam Template v1.x」（由 `VERSION.json` 自动注入，禁手工改）。
