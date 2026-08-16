#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
anki_export.py — 把 data.json（ingest.py 产物）导出为 Anki 复习卡片。

两种输出：
  - CSV（默认，零依赖）：anki_cards.csv，列 正面,反面,标签。
    Anki 导入时「字段分隔符」选「逗号」即可。
  - APKG（可选，需 genanki）：anki_cards.apkg，双击直接装进 Anki，自动建子牌组。

标签与分组（子牌组）：
  - CSV 里用「嵌套标签」实现分组：--group-by year,type 会把标签写成
    "2024::综合分析" 这种层级，在 Anki 里表现为可展开筛选的嵌套标签（等同分组）。
  - APKG 里用 --subdeck-by year 可生成「真·子牌组」：主牌组::2024::综合分析，
    在 Anki 左侧牌组树里就是真正的子牌组。

卡片内容：
  笔试（选择题，含 stem/options）：正面 = 题干 + 选项(A.… B.…)；反面 = 答案 + 解析
  面试（开放题，含 title）：       正面 = 标题(题干)；反面 = 参考答案
标签自动带上 题型/批次/年份/场次，便于在 Anki 里筛选。

用法：
  python anki_export.py data.json                         # 只出 CSV（标签=题型/批次/年份/场次）
  python anki_export.py data.json --group-by year,type    # CSV 嵌套标签分组
  python anki_export.py data.json --apkg                  # 顺带出 apkg（自动装 genanki）
  python anki_export.py data.json --apkg --subdeck-by year,type   # apkg 真子牌组
  python anki_export.py data.json -o mycards.csv --deck "深圳辅警面试"
"""
import json
import csv
import sys
import os
import re
import argparse


def strip_md(s):
    """去掉 markdown 加粗/斜体等轻量标记。"""
    return re.sub(r'\*{1,3}', '', str(s)).strip()


def fmt_answer(ans):
    if ans is None:
        return ''
    if isinstance(ans, list):
        return ','.join(str(a) for a in ans)
    return str(ans).strip()


def build_cards(data, group_by=None, subdeck_by=None):
    group_keys = [g.strip() for g in (group_by or '').split(',') if g.strip()]
    sub_keys = [s.strip() for s in (subdeck_by or '').split(',') if s.strip()] or group_keys[:1]
    cards = []
    for q in data:
        tags = []
        group_path = []
        for k in group_keys:
            v = q.get(k)
            if v:
                group_path.append(strip_md(v))
        if group_path:
            tags.append('::'.join(group_path))          # 嵌套标签（分组）
        default_keys = ['batch', 'type', 'year', 'session', 'tags']
        for key in default_keys:
            if key in group_keys:
                continue
            v = q.get(key)
            if not v:
                continue
            if key == 'tags':
                # tags 可能是 "a b c" 字符串或 ["a","b"] 列表，需拆成独立无空格标签
                if isinstance(v, list):
                    tags.extend(strip_md(t) for t in v if t)
                else:
                    tags.extend(x for x in re.split(r'[\s,，、]+', strip_md(v)) if x)
            else:
                tags.append(strip_md(v))

        subgroup = ''
        for k in sub_keys:
            v = q.get(k)
            if v:
                subgroup = strip_md(v)
                break

        if 'stem' in q or 'options' in q:                # 笔试
            front = strip_md(q.get('stem', ''))
            opts = q.get('options', [])
            if opts:
                front += '<br>' + '<br>'.join(
                    f"{o.get('letter', '')}. {strip_md(o.get('text', ''))}" for o in opts)
            ans = fmt_answer(q.get('answer', ''))
            back = f"答案：{ans}" if ans else "（待填答案）"
            if q.get('explanation'):
                back += '<br>' + strip_md(q['explanation'])
        else:                                           # 面试
            front = strip_md(q.get('title', q.get('stem', '')))
            ans = fmt_answer(q.get('answer', ''))
            back = strip_md(ans) if ans else '（待填答案）'

        # 标签去重
        seen = set()
        tags = [t for t in tags if t and not (t in seen or seen.add(t))]
        cards.append({'front': front, 'back': back, 'tags': tags, 'subgroup': subgroup})
    return cards


def write_csv(cards, path):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(['正面', '反面', '标签'])
        for c in cards:
            w.writerow([c['front'], c['back'], ' '.join(c['tags'])])
    return len(cards)


def write_apkg(cards, path, deck_name, subdeck_by=None):
    try:
        import genanki
    except ImportError:
        print('[!] 生成 apkg 需要 genanki，正在尝试安装…')
        import subprocess
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'genanki', '-q'])
        except subprocess.CalledProcessError:
            raise SystemExit("[!] 自动安装 genanki 失败。请手动执行：pip install genanki")
        except Exception as e:
            raise SystemExit(f"[!] 自动安装 genanki 失败：{e}\n请手动执行：pip install genanki")
        import genanki
    model = genanki.Model(
        1607392319,
        'BasicZh',
        fields=[{'name': '正面'}, {'name': '反面'}],
        templates=[{'name': '卡片',
                    'qfmt': '{{正面}}',
                    'afmt': '{{正面}}<hr id=answer>{{反面}}'}],
    )
    decks = {}
    used_ids = set()

    def get_deck(name):
        if name in decks:
            return decks[name]
        did = (abs(hash(name)) % (2 ** 31)) or 1
        while did in used_ids:
            did = (did + 1) % (2 ** 31)
        used_ids.add(did)
        d = genanki.Deck(did, name)
        decks[name] = d
        return d

    for c in cards:
        dk = deck_name
        if c['subgroup']:
            dk = deck_name + '::' + c['subgroup']
        get_deck(dk).add_note(genanki.Note(
            model=model, fields=[c['front'], c['back']],
            tags=c['tags']))
    genanki.Package(list(decks.values())).write_to_file(path)
    return len(cards), len(decks)


def main():
    ap = argparse.ArgumentParser(description='data.json → Anki 卡片（CSV / apkg，支持标签分组与子牌组）')
    ap.add_argument('input', help='data.json（ingest.py 产物）')
    ap.add_argument('-o', '--out', default='anki_cards.csv', help='CSV 输出名，默认 anki_cards.csv')
    ap.add_argument('--apkg', action='store_true', help='同时生成 .apkg 牌组包')
    ap.add_argument('--deck', default='题库卡片', help='apkg 主牌组名称')
    ap.add_argument('--group-by', default=None,
                    help='CSV 嵌套标签分组字段，逗号分隔，如 year,type（写进 标签 列，Anki 中表现为分组）')
    ap.add_argument('--subdeck-by', default=None,
                    help='apkg 真·子牌组字段，逗号分隔，如 year,type（生成 主牌组::year::type）')
    args = ap.parse_args()

    if not os.path.exists(args.input):
        raise SystemExit(f"[!] 文件不存在: {args.input}")

    with open(args.input, encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get('questions', data.get('data', []))

    cards = build_cards(data, group_by=args.group_by, subdeck_by=args.subdeck_by)
    n = write_csv(cards, args.out)
    print(f"[+] 已写 {args.out}：{n} 张卡片（CSV，Anki 导入选「逗号」分隔）")
    if args.group_by:
        print(f"    CSV 标签已按 --group-by={args.group_by} 生成嵌套分组标签")

    if args.apkg:
        apkg = os.path.splitext(args.out)[0] + '.apkg'
        m, decks = write_apkg(cards, apkg, args.deck, args.subdeck_by)
        print(f"[+] 已写 {apkg}：{m} 张卡片 / {decks} 个牌组（双击导入 Anki）")
        if args.subdeck_by:
            print(f"    已按 --subdeck-by={args.subdeck_by} 生成子牌组：{args.deck}::<分组>")


if __name__ == '__main__':
    main()
