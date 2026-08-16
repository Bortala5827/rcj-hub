// build.js — 从 meta.json 渲染公众号推文 HTML（省 token 架构：AI 只写数据，本脚本做渲染）
// 用法: node build.js ./meta.json [输出路径]   （默认输出 meta.out.html 或 article.html）
import fs from 'node:fs';
import path from 'node:path';

const metaPath = process.argv[2] || 'meta.json';
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function renderSection(sec) {
  const parts = [];
  if (sec.heading) parts.push(`<h2>${esc(sec.heading)}</h2>`);
  for (const p of sec.paragraphs || []) parts.push(`<p>${bold(p)}</p>`);
  if (sec.list) parts.push(`<ul>${sec.list.map(x => `<li>${bold(x)}</li>`).join('')}</ul>`);
  if (sec.blockquote) parts.push(`<blockquote>${bold(sec.blockquote)}</blockquote>`);
  if (sec.screenshot) parts.push(
    `<figure><img src="${esc(sec.screenshot.src || '')}" alt="${esc(sec.screenshot.desc || '')}" /><figcaption>▲ ${esc(sec.screenshot.desc || '')}</figcaption></figure>`
  );
  if (sec.placeholder) parts.push(`<div class="img-ph">🖼 ${esc(sec.placeholder)}（配图：后台手动插入）</div>`);
  return parts.join('\n');
}

const body = (meta.sections || []).map(renderSection).join('\n');
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${esc(meta.title)}</title>
<style>
body{max-width:680px;margin:0 auto;padding:24px 16px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#222;line-height:1.75}
h1{font-size:26px;margin-bottom:4px}h2{font-size:20px;margin-top:32px}
img{max-width:100%;border-radius:10px}figure{margin:20px 0}
figcaption{font-size:12px;color:#888;margin-top:6px}
blockquote{border-left:3px solid #ddd;padding-left:14px;color:#555;margin:16px 0}
.img-ph{background:#f5f6f7;color:#8a919f;padding:14px;border-radius:8px;text-align:center;margin:16px 0}
.summary{color:#666;border-left:3px solid #1e88e5;padding-left:12px;margin:16px 0}
</style>
</head>
<body>
<h1>${esc(meta.title)}</h1>
<p style="color:#888;font-size:13px">${esc(meta.author || '')} · ${new Date().toLocaleDateString('zh-CN')}</p>
${meta.summary ? `<p class="summary">${bold(meta.summary)}</p>` : ''}
${meta.cover ? `<img src="${esc(meta.cover.src)}" alt="封面" style="width:100%" />` : ''}
${body}
</body>
</html>`;

const out = process.argv[3] || meta.out?.html || 'article.html';
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, 'utf-8');
console.log(`✅ HTML 已生成: ${path.resolve(out)}（${html.length} 字符）`);
