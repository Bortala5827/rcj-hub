// app.js — LetOut 主逻辑（释放 / 库房 / 关于）
import { putRelease, getAllReleases, deleteRelease } from './db.js?v=20260813a';
import { Recorder } from './recorder.js?v=20260813b';
import { mountPlayer } from './player.js?v=20260813a';
import { openShareCard } from './sharecard.js?v=20260813a';
import { startGhostGuide } from './ghost-guide.js?v=20260813a';

// ─── 情绪类型 + 声纹变体 ───────────────────────────────
// 每个情绪一种基调配色 + 波形性格，每种情绪下 3~5 种「声纹」变体微调强度。
// 波形参数含义：
//   grad   [c1,c2] 柱体跨场渐变      glow  该情绪的环境光主色
//   wobble 0..1 随机抖动（躁/颤）    pulse 0..1 整体呼吸律动（唱/喘）
//   bloom  0..1 柱体外发光（越大越烫）floor 底部地面光色（随音量亮）
// 情绪能量梯度（有意拉开、别调成一样）：燃 > 释放 > 沉淀 > 安静
const EMOTIONS = [
  {
    id: 'burn', label: '燃', emoji: '🔥',
    hint: '把堵在胸口的那股火，一股脑倒出来。停顿、重复、越说越急，都可以。',
    // 最躁：橙红，抖动大、发光最烫
    grad: ['#ffb27a', '#e23b1e'],
    glow: '#ff6b35',
    wave: { alpha: 1, minBarHeight: 4, wobble: 0.48, pulse: 0.04, bloom: 0.64, smoothing: 0.6, barWidthRatio: 1.3, capStyle: 'hard', wobbleKind: 'random', mirror: true, mirrorAsym: 0.2 },
    voices: [
      { id: 'burn-1', label: '闷烧', mod: { wobble: 0.3, bloom: 0.4 } },
      { id: 'burn-2', label: '发火', mod: { wobble: 0.44 } },
      { id: 'burn-3', label: '宣泄', mod: { wobble: 0.5, pulse: 0.14 } },
      { id: 'burn-4', label: '急躁', mod: { wobble: 0.58 } },
      { id: 'burn-5', label: '咆哮', mod: { wobble: 0.74, pulse: 0.24, bloom: 0.88, alpha: 1 } },
    ],
  },
  {
    id: 'release', label: '释放', emoji: '💥',
    hint: '想说什么就说什么。这里没有观众，只有你自己的声音。',
    // 紫红：表达欲强，抖动+律动兼有的中高能量
    grad: ['#c97ba0', '#6a2249'],
    glow: '#b14c7e',
    wave: { alpha: 0.95, minBarHeight: 3, wobble: 0.34, pulse: 0.22, bloom: 0.5, smoothing: 0.7, barWidthRatio: 1.0, capStyle: 'soft', wobbleKind: 'random', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'release-1', label: '倾诉', mod: { wobble: 0.28, pulse: 0.18, bloom: 0.4 } },
      { id: 'release-2', label: '吐槽', mod: { wobble: 0.4 } },
      { id: 'release-3', label: '呐喊', mod: { wobble: 0.46, pulse: 0.3, bloom: 0.66 } },
      { id: 'release-4', label: '长叹', mod: { pulse: 0.34, wobble: 0.2 } },
      { id: 'release-5', label: '痛快', mod: { wobble: 0.5, pulse: 0.4, bloom: 0.78 } },
    ],
  },
  {
    id: 'settle', label: '沉淀', emoji: '🌊',
    hint: '慢慢把乱糟糟的念头理顺。不急，一句一句来。',
    // 蓝灰：冷静、接地，抖动小、光要稳
    grad: ['#7d9bb5', '#2f4a66'],
    glow: '#5f82a3',
    wave: { alpha: 0.82, minBarHeight: 3, wobble: 0.16, pulse: 0.1, bloom: 0.26, smoothing: 0.82, barWidthRatio: 0.95, capStyle: 'soft', wobbleKind: 'sine', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'settle-1', label: '梳理', mod: { wobble: 0.12, pulse: 0.08 } },
      { id: 'settle-2', label: '独白', mod: { wobble: 0.2 } },
      { id: 'settle-3', label: '理清', mod: { wobble: 0.16, pulse: 0.14 } },
      { id: 'settle-4', label: '喃喃', mod: { wobble: 0.26, bloom: 0.2 } },
      { id: 'settle-5', label: '沉淀', mod: { wobble: 0.06, pulse: 0.04, bloom: 0.12, alpha: 0.66 } },
    ],
  },
  {
    id: 'quiet', label: '安静', emoji: '🌙',
    hint: '不说话也行。就在这里，安静地待一会儿。',
    // 最缓：米白偏暖，慢呼吸、几乎不抖、光很淡
    grad: ['#ece3d4', '#b3a487'],
    glow: '#d4c9b8',
    wave: { alpha: 0.64, minBarHeight: 2, wobble: 0.04, pulse: 0.1, bloom: 0.12, smoothing: 0.92, barWidthRatio: 0.6, capStyle: 'soft', wobbleKind: 'sine', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'quiet-1', label: '呼吸', mod: { pulse: 0.26 } },
      { id: 'quiet-2', label: '呢喃', mod: { wobble: 0.09 } },
      { id: 'quiet-3', label: '发呆', mod: { pulse: 0.06, alpha: 0.56 } },
      { id: 'quiet-4', label: '沉默', mod: { wobble: 0.01, minBarHeight: 1, bloom: 0, alpha: 0.48 } },
      { id: 'quiet-5', label: '白噪音', mod: { wobble: 0.5, minBarHeight: 2, bloom: 0.18 } },
    ],
  },
];
const EMOTION_MAP = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));
const EMOTION_LABEL = Object.fromEntries(EMOTIONS.map((e) => [e.id, e.label]));

// 旧 id 兼容：库房里老录音存的是 rant/cry/sing/quiet，映射到新情绪盘，
// 否则回放时 EMOTION_MAP/EMOTION_LABEL 取不到，标签会显示成原始 id。
const LEGACY_EMOTION = { rant: 'burn', cry: 'settle', sing: 'release', quiet: 'quiet' };
for (const [oldId, newId] of Object.entries(LEGACY_EMOTION)) {
  if (EMOTION_MAP[newId]) {
    EMOTION_MAP[oldId] = EMOTION_MAP[newId];
    EMOTION_LABEL[oldId] = EMOTION_LABEL[newId];
  }
}

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

let route = 'home';
let currentEmotion = EMOTIONS[0];
let currentVoice = EMOTIONS[0].voices[0];
let recorder = null;
let recStartTs = 0;
let keepAudio = false;
let ghostStop = null;       // 轮换引导语计时器清除函数
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

    <div class="release-zone" id="releaseZone">
      <div class="ghost-guide" id="ghostGuide">想到什么就说什么。</div>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-btn" id="recBtn" aria-label="开始释放">●</button>
      <div class="rec-hint" id="recHint">${currentEmotion.hint}</div>
    </div>

    <label class="keep-toggle">
      <input type="checkbox" id="keepChk" /> 保留这段音频（默认不保留，阅后即焚）
    </label>

  `;

  applyEmotionTheme();

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
  applyEmotionTheme();
  const hint = document.getElementById('recHint');
  if (hint) hint.textContent = currentEmotion.hint;
  renderVoiceChips();
}

// 情绪主色挂到根节点：情绪块 / 胶囊 / 释放区 / 录音按钮全都随之平滑换色
function applyEmotionTheme() {
  const root = document.documentElement;
  root.style.setProperty('--mode-live', currentEmotion.glow);
  root.style.setProperty('--mode-from', currentEmotion.grad[0]);
  root.style.setProperty('--mode-to', currentEmotion.grad[1]);
  root.dataset.emotion = currentEmotion.id;
  if (window.__particles) window.__particles.setEmotion(currentEmotion.glow);
}

// 实时音量 → CSS 变量，驱动页面环境光呼吸（限频已在 waveform 层做）
function setLiveLevel(v) {
  document.documentElement.style.setProperty('--live-level', String(v));
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
    document.documentElement.dataset.rec = '1';
    if (window.__particles) window.__particles.pause(); // 录音时暂停粒子，省电/避免小米卡顿
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
    delete document.documentElement.dataset.rec;
    if (window.__particles) window.__particles.resume();
    setLiveLevel(0);
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
        <button class="mini-btn" data-act="card" data-id="${r.id}">声波卡</button>
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
      if (act === 'card') {
        const rel = rows.find((x) => x.id === id);
        if (rel) openShareCard(rel, EMOTION_MAP[rel.mode] || EMOTIONS[0]);
      } else if (act === 'del') {
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
