// app.js — SPA 主逻辑（今天 / 声音日志 / 导出）
import {
  putRecording, getAllRecordings, deleteRecording, setFavorite, getMeta, putMeta,
} from './db.js';
import { Recorder } from './recorder.js';
import { mountLiveBars, renderWave, fitCanvas } from './waveform.js';
import { mountPlayer } from './player.js';
import { seedIfEmpty, getTopic, nextTopic, GREETING_JP, GREETING_CN, QUOTE } from './topics.js';
import { getTodayGoal, addSpoken, getDailyGoalMin, setDailyGoalMin } from './goals.js';
import { exportData, exportAudio } from './export.js';

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

let route = 'home';
let currentTopic = null;
let recorder = null;
let liveStop = null;
let recStartTs = 0;
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
  if (r === 'home') renderHome();
  else if (r === 'log') renderLog();
  else if (r === 'export') renderExport();
  else if (r === 'about') renderAbout();
}

document.querySelectorAll('.nav-btn').forEach((b) =>
  b.addEventListener('click', () => setRoute(b.dataset.route)));

// ---------------- 今天 ----------------
async function renderHome() {
  destroyPlayers();
  if (!currentTopic) currentTopic = await getTopic();
  const goal = await getTodayGoal();
  const doneMin = Math.round((goal.doneSec || 0) / 60 * 10) / 10;
  const targetMin = goal.targetMin;
  const pct = Math.max(0, Math.min(100, Math.round(doneMin / targetMin * 100)));
  const makeupNote = (goal.makeupMin && goal.makeupMin > 0)
    ? `今天多补了 ${goal.makeupMin} 分钟（昨天没说完的）` : '';

  view.innerHTML = `
    <div class="greeting-jp">${GREETING_JP}</div>
    <div class="greeting-cn">${GREETING_CN}</div>
    <div class="quote">${QUOTE}</div>

    <div class="goal">
      <div class="goal-top">
        <span class="goal-label">今天，也听听自己的声音。</span>
        <button class="link-btn" id="setGoal">改目标</button>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-stats">
        <span>已说 <b>${doneMin}</b> / ${targetMin} 分钟</span>
        <span class="goal-streak">连续 ${goal.streak} 天</span>
      </div>
      ${makeupNote ? `<div class="goal-makeup">${makeupNote}</div>` : ''}
    </div>

    <div class="topic-card">
      <div class="topic-label">今天的话题</div>
      <div class="topic-text" id="topicText">${currentTopic ? esc(currentTopic.text) : '（暂无话题）'}</div>
      <div class="topic-actions">
        <button class="link-btn" id="swapTopic">换一个</button>
      </div>
    </div>

    <div class="record-zone">
      <canvas class="wave-canvas" id="liveWave"></canvas>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-btn" id="recBtn" aria-label="点击开始录音">●</button>
      <div class="rec-hint">点一下开始，再点一下停止。不评价好坏，先开口。停顿、重复、沉默、笑，都可以。</div>
    </div>
  `;

  document.getElementById('swapTopic').onclick = async () => {
    currentTopic = await nextTopic(currentTopic ? currentTopic.id : null);
    const el = document.getElementById('topicText');
    if (el && currentTopic) el.textContent = currentTopic.text;
  };

  document.getElementById('setGoal').onclick = () => {
    const cur = getDailyGoalMin();
    const v = prompt('每日目标分钟数（1–120）：', String(cur));
    if (v == null) return;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) { toast('请输入有效分钟数'); return; }
    setDailyGoalMin(Math.min(120, n));
    renderHome();
  };

  const recBtn = document.getElementById('recBtn');
  const liveWave = document.getElementById('liveWave');
  const timer = document.getElementById('recTimer');

  // 状态机：idle -> starting -> recording -> idle（防止快速点按竞态）
  let recState = 'idle';

  const startRec = async () => {
    if (recState !== 'idle') return;
    recState = 'starting';
    try {
      recorder = new Recorder();
      await recorder.start();
    } catch (e) {
      toast('独声需要麦克风权限');
      recorder = null;
      recState = 'idle';
      return;
    }
    // 启动期间用户已松开 -> 立即停
    if (recState === 'stopping') {
      await recorder.stop();
      recorder = null;
      recState = 'idle';
      return;
    }
    recState = 'recording';
    fitCanvas(liveWave, 72);
    liveStop = mountLiveBars(liveWave, recorder.analyser, { color: '#6f9b8a' });
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
    if (recState === 'starting') { recState = 'stopping'; return; } // 等 start 完成后再停
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
    if (dur < 500) { toast('按住说话'); return; } // 误触
    if (!result || !result.blob || result.blob.size === 0) { toast('没有录到声音'); return; }

    await putRecording({
      durationMs: result.durationMs,
      topicId: currentTopic ? currentTopic.id : null,
      topicText: currentTopic ? currentTopic.text : null,
      topicLevel: currentTopic ? currentTopic.level : null,
      transcript: null,
      audioBlob: result.blob,
      peaks: result.peaks,
      moodTag: null,
      favorite: false,
    });
    await addSpoken(result.durationMs);
    toast('已留下你的声音');
    renderHome();
  };

  // 点击切换：点一下开始，再点一下停止（用户偏好，非按住录音）
  recBtn.addEventListener('click', () => {
    if (recState === 'recording' || recState === 'starting') stopRec();
    else startRec();
  });
}

// ---------------- 声音日志 ----------------
const LEVEL_LABEL = { light: '轻', medium: '中', heavy: '重' };
async function renderLog() {
  destroyPlayers();
  const rows = await getAllRecordings();
  if (!rows.length) {
    view.innerHTML = `<div class="empty">还没有声音。<br>回到「今天」，给自己一次开口的机会。</div>`;
    return;
  }
  view.innerHTML = buildVoiceProfile(rows) + `<div class="section-title">声音日志（${rows.length}）</div>` + rows.map((r) => `
    <div class="log-item" data-id="${r.id}">
      <div class="log-head">
        <span class="log-date">${fmtFull(r.createdAt)}</span>
        <span class="log-meta">${Math.round(r.durationMs / 1000)}s ${r.favorite ? '· ★' : ''}</span>
      </div>
      ${r.topicLevel ? `<span class="lv-tag lv-${r.topicLevel}">${LEVEL_LABEL[r.topicLevel]}</span>` : ''}
      ${r.topicText ? `<div class="log-topic">${esc(r.topicText)}</div>` : ''}
      <div class="player" data-id="${r.id}"></div>
      <div class="log-controls">
        <button class="mini-btn" data-act="fav" data-id="${r.id}">${r.favorite ? '取消收藏' : '收藏'}</button>
        <button class="mini-btn" data-act="audio" data-id="${r.id}">导出音频</button>
        <button class="mini-btn" data-act="del" data-id="${r.id}">删除</button>
      </div>
    </div>
  `).join('');

  rows.forEach((r) => {
    const holder = view.querySelector(`.player[data-id="${r.id}"]`);
    if (holder) players.add(mountPlayer(holder, r));
  });

  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const rec = rows.find((x) => x.id === id);
      if (act === 'fav') {
        const cur = rows.find((x) => x.id === id).favorite;
        await setFavorite(id, !cur);
        renderLog();
      } else if (act === 'audio') {
        exportAudio(rec);
      } else if (act === 'del') {
        if (confirm('删除这条声音？此操作不可恢复。')) {
          await deleteRecording(id);
          renderLog();
        }
      }
    };
  });
}

// ---------------- 声音档案（观察，不评分） ----------------
function buildVoiceProfile(rows) {
  const count = rows.length;
  if (count === 0) {
    return `
    <div class="voice-profile">
      <div class="vp-head">声音档案 · 观察，不评分</div>
      <div class="vp-empty" style="color:#9a8f86;font-size:13px;line-height:1.7">还没有声音记录。录第一条后，这里会出现你的声音档案——记录次数、第一次开口是哪天、常提到的话题。</div>
    </div>`;
  }
  const first = Math.min(...rows.map((r) => r.createdAt));
  const days = Math.max(1, Math.floor((Date.now() - first) / 864e5));
  const freq = {};
  rows.forEach((r) => {
    const t = (r.topicText || '').trim();
    if (t) freq[t] = (freq[t] || 0) + 1;
  });
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((x) => x[0]);
  return `
    <div class="voice-profile">
      <div class="vp-head">声音档案 · 观察，不评分</div>
      <div class="vp-stats">
        <div class="vp-stat"><span class="vp-num">${count}</span><span class="vp-label">次声音记录</span></div>
        <div class="vp-stat"><span class="vp-num">${days}</span><span class="vp-label">天前第一次开口</span></div>
      </div>
      ${top.length ? `<div class="vp-topics">常提到：${top.map((t) => `<span class="vp-chip">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;
}

// ---------------- 导出 ----------------
async function renderExport() {
  destroyPlayers();
  const rows = await getAllRecordings();
  view.innerHTML = `
    <div class="section-title">导出你的声音日志</div>
    <div class="field">
      <label>格式</label>
      <select id="fmt">
        <option value="md">Markdown（适合写复盘）</option>
        <option value="txt">纯文本 TXT</option>
        <option value="json">JSON（便于交给 AI 分析）</option>
      </select>
    </div>
    <div class="field">
      <label>范围</label>
      <select id="range">
        <option value="all">全部（${rows.length} 条）</option>
        <option value="fav">仅收藏</option>
        <option value="week">近 7 天</option>
      </select>
    </div>
    <button class="big-btn" id="doExport">导出</button>
    <div class="range-note">导出是你的主动行为；产品不默认收集、不上传。</div>
  `;

  document.getElementById('doExport').onclick = () => {
    const fmt = document.getElementById('fmt').value;
    const range = document.getElementById('range').value;
    let out = rows;
    if (range === 'fav') out = rows.filter((r) => r.favorite);
    else if (range === 'week') {
      const cut = Date.now() - 7 * 864e5;
      out = rows.filter((r) => r.createdAt >= cut);
    }
    if (!out.length) { toast('没有可导出的内容'); return; }
    exportData(out, fmt);
    toast('已导出');
  };
}

// ---------------- 关于 ----------------
async function renderAbout() {
  destroyPlayers();
  view.innerHTML = `
    <div class="about">
      <div class="about-hero">
        <div class="about-jp">独りで、声を出す。</div>
        <h1 class="about-title">关于独声</h1>
        <div class="about-sub">SoloSpeak · 独声 — 一个人的开口练习</div>
      </div>

      <section class="promise">
        <p class="promise-line">不建群。</p>
        <p class="promise-line">不交友。</p>
        <p class="promise-line">不留痕。</p>
        <p class="promise-leave">等你不需要了，悄悄离开就好。</p>
      </section>

      <section class="story">
        <p>当你独居、失业、远程办公，说话变少的时候，它陪你一段时间。</p>
        <p>不建群，不交友，不留痕。每天开口，保持语言系统在线。等你不需要了，悄悄离开就好。</p>
        <p>想象一下：一个人在京都的喫茶店里翻一页书、说一段话；或者一个人在柏林的公寓里，对窗外的街道说声早安。说给谁听不重要，重要的是——你开口了。</p>
      </section>

      <section class="gourmet">
        <h2 class="gourmet-title">像五郎那样，一个人也很好</h2>
        <p>《孤独的美食家》里的五郎，一个人进店，点一份想吃的，安安静静吃完，起身走人。他不约人拼桌，不交换联系方式，也不发朋友圈打卡——一个人吃饭，照样吃得有滋有味。</p>
        <p>独声也是一样。一个人，对着安静的空气说几句，不为了给谁听，只是别让“说话”这件事生锈。这里没有关注、没有点赞、没有排行榜。你来了，就开口；你走了，我们就不打扰。</p>
      </section>

      <section class="about-foot">
        <p class="about-foot-note">独声是 Speak Series · 开口系列 的一款。</p>
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  await seedIfEmpty();
  await getMeta('onboarded'); // 预留
  setRoute('home');
}
boot();
