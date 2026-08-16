---
name: rcj-written-exam-standard
description: RCJ 辅警/招考笔试刷题站「定向刷题 + 套题模考」标准实现规范。当要为某城市/考试构建笔试学习站、或改造已有刷题站的答题/模考逻辑时使用。固化标准：①有批次的笔试题既可按批次整套刷、也可随机生成卷刷；②套题模考（机考）参照惠州模式（按批次刷整套真题 + 自定义随机卷双模式）；③所有题型一律"选选项→点提交→才显示对错+答案"，并用高亮块（绿=对/红=错/描边=漏选正确答案）呈现；④模考默认无时间限制（计时为可选配置）。含可直接复用的 HTML/CSS/JS 参考实现与关键防坑点（_idx 缺失会导致按钮完全无反应）。
agent_created: true
---

# RCJ 笔试刷题站 · 标准实现规范（定向刷题 + 套题模考）

为某城市辅警/招考笔试构建**纯前端刷题站**时，笔试部分的体验必须统一遵守本标准。本规范来自深圳站（`sz/index.html`）、惠州站（`hz/index.html`）已上线、经 jsdom 实测通过的实现，可直接复用其代码结构，避免重复踩坑。

> 仅适用于**笔试（written）**模块。面试（interview）保持"开放作答 + 提交后展示参考答案 + 🎙️录音"模式，不在此规范范围内。

## 何时使用 / 触发词

- 「做个 X 城市辅警笔试刷题站」「笔试刷题系统」「按批次刷真题」
- 「加套题模考 / 机考模式」「模考按批次刷整套真题」
- 「点选项就出答案了，要改成提交后才显示」「选项高亮块标对错」
- 「模考 60 分钟计时去掉 / 不限制时间」
- 改造现有 `fujing-mianshi/<城市>/index.html` 的笔试答题/模考逻辑时

## 核心标准（四条，必须全部满足）

1. **有批次的笔试题，两种刷法都要有**
   - 📚 **按套题批次刷**：下拉列出全部 `batch`，选哪批刷哪批，**保留原题顺序**（像真实考卷），不随机打乱。
   - 🎲 **随机生成刷题**：按题型（单选/多选/判断）设数量，从全库随机抽题打乱。
   - 两者在「套题模考」出卷设置里用「出卷方式」下拉切换；切换时自动隐藏/显示对应控件。
2. **套题模考（机考）参照惠州模式**：即「按批次刷整套真题 + 自定义随机卷」双模式并存，提交后统一判分、正确率+评级。惠州站是此模式的范本。
3. **提交后才显示对错与答案（所有题型统一）**
   - 单选/判断：点选项是**选中高亮**，不判分；点「✅ 提交答案」才判并显示。
   - 多选：勾选多个，点「提交答案」判分。
   - 显示时用**高亮块**：✅绿块=答对的选项、❌红块=你选错的项、绿色描边=你没选但正确的项（漏选）。
   - 浏览模式（定向刷题）与模考模式**都遵守此规则**，不要"点击即判"。
4. **模考默认无时间限制**：移除 60 分钟倒计时条；出卷说明写明"全程无时间限制"。计时为可选配置项（`examPreset.minutes` / 界面时间输入），但**我们交付的标准版本默认不限时**（遵循深圳站定稿决策）。

## 设计风格约定（避免「花里胡哨」，强制）

### ⚠️ 品牌视觉核心资产（永远不可丢失/替换，最高优先级）

**RCJ9527 品牌形象图**（`assets/brand-mascot-rcj9527.png`）——鹰头人身穿皮夹克、臂章 RCJ + 胸前 9527——是本项目的**核心品牌标识与视觉灵魂**：

1. **永远不可删除、覆盖或替换此图**。任何重构、换模板、改版操作都必须保留此文件在 `assets/` 目录中。
2. **任何新建站点/页面都应考虑使用此品牌图作为视觉锚点**：首页 hero 区、关于页、闲鱼商品封面图素材等。它是 RCJ9527 在买家心中的识别符号。
3. **离线版打包时必须包含此图**（如用于品牌展示区域）。
4. **原图备份位置**：`C:/Users/小样儿/Desktop/RCJ业务/11.png`（桌面业务文件夹）。如 `assets/` 里的副本意外丢失，从此处恢复。
5. **品牌色参考**：图中夹克的蓝白配色（深蓝 `#1e3a5f` + 白 `#f8fafc` + 金色臂章）可作为站点的主题色参考，保持品牌一致性。

> 决策来源（2026-07-14）：用户明确「永远不要丢，这是核心法则」。

刷题站是**学习工具，不是游戏**，交付版本一律保持克制、专业，**严禁任何音效与音效开关**：

1. **不要音效开关 / 静音按钮**：右上角不放 🔊/🔇 切换按钮（`#muteToggle` 这类）。
2. **不要 Web Audio 提示音**：答对/标记掌握时不要播放 `AudioContext` 的「叮」声（`playDing()` 这类）。
3. **撒花（纯视觉）可保留**：答对、面试标记「已掌握」时可以有 CSS 彩带飘落（`.fx-confetti`，纯前端 emoji 动画、无外部文件），这是**唯一**允许的趣味反馈——它不发声、不干扰。
4. **标题必须带城市/省标识**：`SITE_CONFIG.siteTitle` 必须含具体城市/省名（如「深圳辅警真题卡组」「惠州辅警真题卡组」「广东省辅警统考通用真题库」），不要用通用的「辅警真题卡组」，否则多城引流时用户分不清。

> 决策来源（2026-07-14）：用户明确「把所有的音效开关都删掉，太花里胡哨了」。已从 `shared/app.js` 移除「静音+撒花」模块里的 `isMuted/setMuted/playDing` 及按钮接线，`celebrate()` 仅保留 `playConfetti()`；`template.html` 删 `#muteToggle` 按钮；`app.css` 删 `.mute-toggle` 样式。新城市站照此标准，不要再加回音效。

5. **引流文案统一（线上预览 → 闲鱼成交漏斗）**：`SITE_CONFIG.promoText` 统一用以下文案，把线上站定位为「引流钩子」、把成交导到闲鱼：
   ```
   线上预览版网络可能不稳定，建议用离线版（双击即用、可自由修改）。需要完整题库或私人定制，去🔍搜用户名 <b>RCJ9527</b>。
   ```
   - 不要写「开源项目/Anki 卡组」这类弱化成交的话术（旧版已废弃）。
   - 核心逻辑：线上预览只是尝鲜 → 强调离线版更稳定可改 → 完整题库/定制在闲鱼 `RCJ9527` 成交。
   - 决策来源（2026-07-14）：用户明确「线上预览版本网络不稳定，相当于从线上引流到闲鱼成交」，三站已统一此文案（commit `4e8f3f5`）。
   - **闲鱼入口叫法必须统一（防重复/打架）**：站点有两个闲鱼入口——①工具栏「获取完整版」按钮（`xianyu` 模块，复制 `xianyuCode` 并弹层）；②底部 `promoText` banner。两者最终都指向搜索 `RCJ9527`，**文案必须一致**：统一称 `RCJ9527` 为「用户名」，禁止在按钮/弹层里写「口令」「粘贴口令搜索」等与 banner「搜用户名」冲突的措辞（旧版 `获取完整版口令`/`口令已复制` 已废弃，commit `0f03812`）。
   - **⚠️ 首页静态区禁止出现站外导流敏感词（小红书/公域发布合规，强制）**：小红书等平台对笔记里的「闲鱼/店铺/口令」等站外导流词会限流或删帖，因此：
     - **首页直接可见的文案（工具栏按钮、底部 banner 文案与按钮）一律不得写「闲鱼/店铺/口令」**。正确写法：工具栏按钮 `🔑 获取完整版`、底部 banner 按钮 `📋 复制作者ID`、banner 文案 `去🔍搜用户名 <b>RCJ9527</b>`（不写"闲鱼"二字）。
     - **导流引导只放在「点击后才弹出的二级弹层」（`xianyuToastOverlay`）里**：弹层说明可写「用户名已自动复制，请打开闲鱼 App，粘贴搜索…找到店铺获取完整版」，弹层按钮可写「🐟 打开闲鱼 App」。弹层不出现在首页静态渲染，截图发小红书看不到，安全。
     - 决策来源（2026-07-14）：用户发现首页写「去闲鱼找店铺」会影响发小红书，要求首页静态区去敏感词（commit `c3fc3c4`）。

## 数据模型要求（笔试 data 数组每条）

```js
{
  "_idx": 0,            // ⚠️ 必须！用作 DOM 绑定 data-idx，缺失会导致提交按钮完全无反应
  "num": 1,             // 题号（展示用）
  "batch": "第一批",    // 批次（用于"按批次刷"分组，可含题型后缀如"第一批·单选题"）
  "type": "single",     // single | multi | bool（多值别名：multiple/多选题/judge/判断/判断题 须归一化）
  "stem": "题干...",
  "options": [ { "letter": "A", "text": "..." }, ... ],  // letter 必须 A/B/C/D…
  "answer": "D",        // 单选/判断为单字母；多选为 "AB" 或 ["A","B"]
  "explanation": "解析...",
  "tags": "..."         // 可选
}
```

**关键防坑**：页面用内联 `window.DATA_WRITTEN` 时，务必在初始化时为每条补 `_idx`：
```js
[W_DATA, I_DATA, G_DATA].forEach(function (arr) {
  arr.forEach(function (q, i) { if (q._idx == null) q._idx = i; });
});
```
> 真实事故：深圳站内联数据漏 `_idx` → 按钮 `data-idx="undefined"` → `parseInt("undefined")=NaN` → `studyQuestionByIdx` 找不到题 → 点击**完全无反应**。惠州/广东站数据含 `_idx` 所以正常。此补丁让任何数据源都安全。

**判断题 letter 规范**：数据里判断项常为 `{letter:"正确",text:"正确"}`，直接渲染会变成"正确。正确"。加载后须把判断项 `options.letter` 顺序映射为 `A/B`、`answer` 同步映射；显示答案时再由 `displayAnswer()` 转回"正确/错误"。

---

## 模块一：笔试定向刷题（按批次刷 + 随机刷，提交后高亮）

### 1) 筛选区（批次 + 题型双维度，避免批次平铺太乱）

```js
function activeDimensions() {
  return MODE === "interview"
    ? [{ key: "year", label: "年份" }, { key: "type", label: "题型" }, { key: "tag", label: "标签" }]
    : [{ key: "batch", label: "批次" }, { key: "type", label: "题型" }]; // 笔试加"题型"第二维度
}
```

渲染时每行用 `.filter-row`（含 `.filter-label` + `.filter-btns` 容器包裹按钮），批次多时仍整齐。

### 2) 卡片渲染（选项 + 提交按钮 · 双保险）

```js
// 选项 + 提交按钮（type=button 防表单默认行为；内联 onclick + 事件委托双保险）
var opts = q.options.map(function (o) {
  return '<div class="opt-row study-opt" data-idx="' + q._idx + '" data-letter="' + o.letter + '">'
    + '<span class="opt-letter">' + o.letter + '.</span>'
    + '<span class="opt-text">' + escapeHtml(o.text) + '</span></div>';
}).join("");
html += '<div class="study-opts">' + opts + '</div>'
      + '<div class="study-answer" id="ans' + q._idx + '" style="display:none;">'
      +   (q.explanation ? '<div class="study-explain">解析：' + formatAnswer(q.explanation) + '</div>' : '')
      + '</div>'
      + '<div class="study-check"><button type="button" class="study-check-btn" data-idx="' + q._idx
      +   '" onclick="revealStudyAnswer(' + q._idx + ')">✅ 提交答案</button></div>';
```

### 3) 点击选中（不判分）+ 提交判分（事件委托）

```js
document.getElementById("questionsList").addEventListener("click", function (e) {
  var opt = e.target.closest(".study-opt");
  if (opt) {
    if (opt.classList.contains("locked")) return;           // 已提交则锁定
    var card = opt.closest(".card");
    var idx = parseInt(opt.dataset.idx, 10);
    var q = studyQuestionByIdx(idx); if (!q) return;
    if (q.type === "multi" || q.type === "multiple") {
      opt.classList.toggle("selected");                     // 多选：toggle
    } else {
      card.querySelectorAll(".study-opt").forEach(function (o) { o.classList.remove("selected"); });
      opt.classList.add("selected");                        // 单/判：互斥选中
    }
    return;
  }
  var btn = e.target.closest(".study-check-btn");
  if (btn) revealStudyAnswer(parseInt(btn.dataset.idx, 10));
});
```

### 4) 提交后显示（高亮块核心）

```js
function revealStudyAnswer(idx) {
  var q = studyQuestionByIdx(idx); if (!q) return;
  var card = document.getElementById("q" + idx);
  var selLetters = [];
  card.querySelectorAll(".study-opt.selected").forEach(function (o) { selLetters.push(o.dataset.letter); });
  var btn = card.querySelector(".study-check-btn");
  var ansEl = document.getElementById("ans" + idx);
  if (selLetters.length === 0) {                            // 未选则提示，不判
    if (btn) { var orig = btn.textContent; btn.textContent = "⚠️ 请先选择答案";
      setTimeout(function () { btn.textContent = orig; }, 1200); }
    return;
  }
  card.querySelectorAll(".study-opt").forEach(function (o) {
    var L = o.dataset.letter;
    var isCorr = q.answer != null && String(q.answer).indexOf(L) !== -1;
    var sel = o.classList.contains("selected");
    if (sel) o.classList.add(isCorr ? "ok" : "bad");        // 选中且对→绿；选中且错→红
    else if (isCorr) o.classList.add("right");             // 没选但正确→绿描边（漏选）
    o.classList.add("locked");
  });
  ansEl.style.display = "block";
  ansEl.insertBefore(makeResultBanner(isCorrect(q, selLetters), q), ansEl.firstChild);
  if (btn) btn.style.display = "none";
}
function makeResultBanner(isCorrect, q) {
  var d = document.createElement("div");
  d.className = "ans-result " + (isCorrect ? "ans-correct" : "ans-wrong");
  d.innerHTML = isCorrect ? "✅ 回答正确"
    : "❌ 回答错误，正确答案：<b>" + escapeHtml(displayAnswer(q)) + "</b>";
  return d;
}
```

### 5) 高亮块 CSS（笔试浏览模式）

```css
.opt-row.study-opt.selected { border-color: var(--primary); background: rgba(37,99,235,.10);
  box-shadow: 0 0 0 2px rgba(37,99,235,.25); font-weight: 600; }
.opt-row.study-opt.ok   { border-color: #16a34a; background: rgba(22,163,74,.12); }  /* 选对 */
.opt-row.study-opt.bad  { border-color: #dc2626; background: rgba(220,38,38,.10); }  /* 选错 */
.opt-row.study-opt.right{ border-color: #16a34a; box-shadow: inset 0 0 0 2px rgba(22,163,74,.45); } /* 漏选的正确项 */
.ans-result{margin:10px 0 0;padding:9px 14px;border-radius:10px;font-weight:700;border:1px solid transparent}
.ans-result.ans-correct{background:rgba(22,163,74,.10);color:#15803d;border-color:rgba(22,163,74,.35)}
.ans-result.ans-wrong{background:rgba(220,38,38,.10);color:#b91c1c;border-color:rgba(220,38,38,.35)}
```

---

## 模块二：套题模考（机考，参照惠州模式）

### 1) 出卷设置 UI（出卷方式切换：按批次 / 随机）

```html
<div class="exam-setup-overlay" id="examSetupOverlay" style="display:none;">
  <div class="exam-setup-card">
    <h3 class="exam-setup-title">📝 套题模考 · 出卷设置</h3>
    <p class="exam-setup-tip">两种出卷方式：① <b>按套题批次</b> 直接刷整套真题；② <b>自定义随机卷</b> 按题型数量随机抽题。打字题为附加项不计入分，<b>全程无时间限制</b>。</p>
    <div class="exam-setup-row">
      <label>出卷方式</label>
      <select class="exam-setup-select" id="examPlanMode">
        <option value="batch">📚 按套题批次刷（整套真题）</option>
        <option value="random">🎲 自定义随机卷</option>
      </select>
    </div>
    <div class="exam-setup-row" id="examBatchRow">
      <label>选择批次</label>
      <select class="exam-setup-select" id="examBatch"></select>
    </div>
    <div class="exam-setup-grid" id="examCountGrid" style="display:none;">
      <!-- cntSingle / cntMulti / cntBool 三个数量输入 -->
    </div>
    <div class="exam-setup-cell exam-setup-cell-wide">
      <label class="exam-setup-check"><input type="checkbox" id="typingOn" checked> 含打字题</label>
      <div class="exam-setup-typing-min"><span>打字时长</span>
        <input type="number" min="1" id="examMinutesTyping" class="exam-setup-input exam-setup-input-sm" value="10"> <span>分钟</span></div>
    </div>
    <div class="exam-setup-info" id="examSetupInfo"></div>
    <div class="exam-setup-actions">
      <button class="exam-btn exam-btn-ghost" id="examSetupCancel">取消</button>
      <button class="exam-btn exam-btn-ghost" id="examSetupPreset" type="button">↺ 标准模考</button>
      <button class="exam-btn exam-btn-primary" id="examSetupStart">🚀 开始模考</button>
    </div>
  </div>
</div>
```

> **不渲染 60 分钟计时条**：模考视图里不要 `<div class="exam-timer-bar">`，`startExam()` 里也不要调 `startExamTimer()`。

### 2) 重建试卷（batch=整套真题顺序 / random=按题型随机）

```js
function getBatchesInOrder(){            // 按出现顺序取出卷批次
  var seen=[], map={};
  dataset().forEach(function(q){ var b=q.batch||"未注明"; if(!map[b]){map[b]=true;seen.push(b);} });
  return seen;
}
function countByType(list){ var per={single:0,multi:0,bool:0};
  list.forEach(function(q){ var t=normType(q.type); if(per[t]!==undefined) per[t]++; }); return per; }
function buildExamPaperByType(counts){   // 随机卷：各题型取指定数量
  var data=dataset(), byType={single:[],multi:[],bool:[]};
  data.forEach(function(q){ var t=normType(q.type); if(byType[t]) byType[t].push(q); });
  var chosen=[], per={single:0,multi:0,bool:0}, shortage=[];
  ["single","multi","bool"].forEach(function(t){
    var want=counts[t]||0, pool=byType[t].slice(); shuffleArr(pool);
    var take=Math.min(want,pool.length);
    if(want>0 && take<want) shortage.push(typeLabel(t)+"仅有 "+pool.length+" 题");
    per[t]=take; chosen=chosen.concat(pool.slice(0,take));
  });
  shuffleArr(chosen);
  return { list:chosen, meta:{per:per,shortage:shortage} };
}
function rebuildPaper(cfg){
  if (cfg.plan === "batch") {            // 按批次刷：保留原题顺序，不随机
    var list = dataset().filter(function(q){ return (q.batch||"未注明")===cfg.batch; });
    return { list:list, meta:{per:countByType(list),shortage:[]} };
  }
  return buildExamPaperByType(cfg.counts);
}
```

### 3) 出卷确认（分支两种模式）

```js
function confirmExamSetup(){
  var plan = document.getElementById("examPlanMode").value;
  var typing = document.getElementById("typingOn").checked;
  var typingMinutes = parseInt(document.getElementById("examMinutesTyping").value,10)||10;
  var cfg;
  if (plan === "batch") {
    var b = document.getElementById("examBatch").value;
    if (!b) { alert("请选择要刷的批次"); return; }
    cfg = { plan:"batch", batch:b, typing:typing, typingMinutes:typingMinutes };
  } else {
    var counts = { single:+…cntSingle, multi:+…cntMulti, bool:+…cntBool };
    if (counts.single+counts.multi+counts.bool < 1) { alert("请至少设置 1 道客观题"); return; }
    cfg = { plan:"random", counts:counts, typing:typing, typingMinutes:typingMinutes };
  }
  examLastCfg = cfg;
  document.getElementById("examSetupOverlay").style.display = "none";
  enterExamView();
  var paper = rebuildPaper(cfg);
  examPaperList = paper.list; examPaperMeta = paper.meta;
  examTypingOn = typing; examTypingMinutes = typingMinutes;
  startExam();                          // ⚠️ 不再调 startExamTimer()
}
```

### 4) 模考卡片渲染 + 作答 + 提交判分

```js
function buildExamCard(q, n){
  var card=document.createElement("div"); card.className="exam-q"; card.id="examQ"+q._idx;
  var multi=(q.type==="multiple"||q.type==="multi");
  var opts=(q.options||[]).map(function(o){
    return '<div class="exam-opt" data-idx="'+q._idx+'" data-letter="'+o.letter+'" data-multi="'+(multi?1:0)+'">'
      +'<span class="exam-opt-letter">'+o.letter+'.</span>'
      +'<span class="exam-opt-text">'+escapeHtml(o.text)+'</span>'
      +'<span class="exam-mark"></span></div>';
  }).join("");
  card.innerHTML='<div class="exam-q-head">…题干…</div>'
    +'<div class="exam-opts">'+opts+'</div>'
    +'<div class="exam-explain" id="examExp'+q._idx+'"><div>答案：<b>'+escapeHtml(displayAnswer(q))+'</b></div>…</div>';
  return card;
}
// 作答（事件委托，与浏览模式同思路：选中不判，提交才判）
examQuestions.addEventListener("click", function(e){
  var opt=e.target.closest(".exam-opt"); if(!opt||examGraded) return;
  var idx=+opt.dataset.idx, letter=opt.dataset.letter, multi=opt.dataset.multi==="1";
  if(multi){ /* toggle 多选 */ }
  else { examSelections[idx]=[letter]; /* 单选互斥 */ }
});
function submitExam(){
  if(examGraded && MODE==="written") return;
  examGraded=true; stopExamTimer();
  var list=examPaperList, correct=0, total=list.length, wrong=0;
  list.forEach(function(q){
    var sel=examSelections[q._idx]||[];
    var isCorrect = gradeCheck(q, sel);           // 按题型判分
    var card=document.getElementById("examQ"+q._idx);
    card.classList.add("graded");
    card.insertBefore(makeResultBanner(isCorrect,q), card.firstChild);
    isCorrect ? (correct++, card.classList.add("graded-correct"))
              : (wrong++, card.classList.add("graded-wrong"));
    var ansArr=normAnsArr(q.answer);
    (q.options||[]).forEach(function(o){
      var el=card.querySelector('.exam-opt[data-letter="'+o.letter+'"]'); if(!el) return;
      var isAns=ansArr.indexOf(String(o.letter).trim())!==-1;
      if(isAns) el.classList.add("correct");
      if(sel.indexOf(o.letter)!==-1 && !isAns) el.classList.add("wrong");
      var mk=el.querySelector(".exam-mark");
      if(isAns) mk.textContent="✅"; else if(sel.indexOf(o.letter)!==-1) mk.textContent="❌";
    });
  });
  // 顶部显示 correct / total + 正确率 + 评级
}
```

### 5) 模考高亮块 CSS

```css
.exam-opt.selected{border-color:var(--primary-light);background:var(--primary-bg)}
.exam-opt.correct{border-color:#16a34a;background:rgba(22,163,74,.1)}   /* 正确项绿块 */
.exam-opt.wrong{border-color:#dc2626;background:rgba(220,38,38,.08)}   /* 你选错的红块 */
.exam-q.graded-correct{border-color:#16a34a;box-shadow:0 0 0 1px rgba(22,163,74,.3)}
.exam-q.graded-wrong{border-color:#dc2626;box-shadow:0 0 0 1px rgba(220,38,38,.3)}
.exam-mark{margin-left:auto;font-size:15px}                            /* ✅/❌ 标记位 */
.exam-explain{display:none} .exam-q.graded .exam-explain{display:block} /* 提交后才展开答案 */
```

---

## 关键防坑清单（上线前必查）

1. **`_idx` 缺失 → 提交按钮完全无反应**（最高频事故）。初始化务必补 `_idx`（见上方数据模型）。
2. **按钮必须是 `type="button"`**：否则在 `<form>` 内被当 submit 导致页面刷新、事件丢失。
3. **提交按钮双保险**：内联 `onclick="revealStudyAnswer(N)"` + 事件委托 `closest(".study-check-btn")` 都绑，任一种失效仍能提交。
4. **判断题 letter 规范化**：加载后把判断项 `options.letter` 映射 `A/B`，否则界面出现"正确。正确"。
5. **模考无计时**：确认 `startExam()` 不调 `startExamTimer()`，视图无 `exam-timer-bar`（本标准要求）。
6. **分页渲染大题库**：列表默认 40 题一批（appendBatch），不一次注入全部 DOM，避免首屏卡顿。
7. **提交后锁定**：`locked` 类防重复判分；按钮 `display:none` 防重复提交。

## 参考实现（已上线、jsdom 实测通过）

- 深圳笔试（套题模考双模式 + 无计时 + 提交高亮）：`/产品交付/fujing-mianshi/sz/index.html`
- 惠州笔试（机考范本，按批次刷 + 自定义随机卷）：`/产品交付/fujing-mianshi/hz/index.html`
- 广东统考站（同模板，数据含 `_idx`）：`/产品交付/fujing-mianshi/gd/index.html`

> 新建城市站时：复制 `sz/index.html` 外壳 → 替换 `window.DATA_WRITTEN` 内联数据（确保含 `batch`/`_idx`）→ 改 `window.SITE_CONFIG` 品牌文案 → 无需改答题/模考逻辑即满足本标准。
