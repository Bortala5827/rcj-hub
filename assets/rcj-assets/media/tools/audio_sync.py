#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audio_sync.py — rcj-media-assets 本地音频批量接入工具

用法：
  1. 把音频文件按 {id}.{ext} 命名放进 audio/ 目录
     （id 取 manifest 里条目的 id，如 f01.mp3 / sp03.ogg / r12.wav）
  2. 可选：建 audio_urls.json，写 {"sp03": "https://...mp3"} 指定外链
  3. 运行：python tools/audio_sync.py
     会把匹配到的音频写进对应条目的 audio 字段，并列出仍缺失的条目。

支持的浏览器原生格式（无需转码）：
  mp3, ogg, webm, wav, m4a(兼容性略差，会警告)
"""
import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(REPO, "audio")
MANIFEST = os.path.join(REPO, "manifest.json")
URL_MAP = os.path.join(REPO, "audio_urls.json")

WHITELIST = {"mp3", "ogg", "webm", "wav", "m4a", "flac"}
WARN_EXT = {"m4a"}  # 浏览器兼容性较差，仅警告


def load_manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def save_manifest(data):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    data = load_manifest()
    index = {}
    for b in data["batches"]:
        for it in b["items"]:
            index[it["id"]] = it

    filled = 0

    # 1) 外链映射优先（audio_urls.json）
    if os.path.exists(URL_MAP):
        urls = json.load(open(URL_MAP, encoding="utf-8"))
        for iid, u in urls.items():
            if iid in index:
                index[iid]["audio"] = u
                filled += 1
                print("  外链 ->", iid, u[:60])
            else:
                print("  [跳过] audio_urls.json 中无匹配 id:", iid)

    # 2) 本地文件（audio/{id}.ext）
    if os.path.isdir(AUDIO_DIR):
        for fn in sorted(os.listdir(AUDIO_DIR)):
            if fn.startswith("."):
                continue
            base, ext = os.path.splitext(fn)
            ext = ext.lstrip(".").lower()
            if ext not in WHITELIST:
                print("  [跳过] 非白名单格式:", fn)
                continue
            iid = base
            if iid in index:
                rel = f"audio/{fn}"
                index[iid]["audio"] = rel
                filled += 1
                flag = " (⚠ m4a 兼容性差)" if ext in WARN_EXT else ""
                print("  文件 ->", iid, rel, flag)
            else:
                print("  [跳过] 无匹配 id:", fn)
    else:
        print("  （audio/ 目录不存在，仅处理外链映射）")

    save_manifest(data)

    # 统计仍缺失的条目
    missing = [
        (it["id"], it.get("title", ""))
        for b in data["batches"]
        for it in b["items"]
        if not it.get("audio")
    ]

    print(f"\n✅ 本次接入 {filled} 条；manifest 仍缺音频 {len(missing)} 条：")
    for iid, title in missing:
        print(f"   - {iid}  {title}")


if __name__ == "__main__":
    main()
