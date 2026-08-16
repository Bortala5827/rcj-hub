# RCJ 情绪影子资源库

给 **SoloSpeak（独声）**「今日金句」与 **LetOut（大声说）**「情绪影子」提供可轮换的影视/人物台词素材（文本 + 可选 webm 音频）。

站点不存音频，只按日期从本仓库拉 `manifest.json`，每 3 天自动轮换一批；素材更新只需改仓库并推送。

## 目录结构

```
rcj-media-assets/
├── manifest.json   # 必填：站点只读这个
├── README.md
└── audio/          # 可选：webm 音频
```

## manifest.json

```json
{
  "repo": "RCJ 情绪影子资源库",
  "version": 1,
  "rotateDays": 3,
  "batches": [
    {
      "id": "batch-film",
      "label": "批次一 · 影视治愈",
      "items": [
        { "id": "f01", "title": "功夫熊猫 · 阿宝", "text": "你患得患失……今天，是上天的礼物。", "audio": "audio/f01.webm" },
        { "id": "f02", "title": "海上钢琴师", "text": "我们笑着说再见……", "audio": null }
      ]
    }
  ]
}
```

字段：`batches[].id/label`、`items[].id/title/text/audio`（`audio` 可填相对路径 / 完整 URL / `null` 纯文本）。

## 轮换规则

- 每 `rotateDays`（默认 3）天换一批：`批次序号 = floor(今天距纪元天数 / 3) % 批次数`。
- 调周期改 `letout/js/resource.js` 里的 `ROTATE_DAYS`。
- 建议每批 15–20 条，题材拉开（影视治愈 / 人物力量 / 释放出口）。

## 接入（一次性）

1. 本仓库已推送 `master`（公开）。
2. 打开 `letout/js/resource.js`，把 `RESOURCE_REPO_RAW` 设为 raw 根地址：

   ```js
   const RESOURCE_REPO_RAW = 'https://raw.githubusercontent.com/Bortala5827/rcj-media-assets/master';
   ```

   （SoloSpeak 同理改 `solo-speak/js/quotes.js` 同一处。）
3. 站点更新后 `Ctrl+F5` 硬刷即可见远程素材。

> 未填时页面回退到 `resource.js` 内嵌占位，始终有内容。

## 添加语音（可选）

录 webm → 放进 `audio/` → 改对应条目 `audio` 字段 → 提交推送，下次刷新/轮换生效，无需改代码。

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
