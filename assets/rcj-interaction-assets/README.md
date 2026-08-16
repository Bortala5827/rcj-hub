# RCJ Interaction Asset Library · 互动资产库

> 不是「小游戏合集」，而是 **Speak Series 的互动效果中台**。
> 底层三引擎：**RCJ Voice Engine**（声音）+ **RCJ Motion Engine**（动效）+ **RCJ Particle Engine**（粒子）。
> 上层产品（SoloSpeak / LetOut / FaceTalk / RCJ Hub）只「调用模块」，不重复造轮子。

## 设计信条

1. **积累资产，而非丢掉功能。** 每做一次互动效果，就沉淀成可被下一个产品调用的模块。
2. **引擎优先，游戏其次。** 做声纹动画 → 沉淀 Voice Engine；做气泡爆破 → 沉淀 Particle Engine。别做成 `rcj-bubble-game1` / `rcj-bubble-game2`。
3. **模块自包含。** 每个文件夹 = 一个模块 = 一份 demo + 一份 README + 接入片段。复制即用，不牵一发动全身。
4. **视觉语言统一。** 所有模块共享 RCJ 品牌色板 / 卡片语言 / 动效节奏，让人一眼感到「同一世界」。

## 目录结构（按资产类型分，不按产品分）

```
rcj-interaction-assets/
├── voice/                # RCJ Voice Engine 家族
│   ├── waveform/         ✅ 实时波形 / 频谱柱状（录音回放 + 实时）
│   ├── voice-particles/  ✅ 声纹驱动表情/粒子跳动（暖场用）
│   └── spectrum/         ✅ 频谱视图（复用 waveform.js 的 mountLiveBars）
├── relax/                # 解压释放类（LetOut 核心）
│   ├── bubble-pop/       📋 压力泡泡爆破（粒子+音效+数字反馈）
│   ├── shake/            📋 甩一甩升级版（重力/碰撞/弹性）
│   ├── particle-burst/   📋 文字/庆祝粒子爆炸（canvas-confetti 类）
│   └── breathe/          📋 呼吸圆圈（吸气扩大/呼气缩小，SoloSpeak）
├── motion/               # 动效类
│   ├── floating-text/    📋 漂浮文字
│   ├── gsap-effects/     📋 GSAP 入场/滚动联动/时间线
│   └── page-transition/  📋 页面转场
└── particles/            # RCJ Particle Engine 家族
    ├── confetti/         📋 庆祝纸屑
    ├── stars/            📋 星尘/粒子跟随（鼠标轨迹）
    └── firework/         📋 烟花
```
✅ = 已实现并带 demo；📋 = 规划中（见各文件夹 README 路线）。

## 如何消费一个模块

两种姿势，按场景选：

**A. 复制目录（推荐，离线可控）**
```bash
cp -r rcj-interaction-assets/voice/waveform 你的项目/assets/voice-waveform
```
然后在页面里 `<script type="module">` 引入，见各模块 README。

**B. 远程 raw 引用（适合轻量、常更新）**
```html
<script type="module">
  import { mountLiveBars } from 'https://raw.githubusercontent.com/Bortala5827/rcj-interaction-assets/main/voice/waveform/waveform.js';
</script>
```

## 跨产品调用矩阵（速查）

| 模块 | SoloSpeak | LetOut | FaceTalk | RCJ Hub |
| --- | --- | --- | --- | --- |
| voice/waveform | 语音日记背景 | — | 面试实时反馈 | — |
| voice/voice-particles | — | — | 面试前声纹暖场 | — |
| relax/bubble-pop | — | 点击释放压力 | — | — |
| relax/breathe | 呼吸练习 | — | — | — |
| particles/confetti | 打卡庆祝 | 解压反馈 | 匹配成功 | 彩蛋 |

## 配套

- **复用规则**：见 [`REUSE.md`](./REUSE.md)
- **资产总目录（跨所有层）**：RCJ Hub → `/assets`（线上 955827.xyz/assets.html）
- **相关仓库**：`rcj-audio-core`（技能版 Voice Engine）、`rcj-media-assets`（台词/音频素材）、`rcj-hub`（总入口）
