#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_data.py — 把可编辑的 data.json 生成离线运行时 data.js（window.DATA = [...]）。

为什么分两个文件：
    data.json  = 人维护的「源文件」，新增/修改题目只改这里，好读好改。
    data.js    = 浏览器直接 <script src> 加载（window.DATA），离线 file:// 也能用，
                 无需 fetch（fetch 在 file:// 下被 CORS 拦截）。CDN 上设 immutable 长缓存。

用法：
    python build_data.py data.json -o data.js
    python build_data.py data.json -o data.js --minify        # 压缩单行，体积更小
    python build_data.py 题目.csv -o data.js --from csv        # 一步：源文件→data.js（顺带生成 data.json）

    # 题库清洗 / 筛选（支撑「近 N 年」约定）
    python build_data.py data-interview.json -o data-interview.js --global-name DATA_INTERVIEW --minify --filter-year 2023
    python build_data.py data-interview.json -o data-interview.js --global-name DATA_INTERVIEW --minify --recent-years 3
    python build_data.py data-written.json   -o data-written.js   --global-name DATA_WRITTEN   --minify --filter-batch "第十批,第七批,第六批"
    python build_data.py data-interview.json -o data-interview.js --global-name DATA_INTERVIEW --minify --filter-year 2023 --save-filtered-json data-interview.json --config template-config.json --emit-config config.js --emit-version --template-version 1.0.0

说明：
    - 筛选参数：--filter-year（保留 year>=N）、--recent-years N（自动算 year>=今年-N+1）、
      --filter-batch（逗号分隔的批次关键词，包含匹配：如 '第十批' 命中 '第十批·单选题'；缺 batch 默认保留）。
    - 筛选后题量会在 --emit-version 生成的 VERSION.json 中正确体现（当前 input 对应的 mode 用筛选后数量）。
    - --save-filtered-json 把筛选结果写回源 JSON（固化清洗决策）；不指定则只生成 JS、不改源文件。
    - 自动补 num（缺则顺延）与 _idx（数组下标）。
    - --from 时直接调用 ingest 逻辑，省去中间 data.json（但建议保留 data.json 便于后续维护）。
"""
import json
import os
import sys
import argparse
import datetime

HERE = os.path.dirname(os.path.abspath(__file__))


def load_data(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get('questions', data.get('data', []))
    return data


def apply_filters(data, filter_year=None, filter_batch=None, filter_strict=False):
    """按年份 / 批次筛选题目（支撑「近 N 年」约定）。

    - filter_year: 保留 year >= N 的题；缺 year 的题默认保留（适配笔试无年份字段）。
    - filter_batch: 保留 batch 包含白名单任一关键词的题（如 '第十批' 命中 '第十批·单选题'）；缺 batch 的题默认保留。
    - filter_strict: 缺 year / batch 的题也丢弃（默认保留，避免误删无字段题）。
    返回筛选后的新列表，不修改原列表。
    """
    if filter_year is None and not filter_batch:
        return data
    flt_batch = set(b.strip() for b in (filter_batch or '').split(',') if b.strip())
    out, dropped = [], 0
    for q in data:
        keep = True
        if filter_year is not None:
            y = q.get('year')
            if y is None:
                keep = keep and (not filter_strict)
            else:
                keep = keep and (int(y) >= filter_year)
        if flt_batch:
            b = q.get('batch')
            if b is None:
                keep = keep and (not filter_strict)
            else:
                # 包含匹配：白名单关键词命中 batch 任意子串即保留
                keep = keep and any(kw in str(b) for kw in flt_batch)
        if keep:
            out.append(q)
        else:
            dropped += 1
    print(f"[*] 筛选：{len(data)} -> {len(out)} 题（剔除 {dropped} 题）")
    return out


def finalize(data, auto_num=False):
    for i, q in enumerate(data):
        if 'num' in q and not isinstance(q.get('num'), int):
            q['num'] = i + 1
        elif auto_num and 'num' not in q:
            q['num'] = i + 1
        q['_idx'] = i
    return data


def emit_js(data, out, minify, global_name='DATA'):
    if minify:
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    else:
        payload = json.dumps(data, ensure_ascii=False, indent=1)
    content = f"window.{global_name} = {payload};\n"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    return len(content.encode('utf-8'))


def emit_config(config_path, out, minify=False):
    """把 template-config.json 编译成 config.js（window.SITE_CONFIG）。
    站点配置不靠 fetch（file:// 下 fetch 被 CORS 拦），统一走全局变量。
    """
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    if minify:
        payload = json.dumps(cfg, ensure_ascii=False, separators=(',', ':'))
    else:
        payload = json.dumps(cfg, ensure_ascii=False, indent=1)
    content = f"window.SITE_CONFIG = {payload};\n"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(content)
    return len(content.encode('utf-8'))


def emit_version(config_path, version_path, version="1.0.0", override_counts=None):
    """根据 template-config.json 的 datasets 统计各模式题量，生成 VERSION.json。
    VERSION.json 由脚本自动生成，禁止人工修改（updated 取当天日期）。
    viewer.html 读取后显示：版本号 / 更新时间 / 各模式题量。
    """
    with open(config_path, encoding='utf-8') as f:
        cfg = json.load(f)
    datasets = cfg.get('datasets', [])
    counts = {}
    override_counts = override_counts or {}
    for ds in datasets:
        mode = ds.get('mode')
        if mode in override_counts:
            counts[mode] = override_counts[mode]
            continue
        jpath = ds.get('json')
        n = 0
        if jpath and os.path.exists(jpath):
            try:
                n = len(load_data(jpath))
            except Exception as e:
                print(f"[!] 统计 {jpath} 失败：{e}")
        counts[mode] = n
    ver = {
        "version": version,
        "updated": datetime.date.today().isoformat(),
        "counts": counts,
    }
    if 'written' in counts:
        ver['writtenCount'] = counts['written']
    if 'interview' in counts:
        ver['interviewCount'] = counts['interview']
    with open(version_path, 'w', encoding='utf-8') as f:
        json.dump(ver, f, ensure_ascii=False, indent=2)
    total = sum(counts.values())
    print(f"[+] 已生成 {version_path}：version={version}，updated={ver['updated']}，题量={counts}（合计 {total}）")
    return ver


def main():
    ap = argparse.ArgumentParser(description="data.json → data.js（window.DATA）")
    ap.add_argument("input", help="data.json 或源文件 csv/xlsx/json/txt")
    ap.add_argument("-o", "--out", default="data.js", help="输出 JS，默认 data.js")
    ap.add_argument("--minify", action="store_true", help="压缩为单行")
    ap.add_argument("--from", dest="src", choices=['csv', 'xlsx', 'json', 'txt'], default=None,
                    help="源格式：若 input 是源文件，指定其格式走 ingest 流程")
    ap.add_argument("--keep-json", default=None, help="--from 时顺带写出的 data.json 路径")
    ap.add_argument("--auto-num", action="store_true",
                    help="源数据缺 num 时自动补 i+1；默认保留原样（不补）")
    ap.add_argument("--global-name", default="DATA",
                    help="输出 JS 的全局变量名（默认 DATA）。合并站点用：笔试=data-written.js 设 DATA_WRITTEN，面试=data-interview.js 设 DATA_INTERVIEW")
    ap.add_argument("--config", default=None,
                    help="模板配置 template-config.json，顺带生成 config.js（window.SITE_CONFIG）")
    ap.add_argument("--emit-config", default="config.js",
                    help="--config 时输出的 JS 文件名，默认 config.js")
    ap.add_argument("--emit-version", action="store_true",
                    help="根据 --config 的 datasets 统计各模式题量，生成 VERSION.json")
    ap.add_argument("--version-file", default="VERSION.json",
                    help="--emit-version 时输出的文件路径，默认 VERSION.json")
    ap.add_argument("--template-version", default="1.0.0",
                    help="--emit-version 时写入的版本号，默认 1.0.0")
    ap.add_argument("--filter-year", type=int, default=None,
                    help="按年份筛选：保留 year >= N 的题（缺 year 的题默认保留）")
    ap.add_argument("--recent-years", type=int, default=None,
                    help="便捷：自动算 year >= (今年-N+1)，如 --recent-years 3 → 保留近3年")
    ap.add_argument("--filter-batch", default=None,
                    help="按批次白名单筛选：逗号分隔的 batch 名，如 '第十批,第七批'（缺 batch 默认保留）")
    ap.add_argument("--filter-strict", action="store_true",
                    help="缺 year / batch 字段的题也丢弃（默认保留，避免误删无字段题）")
    ap.add_argument("--save-filtered-json", default=None,
                    help="把筛选后的题目写回该 JSON 路径（固化清洗决策）；不指定则只生成 JS")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"[!] 文件不存在: {args.input}")

    ext = os.path.splitext(args.input)[1].lower()
    if args.src or ext == '.json':
        if args.src in (None, 'json') and ext == '.json':
            data = load_data(args.input)
        else:
            # 走 ingest
            sys.path.insert(0, HERE)
            import ingest
            fmt = args.src or ({'.csv': 'csv', '.xlsx': 'xlsx', '.xls': 'xlsx',
                                '.txt': 'txt'}.get(ext))
            if fmt == 'csv':
                data = ingest.read_csv(args.input)
            elif fmt == 'xlsx':
                data = ingest.read_xlsx(args.input)
            elif fmt == 'txt':
                data = ingest.read_txt(args.input)
            else:
                raise SystemExit("[!] 无法判断源格式，请用 --from")
            if args.keep_json:
                os.makedirs(os.path.dirname(os.path.abspath(args.keep_json)) or '.', exist_ok=True)
                with open(args.keep_json, 'w', encoding='utf-8') as f:
                    json.dump(ingest.finalize(data), f, ensure_ascii=False, indent=2)
                print(f"[+] 已顺带写出源文件 {args.keep_json}")
    else:
        raise SystemExit("[!] input 需为 data.json，或加 --from 指定源格式")

    # 便捷：--recent-years N → 计算 filter_year（未显式指定 --filter-year 时生效）
    if args.recent_years and args.filter_year is None:
        args.filter_year = datetime.date.today().year - args.recent_years + 1
        print(f"[*] --recent-years {args.recent_years} → 保留 year >= {args.filter_year}")

    # 题库筛选 / 清洗
    filtered = False
    if args.filter_year is not None or args.filter_batch:
        data = apply_filters(data, args.filter_year, args.filter_batch, args.filter_strict)
        filtered = True
        if args.save_filtered_json:
            with open(args.save_filtered_json, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"[+] 已写出筛选后 JSON：{args.save_filtered_json}")

    data = finalize(data, args.auto_num)
    size = emit_js(data, args.out, args.minify, args.global_name)
    print(f"[+] 已生成 {args.out}：{len(data)} 题，{size} 字节（{'压缩' if args.minify else '格式化'}，全局 {args.global_name}）")
    print(f"[+] 在 HTML 中通过 <script src=\"{os.path.basename(args.out)}\"></script> 引入即可（置于应用脚本之前）")

    if args.config:
        csize = emit_config(args.config, args.emit_config, args.minify)
        print(f"[+] 已生成 {args.emit_config}（window.SITE_CONFIG，{csize} 字节）")
        if args.emit_version:
            override = {}
            if filtered:
                try:
                    with open(args.config, encoding='utf-8') as _cf:
                        cfg_tmp = json.load(_cf)
                    cur_base = os.path.basename(args.input)
                    for ds in cfg_tmp.get('datasets', []):
                        jp = ds.get('json')
                        if jp and os.path.basename(jp) == cur_base:
                            override[ds.get('mode')] = len(data)
                except Exception as e:
                    print(f"[!] 构造 override 失败：{e}")
            emit_version(args.config, args.version_file, args.template_version, override_counts=override)


if __name__ == "__main__":
    main()
