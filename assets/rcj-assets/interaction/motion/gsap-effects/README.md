# motion/gsap-effects · RCJ Motion Engine

**状态：✅ 已实现（6/6 效果）**
**技术：** GSAP + ScrollTrigger + SplitText（GSAP 已免费，全部自托管于 `vendor/`，**不引任何第三方 CDN**）
**用途：** RCJ Lab 统一品牌动效语言——各产品直接调用，保证「同一世界」的动效一致性。

## 核心文件
| 文件 | 作用 |
| --- | --- |
| `rcj-motion.js` | 引擎核心，暴露 `window.RCJMotion`，6 类 API |
| `rcj-motion.css` | RCJ 调色板 + 卡片/按钮/光斑/幕布基础类 |
| `vendor/` | 自托管 `gsap.min.js` / `ScrollTrigger.min.js` / `SplitText.min.js` |

## 调用方式
```html
<script src="vendor/gsap.min.js"></script>
<script src="vendor/ScrollTrigger.min.js"></script>
<script src="vendor/SplitText.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.ready(function () {
    RCJMotion.entrance('.rcj-card', { stagger: 0.12 });
    RCJMotion.textReveal('#headline');
    RCJMotion.revealOnScroll('[data-reveal]');
    RCJMotion.magnetic('#cta');
  });
</script>
```

## 六类效果（每类独立 demo + README）
| # | 效果 | API | demo | 适用产品 |
| --- | --- | --- | --- | --- |
| ① | 入场 Entrance | `RCJMotion.entrance` | `effects/entrance` | Hub / Speak / Exam 卡片入场 |
| ② | 文字 Text Reveal | `RCJMotion.textReveal` | `effects/text` | Hub / Speak 大标题 |
| ③ | 滚动 Scroll | `RCJMotion.revealOnScroll` / `.parallax` | `effects/scroll` | 长落地页区块揭示、视差 |
| ④ | 交互 Interaction | `RCJMotion.magnetic` / `.press` / `.spotlight` | `effects/interaction` | 主按钮、CTA、产品卡 |
| ⑤ | 时间线 Timeline | `RCJMotion.sequence` | `effects/timeline` | 首屏 / 区块整体编排 |
| ⑥ | 页面转场 Page Transition | `RCJMotion.pageWipe` | `effects/page-transition` | SPA 式导航 / 区块切换 |

## 降级保护（重要）
所有 API 内置两道降级：
- **GSAP 缺失** → 元素直接显示，无动画，功能不崩。
- **`prefers-reduced-motion: reduce`** → 同上，尊重系统「减少动态效果」。

## 视觉一致性
- 调色板与 `rcj-hub` `hub.v2.css` `:root` 完全一致（`--accent:#1e88e5` 等）。
- 动效节奏：入场 `back.out`、滚动 `power3`、文字 `power4`、幕布 `power3.inOut`。
- 复用前先 `Ctrl+F5` 验证；复制到产品后归属产品所有，上游更新需手动同步。

## 复制即用清单
把以下带进目标产品即可（相对路径按实际调整）：
```
vendor/gsap.min.js
vendor/ScrollTrigger.min.js
vendor/SplitText.min.js
rcj-motion.js
rcj-motion.css
```
