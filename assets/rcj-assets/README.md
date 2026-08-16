# RCJ Assets

**RCJ 统一资产库** — 技能、媒体素材、互动效果模块，供 Speak Series / Exam Hub / RCJ Hub 调用。

> 不是独立产品，而是「供料层」。做功能 → 沉淀资产 → 下一次复用。

## 目录

```
rcj-assets/
├── skills/          # AI 技能（SKILL.md）、工作流、音频引擎
│   ├── rcj-audio-core/      # 声波引擎（waveform/player/recorder/sharecard）
│   ├── rcj-exam-builder/    # 题库站生成器
│   ├── wechat-cover/        # 公众号封面设计
│   └── ...                  # （每个子目录 = 一个 Skill）
│
├── media/           # 音视频素材与媒体组件
│   ├── audio/               # 音频文件（MP3）
│   ├── tools/               # 媒体处理脚本
│   └── manifest.json        # 媒体清单
│
└── interaction/     # 互动效果模块（声纹动画 / 解压 / GSAP / 粒子）
    ├── voice/                # 声音类（waveform / voice-particles / spectrum）
    ├── relax/                # 解压释放（bubble-pop / shake / particle-burst / breathe）
    ├── motion/               # 物理互动（floating-text / gsap-effects / page-transition）
    ├── particles/            # 粒子效果（confetti / stars / firework）
    ├── assets-manifest.json  # 互动资产状态索引
    └── REUSE.md              # 复用规则
```

## 三层定位

| 层 | 仓库 | 存什么 |
|---|------|--------|
| 产品层 | `rcj-hub` / `facetalk` / `solospeak` / … | 面向用户的站点与应用 |
| **资产层** | **`rcj-assets`（本仓）** | 技能、素材、互动模块 |
| 引擎层 | `rcj-audio-core`（在 skills/ 内） | 底层音频/Web Audio API |

## 接入方式

1. **Skills**：复制对应 `SKILL.md` + 代码到 `~/.workbuddy/skills/` 或项目 `.workbuddy/skills/`
2. **Media**：按 `media/manifest.json` 索引引用音频/素材
3. **Interaction**：按 `interaction/REUSE.md` 规则，复制模块目录到产品 `assets/` 或 `vendor/`

## Part of RCJ Lab

RCJ Lab → Explore ideas, build tools, share creations.
RCJ Hub → User-facing product center (`rcj-hub` repo).
RCJ Assets → This repo: reusable asset library.

## License

各模块自述许可。默认 MIT。
