// rcj-audio-core / waveform.js
// Speak Series 统一复用 · 波形可视化模块
// ES Module — 无外部依赖，纯 Canvas + Web Audio API
//
// 三种模式：
//   1. renderWave()     — 静态柱状波形（录音回放）
//   2. mountLiveBars()  — 实时频谱柱状图 ⭐（截图里的声纹波动）
//   3. mountLiveWave()  — 实时波形线（经典示波器）

// ─── 1. 静态波形（回放用） ─────────────────────────────
// peaks: number[] 振幅 0..1
export function renderWave(canvas, peaks, opts = {}) {
  const {
    progress = 0,
    playedColor = '#6f7d5a',
    restColor = '#d8d4c8',
    bg = 'transparent',
    mirror = true,
    minBar = 0.02,
  } = opts;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  if (!peaks || !peaks.length) return;
  const mid = h / 2;
  const n = peaks.length;
  const bw = w / n;
  const split = Math.max(0, Math.min(n, Math.floor(progress * n)));
  for (let i = 0; i < n; i++) {
    const v = Math.max(minBar, Math.min(1, peaks[i]));
    const bh = v * (h / 2) * 0.92;
    const x = i * bw;
    ctx.fillStyle = i < split ? playedColor : restColor;
    if (mirror) ctx.fillRect(x, mid - bh, Math.max(1, bw - 0.4), bh * 2);
    else ctx.fillRect(x, h - bh, Math.max(1, bw - 0.4), bh);
  }
}

// ─── 2. 实时频谱柱状图 ⭐（截图里的声纹波动） ──────────
// 频率域 → 竖直柱状，像音乐播放器那种
export function mountLiveBars(canvas, analyser, opts = {}) {
  const {
    color = '#6f9b8a',        // 苔绿（SoloSpeak 默认）
    barGap = 1.5,
    smoothing = 0.7,
    minBarHeight = 2,
    alpha = 0.85,            // 整体透明度
    capAlpha = 0.4,          // 峰值帽透明度
    capDecay = 0.96,         // 峰值衰减速度
    borderRadius = 2,        // 柱顶圆角
  } = opts;

  const ctx = canvas.getContext('2d');
  // 用频率数据（不是时域）
  const freqCount = analyser.frequencyBinCount;
  const data = new Uint8Array(freqCount);
  analyser.smoothingTimeConstant = smoothing;

  let raf;
  let caps = new Float32Array(freqCount); // 峰值跟踪

  const draw = () => {
    analyser.getByteFrequencyData(data);
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 只取低频部分（人声 + 音乐主体，高频通常太稀疏不好看）
    // 取前 1/3 到 1/2 的频率 bins
    const visibleBins = Math.floor(freqCount * 0.45);
    const step = Math.max(1, Math.floor(visibleBins / 64)); // 屏幕上最多 ~64 根柱
    const barW = Math.max(2, (w / (visibleBins / step)) - barGap);

    for (let i = 0; i < visibleBins; i += step) {
      const v = data[i] / 255;           // 0..1
      const barH = Math.max(minBarHeight, v * h * 0.9);

      const x = (i / visibleBins) * w + barGap / 2;

      // 更新峰值帽
      if (v * h > caps[i]) caps[i] = v * h;
      else caps[i] *= capDecay;

      // 画柱体（带圆角）
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      roundRect(ctx, x, h - barH, barW, barH, { tl: borderRadius, tr: borderRadius, br: 0, bl: 0 });
      ctx.fill();

      // 画峰值帽（更短更淡的顶部标记）
      if (caps[i] > minBarHeight + 1) {
        ctx.globalAlpha = capAlpha;
        ctx.fillRect(x, h - caps[i], barW, 1.5);
      }
    }

    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  };

  raf = requestAnimationFrame(draw);

  // 返回停止函数
  return () => cancelAnimationFrame(raf);
}

// ─── 3. 实时波形线（经典示波器风格） ────────────────────
export function mountLiveWave(canvas, analyser, opts = {}) {
  const { color = '#6f7d5a' } = opts;
  const ctx = canvas.getContext('2d');
  const data = new Uint8Array(analyser.frequencyBinCount);
  let raf;
  const draw = () => {
    analyser.getByteTimeDomainData(data);
    const w = canvas.width, h = canvas.height, mid = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const slice = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128 - 1;
      const y = mid + v * mid * 0.9;
      const x = i * slice;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

// ─── 工具函数 ───────────────────────────────────────────

// 适配 DPR，避免模糊
export function fitCanvas(canvas, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round((cssHeight || 72) * dpr);
  canvas.style.width = '100%';
  canvas.style.height = (cssHeight || 72) + 'px';
}

// 圆角矩形辅助（Canvas 不原生支持圆角 fillRect）
function roundRect(ctx, x, y, w, h, r) {
  const maxR = Math.min(Math.abs(w), Math.abs(h)) / 2;
  const tr = Math.min(r.tr || 0, maxR);
  const br = Math.min(r.br || 0, maxR);
  const bl = Math.min(r.bl || 0, maxR);
  const tl = Math.min(r.tl || 0, maxR);
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}
