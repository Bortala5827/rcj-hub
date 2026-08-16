# 上手指南（极简版）

把"上传题目/答案 → 自动拆分进 data.json"这件事，做成**不费 token、不需要懂代码**的日常动作。

---

## 0. 核心心法：题目存文件，别贴进对话

| 错误做法 ❌ | 正确做法 ✅ |
|---|---|
| 把 900 道题全文粘贴到 AI 对话框 | 题目存成 `题目.csv`，对话里只发"处理这个文件" |
| 每轮对话 AI 都重读几十万字符，token 爆、易截断 | 上下文只有文件路径 + 几条命令，脚本去读文件 |

> 原理：`ingest.py` 在**你的机器上**读文件、写 `data.json`，AI 只需要知道"跑哪个脚本、处理哪个文件"。题目正文从不进入聊天记录，所以既省 token，又不怕长文本被截断。

---

## 1. 准备题目文件（三选一，推荐 CSV）

最省事：在 Excel / WPS 里整理好，直接「另存为 → CSV（UTF-8）」。
不会排版也能用 TXT（一行一题，用 `||` 或 `#` 分隔字段）。

### CSV 模板列（照抄表头即可，列名中英文都认）

| 列名 | 含义 | 说明 / 别名 |
|---|---|---|
| 题号 | 序号 | 序号 / 编号 / no（可空，自动补） |
| 批次 | 分类 | 分类 / 章节 / 模块 / 类别 |
| 题型 | 单选/多选/判断/填空/简答 | 单 / 多 / 判 / 填 / 问答 也认 |
| 题干 | 题目正文 | 题目 / 问题 |
| 选项A | A 选项内容 | 选项 a/b/c/d… 最多支持到 F |
| 选项B | B 选项内容 | |
| 选项C | C 选项内容 | 没有的列留空即可 |
| 选项D | D 选项内容 | |
| 答案 | 正确选项 | 多选写 `A,C` 或 `A、C` 或 `AC`（自动转数组）；判断写 对/错 |
| 解析 | 答案解析 | 答案解析 / 详解（可空） |
| 标签 | 知识点 | 标签 / 知识点 / 考点（可空） |

> 直接复制本 skill 的 `assets/题库模板.csv` 当起点，填好存盘即可。

**两套题库用两套模板**（结构不同，别混用）：
- 选择题（笔试）→ `assets/题库模板.csv`：列含 `选项A~D`、`答案`、`解析`。
- 开放题（面试）→ `assets/题库模板_面试.csv`：列是 `年份,场次,题型,标题,答案,标签`（无选项列；`题型`填分类名原样保留；`答案`整段参考答案不被逗号拆开）。

---

## 2. 放到项目目录

把 `题目.csv` 放到你的站点项目根目录（和 `written.html` / `index.html` 同级）。

---

## 3. 对 AI 说一句话（复制即用）

**在 WorkBuddy 里**（本 skill 会自动匹配）：
> 用 rcj-exam-builder 处理项目里的 `题目.csv`，拆分进 `data.json`，并生成离线 `data.js`。

**在其他 AI（通义 / 豆包 / ChatGPT 等）**：
> 我附件里有 `ingest.py`、`build_data.py` 和 `题目.csv`。请用这两个脚本处理 `题目.csv`：先 `python ingest.py 题目.csv -o data.json` 生成可编辑题库，再 `python build_data.py data.json -o data.js` 生成网页运行时。题型归一、多选答案转数组、题号自动补，都按脚本默认来。处理完告诉我每步的结果和题目总数。

AI 会跑脚本、回报结果，**题目内容全程不进对话框**。

---

## 4. 一行命令速查

```bash
# ① 拆分：源文件 → 可编辑 data.json
python ingest.py 题目.csv -o data.json

# ② 构建：data.json → 网页运行时 data.js（离线 file:// 可双击打开）
python build_data.py data.json -o data.js

# ③ 一条龙（CSV 直接出 data.js，同时留 data.json 方便以后改）
python ingest.py 题目.csv -o data.json && python build_data.py data.json -o data.js

# 其他格式同理
python ingest.py 题目.xlsx -o data.json --sheet 0   # Excel（需 pip install openpyxl，否则另存 CSV）
python ingest.py 题目.json  -o data.json            # 已是题库 JSON，直接规整
python ingest.py 题目.txt   -o data.json            # 行式文本，用 || 或 # 分隔
```

---

## 4.5 双题库（笔试 + 面试）实战

你的站点有两套独立题库，各挂一个页面。**各自用各自的 `data.json` + `data.js`，互不影响**：

| 题库 | 源文件 | 运行时 | 页面 |
|---|---|---|---|
| 笔试（选择题） | `data-written.json` | `data-written.js` | `written.html` |
| 面试（开放题） | `data-interview.json` | `data-interview.js` | `index.html` |

**新增笔试题**：
```bash
python ingest.py 笔试新题.csv       -o data-written.json
python build_data.py data-written.json -o data-written.js
```
**新增面试题**（用 `题库模板_面试.csv`）：
```bash
python ingest.py 面试新题.csv       -o data-interview.json
python build_data.py data-interview.json -o data-interview.js
```
> 只动某一套时，只重建对应的那个 `data.js`，另一套原样不动。两个页面引用的脚本名不同，不会串。

对 AI 说一句话（双题库版）：
> 用 rcj-exam-builder 处理项目里的 `笔试新题.csv` 和 `面试新题.csv`：笔试拆进 `data-written.json` 并生成 `data-written.js`；面试拆进 `data-interview.json` 并生成 `data-interview.js`。两套各自独立，别混。

## 5. 以后改题 / 加题

1. 编辑 `data.json`（人读、好改，每条一题）。
2. 跑 `python build_data.py data.json -o data.js` 重建运行时。
3. HTML 已通过 `<script src="data.js">` 引用，刷新即生效，**不用改 HTML**。

> 想批量加新题：把新题追加到 CSV，重新 `ingest` 覆盖 `data.json` 即可（或与旧 json 合并后重建）。

---

## 6. 常见问题

- **Excel 是 .xlsx**：需要 `pip install openpyxl`；没有就「另存为 CSV」最省事。
- **CSV 中文乱码**：保存时选 **UTF-8**（Excel 默认 GBK，可「数据→从文本」导入或换 WPS 导出 UTF-8）。
- **没有 Python/node 环境**：`ingest`/`build_data` 纯 Python 标准库，装个 Python 即可；`extract_data.py` 的 node 校验是可选增强，没 node 会自动跳过。
- **选项超过 4 个**：列名写到 选项E / 选项F 即可，脚本最多支持 A–F。
