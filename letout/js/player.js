// player.js — 回放（仅 keep=true 的音频；无音频则只画静默波形）
import { renderWave, fitCanvas, mountLiveBars } from './waveform.js?v=20260812h';

function fmt(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

// 在 container 内挂载一个播放器，返回 { destroy }
export function mountPlayer(container, release, opts = {}) {
  container.innerHTML = '';
  const played = opts.played || '#c45c3e';
  const rest = opts.rest || '#ead5ce';

  const canvas = document.createElement('canvas');
  canvas.className = 'wave-canvas';
  container.append(canvas);
  fitCanvas(canvas, 56);
  renderWave(canvas, release.peaks || [], { progress: 0, playedColor: played, restColor: rest });

  if (!release.hasAudio || !release.audioBlob) {
    const note = document.createElement('div');
    note.className = 'player-note';
    note.textContent = '🌫 已阅后即焚，无音频留存';
    container.append(note);
    return { destroy() {} };
  }

  const bar = document.createElement('div');
  bar.className = 'player-bar';
  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.textContent = '▶';
  const time = document.createElement('span');
  time.className = 'player-time';
  time.textContent = '0:00 / ' + fmt(release.durationMs);
  bar.append(playBtn, time);
  container.append(bar);

  const audio = new Audio(URL.createObjectURL(release.audioBlob));
  let playing = false;
  const redraw = (p) => renderWave(canvas, release.peaks || [], { progress: p, playedColor: played, restColor: rest });

  playBtn.onclick = () => { playing ? audio.pause() : audio.play(); };
  audio.onplay = () => { playing = true; playBtn.textContent = '⏸'; };
  audio.onpause = () => { playing = false; playBtn.textContent = '▶'; };
  audio.onended = () => { playing = false; playBtn.textContent = '▶'; redraw(1); };
  audio.ontimeupdate = () => {
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    time.textContent = fmt(audio.currentTime * 1000) + ' / ' + fmt(release.durationMs);
    redraw(p);
  };

  return {
    destroy() {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    },
  };
}

// mountAudioPlayer — 资源库音频（manifest mp3）的「声波频动」播放器
// 用 Web Audio 分析跨域音频，挂载实时频谱柱；音量驱动页面环境光呼吸。
// Web Audio 不可用 / 跨域分析失败 → 自动退化成原生 <audio controls>。
// opts: { gradient:[c1,c2], glow:cssHex, onLevel:(v)=>void }
export function mountAudioPlayer(container, audioUrl, opts = {}) {
  container.innerHTML = '';
  const gradient = opts.gradient || ['#e07850', '#f3b089']; // LetOut 暖橙渐变
  const glow = opts.glow || '#e07850';
  const onLevel = opts.onLevel || null;

  const canvas = document.createElement('canvas');
  canvas.className = 'wave-canvas';
  container.append(canvas);

  const note = document.createElement('button');
  note.className = 'shadow-note';
  note.setAttribute('aria-label', '播放');
  note.textContent = '♪'; // 中央音符 = 播放键
  const time = document.createElement('span');
  time.className = 'player-time';
  time.textContent = '0:00';
  container.append(note, canvas, time);

  const audio = new Audio();
  audio.crossOrigin = 'anonymous'; // 跨域分析需 CORS（GitHub raw 已放行 *）
  audio.preload = 'none';
  audio.src = audioUrl;

  let ctx = null, analyser = null, stopWave = null, playing = false, fitted = false;

  const ensureGraph = () => {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null; analyser = null;
      return false;
    }
  };

  const startWave = () => {
    if (!analyser || stopWave) return;
    if (!fitted) { fitCanvas(canvas, 56); fitted = true; }
    stopWave = mountLiveBars(canvas, analyser, {
      gradient,
      bloom: 0.5,              // 紧凑模式：光效收敛
      pulse: 0.1,              // 轻呼吸
      smoothing: 0.72,
      alpha: 0.88,
      minBarHeight: 1,
      borderRadius: 2,
      mirror: true,
      centerGlow: '#ffb088',
      radialBg: ['#e07850', '#1a1410'],
      onLevel,
    });
  };

  const stopWaveFn = () => {
    if (stopWave) { stopWave(); stopWave = null; }
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
  };

  // 退化：原生控件（无 Web Audio / CORS 阻断加载时）
  const fallback = () => {
    container.innerHTML = '';
    const a = document.createElement('audio');
    a.src = audioUrl; a.controls = true; a.className = 'shadow-audio';
    container.append(a);
  };

  const toggle = async () => {
    if (playing) { audio.pause(); return; }
    if (!ensureGraph()) { fallback(); return; }
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
    try { await audio.play(); }
    catch (e) { fallback(); }
  };
  note.onclick = toggle;

  audio.onplay = () => { playing = true; note.setAttribute('data-playing', '1'); startWave(); };
  audio.onpause = () => { playing = false; note.removeAttribute('data-playing'); stopWaveFn(); };
  audio.onended = () => { playing = false; note.removeAttribute('data-playing'); stopWaveFn(); };
  audio.ontimeupdate = () => {
    const s = Math.floor(audio.currentTime);
    time.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  // CORS 阻断导致加载失败 → 退化原生控件（原生播放不受影响）
  audio.onerror = () => { if (!playing) fallback(); };

  return {
    destroy() {
      stopWaveFn();
      audio.pause();
      audio.src = '';
      if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
    },
  };
}
