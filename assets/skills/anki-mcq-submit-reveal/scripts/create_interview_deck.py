#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建面试语音答题卡 Anki 卡包（Part 2）。
从 CSV / JSON 读取面试题数据，生成含录音+STT+框架分析模板的 .apkg。

用法:
  python create_interview_deck.py data.csv -o 输出.apkg
  python create_interview_deck.py data.json -o 输出.apkg --model-name "RCJ面试"
  python create_interview_deck.py data.csv                    # 默认输出 <输入>_面试.apkg

CSV 首行必须包含字段：题目,题型分类,答题框架,参考答案,得分关键词（编号自动生成，录音留空）
"""
import sqlite3, zipfile, os, json, time, argparse, csv, tempfile, shutil, uuid, hashlib

# ── 导入模板定义 ──
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from templates.interview_template import (
    INTERVIEW_FIELDS, INTERVIEW_TEMPLATES, INTERVIEW_REQ, INTERVIEW_CSS,
    _QFMT_INTERVIEW, _AFMT_INTERVIEW,
)


def build_collection(model_name, deck_name):
    """构建一个全新的 collection.anki2，含面试模型。"""
    db = ":memory:"
    con = sqlite3.connect(db)
    cur = con.cursor()

    # 创建表
    cur.executescript("""
    CREATE TABLE col (
        id              integer primary key,
        crt             integer not null,
        mod             integer not null,
        scm             integer not null,
        ver             integer not null,
        dty             integer not null,
        usn             integer not null,
        ls              integer not null,
        conf            text not null,
        models          text not null,
        decks           text not null,
        dconf           text not null,
        tags            text not null
    );
    CREATE TABLE notes (
        id              integer primary key,
        guid            text not null,
        mid             integer not null,
        mod             integer not null,
        usn             integer not null,
        tags            text not null,
        flds            text not null,
        sfld            integer not null,
        csum            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE cards (
        id              integer primary key,
        nid             integer not null,
        did             integer not null,
        ord             integer not null,
        mod             integer not null,
        usn             integer not null,
        type            integer not null,
        queue           integer not null,
        due             integer not null,
        ivl             integer not null,
        factor          integer not null,
        reps            integer not null,
        lapses          integer not null,
        left            integer not null,
        odue            integer not null,
        odid            integer not null,
        flags           integer not null,
        data            text not null
    );
    CREATE TABLE revlog (
        id              integer primary key,
        cid             integer not null,
        usn             integer not null,
        ease            integer not null,
        ivl             integer not null,
        lastIvl         integer not null,
        factor          integer not null,
        time            integer not null,
        type            integer not null
    );
    CREATE TABLE tags (
        id              integer primary key,
        tag             text not null,
        usn             integer not null,
        mod             integer not null,
        usage           integer not null
    );
    CREATE TABLE graves (
        usn             integer not null,
        oid             integer not null,
        type            integer not null
    );
    """)

    now_ms = int(time.time() * 1000)
    model_id = int(time.time()) & 0xFFFFFFFF
    deck_id = (model_id + 1) & 0xFFFFFFFF
    # model key
    mkey = str(model_id)

    # 构建模型 JSON
    model = {
        "id": model_id,
        "name": model_name,
        "flds": INTERVIEW_FIELDS,
        "sortf": 0,
        "tmpls": [
            {
                "name": t["name"],
                "ord": t["ord"],
                "qfmt": t["qfmt"],
                "afmt": t["afmt"],
                "bqfmt": t.get("bqfmt", ""),
                "bafmt": t.get("bafmt", ""),
                "did": t.get("did"),
                "bfont": t.get("bfont", ""),
                "bsize": t.get("bsize", 0),
            }
            for t in INTERVIEW_TEMPLATES
        ],
        "css": INTERVIEW_CSS.lstrip(),
        "type": 0,
        "mod": now_ms,
        "usn": -1,
        "req": INTERVIEW_REQ,
        "latexPre": "",
        "latexPost": "",
        "latexpPre": "",
        "latexpPost": "",
    }

    models_json = {mkey: model}
    decks_json = {
        str(deck_id): {
            "id": deck_id,
            "mod": now_ms,
            "name": deck_name,
            "usn": -1,
            "lrnDays": 0,
            "desc": "",
            "collapsed": False,
        }
    }
    dconf_json = {"1": {"id": 1, "name": "Default", "mod": now_ms, "usn": -1,
                       "maxTaken": 0, "easyBonus": 1.3, "hardInterval": 1.2,
                       "lapseIntv": 0.0, "lapseMin": 1.0, "gradIntv": 0.0,
                       "delay": 0.0, "dragDrop": True, "easFactor": 170.0,
                       "highVocab": 0.7, "lowSpaceThresh": 50.0, "newPerDay": 20,
                       "revPerDay": 200, "ivlfct": 1.3, "maxIvl": 36500,
                       "weights": [1.3, 0.0, 0.0], "replayq": True,
                       "dueCounts": True, "bursts": True, "newMix": 0,
                       "newCutoff": 60, "delayHint": 0.0, "stopTimer": True,
                       "automoves": False, "sched": 0, "dayLearn": 5}}

    cur.execute(
        "INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (1, time.time(), now_ms, 0, 16, 0, -1, 0, json.dumps({
            "activeDecks": [deck_id],
            "curDeck": deck_id,
            "newSpread": 0,
            "collapseTime": 1200,
            "timeLim": 0,
            "estTimes": True,
            "dueCounts": True,
            "curModel": model_id,
            "nextPos": 1,
            "sortType": "noteFld",
            "sortBackwards": False,
            "addToCur": True,
    }, ensure_ascii=False), json.dumps(models_json, ensure_ascii=False),
     json.dumps(decks_json), json.dumps(dconf_json), ""))
    con.commit()
    return con, cur, model_id


def field_checksum(s):
    """Anki 字段校验和算法。"""
    return int(hashlib.sha1(s.encode("utf-8")).hexdigest()[:8], 16)


def insert_note(cur, nid, guid, mid, tags, fields_list, sort_field_idx=0):
    """插入一条 note + 对应卡片。"""
    now_ms = int(time.time() * 1000)
    flds_str = "\x1f".join(fields_list)
    sfld = fields_list[sort_field_idx] if sort_field_idx < len(fields_list) else ""
    csum = field_checksum(sfld)

    cur.execute(
        "INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (nid, guid, mid, now_ms, -1, tags, flds_str, sfld, csum, 0, "")
    )

    # 每张模板生成一张卡（面试只有 ord=0 一张）
    for tmpl in INTERVIEW_TEMPLATES:
        card_id = (nid ^ (tmpl["ord"] + 1)) & 0xFFFFFFFF
        if card_id == 0:
            card_id = (nid | 0x80000000) & 0xFFFFFFFF
        try:
            cur.execute(
                "INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (card_id, nid, 1, tmpl["ord"], now_ms, -1, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0, "")
            )
        except sqlite3.IntegrityError:
            # 冲突则递增
            import random
            card_id = random.randint(1, 2**53)
            cur.execute(
                "INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (card_id, nid, 1, tmpl["ord"], now_ms, -1, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0, "")
            )


def load_csv(path):
    """从 CSV 加载面试题数据。返回 list of dict。"""
    rows = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            r = {}
            for k, v in row.items():
                if k is None or v is None:
                    continue
                r[k.strip()] = v.strip()
            if r.get("题目"):
                rows.append(r)
    return rows


def load_json(path):
    """从 JSON 加载。支持 {items:[...]} 或 [...] 格式。"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    raise ValueError("JSON 格式错误：需要数组或 {items:[...]}")


def main():
    ap = argparse.ArgumentParser(description="创建面试语音答题 Anki 卡包")
    ap.add_argument("input", help="输入 CSV 或 JSON 文件")
    ap.add_argument("-o", "--output", default=None, help="输出 .apkg 路径")
    ap.add_argument("--model-name", default="RCJ辅警-面试语音答题", help="模型/笔记类型名称")
    ap.add_argument("--deck-name", default="RCJ辅警::面试演练", help="牌组名称")
    args = ap.parse_args()

    out = args.output
    if not out:
        base, ext = os.path.splitext(args.input)
        out = base + "_面试" + ext

    # 加载数据
    ext_lower = os.path.splitext(args.input)[1].lower()
    if ext_lower in (".csv", ".tsv"):
        items = load_csv(args.input)
    elif ext_lower == ".json":
        items = load_json(args.input)
    else:
        raise SystemExit("不支持的文件格式: %s（需 .csv/.json）" % ext_lower)

    print("[读取] 从 %s 读入 %d 条面试题" % (args.input, len(items)))
    if not items:
        raise SystemExit("无有效数据")

    # 构建集合
    con, cur, model_id = build_collection(args.model_name, args.deck_name)
    nid_base = int(time.time() * 1000)

    required_fields = ["题目", "题型分类", "答题框架", "参考答案"]
    optional_fields = ["得分关键词"]

    for i, item in enumerate(items):
        nid = nid_base + i + 1
        guid = str(uuid.uuid4())
        tag_type = item.get("题型分类", "其他").strip()

        # 构建字段值列表
        fields = []
        for fd in INTERVIEW_FIELDS:
            fname = fd["name"]
            val = item.get(fname, "").strip()
            if fname == "录音":
                val = ""  # 录音字段始终为空
            elif fname not in item and fname in optional_fields:
                val = ""
            fields.append(val)

        # 编号（如果有编号字段就用，否则自动生成）
        if "编号" in item:
            num_val = str(item["编号"]).strip()
        else:
            num_val = str(i + 1)
        # 写入编号字段（保持与 INTERVIEW_FIELDS 顺序一致）
        for fi, fd in enumerate(INTERVIEW_FIELDS):
            if fd["name"] == "编号":
                fields[fi] = num_val
                break

        tags = " 面试 %s " % tag_type

        insert_note(cur, nid, guid, model_id, tags, fields, sort_field_idx=0)

    # 更新 col mod
    cur.execute("UPDATE col SET mod=? WHERE id=1", (int(time.time() * 1000),))
    con.commit()

    # 打包
    tmpdir = tempfile.mkdtemp(prefix="anki_iv_")
    try:
        db_path = os.path.join(tmpdir, "collection.anki2")
        disk_con = sqlite3.connect(db_path)
        con.backup(disk_con)
        disk_con.close()

        media_bytes = b"{}"
        if os.path.exists(out):
            os.remove(out)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(db_path, "collection.anki2")
            z.writestr("media", media_bytes)

        size = os.path.getsize(out)
        print("\n[完成] 输出: %s (%d bytes, %d 题)" % (out, size, len(items)))
        print("  模型名: %s  |  牌组: %s  |  模板: %s"
              % (args.model_name, args.deck_name, INTERVIEW_TEMPLATES[0]["name"]))
        print("\n  使用方式: Anki → 文件 → 导入 此 apkg")
        print("  正面: 录音答题 + STT转文字 → 提交")
        print("  背面: 转写展示 + 框架覆盖检查 + 参考答案 + 关键词高亮 + 录音下载")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
        con.close()


if __name__ == "__main__":
    main()
