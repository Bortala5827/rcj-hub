# ④ 交互 Interaction

**类别：** Motion Engine · 交互
**状态：** ✅ 已实现
**技术：** GSAP `quickTo` + pointer 事件

## 说明
三类指针驱动的交互原子，统一用 `gsap.quickTo` 做丝滑跟随：
1. **magnetic** — 元素被指针「吸」向光标（基于 RCJ Hub 磁吸按钮）。
2. **press** — 按下缩放到 `down`、松开回弹（基于 RCJ Hub 按钮按压）。
3. **spotlight** — 容器内柔光斑跟随指针（基于 RCJ Hub 首屏光斑）。

减少动态效果时三者全部不绑定，元素保持静止。

## 适用产品
- **RCJ Hub / Speak Series / Exam Hub** 主按钮、CTA、产品卡

## 参数
**magnetic(el, opts)**
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `strength` | `0.35` | 吸附强度（0–1） |
| `duration` | `0.5` | 跟随时长 |
| `ease` | `power3` | 缓动 |

**press(el, opts)**
| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `down` | `0.96` | 按下缩放 |

**spotlight(container, opts)** — 自动注入 `.rcj-spotlight` 元素，需容器加 `.rcj-spotlight-host` 类（见 `rcj-motion.css`）。

## 依赖
- `vendor/gsap.min.js`
- `rcj-motion.css`（spotlight 样式）
- `rcj-motion.js`

## 接入片段
```html
<script src="vendor/gsap.min.js"></script>
<script src="rcj-motion.js"></script>
<script>
  RCJMotion.magnetic('#cta', { strength: 0.4 });
  RCJMotion.press('#cta');
  RCJMotion.spotlight('#card', ); // 容器需 .rcj-spotlight-host
</script>
```
降级：无 GSAP / 减少动态效果时交互不绑定，元素静止可用。
