# voice/voice-particles · 声纹粒子

**状态：✅ 已实现（RCJ Voice Engine 家族）**
**技术：** Web Audio API（AnalyserNode + RMS），零外部依赖。
**已用于：** FaceTalk（面试前声纹暖场，替换原拖拽解压小游戏）。

## 它做什么

点「开始声纹热身」→ 采集麦克风 → 计算实时音量(RMS) → 让一排表情随声纹**上下蹦跳 + 缩放 + 旋转**（带相位错开与正弦摆动）。停止即释放麦克风。不是「小游戏」，而是「对着麦克风吐个槽、把紧张抖出去」的暖场互动。

## 接入（复制本文件夹到产品）

```html
<link rel="stylesheet" href="/assets/voice-particles/voice-particles.css" />
<section class="vwarm">
  <p class="vwarm-sub" id="vwarm-sub">对着麦克风随便说几句…</p>
  <div class="vwarm-stage" id="vwarm-stage">
    <span class="vw-face" data-face>😀</span>
    <span class="vw-face" data-face>😮</span>
    <span class="vw-face" data-face>😎</span>
    <span class="vw-face" data-face>🤩</span>
    <span class="vw-face" data-face>😺</span>
  </div>
  <button class="vwarm-btn" id="vwarm-btn">🎤 开始声纹热身</button>
</section>
<script type="module">
  import { mountVoiceParticles } from '/assets/voice-particles/voice-particles.js';
  mountVoiceParticles({ stageId:'vwarm-stage', btnId:'vwarm-btn', subId:'vwarm-sub',
                        faces:['😀','😮','😎','🤩','😺'] });
</script>
```

> 若 `stage` 内无表情节点，引擎会自动按 `faces` 注入。

## 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `stageId` / `btnId` / `subId` | — | 容器/按钮/提示文案元素 id |
| `faces` | 5 个表情 | 跳动的表情序列 |
| `sensitivity` | 3.4 | 声纹→位移增益（越大越蹦） |

返回 `{ start, stop, destroy }`，可程序化控制。

## 注意事项

- 麦克风采集需 **HTTPS**（线上已满足）或 localhost。
- 拒绝授权时提示文案自动切换，不报错。
- `prefers-reduced-motion` 下表情不跳动（无障碍）。

## Demo

打开 `index.html`（建议本地静态服务器，ES Module 在 `file://` 下受 CORS 限制）。
