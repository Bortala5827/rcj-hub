# Google Mic Recorder（谷歌风录音按钮组件）

> 三态录音 UI 组件：空闲(灰底白图标) → 悬停(白底红图标) → 录音中(红底白图标+浅灰外环)。
> 适用于所有涉及「录音/语音作答」的产品界面：面试搭子 FaceTalk、辅警刷题站、消防题库、公考站等。

## 设计规格（3 状态）

```
┌─────────────────────────────────────────────────────┐
│  状态 ① 空闲（默认）                                 │
│  ┌──────────┐                                       │
│  │  🔘灰色   │  底色 #7a7a8a / 图标白色 stroke       │
│  │  🎤 白    │  外圈：无                              │
│  └──────────┘  文案：「点击开始录音」/ 灰色            │
├─────────────────────────────────────────────────────┤
│  状态 ② 悬停 / focus                                │
│  ┌──────────┐                                       │
│  │  ⚪白色   │  底色 #ffffff / 图标红色 #ea4335       │
│  │  🎤 红    │  外圈：无                              │
│  └──────────┘  文案不变 / 鼠标 pointer               │
├─────────────────────────────────────────────────────┤
│  状态 ③ 录音中                                      │
│  ┌ ─ ─ ─ ─ ┐                                       │
│  │ │🔴红色  ││  底色 #ea4335 / 图标白色              │
│  │ │🎤 白   ││  外圈 ~10px 浅灰 #9ca3af             │
│  │ ─ ─ ─ ─ ││  文案：「录音中… 再次点击停止」/粉红   │
│  └─────────┘│  可选：外圈呼吸动画 (2.4s 缓慢)        │
└─────────────────────────────────────────────────────┘
```

## 色值表

| 用途 | 色值 | 说明 |
|---|---|---|
| 卡片背景 | `#1e1e2e` | 深色容器，与按钮形成对比 |
| 按钮-空闲 | `#7a7a8a` | 中性灰，低调不抢眼 |
| 按钮-悬停 | `#ffffff` | 纯白，提示可交互 |
| 按钮-录音中 | `#ea4335` | 谷歌品牌红 |
| 外环-录音中 | `#9ca3af` | 浅灰银色环，~10px 厚 |
| 图标-空闲/录音中 | `#ffffff` | 白色 |
| 图标-悬停 | `#ea4335` | 红色 |
| 文案-空闲 | `#9ca3af` | 灰色次要文字 |
| 文案-录音中 | `#fca5a5` | 粉红色强调 |

## 尺寸

| 元素 | 值 |
|---|---|
| 按钮直径 | `128px`（可按 `--mic-size` CSS 变量缩放） |
| SVG 图标 | `52×52px` viewBox |
| 外环厚度 | `10px`（录音态） |
| 外环扩展 | `button + 14px`（总直径 ~156px） |
| 卡片内边距 | `40px 24px 32px` |

## 文件结构

```
google-mic-recorder/
  SKILL.md          ← 本文件（使用文档）
  component/
    mic-button.html ← HTML 片段（直接复制粘贴到你的页面）
    mic-button.css  ← CSS 样式（追加到你的 stylesheet）
    mic-button.js   ← JS 逻辑（追加到你的 script）
```

## 使用方法

### 方法 A：快速集成（推荐）

1. 复制 `component/mic-button.html` 中的 `<section>` 块到你的页面目标位置
2. 把 `component/mic-button.css` 追加到你的 CSS 文件末尾
3. 把 `component/mic-button.js` 的逻辑合并到你的页面 JS 中
4. 确保 CSS 引用加了版本号 `?v=日期` 防 cache

### 方法 B：CSS 变量自定义

组件通过 CSS 变量支持主题微调：

```css
.mic-card {
  --mic-size: 128px;        /* 按钮大小 */
  --mic-idle: #7a7a8a;      /* 空闲底色 */
  --mic-hover-bg: #ffffff;  /* 悬停底色 */
  --mic-rec: #ea4335;       /* 录音中底色 */
  --mic-ring: #9ca3af;      /* 外环颜色 */
  --card-bg: #1e1e2e;       /* 卡片背景 */
}
```

### 适用产品清单

| 产品 | 页面 | 集成位置 |
|---|---|---|
| **FaceTalk 面试搭子** | `solo.html`（自我练习） | 录音卡片区域 ✅ 已集成 |
| **FaceTalk 面试搭子** | `pair.html`（匹配房间） | 试音+正式录音区（待集成） |
| **深圳辅警刷题站** | 面试练习页 | AI 口语点评录音按钮（待集成） |
| **消防题库** | 面试练习页 | 同上（待集成） |
| **公考站** | 面试练习页 | 同上（待集成） |
| **通用 Exam Hub** | 任何含录音的页面 | 标准组件（待集成） |

## 技术要点

### SVG 麦克风图标（stroke 风格）

```svg
<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="1" width="6" height="12" rx="3"/>
  <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
  <line x1="12" y1="17" x2="12" y2="1"/>
</svg>
```

- 使用 `currentColor` 继承父元素 color → 自动随状态变色
- `stroke-width: 1.8` → 粗细适中，不像 1.0 太细也不像 2.5 太粗
- 无 fill → 纯线条风格，干净现代

### 外环实现（伪元素）

```css
.mic-btn.recording::before {
  content: '';
  position: absolute;
  inset: -7px;           /* 向外扩展 7px + border = ~10px 视觉环厚 */
  border-radius: 50%;
  border: 3px solid var(--mic-ring);
  animation: ring-breathe 2.4s ease-in-out infinite;
}
@keyframes ring-breathe {
  0%, 100% { opacity: .6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.03); }
}
```

### 状态切换 JS 接口

```js
// 获取 DOM
const micBtn  = document.getElementById('mic-btn');
const micIcon = document.getElementById('mic-icon'); // <svg> 内部
const caption = document.getElementById('mic-caption');
const timer   = document.getElementById('mic-timer');

// 进入录音态
function enterRecording() {
  micBtn.classList.add('recording');
  caption.textContent = '录音中… 再次点击停止';
  caption.style.color = '#fca5a5';
  timer.style.color = '#fca5a5';
}

// 退出录音态
function exitRecording() {
  micBtn.classList.remove('recording');
  caption.textContent = '点击开始录音';
  caption.style.color = '';
  timer.style.color = '';
}
```

### 与 MediaRecorder API 对接示例

```js
let mediaRecorder = null;
let audioChunks = [];

micBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => { /* 处理录音 blob */ };
    mediaRecorder.start();
    enterRecording();
    // 启动计时器...
  } else {
    mediaRecorder.stop();
    exitRecording();
  }
});
```

## 注意事项

1. **深色卡片是设计的一部分** — 不要把录音按钮放在纯白背景上，对比度会不够。必须搭配深色容器 (`#1e1e2e`)。
2. **不需要声波条动画** — 谷歌原版也没有。三态按钮本身已经足够传达状态。
3. **CSS 变量优先级** — 如需全局改色（比如换成品牌紫），改 `--mic-rec` 和 `--mic-idle` 即可，不用动具体选择器。
4. **移动端适配** — 按钮在手机上 128px 可能偏大，可用 `@media (max-width: 480px)` 缩小到 `104px`。
5. **无依赖** — 纯 HTML/CSS/JS，零外部库。
