// app.js — SPA 主逻辑（今天 / 声音日志 / 导出 / 关于）
// 2026-09-01：加三语 i18n（中/英/日），清空预设话题与台词，移除首页话题卡/名言区/AI出题。
import {
  putRecording, getAllRecordings, deleteRecording, setFavorite, getMeta, putMeta,
} from './db.js';
import { Recorder } from './recorder.js?v=20260813b';
import { mountPlayer } from './player.js?v=20260813a';
import { seedIfEmpty, getTopic, nextTopic } from './topics.js';
import { getTodayGoal, addSpoken, getDailyGoalMin, setDailyGoalMin } from './goals.js';
import { exportData, exportAudio } from './export.js';
import { getDailyQuote, getLanguageQuote, nextLanguageQuote } from './quotes.20260814.js';
import { markHighVolumeToday } from './streak.js';

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

// i18n 快捷方式（i18n.js 先于本模块加载，挂在 window.SSI18N）
const t = (k, vars) => (window.SSI18N ? window.SSI18N.t(k, vars) : k);

let route = 'home';
let currentTopic = null;
let recorder = null;
let recStartTs = 0;
const players = new Set();

function fmtMMSS(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

// 面板内导航按钮点击后自动关闭设置面板
document.querySelectorAll('.ai-nav-btn').forEach((b) =>
  b.addEventListener('click', () => {
    var ov = document.getElementById('aiSettingsOverlay');
    if (ov) ov.classList.remove('show');
  }));

// 语言切换
const langSelect = document.getElementById('langSelect');
if (langSelect) {
  if (window.SSI18N) langSelect.value = window.SSI18N.getLang();
  langSelect.addEventListener('change', () => {
    if (window.SSI18N) {
      window.SSI18N.setLang(langSelect.value);
      setRoute(route); // 重新渲染当前路由以应用新语言
    }
  });
}

// ---------------- 今天 ----------------
async function renderHome() {
  destroyPlayers();
  if (!currentTopic) currentTopic = await getTopic();
  const goal = await getTodayGoal();
  const doneMin = Math.round((goal.doneSec || 0) / 60 * 10) / 10;
  const targetMin = goal.targetMin;
  const pct = Math.max(0, Math.min(100, Math.round(doneMin / targetMin * 100)));
  const makeupNote = (goal.makeupMin && goal.makeupMin > 0)
    ? t('goalMakeup', { n: goal.makeupMin }) : '';

  view.innerHTML = `
    <div class="greeting-jp">${esc(t('greetingJp'))}</div>
    <div class="greeting-cn">${esc(t('greeting'))}</div>

    <div class="goal">
      <div class="goal-top">
        <span class="goal-label">${esc(t('goalLabel'))}</span>
        <button class="link-btn" id="setGoal">${esc(t('goalSet'))}</button>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-stats">
        <span><b>${fmtMMSS(goal.doneSec || 0)}</b> / ${fmtMMSS(targetMin * 60)}</span>
        <span class="goal-streak">${esc(t('goalStreak', { n: goal.streak }))}</span>
      </div>
      ${makeupNote ? `<div class="goal-makeup">${esc(makeupNote)}</div>` : ''}
    </div>

    <div class="record-zone">
      <div class="vol-meter-live"><div class="vml-fill" id="volMeterFill"></div></div>
      <div class="rec-timer" id="recTimer">00:00</div>
      <button class="rec-btn" id="recBtn" aria-label="${esc(t('recAria'))}">●</button>
      <div class="rec-hint">${esc(t('recHint'))}</div>
    </div>
  `;

  document.getElementById('setGoal').onclick = () => {
    const cur = getDailyGoalMin();
    const v = prompt(t('goalPrompt'), String(cur));
    if (v == null) return;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 1) { toast(t('goalInvalid')); return; }
    setDailyGoalMin(Math.min(120, n));
    renderHome();
  };

  const recBtn = document.getElementById('recBtn');
  const timer = document.getElementById('recTimer');

  // 状态机：idle -> starting -> recording -> idle
  let recState = 'idle';

  const startRec = async () => {
    if (recState !== 'idle') return;
    recState = 'starting';
    try {
      recorder = new Recorder();
      recorder.onLevel = (max) => {
        const fill = document.getElementById('volMeterFill');
        if (!fill) return;
        fill.style.width = Math.max(4, Math.round(max * 100)) + '%';
        let c = '#b9b3a8';
        if (max >= 0.58) c = '#e3a857';
        else if (max >= 0.25) c = '#6f9b8a';
        fill.style.background = c;
      };
      await recorder.start();
    } catch (e) {
      toast(t('toastMic'));
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
    if (dur < 500) { toast(t('toastShort')); return; }
    if (!result || !result.blob || result.blob.size === 0) { toast(t('toastNoSound')); return; }

    const streak = markHighVolumeToday(result.level);
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
    toast(t('toastSaved'));
    showFeedbackCard(result, { topicText: currentTopic ? currentTopic.text : null, streak });
  };

  // 录音结束反馈卡：音量小结 + 连击→FaceTalk 引导 + AI 引导（台词/金句已移除）
  function showFeedbackCard(result, meta) {
    const lvl = result.level || {};
    const peakPct = Math.round((lvl.max || 0) * 100);
    const durSec = Math.round(result.durationMs / 1000);
    const high = !!lvl.highTriggered;
    const streak = meta.streak || 0;
    const letoutNote = high ? t('recapLetoutHigh') : t('recapLetoutNormal');
    const faceTalkBanner = streak >= 3
      ? `<div class="ft-banner">${t('recapFaceTalk', { n: streak })}</div>`
      : '';
    view.innerHTML = `
      <div class="recap">
        <div class="recap-head">${esc(t('recapTitle'))}</div>
        <div class="recap-meta">${durSec}s${meta.topicText ? ' · ' + esc(meta.topicText) : ''}</div>
        <div class="vol-card">
          <div class="vol-row"><span>${esc(t('recapVolPeak'))}</span><b>${peakPct}%</b></div>
          <div class="vol-meter"><div class="vol-fill" style="width:${peakPct}%"></div></div>
          <div class="vol-note">${letoutNote}</div>
        </div>
        ${faceTalkBanner}
        <div class="ai-guide" id="aiGuide"></div>
        <div class="recap-actions">
          <button class="big-btn" id="recapBack">${esc(t('recapBack'))}</button>
        </div>
      </div>`;
    if (window.RCJ_AI) {
      window.RCJ_AI.mountAiGuide(document.getElementById('aiGuide'), {
        durationMs: result.durationMs, level: lvl, topicText: meta.topicText,
      });
    }
    document.getElementById('recapBack').onclick = () => renderHome();
  }

  recBtn.addEventListener('click', () => {
    if (recState === 'recording' || recState === 'starting') stopRec();
    else startRec();
  });
}

// ---------------- 声音日志 ----------------
const LEVEL_LABEL = { light: 'L', medium: 'M', heavy: 'H' };
async function renderLog() {
  destroyPlayers();
  const rows = await getAllRecordings();
  if (!rows.length) {
    view.innerHTML = `<div class="empty">${t('logEmpty')}</div>`;
    return;
  }
  view.innerHTML = buildVoiceProfile(rows) + `<div class="section-title">${esc(t('logTitle', { n: rows.length }))}</div>` + rows.map((r) => `
    <div class="log-item" data-id="${r.id}">
      <div class="log-head">
        <span class="log-date">${fmtFull(r.createdAt)}</span>
        <span class="log-meta">${Math.round(r.durationMs / 1000)}s ${r.favorite ? '· ★' : ''}</span>
      </div>
      ${r.topicLevel ? `<span class="lv-tag lv-${r.topicLevel}">${LEVEL_LABEL[r.topicLevel] || r.topicLevel}</span>` : ''}
      ${r.topicText ? `<div class="log-topic">${esc(r.topicText)}</div>` : ''}
      <div class="player" data-id="${r.id}"></div>
      <div class="log-controls">
        <button class="mini-btn" data-act="fav" data-id="${r.id}">${r.favorite ? esc(t('logUnfav')) : esc(t('logFav'))}</button>
        <button class="mini-btn" data-act="audio" data-id="${r.id}">${esc(t('logExport'))}</button>
        <button class="mini-btn" data-act="del" data-id="${r.id}">${esc(t('logDelete'))}</button>
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
        if (confirm(t('logDeleteConfirm'))) {
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
      <div class="vp-head">${esc(t('profileTitle'))}</div>
      <div class="vp-empty" style="color:#9a8f86;font-size:13px;line-height:1.7">${esc(t('profileEmpty'))}</div>
    </div>`;
  }
  const first = Math.min(...rows.map((r) => r.createdAt));
  const days = Math.max(1, Math.floor((Date.now() - first) / 864e5));
  const freq = {};
  rows.forEach((r) => {
    const tl = (r.topicText || '').trim();
    if (tl) freq[tl] = (freq[tl] || 0) + 1;
  });
  const top = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((x) => x[0]);
  return `
    <div class="voice-profile">
      <div class="vp-head">${esc(t('profileTitle'))}</div>
      <div class="vp-stats">
        <div class="vp-stat"><span class="vp-num">${count}</span><span class="vp-label">${esc(t('profileCount'))}</span></div>
        <div class="vp-stat"><span class="vp-num">${days}</span><span class="vp-label">${esc(t('profileFirst'))}</span></div>
      </div>
      ${top.length ? `<div class="vp-topics">${esc(t('profileTop'))}${top.map((tl) => `<span class="vp-chip">${esc(tl)}</span>`).join('')}</div>` : ''}
    </div>`;
}

// ---------------- 导出 ----------------
async function renderExport() {
  destroyPlayers();
  const rows = await getAllRecordings();
  view.innerHTML = `
    <div class="section-title">${esc(t('exportTitle'))}</div>
    <div class="field">
      <label>${esc(t('exportFormat'))}</label>
      <select id="fmt">
        <option value="md">${esc(t('exportMd'))}</option>
        <option value="txt">${esc(t('exportTxt'))}</option>
        <option value="json">${esc(t('exportJson'))}</option>
      </select>
    </div>
    <div class="field">
      <label>${esc(t('exportRange'))}</label>
      <select id="range">
        <option value="all">${esc(t('exportAll', { n: rows.length }))}</option>
        <option value="fav">${esc(t('exportFav'))}</option>
        <option value="week">${esc(t('exportWeek'))}</option>
      </select>
    </div>
    <button class="big-btn" id="doExport">${esc(t('exportBtn'))}</button>
    <div class="range-note">${esc(t('exportNote'))}</div>
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
    if (!out.length) { toast(t('exportEmpty')); return; }
    exportData(out, fmt);
    toast(t('exportDone'));
  };
}

// ---------------- 关于 ----------------
async function renderAbout() {
  destroyPlayers();
  view.innerHTML = `
    <div class="about">
      <div class="about-hero">
        <div class="about-jp">${esc(t('aboutJp'))}</div>
        <h1 class="about-title">${esc(t('aboutTitle'))}</h1>
        <div class="about-sub">${esc(t('aboutSub'))}</div>
      </div>

      <section class="promise">
        <p class="promise-line">${esc(t('promise1'))}</p>
        <p class="promise-line">${esc(t('promise2'))}</p>
        <p class="promise-line">${esc(t('promise3'))}</p>
        <p class="promise-leave">${esc(t('promise4'))}</p>
      </section>

      <section class="story">
        <p>${esc(t('story1'))}</p>
        <p>${esc(t('story2'))}</p>
        <p>${esc(t('story3'))}</p>
      </section>

      <section class="gourmet">
        <h2 class="gourmet-title">${esc(t('gourmetTitle'))}</h2>
        <p>${esc(t('gourmet1'))}</p>
        <p>${esc(t('gourmet2'))}</p>
      </section>

      <section class="about-foot">
        <p class="about-foot-note">${esc(t('aboutFoot'))}</p>
      </section>

      <details class="faq">
        <summary class="faq-q">${esc(t('faqQ'))}</summary>
        <div class="faq-a">
          <p>${esc(t('faqA1'))}</p>
          <ul>
            <li><b>${esc(t('faqA2'))}</b></li>
            <li><b>${esc(t('faqA3'))}</b></li>
            <li><b>${esc(t('faqA4'))}</b></li>
          </ul>
        </div>
      </details>
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
    navigator.serviceWorker.register('sw.js?v=20260901').catch(() => {});
  }
  await seedIfEmpty();
  await getMeta('onboarded');
  setRoute('home');
}
boot();
