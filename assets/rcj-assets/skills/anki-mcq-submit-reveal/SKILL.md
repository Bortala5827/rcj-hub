---
name: anki-mcq-submit-reveal
description: 辅警/公考 Anki 刷题卡包的统一模板标准。Part 1：笔试选择题「提交后显答案」交互（单选/多选/判断统一）；Part 2：面试录音卡（配合 Feynman Audio 插件，零 JS 静态模板 + 结构化分析）。当要新建或修复 Anki .apkg 时使用。
---

# Anki 卡包统一模板标准

> 本技能包含两套独立但可共存的模板，外加一个转换工具：
> - **Part 1** — 笔试选择题（单选/多选/判断）：提交后才显答案
> - **Part 2** — 面试录音卡（配合 Feynman Audio 插件：零 JS 静态模板 + 录音 + 结构化分析）
> - **Part 3** — 转换工具：把已有的「Front/Back 富 HTML 面试卡包」（如深圳辅警面试真题）一键升级为 Part 2 录音卡模型，并自动加「显示提示词」折叠
>
> 两套模板可在同一 `.apkg` 中以**不同模型**共存，互不影响。

---

# Part 1：笔试选择题「提交后显答案」模板

## 何时用
- 新建辅警/公考/任何选择题类 Anki 笔试题卡包，需要"先选、再提交、后显答案"的交互。
- 修复已有卡包：原模板是"点击选项立即出对错"（如 Qoder 生成的版本），要改成提交后才揭示。
- 审计题型标签：有些单选题被错标成多选（或反向），需要按客观规则批量校正。

## 关键认知（重要）
- `.apkg` = zip，内含 `collection.anki2`（SQLite）+ `media`（媒体映射，纯文本卡为 `{}`）。改完务必保留 `media`。
- 标准模型字段顺序：`题型, 批次, 编号, 题干, 选项, 答案, 解析, is_单选, is_多选, is_判断, answer_letter`。
  - `题型`：文字 `单选题/多选题/判断题`。
  - `is_单选/is_多选/is_判断`：对应题型填 `Y`，其余空。
  - `answer_letter`：干净答案字母，单选/判断=1 个字母（判断为 `A`/`B`），多选=2+ 个字母（如 `ABC`）。**这是题型客观判定的黄金信号**。
  - `选项`：HTML，`<div class="opt"><span class="opt-l">A</span>. 选项文字</div>`。
- 常规用 3 个模板（单选/多选/判断），卡片 `ord` 1:1 对应题型：`0=单选, 1=多选, 2=判断`。每题只生成 1 张卡。
- `req` 必须按 `is_*` 字段生成卡片：`[[0,"all",[is_单选索引]],[1,"all",[is_多选索引]],[2,"all",[is_判断索引]]]`，否则在 Anki 里点"卡片"会误生成重复卡。

## 统一交互模板（黄金标准，脚本 `scripts/apply_template.py` 即按此写入）
- **单选 / 判断**：单选模式（点一个取消另一个）；**多选**：多选模式（独立开关）。
- 底部统一「提交」按钮：**点提交后**才揭示 —— 选对的标绿、选错的标红、未选的正确项也标绿提示，并显示反馈文字（`✓ 回答正确！` / `✗ 回答错误，正确答案：X` 或 `X、Y`）。
- 提交后锁定选项、按钮变「已提交，翻面看解析」。
- 三段模板共用**同一段 JS**（仅 `meta` 文字与 `card` 配色 class 不同），保证行为完全统一。

### 需追加的 CSS
```css
.opt.selected {
  border-color: #0ea5e9 !important;
  background: #e0f2fe !important;
  box-shadow: 0 0 0 2px #0ea5e9;
}
.submit-btn {
  margin-top: 16px; display: block; width: 100%;
  padding: 12px 0; font-size: 15px; font-weight: 700; color: #fff;
  background: #0d9488; border: none; border-radius: 10px; cursor: pointer; letter-spacing: 1px;
}
.submit-btn:hover { background: #0f766e; }
.submit-btn:disabled { background: #94a3b8; cursor: default; }
```

### 统一 QFMT（三类模板共用，仅替换 `__LABEL__` 与 `__CLASS__`）
```
<div class="card __CLASS__">
<div class="meta">__LABEL__ · {{批次}} · #{{编号}}</div>
<div class="stem">{{题干}}</div>
<div class="options" id="opts-front">{{选项}}</div>
<div class="hint">选择答案后点击「提交」查看对错</div>
<button class="submit-btn" id="submit-btn" type="button">提交</button>
<span class="ans-key" id="ans-key">{{answer_letter}}</span>
<script>
(function(){
  var key=document.getElementById('ans-key'); if(!key) return;
  var correct=key.textContent.trim().split('').filter(function(c){return c;});
  var ansDiv=document.getElementById('opts-front'); if(!ansDiv) return;
  var btn=document.getElementById('submit-btn');
  var opts=Array.prototype.slice.call(ansDiv.querySelectorAll('.opt'));
  var multi = correct.length>1;
  var submitted=false;
  function clearSel(){ opts.forEach(function(x){x.classList.remove('selected');}); }
  opts.forEach(function(o){
    o.classList.add('opt-interactive');
    o.addEventListener('click',function(){
      if(submitted) return;
      if(multi){ o.classList.toggle('selected'); } else { clearSel(); o.classList.add('selected'); }
    });
  });
  if(btn){ btn.addEventListener('click',function(){
    if(submitted) return; submitted=true; btn.disabled=true; btn.textContent='已提交，翻面看解析';
    opts.forEach(function(o){
      o.classList.remove('opt-interactive');
      var lbl=o.querySelector('.opt-l'); if(!lbl) return;
      var letter=lbl.textContent.trim();
      var isCorrect=correct.indexOf(letter)>=0; var isSel=o.classList.contains('selected');
      if(isCorrect){ o.classList.add('reveal-correct'); if(isSel) o.classList.add('selected-correct'); }
      else if(isSel){ o.classList.add('selected-wrong'); }
    });
    var selLetters=opts.filter(function(x){return x.classList.contains('selected');})
      .map(function(x){return x.querySelector('.opt-l').textContent.trim();});
    var fb=document.createElement('div'); fb.className='feedback-msg'; var ok;
    if(multi){
      ok = correct.length===selLetters.length && correct.every(function(c){return selLetters.indexOf(c)>=0;});
      fb.textContent = ok ? '✓ 全部正确！' : '✗ 回答错误，正确答案：'+correct.join('、');
    } else {
      ok = (selLetters.length===1 && selLetters[0]===correct[0]);
      fb.textContent = ok ? '✓ 回答正确！' : '✗ 回答错误，正确答案：'+correct[0];
    }
    fb.className += (ok?' feedback-correct':' feedback-wrong');
    ansDiv.appendChild(fb);
  }); }
})();
</script>
</div>
```
（`__LABEL__` = `单选题`/`多选题`/`判断题`；`__CLASS__` = `type-dan`/`type-duo`/`type-pan`。`answer_letter` 经 `.ans-key` 隐藏读取，用户看不到。）

### 统一 AFMT（背面，三类相同）
```
<div class="card __CLASS__">
<div class="meta">__LABEL__ · {{批次}} · #{{编号}}</div>
<div class="stem">{{题干}}</div>
<div class="options">{{选项}}</div>
<div class="ans-block"><div class="ans-title">正确答案</div><div class="ans">{{答案}}</div></div>
<div class="exp-block"><div class="exp-title">解析</div><div class="exp">{{解析}}</div></div>
</div>
```

## 题型标签审计规则（客观、可复核）
按"黄金信号" `answer_letter` 重判真实题型，再对齐 `题型`/`is_*`/tag/卡片 `ord`：
1. `len(answer_letter) >= 2` → **多选题**（多个正确项）。
2. 否则 `len == 1`：看选项是否为"正确/错误"（或"对/错"）两选项 → **判断题》；否则 → **单选题**。
3. 真实题型 ≠ 当前标签时，校正：改 `题型` 文字、`is_*` 只留对应项为 `Y`、tag 换成对应类型、卡片 `ord` 改为对应值；若当前 `答案` 含 `（多选）` 但真实非多选，则去掉该标记。
- 审计会打印每处变更（旧→新）供人工复核；`--fix-tags` 才真正写入。

## Part 1 工作流
```bash
# 1) 仅审计（预览，不改动）
python scripts/apply_template.py 输入.apkg
# 2) 应用统一交互 + 修正错标题型，输出新文件（不覆盖原包）
python scripts/apply_template.py 输入.apkg --fix-tags -o 输出.apkg
```
- 未指定 `-o` 时默认输出 `<输入>_提交显答案.apkg`。**默认不覆盖原包**，确认无误再替换。
- 仅当模型含 `answer_letter` 与 `is_单选/is_多选/is_判断` 字段时才生效，否则安全跳过并提示。

---

# Part 2：面试录音卡（零 JS + Feynman Audio 插件）

> ⚠️ **实现方式已变更（2026-07-16）**：原「MediaRecorder + Web Speech API」JS 方案在 Anki Desktop **不可用**（内嵌浏览器屏蔽麦克风 / 无 STT 后端），且带 `<script>` 的卡片 review 时**易卡死**。现改为**零 JS 静态模板** + **Feynman Audio - NB 插件**录音：
> - 卡片模板**不含任何 `<script>`**，提示词用原生 `<details>` 折叠，绝不会卡死。
> - 录音由插件（Python 级，调 Anki 原生 `editor.onRecSound()`）以 `[sound:xxx]` 写入「录音」字段，Anki 原生渲染播放器，桌面版可用、零额外依赖。

## 何时用
- 建设辅警面试练习卡包：用户看到题目后**口头作答并录音**，翻面后听自己录音 + 对比答题框架和参考答案。
- 适用于所有结构化面试题型：**综合分析、组织管理、应急应变、人际沟通、自我认知、岗位匹配、漫画/演讲/串词**等。

## 核心能力

| 能力 | 技术方案 | 平台支持 |
|------|---------|---------|
| 录音 | Feynman Audio - NB 插件（Anki 原生 `onRecSound`，`Ctrl+Shift+R` 或右上角麦克风）写入「录音」字段 `[sound:xxx]` | ✅ Anki Desktop（插件需安装）；⚠️ 不做语音转文字 |
| 录音回放 | 背面 `{{录音}}` 由 Anki 原生渲染 `<audio>` 播放器 | ✅ 所有平台 |
| 提示词折叠 | 原生 `<details>` 标签（零 JS） | ✅ 所有平台 |
| 框架提示 | 正面 `<details>` 展开「答题框架」字段 | ✅ 所有平台 |
| 得分关键词 | 生成时由 Python 预处理成 chips HTML（零 JS 渲染） | ✅ 所有平台 |

## 字段定义（7 fields，顺序固定）

| 序号 | 字段名 | 说明 | 示例 |
|------|--------|------|------|
| 0 | 题目 | 面试问题原文 | 请谈谈你对"枫桥经验"的理解... |
| 1 | 题型分类 | 题型标签 | 综合分析 |
| 2 | 答题框架 | 结构化要点(文本，每行一个要点)，同时作为正面「显示提示词」内容 | 见下方格式说明 |
| 3 | 参考答案 | 完整示范回答(HTML)，可含格式化 | 各位考官好... |
| 4 | 得分关键词 | 采分点，逗号/换行分隔 | 发动群众,矛盾化解,源头治理 |
| 5 | 录音 | **Feynman 插件写入**的 `[sound:xxx]`（导入时为空，复习录音后自动填充） | （导入留空） |
| 6 | 编号 | 题号，正面 meta `#编号` 用条件渲染；留空则不显示 | 12 |

> ⚠️ **`req` 必须用 `[[0,"any",[0]]]`**（题目非空即生成卡片）。绝不能用 `all` 要求全部字段非空——`录音` 字段永远为空，会导致**0 张卡片生成**。

### 「显示提示词」折叠（默认折叠，零 JS）
正面 QFMT 用原生 `<details class="hint-details">` 包裹「答题框架」字段：
- 仅当 `答题框架` 字段非空时才渲染（`{{#答题框架}}...{{/答题框架}}`）。
- 默认**折叠**，点击 `<summary>` 展开——建议用户先盲答，卡壳时再展开。无需任何脚本。
- 建议：导入后首刷前在 Anki 桌面端点「卡片」确认开关与录音按钮正常。

### 答题框架格式（重要！直接影响覆盖检测效果）
每行一个要点，开头可用序号标记。JS 会自动提取关键字（≥2字的词组）与用户转写文字做包含匹配：

```
① 开头破题：表明态度 + 总观点（枫桥经验是基层治理的金钥匙）
主体第一点：发动群众参与基层治理（依靠群众、群防群治）
主体第二点：矛盾源头化解不上交（源头治理、多元调解）
主体第三点：科技赋能智慧警务建设
结尾升华：结合辅警岗位表态
```

> **格式要求**：每行一个得分要点，括号内可补充同义关键词（增加匹配命中率）。避免把整段话写成一行——那样只能匹配到一个超长字符串。

### 得分关键词格式
用中文逗号、顿号、换行或英文逗号分隔：
```
发动群众,矛盾化解,源头治理,群防群治,多元调解,智慧警务,平安建设
```
这些词会在**参考答案中被黄色高亮**，同时在**框架覆盖检测中作为匹配依据**。

## 正面 QFMT（录音 + STT + 提交）

完整代码见 `templates/interview_template.py`（变量 `_QFMT_INTERVIEW`）。核心 UI 流程：

```
┌──────────────────────────────────┐
│ 🎤 面试演练 · 综合分析 · #001   │
├──────────────────────────────────┤
│ [题目] 请谈谈你对"枫桥经验"...  │
│                                  │
│ ┌─ 录音区 ────────────────────┐ │
│ │ ● 点击开始录音答题  00:00   │ │
│ │     [🎤 开始录音]           │ │
│ │     [■ 停止] [▶ 回放]       │ │
│ │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │ │
│ ├─ 转文字 ────────────────────┤ │
│ │ 🔍语音转文字  [开启识别]     │ │
│ │ ┌─────────────────────────┐ │ │
│ │ │ 实时转写文字区域...      │ │ │
│ │ └─────────────────────────┘ │ │
│ └──────────────────────────────┘ │
│        [提交答案，查看解析]       │
└──────────────────────────────────┘
```

### 录音行为细节
- 点击「开始录音」→ 请求麦克风权限 → 开始录制（webm/opus 格式）
- 录音中：按钮变红色脉冲动画，计时器走动，波形条活跃
- 可随时「停止录音」（或再次点击录音按钮停止）
- 停止后：自动将录音转为 base64 存入 localStorage（供背面恢复播放/下载）
- 「回放」按钮可立即听刚才录的内容

### STT 行为细节
- 点「开启识别」→ 启动 Web Speech API（连续模式，zh-CN）
- 实时显示：**最终结果**（黑色）+ **临时结果**（下划线灰色）
- 录音结束时自动停止 STT（避免浪费资源）
- 若浏览器不支持（AnkiDroid/Mobile），按钮置灰并提示

### 提交行为
- 点「提交」→ 锁定所有控件（录音/STT/提交按钮全部禁用）
- 将最终转写文字、录音时长写入 localStorage（键名基于题目内容哈希，确保唯一）
- 按钮变为灰色「已提交，翻面查看解析」

## 背面 AFMT（结构化分析 + 参考答案）

完整代码见 `templates/interview_template.py`（变量 `_AFMT_INTERVIEW`）：

```
┌──────────────────────────────────┐
│ 🎤 面试演练 · 综合分析 · #001   │
├──────────────────────────────────┤
│ [题目] 请谈谈你对"枫桥经验"...  │
│                                  │
│ 🗣 你的回答                      │
│ ┌──────────────────────────────┐ │
│ │ 我认为枫桥经验的核心是...     │ │
│ └──────────────────────────────┘ │
│                                  │
│ 📋 答题框架覆盖检查              │
│ ✓ 开头破题：表明态度+总观点       │
│ ✓ 主体第一点：发动群众参与...    │
│ ✗ 主体第二点：矛盾源头化解...   │
│ ✓ 结尾升华：结合岗位表态         │
│ ┌──────────────────────────────┐ │
│ │  框架覆盖率 80% (4/5)        │ │
│ │     — 还有提升空间            │ │
│ └──────────────────────────────┘ │
│                                  │
│ 📖 参考答案                      │
│ 各位考官好，关于枫桥经验...       │
│ （🔑得分关键词已黄色高亮）        │
│                                  │
│ ⭐ 得分关键词                    │
│ [发动群众] [矛盾化解] [源头治理]  │
│                                  │
│ 🔊 [音频播放器] [💾 下载录音]    │
└──────────────────────────────────┘
```

### 背面四大模块

1. **你的回答** — 从 localStorage 读取正面提交时的转写文字展示。若未开启 STT 则显示"(未检测到语音转写内容)"。

2. **答题框架覆盖检查** — 解析 `答题框架` 字段的每一行：
   - 提取每行的关键词（去掉前缀序号标记，按空格/标点分割 ≥2 字的词组）
   - 逐一检查用户转写文字是否包含任一关键词
   - ✓ 绿色 = 覆盖（命中），✗ 红色 = 未涉及
   - 底部汇总：覆盖率百分比 + 评级（≥80% 优秀 / ≥40% 有提升空间 / <40% 建议重理思路）

3. **参考答案** — 渲染 `参考答案` 字段 HTML，并将 `得分关键词` 中每个词用 `<span class="kw-highlight">` 黄色高亮标注。

4. **录音操作栏** — 从 localStorage 恢复录音 base64，内嵌 `<audio>` 播放器 + 「下载录音.webm」链接。若未录音则提示"未检测到录音文件"。

## CSS（面试专用样式）

完整 CSS 约 200 行，见 `templates/interview_template.py`（变量 `INTERVIEW_CSS`）。主要模块：
- `.record-panel` / `.rec-btn-*` — 录音控制区（绿色开始/红色录音中/橙色停止/蓝色回放）
- `.stt-panel` — 转文字面板（黄色主题）
- `.user-answer-block` — 用户回答区（红色边框）
- `.framework-check` / `.fc-item` — 框架检查列表（紫色主题）
- `.ref-answer-block` / `.kw-highlight` — 参考答案 + 关键词高亮
- `.keywords-block` / `.kw-chip` — 关键词标签云
- `.audio-actions` / `.dl-link` — 录音操作栏

> ⚠️ 注意：面试 CSS 与笔试 CSS **不冲突**，它们属于不同的模型（model）。同一个 apkg 里可以同时有笔试模型和面试模型，各自携带自己的 CSS。

## Part 2 工作流

```bash
# 从 CSV/JSON 数据创建面试卡包
python scripts/create_interview_deck.py 数据.csv -o 输出.apkg
python scripts/create_interview_deck.py 数据.json -o 输出.apkg

# CSV 格式要求（首行为字段名，需包含：题目,题型分类,答题框架,参考答案,得分关键词）
# 编号自动生成；录音字段留空
```

CSV 格式示例：
```csv
题目,题型分类,答题框架,参考答案,得分关键词
请谈谈你对"枫桥经验"的理解，结合辅警工作谈谈如何践行。,综合分析,"① 开头破题：表明态度+总观点（枫桥经验是基层治理金钥匙）
主体第一点：发动群众参与基层治理（依靠群众、群防群治）
主体第二点：矛盾源头化解不上交（源头治理、多元调解）
主体第三点：科技赋能智慧警务
结尾升华：结合辅警岗位表态","各位考官好，关于枫桥经验的理解...",发动群众,矛盾化解,源头治理,群防群治
```

---

# Part 3：转换已有「Front/Back 面试卡包」为语音答题模型

## 何时用
- 已有按 `Front`（题目）/`Back`（解析）两字段排版的面试卡包（如「深圳辅警面试真题精选」「广东辅警面试真题」），想升级成交互版：录音答题 + 显示提示词开关 + 结构化分析 + 录音下载。
- 适用前提：原 `Back` 已由结构化模块构成（结构化思路/考察能力/出题逻辑/高频表达/深圳元素/易踩坑/参考答案等），脚本会**解析并重组**这些模块到 7 字段，并合并原 CSS 保留排版。

## 字段映射规则（自动解析，无需手工）
| 目标字段 | 来源（原 HTML 标记） |
|---------|--------------------|
| 题目 | Front `.card-question` |
| 题型分类 | Back `back-footer` 的 `类型::xxx`（兜底 Front `【年份 · 类型】`） |
| 答题框架 | Back `结构化思路（答题框架）` 块内 3 行（即「提示词」内容） |
| 参考答案 | 重组 Back 的 考察能力+出题逻辑+高频表达+深圳元素+易踩坑+参考答案段落（保留 `.module` 类名） |
| 得分关键词 | Back `.hf-tag` + `.sz-kw` 文本去重合并 |
| 录音 | 空（导入时）；运行时由 Feynman Audio 插件写入 `[sound:xxx]` |
| 编号 | 自动 1..N |

- 原 tags 保留，并追加 `面试` 标签；牌组名取原包非 `Default` 的牌组名 + `（录音版）`。
- **CSS 合并**：新 CSS = 面试专用样式 + 原包 CSS，但剔除原包 `.card` / `.card-front` / `.card-back` 规则（避免污染新卡片的 `.card-interview` 布局），仅保留 `.module`/`.hf-tag`/`.sz-*`/`.pitfall-*`/`.answer-text` 等模块样式。

## 工作流
```bash
# 转换（输出不覆盖原包）
python scripts/transform_existing_deck.py 深圳辅警面试真题精选_修复版.apkg \
    -o 深圳辅警面试真题精选_录音版.apkg
# 未指定 -o 时默认 <输入>_语音答题.apkg
```
解析健壮性：每个模块独立提取、缺失模块自动跳过（如部分题无高频表达/深圳元素）；题型缺省时标记 `未分类` 标签。

---

# 通用注意事项（Part 1 & Part 2 共用）

- 改完 `notes.flds` / 模板后更新 `notes.mod`、`col.mod`、模型 `mod` 为当前时间戳，避免 Anki 同步告警。
- 重打包保留 `media`（即便 `{}`），否则 Anki 报损坏。用 `zipfile` 以 `ZIP_DEFLATED` 写 `collection.anki2` + `media`。
- 内联 JS 上线前用 `node --check` 过一遍语法，避免导入即崩。
- **Part 1** 是所有辅警/公考 Anki 笔试题卡包的**统一标准**；新建卡包直接采用，不要回退到"选了就出答案"。
- **Part 2** 是面试练习卡的**创新标准**；利用 Anki Desktop 的 WebView 能力实现录音+STT+智能分析，填补了"面试无工具练"的空白。
- 两套模板可以**在同一 apkg 中共存**（不同 model name），笔试和面试数据互不影响。

## 模板编写陷阱（血泪教训）
- ⚠️ **不要在 `r"""..."""` 原始字符串里写 `\uXXXX` 转义**！原始字符串中的 `\uXXXX` 不会被解码，Anki 渲染时用户会看到满屏字面 `\u9762\u8bd5...` 而非中文。模板里的所有中文/符号必须写成**真实字符**。`templates/interview_template.py` 已统一解码为真实字符；今后若改动模板，用真实汉字/emoji，不要用 `\u` 转义。JS 字符串里的 `\u2713`(✓) 等会被浏览器正常解释，但保险起见也直接写真实符号。
- ⚠️ **面试 `req` 必须用 `any`**（`[[0,"any",[0]]]`），因为 `录音` 字段恒为空；用 `all` 会导致卡片不生成。
