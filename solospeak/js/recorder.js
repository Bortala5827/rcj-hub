// recorder.js — 录音引擎（MediaRecorder 生命周期）
// 产出：{ blob, durationMs, peaks, level }
// 不自动上传、不留存服务器；本地优先。

const TARGET_POINTS = 320; // 峰值数组长度（见 SPEC §4）
const HIGH_THRESHOLD = 0.58; // 橙色高音量阈值（0..1，时域最大振幅）

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
  }

  get isRecording() { return !!this.mediaRecorder && this.mediaRecorder.state === 'recording'; }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AC();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
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

  _finalize() {
    const blob = new Blob(this._chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
    const durationMs = Math.max(0, Math.round(performance.now() - this.startTime));
    const peaks = downsample(this._frames, TARGET_POINTS);
    const highCount = this._frames.filter((f) => f >= HIGH_THRESHOLD).length;
    const level = {
      max: Math.max(0, this._maxLevel),
      highRatio: this._frames.length ? highCount / this._frames.length : 0,
      highTriggered: this._highTriggered,
    };
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
