# ③ 滚动 Scroll

**类别：** Motion Engine · 滚动
**状态：** ✅ 已实现
**技术：** GSAP + ScrollTrigger（`fromTo` + `scrub`）

## 说明
两类滚动联动：
1. **revealOnScroll** — 元素进入视口（默认 `top 85%`）时，从 `y + opacity:0 + blur(10px)` 揭示为清晰，单次触发（`once:true`）。基于 RCJ Hub 区块 `.reveal` 揭示。
2. **parallax** — 元素随滚动位置连续位移 / 淡出（`scrub:true`）。基于 RCJ Hub 首屏 `hero-inner` 视差。

## 适用产品
- **RCJ Hub** 长落地页各区块逐一揭示、首屏视差
- **Exam Hub / Speak Series** 产品页滚动叙事

## 参数
**revealOnScroll(target, opts)**
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `y` | `42` | 起始上浮像素 |
| `blur` | `10` | 起始模糊半径（px） |
| `duration` | `0.9` | 时长 |
| `ease` | `power3.out` | 缓动 |
| `start` | `'top 85%'` | 触发位置 |

**parallax(el, opts)**
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `yPercent` | `-26` | 滚动全程位移百分比 |
| `opacity` | `0.1` | 滚动终点透明度 |
| `trigger` | 元素自身 | 滚动触发容器 |
| `start` / `end` | `'top top'` / `'bottom top'` | 滚动区间 |

## 依赖
- `vendor/gsap.min.js`
- `vendor/ScrollTrigger.min.js`
- `rcj-motion.js`

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="vendor/ScrollTrigger.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.revealOnScroll('[data-reveal]', { y: 48, blur: 10 });
  RCJMotion.parallax('#banner', { yPercent: -40, opacity: 0.2 });
</script>
```
降级：无 ScrollTrigger / 减少动态效果时，元素直接显示。
