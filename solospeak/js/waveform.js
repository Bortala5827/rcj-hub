// waveform.js — 波形可视化（共享模块，无状态）
// SoloSpeak / LetOut 复用：仅配色 / 振幅差异，逻辑同一套。

// 静态波形（含播放进度）。peaks: number[] 0..1
export function renderWave(canvas, peaks, opts = {}) {
  const {
    progress = 0,
    playedColor = '#b07a5b',
    restColor = '#d8cfc4',
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

// 实时波形：直接吃 AnalyserNode，返回 stop()
export function mountLive(canvas, analyser, opts = {}) {
  const { color = '#b07a5b' } = opts;
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

// 适配 DPR，避免模糊
export function fitCanvas(canvas, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round((cssHeight || 72) * dpr);
  canvas.style.width = '100%';
  canvas.style.height = (cssHeight || 72) + 'px';
}
