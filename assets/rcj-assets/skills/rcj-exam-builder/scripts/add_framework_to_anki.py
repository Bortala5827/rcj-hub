#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给已有 Anki .apkg 卡包批量注入「结构化答题框架」模块 + 清洗双引号脏数据，重新打包。

.apkg 本质是一个 zip，内含 collection.anki2（SQLite）与 media（媒体映射 JSON）。
每张卡的字段用 \\x1f 分隔，模型字段顺序通常为 Front\\x1fBack（或类似两字段）。
本脚本：
  1. 解包 .apkg -> 读 collection.anki2 的 notes 表
  2. 按 tags / Front 文字判定题型 -> 取出该题型的结构化思路与要点
  3. 在 Back 第一个 <div class="module 之前插入一个内联样式框架块
  4. 清洗答案中 CSV 转义残留的连续双引号 "" -> "
  5. 写回 SQLite 并重新打包成 .apkg（保留 media 映射）
"""
import argparse
import json
import os
import re
import shutil
import sqlite3
import time
import zipfile

# ---- 默认题型 -> (结构化思路, 核心要点)：适用于辅警/公考结构化面试 ----
DEFAULT_FRAMEWORK = {
    "综合分析": ("破题表态 → 多维分析(意义/问题/原因) → 提出对策 → 总结升华",
                 "① 亮明观点 ② 辩证分析 ③ 落地举措"),
    "应急应变": ("快速响应控场 → 分级分类处置 → 根源化解/安抚 → 复盘防范",
                 "① 稳局面 ② 解诉求 ③ 防反弹"),
    "组织管理": ("明确目标 → 制定方案 → 组织实施 → 总结反馈",
                 "① 定方案 ② 抓执行 ③ 留台账"),
    "人际沟通": ("换位思考 → 主动沟通 → 求同解异 → 长效机制",
                 "① 换立场 ② 主动沟通 ③ 求共赢"),
    "自我认知与职位匹配": ("自我画像 → 岗位匹配 → 短板改进 → 职业承诺",
                           "① 我是谁 ② 为何适配 ③ 如何成长"),
}
DEFAULT_TAG_MAP = {
    "综合分析": "综合分析",
    "应急处置": "应急应变",
    "应急应变": "应急应变",
    "组织管理": "组织管理",
    "组织协调": "组织管理",
    "人际沟通": "人际沟通",
    "自我认知": "自我认知与职位匹配",
}
DEFAULT_FW = ("审题破题 → 分点作答 → 总结提升", "① 审题 ② 分点 ③ 收尾")


def clean_quotes(text):
    """把 CSV 转义残留的连续双引号(2个及以上)折叠成单个双引号。"""
    return re.sub(r'"{2,}', '"', text)


def framework_module_html(type_key, framework_map):
    idea, points = framework_map.get(type_key, DEFAULT_FW)
    return (
        '<div style="border-left:4px solid #1e3a5f;background:#f1f5f9;border-radius:8px;'
        'padding:10px 14px;margin:10px 0;">\n'
        '  <div style="font-weight:700;color:#1e3a5f;font-size:15px;margin-bottom:6px;">'
        '🧩 结构化思路（答题框架）</div>\n'
        '  <div style="font-size:13px;line-height:1.85;color:#334155;">\n'
        '    【题型】' + type_key + '<br>\n'
        '    【结构化思路】' + idea + '<br>\n'
        '    【核心要点】' + points + '\n'
        '  </div>\n'
        '</div>'
    )


def detect_type(tags, front, tag_map):
    for tag, key in tag_map.items():
        if tag in tags:
            return key
    # 退路：从 Front 里的【xxxx年 · 题型】文字识别
    m = re.search(r'·\s*([^】·]+?)\]', front)
    if m:
        cand = m.group(1).strip()
        if cand in tag_map:
            return tag_map[cand]
    return None


def process(apkg_path, out_path, framework_map, tag_map, module_title, overwrite,
            clean, field_sep="\x1f", back_index=1):
    tmp = os.path.join(os.path.dirname(os.path.abspath(apkg_path)), ".anki_build_tmp")
    os.makedirs(tmp, exist_ok=True)
    z = zipfile.ZipFile(apkg_path)
    z.extract("collection.anki2", tmp)
    try:
        z.extract("media", tmp)
    except KeyError:
        with open(os.path.join(tmp, "media"), "w", encoding="utf-8") as f:
            f.write("{}")
    dbp = os.path.join(tmp, "collection.anki2")

    con = sqlite3.connect(dbp)
    c = con.cursor()
    rows = c.execute("select id, flds, tags from notes").fetchall()

    injected = 0
    cleaned = 0
    for nid, flds, tags in rows:
        f = flds.split(field_sep)
        while len(f) <= back_index:
            f.append("")
        front, back = f[0], f[back_index]
        if clean:
            nf = clean_quotes(front)
            nb = clean_quotes(back)
            if nf != front or nb != back:
                cleaned += 1
        else:
            nf, nb = front, back
        type_key = detect_type(tags, nf, tag_map)
        if type_key:
            mod = framework_module_html(type_key, framework_map)
            idx = nb.find('<div class="module ')
            if idx == -1:
                nb = mod + "\n" + nb
            else:
                nb = nb[:idx] + mod + "\n\n" + nb[idx:]
            injected += 1
        f[0], f[back_index] = nf, nb
        new_flds = field_sep.join(f)
        c.execute("update notes set flds=?, mod=? where id=?", (new_flds, int(time.time()), nid))

    c.execute("update col set mod=?", (int(time.time()),))
    con.commit()
    con.close()

    if os.path.exists(out_path) and not overwrite:
        base, ext = os.path.splitext(out_path)
        out_path = base + "_structured" + ext
    if os.path.exists(out_path):
        os.remove(out_path)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as o:
        o.write(os.path.join(tmp, "collection.anki2"), "collection.anki2")
        o.write(os.path.join(tmp, "media"), "media")

    shutil.rmtree(tmp, ignore_errors=True)
    print("[+] 完成：注入结构化模块题数=%d，清洗脏数据题数=%d" % (injected, cleaned))
    print("[+] 输出:", out_path, os.path.getsize(out_path), "bytes")


def main():
    ap = argparse.ArgumentParser(description="为 Anki .apkg 批量注入结构化答题框架")
    ap.add_argument("apkg", help="输入 .apkg 路径")
    ap.add_argument("-o", "--output", default=None, help="输出 .apkg 路径（默认在同目录加 _structured 后缀）")
    ap.add_argument("--framework-json", default=None, help="题型->[思路,要点] 的 JSON 文件，覆盖默认映射")
    ap.add_argument("--tag-map-json", default=None, help="tag关键词->题型key 的 JSON 文件，覆盖默认映射")
    ap.add_argument("--module-title", default="🧩 结构化思路（答题框架）", help="框架块标题")
    ap.add_argument("--no-clean", action="store_true", help="不清洗双引号脏数据")
    ap.add_argument("--overwrite", action="store_true", help="直接覆盖输出文件")
    args = ap.parse_args()

    fw_map = DEFAULT_FRAMEWORK
    if args.framework_json:
        fw_map = json.load(open(args.framework_json, encoding="utf-8"))
    tag_map = DEFAULT_TAG_MAP
    if args.tag_map_json:
        tag_map = json.load(open(args.tag_map_json, encoding="utf-8"))

    out = args.output or (os.path.splitext(args.apkg)[0] + "_structured.apkg")
    process(args.apkg, out, fw_map, tag_map, args.module_title, args.overwrite,
            clean=not args.no_clean)


if __name__ == "__main__":
    main()
