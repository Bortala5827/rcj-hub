// cleanup-index.js — 删 SoloSpeak 顶部 series-bar 和底部 FaceTalk 链接
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(p, 'utf8');

// 删顶部 series-bar（含后面的空行）
const barRe = /<div class="series-bar">[\s\S]*?<\/div>\r?\n\s*\r?\n/;
if (!barRe.test(s)) { console.log('ERROR: series-bar not found'); process.exit(1); }
s = s.replace(barRe, '');
console.log('已删顶部 series-bar');

// 删底部 FaceTalk 链接（含后面的换行/空格）
const ftRe = /\s*<a href="https:\/\/facetalk\.955827\.xyz\/"[^>]*>FaceTalk<\/a>\r?\n?/;
if (!ftRe.test(s)) { console.log('WARNING: FaceTalk link not found'); }
else { s = s.replace(ftRe, '\n        '); console.log('已删底部 FaceTalk 链接'); }

fs.writeFileSync(p, s, 'utf8');
console.log('index.html 清理完成');
