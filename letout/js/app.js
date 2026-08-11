// app.js — LetOut 主逻辑（释放 / 库房 / 关于）
import { putRelease, getAllReleases, deleteRelease } from './db.js';
import { Recorder } from './recorder.js';
import { mountLiveBars, fitCanvas } from './waveform.js';
import { mountPlayer } from './player.js';
import { startGhostGuide } from './ghost-guide.js';
import { getEmotionShadows } from './resource.js';

// ─── 情绪类型 + 声纹变体 ───────────────────────────────
// 每个情绪一种基调配色 + 波形性格（gradient 跨场渐变 / wobble 抖动 / pulse 律动），
// 每种情绪下 3~5 种「声纹」变体，微调波形强度，让同情绪也有细微差别。
const EMOTIONS = [
  {
    id: 'rant', label: '抱怨', emoji: '😤',
    hint: '把堵在胸口的那股怨气，一股脑倒出来。停顿、重复、越说越急，都可以。',
    grad: ['#ef9e7d', '#e07850'],
    glow: '#e07850',
    wave: { alpha: 1, minBarHeight: 4, wobble: 0.35, pulse: 0 },
    voices: [
      { id: 'rant-1', label: '唠叨', mod: { wobble: 0.25 } },
      { id: 'rant-2', label: '吐槽', mod: { wobble: 0.35 } },
      { id: 'rant-3', label: '碎碎念', mod: { wobble: 0.3, pulse: 0.15 } },
      { id: 'rant-4', label: '埋怨', mod: { wobble: 0.45 } },
      { id: 'rant-5', label: '咆哮', mod: { wobble: 0.6, pulse: 0.2 } },
    ],
  },
  {
    id: 'cry', label: '哭', emoji: '💧',
    hint: '想哭就哭。这里没有观众，只有你自己的声音。',
    grad: ['#aab6e6', '#7b8fc4'],
    glow: '#8fa3d8',
    wave: { alpha: 0.92, minBarHeight: 3, wobble: 0.22, pulse: 0 },
    voices: [
      { id: 'cry-1', label: '抽泣', mod: { wobble: 0.5 } },
      { id: 'cry-2', label: '啜泣', mod: { wobble: 0.3 } },
      { id: 'cry-3', label: '大哭', mod: { wobble: 0.45, pulse: 0.15 } },
      { id: 'cry-4', label: '呜咽', mod: { wobble: 0.55 } },
      { id: 'cry-5', label: '无声流泪', mod: { wobble: 0.08, minBarHeight: 2 } },
    ],
  },
  {
    id: 'sing', label: '唱', emoji: '🎵',
    hint: '哼一段、唱一句，哪怕跑调。先让声音流动起来。',
    grad: ['#f3cf93', '#e3a857'],
    glow: '#e8b75f',
    wave: { alpha: 0.92, minBarHeight: 3, wobble: 0.12, pulse: 0.35 },
    voices: [
      { id: 'sing-1', label: '哼唱', mod: { pulse: 0.3 } },
      { id: 'sing-2', label: '清唱', mod: { pulse: 0.4 } },
      { id: 'sing-3', label: '跑调', mod: { wobble: 0.3, pulse: 0.3 } },
      { id: 'sing-4', label: '吼歌', mod: { pulse: 0.5, wobble: 0.2 } },
      { id: 'sing-5', label: '转音', mod: { pulse: 0.45, wobble: 0.15 } },
    ],
  },
  {
    id: 'quiet', label: '安静', emoji: '🌙',
    hint: '不说话也行。就在这里，安静地待一会儿。',
    grad: ['#bcd0bc', '#9bbf9a'],
    glow: '#a9c6a8',
    wave: { alpha: 0.7, minBarHeight: 2, wobble: 0.05, pulse: 0.12, smoothing: 0.9 },
    voices: [
      { id: 'quiet-1', label: '呼吸', mod: { pulse: 0.3 } },
      { id: 'quiet-2', label: '呢喃', mod: { wobble: 0.1 } },
      { id: 'quiet-3', label: '发呆', mod: { pulse: 0.08 } },
      { id: 'quiet-4', label: '沉默', mod: { wobble: 0.02, minBarHeight: 1 } },
      { id: 'quiet-5', label: '白噪音', mod: { wobble: 0.6, minBarHeight: 2 } },
    ],
  },
];
const EMOTION_MAP = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));
const EMOTION_LABEL = Object.fromEntries(EMOTIONS.map((e) => [e.id, e.label]));

// 情绪出口分类：纯 UI 临时选择，不存库、不分析（守「不过度收集」原则）
const MOODS = [
  { id: 'rant',  emoji: '😤', label: '抱怨一下' },
  { id: 'happy', emoji: '😂', label: '开心一下' },
  { id: 'sing',  emoji: '🎤', label: '唱两句' },
  { id: 'rage',  emoji: '🔥', label: '发泄一下' },
  { id: 'random', emoji: '🌧', label: '随便说说' },
];

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

let route = 'home';
let currentEmotion = EMOTIONS[0];
let currentVoice = EMOTIONS[0].voices[0];
let recorder = null;
let liveStop = null;
let recStartTs = 0;
let keepAudio = false;
let ghostStop = null;       // 轮换引导语计时器清除函数
let shadowCache = null;     // 情绪影子按天缓存，避免每次重渲染都拉取
const players = new Set(); // 活跃 player，切页时销毁

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.classList.remove('show'); }, 1800);
}

function destroyPlayers() {
  players.forEach((p) => p.destroy && p.destroy());
  players.clear();
}

function setRoute(r) {
  route = r;
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === r));
  destroyPlayers();
  if (ghostStop) { ghostStop(); ghostStop = null; }
  if (r === 'home') renderHome();
  else if (r === 'log') renderLog();
  else if (r === 'about') renderAbout();
}
document.querySelectorAll('.nav-btn').forEach((b) =>
  b.addEventListener('click', () => setRoute(b.dataset.route)));

// ---------------- 释放（首页） ----------------
function renderHome() {
  destroyPlayers();
  view.innerHTML = `
    <div class="emotion-grid" id="emotionRow">
      ${EMOTIONS.map((e) => `
        <button class="emotion-tile" data-emotion="${e.id}">
          <span class="et-emoji">${e.emoji}</span>
          <span class="et-label">${e.label}</span>
        </button>`).join('')}
    </div>

    <div class="voice-block">
      <span class="voice-label">声纹</span>
      <div class="voice-row" id="voiceRow"></div>
    </div>

    <div class="release-zone" id="releaseZone" style="--mode-live:${currentEmotion.glow}">
      <canvas class="wave-canvas" id="liveWave"></canvas>
      <div class="ghost-guide" id="ghostGuide">想到什么就说什么。</div>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-btn" id="recBtn" aria-label="开始释放">●</button>
      <div class="rec-hint" id="recHint">${currentEmotion.hint}</div>
    </div>

    <label class="keep-toggle">
      <input type="checkbox" id="keepChk" /> 保留这段音频（默认不保留，阅后即焚）
    </label>

    <div class="shadow-zone" id="shadowZone"></div>
  `;

  view.querySelectorAll('.emotion-tile').forEach((b) => {
    b.classList.toggle('active', b.dataset.emotion === currentEmotion.id);
    b.onclick = () => selectEmotion(b.dataset.emotion);
  });

  const keepChk = document.getElementById('keepChk');
  keepChk.checked = keepAudio;
  keepChk.onchange = () => { keepAudio = keepChk.checked; };

  renderVoiceChips();
  wireRecord();
  renderShadows();
}

function selectEmotion(id) {
  const e = EMOTION_MAP[id];
  if (!e || e.id === currentEmotion.id) return;
  currentEmotion = e;
  currentVoice = e.voices[0];
  syncEmotionUI();
}

function selectVoice(id) {
  const v = currentEmotion.voices.find((x) => x.id === id);
  if (!v) return;
  currentVoice = v;
  syncEmotionUI();
}

function syncEmotionUI() {
  view.querySelectorAll('.emotion-tile').forEach((b) =>
    b.classList.toggle('active', b.dataset.emotion === currentEmotion.id));
  const zone = view.querySelector('.release-zone');
  if (zone) zone.style.setProperty('--mode-live', currentEmotion.glow);
  const hint = document.getElementById('recHint');
  if (hint) hint.textContent = currentEmotion.hint;
  renderVoiceChips();
}

function renderVoiceChips() {
  const row = document.getElementById('voiceRow');
  if (!row) return;
  row.innerHTML = currentEmotion.voices.map((v) =>
    `<button class="voice-chip${v.id === currentVoice.id ? ' active' : ''}" data-voice="${v.id}">${v.label}</button>`
  ).join('');
  row.querySelectorAll('.voice-chip').forEach((b) => {
    b.onclick = () => selectVoice(b.dataset.voice);
  });
}

function wireRecord() {
  const recBtn = document.getElementById('recBtn');
  const liveWave = document.getElementById('liveWave');
  const timer = document.getElementById('recTimer');

  let recState = 'idle';

  // 计时器上方轮换引导语（每 3 秒）
  if (ghostStop) ghostStop();
  ghostStop = startGhostGuide(document.getElementById('ghostGuide'), 3000);

  const startRec = async () => {
    if (recState !== 'idle') return;
    recState = 'starting';
    try {
      recorder = new Recorder();
      await recorder.start();
    } catch (e) {
      toast('LetOut 需要麦克风权限');
      recorder = null;
      recState = 'idle';
      return;
    }
    if (recState === 'stopping') {
      await recorder.stop();
      recorder = null;
      recState = 'idle';
      return;
    }
    recState = 'recording';
    fitCanvas(liveWave, 72);
    // 波形：按情绪配色渐变 + 声纹微调（抖动/律动）
    const wcfg = Object.assign({}, currentEmotion.wave, currentVoice.mod || {});
    liveStop = mountLiveBars(liveWave, recorder.analyser, {
      gradient: currentEmotion.grad,
      wobble: wcfg.wobble || 0,
      pulse: wcfg.pulse || 0,
      alpha: wcfg.alpha != null ? wcfg.alpha : 0.9,
      minBarHeight: wcfg.minBarHeight || 2,
      smoothing: wcfg.smoothing != null ? wcfg.smoothing : 0.7,
    });
    recBtn.classList.add('recording');
    recBtn.textContent = '■';
    recStartTs = Date.now();
    const tick = () => {
      if (recState !== 'recording') return;
      const s = Math.floor((Date.now() - recStartTs) / 1000);
      timer.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      recorder._timer = setTimeout(tick, 500);
    };
    tick();
  };

  const stopRec = async () => {
    if (recState === 'starting') { recState = 'stopping'; return; }
    if (recState !== 'recording') return;
    recState = 'stopping';
    if (liveStop) { liveStop(); liveStop = null; }
    clearTimeout(recorder._timer);
    const dur = Date.now() - recStartTs;
    const result = await recorder.stop();
    recorder = null;
    recBtn.classList.remove('recording');
    recBtn.textContent = '●';
    timer.textContent = '00:00';
    recState = 'idle';
    if (dur < 500) { toast('点一下开始，再点一下停止'); return; }
    if (!result || !result.blob || result.blob.size === 0) { toast('没有录到声音'); return; }

    const keep = keepAudio;
    await putRelease({
      mode: currentEmotion.id,
      voice: currentVoice.id,
      voiceLabel: currentVoice.label,
      durationMs: result.durationMs,
      peaks: result.peaks,
      keep,
      hasAudio: keep,
      audioBlob: keep ? result.blob : null,
    });
    toast(keep ? '已释放，并保留这段声音' : '已释放 🔥（已阅后即焚）');
    renderHome();
  };

  recBtn.addEventListener('click', () => {
    if (recState === 'recording' || recState === 'starting') stopRec();
    else startRec();
  });
}

// ---------------- 情绪影子（资源库 / 占位） ----------------
async function renderShadows() {
  const zone = document.getElementById('shadowZone');
  if (!zone) return;
  if (shadowCache) { renderShadowInner(zone, shadowCache); return; }
  const data = await getEmotionShadows();
  shadowCache = data;
  renderShadowInner(zone, data);
}

function renderShadowInner(zone, data) {
  const items = data.items || [];
  // 单次只出一条（随机），不列清单
  const it = items.length ? items[Math.floor(Math.random() * items.length)] : null;
  if (!it) { zone.innerHTML = ''; return; }
  zone.innerHTML = `
    <div class="shadow-card">
      <div class="shadow-head">
        <span class="shadow-label">情绪影子</span>
        <span class="shadow-batch">${esc(data.batch && data.batch.label ? data.batch.label : '')}</span>
      </div>
      <div class="shadow-item">
        ${it.title ? `<div class="shadow-title">${esc(it.title)}</div>` : ''}
        <div class="shadow-text">${esc(it.text)}</div>
        ${it.audio ? `<audio class="shadow-audio" src="${esc(it.audio)}" controls preload="none"></audio>` : ''}
      </div>
    </div>`;
}

// ---------------- 库房（释放记录） ----------------
async function renderLog() {
  destroyPlayers();
  const rows = await getAllReleases();
  if (!rows.length) {
    view.innerHTML = `<div class="empty">还没有释放过。<br>回到「释放」，给自己一次开口的机会。</div>`;
    return;
  }
  view.innerHTML = `<div class="section-title">释放记录（${rows.length}）</div>` + rows.map((r) => `
    <div class="log-item" data-id="${r.id}">
      <div class="log-head">
        <span class="log-mode mode-${r.mode}">${EMOTION_LABEL[r.mode] || r.mode}${r.voiceLabel ? ' · ' + esc(r.voiceLabel) : ''}</span>
        <span class="log-meta">${fmtFull(r.createdAt)} · ${Math.round(r.durationMs / 1000)}s ${r.keep ? '· 💾' : '· 🌫'}</span>
      </div>
      <div class="player" data-id="${r.id}"></div>
      <div class="log-controls">
        <button class="mini-btn" data-act="del" data-id="${r.id}">焚毁记录</button>
      </div>
    </div>
  `).join('');

  rows.forEach((r) => {
    const holder = view.querySelector(`.player[data-id="${r.id}"]`);
    if (holder) players.add(mountPlayer(holder, r, { played: '#e07850', rest: '#3a2b23' }));
  });

  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      if (act === 'del') {
        if (confirm('焚毁这条释放记录？此操作不可恢复。')) {
          await deleteRelease(id);
          renderLog();
        }
      }
    };
  });
}

// ---------------- 关于 ----------------
function renderAbout() {
  destroyPlayers();
  view.innerHTML = `
    <div class="about">
      <div class="about-hero">
        <h1 class="about-title">关于 LetOut</h1>
        <div class="about-sub">大声说 · 低连接时代的情绪出口</div>
      </div>

      <section class="promise">
        <p class="promise-line">释放，不是发泄。</p>
        <p class="promise-line">不是心理治疗。</p>
        <p class="promise-leave">你不需要向谁证明什么。</p>
      </section>

      <section class="story">
        <p>当连接越来越密、真正能说真话的地方越来越少，人需要一个出口。</p>
        <p>抱怨、痛哭、唱、或者只是安静地待着——都是允许的。这里不评价好坏，不判断对错，不留痕。</p>
        <p>像巴黎街头那个把耳机音量调大、对着塞纳河哼歌的人。没人认识他，但他自己知道，这一刻他是松的。</p>
      </section>

      <section class="about-foot">
        <p class="about-foot-note">LetOut 是 Speak Series · 开口系列 的一款。</p>
      </section>
    </div>
  `;
}

// ---------------- 工具 ----------------
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function fmtFull(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------- 启动 ----------------
async function boot() {
  setRoute('home');
}
boot();
