# ① 入场 Entrance

**类别：** Motion Engine · 入场
**状态：** ✅ 已实现
**技术：** GSAP `gsap.from` + `back.out` 缓动 + `stagger`

## 说明
元素首次进入视图时的品牌化入场：淡入 + 轻微上浮（`y`）+ 可选缩放（`scale`），使用 RCJ 统一入场缓动 `back.out(1.6)`，多元素时按 `stagger` 错落浮现。基于 RCJ Hub 首屏标题 / eyebrow 入场动画。

## 适用产品
- **RCJ Hub** 首屏卡片 / 区块入场
- **Speak Series**（SoloSpeak / LetOut / FaceTalk）卡片、步骤、面板入场
- **Exam Hub** 题库卡片、结果页入场

## 参数
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `y` | `28` | 起始上浮像素 |
| `scale` | `1` | 起始缩放（<1 表示由小放大） |
| `stagger` | `0.08` | 多元素错落间隔（秒） |
| `duration` | `0.85` | 单元素时长 |
| `ease` | `back.out(1.6)` | 缓动 |
| `delay` | `0` | 整体延时 |
| `from` | — | 覆盖完整 from 对象（高级） |
| `clearProps` | `true` | 动画后清除内联样式（设 `false` 可保留） |

## 依赖
- `vendor/gsap.min.js`（自托管，不引 CDN）
- `rcj-motion.js`（本引擎核心）

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.entrance('.rcj-card', { y: 30, stagger: 0.12, ease: 'back.out(1.7)' });
</script>
```
降级：GSAP 缺失或 `prefers-reduced-motion: reduce` 时，元素直接显示、无动画。
