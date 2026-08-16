// rcj-interaction-assets / voice/voice-particles
// RCJ Voice Engine · 声纹驱动表情/粒子跳动（暖场用）
// ES Module — 无外部依赖。getUserMedia → AnalyserNode(RMS) → 表情实时蹦跳。
//
// 用法：
//   import { mountVoiceParticles } from './voice-particles.js';
//   mountVoiceParticles({ stageId:'vwarm-stage', btnId:'vwarm-btn', subId:'vwarm-sub',
//                         faces:['😀','😮','😎','🤩','😺'] });

export function mountVoiceParticles(opts = {}) {
  const {
    stage = document.getElementById(opts.stageId),
    btn = document.getElementById(opts.btnId),
    sub = document.getElementById(opts.subId),
    faces = ['😀', '😮', '😎', '🤩', '😺'],
    sensitivity = 3.4,     // 声纹→位移增益
    defaultSub = sub ? sub.textContent : '',
  } = opts;

  if (!stage) return () => {};
  // 注入表情节点（若 stage 为空）
  if (!stage.children.length && faces.length) {
    faces.forEach((e) => {
      const s = document.createElement('span');
      s.className = 'vw-face';
      s.setAttribute('data-face', '');
      s.textContent = e;
      stage.appendChild(s);
    });
  }
  const faceEls = stage.querySelectorAll('[data-face]');
  if (!faceEls.length) return () => {};

  let audioCtx, analyser, data, stream, raf, running = false;

  function rms() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / data.length);
  }

  function loop() {
    const norm = Math.min(1, rms() * sensitivity);
    const t = performance.now();
    faceEls.forEach((f, i) => {
      const phase = i * 0.55;
      const wob = Math.sin(t / 220 + phase);
      const dy = -norm * (24 + i * 3) * (0.6 + 0.4 * Math.abs(wob));
      const sc = 1 + norm * 0.45;
      const rot = norm * 14 * wob + (i % 2 ? 1 : -1) * norm * 7;
      f.style.transform = `translateY(${dy.toFixed(1)}px) scale(${sc.toFixed(2)}) rotate(${rot.toFixed(1)}deg)`;
    });
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (sub) sub.textContent = '当前浏览器不支持麦克风采集，用手机打开体验更佳 📱';
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      stream = s;
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      const src = audioCtx.createMediaStreamSource(s);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      running = true;
      if (btn) { btn.textContent = '🛑 停止'; btn.classList.add('on'); }
      if (sub) sub.textContent = '对着麦克风随便说几句，看表情跟着你的声纹蹦 🤸';
      loop();
    }).catch(() => {
      if (sub) sub.textContent = '麦克风权限被拒了，点「开始」再授权一次 🎤';
    });
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) audioCtx.close().catch(() => {});
    stream = audioCtx = analyser = data = null;
    faceEls.forEach((f) => { f.style.transform = ''; });
    if (btn) { btn.textContent = '🎤 开始声纹热身'; btn.classList.remove('on'); }
    if (sub) sub.textContent = defaultSub || '对着麦克风随便说几句 —— 看表情跟着声纹蹦。';
  }

  if (btn) btn.addEventListener('click', () => (running ? stop() : start()));
  return { start, stop, destroy: stop };
}
