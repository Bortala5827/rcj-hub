#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ingest.py — 把上传的题库源文件（CSV / XLSX / JSON / TXT）规范化为可编辑的 data.json。

设计目标：
    用户后期新增/修改题目，只需维护 data.json（人读、好改），再跑 build_data.py
    生成离线运行时 data.js。避免每次手工改内联大数组。

支持的输入：
    .csv   原生支持（utf-8-sig 自动识别，逗号/制表符分隔）
    .xlsx  需要 openpyxl：pip install openpyxl；否则提示另存为 CSV
    .json  已是题库 schema，直接规整（补 num/_idx）
    .txt   行式：每行一题，字段用分隔符（默认 制表符 或 || 或 #）

列名（中英文别名均可，自动匹配）：
    题号/序号 | 批次/分类/章节 | 题型 | 题干/题目 | 选项A..F | 答案 | 解析 | 标签/知识点

题型归一：单选→single 多选→multiple 判断→judge 填空→blank 简答→qa
答案归一：  "A,C" / "A、C" / "AC" → ["A","C"]；单值保持字符串

用法：
    python ingest.py 题目.csv -o data.json
    python ingest.py 题目.xlsx -o data.json --sheet 0
    python ingest.py 题目.json -o data.json
"""
import csv
import json
import sys
import re
import os
import argparse

COLUMN_ALIASES = {
    'num':       ['num', '题号', '序号', '编号', 'no'],
    'batch':     ['batch', '批次', '分类', '章节', '模块', '类别'],
    'type':      ['type', '题型', '题目类型'],
    'stem':      ['stem', '题干', '题目', '问题', '题目内容'],
    'answer':    ['answer', '答案', '正确答案', '正确选项'],
    'explanation': ['explanation', '解析', '答案解析', '答案详解', '详解'],
    'tags':      ['tags', '标签', '知识点', '考点'],
    'title':     ['title', '标题'],
    'year':      ['year', '年份', '年度'],
    'session':   ['session', '场次', '期次', '日期', 'date'],
    'opt_a':     ['a', '选项a', '选项A', 'a选项', '答案a'],
    'opt_b':     ['b', '选项b', '选项B', 'b选项', '答案b'],
    'opt_c':     ['c', '选项c', '选项C', 'c选项', '答案c'],
    'opt_d':     ['d', '选项d', '选项D', 'd选项', '答案d'],
    'opt_e':     ['e', '选项e', '选项E', 'e选项', '答案e'],
    'opt_f':     ['f', '选项f', '选项F', 'f选项', '答案f'],
}
OPT_KEYS = ['opt_a', 'opt_b', 'opt_c', 'opt_d', 'opt_e', 'opt_f']
OPT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

TYPE_MAP = {
    '单选': 'single', '单': 'single', 'single': 'single', '单选题': 'single', '单项选择题': 'single',
    '多选': 'multiple', '多': 'multiple', 'multiple': 'multiple', '多选题': 'multiple', '多项选择题': 'multiple',
    '判断': 'judge', '判': 'judge', 'judge': 'judge', '判断题': 'judge', '对错': 'judge',
    '填空': 'blank', '填': 'blank', 'blank': 'blank', '填空题': 'blank',
    '简答': 'qa', '问答': 'qa', 'qa': 'qa', '简答题': 'qa', '解答': 'qa',
}

DELIMS = ['||', '#', '\t', '|', '；', ';']


def norm_header(h):
    return re.sub(r'[\s\u3000]', '', str(h)).lower().strip()


def build_alias_lookup(headers):
    """返回 {field: column_index}，field 见 COLUMN_ALIASES。"""
    normed = [norm_header(h) for h in headers]
    lookup = {}
    for field, aliases in COLUMN_ALIASES.items():
        for i, nh in enumerate(normed):
            if nh in aliases:
                lookup[field] = i
                break
    return lookup


def normalize_type(raw):
    if not raw:
        return 'single'
    key = norm_header(raw)
    return TYPE_MAP.get(key, key)  # 未知题型（如面试分类）原样保留，不强行归为 single


def normalize_answer(raw, qtype):
    if raw is None:
        return ''
    s = str(raw).strip()
    if qtype == 'judge':
        return s  # 保持 对/错/正确/错误
    if qtype not in ('single', 'multiple'):
        return s  # 简答/填空/面试开放题：答案原样保留为字符串（避免按逗号误拆）
    # 拆多值（仅单选/多选）
    parts = re.split(r'[,，、/\\]+', s)
    letters = [p.strip().upper() for p in parts if p.strip()]
    letters = [re.sub(r'[^A-F]', '', l) for l in letters]
    letters = [l for l in letters if l]
    if not letters:
        return s
    if len(letters) == 1:
        return letters[0]
    # 去重保序
    seen = []
    for l in letters:
        if l not in seen:
            seen.append(l)
    return seen


def row_to_question(row, lookup):
    def get(field):
        i = lookup.get(field)
        if i is None:
            return ''
        v = row[i] if i < len(row) else ''
        return (v or '').strip()

    q = {}
    num = get('num')
    if num and num.isdigit():
        q['num'] = int(num)
    else:
        # 面试等无固定题号：保留年份/场次（若有）
        y = get('year')
        if y:
            q['year'] = y
        s = get('session')
        if s:
            q['session'] = s
    batch = get('batch')
    if batch:
        q['batch'] = batch
    q['type'] = normalize_type(get('type'))
    # 题干（笔试 stem）/ 标题（面试 title），二者取其一
    stem = get('stem')
    title = get('title')
    qtext = stem or title
    if not qtext:
        return None  # 跳过空题干
    if stem:
        q['stem'] = stem
    if title:
        q['title'] = title
    # 选项
    options = []
    for k, letter in zip(OPT_KEYS, OPT_LETTERS):
        txt = get(k)
        if txt:
            options.append({'letter': letter, 'text': txt})
    if options:
        q['options'] = options
    ans = normalize_answer(get('answer'), q['type'])
    q['answer'] = ans  # 始终预留 answer 字段（空字符串 = 待填），避免下游缺字段
    expl = get('explanation')
    if expl:
        q['explanation'] = expl
    tags = get('tags')
    if tags:
        q['tags'] = tags
    return q


def read_csv(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        sample = f.read(4096)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',\t;')
        except Exception:
            dialect = csv.excel
        reader = csv.reader(f, dialect)
        rows = [r for r in reader if any(c.strip() for c in r)]
    headers = rows[0]
    lookup = build_alias_lookup(headers)
    out = []
    for r in rows[1:]:
        q = row_to_question(r, lookup)
        if q:
            out.append(q)
    return out


def read_xlsx(path, sheet=0):
    try:
        import openpyxl
    except ImportError:
        raise SystemExit("[!] 读取 .xlsx 需要 openpyxl。请先 `pip install openpyxl`，"
                          "或把 Excel 另存为 CSV 后重试。")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[sheet]
    rows = [[(c.value if c.value is not None else '') for c in row] for row in ws.iter_rows()]
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    if not rows:
        return []
    headers = rows[0]
    lookup = build_alias_lookup(headers)
    out = []
    for r in rows[1:]:
        q = row_to_question(r, lookup)
        if q:
            out.append(q)
    return out


def read_json(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get('questions', data.get('data', []))
    return data


def read_txt(path):
    """行式：每行一题；字段按分隔符拆分；首行若像表头则跳过。"""
    with open(path, encoding='utf-8') as f:
        lines = [ln.rstrip('\n') for ln in f if ln.strip()]
    # 选分隔符：看第一行用哪个
    delim = None
    for d in DELIMS:
        if d in lines[0]:
            delim = d
            break
    if delim is None:
        raise SystemExit("[!] TXT 未识别到字段分隔符（可用 || 或 # 或 制表符 分隔各字段）")
    rows = [ln.split(delim) for ln in lines]
    # 若首行像表头（含'题干'等关键词）则跳过
    if any(k in norm_header(rows[0][0]) for k in ['题干', '题目', 'stem']):
        rows = rows[1:]
    lookup = build_alias_lookup(['题干', '题型', '选项A', '选项B', '选项C', '选项D', '答案', '解析', '标签', '批次', '题号'])
    # 为行式定义固定列顺序：题干|题型|A|B|C|D|答案|解析|标签|批次|题号
    fixed = ['stem', 'type', 'opt_a', 'opt_b', 'opt_c', 'opt_d', 'answer', 'explanation', 'tags', 'batch', 'num']
    out = []
    for r in rows:
        if len(r) < 2:
            continue
        q = row_to_question(r, {f: i for i, f in enumerate(fixed)})
        if q:
            out.append(q)
    return out


def finalize(data):
    # 面试等含 title/year/session 的数据视为"无统一题号"，不强行补 num
    is_interview = any('title' in q or 'year' in q or 'session' in q for q in data)
    for i, q in enumerate(data):
        if not is_interview and ('num' not in q or not isinstance(q.get('num'), int)):
            q['num'] = i + 1
        q['_idx'] = i
    return data


def main():
    ap = argparse.ArgumentParser(description="题库源文件 → data.json")
    ap.add_argument("input", help="源文件 .csv/.xlsx/.json/.txt")
    ap.add_argument("-o", "--out", default="data.json", help="输出 JSON 文件名，默认 data.json")
    ap.add_argument("--sheet", type=int, default=0, help="xlsx 工作表索引，默认 0")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"[!] 文件不存在: {args.input}")

    ext = os.path.splitext(args.input)[1].lower()
    if ext == '.csv':
        data = read_csv(args.input)
    elif ext in ('.xlsx', '.xls'):
        data = read_xlsx(args.input, args.sheet)
    elif ext == '.json':
        data = read_json(args.input)
    elif ext == '.txt':
        data = read_txt(args.input)
    else:
        raise SystemExit(f"[!] 不支持的扩展名: {ext}（支持 csv/xlsx/json/txt）")

    data = finalize(data)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[+] 已写入 {args.out}：共 {len(data)} 题")
    print(f"[+] 题型分布：", end='')
    from collections import Counter
    c = Counter(q.get('type', '?') for q in data)
    print(dict(c))


if __name__ == "__main__":
    main()
