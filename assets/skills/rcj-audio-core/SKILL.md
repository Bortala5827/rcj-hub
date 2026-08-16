---
name: rcj-audio-core
description: RCJ Speak Series 共享音频核心 —— 录音引擎 (Recorder) + 声波可视化引擎 (waveform.js) + 拖拽定位回放 (player.js) + 可分享情绪声波卡 (sharecard.js)。适用于任何带「录音 / 播放声波 / 情绪可视化」的页面（SoloSpeak / LetOut / FaceTalk 统一复用）。当需要新建或升级一个语音交互页、或要把声波做得更专业（对数频率 / A计权 / 镜像 / 情绪性格化 / 拖拽定位 / 声波卡）时使用。
---

# rcj-audio-core — Speak Series 共享音频核心

一套 **零依赖、纯 Canvas + Web Audio** 的语音交互引擎，被 SoloSpeak / LetOut / FaceTalk 复用。
目标是「一套代码，三个产品」，避免每个页面各写一套声波（闭门造车）。

## 文件清单（复制到项目的 `js/` 或 `assets/`）

| 文件 | 作用 | 形态 |
|------|------|------|
| `waveform.js`  | 声波可视化引擎（v6）。`renderWave` 静态回放 + `mountLiveBars` 实时频谱 + `mountLiveWave` 示波器 | ES Module |
| `recorder.js`   | 录音引擎 `Recorder` 类：返回 `{blob, durationMs, peaks, level}`，`fftSize=2048`，带 `onLevel` 实时回调 | ES Module |
| `player.js`     | 回放器 `mountPlayer`（**带拖拽定位 scrubbing**）+ `mountAudioPlayer`（资源音频「声波频动」播放器） | ES Module |
| `sharecard.js`  | 情绪声波卡 `openShareCard` / `buildShareCardCanvas`（可分享 PNG，**不带二维码**） | ES Module |

> FaceTalk 因历史采用全局脚本，使用 `assets/ftwave.js`（IIFE 全局版 `window.RCJWave`，API 与 `waveform.js` 的 `mountLiveBars` 完全一致）。

## 一、waveform.js —— 可视化引擎（v6）

### `renderWave(canvas, peaks, opts)`
静态柱状波形（录音回放用）。`peaks: number[]` 振幅 0..1。
```
opts = {
  progress, playedColor, restColor, bg,
  mirror=true,            // 上下镜像
  minBar=0.02,
  headColor=null,         // 播放头颜色（拖拽/进度同步画亮线+顶圆点）；null 不画
  headWidth=2,
}
```

### `mountLiveBars(canvas, analyser, opts)` ⭐ 实时频谱柱状图
传入 **AnalyserNode**（或直接传 `MediaStream` 也可，内部取 stream 的 source）。
向后兼容旧调用 `mountLiveBars(canvas, analyser, { colorFn })`。

```
opts = {
  // 基础
  color, colorFn, gradient, barGap, smoothing, minBarHeight, alpha, capAlpha, capDecay, borderRadius,
  // v2 动效
  wobble,                 // 0..1 随机高度抖动（急躁/颤抖）
  pulse,                  // 0..1 整体呼吸律动
  // v3 环境联动
  onLevel,                // (level 0..1)=>void 每帧平滑音量（驱动环境光/CSS 变量）
  bloom,                  // 0..1 柱体外发光（越大越烫）
  floorGlow,              // cssHex 底部地面光晕
  levelFps,               // onLevel 限频
  // v4 感知升级（默认开，纯算法）
  logScale=true,          // 对数频率映射：人声/低频占更多柱，不再糊成一团
  aWeight=true,           // A 计权(IEC 61672)：按人耳感知重塑频谱
  bands=[50,8000],       // 显示频率范围 Hz
  bars=64,                // 屏幕柱数
  onBands,                // (bass,mid,treble)=>void 各频段能量（低频→地光，中频→环境光，高频→粒子）
  // v5 视觉冲击（播放器手动开）
  mirror=false,           // 镜像反射（iTunes/Spotify/Audiom 标志语言）
  centerGlow,             // 中心轴辉光线（随音量呼吸，仅 mirror）
  radialBg,               // [centerHex,edgeHex] 径向背景渐变
  // v6 情绪性格化（P0-3）
  barWidthRatio=1,        // 柱宽倍率（>1 粗壮有冲击，<1 纤细精致）
  capStyle='soft',        // 'soft' 圆润帽 | 'hard' 实心尖顶（锯齿/爆发感）
  wobbleKind='random',    // 'random' 抖动 | 'sine' 缓慢正弦摇摆（呼吸感）
  mirrorAsym=0,           // 0..1 镜像上下不对称（>0 上半更高=更躁动）
}
```

### `mountLiveWave(canvas, analyser, opts)` 经典示波器线。

### 工具：`lerpHex(a,b,t)` `hexToRgba(h,a)` `fitCanvas(canvas, cssHeight)` `roundRect(ctx,x,y,w,h,r)`

## 二、recorder.js —— `Recorder` 类
```js
const rec = new Recorder();
rec.onLevel = (max) => { /* 画音量条 */ };
await rec.start();
const { blob, durationMs, peaks, level } = await rec.stop();
// level = { max, highRatio, highTriggered }
```
- `analyser.fftSize = 2048`（频谱更细腻）。
- `peaks` 固定 320 点，回放/声波卡通用。
- 不自动上传、不留存服务器。

## 三、player.js —— 回放器
### `mountPlayer(container, release, opts)` ⭐ 带 **P0-1 拖拽定位 scrubbing**
- 录完的静态声波变成可拖拽的「带」：指针按下/拖动即定位到对应时间（Tide/Audiom 灵魂交互）；播放中拖动先暂停、松手若原在播则续播。
- 用 `renderWave(..., { headColor })` 画播放头（亮线+顶部圆点）。
- `opts = { played, rest }` 已播/未播颜色（按项目主题配色）。
- 无音频（阅后即焚）时显示静默提示，不报错。
- 返回 `{ destroy() }`，切页务必调用以释放 Audio 与 objectURL。

### `mountAudioPlayer(container, audioUrl, opts)` 资源库音频「声波频动」播放器
- Web Audio 分析跨域音频（需 `crossOrigin='anonymous'` + 源站 `access-control-allow-origin: *`）。
- 中央音符 `♪` 即播放键，挂载实时频谱柱（镜像+辉光）。
- 退化：Web Audio/CORS 失败 → 原生 `<audio controls>`。

## 四、sharecard.js —— 情绪声波卡（P1-4）
```js
openShareCard(release, emotion);   // 弹出 1080×1350 竖版卡模态
// emotion = { label:'释放', emoji:'🔥', grad:['#ffb27a','#e23b1e'], glow:'#ff6b35', voiceLabel:'…' }
```
- 卡面：情绪配色 + 你自己的 `peaks` 镜像声波 + 情绪名/日期/时长 + slogan。
- **不带二维码**（判定对小红书引流无价值，只适合自己玩）。
- 桌面端「保存图片」下载 PNG；移动端长按 `<img>` 存相册，直接发小红书。
- 用录音时存的 `peaks`，**阅后即焚记录也能生成卡**，不依赖保留音频。

## 五、情绪「性格化」配置（P0-3）
不只靠颜色，用**形状**区分情绪（在调用 `mountLiveBars` 时传参）：
```
燃 burn      → barWidthRatio:1.3, capStyle:'hard', mirrorAsym:.2   （粗柱+锯齿爆裂+更躁动）
释放 release → barWidthRatio:1,   capStyle:'soft'                   （中柱+圆润帽）
沉淀 settle  → barWidthRatio:.7,  wobbleKind:'sine'                （纤细+缓慢呼吸）
安静 quiet   → barWidthRatio:.6,  wobbleKind:'sine', smoothing 高   （最纤细+最缓）
```
配合 `color`/`gradient` 做色彩区分，形状让四种情绪「一眼可辨」。

## 六、复用流程（新页面 / 升级旧页面）
1. 从本技能（或已部署的 letout）复制 `waveform.js` `player.js` `recorder.js` 到项目 `js/`；
   需要声波卡再加 `sharecard.js`。
2. 在入口 `app.js` 按既有 API 接线：
   - 录音：`new Recorder()` → `onLevel` 画音量条 → `mountLiveBars(liveCanvas, rec.analyser, {...})` 画实时声纹。
   - 回放：`mountPlayer(holder, recording, { played, rest })`。
3. **缓存版本号**：所有 `import ... from './x.js?v=YYYYMMDDx'` 与 `index.html` 的 `<script>`/`<link>` 引用，
   部署时统一 bump 到当天版本（否则用户端长期命中旧 JS）。
4. **rcj-hub 子路径铁律**：若页面挂在 `955827.xyz/<项目>`（如 solospeak/letout），
   必须把改动 **同时** 复制到 `rcj-hub/<项目>/` 并推送 rcj-hub，否则线上不变。
   独立子域（如 `facetalk.955827.xyz`）只推自身仓库。
5. 推送触发 CF Pages 自动部署；告知用户 **`Ctrl+F5`**（Mac `Cmd+Shift+R`）硬刷。

## 七、设计参考（不闭门造车）
- **拖拽定位**：Tide / Audiom 的「声波即进度条，拖动即听对应片段」。
- **镜像声波**：iTunes / Spotify / Audiom 的专业音频可视化标志语言。
- **对数频率 + A 计权**：专业频谱仪（如 Adobe Audition）的感知映射，让人声不再糊成一团。
- **情绪性格化**：用「形状」而非仅颜色区分状态（参考 Datawrapper / 信息图的情绪编码）。
