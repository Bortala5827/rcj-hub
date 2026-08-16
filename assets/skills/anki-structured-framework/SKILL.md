---
name: anki-structured-framework
description: 给已有的 Anki .apkg 卡包（面试/笔试题）批量注入「结构化答题框架」模块（题型/思路/要点），并清洗 CSV 转义残留的双引号脏数据，重新打包成可导入的 .apkg。当你需要把口语化长段答案的卡包改造成一眼结构化、或与网页刷题站同套标准时使用。
---

# Anki 卡包批量加结构化框架

## 何时用
- 客户/自己反馈 Anki 卡答案"不是结构化"，要像抖音结构化面试那样有框架。
- 已有 `.apkg` 卡包，答案口语化、长段、看不出模块。
- 要让 Anki 卡包与 `rcj-exam-builder` 网页站保持同一套"🧩 结构化思路"标准。
- 答案里出现 `""xxx""` 这类 CSV 转义残留的双引号（显示会出问题）。

## 关键认知（重要）
- `.apkg` = zip，内含 `collection.anki2`（SQLite 数据库）+ `media`（媒体映射 JSON，纯文本卡时为 `{}`）。
- 每张卡在 `notes` 表，`flds` 字段用 `\x1f` 分隔，模型字段顺序一般是 `Front\x1fBack`。
- 题型信息通常在卡片 `tags`（空格分隔），如 `综合分析 2025 高频 深圳特色`，也可能写在 Front 的 `【年份 · 题型】` 文字里。
- **不要**直接改源码映射后永久删原包——先生成新文件，确认无误再覆盖。

## 工作流程
1. **探查结构**（先用 Read/Grep 或一段 Python 确认）：
   - 题数、字段顺序、题型怎么标（tags 还是 Front 文字）、Back 现有模块、脏数据题数。
   - 常见坑：`组织管理` 题型在 tag 里可能写作 `组织协调`；务必 print 未命中题的实际 tag。
2. **运行脚本** `scripts/add_framework_to_anki.py`：
   ```bash
   python scripts/add_framework_to_anki.py 输入.apkg -o 输出.apkg --overwrite
   # 自定义映射：
   python scripts/add_framework_to_anki.py 输入.apkg --framework-json 我的映射.json --tag-map-json 我的tag映射.json
   ```
   - 默认映射覆盖辅警/公考五大题型（综合分析/应急应变/组织管理/人际沟通/自我认知与职位匹配）。
   - 框架块插入位置：Back 第一个 `<div class="module ` 之前（即题干之后、参考答案之前）。
   - 默认会清洗 `""` 连续双引号脏数据；`--no-clean` 可关。
3. **验证**：重新解包新 .apkg，确认 ① 全部题含 `结构化思路（答题框架）` ② 脏数据残留 0 ③ 题型分布正确。
4. **交付**：默认生成 `_structured.apkg` 不破坏原包；用户确认无误后再决定是否覆盖源文件。

## 注意事项
- 框架块用**内联样式**（蓝框），不依赖卡牌模板 CSS，导入任何设备都显示正常。
- 题型判定优先用 tags，退路用 Front 的 `【年份 · 题型】` 文字；若你的题型标签写法特殊，用 `--tag-map-json` 覆盖。
- 改完 `notes.flds` 后顺手更新 `notes.mod` 和 `col.mod` 为当前时间戳，避免 Anki 不同步提示。
- 重打包务必保留 `media` 文件（哪怕是 `{}`），否则 Anki 导入报损坏。

## 与 rcj-exam-builder 的配合
网页站 (`sz/index.html`) 通过 `data-interview.json` 的 `framework` 字段渲染框架头；本 skill 让 Anki 卡包复用同一套题型→思路/要点映射，保证**网页版与 Anki 版口径统一**，根治"网页是结构化的、卡包不是"的预期差。
