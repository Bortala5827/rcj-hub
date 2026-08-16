# particles/confetti · 庆祝纸屑

**状态：📋 规划中**
**技术：** canvas-confetti（vendor 本地化）或 RCJ Particle Engine 自研
**将用于：** SoloSpeak（打卡庆祝）、FaceTalk（匹配成功）、RCJ Hub（彩蛋）

## 形态
轻量庆祝粒子，从底部上扬喷射、受重力下坠。适用于「完成一件小事」的正向反馈，强化产品温度。

## 路线
1. 封装 `rcjConfetti(opts)`（颜色/数量/方向可配）
2. vendor 本地化 canvas-confetti（不引 CDN）
3. 与 `relax/particle-burst` 的庆祝模式共用粒子能力

## 复用
粒子物理沉淀进 RCJ Particle Engine，被 confetti / firework / burst 共用。
