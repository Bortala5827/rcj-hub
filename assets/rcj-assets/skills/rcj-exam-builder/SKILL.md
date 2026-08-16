---
name: rcj-exam-builder
description: RCJ Exam Template 构建器——把任意考试的"题库"做成可复用静态学习系统模板：采集题目/答案（自己整理或 Claude/Gemini 生成）→ 整理成 CSV/JSON/Markdown/PDF/Word → 一键生成：①Cloudflare Pages 在线版；②HTML 离线版（file:// 双击可用，data.js 外置提速，带🎲随机抽题、📝套题模考（抽题→作答→提交判分）、面试🎤录音回答）；③Anki 复习卡包（CSV 导入 / 可选 .apkg，支持标签分组与子牌组）；④GitHub 自动部署项目。模板与业务完全解耦，配置驱动（template-config.json），JSON 驱动（人工只维护 JSON，build_data.py 自动生成 JS）。通用适配辅警/消防/应征入伍/军队文职/公考等任何考试，不写死地区；并支持 Anki 卡包批量加结构化答题框架（scripts/add_framework_to_anki.py）。
---

# RCJ Exam Template（可复用静态考试学习系统模板）

把任意考试的「题库」做成**可复用的静态学习系统**，一次模板、多产品复用。输出四种产物：

- **Cloudflare Pages 在线版**（推 GitHub 自动部署）
- **HTML 离线版**（`file://` 双击即用，data.js 外置提速，🎲随机抽题 + 📝套题模考（自定义题量/时间/打字题，抽题→作答→提交判分）+ 面试🎤录音演练）
- **Anki 卡包**（CSV 导入 / 可选 .apkg，标签分组与子牌组）
- **GitHub 自动部署项目**（Actions 自动构建 + 版本信息）

模板与业务**完全解耦**：品牌、文案、配色、模块开关全部在 `template-config.json`，题库只在 `data-*.json`。换考试只改配置与题库，不动模板。

## 何时使用

- 提速：单文件 `*.html` 把题库内联在 `<script>` 里，体积大、首屏慢 → 外置 `data.js`。
- 可维护：持续上传题目/答案，需要「自动拆分、易增改」→ 抽成 `data.json`（源）+ `data.js`（运行时）。
- 复习卡：要「导出 Anki 卡片」「做成能背的卡组」。
- 上线：要「部署到 Cloudflare」「推 GitHub 托管静态站」「出在线版」。
- 通用：适配**任何招考/考试**（辅警 / 消防 / 应征入伍 / 军队文职 / 公考 / 教资…），不写死地区或警种。
- 触发词：「考试题库网站」「刷题系统」「Anki 卡组」「部署 Cloudflare」「合并站点（笔试+面试一个域名）」「随机抽题」「面试录音」「任意考试模板」。

> 💡 **省 token 心法（主线 B/C 必读）**：题目/答案**不要整段粘贴进对话框**——上千题全文会让每轮对话重读几十万字符、token 爆、还容易截断。正确做法：题目存成 `题目.csv`（或 json/md）丢进项目目录，对话里只发「处理这个文件」。脚本在本地读文件、写 `data.json` / `data.js` / `anki_cards.csv`，AI 上下文只有文件路径 + 几条命令，**题目正文从不进聊天记录**。

## 架构原则（极简、可复用）

1. **模板与业务解耦**：`viewer.html` 是纯前端模板，品牌信息全读 `window.SITE_CONFIG`，不写死任何考试名/地区/账号。
2. **配置驱动**：`template-config.json` → `config.js`（`window.SITE_CONFIG`），含标题/配色/封面/模块开关/数据集。
3. **JSON 驱动**：人工只维护 `data-*.json`；`build_data.py` 自动生成 `data-*.js`，**不允许直接编辑 data-*.js**。
4. **极简体验**：秒开、纯静态、离线可用；不引入登录 / 数据库 / 服务端 / 云同步。

## 辅警多城部署：真题优先 · 通用模板（build_city.py）

> ⚠️ **真题铁律**：只有拿到该城市「真实考试真题」才建站。严禁用其他城市数据洗白/拼凑冒充城市真题（曾有武汉/长沙用深圳数据洗白 → 漏洞百出被迫下架）。

`viewer.html` 已升级为「真题优先 + 机考/非机考通用」：
- 默认品牌即「辅警真题卡组」，头部带 `✅ 全部为真实考试真题` 铁律条；
- 模式 tab 显示「📖 笔试真题 / 🎤 面试真题」，统计显示「真题数」；
- `examType: "computer"|"paper"` + `modules.{mockExam,targeted,random,written,interview}` 用配置区分机考/非机考，**无代码分叉**；
- `realQuestions: true` 控制铁律条显隐，`examYear` 显示在副标题。

**一键构建自包含单文件**（数据+配置内联，双击离线可用）：
```bash
python outputs/build_city.py <viewer.html> <config.js> \
  <data-written.json> <data-interview.json> <out/index.html> [examYear]
```
- `viewer.html` = `rcj-exam-builder/assets/viewer.html`（通用模板）
- `config.js` 用 `window.SITE_CONFIG = {...}` 写城市配置（含 `examType/examYear/realQuestions/modules`，字段见 `assets/template-config.sample.json`）
- 输出 `index.html` 复制进城市子目录（如 `sz/`），push 即上线
- 完整流程与质检清单见部署仓库 `outputs/ADD_CITY_WORKFLOW.md`

机考（惠州类）套题模考为核心；非机考（深圳类）结构化面试为重点——**同一套引擎，仅配置不同**。

## 一键输出规范（核心流水线）

```
Markdown / PDF / Word / 图片
        ↓  （doc_to_csv / ingest / md_to_interview 抽取）
JSON（data-written.json / data-interview.json）
        ↓  build_data.py
RCJ Exam Template（viewer.html 通用模板 + data-*.js + config.js + VERSION.json）
        ↓  部署
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Cloudflare   │ HTML 离线版  │ Anki 卡包    │ README /      │
│ Pages 在线版 │ file:// 双击 │ CSV / .apkg  │ CHANGELOG /   │
│ (Git 部署)   │ 即用         │ 间隔重复     │ SETUP         │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 步骤 A：内联数组外置（提速改造）

```bash
python scripts/extract_data.py SITE.html --var DATA --out data.js --validate
```

把 HTML 里的内联数组拆成独立 `data.js`，HTML 外壳缩小秒开。详见 SKILL 原「步骤 A」逻辑（脚本不变）。

## 步骤 B：题库管线（上传即拆分，易增改）

### 1) 上传源文件 → 可编辑 data.json

**PDF / Word / 纯文本直读（自动切题草稿）**：
```bash
python scripts/doc_to_csv.py 真题.pdf  -o 真题_draft.csv --type written    # 笔试
python scripts/doc_to_csv.py 真题.docx -o 真题_draft.csv --type interview  # 面试
python scripts/doc_to_csv.py 真题.txt  -o 真题_draft.csv --type written    # 纯文本
```
输出是**草稿 CSV**，请人工校对后交下面 ingest。

**规范源文件转换（CSV / XLSX / JSON / TXT）**：
```bash
python scripts/ingest.py 题目.csv  -o data.json          # CSV（原生）
python scripts/ingest.py 题目.xlsx -o data.json          # 需 openpyxl
python scripts/ingest.py 题目.json -o data.json          # 已是题库数组
python scripts/ingest.py 题目.txt  -o data.json          # 行式，|| / # / 制表符分隔
python scripts/md_to_interview.py 真题.md -o 面试真题.csv && python scripts/ingest.py 面试真题.csv -o data-interview.json
```
列名中英文别名自动匹配（题号/批次/题型/题干/选项/答案/解析/标签/年份/场次/标题），见 `references/schema.md`。

### 2) data.json → 离线运行时 data.js
```bash
python scripts/build_data.py data.json -o data.js            # 格式化
python scripts/build_data.py data.json -o data.js --minify   # 压缩单行
```

### 3) 合并站点（笔试+面试合一）
```bash
python scripts/build_data.py 笔试.json -o data-written.js   --global-name DATA_WRITTEN
python scripts/build_data.py 面试.json -o data-interview.js --global-name DATA_INTERVIEW
```

### 4) 可编辑站点配置（template-config.json → config.js）
```bash
python scripts/build_data.py 笔试.json -o data-written.js --global-name DATA_WRITTEN --minify \
       --config template-config.json --emit-config config.js
```
字段见 `assets/template-config.sample.json`：`siteTitle / siteEmoji / subtitle / logo / cover / themeColor / contact / xianyuCode / promoTitle / promoText / rewardImage / footerText / timerSeconds / examPreset / typingText / enabledModules / defaultPage / datasets`。
- `enabledModules`：`promo`(闲鱼推广横幅) / `xianyu`(工具栏「获取完整版口令」+闲鱼弹层) / `reward`(工具栏「打赏作者」+赞赏码弹层) / `record`(面试🎙️录音按钮，仅在面试模式+随机抽题弹层出现) / `progress`(掌握度进度) / `themeToggle`(深色模式)。默认多为关闭，按需置 `true` 并填 `xianyuCode / promoText / rewardImage` 等内容。
- **套题模考（自定义出卷器）**：内置工具栏「📝 套题模考」按钮，弹窗可**自定义单选/多选/判断题量与答题分钟数**，可开关并设时长含「打字题」；点「↺ 标准模考」一键恢复 `examPreset` 预设值。生成试卷后随机打乱、进入全屏模考视图（顶部倒计时条，归零自动交卷），作答完「提交试卷」才判分并标红错题、给出正确率与评级；打字题为附加项，提交后独立统计字数/准确率/速度，不计入客观题分。面试模式提交后展开参考答案。**无需配置即可用**，设置项见 `examPreset` / `typingText`：
  - `examPreset`：`{ label, single, multi, bool, minutes, typing, typingMinutes }` —— 弹窗默认值与预设按钮文案，如惠州辅警笔试设 `single:36, multi:12, bool:12, minutes:60, typing:true, typingMinutes:10`。
  - `typingText`：打字题范文（抄写文本），按考试实际材料替换。
  - **主按钮醒目化**：在工具栏中「📝 套题模考」默认作为**最醒目的主操作按钮**——蓝色实心渐变填充、置顶排在第一位，引导用户优先做模拟考而非零散浏览；其余工具按钮（随机抽题/展开折叠/只看未掌握/获取完整版/打赏）为次级描边样式。
- **定向刷题（默认浏览模式）**：按批次/题型筛选，**点击选项即判**（单选/判断点选项立即显对错+解析并锁定，多选勾完点「提交」判分）；选项不预先标绿，杜绝"直接给答案"，错题用 ❌ 标红、对题标绿。与套题模考分工（平时练 vs 模拟考）。
- **不提供「导出题目」按钮（产品约定）**：模板**默认移除**站点内的「📄 导出题目 / 打印 PDF」按钮——对刷题用户价值低、且易被视为"把答案打包带走"而稀释付费完整版卖点。需要离线卡组请用 `scripts/anki_export.py` 在构建期生成 Anki 卡片，而非站点内导出。`viewer.html` 已不含 `exportBtn` / `buildExport` / `printReport` / `@media print` 代码。
- **判断题 UI 去歧义**：数据里判断题选项常见 `{letter:"正确", text:"正确"}` / `{letter:"错误", text:"错误"}`，直接渲染会变成"正确。正确""错误。错误"，用户无法分辨选项与答案。模板在数据加载后自动规范化：把判断题 `options.letter` 按顺序映射为 `A/B`，`answer` 也同步映射为 `A/B`；显示答案时再由 `displayAnswer()` 把 `A/B` 转回"正确"/"错误"。最终界面显示 `A.正确 / B.错误`，答案区显示"答案：正确/错误"，清晰无歧义。
- **首屏速度优化**：
  - 封面/Logo/赞赏码等 `<img>` 一律加 `loading="lazy" decoding="async"`。
  - 若 `CONFIG.cover` 是超长 base64（>8KB，如 AI 生成的 C2PA 大图），运行时自动回退到轻量 SVG 占位，避免一张封面图把 HTML 撑到数 MB。
  - 题库列表采用分页渲染（默认 40 题一批，滚动/点击加载更多），不一次注入全部卡片 DOM。

### 5) 版本信息（VERSION.json，禁手工改）
```bash
python scripts/build_data.py 笔试.json -o data-written.js --global-name DATA_WRITTEN \
       --config template-config.json --emit-config config.js --emit-version --template-version 1.0.0
```
自动统计 `datasets` 各模式题量，写入 `VERSION.json`（含 version / updated / writtenCount / interviewCount）。`viewer.html` 页脚读取并显示「RCJ Exam Template v1.0.0 · 更新于 … · 笔试 N / 面试 M」。

### 5.5) 题库清洗 / 筛选（支撑「近 N 年」约定）

长期约定：**题目控制在近 3 年内**，太久远的真题不必纳入。用筛选参数把清洗能力固化进流水线，不靠手工删题。

```bash
# 面试题（有 year 字段）：保留 year >= 2023（即近 3 年）
python scripts/build_data.py data-interview.json -o data-interview.js \
       --global-name DATA_INTERVIEW --minify --filter-year 2023

# 便捷写法：--recent-years 3 自动算 year >= (今年-3+1)
python scripts/build_data.py data-interview.json -o data-interview.js \
       --global-name DATA_INTERVIEW --minify --recent-years 3

# 笔试题（只有 batch 字段，无 year）：按批次白名单筛选（包含匹配）
#   '第十批' 会命中 '第十批·单选题' / '第十批·多选题' 等所有题型
python scripts/build_data.py data-written.json -o data-written.js \
       --global-name DATA_WRITTEN --minify --filter-batch "第十批,第七批,第六批"

# 固化清洗决策：把筛选结果写回源 JSON（--save-filtered-json）
#   与 --emit-version 联用，VERSION.json 题量自动用筛选后数量
python scripts/build_data.py data-interview.json -o data-interview.js \
       --global-name DATA_INTERVIEW --minify --filter-year 2023 \
       --save-filtered-json data-interview.json \
       --config template-config.json --emit-config config.js \
       --emit-version --template-version 1.0.0
```

筛选参数说明：

- `--filter-year N`：保留 `year >= N` 的题；**缺 year 字段的题默认保留**（适配笔试无年份）。
- `--recent-years N`：便捷，自动算 `year >= 今年-N+1`（如 `--recent-years 3` → 保留近 3 年）。
- `--filter-batch "A,B,C"`：保留 `batch` **包含**白名单任一关键词的题（如 `第十批` 命中 `第十批·单选题`）；缺 batch 默认保留。
- `--filter-strict`：缺 `year` / `batch` 的题也丢弃（默认保留，避免误删无字段题）。
- `--save-filtered-json PATH`：把筛选结果写回源 JSON（固化决策）；不指定则只生成 JS、不动源文件。
- 筛选后题量会在 `--emit-version` 生成的 `VERSION.json` 中正确体现（当前 input 对应的 mode 用筛选后数量）。

> ⚠️ **批次 ≠ 年份**：笔试 `batch` 是真题收集批次/考试场次，与年份无可靠映射。按批次筛本质是"取序号最大的 N 个批次"，不等于"近 N 年"。建议：面试题按 `--filter-year` 精确筛；笔试题若无年份字段，全保留或只剔明显过期的时政类（按 tags），不机械按批次切。

### 6) GitHub Actions 自动构建（可选）
把 `assets/auto-build.yml` 复制到仓库 `.github/workflows/auto-build.yml`：push 改动数据/配置后，自动重建 `data-*.js` + `config.js` + `VERSION.json` 并 commit，触发 Cloudflare 重部署。
> ⚠️ 推送含此文件的 commit 需要 GitHub Token 带 **`workflow` scope**（仅有 `repo` 会被拒）。

## 步骤 C：导出 Anki 复习卡片（CSV / apkg）

```bash
python scripts/anki_export.py data.json                          # 默认出 anki_cards.csv
python scripts/anki_export.py data.json --group-by year,type     # CSV 嵌套标签分组
python scripts/anki_export.py data.json --apkg --subdeck-by year,type   # .apkg 真·子牌组
```
详见 `references/schema.md` 与脚本内帮助。

---

## 步骤 C2：已有 Anki 卡包批量加结构化框架（答题框架头）

> 适用：客户/自己反馈卡包答案"不是结构化"（像抖音结构化面试那样有框架），或要让 Anki 卡包与网页站 `data-interview.json` 的 `framework` 字段保持同一套标准时。

```bash
python scripts/add_framework_to_anki.py 输入.apkg -o 输出.apkg --overwrite
# 自定义题型→思路映射 / tag 别名映射：
python scripts/add_framework_to_anki.py 输入.apkg --framework-json 我的映射.json --tag-map-json 我的tag映射.json
# 默认还会清洗答案里 "" 连续双引号脏数据；不想洗加 --no-clean
```

- 解包 `.apkg` → 读 `notes` 表 → 按卡片 `tags`（退路：Front 的 `【年份 · 题型】`）判定题型 → 在 Back 第一个 `<div class="module ` 前插入「🧩 结构化思路（答题框架）」模块（题型/思路/要点，内联蓝框样式，导入任何设备都显示正常）→ 重打包（必带 `media`）。
- 默认映射覆盖辅警/公考五大题型（综合分析/应急应变/组织管理/人际沟通/自我认知与职位匹配）。
- **坑**：题型 tag 可能写法特殊（如 `组织管理` 写成 `组织协调`）；先 print 未命中题的实际 tag 再补映射。
- 默认生成 `_structured.apkg` 不破坏原包；确认无误再决定是否覆盖源文件（覆盖前先备份）。
- 网页站 (`sz/index.html`) 用 `data-interview.json` 的 `framework` 字段渲染同款框架；本脚本让 Anki 卡包复用同一映射，保证**网页版与 Anki 版口径统一**，根治"网页是结构化、卡包不是"的预期差。

---

## 部署：推 GitHub → 托管 Cloudflare（在线版）

1. 站点目录（HTML 外壳 + `data-*.js` + `config.js` + `VERSION.json` + `_headers`）推到 GitHub。
2. Cloudflare Pages 连 Git 仓库，构建设置选「无 / None」，输出目录 `/`。
3. 部署完得 `*.pages.dev` 域名；以后改题 push 即自动重新部署。
4. `viewer.html` 复制为 `index.html` 作为站点入口。

## 缓存与响应头（Cloudflare Pages）

把 `assets/headers_template.txt` 存入仓库根 `_headers`：`/*.html` 短缓存；`/data-*.js` CDN 长缓存 + 浏览器每小时校验（避免 immutable 导致更新不刷新）；图片 `no-cache`（换图自动更新，无需强刷）。

## 校验清单（上线前必跑）

- `node --check data.js`；`node -e "global.window={};require('./data.js');console.log(window.DATA.length)"` 确认条数不丢。
- `<script` 开标签数 === `</script>` 闭标签数；内联脚本内部不得出现 `</script>`。
- HTML 内已无残留 `var DATA = [`（数据已外置）。
- Anki CSV：记事本打开确认 `正面,反面,标签` 三列、逗号分隔。

## 常见坑

- **`</script>` 在注释里**：外置说明注释若写成 `（由 <script src=...></script> 提供）`，浏览器会提前结束脚本 → 整页失效。注释只写文件名。
- **顺序陷阱**：数据 `<script>` 若 `defer` 而应用脚本不 `defer`，应用会先跑导致 `DATA` 未定义。要么都同步、要么都 `defer`。
- **改了题 GitHub 不更新**：`data-*.js` 用 CDN 长缓存 + 浏览器每小时校验，最迟 1 小时生效；图片用 `no-cache` 自动更新。
- **推 GitHub 出现 `workflow scope` 报错**：403。解决：① Token 勾选 `workflow` scope 重推；② 或暂时 `git rm -r .github/workflows` 后提交再推（站点照常可用）。

## 资源索引

- `scripts/extract_data.py` — 内联数组 → 外置 data.js（主线 A）
- `scripts/doc_to_csv.py` — 文本型 PDF/Word(.docx)/txt/md → 草稿 CSV（主线 B，自动切题）
- `scripts/ingest.py` — 源文件(CSV/XLSX/JSON/TXT) → data.json（主线 B）
- `scripts/build_data.py` — data.json → 离线 data.js；`--config` 生成 config.js；`--emit-version` 生成 VERSION.json（主线 B）
- `scripts/anki_export.py` — data.json → Anki 卡片（CSV / 可选 apkg）（主线 C）
- `scripts/add_framework_to_anki.py` — 已有 .apkg 卡包批量加结构化答题框架头（题型/思路/要点）+ 清洗双引号脏数据（步骤 C2）
- `scripts/md_to_interview.py` — 面试 markdown → 面试 CSV
- `assets/viewer.html` — **笔试+面试合一通用查看器模板**：自动识别题型、🎲随机抽题+倒计时、面试🎤录音演练、掌握度追踪、深色模式、配置驱动（`window.SITE_CONFIG`）、模块开关（`enabledModules`）、页脚版本标识。复制为 `index.html` 即用。改样式/文案只动本文件或 `template-config.json`，不动数据。
- `assets/template-config.sample.json` — 站点可编辑配置样例（全字段），由 `build_data.py --config` 编译成 `config.js`
- `assets/auto-build.yml` — GitHub Actions 自动构建模板（含 VERSION 生成）
- `assets/headers_template.txt` — 可直接用的 `_headers`
- `assets/data.sample.json` — 单/多/判三种题型样例
- `assets/题库模板.csv` / `assets/题库模板_面试.csv` — 笔试/面试 CSV 起点
- `references/手册.md` — 一页式上手手册
- `references/getting_started.md` — 极简上手
- `references/schema.md` — 题库对象 schema、列名别名、源格式规范
- `references/deploy_cloudflare.md` — GitHub→Cloudflare Pages 部署全流程
- `references/cloudflare_headers.md` — _headers/preload/校验
- `references/quiz_template.md` — 推荐目录结构与 README/SETUP 规范
