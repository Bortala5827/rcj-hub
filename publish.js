// ============================================================
// rcj-hub 一键发布脚本
// 用法：双击 publish.bat（或命令行 node publish.js）
// 作用：扫描 blog/posts/*.md → 自动生成 posts.json → git 提交 + 推送
// 你只需要做一件事：在 blog/posts/ 里写好 xxx.md，然后双击 publish.bat
// ============================================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');
const INDEX_FILE = path.join(ROOT, 'blog', 'posts.json');

// 解析 frontmatter（与 post.html 里的逻辑保持一致）
function parseFront(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  if (meta.tags) {
    meta.tags = meta.tags.replace(/[\[\]"']/g, '').split(',').map((t) => t.trim()).filter(Boolean);
  } else {
    meta.tags = [];
  }
  return meta;
}

function sh(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ---------- 1. 扫描文章 ----------
console.log('== 扫描 blog/posts/*.md ==');
if (!fs.existsSync(POSTS_DIR)) {
  console.log('[错误] 目录不存在：' + POSTS_DIR);
  process.exit(1);
}
const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
if (!files.length) console.log('[提示] posts 目录里还没有 .md 文件');

const posts = [];
for (const f of files) {
  const slug = f.replace(/\.md$/, '');
  const md = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
  const meta = parseFront(md);
  if (!meta) {
    console.log('  [跳过] ' + f + '（缺少 --- 开头的元信息）');
    continue;
  }
  posts.push({
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    summary: meta.summary || '',
    tags: meta.tags || [],
  });
  if (!meta.date) console.log('  [警告] ' + f + ' 缺少 date（上传时间）');
}

// ---------- 2. 生成 posts.json ----------
fs.writeFileSync(INDEX_FILE, JSON.stringify(posts, null, 2) + '\n');
console.log('\n已生成 posts.json，共 ' + posts.length + ' 篇：');
posts.forEach((p) => console.log('  - [' + (p.date || '无日期') + '] ' + p.title + (p.tags.length ? '（' + p.tags.join(', ') + '）' : '')));

// ---------- 3. git 提交推送 ----------
console.log('\n== 提交并推送 ==');
let changed = '';
try { changed = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }); } catch (e) {}
if (!changed.trim()) {
  console.log('没有改动，无需提交。');
  console.log('完成。');
  process.exit(0);
}
sh('git add -A');
const today = new Date().toISOString().slice(0, 10);
try { sh('git commit -m "update notes ' + today + '"'); }
catch (e) { console.log('提交时出现问题（可能已提交过）：' + e.message); }

console.log('开始推送（网络不稳会自动重试）...');
let pushed = false;
for (let i = 1; i <= 5; i++) {
  try { sh('git push origin main'); pushed = true; break; }
  catch (e) { console.log('  第 ' + i + ' 次推送失败，重试...'); }
}
if (pushed) {
  console.log('\n完成！约 1-2 分钟后访问 https://955827.xyz/blog 查看。');
} else {
  console.log('\n[失败] 推送 5 次都没成功，请检查网络后再双击一次。');
}
