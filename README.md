# RCJ 考试资料站家族 · 枢纽页

`955827.xyz` 的静态品牌脸面 + 旗下站点导流枢纽。零维护、零 JS 依赖。

## 部署

- 仓库：`github.com/ZHOUQIANG5827/rcj-hub`
- 托管：Cloudflare Pages（自动构建 main 分支，输出目录 `/`）
- 自定义域：`955827.xyz`（CF 自动签发证书 + DNS）

## 内容结构

- 顶部 Hero：RCJ 品牌 + 一句话定位
- 中部：4 张旗下站点卡片
  - 🏛️ 国考/省考/事业编真题库（免费引流）
  - 🛡️ 辅警/民辅警题库（定制主力）
  - 🚒 政府/企业消防员（定制主力）
  - 🛠️ AI / 网站搭建教学（次要变现）
- 底部：闲鱼 / 公众号入口 + 免责声明

## 更新

直接改 `index.html` / `assets/main.css`，commit + push 到 main，CF Pages 自动上线。
**改完线上需 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）拿掉旧缓存。

## 设计原则

- 极简单页 HTML，零 JS
- 响应式：手机优先（≤640px 单列）
- RCJ 品牌蓝 `#1e88e5`
- 首屏 < 50KB（gzipped）