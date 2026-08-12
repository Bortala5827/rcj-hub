// rcj-audio-core / waveform.js
// Speak Series 统一复用 · 波形可视化模块
// ES Module — 无外部依赖，纯 Canvas + Web Audio API
//
// 三种模式：
//   1. renderWave()     — 静态柱状波形（录音回放）
//   2. mountLiveBars()  — 实时频谱柱状图 ⭐（截图里的声纹波动）
//   3. mountLiveWave()  — 实时波形线（经典示波器）
//
// mountLiveBars 着色/动效（全部可选、向后兼容）：
//   v2:  color     单色（默认 #6f9b8a）
//        colorFn   (v,i,n)=>cssColor  按每根柱的值/位置着色
//        gradient  [c1,c2]            跨整片场由 c1→c2 渐变
//        wobble    0..1               随机高度抖动（急躁/颤抖感）
//        pulse     0..1               整体呼吸律动（唱歌/呼吸感）
//   v3:  onLevel   (level)=>void      每帧回传平滑后的整体音量 0..1
//                                     （用于驱动页面环境光 / CSS 变量）
//        bloom     0..1               柱体廉价外发光（声音越大越烫）
//        floorGlow cssHex             底部地面光晕，强度随音量
//        levelFps  number             onLevel 回调频率上限（默认 15）

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
    colorFn = null,            // (v, i, n) => cssColor，优先于 color / gradient
    gradient = null,           // [c1, c2] 跨场渐变
    barGap = 1.5,
    smoothing = 0.7,
    minBarHeight = 2,
    alpha = 0.85,             // 整体透明度
    capAlpha = 0.4,           // 峰值帽透明度
    capDecay = 0.96,          // 峰值衰减速度
    borderRadius = 2,         // 柱顶圆角
    wobble = 0,               // 0..1 随机高度抖动（急躁/颤抖）
    pulse = 0,                // 0..1 整体呼吸律动
    // v3
    onLevel = null,           // (level 0..1) => void，每帧平滑音量
    bloom = 0,                // 0..1 柱体外发光强度
    floorGlow = null,         // cssHex 底部地面光晕色
    levelFps = 15,            // onLevel 回调频率上限
  } = opts;

  const ctx = canvas.getContext('2d');
  // 用频率数据（不是时域）
  const freqCount = analyser.frequencyBinCount;
  const data = new Uint8Array(freqCount);
  analyser.smoothingTimeConstant = smoothing;

  let raf;
  let caps = new Float32Array(freqCount); // 峰值跟踪
  let level = 0;                          // 平滑后的整体音量 0..1
  let lastEmit = 0;
  let lastSent = -1;
  const emitGap = 1000 / Math.max(1, levelFps);

  const draw = () => {
    analyser.getByteFrequencyData(data);
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 只取低频部分（人声 + 音乐主体，高频通常太稀疏不好看）
    const visibleBins = Math.floor(freqCount * 0.45);
    const step = Math.max(1, Math.floor(visibleBins / 64)); // 屏幕上最多 ~64 根柱
    const barW = Math.max(2, (w / (visibleBins / step)) - barGap);

    // 整体呼吸律动
    const beat = pulse ? (1 + pulse * 0.35 * Math.sin(Date.now() / 170)) : 1;

    // 先算本帧原始平均音量（不含 wobble/pulse 修饰，代表真实说话强度）
    let sum = 0, cnt = 0;
    for (let i = 0; i < visibleBins; i += step) { sum += data[i]; cnt++; }
    const raw = cnt ? Math.min(1, (sum / cnt) / 190) : 0;   // 190 而非 255：人声实际很难打满
    level = level * 0.78 + raw * 0.22;                      // 时间平滑，避免闪烁

    // 底部地面光（先画，柱体压在上面）
    if (floorGlow && level > 0.02) {
      const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
      g.addColorStop(0, hexToRgba(floorGlow, Math.min(0.42, level * 0.55)));
      g.addColorStop(1, hexToRgba(floorGlow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
    }

    for (let i = 0; i < visibleBins; i += step) {
      let v = data[i] / 255;                       // 0..1
      if (pulse) v = v * beat;
      if (wobble) v = v * (1 + wobble * (Math.random() - 0.5));
      v = Math.max(0, Math.min(1, v));

      const barH = Math.max(minBarHeight, v * h * 0.9);
      const x = (i / visibleBins) * w + barGap / 2;

      // 更新峰值帽
      if (v * h > caps[i]) caps[i] = v * h;
      else caps[i] *= capDecay;

      // 取色：colorFn > gradient > color
      let col = color;
      if (colorFn) col = colorFn(v, i, visibleBins);
      else if (gradient) col = lerpHex(gradient[0], gradient[1], i / visibleBins);

      // 廉价外发光：同色放大一圈低透明再画一次（比 shadowBlur 快得多）
      if (bloom > 0 && v > 0.1) {
        ctx.globalAlpha = alpha * bloom * 0.3 * Math.min(1, v * 1.6);
        ctx.fillStyle = col;
        const pad = 2 + bloom * 3;
        roundRect(ctx, x - pad, h - barH - pad, barW + pad * 2, barH + pad,
          { tl: borderRadius + pad, tr: borderRadius + pad, br: 0, bl: 0 });
        ctx.fill();
      }

      // 画柱体（带圆角）
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      roundRect(ctx, x, h - barH, barW, barH, { tl: borderRadius, tr: borderRadius, br: 0, bl: 0 });
      ctx.fill();

      // 画峰值帽（更短更淡的顶部标记）
      if (caps[i] > minBarHeight + 1) {
        ctx.globalAlpha = capAlpha;
        ctx.fillStyle = col;
        ctx.fillRect(x, h - caps[i], barW, 1.5);
      }
    }

    ctx.globalAlpha = 1;

    // 回传音量给页面（限频 + 变化阈值，避免高频触发样式重算）
    if (onLevel) {
      const now = Date.now();
      if (now - lastEmit >= emitGap) {
        const q = Math.round(level * 100) / 100;
        if (q !== lastSent) { onLevel(q); lastSent = q; }
        lastEmit = now;
      }
    }

    raf = requestAnimationFrame(draw);
  };

  raf = requestAnimationFrame(draw);

  // 返回停止函数
  return () => {
    cancelAnimationFrame(raf);
    if (onLevel) onLevel(0);   // 停录时让环境光归零
  };
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

// 两个 #rrggbb 颜色按比例 t(0..1) 插值
export function lerpHex(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = hexToRgb(a), pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// #rrggbb + alpha → rgba()
export function hexToRgba(h, a) {
  const p = hexToRgb(h);
  if (!p) return h;
  return `rgba(${p[0]},${p[1]},${p[2]},${Math.max(0, Math.min(1, a))})`;
}

function hexToRgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

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
