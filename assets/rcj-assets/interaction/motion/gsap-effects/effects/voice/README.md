# 声纹生命体 · Voice Orb

呼吸式同心声纹 + 点击涟漪，GSAP 时间线驱动。

## 适用场景
- **SoloSpeak / LetOut** 首屏招牌母题：用「会呼吸的声纹」传达"开口 / 声音 / 独处表达"的产品内核。
- 任意需要"生命感"的占位 / 加载 / 语音录制态指示。

## 技术要点
- `gsap.timeline({ repeat:-1, yoyo:true })` 驱动三层同心环错落缩放 + 透明度脉动（sine 缓动，自然呼吸感）。
- 点击 / 触摸时动态创建 SVG `<circle>`，`gsap.fromTo` 缩放淡出模拟涟漪，`onComplete` 自动移除节点（无内存泄漏）。
- 复用仓库 vendored 的 `gsap / ScrollTrigger / SplitText` + `rcj-motion.js`，**无 CDN、无构建链**。
- `prefers-reduced-motion: reduce` 下直接 `return`，全程静止展示，符合无障碍降级。

## 预览
打开同目录 `index.html`（需经 HTTP 服务，因引用 `../../vendor/` 相对路径）。
