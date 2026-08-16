# 面试演练卡 — 录音版（配合 Feynman Audio 插件，零 JS）
# ==================================================
# 正面：题目 → 提示词折叠(<details> 原生) → 录音提示
# 背面：我的录音回放([sound:]) → 参考答案(模块HTML) → 得分关键词(chips)
# 适用：Anki Desktop（安装 Feynman Audio - NB 插件后，复习按 Ctrl+Shift+R 录音）
# 设计原则：卡片模板零 JavaScript，彻底规避 Anki 桌面版脚本限制 / 卡死问题。
# 录音由插件以 [sound:xxx] 写入「录音」字段，Anki 原生渲染播放器，无需任何前端代码。

# ─────────────────────────────────────
# 1. 正面模板 QFMT（题目 + 提示词折叠 + 录音提示）
# ─────────────────────────────────────
_QFMT_INTERVIEW = r"""<div class="card card-interview">
<div class="meta">面试演练 · {{题型分类}}{{#编号}} · #{{编号}}{{/编号}}</div>

<div class="question-box">
  <div class="q-label">题目</div>
  <div class="stem">{{题目}}</div>
</div>

{{#答题框架}}
<details class="hint-details">
  <summary>&#128161; 显示提示词（答题框架）</summary>
  <div class="hint-body">{{答题框架}}</div>
</details>
{{/答题框架}}

<div class="record-tip">
  <span class="rt-icon">&#127908;</span>
  <span>复习时按 <b>Ctrl+Shift+R</b>（或点右上角麦克风图标）录音作答，音频会自动存入背面「我的录音」。</span>
</div>
</div>"""

# ─────────────────────────────────────
# 2. 背面模板 AFMT（录音回放 + 参考答案 + 关键词）
# ─────────────────────────────────────
_AFMT_INTERVIEW = r"""<div class="card card-interview">
<div class="meta">面试演练 · {{题型分类}}{{#编号}} · #{{编号}}{{/编号}}</div>

<div class="question-box">
  <div class="q-label">题目</div>
  <div class="stem">{{题目}}</div>
</div>

<div class="audio-block">
  <div class="ab-title">&#127908; 我的录音</div>
  {{#录音}}
  <div class="ab-player">{{录音}}</div>
  {{/录音}}
  {{^录音}}
  <div class="ab-empty">尚未录音 — 复习时按 Ctrl+Shift+R 录制你的作答，翻面即可回放</div>
  {{/录音}}
</div>

<div class="ref-answer-block">
  <div class="ra-title">&#128218; 参考答案</div>
  <div class="ra-content">{{参考答案}}</div>
</div>

{{#得分关键词}}
<div class="keywords-block">
  <div class="kw-title">&#11088; 得分关键词 / 采分点</div>
  <div class="kw-list">{{得分关键词}}</div>
</div>
{{/得分关键词}}
</div>"""

# ─────────────────────────────────────
# 3. CSS（零 JS，提示词折叠用原生 <details>）
# ─────────────────────────────────────
INTERVIEW_CSS = """
/* ====== 面试演练卡样式（录音版·零JS） ====== */
.card-interview { max-width: 620px; margin: 0 auto; font-family: -apple-system,"Microsoft YaHei","PingFang SC",sans-serif; color: #1e293b; }
.card-interview .meta { color: #6b7280; font-size: 12px; margin-bottom: 10px; letter-spacing: 0.5px; }

/* 题目区 */
.question-box { background: linear-gradient(135deg,#f0fdf4,#ecfdf5); border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.q-label { font-size: 11px; color: #15803d; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
.card-interview .stem { font-size: 15px; line-height: 1.65; }

/* 提示词折叠（原生 <details>，零 JS） */
.hint-details { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 4px 14px; margin-bottom: 14px; }
.hint-details > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: #0f766e; padding: 8px 0; user-select: none; list-style: none; }
.hint-details > summary::-webkit-details-marker { display: none; }
.hint-details > summary::before { content: "\25B8"; color: #0d9488; margin-right: 6px; display: inline-block; transition: transform 0.15s; }
.hint-details[open] > summary::before { transform: rotate(90deg); }
.hint-body { font-size: 13px; line-height: 1.7; color: #134e4a; padding: 8px 0 6px; white-space: pre-wrap; border-top: 1px dashed #ccfbf1; margin-top: 2px; }

/* 录音提示条 */
.record-tip { display: flex; align-items: flex-start; gap: 8px; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.6; color: #1e40af; }
.record-tip .rt-icon { font-size: 16px; flex-shrink: 0; line-height: 1.4; }
.record-tip b { color: #1d4ed8; }

/* 录音回放 */
.audio-block { background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.ab-title { font-size: 13px; color: #991b1b; font-weight: 700; margin-bottom: 8px; }
.ab-player audio { width: 100%; height: 40px; }
.ab-empty { font-size: 12px; color: #94a3b8; font-style: italic; }

/* 参考答案（模块样式合并自源库 CSS） */
.ref-answer-block { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
.ra-title { font-size: 13px; color: #1e40af; font-weight: 700; margin-bottom: 8px; }
.ra-content { font-size: 13px; line-height: 1.75; }

/* 得分关键词 chips（生成时已由 Python 预处理成 span.kw-chip） */
.keywords-block { background: #fff7ed; border: 1.5px solid #fdba74; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.kw-title { font-size: 12px; color: #9a3412; font-weight: 700; margin-bottom: 8px; }
.kw-list { display: flex; flex-wrap: wrap; gap: 6px; }
.kw-chip { background: #ffedd5; color: #c2410c; font-size: 12px; padding: 3px 10px; border-radius: 12px; font-weight: 500; border: 1px solid #fed7aa; }
"""

# ─────────────────────────────────────
# 4. 字段定义（7 fields，顺序固定）
# ─────────────────────────────────────
INTERVIEW_FIELDS = [
    {"name": "题目", "font": "Arial", "size": 20, "rtl": False},
    {"name": "题型分类", "font": "Arial", "size": 12, "rtl": False},
    {"name": "答题框架", "font": "Arial", "size": 15, "rtl": False},
    {"name": "参考答案", "font": "Arial", "size": 18, "rtl": False},
    {"name": "得分关键词", "font": "Arial", "size": 12, "rtl": False},
    {"name": "录音", "font": "Arial", "size": 0, "rtl": False},   # 插件写入 [sound:xxx]
    {"name": "编号", "font": "Arial", "size": 12, "rtl": False},
]

# ─────────────────────────────────────
# 5. 模板定义（仅 ord=0 一张卡）
# ─────────────────────────────────────
INTERVIEW_TEMPLATES = [
    {
        "name": "面试录音卡",
        "ord": 0,
        "qfmt": _QFMT_INTERVIEW,
        "afmt": _AFMT_INTERVIEW,
        "bqfmt": "",
        "bafmt": "",
        "did": None,
        "bfont": "",
        "bsize": 0,
    }
]

# req: 模板 ord=0 在「题目」(field 0) 非空时即生成卡片。
# 「录音」字段(field 5) 导入时为空（录音在用户复习时由插件写入），
# 故不能用 "all" 要求全部非空，否则卡片不会被生成。
INTERVIEW_REQ = [[0, "any", [0]]]
