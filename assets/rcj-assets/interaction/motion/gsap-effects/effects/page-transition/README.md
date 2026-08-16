# ⑥ 页面转场 Page Transition

**类别：** Motion Engine · 页面转场
**状态：** ✅ 已实现
**技术：** GSAP `timeline` + 固定幕布覆盖层

## 说明
幕布擦除转场（curtain wipe）：从底部放大覆盖视口 → **在完全遮罩时触发 `onMid`**（此处切换内容 / 路由）→ 从顶部揭开。基于 RCJ「同一世界」视觉语言，用品牌渐变（accent → 紫）作幕布。适合 SPA 式导航或区块切换，避免硬跳变的割裂感。

## 适用产品
- **RCJ Hub** 区块 / 视图切换
- **Exam Hub / Speak Series** 产品内视图、步骤间转场

## 参数
`RCJMotion.pageWipe(opts)`
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `in` | `0.5` | 覆盖时长 |
| `out` | `0.5` | 揭开时长 |
| `color` | 品牌渐变 | 幕布背景（可传纯色） |
| `onMid` | — | 完全遮罩时回调（切换内容/路由） |
| `onDone` | — | 揭开完成回调 |

## 依赖
- `vendor/gsap.min.js`
- `rcj-motion.css`（`.rcj-wipe` 样式）
- `rcj-motion.js`

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.pageWipe({
    onMid: function () { location.hash = '#next'; swapView(); }
  });
</script>
```
降级：无 GSAP / 减少动态效果时，`onMid` 与 `onDone` 立即同步执行（无动画但功能正常）。
