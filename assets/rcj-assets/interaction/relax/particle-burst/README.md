# relax/particle-burst · 粒子爆炸

**状态：📋 规划中**
**技术：** canvas-confetti 类轻量粒子库 / 自研 Canvas 粒子
**将用于：** LetOut（「我要上岸！」式情绪释放）、SoloSpeak（打卡庆祝）、FaceTalk（匹配成功）

## 形态
用户输入一句情绪词（如「我要上岸！」），点击后文字炸开成粒子四散，随后可重新聚拢成正向词。极适合做「解压反馈」与「成功反馈」两用。

## 路线
1. 文字 → 粒子化炸开（基于 RCJ Particle Engine）
2. 庆祝模式（confetti 类，上扬喷射）
3. 释放模式（爆裂 + 消散）
4. 复用 canvas-confetti 作为可选依赖（vendor 本地化，不引不明 CDN）

## 复用
与 `particles/confetti`、`relax/bubble-pop` 共享粒子引擎。
