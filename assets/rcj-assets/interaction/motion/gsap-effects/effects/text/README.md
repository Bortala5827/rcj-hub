# ② 文字 Text Reveal

**类别：** Motion Engine · 文字
**状态：** ✅ 已实现
**技术：** GSAP + SplitText（`type:'lines', mask:'lines'`）+ `power4.out`

## 说明
大标题按**行**被遮罩后从下方上推揭示（`yPercent:118 → 0`，`power4.out`，逐行 `stagger`）。基于 RCJ Hub 首屏大标题揭示动画。当 SplitText 不可用时，自动降级为整段淡入，保证内容永远可见。

## 适用产品
- **RCJ Hub** 首屏 / 区块大标题
- **Speak Series** 落地页主标题、章节标题
- **Exam Hub** 结果页 / 报告页主标题

## 参数
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `yPercent` | `118` | 起始上移比例（遮罩内从下方进入） |
| `duration` | `1.05` | 单行时长 |
| `ease` | `power4.out` | 缓动 |
| `stagger` | `0.12` | 行间隔 |
| `delay` | `0.2` | 整体延时 |

## 依赖
- `vendor/gsap.min.js`
- `vendor/SplitText.min.js`（已随 GSAP 免费，自托管）
- `rcj-motion.js`

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="vendor/SplitText.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.textReveal('#headline', { stagger: 0.14 });
</script>
```
降级：`prefers-reduced-motion` 或缺少 SplitText/GSAP 时直接显示。
