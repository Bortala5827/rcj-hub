# RCJ Voice Recorder — 统一录音组件

> Google 风格极简录音 UI + 声纹球（Voice Orb）可视化
> **替代各产品散落的柱状波形录音界面，统一设计语言。**

## 设计原则

| 原则 | 说明 |
|---|---|
| **极简** | 深色底 + 一句提示 + 一个圆形麦克风按钮（Google 同款） |
| **声纹球 > 柱状** | 实时反馈用呼吸式同心波纹（有机/克制），不用 equalizer 风格的柱状 |
| **换色不换结构** | 各产品仅通过 `accent` 参数换主色，DOM/CSS/JS 完全统一 |
| **无障碍** | `prefers-reduced-motion` 降级、`aria-label`、键盘可操作 |

## 文件

```
recorder/
├── index.html    # Demo 页面（三色对比：Google红 / LetOut橙 / SoloSpeak绿）
├── recorder.css   # 样式（CSS 变量驱动，零硬编码颜色）
├── recorder.js    # 逻辑（mountRecorder() + Voice Orb SVG 可视化）
└── README.md      # 本文件
```

## 快速使用

```html
<link rel="stylesheet" href="path/to/recorder.css">
<div class="rcj-recorder" id="myRecorder"></div>

<script type="module">
  import { mountRecorder } from 'path/to/recorder.js';
  mountRecorder(document.getElementById('myRecorder'), {
    accent: '#e07850',           // 产品主色
    hint: '请开始说话',          // 待机提示
    hintRecording: '正在录音…',   // 录音中提示
    onResult: (result) => {      // 录音完成
      // result = { blob, durationMs, peaks, level }
      console.log(result.blob.size, result.durationMs);
    },
    onError: (msg) => {},        // 错误/权限拒绝
  });
</script>
```

## 各产品配色参考

| 产品 | accent 色 | 调性 |
|---|---|---|
| Google 默认 | `#ea4335` | 正式、权威 |
| LetOut | `#e07850` | 暖橙、释放感 |
| SoloSpeak | `#6f9b8a` | 苔绿、平静开口 |
| Exam Hub | `#3b82f6` | 蓝、专注学习 |

## 与旧版差异

- ❌ ~~柱状频谱（equalizer 风格）~~ → ✅ **声纹球 Voice Orb**
- ❌ ~~每产品独立写一套 CSS/HTML/JS~~ → ✅ **单一组件 + accent 变量**
- ❌ ~~复杂的多元素布局（canvas + timer + vol-meter + btn）~~ → ✅ **提示 + 按钮 + 球 + 计时器，四元素**

## 依赖

- `../waveform/waveform.js` 的 `Recorder` 类（自动动态导入）
- 或通过 `RecorderClass` 参数注入自定义 Recorder 实现
