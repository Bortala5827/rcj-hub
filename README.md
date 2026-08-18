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

## 自动化测试

本仓库内置标准 Web 自动化测试体系：**Playwright（本机真实 Google Chrome）+ axe-core 无障碍 + Lighthouse CI + GitHub Actions 回归**。

- 本地：`npm test`（冒烟+功能）、`npm run test:axe`（无障碍）、`npm run lighthouse`（性能/SEO）
- CI：`push`/`PR` 到 `main` 自动跑，**只测试不部署**（不碰 CF 正式部署）
- 完整说明见 [`TESTING.md`](./TESTING.md)

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
| 辅警题库 · 多城市刷题（内置 /fj） | https://exam.955827.xyz/fj | rcj-exam-bank（原 aux-police-exam 已并入并删除） |
| 消防员题库（内置 /xf） | https://exam.955827.xyz/xf | rcj-exam-bank（原 xf-firefighter-exam 已并入并删除） |

**③ Speak Series（开口表达系列）**

围绕「开口」做的一系列轻量工具——不社交、不评判、把表达权还给自己。

| 产品 | 是什么（一句话） | 站点 | 仓库 |
| --- | --- | --- | --- |
| SoloSpeak · 独声 | 给独居者的轻量语音工具：按住录音、跟自己说说话；本地优先、隐私优先、零后端，声音只存你本地。 | https://955827.xyz/solospeak | rcj-hub（子路径，无独立仓） |
| LetOut · 大声说 | 低连接时代的情绪出口：说出来 / 喊出来 / 唱出来 / 哭出来 / 安静一下，录完即焚，不社交不治疗。 | https://955827.xyz/letout | rcj-hub（子路径，无独立仓） |

**④ FaceTalk（独立产品 · 面试匹配）**

| 产品 | 是什么（一句话） | 站点 | 仓库 |
| --- | --- | --- | --- |
| FaceTalk · 面试搭子 | 面试筛选器：60 秒试音、双向选择，合适了再去腾讯会议深聊；免费、匿名、免登录。 | https://facetalk.955827.xyz | facetalk |

> ③ Speak Series 内 SoloSpeak / LetOut 作为 rcj-hub 子路径部署；FaceTalk 已独立成产品、独立成仓，不再归入 Speak Series（面试场景与「开口表达」定位不同）。

## 资产层（统一收口到 rcj-hub/assets）

产品层做完就丢是浪费；能复用的一律沉淀到资产层，上层只「调用模块」。

> **2026-08-16 二次合并**：`rcj-assets` 仓库已并入本仓库 `assets/rcj-assets/`，旧仓 `skills` / `rcj-media-assets` / `rcj-interaction-assets` 此前也已归档。资产不再有独立仓库。

| 目录 | 存什么 | 被谁调用 |
| --- | --- | --- |
| `assets/rcj-assets/skills/` | AI 技能（SKILL.md）/ 音频引擎 / 题库生成器 / 工作流 | 全部项目 |
| `assets/rcj-assets/media/` | 音频 MP3 素材 / 媒体处理脚本 | Speak Series |
| `assets/rcj-assets/interaction/` | 声纹动画 / 解压互动 / GSAP 动效 / 粒子效果 | Speak Series、RCJ Hub |

**仓库**：[`Bortala5827/rcj-hub`](https://github.com/Bortala5827/rcj-hub)（资产位于 `assets/rcj-assets/`）

资产总目录（我有什么资产，一页看全）：**[955827.xyz/assets](https://955827.xyz/assets)**
