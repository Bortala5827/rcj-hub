// app.js — SPA 主逻辑（今天 / 声音日志 / 导出）
import {
  putRecording, getAllRecordings, deleteRecording, setFavorite, getMeta, putMeta,
} from './db.js';
import { Recorder } from './recorder.js?v=20260813b';
import { renderWave, fitCanvas, lerpHex, mountLiveBars } from './waveform.js?v=20260816a';
import { mountPlayer } from './player.js?v=20260813a';
import { seedIfEmpty, getTopic, nextTopic, GREETING_JP, GREETING_CN } from './topics.js';
import { getTodayGoal, addSpoken, getDailyGoalMin, setDailyGoalMin } from './goals.js';
import { exportData, exportAudio } from './export.js';
import { getDailyQuote, getLanguageQuote, nextLanguageQuote } from './quotes.20260814.js';
import { markHighVolumeToday } from './streak.js';

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');

let route = 'home';
let currentTopic = null;
let recorder = null;
let liveStop = null;
let recStartTs = 0;
const players = new Set(); // 活跃 player，切页时销毁

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

  const lq = getLanguageQuote();
  view.innerHTML = `
    <div class="greeting-jp">${GREETING_JP}</div>
    <div class="greeting-cn">${GREETING_CN}</div>
    <div class="quote" id="homeQuote">
      <span class="quote-tag" id="quoteTag">${esc(lq.type)}</span>
      <span class="quote-text">"${esc(lq.text)}"</span>
      <span class="quote-author">—— ${esc(lq.author)}</span>
      <button class="quote-next" id="quoteNext" title="换一条">↻</button>
    </div>

    <div class="goal">
      <div class="goal-top">
        <span class="goal-label">今天，也听听自己的声音。</span>
        <button class="link-btn" id="setGoal">改目标</button>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-stats">
        <span><b>${fmtMMSS(goal.doneSec || 0)}</b> / ${fmtMMSS(targetMin * 60)}</span>
        <span class="goal-streak">连续 ${goal.streak} 天</span>
      </div>
      ${makeupNote ? `<div class="goal-makeup">${makeupNote}</div>` : ''}
    </div>

    <div class="topic-card">
      <div class="topic-label">今天的话题</div>
      <div class="topic-text" id="topicText">${currentTopic ? esc(currentTopic.text) : '（暂无话题）'}</div>
      <div class="topic-actions">
        <button class="link-btn" id="swapTopic">换一个</button>
        <button class="link-btn" id="aiTopic">✨ AI 出题</button>
      </div>
    </div>

    <div class="record-zone">
      <canvas class="wave-canvas" id="liveWave"></canvas>
      <div class="vol-meter-live"><div class="vml-fill" id="volMeterFill"></div></div>
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

  // 联网随机话题：用自备 Key 的 LLM 即时生成生活化话题（数据不出本机）
  document.getElementById('aiTopic').onclick = async () => {
    const ai = window.RCJ_AI;
    const btn = document.getElementById('aiTopic');
    const txt = document.getElementById('topicText');
    if (!ai) return;
    const cfg = ai.load();
    if (!cfg.enabled || !cfg.key || !cfg.baseUrl || !cfg.model) {
      ai.openSettings();
      toast('想用 AI 出题？先点右上角 ⚙ 填一个自备 Key');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '✨ 出题中…'; }
    try {
      const out = await ai.callLlm({
        system: '你是 SoloSpeak（独声）的选题助手。SoloSpeak 是一个人独处时开口练习表达的小工具，用户对着自己说话，不评分、不评判。',
        user: '请生成 1 个适合一个人独处时开口练习的、生活化、容易回答、没有标准答案的中文话题。只输出话题本身（不超过 30 字），不要序号、不要解释、不要引号。',
        maxTokens: 120, temperature: 0.9
      });
      let topic = (out || '').trim().replace(/^["'「」“”\s]+|["'「」“”\s]+$/g, '').replace(/^\d+[.、)]\s*/, '');
      if (!topic) { toast('AI 没给出话题，换个说法再试'); return; }
      currentTopic = { id: null, level: null, text: topic };
      if (txt) txt.textContent = topic;
    } catch (err) {
      toast('AI 出题失败：' + (err && err.message ? err.message : err));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ AI 出题'; }
    }
  };

  document.getElementById('quoteNext').onclick = () => {
    const q = nextLanguageQuote();
    const box = document.getElementById('homeQuote');
    if (box) {
      box.style.opacity = '0';
      setTimeout(() => {
        box.querySelector('.quote-tag').textContent = q.type;
        box.querySelector('.quote-text').textContent = `"${q.text}"`;
        box.querySelector('.quote-author').textContent = `—— ${q.author}`;
        box.style.opacity = '1';
      }, 150);
    }
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
      recorder.onLevel = (max) => {
        const fill = document.getElementById('volMeterFill');
        if (!fill) return;
        fill.style.width = Math.max(4, Math.round(max * 100)) + '%';
        let c = '#b9b3a8'; // 灰：低音量
        if (max >= 0.58) c = '#e3a857'; // 橙：高音量触发
        else if (max >= 0.25) c = '#6f9b8a'; // 绿：中音量
        fill.style.background = c;
      };
      // 启动录音引擎（同时创建 AudioContext + Analyser）
      await recorder.start();
      // 用自研频谱柱状图替代 wavesurfer 滚动波形，避免 1101/直线 bug
      fitCanvas(liveWave, 72);
      liveStop = mountLiveBars(liveWave, recorder.analyser, {
        colorFn: (v) => lerpHex('#6f9b8a', '#e3a857', Math.min(1, v * 1.5)),
      });
    } catch (e) {
      toast('独声需要麦克风权限');
      recorder = null;
      recState = 'idle';
      return;
    }
    // 启动期间用户已松开 -> 立即停
    if (recState === 'stopping') {
      if (liveStop) { liveStop(); liveStop = null; }
      await recorder.stop();
      recorder = null;
      recState = 'idle';
      return;
    }
    recState = 'recording';
    recBtn.classList.add('recording');
    recBtn.textContent = '■';
    recStartTs = Date.now();
    // 计时器：正计时 MM:SS，秒数实时跳动，反馈更明显
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
    toast('已留下你的声音');
    showFeedbackCard(result, { topicText: currentTopic ? currentTopic.text : null, streak });
  };

  // 录音结束反馈卡：音量小结 + 连击→FaceTalk 引导 + AI 引导（自备 Key）+ 今日金句
  function showFeedbackCard(result, meta) {
    const lvl = result.level || {};
    const peakPct = Math.round((lvl.max || 0) * 100);
    const durSec = Math.round(result.durationMs / 1000);
    const q = getDailyQuote();
    const high = !!lvl.highTriggered;
    const streak = meta.streak || 0;
    const letoutNote = high
      ? '状态打开了 🔥 这份劲儿，去 <a href="https://955827.xyz/letout/" target="_blank" rel="noopener">LetOut</a> 把情绪彻底释放一下 →'
      : '想更放得开一点，可以试试 <a href="https://955827.xyz/letout/" target="_blank" rel="noopener">LetOut</a> 释放一下 →';
    const faceTalkBanner = streak >= 3
      ? `<div class="ft-banner">连续 ${streak} 天，你都放得很开 🔥<br>想试试对着真人练？去 <a href="https://facetalk.955827.xyz/" target="_blank" rel="noopener">FaceTalk · 面试搭子</a> 真人对练一下 →</div>`
      : '';
    view.innerHTML = `
      <div class="recap">
        <div class="recap-head">这次开口，留下来了</div>
        <div class="recap-meta">${durSec} 秒${meta.topicText ? ' · ' + esc(meta.topicText) : ''}</div>
        <div class="vol-card">
          <div class="vol-row"><span>音量峰值</span><b>${peakPct}%</b></div>
          <div class="vol-meter"><div class="vol-fill" style="width:${peakPct}%"></div></div>
          <div class="vol-note">${letoutNote}</div>
        </div>
        ${faceTalkBanner}
        <div class="ai-guide" id="aiGuide"></div>
        <div class="recap-quote">今日金句 · ${esc(q.author)}：${esc(q.text)}</div>
        <div class="recap-actions">
          <button class="big-btn" id="recapBack">回到今天</button>
        </div>
      </div>`;
    if (window.RCJ_AI) {
      window.RCJ_AI.mountAiGuide(document.getElementById('aiGuide'), {
        durationMs: result.durationMs, level: lvl, topicText: meta.topicText,
      });
    }
    document.getElementById('recapBack').onclick = () => renderHome();
  }

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

      <details class="faq">
        <summary class="faq-q">录音按钮不显示 / 无法录音？</summary>
        <div class="faq-a">
          <p>多半是浏览器缓存了旧版本，或权限/兼容问题：</p>
          <ul>
            <li><b>缓存了旧版</b>：小米、部分安卓自带浏览器会长期缓存旧 JS。清「浏览记录」通常无效，需在浏览器对该站点的设置里<b>清除「所有缓存 / 存储空间」</b>（或卸载重装 PWA）。</li>
            <li><b>麦克风权限</b>：检查地址栏是否允许麦克风；被禁用的话录音按钮不会出现。</li>
            <li><b>浏览器不兼容</b>：换 Chrome、夸克等较新内核通常即可。</li>
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
    navigator.serviceWorker.register('sw.js?v=20260814v7').catch(() => {});
  }
  await seedIfEmpty();
  await getMeta('onboarded'); // 预留
  setRoute('home');
}
boot();
