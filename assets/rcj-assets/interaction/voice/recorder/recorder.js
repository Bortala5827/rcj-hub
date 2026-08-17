/*
 * RCJ Voice Recorder — 统一录音组件（Google 风格 + 声纹球可视化）
 * ES Module · 零外部依赖 · 复用 rcj-audio-core/Recorder 引擎
 *
 * 用法：
 *   import { mountRecorder } from './recorder.js';
 *   const cleanup = mountRecorder(containerEl, {
 *     accent: '#e07850',          // 产品主色
 *     hint: '请开始说话',         // 提示文字
 *     hintRecording: '正在录音…',  // 录音中提示
 *     onResult: (result) => {},    // 录音完成回调 { blob, durationMs, peaks, level }
 *     onError: (msg) => {},       // 错误回调
 *   });
 *   // 停止：cleanup() 或内部点击按钮自动 toggle
 */

export function mountRecorder(root, opts = {}) {
  const {
    accent = '#ea4335',
    hint = '请开始说话',
    hintRecording = '正在录音…',
    onResult = null,
    onError = null,
    // Recorder 引擎（默认用同级 waveform.js 的，或外部注入）
    RecorderClass = null,
  } = opts;

  // ── 注入产品色 ──
  root.style.setProperty('--rcj-accent', accent);

  // ── 构建 DOM ──
  root.innerHTML = `
    <div class="rcj-recorder__stage">
      <span class="rcj-recorder__hint">${hint}</span>
      <button class="rcj-recorder__btn" aria-label="开始录音">
        <svg class="rcj-recorder__mic" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      </button>
    </div>
    <div class="rcj-recorder__orb"></div>
    <span class="rcj-recorder__timer">00:00</span>
  `;

  const btn = root.querySelector('.rcj-recorder__btn');
  const hintEl = root.querySelector('.rcj-recorder__hint');
  const orbEl = root.querySelector('.rcj-recorder__orb');
  const timerEl = root.querySelector('.rcj-recorder__timer');

  // ── 状态机 ──
  let state = 'idle';       // idle | starting | recording | stopping
  let recorder = null;
  let orbStop = null;       // 声纹球停止函数
  let recStartTs = 0;
  let timerRaf = null;

  // ── 声纹球（Voice Orb）── 替代柱状波形 ──
  function startOrb(analyser) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';

    // 中心圆核
    const core = document.createElementNS(svgNS, 'circle');
    core.setAttribute('cx', '80'); core.setAttribute('cy', '80');
    core.setAttribute('r', '18');
    core.setAttribute('fill', accent);
    core.style.transition = 'r .15s ease';

    // 同心波纹组（3 层）
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = document.createElementNS(svgNS, 'circle');
      r.setAttribute('cx', '80'); r.setAttribute('cy', '80');
      r.setAttribute('r', '24');
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', accent);
      r.setAttribute('stroke-width', '1.5');
      r.setAttribute('opacity', String(0.4 - i * 0.12));
      rings.push({ el: r, phase: i * 2.1, speed: 1.8 + i * 0.4 });
      svg.appendChild(r);
    }
    svg.appendChild(core);
    orbEl.appendChild(svg);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, (sum / data.length / 255) * 2.2); // 放大让反应更灵敏

      // 核心呼吸
      const coreR = 16 + level * 10;
      core.setAttribute('r', String(coreR));
      root.style.setProperty('--rcj-level', String(level));

      // 波纹扩散
      const t = Date.now() / 1000;
      rings.forEach(({ el, phase, speed }, i) => {
        const breathe = 24 + Math.sin(t * speed + phase) * (6 + level * 20);
        const pulse = 24 + level * (18 + i * 10);
        el.setAttribute('r', String(Math.max(22, breathe * 0.45 + pulse * 0.55)));
        el.setAttribute('opacity', String((0.35 - i * 0.1) * (0.4 + level * 0.6)));
        el.setAttribute('stroke-width', String(1 + level * 1.5));
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); orbEl.innerHTML = ''; };
  }

  // ── 计时器 ──
  function tick() {
    if (state !== 'recording') return;
    const s = Math.floor((Date.now() - recStartTs) / 1000);
    timerEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    timerRaf = setTimeout(tick, 500);
  }

  // ── 录音控制 ──
  async function startRec() {
    if (state !== 'idle') return;
    state = 'starting';
    try {
      // 动态导入 Recorder（支持从不同路径）
      const Rec = RecorderClass || (await import('../waveform/waveform.js')).Recorder || window.Recorder;
      recorder = new Rec();
      await recorder.start();
    } catch (e) {
      if (onError) onError('需要麦克风权限');
      state = 'idle'; recorder = null;
      return;
    }
    if (state === 'stopping') {
      await recorder.stop(); recorder = null; state = 'idle';
      return;
    }
    state = 'recording';
    root.classList.add('rcj-recorder--recording');
    hintEl.textContent = hintRecording;
    btn.setAttribute('aria-label', '停止录音');

    // 启动声纹球（替代柱状波形）
    if (recorder.analyser) orbStop = startOrb(recorder.analyser);

    recStartTs = Date.now();
    tick();
  }

  async function stopRec() {
    if (state === 'starting') { state = 'stopping'; return; }
    if (state !== 'recording') return;
    state = 'stopping';

    if (orbStop) { orbStop(); orbStop = null; }
    clearTimeout(timerRaf);
    root.classList.remove('rcj-recorder--recording');
    hintEl.textContent = hint;
    btn.setAttribute('aria-label', '开始录音');
    root.style.setProperty('--rcj-level', '0');

    const dur = Date.now() - recStartTs;
    const result = await recorder.stop();
    recorder = null;
    timerEl.textContent = '00:00';
    state = 'idle';

    if (dur < 500) { if (onError) onError('录音太短，请再说一会儿'); return; }
    if (!result || !result.blob || result.blob.size === 0) { if (onError) onError('没有录到声音'); return; }
    if (onResult) onResult(result);
  }

  btn.addEventListener('click', () => {
    if (state === 'recording' || state === 'starting') stopRec();
    else startRec();
  });

  // 返回清理函数
  return () => {
    if (orbStop) orbStop();
    clearTimeout(timerRaf);
    if (recorder && recorder.isRecording) recorder.stop().catch(() => {});
  };
}
