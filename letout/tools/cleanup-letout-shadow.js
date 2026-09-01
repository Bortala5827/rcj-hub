// cleanup-letout-shadow.js — 删 LetOut app.js 里所有情绪影子（shadow）相关代码
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'js', 'app.js');
let s = fs.readFileSync(p, 'utf8');

// 1. 删 import getEmotionShadows
s = s.replace(/\nimport \{ getEmotionShadows \} from '\.\/resource\.js[^']*';\n/, '\n');

// 2. 删 mountAudioPlayer（只被 shadow 用），保留 mountPlayer
s = s.replace(/import \{ mountPlayer, mountAudioPlayer \} from/, 'import { mountPlayer } from');

// 3. 删 shadowCache 变量
s = s.replace(/\nlet shadowCache = null;[^\n]*\n/, '\n');

// 4. 删 shadowPlayer 变量
s = s.replace(/\nlet shadowPlayer = null;[^\n]*\n/, '\n');

// 5. 删 renderHome 里的 shadow-zone div
s = s.replace(/\n\s*<div class="shadow-zone" id="shadowZone"><\/div>\n/, '\n');

// 6. 删 renderHome 里的 renderShadows() 调用
s = s.replace(/\n\s*renderShadows\(\);\n/, '\n');

// 7. 删整个 renderShadows + renderShadowInner 函数块（从注释到下一个大注释前）
const shadowFnRe = /\n\/\/ ---------------- 情绪影子（资源库 \/ 占位） ----------------[\s\S]*?\n\/\/ ---------------- 库房（释放记录） ----------------/;
if (shadowFnRe.test(s)) {
  s = s.replace(shadowFnRe, '\n// ---------------- 库房（释放记录） ----------------');
  console.log('已删 renderShadows + renderShadowInner 函数块');
} else {
  console.log('WARNING: shadow function block not found');
}

fs.writeFileSync(p, s, 'utf8');
console.log('app.js shadow 代码清理完成');
