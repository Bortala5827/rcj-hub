# voice/spectrum · 频谱视图

**状态：✅ 已实现**
**技术：** 复用 `../waveform/waveform.js` 的 `mountLiveBars`（不重复造轮子）。
**已用于：** SoloSpeak / FaceTalk 的实时声纹反馈。

本模块是 **Voice Engine 的「频谱」呈现形态**——底层与 `voice/waveform` 同一个引擎，只是参数取向不同（更高柱数、hard 峰值帽、更躁的视觉）。接入方式与 waveform 完全一致：

```js
import { mountLiveBars, fitCanvas } from '../waveform/waveform.js';
fitCanvas(cv, 160);
mountLiveBars(cv, analyser, { gradient:['#38bdf8','#7c3aed'], bars:96, capStyle:'hard', bloom:0.4 });
```

独立成文件夹是为了让资产目录「按呈现形态可检索」，但代码仍复用引擎——这正是「引擎优先，游戏其次」原则的体现。
