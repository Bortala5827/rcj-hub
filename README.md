# RCJ Hub · 品牌枢纽 / 个人主页

RCJ 产品生态的总入口与作者主页。Cloudflare Pages 托管，极简单页，零 JS。

- **演示**：https://955827.xyz
- **仓库**：`github.com/Bortala5827/rcj-hub`

## 定位：RCJ Lab → RCJ Hub

**RCJ Lab** 是母体品牌 —— 个人 AI 创造实验室：探索想法、造工具、把作品分享出去。
**RCJ Hub** 是 RCJ Lab 的对外产品中心 / 网站工程仓库。

```text
RCJ Lab（个人 AI 创造实验室 · 母体品牌）
   └── RCJ Hub（对外产品中心 / 网站工程仓库）
         ├── Exam Hub ······ 辅警题库 / 消防题库 / 公考资源
         ├── Speak Series ·· SoloSpeak / LetOut / FaceTalk
         └── 其他实验项目
```

| 层 | 名字 | 在哪看到 |
| --- | --- | --- |
| 品牌母体 | RCJ Lab | 访问 955827.xyz 看到的字标与 title |
| 产品中心 | RCJ Hub | 产品入口聚合与站点工程本身 |
| 代码仓库 | `rcj-hub` | GitHub 仓库名（**不改名**） |

> 仓库名 `rcj-hub` 与页面品牌「RCJ Lab」属于不同层，不可互换：CSS/埋点/后台一律用 `hub`，对外文案才用「RCJ Lab」。

## 是什么

- 品牌字标 + 自我介绍 + 全部产品入口
- Vibe Coding 友链区：GitHub PR 换链 / 页面表单投稿（D1 收件箱，防垃圾）
- 邮箱 + 版权 footer

详细设计规范见 [`RCJ-Hub-总体设计规范.md`](./RCJ-Hub-总体设计规范.md)。

## 更新

改 `index.html` / `assets/hub.v2.css` → commit + push 到 `main` → CF Pages 自动上线。
**改完线上 `Ctrl+F5` 硬刷**（Mac: `Cmd+Shift+R`）。

## RCJ 产品矩阵

RCJ 产品生态共三类：

**① 品牌枢纽（个人主页 / Vibe Coding 展示）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| RCJ Hub · 品牌枢纽 / 个人主页 | https://955827.xyz | rcj-hub |

**② RCJ Exam Hub（公职考试题库，含辅警 / 消防）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| RCJ Exam Hub · 综合公职真题 | https://exam.955827.xyz | rcj-exam-bank |
| 辅警题库 · 多城市刷题 | https://fj.955827.xyz | aux-police-exam |
| 消防员题库 | https://xf.955827.xyz | xf-firefighter-exam |

**③ Speak Series（开口表达系列）**

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| SoloSpeak · 独声 | https://955827.xyz/solospeak | solospeak |
| LetOut · 大声说 | https://955827.xyz/letout | letout |
| FaceTalk · 面试搭子 | https://facetalk.955827.xyz | facetalk |

> ③ 当前统一在 Speak Series 下运营；若某产品（如 FaceTalk）数据跑出独立价值，可后续拆为独立产品——但不是现在。

## 资产层（按类型分仓库，供上层产品复用）

产品层做完就丢是浪费；能复用的一律沉淀到资产仓库，上层只「调用模块」。

| 仓库 | 存什么 | 被谁调用 |
| --- | --- | --- |
| rcj-interaction-assets | 声纹动画 / 解压互动 / GSAP 动效 / 粒子 | Speak Series、RCJ Hub 首页 |
| rcj-media-assets | 音频素材与媒体组件 | Speak Series |
| skills | AI 提示词 / 工作流 / Skill 沉淀 | 全部项目 |

资产总目录（我有什么资产，一页看全）：**[955827.xyz/assets](https://955827.xyz/assets)**
