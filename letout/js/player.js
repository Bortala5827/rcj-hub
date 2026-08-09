// player.js — 回放（仅 keep=true 的音频；无音频则只画静默波形）
import { renderWave, fitCanvas } from './waveform.js';

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
