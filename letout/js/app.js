// app.js — LetOut 主逻辑（释放 / 库房 / 关于）
// 2026-09-01：三语国际化（中/英/日），删分享卡片，EMOTIONS/声纹/引导语三语化
import { putRelease, getAllReleases, deleteRelease } from './db.js?v=20260813a';
import { Recorder } from './recorder.js?v=20260813b';
import { mountPlayer } from './player.js?v=20260813a';

const t = (k, vars) => (window.LOI18N ? window.LOI18N.t(k, vars) : k);

// ─── 情绪类型 + 声纹变体 ───────────────────────────────
// 每个情绪一种基调配色 + 波形性格，每种情绪下 5 种「声纹」变体微调强度。
// 情绪能量梯度：燃 > 释放 > 沉淀 > 安静
const EMOTIONS = [
  {
    id: 'burn', labelKey: 'emotionBurn', emoji: '🔥', hintKey: 'burnHint',
    grad: ['#ffb27a', '#e23b1e'],
    glow: '#ff6b35',
    wave: { alpha: 1, minBarHeight: 4, wobble: 0.48, pulse: 0.04, bloom: 0.64, smoothing: 0.6, barWidthRatio: 1.3, capStyle: 'hard', wobbleKind: 'random', mirror: true, mirrorAsym: 0.2 },
    voices: [
      { id: 'burn-1', labelKey: 'burnVoice1', mod: { wobble: 0.3, bloom: 0.4 } },
      { id: 'burn-2', labelKey: 'burnVoice2', mod: { wobble: 0.44 } },
      { id: 'burn-3', labelKey: 'burnVoice3', mod: { wobble: 0.5, pulse: 0.14 } },
      { id: 'burn-4', labelKey: 'burnVoice4', mod: { wobble: 0.58 } },
      { id: 'burn-5', labelKey: 'burnVoice5', mod: { wobble: 0.74, pulse: 0.24, bloom: 0.88, alpha: 1 } },
    ],
  },
  {
    id: 'release', labelKey: 'emotionRelease', emoji: '💥', hintKey: 'releaseHint',
    grad: ['#c97ba0', '#6a2249'],
    glow: '#b14c7e',
    wave: { alpha: 0.95, minBarHeight: 3, wobble: 0.34, pulse: 0.22, bloom: 0.5, smoothing: 0.7, barWidthRatio: 1.0, capStyle: 'soft', wobbleKind: 'random', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'release-1', labelKey: 'releaseVoice1', mod: { wobble: 0.28, pulse: 0.18, bloom: 0.4 } },
      { id: 'release-2', labelKey: 'releaseVoice2', mod: { wobble: 0.4 } },
      { id: 'release-3', labelKey: 'releaseVoice3', mod: { wobble: 0.46, pulse: 0.3, bloom: 0.66 } },
      { id: 'release-4', labelKey: 'releaseVoice4', mod: { pulse: 0.34, wobble: 0.2 } },
      { id: 'release-5', labelKey: 'releaseVoice5', mod: { wobble: 0.5, pulse: 0.4, bloom: 0.78 } },
    ],
  },
  {
    id: 'settle', labelKey: 'emotionSettle', emoji: '🌊', hintKey: 'settleHint',
    grad: ['#7d9bb5', '#2f4a66'],
    glow: '#5f82a3',
    wave: { alpha: 0.82, minBarHeight: 3, wobble: 0.16, pulse: 0.1, bloom: 0.26, smoothing: 0.82, barWidthRatio: 0.95, capStyle: 'soft', wobbleKind: 'sine', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'settle-1', labelKey: 'settleVoice1', mod: { wobble: 0.12, pulse: 0.08 } },
      { id: 'settle-2', labelKey: 'settleVoice2', mod: { wobble: 0.2 } },
      { id: 'settle-3', labelKey: 'settleVoice3', mod: { wobble: 0.16, pulse: 0.14 } },
      { id: 'settle-4', labelKey: 'settleVoice4', mod: { wobble: 0.26, bloom: 0.2 } },
      { id: 'settle-5', labelKey: 'settleVoice5', mod: { wobble: 0.06, pulse: 0.04, bloom: 0.12, alpha: 0.66 } },
    ],
  },
  {
    id: 'quiet', labelKey: 'emotionQuiet', emoji: '🌙', hintKey: 'quietHint',
    grad: ['#ece3d4', '#b3a487'],
    glow: '#d4c9b8',
    wave: { alpha: 0.64, minBarHeight: 2, wobble: 0.04, pulse: 0.1, bloom: 0.12, smoothing: 0.92, barWidthRatio: 0.6, capStyle: 'soft', wobbleKind: 'sine', mirror: true, mirrorAsym: 0 },
    voices: [
      { id: 'quiet-1', labelKey: 'quietVoice1', mod: { pulse: 0.26 } },
      { id: 'quiet-2', labelKey: 'quietVoice2', mod: { wobble: 0.09 } },
      { id: 'quiet-3', labelKey: 'quietVoice3', mod: { pulse: 0.06, alpha: 0.56 } },
      { id: 'quiet-4', labelKey: 'quietVoice4', mod: { wobble: 0.01, minBarHeight: 1, bloom: 0, alpha: 0.48 } },
      { id: 'quiet-5', labelKey: 'quietVoice5', mod: { wobble: 0.5, minBarHeight: 2, bloom: 0.18 } },
    ],
  },
];
const EMOTION_MAP = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));
const emotionLabel = (id) => { const e = EMOTION_MAP[id]; return e ? t(e.labelKey) : id; };

// 旧 id 兼容
const LEGACY_EMOTION = { rant: 'burn', cry: 'settle', sing: 'release', quiet: 'quiet' };
for (const [oldId, newId] of Object.entries(LEGACY_EMOTION)) {
  if (EMOTION_MAP[newId]) EMOTION_MAP[oldId] = EMOTION_MAP[newId];
}

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

let route = 'home';
let currentEmotion = EMOTIONS[0];
let currentVoice = EMOTIONS[0].voices[0];
let recorder = null;
let recStartTs = 0;
let keepAudio = false;
let ghostTimer = null;
const players = new Set();

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

function stopGhost() {
  if (ghostTimer) { clearInterval(ghostTimer); ghostTimer = null; }
}

function startGhost(el) {
  if (!el) return;
  const guides = [];
  for (let i = 1; i <= 16; i++) guides.push(t('ghost' + i));
  let idx = Math.floor(Math.random() * guides.length);
  el.textContent = guides[idx];
  ghostTimer = setInterval(() => {
    idx = (idx + 1) % guides.length;
    if (el) el.textContent = guides[idx];
  }, 3000);
}

function setRoute(r) {
  route = r;
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === r));
  destroyPlayers();
  stopGhost();
  if (r === 'home') renderHome();
  else if (r === 'log') renderLog();
  else if (r === 'about') renderAbout();
}
document.querySelectorAll('.nav-btn').forEach((b) =>
  b.addEventListener('click', () => setRoute(b.dataset.route)));

// 语言切换
const langSelect = document.getElementById('langSelect');
if (langSelect) {
  if (window.LOI18N) langSelect.value = window.LOI18N.getLang();
  langSelect.addEventListener('change', () => {
    if (window.LOI18N) {
      window.LOI18N.setLang(langSelect.value);
      setRoute(route);
    }
  });
}

// ---------------- 释放（首页） ----------------
function renderHome() {
  destroyPlayers();
  view.innerHTML = `
    <div class="emotion-grid" id="emotionRow">
      ${EMOTIONS.map((e) => `
        <button class="emotion-tile" data-emotion="${e.id}">
          <span class="et-emoji">${e.emoji}</span>
          <span class="et-label">${t(e.labelKey)}</span>
        </button>`).join('')}
    </div>

    <div class="voice-block">
      <span class="voice-label">${t('voiceLabel')}</span>
      <div class="voice-row" id="voiceRow"></div>
    </div>

    <div class="release-zone" id="releaseZone">
      <div class="ghost-guide" id="ghostGuide">${t('ghost1')}</div>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-btn" id="recBtn" aria-label="${t('recAria')}">●</button>
      <div class="rec-hint" id="recHint">${t(currentEmotion.hintKey)}</div>
    </div>

    <label class="keep-toggle">
      <input type="checkbox" id="keepChk" /> ${t('keepAudio')}
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
  startGhost(document.getElementById('ghostGuide'));
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
  if (hint) hint.textContent = t(currentEmotion.hintKey);
  renderVoiceChips();
}

// 情绪主色挂到根节点
function applyEmotionTheme() {
  const root = document.documentElement;
  root.style.setProperty('--mode-live', currentEmotion.glow);
  root.style.setProperty('--mode-from', currentEmotion.grad[0]);
  root.style.setProperty('--mode-to', currentEmotion.grad[1]);
  root.dataset.emotion = currentEmotion.id;
  if (window.__particles) window.__particles.setEmotion(currentEmotion.glow);
}

// 实时音量 → CSS 变量
function setLiveLevel(v) {
  const root = document.documentElement;
  root.style.setProperty('--live-level', v);
}

function renderVoiceChips() {
  const row = document.getElementById('voiceRow');
  if (!row) return;
  row.innerHTML = currentEmotion.voices.map((v) =>
    `<button class="voice-chip${v.id === currentVoice.id ? ' active' : ''}" data-voice="${v.id}">${t(v.labelKey)}</button>`
  ).join('');
  row.querySelectorAll('.voice-chip').forEach((b) => {
    b.onclick = () => selectVoice(b.dataset.voice);
  });
}

// ---------------- 录音 ----------------
function wireRecord() {
  const recBtn = document.getElementById('recBtn');
  const timer = document.getElementById('recTimer');
  let recState = 'idle';

  const startRec = async () => {
    if (recState !== 'idle') return;
    recState = 'starting';
    try {
      recorder = new Recorder();
      recorder.onLevel = (max) => { setLiveLevel(max); };
      await recorder.start();
    } catch (e) {
      toast(t('recAria'));
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
    recBtn.classList.add('recording');
    recBtn.textContent = '■';
    recStartTs = Date.now();
    if (window.__particles) window.__particles.pause();
    const fmt = (sec) => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    timer.textContent = fmt(0);
    const tick = () => {
      if (recState !== 'recording') return;
      const elapsed = Math.floor((Date.now() - recStartTs) / 1000);
      timer.textContent = fmt(elapsed);
      recorder._timer = setTimeout(tick, 500);
    };
    tick();
  };

  const stopRec = async () => {
    if (recState === 'starting') { recState = 'stopping'; return; }
    if (recState !== 'recording') return;
    recState = 'stopping';
    clearTimeout(recorder._timer);
    const dur = Date.now() - recStartTs;
    const result = await recorder.stop();
    recorder = null;
    recBtn.classList.remove('recording');
    recBtn.textContent = '●';
    timer.textContent = '00:00';
    recState = 'idle';
    if (window.__particles) window.__particles.resume();
    setLiveLevel(0);
    if (dur < 500) { toast(t('recHintDefault')); return; }
    if (!result || !result.blob || result.blob.size === 0) { toast(t('recHintDefault')); return; }

    const keep = keepAudio;
    await putRelease({
      mode: currentEmotion.id,
      voice: currentVoice.id,
      voiceLabel: currentVoice.labelKey,
      durationMs: result.durationMs,
      peaks: result.peaks,
      keep,
      hasAudio: keep,
      audioBlob: keep ? result.blob : null,
    });
    toast(keep ? t('recHintDefault') : '🔥');
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
    view.innerHTML = `<div class="empty">${t('logEmpty')}</div>`;
    return;
  }
  view.innerHTML = `<div class="section-title">${t('logTitle', { n: rows.length })}</div>` + rows.map((r) => `
    <div class="log-item" data-id="${r.id}">
      <div class="log-head">
        <span class="log-mode mode-${r.mode}">${emotionLabel(r.mode)}${r.voiceLabel ? ' · ' + esc(t(r.voiceLabel) || r.voiceLabel) : ''}</span>
        <span class="log-meta">${fmtFull(r.createdAt)} · ${Math.round(r.durationMs / 1000)}s ${r.keep ? '· 💾' : '· 🌫'}</span>
      </div>
      <div class="player" data-id="${r.id}"></div>
      <div class="log-controls">
        <button class="mini-btn" data-act="del" data-id="${r.id}">${t('deleteBtn')}</button>
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
        if (confirm(t('deleteConfirm'))) {
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
        <h1 class="about-title">${t('aboutTitle')}</h1>
        <div class="about-sub">${t('aboutSub')}</div>
      </div>

      <section class="promise">
        <p class="promise-line">${t('aboutDesc1')}</p>
        <p class="promise-line">${t('aboutDesc2')}</p>
        <p class="promise-leave">${t('aboutDesc3')}</p>
      </section>

      <section class="about-foot">
        <p class="about-foot-note">${t('aboutFoot')}</p>
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
