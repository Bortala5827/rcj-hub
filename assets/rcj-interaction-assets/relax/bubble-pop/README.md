# relax/bubble-pop · 压力泡泡

**状态：📋 规划中**
**技术：** Canvas + Web Audio（爆破音效）
**将用于：** LetOut（「点击释放压力」核心互动）

## 形态
页面浮起一排「压力泡泡」，标注用户的烦恼词（如「今天好累」「甲方又改需求」）。点击 → 泡泡爆破，迸发粒子 + 轻音效 + 一句正向反馈（如「释放 +1」）。参考 itch.io 上轻量解压小游戏的思路，改造为「情绪出口」。

## 路线
1. 静态泡泡 + 点击爆破粒子（Canvas 粒子系统，沉淀进 RCJ Particle Engine）
2. 接入用户自定义烦恼词（输入框 / 从 LetOut 情绪日志取）
3. 爆破音效（复用 rcj-media-assets 音频或 Web Audio 合成）
4. 数字反馈 + 连续打卡激励

## 复用
爆破粒子部分抽象为 `particles/` 引擎能力，被 shatter / confetti 共用。
