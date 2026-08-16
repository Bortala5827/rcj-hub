#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 Anki .apkg 笔试题模板统一为「提交后显答案」交互（单选/多选/判断统一），
并可审计+修正错标的题型标签（单选题被错归多选等）。

用法:
  python apply_template.py 输入.apkg                 # 仅审计，预览变更
  python apply_template.py 输入.apkg --fix-tags      # 审计并修正标签
  python apply_template.py 输入.apkg --fix-tags -o 输出.apkg
未给 -o 时默认输出 <输入>_提交显答案.apkg，不覆盖原包。
"""
import sqlite3, zipfile, os, json, time, argparse, re, tempfile, shutil

QFMT_TPL = """<div class="card __CLASS__">
<div class="meta">__LABEL__ · {{批次}} · #{{编号}}</div>
<div class="stem">{{题干}}</div>
<div class="options" id="opts-front">{{选项}}</div>
<div class="hint">选择答案后点击「提交」查看对错</div>
<button class="submit-btn" id="submit-btn" type="button">提交</button>
<span class="ans-key" id="ans-key">{{answer_letter}}</span>
<script>
(function(){
  var key=document.getElementById('ans-key');
  if(!key) return;
  var correct=key.textContent.trim().split('').filter(function(c){return c;});
  var ansDiv=document.getElementById('opts-front');
  if(!ansDiv) return;
  var btn=document.getElementById('submit-btn');
  var opts=Array.prototype.slice.call(ansDiv.querySelectorAll('.opt'));
  var multi = correct.length>1;
  var submitted=false;
  function clearSel(){ opts.forEach(function(x){x.classList.remove('selected');}); }
  opts.forEach(function(o){
    o.classList.add('opt-interactive');
    o.addEventListener('click',function(){
      if(submitted) return;
      if(multi){ o.classList.toggle('selected'); } else { clearSel(); o.classList.add('selected'); }
    });
  });
  if(btn){ btn.addEventListener('click',function(){
    if(submitted) return; submitted=true; btn.disabled=true; btn.textContent='\u5df2\u63d0\u4ea4\uff0c\u7ffb\u9762\u770b\u89e3\u6790';
    opts.forEach(function(o){
      o.classList.remove('opt-interactive');
      var lbl=o.querySelector('.opt-l'); if(!lbl) return;
      var letter=lbl.textContent.trim();
      var isCorrect=correct.indexOf(letter)>=0; var isSel=o.classList.contains('selected');
      if(isCorrect){ o.classList.add('reveal-correct'); if(isSel) o.classList.add('selected-correct'); }
      else if(isSel){ o.classList.add('selected-wrong'); }
    });
    var selLetters=opts.filter(function(x){return x.classList.contains('selected');})
      .map(function(x){return x.querySelector('.opt-l').textContent.trim();});
    var fb=document.createElement('div'); fb.className='feedback-msg'; var ok;
    if(multi){
      ok = correct.length===selLetters.length && correct.every(function(c){return selLetters.indexOf(c)>=0;});
      fb.textContent = ok ? '\u2713 \u5168\u90e8\u6b63\u786e\uff01' : '\u2717 \u56de\u7b54\u9519\u8bef\uff0c\u6b63\u786e\u7b54\u6848\uff1a'+correct.join('\u3001');
    } else {
      ok = (selLetters.length===1 && selLetters[0]===correct[0]);
      fb.textContent = ok ? '\u2713 \u56de\u7b54\u6b63\u786e\uff01' : '\u2717 \u56de\u7b54\u9519\u8bef\uff0c\u6b63\u786e\u7b54\u6848\uff1a'+correct[0];
    }
    fb.className += (ok?' feedback-correct':' feedback-wrong');
    ansDiv.appendChild(fb);
  }); }
})();
</script>
</div>
"""

NEW_CSS = """
.opt.selected {
  border-color: #0ea5e9 !important;
  background: #e0f2fe !important;
  box-shadow: 0 0 0 2px #0ea5e9;
}
.submit-btn {
  margin-top: 16px;
  display: block;
  width: 100%;
  padding: 12px 0;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: #0d9488;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  letter-spacing: 1px;
}
.submit-btn:hover { background: #0f766e; }
.submit-btn:disabled { background: #94a3b8; cursor: default; }
"""

LABEL_MAP = {0: ("单选题", "type-dan"), 1: ("多选题", "type-duo"), 2: ("判断题", "type-pan")}
TYPE_CLASS = {"单选题": "type-dan", "多选题": "type-duo", "判断题": "type-pan"}
TYPE_IS = {"单选题": "is_单选", "多选题": "is_多选", "判断题": "is_判断"}
TYPE_TAG = {"单选题": "单选题", "多选题": "多选题", "判断题": "判断题"}


def get_option_texts(opts_html):
    blocks = opts_html.split('<div class="opt"')
    texts = []
    for b in blocks[1:]:
        idx = b.find('</span>')
        if idx == -1:
            continue
        rest = b[idx + len('</span>'):]
        t = re.sub(r'^[\.\u3001\s]+', '', rest).split('<')[0].strip()
        texts.append(t)
    return texts


def true_type(f, I):
    al = f[I["answer_letter"]].strip()
    if len(al) >= 2:
        return "多选题"
    texts = get_option_texts(f[I["选项"]])
    tf = {"正确", "错误", "对", "错"}
    if len(texts) == 2 and set(texts) <= tf:
        return "判断题"
    return "单选题"


def default_out(inp):
    base, ext = os.path.splitext(inp)
    return base + "_提交显答案" + ext


def apply(inp, out, fix_tags, model_name):
    tmp = tempfile.mkdtemp(prefix="anki_patch_")
    try:
        with zipfile.ZipFile(inp) as z:
            z.extractall(tmp)
        db = os.path.join(tmp, "collection.anki2")
        if not os.path.exists(db):
            raise SystemExit("找不到 collection.anki2，可能不是有效的 .apkg")
        con = sqlite3.connect(db); cur = con.cursor()
        models = json.loads(cur.execute("SELECT models FROM col").fetchone()[0])
        # 选模型
        if model_name:
            mkey = next((k for k, v in models.items() if v.get("name") == model_name), None)
            if not mkey:
                raise SystemExit("未找到模型: " + model_name)
        else:
            mkey = list(models.keys())[0]
        m = models[mkey]
        flds = [f["name"] for f in m["flds"]]
        I = {n: i for i, n in enumerate(flds)}
        need = ["answer_letter", "is_单选", "is_多选", "is_判断"]
        if any(x not in I for x in need):
            raise SystemExit("模型 %s 缺少必要字段，跳过（非标准选择题模型）" % m.get("name"))

        # ---- 应用统一交互模板 ----
        type_by_ord = {}
        for t in m["tmpls"]:
            name = t["name"]
            typ = name if name in TYPE_CLASS else LABEL_MAP.get(t["ord"], ("单选题", "type-dan"))[0]
            type_by_ord[t["ord"]] = typ
            label, cls = typ, TYPE_CLASS[typ]
            t["qfmt"] = QFMT_TPL.replace("__CLASS__", cls).replace("__LABEL__", label)
        # req 按 is_ 字段
        m["req"] = [[t["ord"], "all", [I[TYPE_IS[type_by_ord[t["ord"]]]]]] for t in m["tmpls"]]
        if ".opt.selected" not in m["css"]:
            m["css"] = m["css"].rstrip() + "\n" + NEW_CSS
        m["mod"] = int(time.time() * 1000)
        models[mkey] = m
        cur.execute("UPDATE col SET models=? WHERE id=(SELECT id FROM col)",
                    (json.dumps(models, ensure_ascii=False),))
        print("[模板] 已写入统一「提交后显答案」交互；req 已校正。")

        # ---- 标签审计 / 修正 ----
        cur.execute("SELECT id, flds, tags FROM notes")
        rows = cur.fetchall()
        changes = []
        for nid, fs, ts in rows:
            f = fs.split("\x1f")
            tt = true_type(f, I)
            cur_tags = [x for x in ts.split(" ") if x]
            cur_type = next((x for x in cur_tags if x in TYPE_TAG), None)
            if cur_type == tt:
                continue
            old = cur_type or "(无)"
            # 计算新字段
            new_f = f[:]
            new_f[I["题型"]] = tt
            for tk, fld in TYPE_IS.items():
                new_f[I[fld]] = "Y" if tk == tt else ""
            # 去掉答案里错误的（多选）标记
            ans = new_f[I["答案"]]
            if tt != "多选题" and "（多选）" in ans:
                ans = ans.replace("（多选）", "")
                new_f[I["答案"]] = ans
            new_tags = [x for x in cur_tags if x not in TYPE_TAG] + [TYPE_TAG[tt]]
            changes.append((nid, old, tt))
            if fix_tags:
                cur.execute("UPDATE notes SET flds=?, tags=?, mod=? WHERE id=?",
                            ("\x1f".join(new_f), " " + " ".join(new_tags) + " ", int(time.time() * 1000), nid))
                # 卡片 ord 对齐
                cur.execute("SELECT id, ord FROM cards WHERE nid=?", (nid,))
                cards = cur.fetchall()
                target_ord = {"单选题": 0, "多选题": 1, "判断题": 2}[tt]
                if len(cards) == 1:
                    cur.execute("UPDATE cards SET ord=? WHERE id=?", (target_ord, cards[0][0]))
                elif len(cards) == 0:
                    cur.execute("INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) "
                                "SELECT COALESCE(MAX(id),0)+1, ?, (SELECT did FROM decks LIMIT 1), ?, ?, -1, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, '' FROM cards",
                                (nid, target_ord, int(time.time() * 1000)))

        cur.execute("UPDATE col SET mod=? WHERE id=(SELECT id FROM col)", (int(time.time() * 1000),))
        con.commit(); con.close()

        if changes:
            print("\n[审计] 发现 %d 处题型不一致（真实题型已按 answer_letter 重判）：" % len(changes))
            for nid, old, tt in changes:
                print("  nid=%s  %s -> %s%s" % (nid, old, tt, "  (已修正)" if fix_tags else "  (未写入，加 --fix-tags 修正)"))
        else:
            print("\n[审计] 全部 %d 题题型标签一致，无需修正。" % len(rows))

        # ---- 重新打包 ----
        media_path = os.path.join(tmp, "media")
        media_bytes = b"{}"
        if os.path.exists(media_path):
            with open(media_path, "rb") as fh:
                media_bytes = fh.read()
        if os.path.exists(out):
            os.remove(out)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(db, "collection.anki2")
            z.writestr("media", media_bytes)
        print("\n[完成] 输出: %s (%d bytes)" % (out, os.path.getsize(out)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description="Anki 选择题卡包统一「提交后显答案」交互 + 题型标签审计")
    ap.add_argument("input", help="输入 .apkg")
    ap.add_argument("-o", "--output", default=None)
    ap.add_argument("--fix-tags", action="store_true", help="修正错标的题型标签（默认仅审计预览）")
    ap.add_argument("--model", default=None, help="指定模型名（默认第一个）")
    args = ap.parse_args()
    out = args.output or default_out(args.input)
    apply(args.input, out, args.fix_tags, args.model)


if __name__ == "__main__":
    main()
