# SoloSpeak · 独声 — 项目级技术规范（PROJECT SPEC）

> 本文件只定义 **技术实现**，不重复定义品牌理念。
> 品牌定位 / 人格 / 文化意象 / 边界 见上层文档：
> - `products/RCJ-产品生态总纲.md`
> - `products/Speak-Series-总体产品设计规范.md`
>
> 改品牌理念 → 改上层；改波形 / 表结构 / 交互 → 改本文件或代码。两层不互灌。

**一句话描述**：一个让独居者「跟自己说说话」的轻量语音工具。

**核心约束（来自系列规范）**：本地优先；个人录音不建云端音频仓库；需要什么存什么；用户始终拥有自己的数据。

---

## 0. 技术栈

- 纯前端，零后端依赖（无服务器、无 D1、无 KV）。
- 静态托管：Cloudflare Pages，**子路径 `/solospeak`**（部署时以仓库根作为站点根，所有资源用相对路径）。
- 语言：原生 HTML / CSS / ES Modules（不引框架，符合 RCJ「轻量优先」）。
- 持久化：**IndexedDB**（音频 Blob + 元数据）+ **LocalStorage**（设置项：每日目标分钟数、导出格式）。
- 录音：`MediaRecorder` + `getUserMedia`。
- 波形：`Web Audio API`（AnalyserNode 取峰值）或离线解码 `decodeAudioData` 取峰值，Canvas 渲染。
- PWA：`manifest.webmanifest` + `sw.js`，离线可用、可加到主屏。
- 兼容：Chrome / Edge / Safari 最新版。

---

## 1. 文件结构（PWA）

```text
solo-speak/
├── index.html                  # SPA 入口（日德克制气质：京都喫茶店 ＋ 柏林公寓）
├── manifest.webmanifest        # PWA 清单（name=SoloSpeak 独声, 主题色, 图标）
├── sw.js                       # Service Worker（缓存壳 + 离线）
├── styles/
│   └── app.css                 # 全部样式（暖灰底 + 米白 + 苔绿主色[偏冷] + 日式明朝体 / 德式无衬线）
├── js/
│   ├── app.js                  # 路由 + 全局状态 + 页面挂载
│   ├── db.js                   # IndexedDB 封装（见 §3）
│   ├── recorder.js             # 录音引擎（MediaRecorder 生命周期）
│   ├── waveform.js             # 波形可视化（★ 应抽成共享模块/Skill，见 §4）
│   ├── player.js               # 回放 + 声音日志浏览
│   ├── topics.js               # 话题库 + 取话题 / 换一个（见 §5）
│   ├── goals.js                # 动态目标（时长制，见 §6）
│   └── export.js               # 导出 TXT / Markdown / JSON（见 §7）
├── assets/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── quote-zhangchaoyang.txt # 张朝阳名言 + 可选名言池
└── PROJECT-SPEC.md             # 本文件
```

> 注：`waveform.js` 与 `recorder.js` 是 **SoloSpeak 与 LetOut 共享** 的核心模块，建议抽成独立 Skill（如 `rcj-audio-core`），两产品复用，避免录音/波形逻辑各写一遍。

---

## 2. 产品原则（实现层映射）

| 原则 | 实现落点 |
| --- | --- |
| 本地优先 | 录音默认存 IndexedDB，不主动上传云端 |
| 隐私优先 | 不建群、不交友、不留痕；无账号体系 |
| 用户掌握数据 | 提供导出（TXT/MD/JSON/音频）与（规划中）导入恢复 |
| 轻量优先 | 纯前端、无框架、无后端；存储只存必需 |
| 工具属性 | 不制造打卡焦虑、不强制留存；用完即走 |

---

## 3. IndexedDB 表结构（db.js）

数据库名：`solospeak`，版本：`1`。

### 3.1 `recordings`（录音主表）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string (uuid) | 主键 |
| `createdAt` | number (epoch ms) | 创建时间，索引 |
| `durationMs` | number | 时长 |
| `topicId` | string \| null | 关联 `topics.id` |
| `topicText` | string | 当时话题快照（即使话题后被删也能显示） |
| `topicLevel` | string \| null | 当时话题难度快照：`light` / `medium` / `heavy` |
| `transcript` | string \| null | 语音转文字结果（可选，本地调用，不强制） |
| `audioBlob` | Blob | 音频本体（webm/opus） |
| `peaks` | number[] | 波形峰值（缓存，避免回放时重算） |
| `moodTag` | string \| null | 情绪标签（可选，自由文本） |
| `favorite` | boolean | 是否标记「值得回听」 |

索引：`createdAt`（时间倒序浏览）、`favorite`。

### 3.2 `topics`（话题库）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 主键 |
| `level` | string | `light`(轻, 40%) / `medium`(中, 35%) / `heavy`(重, 25%) |
| `text` | string | 话题文案 |
| `isSpicy` | boolean | 是否【有点皮】（调味剂，低概率，见 §5） |
| `usageCount` | number | 被使用的次数（用于「换一个」降权） |
| `createdAt` | number | 入库时间 |

> MVP 内置 **60 条**话题，按 `level` 三级占比：轻 40% / 中 35% / 重 25%（即约 24 / 21 / 15 条）。
> 话题用于引导开口，**不要求用户深入讨论敏感内容**。

### 3.3 `goals`（动态目标，时长制）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `date` | string (YYYY-MM-DD) | 主键，按天 |
| `baseMin` | number | 用户设定的基础目标分钟（默认 30，存 LocalStorage） |
| `targetMin` | number | 当日实际目标分钟（基础 + 补差，上限 60） |
| `doneSec` | number | 当日已说秒数（每次录音累计） |
| `streak` | number | 连续「当天说过话」的天数 |
| `lastDoneAt` | number \| null | 上次录音完成时间（用于连续天数与恢复） |

**目标算法（P2）**
- 基础目标 `baseMin` 默认 **30 分钟**，用户可在设置里调整（存 LocalStorage `solospeak.dailyGoalMin`）。
- 动态补差：今天目标 = 基础目标 + 昨天缺口 × 50%；总目标 **上限 60 分钟**。
  - 昨天缺口 = `max(0, 昨天 targetMin − 昨天 doneSec/60)`。
- 进度 = `doneSec/60 ÷ targetMin`，封顶 100%。
- 不制造焦虑：文案是「今天，也听听自己的声音」，不是「你今天打卡了吗」。

### 3.4 设置项（LocalStorage）

| key | 说明 | 默认 |
| --- | --- | --- |
| `solospeak.dailyGoalMin` | 每日基础目标分钟 | `30` |
| `solospeak.exportFormat` | 默认导出格式 | `md` |

> 录音 / 元数据走 IndexedDB；轻量设置项走 LocalStorage（符合 SPEC「IndexedDB + LocalStorage」分工）。

---

## 4. 录音引擎（recorder.js）

职责：申请麦克风 → 录音 → 产出 `{ blob, durationMs, peaks }`。

- 使用 `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`。
- `MediaRecorder` 编码 `audio/webm;codecs=opus`（Chrome/Safari 通用）；存储原 Blob，不转码（轻量优先）。
- **交互（P0）**：**按住录音，松开停止**（pointerdown 开始，pointerup / pointerleave / pointercancel 停止）。过短（< 500ms）视为误触，不保存。
- 录音中实时用 `AnalyserNode` 抽峰值 → 交给 `waveform.js` 实时绘制。
- 停止后：计算总时长，返回 Blob 与峰值数组。
- 权限被拒：降级提示「独声需要麦克风权限」，不崩溃。
- 不自动上传、不留存到任何服务器。

---

## 5. 波形可视化（waveform.js）— 共享模块

- 输入：实时 `AnalyserNode` 或离线 `peaks` 数组。
- 输出：Canvas 上绘制的安静风格波形（线条细、配色克制，呼应日德克制气质：京都喫茶店 ＋ 柏林公寓）。
- 应封装为**无状态纯函数 + 一个挂载函数**，便于 LetOut 复用（LetOut 只是配色/振幅更热烈）。
- 建议沉淀为独立 Skill `rcj-audio-core`（含 recorder + waveform），SoloSpeak / LetOut 直接引用，不在两个产品各写一套。
- 性能：峰值数组长度控制在 200~400 点；回放时用缓存 `peaks`，不重新解码。

---

## 6. 话题库（topics.js）

- 初始话题由 `seed` 数据内置，**60 条**，每条带 `level`（light/medium/heavy）。
- 三级占比：轻 40% / 中 35% / 重 25%（感官流水账 / 微叙事记忆 / 轻哲学观点）。
- `spicy`（有点皮）是调味剂：少量、低概率出现，不进主占比统计。
- 取话题：`getTopic()` → 先按 level 权重抽样，再在该 level 内按 `usageCount` 降权；spicy 以低概率出现。
- 「换一个」：`nextTopic(currentId)` → 排除当前，再取；用户不想答就一直换，无惩罚。
- 日式问候文案（「今日も、あなたの声を聞かせて。」+ 中文辅助）与张朝阳名言放常量/资源，不进 DB。

---

## 7. 动态目标（goals.js，时长制）

见 §3.3。接口：`getTodayGoal()` / `addSpoken(durationMs)` / `getDailyGoalMin()` / `setDailyGoalMin(min)`。

UI 展示（home 视图）：
- 进度条：今日已说分钟 / 当日目标分钟。
- 补差提示：若当日目标 > 基础目标，显示「今天多补了 N 分钟（昨天没说完的）」。
- 连续天数：`streak`。

---

## 8. 导出（export.js）

用户始终拥有数据。支持导出个人声音日志：

- **TXT**：时间 + 时长 + 话题 + 转写文本（无音频，纯文本）。
- **Markdown**：同上，带标题与列表，便于写复盘。
- **JSON**：完整结构化（含 `peaks` 元数据、可选音频外链占位），便于交给 AI 分析或二次处理。
- 音频本体导出：可选「导出单条录音为 .webm」（浏览器原生下载 Blob），用户自留。

导出范围：单条 / 按日期区间 / 全部。
核心理念：**你的声音，值得被看见**——但导出是用户主动行为，产品不默认收集、不上传。

---

## 9. 边界与不该做的事（来自系列规范）

- 不做好友体系、私信、社区、Feed、强制注册、强制留存。
- 不评价「说得好不好」；允许停顿/重复/沉默/笑。
- 不建云端音频仓库；不因「以后可能有很多用户」提前上复杂后端。
- AI 转写（如接入）是可选本地能力，不是产品目的；不夸大 AI 能力。

---

## 10. 功能模块与版本规划

| 优先级 | 模块 | 范围 | 状态 |
| --- | --- | --- | --- |
| **P0** | 核心录音与存储 | 按住录音松开停止；IndexedDB 存储；列表显示日期/时长/话题；播放、删除 | V1.0 开发中 |
| **P1** | 话题引导 | 打开自动展示一条；「换一个」；轻/中/重三级；内置 60 条 | V1.0 开发中 |
| **P2** | 进度追踪 | 每日目标 30 分钟（可调）；今日时长累计；进度条；动态补差 50%、上限 60 | V1.0 开发中 |
| **P3** | 历史记录 | 日历视图（有录音的日期标记小点）；点击日期看当日列表；播放/下载/删除 | V1.1 计划中 |
| **P4** | 数据管理 | 导出 TXT/JSON/MD；**导入恢复**（上传备份恢复数据） | V1.1 计划中 |
| **P5** | PWA | 加到主屏；离线；品牌图标与启动画面 | V1.2 计划中 |

**后续扩展（非 MVP）**：VAD 静音检测（自动裁剪、统计实际说话时长）、Whisper 本地转写（浏览器内语音转文字）、导出日志增加转写内容、波形可视化（V2.0）。

> 注：波形实时可视化已在 V1.0 提前实现（录音/回放均有波形），V2.0 指更进一步的离线解码波形与转写联动。

---

## 11. 与 Speak Series 的关系

- SoloSpeak 是 Speak Series 的**第 2 款产品**（第 1 款是 FaceTalk）。
- 它不包含社交功能，不涉及多人匹配。
- 它的设计与代码（recorder / waveform）将在后续 LetOut 开发中被复用。
- FaceTalk 保持独立演进，不与 SoloSpeak 共用代码库。

---

## 12. 与上层文档的关系

| 文档 | 职责 | 本文件是否覆盖 |
| --- | --- | --- |
| `RCJ-产品生态总纲.md` | 生态架构/品牌关系 | 否 |
| `Speak-Series-总体产品设计规范.md` | 系列定位/人格/边界 | 否（仅引用） |
| 本文件 `PROJECT-SPEC.md` | SoloSpeak 技术实现 | **是** |
