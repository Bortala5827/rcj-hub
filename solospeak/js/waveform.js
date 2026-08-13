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
//   v4:  感知升级（默认开，纯算法、无需下载）：
//        logScale  bool(默认true)     对数频率映射：人声/低频占更多柱，不再糊成一团
//        aWeight   bool(默认true)     A 计权(IEC 61672)：按人耳感知重塑频谱
//        bands     [fMin,fMax]Hz      显示频率范围（默认 [30,8000]）
//        bars      number             屏幕柱数（默认 64）
//        onBands   (bass,mid,tre)=>   各频段能量 0..1（低频/中频人声/高频）
//                                      低频→地面光，中频→环境光呼吸，高频→可接粒子闪
//   v5:  视觉冲击（默认关，播放器手动开）：
//        mirror    bool(默认false)     镜像反射：柱子从中心轴向上下对称展开
//                                      （专业音频可视化标志语言：iTunes/Spotify/Audiom）
//        centerGlow cssHex             中心轴辉光线（随音量呼吸，仅 mirror 模式生效）
//        radialBg  [center,edge]       径向背景渐变（从中心向外扩散，强度随音量脉动）

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
    headColor = null,        // 播放头颜色（拖动定位 / 进度同步），null 不画
    headWidth = 2,
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

  // 播放头：竖直亮线 + 顶部小圆点（拖动定位 / 播放进度同步）
  if (headColor) {
    const hx = Math.max(0, Math.min(w, (split / n) * w));
    ctx.globalAlpha = 1;
    ctx.fillStyle = headColor;
    ctx.fillRect(hx - headWidth / 2, 0, headWidth, h);
    ctx.beginPath();
    ctx.arc(hx, headWidth + 2, headWidth + 1, 0, Math.PI * 2);
    ctx.fill();
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
    // v4 — 感知升级（默认开，纯算法）
    logScale = true,          // 对数频率映射：人声/低频占更多柱
    aWeight = true,           // A 计权(IEC 61672)：按人耳感知重塑频谱
    bands = [50, 8000],       // 显示频率范围 [Hz]
    bars = 64,                // 屏幕柱数
    onBands = null,           // (bass,mid,treble)=>void 各频段能量 0..1
    // v5 — 视觉冲击（播放器手动开）
    mirror = false,            // 镜像反射：柱子从中心轴向上下对称展开
    centerGlow = null,         // 中心轴辉光线（随音量呼吸，仅 mirror）
    radialBg = null,           // 径向背景渐变 [centerHex, edgeHex]
    // v6 — 情绪性格化（P0-3）：用「形状」区分情绪，不只靠颜色
    barWidthRatio = 1,       // 柱宽倍率（>1 粗壮有冲击，<1 纤细精致）
    capStyle = 'soft',       // 'soft' 圆润帽 | 'hard' 实心尖顶（锯齿/爆发感）
    wobbleKind = 'random',   // 'random' 抖动 | 'sine' 缓慢正弦摇摆（呼吸感）
    mirrorAsym = 0,          // 0..1 镜像上下不对称（>0 上半更高=更躁动）
  } = opts;

  const ctx = canvas.getContext('2d');
  analyser.smoothingTimeConstant = smoothing;
  const freqCount = analyser.frequencyBinCount;
  const data = new Uint8Array(freqCount);

  // ── 预计算（仅一次）：采样率、A 计权曲线、频段 bin 边界 ──
  const sampleRate = (analyser.context && analyser.context.sampleRate) || 44100;
  const fftSize = analyser.fftSize || (freqCount * 2);
  const binToFreq = (b) => (b * sampleRate) / fftSize;

  // IEC 61672 A 计权（dB）→ 归一化为 0..1 乘子（重塑频谱以贴合人耳）
  const aWeightDb = (f) => {
    const f2 = f * f, f4 = f2 * f2;
    const num = 12200 * 12200 * f2 * f4;
    const den = (f2 + 424.36) * Math.sqrt((f2 + 11592.09) * (f2 + 544332.84)) * (f2 + 148840000);
    return 2.0 + 20 * Math.log10(num / den);
  };
  let awMax = -Infinity;
  for (let f = bands[0]; f <= bands[1]; f *= 1.005) awMax = Math.max(awMax, aWeightDb(f));
  const awBin = new Float32Array(freqCount);
  for (let b = 0; b < freqCount; b++) {
    awBin[b] = aWeight ? Math.pow(10, (aWeightDb(binToFreq(b)) - awMax) / 20) : 1;
  }

  // 每根显示柱覆盖的 bin 范围：logScale→对数（人声/低频占更多柱），否则线性均分
  const N = Math.max(16, Math.min(120, bars | 0));
  const binRanges = [];
  if (logScale) {
    const edges = new Float32Array(N + 1);
    for (let k = 0; k <= N; k++) edges[k] = bands[0] * Math.pow(bands[1] / bands[0], k / N);
    for (let k = 0; k < N; k++) {
      const s = Math.max(1, Math.round((edges[k] * fftSize) / sampleRate));
      const e = Math.max(s, Math.round((edges[k + 1] * fftSize) / sampleRate));
      binRanges.push([s, Math.min(freqCount - 1, e)]);
    }
  } else {
    const span = freqCount - 2;
    for (let k = 0; k < N; k++) {
      const s = 1 + Math.floor((span * k) / N);
      const e = Math.max(s, 1 + Math.floor((span * (k + 1)) / N) - 1);
      binRanges.push([s, Math.min(freqCount - 1, e)]);
    }
  }
  // 防御：每根柱至少覆盖 1 个 bin（避免极低频段塌成 0 宽 → 死柱）
  for (let k = 0; k < N; k++) {
    if (binRanges[k][1] < binRanges[k][0] + 1) binRanges[k][1] = binRanges[k][0] + 1;
  }
  // 统计各频段柱数（子带归一用）
  let bassBars = 0, midBars = 0, treBars = 0;
  for (let k = 0; k < N; k++) {
    const fc = binToFreq((binRanges[k][0] + binRanges[k][1]) / 2);
    if (fc < 250) bassBars++; else if (fc < 2000) midBars++; else treBars++;
  }

  let raf;
  let caps = new Float32Array(N); // 峰值跟踪
  let level = 0;                  // 平滑后的整体音量 0..1（以中频人声为准）
  let lastEmit = 0;
  let lastSent = -1;
  const emitGap = 1000 / Math.max(1, levelFps);

  const draw = () => {
    analyser.getByteFrequencyData(data);
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const beat = pulse ? (1 + pulse * 0.35 * Math.sin(Date.now() / 170)) : 1;

    // ── 逐柱聚合：对数频段 + A 计权（peak 偏置，更有冲击力）──
    const vals = new Float32Array(N);
    let bassSum = 0, midSum = 0, treSum = 0;
    for (let k = 0; k < N; k++) {
      const [s, e] = binRanges[k];
      let peak = 0, acc = 0, n = 0;
      for (let b = s; b <= e; b++) {
        const val = data[b] * awBin[b];
        if (val > peak) peak = val;
        acc += val; n++;
      }
      const v = (peak * 0.7 + (acc / Math.max(1, n)) * 0.3) / 255;
      vals[k] = v;
      const fc = binToFreq((s + e) / 2);
      if (fc < 250) bassSum += v; else if (fc < 2000) midSum += v; else treSum += v;
    }
    // 子带能量 0..1（按柱数归一 + 轻放大让小声也可见）
    const bassLevel = bassBars ? Math.min(1, (bassSum / bassBars) * 1.35) : 0;
    const midLevel  = midBars  ? Math.min(1, (midSum / midBars) * 1.15) : 0;
    const treLevel  = treBars  ? Math.min(1, (treSum / treBars) * 1.6) : 0;

    // 整体音量以「人声主体 mid」为准 → 环境光呼吸更贴说话强度
    const raw = Math.min(1, midLevel);
    level = level * 0.78 + raw * 0.22;

    // ── 径向背景（mirror 模式：从中心向外扩散的呼吸光晕）──
    if (radialBg && level > 0.02) {
      const cx = w / 2, cy = h / 2;
      const r = Math.max(w, h) * 0.65;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const bgA = Math.min(0.18, level * 0.28);
      rg.addColorStop(0, hexToRgba(radialBg[0], bgA));
      rg.addColorStop(0.6, hexToRgba(radialBg[1], bgA * 0.35));
      rg.addColorStop(1, hexToRgba(radialBg[1], 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    // 底部地面光（非 mirror 模式：由低频驱动；mirror 模式跳过，用径向背景替代）
    if (!mirror && floorGlow && bassLevel > 0.02) {
      const g = ctx.createLinearGradient(0, h, 0, h * 0.45);
      g.addColorStop(0, hexToRgba(floorGlow, Math.min(0.42, bassLevel * 0.55)));
      g.addColorStop(1, hexToRgba(floorGlow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
    }

    const slot = w / N;
    const barW = Math.max(1.5, Math.min(slot * 1.06, slot * barWidthRatio - barGap));
    // mirror 模式：每根柱可用高度 = 半屏（从中心到边缘）
    const maxH = mirror ? h * 0.46 : h * 0.9;
    const baseY = mirror ? h / 2 : h;   // 柱子起点：mirror=中心线，非mirror=底部

    for (let k = 0; k < N; k++) {
      let v = vals[k];
      if (pulse) v = v * beat;
      if (wobble) {
        if (wobbleKind === 'sine') v = v * (1 + wobble * 0.5 * Math.sin(Date.now() / 620 + k * 0.35));
        else v = v * (1 + wobble * (Math.random() - 0.5));
      }
      v = Math.max(0, Math.min(1, v));

      const barH = Math.max(minBarHeight, v * maxH);
      const x = k * slot + barGap / 2;

      // 更新峰值帽
      if (v * maxH > caps[k]) caps[k] = v * maxH;
      else caps[k] *= capDecay;

      // 取色：colorFn > gradient > color
      let col = color;
      if (colorFn) col = colorFn(v, k, N);
      else if (gradient) col = lerpHex(gradient[0], gradient[1], k / N);

      // ── 画柱体（mirror：上下对称；非mirror：从底部向上）──
      const drawBar = (y, ht, rTop, rBot) => {
        if (bloom > 0 && v > 0.08) {
          ctx.globalAlpha = alpha * bloom * 0.35 * Math.min(1, v * 1.8);
          ctx.fillStyle = col;
          const pad = 2 + bloom * 3.5;
          roundRect(ctx, x - pad, y - pad, barW + pad * 2, ht + pad * 2,
            { tl: rTop + pad, tr: rTop + pad, br: rBot + pad, bl: rBot + pad });
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        roundRect(ctx, x, y, barW, ht, { tl: rTop, tr: rTop, br: rBot, bl: rBot });
        ctx.fill();
      };

      if (mirror) {
        const asym = mirrorAsym || 0;
        const topH = barH * (1 + asym * 0.5);
        const botH = barH * (1 - asym * 0.5);
        drawBar(baseY - topH, topH, borderRadius, 0);       // 上半（asym>0 更高）
        drawBar(baseY, botH * 0.92, 0, borderRadius);       // 下半（略短营造透视）
      } else {
        drawBar(baseY - barH, barH, borderRadius, 0);        // 原始：从底向上
      }

      // 峰值帽：'hard' 实心尖顶（情绪爆发/锯齿感），'soft' 细线帽（圆润）
      if (caps[k] > minBarHeight + 1) {
        ctx.globalAlpha = capAlpha;
        ctx.fillStyle = col;
        if (capStyle === 'hard') {
          const ch = Math.max(2, minBarHeight + 1.5);
          if (mirror) {
            ctx.fillRect(x, baseY - caps[k] - ch, barW, ch);
            ctx.fillRect(x, baseY + caps[k], barW, ch);
          } else {
            ctx.fillRect(x, baseY - caps[k] - ch, barW, ch);
          }
        } else if (mirror) {
          ctx.fillRect(x, baseY - caps[k], barW, 1.2);     // 上半顶端
        } else {
          ctx.fillRect(x, baseY - caps[k], barW, 1.5);
        }
      }
    }

    ctx.globalAlpha = 1;

    // ── 中心轴辉光线（仅 mirror 模式：随音量呼吸的亮线）──
    if (mirror && centerGlow && level > 0.03) {
      const lineA = Math.min(0.7, level * 0.9 + 0.15);
      const lineW = Math.max(1, 1.5 + level * 2.5);
      ctx.globalAlpha = lineA;
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, h / 2 - lineW / 2, w, lineW);
      // 辉光扩散（上下各一层更淡的）
      ctx.globalAlpha = lineA * 0.25;
      ctx.fillRect(0, h / 2 - lineW * 3, w, lineW * 1.5);
      ctx.fillRect(0, h / 2 + lineW * 1.5, w, lineW * 1.5);
      ctx.globalAlpha = 1;
    }

    // 回传音量给页面（限频 + 变化阈值，避免高频触发样式重算）
    if (onLevel) {
      const now = Date.now();
      if (now - lastEmit >= emitGap) {
        const q = Math.round(level * 100) / 100;
        if (q !== lastSent) { onLevel(q); lastSent = q; }
        lastEmit = now;
      }
    }
    if (onBands) onBands(bassLevel, midLevel, treLevel);

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
