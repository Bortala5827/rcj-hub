# motion/gsap-effects · 动效集

**状态：📋 规划中**
**技术：** GSAP + ScrollTrigger（GSAP 已免费，自托管 vendor 到 `assets/vendor/`，不引第三方 CDN）
**将用于：** SoloSpeak / LetOut / FaceTalk / RCJ Hub（统一入场、滚动联动、时间线、stagger）

## 形态
沉淀一组 RCJ 品牌动效原子：
- 超大字入场（back.out）
- 滚动联动（ScrollTrigger）
- 时间线 / stagger 错落浮现
- 磁吸 hover

供各产品按需调用，保证「同一世界」的动效语言一致。

## 路线
1. 收集各产品已验证的 GSAP 片段，去重归档
2. 抽象为可配置函数（如 `rcjReveal(el, opts)`）
3. 文档化参数，方便新产品直接调用

## 注意
GSAP 仅自托管 `gsap.min.js` + `ScrollTrigger.min.js`（来自 rcj-hub `assets/vendor/`），不引外部 CDN。
