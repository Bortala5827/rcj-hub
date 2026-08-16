# 公众号推文草稿流水线（优化版 SOP）

**目标**：AI 写内容 + 本地浏览器自动填草稿，人工只做 3 件事——**扫码一次、审核、群发**。
**红线**：只进草稿箱，绝不自动群发（守 2026-08-09 拍板）。

---

## 角色分工

| 角色 | 干什么 | 用什么 |
|---|---|---|
| AI（我） | 按模板产内容：标题/正文/配图位置提示，跑质量闸门 | `content-template.md` |
| 脚本 | 打开后台、复用登录态、新建图文、填标题/作者/正文、截图校验、存草稿 | `draft_fill.mjs`（Playwright + 本地 Chrome） |
| 你 | ① 首次扫码登录 ② 看截图/报告审核 ③ 补封面/配图后手动群发 | 手机 + 浏览器 |

---

## 一次推文的流程（约 5 分钟）

### 标准路径（推荐，省 token——Trae 教训吸收）

1. **你说主题** → 我生成 `meta.json`（按 `content-schema.json`：标题/作者/摘要/封面/分节/配图配置，**只写数据不写 HTML**）
2. `node build.js ./meta.json` → 渲染出推文 HTML（标题/摘要/封面位/正文/配图占位）
3. 配图：`rcj-screenshots` 技能批量截图（Playwright + 系统 Chrome，**截图不回传 AI 省 token**）
4. 产物统一放 **`wechat-xhs-content/`**；封面 **PNG 900×383 无水印**（后台手动上传）
5. 填草稿：`draft_fill.mjs` 或直接粘 HTML → 你审核 → 手动群发

### 快速路径：draft.md

1. 我按 `content-template.md` 写 `draft.md`
2. `node draft_fill.mjs draft.md` → 弹出 Chrome（首次扫码一次，登录态复用）→ 自动填标题/作者/正文 → 存草稿
3. 你收尾：审核 → 补封面/配图 → 手动群发

---

## 质量闸门（高质量靠流程保证，不靠运气）

- **标题** ≤ 64 字，含钩子与关键词（公众号列表页只显示 标题 + 摘要 + 首图）
- **字数**按类型：贴图 ≤ 800 字；深度长文 1500–2500 字
- **前 3 行抓人**：开门见山，不铺垫
- **诚实合规**：不夸大 AI 能力（例：面试点评=「录音转文字→基于文字点评」，不写「AI 听得出你的语气」）
- **配图占位**：正文用 `![配图位置：xxx](placeholder)` 或 meta.json 的 `placeholder` 字段标注，渲染成灰色占位块，后台手动换真图
- **封面规格**：PNG **900×383** 无水印（微信推荐尺寸）
- **段落**：每段 ≤ 4 行，段间空行（手机阅读友好）

---

## 优化点（对比 Trae 裸流程）

| # | 优化 | 收益 |
|---|---|---|
| 1 | **持久登录态**（独立 user-data-dir，扫码一次长期复用） | 不每篇扫码 |
| 2 | **JSON 驱动 + 渲染脚本**（AI 只写 meta.json，build.js 出 HTML） | 省 token、可复用、改排版不动内容 |
| 3 | **内容模板 + 质量闸门前置** | 高质量可复制，不靠碰运气 |
| 4 | **分步截图 + 字符数校验** | 填完可复查、出错可定位 |
| 5 | **只进草稿箱** | 守住红线，发布永远人工 |

---

## 注意事项

- 独立 profile：`C:/Users/小样儿/.workbuddy/wechat-mp-profile`，**不碰你日常 Chrome 的个人数据**
- 微信后台 DOM 偶尔变化：首次实跑需调一次选择器，脚本已带分步截图方便定位（改 `draft_fill.mjs` 顶部或 `EDITOR_URL`/选择器）
- 封面图与正文配图必须在后台手动上传（微信要求图片进其 CDN），脚本只留占位
- 运行命令（Git Bash）：
  ```
  C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe draft_fill.mjs ./draft.md
  C:/Users/小样儿/.workbuddy/binaries/node/versions/22.22.2/node.exe build.js ./meta.json
  ```
