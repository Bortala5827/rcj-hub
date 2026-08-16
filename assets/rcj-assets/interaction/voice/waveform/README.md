# voice/waveform · 声纹波形模块

**状态：✅ 已实现（RCJ Voice Engine 核心模块）**
**技术：** Web Audio API + Canvas，零外部依赖，ES Module。
**已用于：** SoloSpeak（语音日记背景）、FaceTalk（面试实时反馈）。

## 能力

| 函数 | 作用 |
| --- | --- |
| `mountLiveBars(canvas, analyser, opts)` | 实时**频谱柱状图**（人声/低频更突出，默认开对数频率 + A 计权）⭐ |
| `mountLiveWave(canvas, analyser, opts)` | 实时**波形线**（经典示波器） |
| `renderWave(canvas, peaks, opts)` | **静态波形**（录音回放 / 进度定位） |
| `fitCanvas(canvas, cssHeight)` | 适配 DPR，防模糊 |
| `lerpHex` / `hexToRgba` | 颜色工具 |

## 快速接入

```html
<script type="module">
  import { mountLiveBars, fitCanvas } from './waveform.js';

  const cv = document.getElementById('myCanvas');
  fitCanvas(cv, 120);                 // 高度 120px，自动适配 DPR

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);

    const stop = mountLiveBars(cv, analyser, {
      gradient: ['#6f9b8a', '#7c3aed'],  // 跨场渐变
      bars: 72,
      pulse: 0.4,                         // 呼吸律动
      onLevel: l => document.documentElement.style.setProperty('--voice', l), // 驱动环境光
    });
    // 停止： stop();
  });
</script>
```

> 注意：麦克风采集需 **HTTPS**（或 localhost）。模块本身纯前端，无网络依赖。

## 常用参数

- `color` / `gradient` / `colorFn` — 着色（单色 / 渐变 / 逐柱函数）
- `logScale`(默认 true) / `aWeight`(默认 true) — 感知升级，让人声更突出
- `mirror` — 镜像反射（iTunes/Spotify 式专业音频语言）
- `pulse` / `wobble` — 呼吸 / 颤抖性格化
- `onLevel` / `onBands` — 每帧回传整体/分段音量，可驱动页面其它动效（环境光、粒子）

## Demo

打开 `index.html`（建议本地静态服务器，如 `python -m http.server`，因 ES Module 在 `file://` 下受 CORS 限制）。
