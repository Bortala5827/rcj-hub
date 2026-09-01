const fs = require('fs');
const p = 'C:/Users/小样儿/Desktop/products/_repos/rcj-hub/logs/experiments.json';
const raw = fs.readFileSync(p, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF;
const body = hasBom ? raw.slice(1) : raw;

// parse to confirm validity + get fields (only for verification)
JSON.parse(body);

// build new entry JSON in the file's own style (2-space indent, multiline)
const entry = {
  date: '2026-08-31',
  title: 'FaceTalk 精简为纯匹配工具：移除声纹暖场/结构化练习/AI点评/接口配置',
  summary: '用户要求 FaceTalk 保持纯粹的面试搭子匹配工具（菜单只留「关于」，AI 点评和接口全删）。index.html 汉堡菜单删「声纹暖场」与「结构化面试练习」外链，只留「关于」；删除声纹暖场全部链路（菜单按钮/vwarm 弹窗/音频 JS/内联 CSS/字典键）。pair.html 删除面试间(iv-card)区块及相关内联 JS、assets/interview.js、functions/api/interview.js 后端（git rm）。assets/settings.js 重写为纯「关于」弹窗，接口配置 tab/ASR/LLM/预设/测试连接全删。assets/i18n.js 删除 171 个未用键、新增 aboutMenu（dict 662→492）。assets/style.css 清理 iv-*/vwarm-*/bar-gear/set 配置死样式，保留关于弹窗样式与 .iv-callout。附带修复：settings.js 弹窗在语言切换重建后不再显示的问题（改为重建并保持打开）、bump-version.js 残留括号/版本正则 bug 并纳入 i18n.js 管理。版本统一 bump 至 20260831b。已验证：本机 Chrome 首页菜单只留 About、默认英文、中/英/日切换正常、About 弹窗打开正常、pair.html 无面试间且控制台无 JS 报错。提交 1ac8970 已推送部署。',
  type: 'refactor',
  tags: ['facetalk', 'cleanup', 'i18n', 'refactor']
};
const entryStr = JSON.stringify(entry, null, 2).split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n');

// update "updated" date
let out = body.replace(/"updated": "2026-08-\d\d"/, '"updated": "2026-08-31"');

// insert new entry right after the "experiments": [ opening line
const anchor = '"experiments": [';
const idx = out.indexOf(anchor);
if (idx < 0) throw new Error('anchor not found');
const insertAt = idx + anchor.length;
out = out.slice(0, insertAt) + '\n    ' + entryStr + ',\n' + out.slice(insertAt);

fs.writeFileSync(p, (hasBom ? '\uFEFF' : '') + out, 'utf8');
console.log('inserted; verifying...');
const raw2 = fs.readFileSync(p, 'utf8');
const body2 = raw2.charCodeAt(0) === 0xFEFF ? raw2.slice(1) : raw2;
const j = JSON.parse(body2);
console.log('valid, entries=' + j.experiments.length + ', first=' + j.experiments[0].title.slice(0, 20));
