# motion/floating-text · 漂浮文字

**状态：📋 规划中**
**技术：** CSS / Canvas
**将用于：** LetOut（情绪词漂浮/破碎）、SoloSpeak（金句漂浮背景）

## 形态
情绪词（如「压力」「焦虑」「内耗」）在页面缓慢漂浮；点击后文字碎裂成笔画粒子消散，然后生成正向词（「重新开始」）。与 `relax/bubble-pop`、`relax/particle-burst` 的情绪释放主题呼应，但更偏「文字作为主角」的文艺表达。

## 路线
1. 文字 SVG/canvas 路径化 + 漂浮
2. 点击碎裂（笔画拆解 + 粒子）
3. 碎裂后重组为正向词

## 复用
碎裂粒子复用 RCJ Particle Engine；漂浮节奏复用 `motion/` 时间线。
