# motion/page-transition · 页面转场

**状态：📋 规划中**
**技术：** GSAP / CSS
**将用于：** RCJ Hub（产品矩阵内页面转场，保持品牌连贯）

## 形态
RCJ 各产品（SoloSpeak/LetOut/FaceTalk/Exam Hub）之间跳转时，统一的品牌转场（蓝图网格淡入、字标滑入、内容 stagger）。让「从一个 RCJ 产品到另一个」感觉是同一世界的不同房间，而非跳去陌生站点。

## 路线
1. 定义统一转场语言（遮罩色、时长、缓动）
2. 封装 `rcjTransition(toUrl)` 拦截站内跳转
3. 与 `motion/gsap-effects` 共享缓动参数

## 复用
缓动/节奏参数来自 `motion/gsap-effects`。
