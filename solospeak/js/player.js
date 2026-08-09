// player.js — 回放 + 声音日志浏览
// 画静态波形（带播放进度），HTMLAudioElement 驱动进度。

import { renderWave, fitCanvas } from './waveform.js';

function fmt(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

// 在 container 内挂载一个播放器，返回 { destroy }
export function mountPlayer(container, recording) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'wave-canvas';
  const bar = document.createElement('div');
  bar.className = 'player-bar';
  const playBtn = document.createElement('button');
  playBtn.className = 'play-btn';
  playBtn.textContent = '▶';
  const time = document.createElement('span');
  time.className = 'player-time';
  time.textContent = '0:00 / ' + fmt(recording.durationMs);
  bar.append(playBtn, time);
  container.append(canvas, bar);

  fitCanvas(canvas, 64);
  renderWave(canvas, recording.peaks, { progress: 0 });

  const audio = new Audio(URL.createObjectURL(recording.audioBlob));
  let playing = false;
  const redraw = (p) => renderWave(canvas, recording.peaks, { progress: p });

  playBtn.onclick = () => { playing ? audio.pause() : audio.play(); };
  audio.onplay = () => { playing = true; playBtn.textContent = '⏸'; };
  audio.onpause = () => { playing = false; playBtn.textContent = '▶'; };
  audio.onended = () => { playing = false; playBtn.textContent = '▶'; redraw(1); };
  audio.ontimeupdate = () => {
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    time.textContent = fmt(audio.currentTime * 1000) + ' / ' + fmt(recording.durationMs);
    redraw(p);
  };

  return {
    destroy() {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    },
  };
}
