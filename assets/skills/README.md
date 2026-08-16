# skills — RCJ9527 个人 AI 工作流技能合集（数字资产）

> 把一个人几年攒下来的干活手艺，从"只活在本地"变成"有版本、可迁移、可复用"的数字资产。
> 每个技能一个目录（SKILL.md 标准格式），复制到 `~/.workbuddy/skills/`（用户级）或项目 `.workbuddy/skills/`（项目级）即可用。

## 技能清单

| 技能 | 一句话说明 |
|---|---|
| [wechat-draft](wechat-draft/) | 公众号推文草稿流水线：AI 写内容（meta.json 驱动 + build.js 渲染，省 token）+ Playwright/本地 Chrome 自动填草稿（只存草稿不群发） |
| [rcj-screenshots](rcj-screenshots/) | 批量网页截图（Playwright + 系统 Chrome）：推文配图/产品演示/冒烟验证，默认内置 4 个 RCJ 产品 |
| [site-smoke-test](site-smoke-test/) | 网站冒烟测试：Playwright 遍历多页面抓报错、截图、出 Markdown 报告 |
| [github-dns-bypass](github-dns-bypass/) | GitHub DNS 劫持绕过：本地 DoH 代理 + HTTPS 推送 |
| [d1-api-e2e](d1-api-e2e/) | Cloudflare D1 API 端到端验证（Windows DNS 劫持环境下） |
| [rcj-audio-core](rcj-audio-core/) | Speak 系列共享音频核心：录音引擎 + 波形可视化（SoloSpeak/LetOut/FaceTalk 复用） |
| [rcj-written-exam-standard](rcj-written-exam-standard/) | RCJ 辅警/招考笔试刷题站「定向刷题 + 套题模考」实现规范 |
| [rcj-exam-builder](rcj-exam-builder/) | RCJ Exam Template 构建器：题库 → 静态刷题系统模板 |
| [anki-mcq-submit-reveal](anki-mcq-submit-reveal/) | Anki 刷题卡包统一模板标准（提交后显答案 + 面试录音卡） |
| [anki-structured-framework](anki-structured-framework/) | 给 Anki 卡包批量注入结构化答题框架 |
| [anki-interview-consistency](anki-interview-consistency/) | 辅警/公考面试 Anki 卡包质量核查与元数据定制 |
| [songsee](songsee/) | 音频频谱图与特征面板可视化 |
| [google-mic-recorder](google-mic-recorder/) | 录音相关工具 |
| [ian-xiaohei-illustrations](ian-xiaohei-illustrations/) | Ian 风格「小黑怪诞」中文正文配图 |
| [ponytail](ponytail/) | 懒人高级开发工程师模式：最简单且能跑通的方案 |
| [wechat-cover](wechat-cover/) | 公众号爆款封面 AI 设计 |
| [agently-mail](agently-mail/) | 通过 agently-cli 操作邮件（发送/回复/搜索/附件） |

## 产品方法论（数字资产文档）

> 不是技能，是可移植的方法论文档。任意 AI（WorkBuddy / Trae / Codex）开工前先加载，统一产品逻辑。换机时连本目录一起带走。

| 文档 | 说明 |
|---|---|
| [product-dev/RCJ-Product-Development-Framework.md](product-dev/RCJ-Product-Development-Framework.md) | RCJ 统一开发规范（AI 产品操作系统）：第一性原理 / 定位原则 / MVP / 成长路线 / 技术三层 / AI 协作禁令 / 项目模板 |
| [product-dev/Training-Hub-PRODUCT-RULES.md](product-dev/Training-Hub-PRODUCT-RULES.md) | Training Hub 的 `PRODUCT_RULES.md` 实例：锁定最小 MVP（个人生长日志）范围 |

## 安装

```bash
# 用户级（所有项目可用）
cp -r <技能目录> ~/.workbuddy/skills/

# 项目级（仅当前项目）
cp -r <技能目录> ./.workbuddy/skills/
```

## 维护约定

- 本地 `~/.workbuddy/skills/` 是**运行源**；本仓库是**版本源**（备份 + 换机迁移）
- 新增/修改技能后：同步到本仓库 → commit → push
- Trae 等工具沉淀的技能，也会持续上传到这里，形成统一数字资产
- 公共仓库，不放任何密钥/凭据（token 一律运行时读取）

## 🌐 RCJ 产品矩阵

| 产品 | 站点 | 仓库 |
| --- | --- | --- |
| RCJ Hub · 品牌枢纽 / 个人主页 | https://955827.xyz | rcj-hub |
| RCJ Exam Hub · 综合公职真题 | https://exam.955827.xyz | rcj-exam-bank |
| FaceTalk · 面试搭子 | https://facetalk.955827.xyz | facetalk |
| SoloSpeak · 独声 | https://955827.xyz/solospeak | solospeak |
| LetOut · 大声说 | https://955827.xyz/letout | letout |
| 辅警题库 · 多城市刷题 | https://fj.955827.xyz | aux-police-exam |
| 消防员题库 | https://xf.955827.xyz | xf-firefighter-exam |

> 备用域名：各站 `*.rcj9527.dpdns.org`（`.xyz` 不可达时回退）。
