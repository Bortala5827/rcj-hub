const fs = require('fs');
const p = 'C:/Users/小样儿/Desktop/products/_repos/rcj-hub/logs/experiments.json';
const raw = fs.readFileSync(p, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF;
const body = hasBom ? raw.slice(1) : raw;
const j = JSON.parse(body);
const before = j.experiments.length;
console.log('current entries:', before);

const entrySZ = {
  date: '2026-08-31',
  title: '深圳/惠州辅警题目上的 AI 分析按钮全部移除',
  summary: '用户反馈深圳辅警每道题右上角都有「🤖 AI分析」按钮太冗余，明确要求深圳和惠州全部删掉。共用的 fj/shared/app.js 中删除：cardHtml 的 AI 分析按钮与 questionText/questionTextJson 变量、aiAnalyzeQuestion 函数、#questionsList 事件委托的 .ai-analyze-btn 分支、buildExamCard 面试/笔试两分支的 AI 分析按钮及 aiBtn 绑定、开头 AI 按钮样式注入；深圳 index.html 同步删除 rcj-ai-analyze 监听（死代码），悬浮 AI 备考助手（aiFab/aiPanel）按用户此前要求保留。惠州无独立 AI 代码，共用 app.js 自动生效。app.js 为 UTF-8 BOM+混合换行，Edit 工具无法匹配，改用 Python 正则处理。已 node --check 验证语法、本机 Chrome 渲染验证两站无按钮。提交 5508fc7、d3d6040（含版本号 20260831 刷新缓存）并部署 rcj-exam-hub。',
  type: 'refactor',
  tags: ['exam', 'fj', 'sz', 'hz', 'ai-analyze', 'cleanup']
};
const entryFJ = {
  date: '2026-08-31',
  title: '辅警系列：移除邮箱与主页你懂的板块',
  summary: '彻底删除 fj 系列（主页/深圳/惠州/written）所有 Bortala5827@gmail.com 邮箱入口；删除 fj 主页「知识拓展-你懂的」板块及其 CSS，保留深圳/惠州卡片与 RCJ EXAM HUB 链接。commit 3d5d4c7 已部署。',
  type: 'refactor',
  tags: ['fj', 'footer', 'cleanup']
};

// insert 深圳/惠州 right after index 0 (my purge entry)
j.experiments.splice(1, 0, entrySZ);
// append 辅警系列 at the end (restoring its original position)
j.experiments.push(entryFJ);
j.updated = '2026-08-31';

// serialize keeping the file's 2-space style
const out = (hasBom ? '\uFEFF' : '') + JSON.stringify(j, null, 2) + '\n';
fs.writeFileSync(p, out, 'utf8');

// verify
const raw2 = fs.readFileSync(p, 'utf8');
const body2 = raw2.charCodeAt(0) === 0xFEFF ? raw2.slice(1) : raw2;
const v = JSON.parse(body2);
console.log('after entries:', v.experiments.length, '(was', before, ')');
console.log('top3:', v.experiments.slice(0, 3).map(e => e.title.slice(0, 22)).join(' | '));
console.log('last:', v.experiments[v.experiments.length - 1].title.slice(0, 22));
