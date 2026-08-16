#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把已有「深圳辅警面试」类 apkg（Front/Back 富 HTML 两字段）转换为
面试录音卡模型（7 字段 + 录音[Feynman插件] + 提示词折叠 + 合并原分析 CSS）。

【稳健原则】直接修改源包里「能正常打开」的 collection.anki2：
  保留源库的全部表 / 索引 / ver / scm，只改 models JSON 与 notes 内容。
  不重建库，避免缺表/缺索引导致 Anki 导入报 500。

用法:
  python transform_existing_deck.py 输入.apkg -o 输出.apkg
  python transform_existing_deck.py 输入.apkg            # 默认输出 <输入>_语音答题.apkg

映射规则:
  题目      <- Front: .card-question
  题型分类  <- Back:  back-footer 的 "类型::xxx"  (兜底 Front: 【年份 · 类型】)
  答题框架  <- Back:  "结构化思路（答题框架）" 块内 3 行  (作为「提示词」，默认折叠)
  参考答案  <- Back:  重建 考察能力+出题逻辑+高频表达+深圳元素+易踩坑+参考答案段落
  得分关键词<- Back:  .hf-tag + .sz-kw 文本
  录音      <- 空 (运行时由 Feynman Audio 插件写入 [sound:xxx])
  编号      <- 自动 1..N
"""

import sqlite3, zipfile, os, json, time, argparse, re, html, tempfile, shutil, uuid, hashlib, sys, copy

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SKILL_ROOT)
from templates.interview_template import (
    INTERVIEW_FIELDS, INTERVIEW_TEMPLATES, INTERVIEW_REQ, INTERVIEW_CSS,
)


def html_to_text(s):
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n\s*\n+', '\n', s)
    return s.strip()


def clean_orig_css(css):
    """剔除会污染新卡片布局的全局选择器，仅保留模块样式。"""
    css = re.sub(r'\.card\s*\{[^}]*\}', '', css)
    css = re.sub(r'\.card-front\s*\{[^}]*\}', '', css)
    css = re.sub(r'\.card-back\s*\{[^}]*\}', '', css)
    css = re.sub(r'\.card-front\s*,', '', css)
    return css


def parse_note(front, back):
    """返回 7 字段字典。"""
    # 题目
    qm = re.search(r'class="card-question">(.*?)</div>', front, re.DOTALL)
    question = html_to_text(qm.group(1)) if qm else ''

    # 题型分类
    tm = re.search(r'类型::([^\s<\n]+)', back)
    if not tm:
        tm = re.search(r'【[^·]*·\s*([^】]+)】', front)
    type_ = tm.group(1).strip() if tm else ''

    # 答题框架（提示词）
    fm = re.search(r'结构化思路（答题框架）</div>\s*<div[^>]*>(.*?)</div>\s*</div>', back, re.DOTALL)
    if fm:
        fw = fm.group(1).replace('<br>', '\n').replace('<br/>', '\n')
        fw = re.sub(r'<[^>]+>', '', fw)
        fw = html.unescape(fw).strip()
    else:
        fw = ''

    # 各分析模块
    def mod_text(cls):
        m = re.search(r'class="module %s">.*?<div class="module-content">([\s\S]*?)</div>\s*</div>' % cls, back, re.DOTALL)
        return html_to_text(m.group(1)) if m else ''

    def mod_html(cls, inner_cls):
        m = re.search(r'class="module %s">.*?<div class="module-content %s">([\s\S]*?)</div>\s*</div>' % (cls, inner_cls), back, re.DOTALL)
        return m.group(1).strip() if m else ''

    ability = mod_text('module-ability')
    logic = mod_text('module-logic')
    hf_html = mod_html('module-expression', 'hf-list')
    sz_html = mod_html('module-sz', 'sz-list')
    pitfall_html = mod_html('module-pitfall', 'pitfall-list')

    am = re.search(r'class="module module-answer">.*?<div class="module-content answer-text">([\s\S]*?)</div>\s*</div>', back, re.DOTALL)
    answer_html = am.group(1).strip() if am else ''

    # 重建参考答案（富文本，保留原模块类名 -> 合并 CSS 渲染）
    parts = []
    if ability:
        parts.append('<div class="module module-ability"><div class="module-title">🎯 考察能力</div>'
                     '<div class="module-content">' + html.escape(ability) + '</div></div>')
    if logic:
        parts.append('<div class="module module-logic"><div class="module-title">🧠 出题逻辑</div>'
                     '<div class="module-content">' + html.escape(logic) + '</div></div>')
    if hf_html:
        parts.append('<div class="module module-expression"><div class="module-title">💬 高频表达</div>'
                     '<div class="module-content hf-list">' + hf_html + '</div></div>')
    if sz_html:
        parts.append('<div class="module module-sz"><div class="module-title">🏙 深圳元素</div>'
                     '<div class="module-content sz-list">' + sz_html + '</div></div>')
    if pitfall_html:
        parts.append('<div class="module module-pitfall"><div class="module-title">⚠ 易踩坑</div>'
                     '<div class="module-content pitfall-list">' + pitfall_html + '</div></div>')
    if answer_html:
        parts.append('<div class="module module-answer"><div class="module-title">📝 参考答案</div>'
                     '<div class="module-content answer-text">' + answer_html + '</div></div>')
    ref_answer = '\n'.join(parts)

    # 得分关键词（预处理成 chips HTML，零 JS 模板直接渲染）
    hf_tags = re.findall(r'class="hf-tag">([^<]*)</span>', back)
    sz_kws = re.findall(r'class="sz-kw">([^<]*)</span>', back)
    seen = set()
    kws = []
    for k in hf_tags + sz_kws:
        k = k.strip()
        if k and k not in seen:
            seen.add(k)
            kws.append(k)
    kw_chips = ''.join('<span class="kw-chip">%s</span>' % html.escape(k) for k in kws) if kws else ''

    return {
        "题目": question,
        "题型分类": type_,
        "答题框架": fw,
        "参考答案": ref_answer,
        "得分关键词": kw_chips,
        "录音": "",
        "编号": "",  # 由调用方填充序号
    }


def field_checksum(s):
    """Anki 字段校验和算法。"""
    return int(hashlib.sha1(s.encode("utf-8")).hexdigest()[:8], 16)


def build_new_model(existing_model, model_name, merged_css):
    """在同一个 model id 下，替换字段/模板/CSS/req，保留其它属性与结构。

    关键修复：field / tmpl 的每个元素**克隆源库对应元素（平铺旧格式，
    含 ord/media/sticky）的完整结构**，只替换 name/ord/size/qfmt/afmt 等内容，
    避免手写字段漏掉 sticky/ord/media 导致新版 Anki 导入报
    'missing field sticky' 的 500 错误。
    """
    mid = existing_model.get("id")
    now_ms = int(time.time() * 1000)

    ex_flds = existing_model.get("flds", [])
    ex_f0 = ex_flds[0] if ex_flds else None
    ex_tmpls = existing_model.get("tmpls", [])
    ex_t0 = ex_tmpls[0] if ex_tmpls else None

    # ---- 字段：克隆源库 field 结构（含 ord/media/sticky 平铺），换 name/size/ord ----
    new_flds = []
    for i, fd in enumerate(INTERVIEW_FIELDS):
        if ex_f0:
            f = copy.deepcopy(ex_f0)
        else:
            f = {"name": "", "ord": 0, "font": "Arial", "media": [], "rtl": False, "size": 20, "sticky": False}
        f["name"] = fd["name"]
        f["ord"] = i
        f["font"] = fd.get("font", "Arial")
        f["size"] = fd.get("size", 20)
        f["rtl"] = fd.get("rtl", False)
        f.setdefault("sticky", False)
        f.setdefault("media", [])
        new_flds.append(f)

    # ---- 模板：克隆源库 tmpl 结构，换 qfmt/afmt ----
    new_tmpls = []
    for t in INTERVIEW_TEMPLATES:
        if ex_t0:
            base = copy.deepcopy(ex_t0)
        else:
            base = {"name": "", "ord": 0, "qfmt": "", "afmt": "", "bafmt": "", "bqfmt": "", "bfont": "", "bsize": 0, "did": None}
        base["name"] = t["name"]
        base["ord"] = t["ord"]
        base["qfmt"] = t["qfmt"]
        base["afmt"] = t["afmt"]
        base["bqfmt"] = t.get("bqfmt", "")
        base["bafmt"] = t.get("bafmt", "")
        base["bfont"] = t.get("bfont", "")
        base["bsize"] = t.get("bsize", 0)
        new_tmpls.append(base)

    new_model = dict(existing_model)  # 保留所有原 key（css/did/latex*/vers/tags/type/sortf...）
    new_model["name"] = model_name
    new_model["flds"] = new_flds
    new_model["tmpls"] = new_tmpls
    new_model["css"] = merged_css.lstrip()
    new_model["req"] = INTERVIEW_REQ
    new_model["mod"] = now_ms
    new_model["usn"] = -1
    new_model["type"] = 0
    new_model["sortf"] = 0
    return mid, new_model


def main():
    ap = argparse.ArgumentParser(description="将现有面试 apkg 转换为语音答题卡模型（原地改源库）")
    ap.add_argument("input", help="输入 apkg（Front/Back 两字段）")
    ap.add_argument("-o", "--output", default=None)
    ap.add_argument("--model-name", default="RCJ辅警-面试录音卡")
    ap.add_argument("--deck-suffix", default="（录音版）")
    args = ap.parse_args()

    out = args.output or (os.path.splitext(args.input)[0] + "_语音答题.apkg")

    tmp = tempfile.mkdtemp(prefix="iv_inplace_")
    try:
        with zipfile.ZipFile(args.input) as z:
            z.extractall(tmp)
            media_bytes = z.read("media") if "media" in z.namelist() else b"{}"

        db_path = os.path.join(tmp, "collection.anki2")
        con = sqlite3.connect(db_path)
        cur = con.cursor()

        # --- 读取原模型 / 牌组 ---
        src_models = json.loads(cur.execute("SELECT models FROM col").fetchone()[0])
        src_model_id, src_model = next(iter(src_models.items()))
        src_model = src_model  # dict
        src_css = src_model.get("css", "")

        src_decks = json.loads(cur.execute("SELECT decks FROM col").fetchone()[0])
        _deck_names = [v.get("name", "") for v in src_decks.values()]
        src_deck_name = next((n for n in _deck_names if n and n != "Default"),
                              _deck_names[0] if _deck_names else "深圳辅警面试")

        merged_css = INTERVIEW_CSS + "\n" + clean_orig_css(src_css)
        deck_name = src_deck_name + args.deck_suffix

        # --- 改写模型 ---
        mid, new_model = build_new_model(src_model, args.model_name, merged_css)
        new_models = {str(mid): new_model}
        cur.execute("UPDATE col SET models=? WHERE id=1",
                    (json.dumps(new_models, ensure_ascii=False),))

        # --- 改写牌组名（保持 deck id 不变，只改显示名）---
        decks = json.loads(cur.execute("SELECT decks FROM col").fetchone()[0])
        for k in decks:
            if decks[k].get("name") == src_deck_name:
                decks[k]["name"] = deck_name
        cur.execute("UPDATE col SET decks=? WHERE id=1",
                    (json.dumps(decks, ensure_ascii=False),))

        # --- 改写每张 note ---
        rows = cur.execute("SELECT id, flds, tags, guid FROM notes").fetchall()
        ok = 0
        for nid, flds, tags, guid in rows:
            parts = flds.split("\x1f")
            if len(parts) < 2:
                continue
            front, back = parts[0], parts[1]
            d = parse_note(front, back)
            d["编号"] = str(ok + 1)
            new_flds = [d.get(fd["name"], "") for fd in INTERVIEW_FIELDS]
            flds_str = "\x1f".join(new_flds)
            sfld = new_flds[0]  # 排序字段 = 题目文本
            csum = field_checksum(sfld)
            now_ms = int(time.time() * 1000)
            cur.execute(
                "UPDATE notes SET flds=?, sfld=?, csum=?, mod=?, mid=? WHERE id=?",
                (flds_str, sfld, csum, now_ms, mid, nid),
            )
            ok += 1

        # --- 更新 col.mod（不动 scm/ver，保留源库 schema 标识）---
        cur.execute("UPDATE col SET mod=? WHERE id=1", (int(time.time() * 1000),))
        con.commit()
        con.close()

        # --- 重新打包 ---
        if os.path.exists(out):
            os.remove(out)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(db_path, "collection.anki2")
            z.writestr("media", media_bytes)

        size = os.path.getsize(out)
        print("\n[完成] 输出: %s (%d bytes)" % (out, size))
        print("  源题数: %d  成功转换: %d" % (len(rows), ok))
        print("  模型: %s | 牌组: %s" % (args.model_name, deck_name))
        print("  CSS 合并: 面试样式 + 原分析模块样式 (%d+%d chars)" % (len(INTERVIEW_CSS), len(clean_orig_css(src_css))))
        print("  方式: 原地修改源库（保留表/索引/ver/scm），不再重建库")
        print("\n  正面: 题目 + [答题框架]原生折叠 + 录音提示")
        print("  背面: 我的录音回放([sound:]) + 参考答案 + 得分关键词chips")
        print("  录音: 由 Feynman Audio 插件写入「录音」字段，零 JS、不卡死")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
