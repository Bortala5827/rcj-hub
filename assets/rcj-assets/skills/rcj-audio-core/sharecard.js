// sharecard.js — 情绪声波卡（P1-4）：录完生成可分享 PNG
// 设计原则：情绪配色 + 你的声波形状 + 情绪名 / 日期 / 时长；
//           【不带二维码】（用户判定对小红书引流无价值，只适合自己玩）。
// 移动端：渲染成 <img>，长按即可存到相册；桌面端：点「保存图片」下载 PNG。

function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function fmtDate(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function roundRect(ctx, x, y, w, h, r) {
  const maxR = Math.min(Math.abs(w), Math.abs(h)) / 2;
  r = Math.min(r, maxR);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexA(hex, a) {
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// 在指定区域画镜像声波（静电波形，用录音 peaks）
function drawWave(ctx, peaks, x, y, w, h, c1, c2) {
  const midY = y + h / 2;
  const n = peaks.length || 1;
  const slot = w / n;
  const barW = Math.max(2, slot * 0.66);
  const maxH = h * 0.46;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0.02, Math.min(1, peaks[i] || 0));
    const bh = Math.max(3, v * maxH);
    const bx = x + i * slot + (slot - barW) / 2;
    const g = ctx.createLinearGradient(0, midY - bh, 0, midY + bh);
    g.addColorStop(0, c2);
    g.addColorStop(0.5, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    const r = Math.min(barW / 2, 5);
    roundRect(ctx, bx, midY - bh, barW, bh, r); ctx.fill();       // 上半
    roundRect(ctx, bx, midY, barW, bh * 0.92, r); ctx.fill();    // 下半（略短）
  }
}

// 构建声波卡 canvas（1080×1350，3:4 竖版，适配小红书）
export function buildShareCardCanvas(release, emotion) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const c1 = (emotion.grad && emotion.grad[0]) || '#ffb27a';
  const c2 = (emotion.grad && emotion.grad[1]) || '#e23b1e';
  const glow = emotion.glow || '#ff6b35';

  // 背景
  ctx.fillStyle = '#17120f';
  ctx.fillRect(0, 0, W, H);
  // 顶部情绪辉光
  const rg = ctx.createRadialGradient(W / 2, 120, 0, W / 2, 120, W * 0.7);
  rg.addColorStop(0, hexA(glow, 0.22));
  rg.addColorStop(1, hexA(glow, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  // 内描边
  ctx.strokeStyle = hexA(glow, 0.35);
  ctx.lineWidth = 2;
  roundRect(ctx, 36, 36, W - 72, H - 72, 18); ctx.stroke();

  // 顶部：品牌 + 日期
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f6ece4';
  ctx.font = '700 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LetOut · 大声说', 72, 110);
  ctx.fillStyle = '#9b8375';
  ctx.font = '400 28px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(fmtDate(release.createdAt), W - 72, 110);

  // 情绪：emoji + 名称
  ctx.textAlign = 'center';
  ctx.font = '90px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle = '#f6ece4';
  ctx.fillText(emotion.emoji || '🔥', W / 2, 300);
  ctx.fillStyle = glow;
  ctx.font = '800 64px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(emotion.label || '释放', W / 2, 400);

  // 声波
  drawWave(ctx, release.peaks || [], 90, 520, W - 180, 360, c1, c2);

  // 时长 + 声纹
  ctx.fillStyle = '#f6ece4';
  ctx.font = '800 52px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(fmtDur(release.durationMs), W / 2, 1000);
  ctx.fillStyle = '#9b8375';
  ctx.font = '400 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText((release.voiceLabel ? ('「' + release.voiceLabel + '」') : '情绪声波') + ' · 一段被听见的释放', W / 2, 1052);

  // 底部 slogan
  ctx.fillStyle = '#b3a487';
  ctx.font = '500 30px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('开口，本身就是一种力量。', W / 2, H - 120);
  ctx.fillStyle = '#6b574c';
  ctx.font = '400 24px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('RCJ9527 · Speak Series', W / 2, H - 82);

  return cv;
}

export function downloadCanvasPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

// 弹出声波卡模态（移动端长按 <img> 存相册；桌面端「保存图片」下载）
export function openShareCard(release, emotion) {
  const canvas = buildShareCardCanvas(release, emotion);
  const url = canvas.toDataURL('image/png');

  const overlay = document.createElement('div');
  overlay.className = 'share-modal';

  const wrap = document.createElement('div');
  wrap.className = 'share-card-wrap';
  const img = document.createElement('img');
  img.className = 'share-img'; img.src = url; img.alt = '情绪声波卡';
  wrap.appendChild(img);

  const actions = document.createElement('div');
  actions.className = 'share-actions';
  const save = document.createElement('button');
  save.className = 'mini-btn share-save'; save.textContent = '保存图片';
  const close = document.createElement('button');
  close.className = 'mini-btn share-close'; close.textContent = '关闭';
  actions.append(save, close);

  const tip = document.createElement('p');
  tip.className = 'share-tip';
  tip.textContent = '手机端可长按图片保存到相册，再发到小红书';

  overlay.append(wrap, actions, tip);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  save.onclick = () => downloadCanvasPng(canvas, `letout-${emotion.label || 'release'}-${release.id || Date.now()}.png`);
  close.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}
