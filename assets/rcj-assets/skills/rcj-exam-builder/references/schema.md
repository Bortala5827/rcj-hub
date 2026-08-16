# 题库数据 Schema 与源文件规范

本 skill 把"题目/答案"与"页面"解耦：题目维护在 `data.json`（人读、好改），
再由 `build_data.py` 生成 `data.js`（`window.DATA`，离线 `file://` 可直接 `<script>` 加载，无需 fetch）。

## 一、题库对象 Schema（data.json 的元素）

```jsonc
{
  "num": 1,                       // 题号（缺则自动顺延）
  "batch": "第一批·单选题",        // 批次 / 分类 / 章节（可选）
  "type": "single",               // single|multiple|judge|blank|qa（自动归一）
  "stem": "题干文本……",            // 题干（必填，空则跳过该题）
  "options": [                    // 选项数组；判断/填空/简答可无
    { "letter": "A", "text": "选项内容" },
    { "letter": "B", "text": "选项内容" }
  ],
  "answer": "D",                  // 单选=字母；多选=["A","C"]；判断=对/错/正确/错误
  "explanation": "解析文本……",     // 解析（可选）
  "tags": "行政处罚法 考点",        // 标签/知识点（可选）
  "_idx": 0                       // 数组下标，构建时自动写入，勿手改
}
```

### type 归一映射
| 中文/别名 | 归一值 | 说明 |
|---|---|---|
| 单选 / 单 / single / 单选题 | `single` | 单选 |
| 多选 / 多 / multiple / 多选题 | `multiple` | 多选，answer 为数组 |
| 判断 / 判 / judge / 判断题 | `judge` | 答案保持 对/错/正确/错误 |
| 填空 / 填 / blank | `blank` | 填空 |
| 简答 / 问答 / qa | `qa` | 简答 |

### answer 归一
- 单值：`A`、`B` … 保持字符串。
- 多值：`A,C` / `A、C` / `AC` → 自动转为 `["A","C"]`（去重保序）。
- 判断：`对`/`错`/`正确`/`错误` 原样保留。

### 面试 / 开放题对象 Schema（无选项，答案原样保留）

```jsonc
{
  "year": "2025",                         // 年份（可选）
  "session": "2025年11月30日 上午",         // 场次 / 期次（可选）
  "type": "自我认知与职位匹配",             // 面试分类，原样保留（不归一为 single）
  "title": "请谈谈你对基层一线工作的理解?",     // 题目（对应笔试的 stem）
  "answer": "这句话实在…先说多走一点…",      // 参考答案 / 解析，整段字符串，不被逗号拆开
  "tags": "岗位认知",                       // 标签（可选）
  "_idx": 0                               // 构建时自动写入
}
```
> 面试数据**没有 num / options**，`ingest.py` 会自动识别（含 title/year/session）并不强行补 `num`；`answer` 始终作为整段字符串保留。

### 列名别名（中英文均可，自动匹配表头）
- 题号/序号/编号/no → `num`
- 批次/分类/章节/模块/类别 → `batch`
- 题型/题目类型 → `type`
- 题干/题目/问题/题目内容 → `stem`（笔试）
- 标题/title → `title`（面试；与 stem 二选一作为题目）
- 年份/年度 → `year`（面试）
- 场次/期次/日期/date → `session`（面试）
- 选项A..F / A选项 / 答案A … → `options`
- 答案/正确答案/正确选项 → `answer`
- 解析/答案解析/答案详解/详解 → `explanation`
- 标签/知识点/考点 → `tags`

> 不在上表中的列会被忽略；`stem` 与 `title` 都没有的行会被跳过。

## 二、支持的源文件格式（ingest.py 输入）

| 格式 | 支持度 | 说明 |
|---|---|---|
| `.csv` | ✅ 原生 | utf-8-sig 自动识别；逗号/制表符分隔；首行表头 |
| `.txt` | ✅ 原生 | 每行一题，字段用 `\|\|` / `#` / 制表符 分隔；固定列序：`题干\|题型\|A\|B\|C\|D\|答案\|解析\|标签\|批次\|题号` |
| `.json` | ✅ 原生 | 已是题库数组，或 `{ "questions": [...] }` |
| `.xlsx` | ⚠️ 需 openpyxl | `pip install openpyxl`；否则提示"另存为 CSV" |

## 三、日常增改题目的标准流程

```bash
# 1) 上传新题（Excel 先另存为 CSV）
python ingest.py 新题.csv -o data.json          # 源文件 → 可编辑 data.json

# 2) 生成离线运行时
python build_data.py data.json -o data.js        # data.json → data.js

# 3) 要更小体积
python build_data.py data.json -o data.js --minify

# 一步到位（顺带保留 data.json 便于以后维护）
python build_data.py 新题.csv -o data.js --from csv --keep-json data.json
```

之后**只改 `data.json`**（加对象 / 改字段），重跑第 2 步即可，`data.js` 自动更新。
HTML 里保持 `<script src="data.js"></script>`（置于应用脚本之前），无需改动页面代码。

### 双题库项目（笔试 + 面试 各一套，互不干扰）

两套题库用**各自独立的 `data.json` + `data.js`**，分别挂到各自的 HTML 页。
文件命名建议加后缀区分，例如：

| 题库 | 源文件 | 运行时 | 对应页面 |
|---|---|---|---|
| 笔试（选择题） | `data-written.json` | `data-written.js` | `written.html` |
| 面试（开放题） | `data-interview.json` | `data-interview.js` | `index.html` |

笔试用"`题库模板.csv`"（含选项列），面试用"`题库模板_面试.csv`"（年份/场次/标题/答案）。
各自独立跑，互不影响：

```bash
# —— 笔试：新增/修改选择题 ——
python ingest.py 笔试新题.csv   -o data-written.json     # 选择题 CSV → 笔试源
python build_data.py data-written.json -o data-written.js

# —— 面试：新增/修改开放题 ——
python ingest.py 面试新题.csv   -o data-interview.json   # 面试 CSV（年份/场次/标题/答案）
python build_data.py data-interview.json -o data-interview.js

# 只改某套题时，只重建对应那一个 data.js，另一套原样不动
```

> 面试 CSV 列：`年份,场次,题型,标题,答案,标签`；`题型`填分类名（如 自我认知与职位匹配），
> 会原样保留；`答案`是整段参考答案，不会被逗号拆开；不写选项列、不写题号。

## 四、为什么是 data.json + data.js 两份

- `data.json`：人维护的**源**，好读好改，适合后续"增加与修改"。
- `data.js`：浏览器**运行时**。用 `window.DATA = ...` + `<script src>` 而非 `fetch('data.json')`，
  是为了兼容 **离线 `file://` 双击打开**（fetch 在 file:// 下被 CORS 拦截），也兼容 CDN 长缓存。
- 两者通过 `build_data.py` 联动，改源即重建，避免手改内联大数组。
