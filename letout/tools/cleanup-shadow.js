// cleanup-letout-shadow.js — 删除 LetOut 情绪影子资源库（影视台词+外部音频）
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'js', 'app.js');
let s = fs.readFileSync(appPath, 'utf8');
const EOL = s.includes('\r\n') ? '\r\n' : '\n';

function removeLine(prefix) {
  const re = new RegExp('^.*' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*\\r?\\n', 'm');
  if (!re.test(s)) { console.log('WARNING not found:', prefix); return; }
  s = s.replace(re, '');
  console.log('removed line:', prefix);
}

// 1. import 行：移除 mountAudioPlayer
s = s.replace(
  "import { mountPlayer, mountAudioPlayer } from './player.js?v=20260813a';",
  "import { mountPlayer } from './player.js?v=20260813a';"
);
console.log('removed mountAudioPlayer from import');

// 2. 删除 resource.js import
removeLine("import { getEmotionShadows } from './resource.js");

// 3. 删除 shadowCache 变量
removeLine("let shadowCache = null;");

// 4. 删除 shadowPlayer 变量
removeLine("let shadowPlayer = null;");

// 5. 删除 shadow-zone div
removeLine('<div class="shadow-zone" id="shadowZone"></div>');

// 6. 删除 renderShadows() 调用
removeLine("renderShadows();");

// 7. 删除整个情绪影子函数块（从注释到 renderShadowInner 结束）
const blockRe = /\/\/ ---------------- 情绪影子[\s\S]*?^}/m;
if (!blockRe.test(s)) {
  console.log('WARNING: shadow function block not found, trying alternate');
  // 备用：从 renderShadows 函数到下一个 // ----------------
  const altRe = /async function renderShadows\(\)[\s\S]*?(?=\r?\n\/\/ ----------------)/;
  if (altRe.test(s)) { s = s.replace(altRe, ''); console.log('removed shadow block (alt)'); }
  else console.log('ERROR: could not find shadow block');
} else {
  s = s.replace(blockRe, '');
  console.log('removed shadow function block');
}

fs.writeFileSync(appPath, s, 'utf8');
console.log('app.js cleaned');

// 8. 删除 resource.js 文件
const resPath = path.join(__dirname, '..', 'js', 'resource.js');
if (fs.existsSync(resPath)) {
  fs.unlinkSync(resPath);
  console.log('deleted resource.js');
} else {
  console.log('resource.js not found');
}
