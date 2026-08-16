#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_data.py — 将单文件 HTML 中内联的大数组外置为独立、可长缓存的 JS 文件。

解决的问题：
    单文件静态站把题库/文章/配置直接 `var DATA = [...]` 内联在 <script> 里，
    导致 HTML 体积过大（几百 KB～数 MB），浏览器必须下载完整个 HTML 才能执行脚本，
    即便 DOM 已懒加载也无济于事。把数据拆出来后 HTML 外壳秒开，数据单独 immutable 缓存。

做了什么：
    1. 在 HTML 中定位 `var|let|const|window. <VAR> = [ ... ]`（平衡括号扫描，
       正确处理字符串内的括号/引号/转义，以及数组内嵌套对象 {...}）。
    2. 写出 <OUT>：  window.<VAR> = [ ...原数组... ];
    3. 在 HTML 中把该段内联声明替换为【安全单行注释】，注释里绝不含 </script>。
    4. 在【包含该数据的 <script> 之前】插入 <script src="<OUT>"></script>，
       保证数据先于应用脚本加载，window.<VAR> 已就绪。
    5. 在 <head> 的 viewport meta 之后插入 <link rel="preload" as="script" href="<OUT>">，
       让大文件随 HTML 解析并行开始下载。

用法：
    python extract_data.py SITE.html --var DATA --out data.js [--validate]

参数：
    SITE.html   必填，待处理的 HTML 文件（就地改写）。
    --var       数据变量名，默认 DATA。
    --out       输出的 JS 文件名，默认 data.js（相对路径，与 HTML 同目录）。
    --validate  处理完后调用 node --check 校验数据文件，并核对 <script> 标签配对。

注意：
    - 幂等：若已存在 <script src="<OUT>"> 或 preload，则跳过插入。
    - 不会改动应用逻辑本身，只移动数据；务必配合校验清单（见 SKILL.md）。
"""
import re
import sys
import subprocess
import os
import shutil

# node 路径：优先用 PATH 上的 node（仅用于校验内联脚本语法，可选能力）
NODE = shutil.which("node")


def find_array_end(text, start):
    """从 '[' (index=start) 起扫描，返回匹配的右括号索引。正确处理字符串/转义。"""
    depth = 0
    i = start
    n = len(text)
    in_str = None  # None | '"' | "'" | '`'
    esc = False
    while i < n:
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == in_str:
                in_str = None
        else:
            if c in ('"', "'", '`'):
                in_str = c
            elif c in ('[', '{'):
                depth += 1
            elif c in (']', '}'):
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError("未找到匹配的数组结束括号，请检查数据格式")


def find_containing_script(html, pos):
    """返回包含 pos 的那个 <script>（无 src）开标签的索引；找不到返回 -1。"""
    opens = [m.start() for m in re.finditer(r'<script\b', html)]
    closes = [m.start() for m in re.finditer(r'</script>', html)]
    for oi, o in enumerate(opens):
        # 该 open 对应的 close：找在 o 之后、且属于它的 </script>
        c = None
        for cl in closes:
            if cl > o:
                c = cl
                break
        if c is None:
            continue
        # open 标签结束位置（> 之后）
        open_end = html.index('>', o) + 1
        if open_end <= pos <= c:
            # 必须是无 src 的内联脚本
            tag = html[o:open_end]
            if 'src=' in tag:
                continue
            return o
    return -1


def transform(html_path, var, out, do_validate):
    html = open(html_path, encoding='utf-8').read()

    # 1) 定位声明
    pat = re.compile(r'(?:var|let|const|window\.)?\s*' + re.escape(var) + r'\s*=\s*\[')
    m = pat.search(html)
    if not m:
        raise SystemExit(f"[!] 未在 {html_path} 中找到 `{var} = [` 形式的声明")
    decl_start = m.start()
    bracket_start = m.end() - 1  # '[' 位置
    bracket_end = find_array_end(html, bracket_start)
    array_text = html[bracket_start:bracket_end + 1]

    # 声明结束：数组之后可能跟一个 ';'
    stmt_end = bracket_end + 1
    rest = html[stmt_end:]
    sm = re.match(r'\s*;', rest)
    if sm:
        stmt_end += sm.end()

    # 2) 写出数据 JS
    js_content = f"window.{var} = {array_text};\n"
    with open(out, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"[+] 写出数据文件: {out}  ({len(array_text)} 字节, 共 {array_text.count(chr(10))+1} 行)")

    # 3) 替换内联声明为安全注释
    safe_comment = f"// 数据已外置到 {out}（独立 JS 文件，可长期缓存，离线可用）\n"
    html = html[:decl_start] + safe_comment + html[stmt_end:]
    print(f"[+] 已将内联 `{var}` 数组替换为安全注释")

    # 4) 在包含该数据的 <script> 之前插入外部脚本标签（幂等）
    if f'<script src="{out}">' not in html:
        # decl_start 现在指向注释；找到原包含脚本的开标签（注释替换不影响标签位置，
        # 因注释在脚本内部）。用注释位置反查包含脚本。
        cont = find_containing_script(html, decl_start)
        if cont == -1:
            # 退路：插到第一个内联 <script> 前
            cont = next((mo.start() for mo in re.finditer(r'<script\b', html) if 'src=' not in html[mo.start():mo.start()+40]), -1)
        if cont == -1:
            raise SystemExit("[!] 找不到可插入的外部 <script> 位置")
        html = html[:cont] + f'<script src="{out}"></script>\n' + html[cont:]
        print(f"[+] 已插入 <script src=\"{out}\"> 于主脚本之前")
    else:
        print(f"[~] 已存在 <script src=\"{out}\">，跳过插入")

    # 5) 在 <head> 的 viewport meta 后插入 preload（幂等）
    preload = f'<link rel="preload" as="script" href="{out}">'
    if preload not in html:
        vm = re.search(r'<meta name="viewport"[^>]*>', html)
        if vm:
            ins = vm.end()
            html = html[:ins] + '\n  ' + preload + html[ins:]
            print(f"[+] 已插入 <link rel=\"preload\" ... href=\"{out}\">")
        else:
            # 退路：插到 </head> 前
            h = html.rfind('</head>')
            if h != -1:
                html = html[:h] + '  ' + preload + '\n' + html[h:]
                print(f"[+] 已插入 preload（位于 </head> 前）")
            else:
                print("[!] 未找到 <head>/viewport，请手动添加 preload")
    else:
        print(f"[~] 已存在 preload，跳过")

    # 回写
    open(html_path, 'w', encoding='utf-8').write(html)
    print(f"[+] 已更新 {html_path}")

    # 6) 可选校验
    if do_validate:
        validate(out, html_path)


def validate(out, html_path):
    print("\n--- 校验 ---")
    # node --check 数据文件
    if NODE and os.path.exists(NODE):
        r = subprocess.run([NODE, '--check', out], capture_output=True, text=True)
        print(f"node --check {out}: {'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr}")
        # 条数
        r2 = subprocess.run([NODE, '-e', 'global.window={};require(process.argv[1]);console.log("数据条数:", window.DATA.length)',
                             out], capture_output=True, text=True)
    else:
        print(f"[!] 未找到 node，跳过语法校验: {NODE}")

    # script 标签配对
    html = open(html_path, encoding='utf-8').read()
    opens = len(re.findall(r'<script\b', html))
    closes = html.count('</script>')
    print(f"<script> 开标签: {opens}  闭标签: {closes}  {'OK' if opens == closes else '不匹配!'}")
    # 内联脚本内部不得再出现 </script>
    bad = 0
    for blk in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S):
        if '</script>' in blk.group(1):
            bad += 1
    print(f"内联脚本内部含 </script> 的数量: {bad}  {'OK' if bad == 0 else '存在危险注释!'}")
    # 确认无残留内联声明
    if re.search(r'(?:var|let|const)\s+DATA\s*=\s*\[', html):
        print("[!] HTML 中仍残留内联 DATA 声明")
    else:
        print("HTML 内联 DATA 声明: 已清除")


def main():
    import argparse
    ap = argparse.ArgumentParser(description="将单文件 HTML 的内联数据数组外置为独立 JS")
    ap.add_argument("html", help="待处理的 HTML 文件（就地改写）")
    ap.add_argument("--var", default="DATA", help="数据变量名，默认 DATA")
    ap.add_argument("--out", default="data.js", help="输出 JS 文件名，默认 data.js")
    ap.add_argument("--validate", action="store_true", help="处理后调用 node 校验")
    args = ap.parse_args()
    if not os.path.exists(args.html):
        raise SystemExit(f"[!] 文件不存在: {args.html}")
    transform(args.html, args.var, args.out, args.validate)


if __name__ == "__main__":
    main()
