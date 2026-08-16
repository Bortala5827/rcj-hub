# product-dev — RCJ 产品方法论（数字资产）

> 这是 RCJ 产品体系的「AI 产品操作系统」：让 WorkBuddy / Trae / Codex 等任意 AI 在动手前先加载同一套产品逻辑。
> 不是技能（skill），而是**可移植的方法论文档**。换机 / 跨 AI 时，把本目录一起带走即可。

## 文档清单

| 文档 | 作用 | 何时读 |
|---|---|---|
| [RCJ-Product-Development-Framework.md](RCJ-Product-Development-Framework.md) | 统一开发规范：第一性原理、定位原则、MVP、成长路线、技术三层、AI 协作禁令、项目模板；**§十「产品开发哲学」原则全集**（窗口期优先 / 赛马机制 / 数据驱动 / 轻资产 / 自我使用等 12 条） | **任何新项目开工前必读** |
| [Training-Hub-PRODUCT-RULES.md](Training-Hub-PRODUCT-RULES.md) | Training Hub 的 `PRODUCT_RULES.md` 实例（框架第七节模板）：锁定最小 MVP 范围 | 开发 Training 时对照，防止范围漂移 |
| [Exam-Hub-PRODUCT-RULES.md](Exam-Hub-PRODUCT-RULES.md) | Exam Hub 的 `PRODUCT_RULES.md` 实例：定位、调用关系链、变现逻辑（工具免费 / 数据资产收费） | 开发或调整 Exam Hub 时对照 |
| [Content-Growth-Strategy.md](Content-Growth-Strategy.md) | 自媒体矩阵（增长层）策略：平台分工、内容管线、节奏约束、红线 | 产出公众号 / 小红书 / 视频号内容前必读 |

> **Exam Hub 的 canonical 位置**：`rcj-exam-bank/PRODUCT-RULES.md`。本目录保留副本作为方法论参考，但开发 Exam Hub 时应以仓库内版本为准。

## 加载顺序（给 AI 的指令）

```
1. RCJ-产品生态总纲.md        ← 生态边界，不能把产品做歪
2. RCJ-Product-Development-Framework.md  ← 本目录，方法论
3. 该项目自己的 PRODUCT_RULES.md        ← 具体范围闸门
```

## 维护约定

- `products/` 根目录只保留**生态级 / 系列级总纲**（《产品生态总纲》、Framework、Speak Series 规范），作为工作区入口。
- **各项目 PRODUCT_RULES.md** 放进各自仓库（如 `rcj-exam-bank/PRODUCT-RULES.md`），不要堆在根目录。
- **方法论辅助文档**（Training 规划、增长策略等）保留在本目录，既是版本源也是可移植资产。
- 改了任何一份后，同步到其 canonical 位置 → commit → push。
