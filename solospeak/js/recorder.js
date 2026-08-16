// recorder.js — Speak Series 统一复用 · 录音引擎（MediaRecorder 生命周期）
// 产出：{ blob, durationMs, peaks, level }
// 不自动上传、不留存服务器；本地优先。
// canonical 版本（rcj-audio-core）：fftSize=2048 + 实时 onLevel + 回传 level
// + 录音结束自动去首尾静音（RMS 能量检测，零外部依赖，转 WAV 同源播放）。

const TARGET_POINTS = 320;           // 峰值数组长度（见各项目 SPEC §4）
const HIGH_THRESHOLD = 0.58;         // 橙色高音量阈值（0..1，时域最大振幅）
const TRIM_THRESHOLD = 0.012;        // 静音 RMS 阈值（归一化振幅）
const TRIM_PAD_MS = 200;             // 静音段前后保留的缓冲
const TRIM_MIN_MS = 400;             // 裁后最短时长，低于则保留原音

export class Recorder {
  constructor() {
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this._frames = [];      // 每帧最大振幅 0..1
    this._raf = null;
    this.startTime = 0;
    this._chunks = [];
    this._resolveStop = null;
    this.onLevel = null;     // (max:0..1) => void  实时音量回调（UI 画音量条用）
    this._maxLevel = 0;     // 本次录音最高振幅
    this._highTriggered = false; // 是否出现过橙色高音量
    this.trim = true;        // 是否自动去首尾静音（外部可置 false 关闭）
  }

  get isRecording() { return !!this.mediaRecorder && this.mediaRecorder.state === 'recording'; }

  async start(externalStream = null) {
    // 支持外部传入 MediaStream（例如 wavesurfer 已打开的麦克风流），避免重复请求权限
    this.stream = externalStream || (await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    }));
    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AC();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    this._frames = [];
    this._chunks = [];
    this._maxLevel = 0;
    this._highTriggered = false;
    const mime = pickMime();
    this.mediaRecorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) this._chunks.push(e.data); };
    this.mediaRecorder.onstop = () => { if (this._resolveStop) this._resolveStop(this._finalize()); };

    this.startTime = performance.now();
    this._collectLoop();
    this.mediaRecorder.start(200);
    // 立即返回，录音进行中；结果由 stop() 的 Promise 给出
  }

  _collectLoop() {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.isRecording) return;
      this.analyser.getByteTimeDomainData(data);
      let max = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > max) max = v;
      }
      this._frames.push(max);
      if (max > this._maxLevel) this._maxLevel = max;
      if (max >= HIGH_THRESHOLD) this._highTriggered = true;
      if (this.onLevel) this.onLevel(max);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (!this.isRecording) return Promise.resolve(null);
    return new Promise((resolve) => {
      this._resolveStop = (res) => resolve(res);
      this.mediaRecorder.stop();
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this.audioCtx) this.audioCtx.close().catch(() => {});
      this.stream.getTracks().forEach((t) => t.stop());
    });
  }

  async _finalize() {
    let blob = new Blob(this._chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
    let durationMs = Math.max(0, Math.round(performance.now() - this.startTime));
    let peaks = downsample(this._frames, TARGET_POINTS);
    const highCount = this._frames.filter((f) => f >= HIGH_THRESHOLD).length;
    const level = {
      max: Math.max(0, this._maxLevel),
      highRatio: this._frames.length ? highCount / this._frames.length : 0,
      highTriggered: this._highTriggered,
    };

    // 自动去首尾静音（RMS 能量检测，失败则保留原音）
    if (this.trim) {
      try {
        const t = await trimSilence(blob, { threshold: TRIM_THRESHOLD, padMs: TRIM_PAD_MS, minMs: TRIM_MIN_MS });
        if (t) { blob = t.blob; durationMs = t.durationMs; peaks = t.peaks; }
      } catch (e) { /* 保留原音 */ }
    }

    this.analyser = null; this.stream = null; this.mediaRecorder = null;
    return { blob, durationMs, peaks, level };
  }
}

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function downsample(frames, target) {
  if (!frames.length) return new Array(target).fill(0.02);
  if (frames.length <= target) {
    const out = frames.slice();
    while (out.length < target) out.push(frames[frames.length - 1] || 0.02);
    return out;
  }
  const out = [];
  const bucket = frames.length / target;
  for (let i = 0; i < target; i++) {
    const s = Math.floor(i * bucket), e = Math.floor((i + 1) * bucket);
    let m = 0;
    for (let j = s; j < e; j++) m = Math.max(m, frames[j]);
    out.push(m);
  }
  return out;
}

// 基于 RMS 能量检测首尾静音并裁掉，转 WAV 同源播放（零外部依赖）
async function trimSilence(blob, { threshold = 0.012, padMs = 200, minMs = 400 } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    const arr = await blob.arrayBuffer();
    const buf = await ac.decodeAudioData(arr);
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const n = ch.length;
    if (n === 0) return null;
    const win = Math.max(1, Math.floor(sr * 0.02)); // 20ms 窗口
    const rmsAt = (i) => {
      const e = Math.min(i + win, n);
      let s = 0;
      for (let j = i; j < e; j++) s += ch[j] * ch[j];
      return Math.sqrt(s / (e - i || 1));
    };
    let start = -1;
    for (let i = 0; i < n; i += win) { if (rmsAt(i) > threshold) { start = i; break; } }
    if (start < 0) return null; // 全程静音，保留原音
    let end = -1;
    for (let i = n - win; i >= 0; i -= win) { if (rmsAt(i) > threshold) { end = i + win; break; } }
    if (end <= start) return null;
    const sPad = Math.max(0, start - Math.floor(sr * padMs / 1000));
    const ePad = Math.min(n, end + Math.floor(sr * padMs / 1000));
    const len = ePad - sPad;
    if ((len / sr) * 1000 < minMs) return null; // 裁后太短，保留原音
    const sub = ch.subarray(sPad, ePad);
    const newBuf = ac.createBuffer(1, len, sr);
    newBuf.copyToChannel(sub, 0);
    return {
      blob: encodeWAV(newBuf),
      durationMs: Math.round((len / sr) * 1000),
      peaks: computePeaksFromBuffer(newBuf, TARGET_POINTS),
    };
  } finally {
    ac.close().catch(() => {});
  }
}

// 从 AudioBuffer 重新计算 0..1 峰值数组（与实时 downsample 同格式：每桶最大绝对值）
function computePeaksFromBuffer(buf, target) {
  const ch = buf.getChannelData(0);
  const n = ch.length;
  if (!n) return new Array(target).fill(0.02);
  if (n <= target) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.abs(ch[i]));
    while (out.length < target) out.push(out[out.length - 1] || 0.02);
    return out;
  }
  const out = [];
  const bucket = n / target;
  for (let i = 0; i < target; i++) {
    const s = Math.floor(i * bucket), e = Math.floor((i + 1) * bucket);
    let m = 0;
    for (let j = s; j < e; j++) m = Math.max(m, Math.abs(ch[j]));
    out.push(m);
  }
  return out;
}

// AudioBuffer -> WAV Blob（16-bit PCM，单声道），浏览器原生可播放，无需任何外部库
function encodeWAV(buf) {
  const ch = buf.getChannelData(0);
  const len = ch.length;
  const sr = buf.sampleRate;
  const ab = new ArrayBuffer(44 + len * 2);
  const view = new DataView(ab);
  const ws = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    let s = Math.max(-1, Math.min(1, ch[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}
