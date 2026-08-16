#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
md_to_interview.py — 把"面试真题/题解"类 markdown 转成面试 CSV（再交给 ingest.py → data.json）。
通用：支持辅警 / 消防 / 任何招考的面试 markdown，不写死地名。

支持的 markdown 写法（都兼容）：
  年份：  ## 2018年      或   2018年            （有无 # 都行）
  场次：  ### 1. 2018年1月25日 XX省XX市辅警招考面试题
          ### 2018年1月25日 XX市辅警面试题       （有无 "N. " 序号都行）
  题目：  ## 第一题：题干……        （标题与题号同行，带冒号）
          ## 第一题                 （标题在下一行）
          **第一题**：题干……       /  第一题：题干……
          **题目**：题干……         /  题目：题干……
          （中文数字 / 阿拉伯数字 / "题目" 均可；## 与 ** 可有可无）
  答案：  两种都支持——
          ① 显式标记：**答案：** 后接多段文字（也支持同行 **答案：xxx》）
          ② 无标记：题面之后的正文（到下一题/年份前）即答案
             （如 "**首先…** **其次…**" 段落式参考答案）

输出 CSV 列：年份,场次,题型,标题,答案,标签
  - 题型按标题关键词自动归类（自我认知/应急应变/人际关系/综合分析…），都不中则「结构化面试」
  - 答案原样收集（含换行）；源没有答案时留空，ingest.py 会预留字段

用法：
  python md_to_interview.py 真题.md -o 面试真题.csv
  python md_to_interview.py 真题.md            # 默认输出 面试真题.csv
"""
import re
import sys
import csv
import argparse

# 题号行（标题内联）：## 第一题：题干 / **第一题**：题干
QUESTION_INLINE_RE = re.compile(r'^#*\s*\**\s*第([一二三四五六七八九十百\d]+)题\**\s*[：:]\s*(.+)$')
# 题号行（标题在下一行）：## 第一题 / **第一题** / 第一题
QUESTION_START_RE = re.compile(r'^#*\s*\**\s*第([一二三四五六七八九十百\d]+)题\**\s*[：:]?\s*$')
ALT_INLINE_RE = re.compile(r'^#*\s*\**\s*题目\**\s*[：:]\s*(.+)$')
ALT_START_RE = re.compile(r'^#*\s*\**\s*题目\**\s*[：:]?\s*$')
YEAR_RE = re.compile(r'^#+\s*(\d{4})年\s*$')
YEAR_PLAIN_RE = re.compile(r'^\d{4}年$')
ANS_RE = re.compile(r'^\**\s*答案\s*[：:]\s*(.*)$')
SESSION_RE = re.compile(r'^#+\s*(.+)$')
# 场次触发：含年份 / 招考 / 招录 / 场·套·批（避免把文档大标题误当场次）
SESSION_TRIGGER = re.compile(r'\d{4}年|招考|招录|[场套批]')

# 面试题型归类（命中即归类）
TYPE_DICT = [
    ("自我认知与职位匹配", ["自我认知", "职位匹配", "报考", "为什么", "结合自身", "优势", "不足", "动机", "谈谈自己"]),
    ("应急应变", ["应急", "突发", "遇到", "倒地", "纠纷", "冲突", "紧急", "险情", "意外", "群众受伤"]),
    ("人际关系", ["同事", "领导", "群众", "沟通", "关系", "配合", "矛盾", "协调"]),
    ("组织协调", ["组织", "活动", "会议", "调研", "培训", "安排", "策划", "开展", "布置"]),
    ("综合分析", ["怎么看", "谈谈", "现象", "看法", "观点", "认为", "理解", "意义", "你怎么看"]),
    ("演讲与情景模拟", ["演讲", "情景模拟", "现场模拟"]),
]

# 标题末尾的时长标注，如（2分30秒）（2分半）（2分钟）
TIME_RE = re.compile(r'\s*[（(][^）)]*(?:分|秒|半)[^）)]*[）)]\s*$')


def classify(title):
    for t, kws in TYPE_DICT:
        if any(k in title for k in kws):
            return t
    return "结构化面试"


def clean_title(t):
    t = t.replace('**', '').strip()
    t = TIME_RE.sub('', t)          # 去掉末尾（2分30秒）等时长标注
    return t.strip(' ：:').strip()


def clean_answer(a):
    if not a:
        return ''
    a = a.replace('**', '')
    lines = []
    for ln in a.split('\n'):
        ln = ln.rstrip()
        if ln.startswith('* '):
            ln = '• ' + ln[2:]
        lines.append(ln)
    text = '\n'.join(lines).strip()
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text


def parse(md_path):
    text = open(md_path, encoding='utf-8').read()
    year = ''
    session = ''
    rows = []
    cur = None
    mode = None          # None | 'title'（收标题） | 'answer'（收答案）

    def flush():
        nonlocal cur, mode
        if cur is not None and cur['标题']:
            cur['答案'] = clean_answer(cur['答案'])
            cur['题型'] = classify(cur['标题'])
            rows.append(cur)
        cur = None
        mode = None

    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            if mode == 'answer' and cur is not None:
                cur['答案'] += '\n'
            elif mode == 'title' and cur is not None and cur['标题']:
                mode = 'answer'          # 标题后遇空行 → 切到答案
            continue
        # 年份（切换年份时收上一题）
        if YEAR_RE.match(s) or YEAR_PLAIN_RE.match(s):
            flush()
            year = (YEAR_RE.match(s).group(1) + '年') if YEAR_RE.match(s) else s
            continue
        # 答案显式标记（强化 answer 模式，同行内容并入答案）
        ma = ANS_RE.match(s)
        if ma and cur is not None:
            mode = 'answer'
            inline = ma.group(1).strip()
            cur['答案'] = (cur['答案'] + '\n' + inline) if cur['答案'] else inline
            continue
        # 新题（标题内联）→ 后续行都是答案
        mt = QUESTION_INLINE_RE.match(s) or ALT_INLINE_RE.match(s)
        if mt:
            flush()
            cur = {'年份': year, '场次': session, '题型': '',
                   '标题': clean_title(mt.group(2)), '答案': '', '标签': ''}
            mode = 'answer'
            continue
        # 新题（标题在下一行）→ 先收标题
        ms = QUESTION_START_RE.match(s) or ALT_START_RE.match(s)
        if ms:
            flush()
            cur = {'年份': year, '场次': session, '题型': '',
                   '标题': '', '答案': '', '标签': ''}
            mode = 'title'
            continue
        # 场次标题（含日期/招考等才记）
        mh = SESSION_RE.match(s)
        if mh and not (QUESTION_INLINE_RE.match(s) or ALT_INLINE_RE.match(s)
                       or QUESTION_START_RE.match(s) or ALT_START_RE.match(s)):
            cand = mh.group(1).strip()
            if SESSION_TRIGGER.search(cand):
                flush()
                session = cand
            continue
        # 普通行：按当前模式收集
        if mode == 'title' and cur is not None:
            if not cur['标题']:
                cur['标题'] = s
            else:
                # 标题后紧跟无空行内容 → 视为答案
                mode = 'answer'
                cur['答案'] = (cur['答案'] + '\n' + s) if cur['答案'] else s
            continue
        if mode == 'answer' and cur is not None:
            cur['答案'] = (cur['答案'] + '\n' + s) if cur['答案'] else s
            continue
    flush()
    return rows


def main():
    ap = argparse.ArgumentParser(description="面试真题/题解 markdown → 面试 CSV（通用）")
    ap.add_argument("input", help="源 markdown 文件")
    ap.add_argument("-o", "--out", default="面试真题.csv", help="输出 CSV，默认 面试真题.csv")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"[!] 文件不存在: {args.input}")

    rows = parse(args.input)
    if not rows:
        raise SystemExit("[!] 未解析到任何题目，请检查 markdown 格式。")
    with open(args.out, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['年份', '场次', '题型', '标题', '答案', '标签'])
        w.writeheader()
        w.writerows(rows)
    print(f"[+] 已写入 {args.out}：共 {len(rows)} 题（含答案 {sum(1 for r in rows if r['答案'])} 题）")


if __name__ == "__main__":
    main()
