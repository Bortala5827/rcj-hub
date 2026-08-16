---
name: anki-interview-consistency
description: 辅警/公考面试 Anki 卡包的质量核查与元数据定制。抽取 .apkg 字段→多维权度一致性核查（题型↔题目、条例合规、套模板检测、框架↔答案对应）→按"答案实词+题目情境"逐题定制考察能力/出题逻辑，消除复制粘贴式通用话术。含整体审计脚本化流程、场景关键词(LEX词典+频次阈值)去套话，与仓库/离线HTML/apkg三件套同步交付。触发词：整体审计面试卡包/批量去套话/三件套同步/城市面试题包复用/考察能力太套路/题型强行匹配。
---

# Anki 面试卡包 一致性核查与逐题定制

适用于：辅警/公考面试类 Anki 卡包（Front 题目+折叠框架，Back 含 考察能力/出题逻辑/参考答案 等模块），需批量核查质量或定制元数据。

## 一、抽取 .apkg 字段
Anki `.apkg` = zip(`collection.anki2` + media)。库表 `notes.flds` 用 `chr(31)` 分隔字段（Front=parts[0], Back=parts[1]）。

```python
import zipfile, sqlite3, tempfile, os, re
APKG='xxx.apkg'
tmp=tempfile.mkdtemp(); zipfile.ZipFile(APKG).extractall(tmp)
db=sqlite3.connect(os.path.join(tmp,'collection.anki2'))
for r in db.execute('SELECT id,flds FROM notes'):
    parts=r['flds'].split('\x1f'); front=parts[0]; back=parts[1]
    # 抽模块：re.search(r'class="module module-ability"[\s\S]*?module-content">([\s\S]*?)</div>', back)
```

## 二、五维权度核查
1. **题型↔题目问法**：用优先级正则判题型（应急须排在人际前——处置题常含"争执/报警"但"报警+怎么办"是强应急信号）。`综合分析`信号=怎么看/理解/评价；`自我认知`=结合工作谈/为什么报考；`组织`=组织/策划/开展/重点是什么；`人际`=沟通/调解/误会；`应急`=怎么办/报警/现场处置；`现场模拟`信号=现场模拟/话术/怎么说/你怎么回应——**是独立题型**，框架讲「共情→接异议→给方案→引导配合」，**严禁误标为应急应变**。
2. **题型↔框架↔标签 四标识一致**：Front 元信息 + Front 框架框 + Back border-left 框架块头 + Back tag-line 必须同题型。改一处要同步四处（易漏 Back 框架块头，因其外层 div 与【题型】间有嵌套 div）。**注意：现场模拟题极易被错标成应急应变**（都含"处置/劝阻/沟通"），必须按题目"请现场模拟…话术"判定为现场模拟；其框架要接住题目里的具体异议（如电动车题"天热闷/骑不快"两个反驳点），不能套应急的"快速响应控场→分级分类处置"。框架是"强行匹配"最常被投诉的点——要贴合题目情境，而非只贴题型模板。
3. **参考答案↔条例合规**（辅警重点）：见第三节红线。
4. **套模板检测**：按 `norm(ability)` 分组，统计完全重复≥3 张的同文案——这是"不对应"最常见主因。
5. **框架步骤↔答案**：软核（关键词信号）只能初筛，噪声大，需人工抽样确认，勿凭关键词直接判错。

## 三、深圳辅警条例合规红线（核对参考答案）
《深圳经济特区警务辅助人员条例》(2017通过·2019修正)：
- **可独立(第八条)**：预防制止违法、调解民事纠纷、巡逻值守、安全巡查、维护现场秩序/救助、疏导交通+**劝阻**违法+**采集**信息、消防巡查、宣传教育。
- **须1名以上警察带领(第九条)**：接处警、盘问检查、传唤抓捕押解、行政案件调查取证/强制措施、大型活动秩序、群体性事件。
- **禁止(第十一条)**：刑事侦查/刑事强制措施/技术侦察、交通事故责任认定、**作出行政处理决定(开罚单/处罚)**、国安、涉密。
- 核查：扫答案里"辅警作为主语直接实施禁止/须带领事项"的句式；应急类卡须确认描述盘问/抓捕/处警时写明"在民警带领下/协助"（否则大概率是误报——辅警作宾语或泛指讨论）。

## 四、逐题定制考察能力/出题逻辑（去套模板）
题型基底能力 + 从**该题答案**抽实务实词 + 从**题目**提情境主题 → 题题不同。

**场景域词典（LEX）**——辅警面试通用起点；新城市题包先按此题库跑一遍再按需增补：
```python
LEX = [
  (r"头盔|红绿灯|交通|车道|停车|骑行|电动车|货车|驾驶|路口|斑马线|泊位|逆行|冲卡|占用应急车道|交警|交通事故|违停", "交通劝导执法"),
  (r"诈骗|冒充|转账|公检法|刷单|理赔|中奖|保健品|杀猪盘", "反诈劝阻"),
  (r"矛盾|冲突|争吵|推搡|邻里|夫妻|口角|纠纷调解", "矛盾纠纷调解"),
  (r"急救|心肺复苏|溺水|轻生|跳楼|自杀|受伤|止血|昏迷", "应急救护"),
  (r"情绪|焦虑|恐慌|抑郁|崩溃|心理疏导|安抚", "心理疏导"),
  (r"宣传|宣讲|普法|讲座|进校园|进社区|安全宣讲", "宣传普法"),
  (r"救助|走失|老人|儿童|迷路|寻人|帮扶|便民", "群众服务救助"),
  (r"处罚|罚款|盘问|传唤|强制|执法记录仪|法定程序", "规范执法"),
  (r"保密|案情|涉密|内部|泄密", "警务保密"),
  (r"前辈|新辅警|带教|培训|加班|职业规划|师徒", "队伍管理带教"),
  (r"朋友圈|传谣|谣言|舆情|网络|网暴", "舆情网安"),
  (r"聚集|群体|示威|突发事件|踩踏|火灾|爆炸", "公共事件处置"),
]
```
**场景域提取（domainsOf）**——**标题优先、答案回退且设频次阈值**，过滤答案里的偶然词噪声：
```python
def match_dom(txt, min_count=1):
    seen = []
    for re_pat, label in LEX:
        if len(re.findall(re_pat, txt)) >= min_count and label not in seen:
            seen.append(label)
    return seen

def domains_of(q):
    td = match_dom(q.title, 1)                     # 标题命中≥1即采用（不要求≥2，否则交通题只命中1个域会被丢弃）
    if td:
        ad = match_dom(q.title + " " + q.answer, 2)  # 再用答案≥2次补缺，过滤单次偶然提及
        for x in ad:
            if x not in td:
                td.append(x)
        return td[:3]
    ad = match_dom(q.answer, 2)                    # 标题无命中才纯用答案
    return ad[:3]
```
**ability / logic 模板**（实测可用，无套话、无字面占位符）：
```python
doms = domains_of(q)
dom_line = "、".join(doms) if doms else "辅警日常勤务"
ability = f"{TYPE_BASE[q.type]}；重点考查考生在{dom_line}等具体实务中，能否结合「{topic}」情境给出可落地的深圳本土化处置思路。"
logic  = f"以「{topic}」为切入，考查{TYPE_ANGLE[q.type]}；重点看考生能否接住题中具体冲突/异议，并围绕{dom_line}等给出条理清晰、合规可行的作答。"
```
> 判定套话的硬指标：ability/logic 里残留字面占位符（如「该警务情境」「本题落脚于X、Y」固定清单）或同文案重复≥3 张 → 必须按上述流程重算。

## 五、致命坑（必看）
1. **删/改嵌套 div 模块**：绝不能用 `[\s\S]*?</div>` 非贪婪（会在首个内层 `</div>` 截断留孤儿碎片）。改用 depth 计数（开标签后遇 `<div`+1、`</div>`且depth==0才结束），或用 lxml/BeautifulSoup 按 class 删整节点。
2. **改 Back 框架块头**：正则开标签到【题型】之间要用 `[\s\S]*?`（中间有嵌套 div+文字），不能用 `\s*`。
3. **脚本 import 触发写盘**：含写回 apkg 逻辑的模块，务必包 `if __name__=='__main__':`，否则 `import` 预览时会误写真实文件。
4. **白名单必须从源库构建**：从"已修复中间态"跑 rescan 建白名单，重建即丢失修复；应从干净源库 rescan。
5. **AnkiDroid 近名模型字段合并残留**：交付新包用全新模型名+新 mid 隔离，避免旧版空字段裸露。
6. **Python re.sub 把替换串里的 `\n` 当真换行**：想往 JS 字符串写 `\"\\n\"`（反斜杠n 作为 JS 换行转义）时，若 `re.sub(pat, repl, s)` 的 repl 含 `\n`，re.sub 会把它解释成真实换行，破坏 JS 解析。改用 `re.sub(pat, lambda m: repl, s)`（lambda 返回不做转义）或先写占位符再 replace。同样：锚点要覆盖 type 字段（type 在 title 之前，须从对象开头的 `{` 起算区间，否则只改到 framework/ability/logic 而漏掉 type）。
7. **场景域提取过滤偶然词**：用标题定场景域 minCount=1 即可；但回退到答案提取时**必须要求关键词出现≥2次（minCount=2）**，否则答案里偶尔提一句「反诈/理赔」会被误纳为本题场景域，污染 ability/logic（实测 #131 查扣脱保车辆一度被误带「反诈劝阻」）。优先用标题定域。
8. **Anki 答案面「结构化思路」双显（重复）**：Anki 渲染答案面时会先淡显整张 Front 卡（`{{Front}}`），再显示 `{{Back}}`。若 Front 已有框架折叠框、Back 又塞一个 `fw-block` 框架块 → 答案面框架出现两次。修法：**框架块只放 Front（折叠框），Back 不含框架**；且 Front 的 `<details>` **不要加 `open`**（默认折叠、点击才展开）。实测 138 题 Back 全删 `fw-block` 后重复消除。

## 六、整体审计脚本化流程（城市题包批量复用）
对一个完整面试卡包做"整体分析→批量修正→三件套同步"，推荐脚本化，避免逐题手改漏网：

**1. 抽数据审计**：把 `station-data.js` 的 `window.DATA_INTERVIEW = [...]` 用 node 抽出，生成紧凑审计稿（序号/题型/标题/框架/能力/逻辑），逐题核对五维（见二）。
```bash
node -e 'const fs=require("fs"); const c=fs.readFileSync("src/sz/station-data.js","utf8");
const m=c.match(/window\.DATA_INTERVIEW\s*=\s*(\[[\s\S]*?\n\];)/);
const d=JSON.parse(m[1].replace(/;\s*$/,"")); /* dump d 到 audit.txt 逐题看 */'
```
**2. 修订生成器**：用 node/js 解析数组 → 改 type/framework/ability/logic → 仅替换 `DATA_INTERVIEW` 数组，保留同文件 `SITE_CONFIG`/`DATA_WRITTEN`（assemble.py 仅整文件拼进 HTML，格式兼容）。**远优于 Python re.sub**（后者遇 `\n` 转义坑、锚点漏 type，见五.6）。
**3. 三件套重建链路**（顺序固定）：
   - 仓库 `src/<city>/station-data.js`（源头）
   - `python build/assemble.py <city>` → `<city>/index.html`
   - `python build/make_offline.py <city>` → `<city>-offline.html`（内联自包含，双击即用）
   - `genanki` 从修正数据 JSON 重建 `练习版.apkg`（**Front=题+折叠框架（`<details>` 不带 `open`，默认折叠、点击展开）；Back=能力+逻辑+参考答案，框架块只放 Front，切勿在 Back 重复**，否则 Anki 答案面双显「结构化思路」）
**4. 交叉校验**：仓库 / 离线HTML / apkg 三者数据须一致——抽查结构错配题（如 #122→综合分析、#137→人际沟通）在三者均正确，且无旧错框架/字面占位符残留。
**5. 提交推送**：`git add` 仅本次相关文件（如 `src/sz/station-data.js sz-offline.html sz/index.html`），勿带入无关改动（如 `src/gd` 的非本次修改）。
