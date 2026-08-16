# ⑤ 时间线 Timeline

**类别：** Motion Engine · Timeline
**状态：** ✅ 已实现
**技术：** GSAP `timeline` + `fromTo` 编排

## 说明
用一条 `gsap.timeline` 把多个元素按声明顺序编排入场（eyebrow → 标题 → 副文 → CTA），统一错落节奏，避免各元素动画各播各的。基于 RCJ Hub 首屏入场链。每个 step 可单独设 `from` / `to` / `duration` / `ease` / `pos`（时间线位置）。

## 适用产品
- **RCJ Hub / Speak Series / Exam Hub** 首屏、区块、结果页的整体编排

## 参数
`RCJMotion.sequence(map, opts)`
| 参数 | 说明 |
| --- | --- |
| `map` | `{ key: '#selector' }` 元素映射 |
| `opts.steps` | 步骤数组，每项：`{ target:key, from, to, duration, ease, pos }` |
| `opts.delay` | 整体延时（默认 `0.15`） |

`pos` 同 GSAP 时间线位置（`'>'` 接在上一条之后、`'<'` 与上一条同起等）。

## 依赖
- `vendor/gsap.min.js`
- `rcj-motion.js`

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  var map = { eyebrow:'#eyebrow', title:'#title', sub:'#sub', cta:'#cta' };
  RCJMotion.sequence(map, { steps: [
    { target:'eyebrow', from:{y:18,opacity:0}, to:{y:0,opacity:1} },
    { target:'title',   from:{y:30,opacity:0}, to:{y:0,opacity:1}, ease:'back.out(1.5)' },
    { target:'cta',     from:{y:20,opacity:0}, to:{y:0,opacity:1} }
  ]});
</script>
```
降级：无 GSAP / 减少动态效果时，所有元素直接显示。
