// 此刻通勤 · 极简实时感 + 轻聊天
// 单一职责：拉快照、点 start/arrive、显示数字、时段门禁、聊天轮询。
(function () {
  'use strict';

  const API = '/api/moment';
  const CHAT = '/api/commute-chat';
  const LS_SESSION = 'rcj_moment_session_v1'; // {id, startedAt, mode, traffic}
  const LS_CLIENT = 'rcj_moment_client_v1';

  // 时段是否开放：以**后端返回**为准（后端已含 TEST_MODE 测试开关逻辑）。
  // 前端不再用本地时间硬判，避免和后端不一致。
  let serverOpen = true;

  // clientId：浏览器本地生成，用于 web 端软唯一性（防同一浏览器刷量）
  function getClientId() {
    let id = localStorage.getItem(LS_CLIENT);
    if (!id) {
      const b = new Uint8Array(12);
      crypto.getRandomValues(b);
      id = Array.from(b).map((x) => x.toString(36)).join('').slice(0, 16);
      localStorage.setItem(LS_CLIENT, id);
    }
    return id;
  }

  // ── 工具 ──
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString('zh-CN');
  const fmtDur = (sec) => {
    if (!sec) return '—';
    if (sec < 60) return sec + '″';
    const m = Math.floor(sec / 60);
    if (m < 60) return m + '′';
    const h = Math.floor(m / 60);
    return h + 'h' + (m % 60) + '′';
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function loadSession() {
    try { const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); return s || null; }
    catch { return null; }
  }
  function saveSession(s) {
    if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s));
    else localStorage.removeItem(LS_SESSION);
  }

  // ── 视图：数字 / 统计 / 按钮态切换 ──
  function renderCount(snap) {
    const n = (snap && Number(snap.active)) || 0;
    $('mNum').textContent = n > 0 ? fmt(n) : '0';
    const s = (snap && snap.stats) || {};
    $('mStatDone').textContent = s.doneToday || 0;
    $('mStatMin').textContent = fmtDur(s.minSec);
    $('mStatMax').textContent = fmtDur(s.maxSec);
    $('mStatAvg').textContent = fmtDur(s.avgSec);
    if (snap && Array.isArray(snap.hourly)) renderSparkline(snap.hourly);
    if (typeof snap.open === 'boolean') serverOpen = snap.open;
  }

  // 极简折线图：今日各小时完成通勤人数（24 点）
  function renderSparkline(data) {
    const wrap = $('mSpark');
    if (!wrap) return;
    const W = 280, H = 64, pad = 6;
    const max = Math.max(1, ...data);
    const step = (W - pad * 2) / 23;
    const pts = data.map((v, i) => {
      const x = pad + i * step;
      const y = H - pad - (v / max) * (H - pad * 2);
      return [x, y];
    });
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `M${pad} ${H - pad} ` + pts.map((p) => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ` L${W - pad} ${H - pad} Z`;
    // 高亮当前小时
    const cur = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
    const dot = pts[cur];
    wrap.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${area}" fill="var(--signal-weak)" opacity="0.7"/>
        <path d="${line}" fill="none" stroke="var(--signal)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dot ? `<circle cx="${dot[0].toFixed(1)}" cy="${dot[1].toFixed(1)}" r="3.2" fill="var(--signal)" stroke="var(--bg)" stroke-width="1.5"/>` : ''}
      </svg>`;
    const peak = data.indexOf(max);
    wrap.setAttribute('title', `今日各小时完成人数 · 高峰 ${String(peak).padStart(2, '0')}:00（${max} 人）`);
  }

  function showIdle() {
    $('mActionIdle').hidden = false;
    $('mActionOn').hidden = true;
  }
  function showOn(session) {
    $('mActionIdle').hidden = true;
    $('mActionOn').hidden = false;
  }

  function setBtnLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = !!loading;
    const span = btn.querySelector('.m-btn-label');
    if (span) {
      span.textContent = label;
      if (loading) span.setAttribute('data-loading', '');
      else span.removeAttribute('data-loading');
    }
  }

  // ── 网络 ──
  async function fetchSnap() {
    const r = await fetch(API, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('网络异常 ' + r.status);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '服务异常');
    return j;
  }
  async function postAction(body) {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      const err = new Error(j.error || ('网络异常 ' + r.status));
      err.code = j.code || '';
      throw err;
    }
    return j;
  }

  // ── 计时器 ──
  let timerHandle = null;
  function startTimer(startedAt) {
    stopTimer();
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      $('mTimer').textContent = `${mm}:${ss}`;
    };
    tick();
    timerHandle = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  // ── chip 单选（方式/路况）──
  let pickedMode = '';
  let pickedTraffic = '';
  function bindChips(containerId, key, getVal) {
    const box = $(containerId);
    if (!box) return;
    box.querySelectorAll('.m-chip').forEach((b) => {
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        box.querySelectorAll('.m-chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        if (!on) { b.setAttribute('aria-pressed', 'true'); window[key] = getVal(b); }
        else { window[key] = ''; }
      });
    });
  }
  function resetChips() {
    ['mModeChips', 'mTrafficChips'].forEach((id) => {
      const box = $(id); if (box) box.querySelectorAll('.m-chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    });
    pickedMode = ''; pickedTraffic = '';
  }

  // ── 主流程 ──
  async function onStart() {
    const btn = $('mBtnStart');
    // 时段门禁以**后端返回**为准（含 TEST_MODE 测试开关）
    if (!serverOpen) { showErr('现在不是通勤时段（开放：早 6–10、晚 6–10）'); return; }
    setBtnLoading(btn, true, '正在加入…');
    // 立即本地起表：用本地时间起算，不等后端回包，消除点击后不计时的问题
    const localStart = Date.now();
    const session = { id: '', startedAt: new Date(localStart).toISOString(), mode: pickedMode, traffic: pickedTraffic };
    showOn(session);
    startTimer(localStart);
    try {
      const j = await postAction({ action: 'start', clientId: getClientId(), mode: pickedMode, traffic: pickedTraffic });
      session.id = j.id || session.id;
      // 若后端有更准的 startedAt 且差距不大，以本地为准（避免秒级跳动）
      saveSession(session);
      renderCount(j);
    } catch (e) {
      if (e.code === 'RECENT_EXISTS') {
        // 2h 内已记录过：复位按钮
        stopTimer(); showIdle(); resetChips(); showErr('你最近 2 小时内已经记录过一次通勤啦，稍后再来～');
        return;
      }
      // 其他错误：回退到 idle（但不清计时，已显示 on 状态；保守起见复位）
      stopTimer(); showIdle();
      showErr(e.message);
    } finally {
      setBtnLoading(btn, false, '我出发了');
    }
  }

  async function onArrive() {
    const btn = $('mBtnArrive');
    const sess = loadSession();
    if (!sess) { showErr('没有进行中的记录'); return; }
    setBtnLoading(btn, true, '记录中…');
    try {
      const j = await postAction({ action: 'arrive', id: sess.id });
      stopTimer();
      saveSession(null);
      renderCount(j);
      showIdle();
      showOk(`已记录 · 通勤 ${formatDur(j.durationSec || 0)}`);
    } catch (e) {
      showErr(e.message);
    } finally {
      setBtnLoading(btn, false, '我到了');
    }
  }

  async function onCancel() {
    const sess = loadSession();
    if (!sess) return;
    if (!confirm('撤销这次记录？')) return;
    try {
      const j = await postAction({ action: 'leave', id: sess.id });
      stopTimer();
      saveSession(null);
      renderCount(j);
      showIdle();
    } catch (e) {
      showErr(e.message);
    }
  }

  function formatDur(sec) {
    if (sec < 60) return `${sec} 秒`;
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    return `${h} 小时 ${m % 60} 分钟`;
  }

  function ensureHintLine() {
    if (!$('mErr')) {
      const p = document.createElement('p');
      p.id = 'mErr'; p.className = 'm-err'; p.setAttribute('role', 'status');
      $('mHint').after(p);
    }
  }
  function showErr(msg) { ensureHintLine(); const e = $('mErr'); e.style.color = '#b91c1c'; e.textContent = msg || ''; }
  function showOk(msg) { ensureHintLine(); const e = $('mErr'); e.style.color = 'var(--ink-3)'; e.textContent = msg || ''; }

  // ════════════ 轻聊天 ════════════
  const chat = {
    items: [],
    knownIds: new Set(),
    lastCreatedAt: null,
    closed: false,
  };

  function chatTimeLabel(iso) {
    try {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch { return ''; }
  }

  function renderChat(initial) {
    const win = $('mChatWindow');
    const empty = $('mChatEmpty');
    // 仅渲染新条目（追加），避免重排闪烁
    const newOnes = chat.items.filter((it) => !chat.knownIds.has(it.id));
    if (newOnes.length) {
      if (empty) empty.remove();
      const nearBottom = win.scrollHeight - win.scrollTop - win.clientHeight < 60;
      for (const it of newOnes) {
        chat.knownIds.add(it.id);
        const row = document.createElement('div');
        row.className = 'm-chat-row';
        const t = document.createElement('span');
        t.className = 'm-chat-time';
        t.textContent = chatTimeLabel(it.createdAt);
        const b = document.createElement('span');
        b.className = 'm-chat-text';
        b.textContent = it.text; // textContent 防 XSS
        row.appendChild(t); row.appendChild(b);
        win.appendChild(row);
      }
      if (initial || nearBottom) win.scrollTop = win.scrollHeight;
    }
  }

  async function loadChat() {
    try {
      const r = await fetch(CHAT, { method: 'GET', headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (!j.ok) {
        if (j.code === 'CLOSED' || j.open === false) chatShowClosed();
        return;
      }
      if (j.open === false) { chatShowClosed(); return; }
      chat.items = j.items || [];
      renderChat(true);
    } catch { /* 静默 */ }
  }

  function chatShowClosed() {
    if (chat.closed) return;
    chat.closed = true;
    const form = $('mChatForm');
    if (form) form.hidden = true;
    const win = $('mChatWindow');
    if (win) {
      win.innerHTML = '<div class="m-chat-closed">🌙 现在不是通勤时段<br>开放时间：早 6–10 点、晚 6–10 点</div>';
    }
  }

  async function sendChat() {
    const input = $('mChatInput');
    const btn = $('mChatSend');
    const text = input.value.trim();
    if (!text) return;
    btn.disabled = true;
    try {
      const r = await fetch(CHAT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ text, clientId: getClientId() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        if (j.code === 'CLOSED') { chatShowClosed(); return; }
        if (j.code === 'RATE_LIMIT') { showChatQuota(`请 ${j.left} 秒后再发`); return; }
        if (j.code === 'DAILY_LIMIT') { showChatQuota('今日发言已达上限'); return; }
        showChatQuota(j.error || '发送失败');
        return;
      }
      input.value = '';
      $('mChatLen').textContent = '0';
      if (typeof j.remaining === 'number') showChatQuota(`今日还可发 ${j.remaining} 条`);
      // 立即拉一次，确保自己的消息出现在窗口
      await loadChat();
    } catch {
      showChatQuota('网络异常');
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  let quotaTimer = null;
  function showChatQuota(msg) {
    const el = $('mChatQuota');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.style.color = '#b91c1c';
    clearTimeout(quotaTimer);
    quotaTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  function bindChat() {
    const input = $('mChatInput');
    const send = $('mChatSend');
    if (input) {
      input.addEventListener('input', () => { $('mChatLen').textContent = String(input.value.length); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
      input.addEventListener('compositionstart', () => { input._composing = true; });
      input.addEventListener('compositionend', () => { input._composing = false; $('mChatLen').textContent = String(input.value.length); });
    }
    if (send) send.addEventListener('click', sendChat);
  }

  // ── 启动 ──
  async function bootstrap() {
    requestAnimationFrame(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));

    const burger = $('navBurger'), menu = $('navMenu');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', open ? 'false' : 'true');
        menu.classList.toggle('open', !open);
      });
    }

    $('mBtnStart').addEventListener('click', onStart);
    $('mBtnArrive').addEventListener('click', onArrive);
    $('mBtnCancel').addEventListener('click', onCancel);
    bindChips('mModeChips', 'pickedMode', (b) => b.dataset.mode);
    bindChips('mTrafficChips', 'pickedTraffic', (b) => b.dataset.traffic);
    bindChat();

    let snap = null;
    try { snap = await fetchSnap(); renderCount(snap); }
    catch (e) { /* 静默首屏失败，UI 仍可点 */ }
    // 非开放时段（且非测试模式）：禁用「我出发了」
    if (snap && snap.open === false) {
      const sb = $('mBtnStart');
      if (sb) { sb.disabled = true; sb.querySelector('.m-btn-label').textContent = '非通勤时段'; }
    }

    const sess = loadSession();
    if (sess) {
      try {
        const live = await postAction({ action: 'start', id: sess.id });
        pickedMode = sess.mode || '';
        pickedTraffic = sess.traffic || '';
        saveSession({ id: sess.id, startedAt: sess.startedAt, mode: pickedMode, traffic: pickedTraffic });
        showOn(sess);
        startTimer(new Date(sess.startedAt).getTime());
        renderCount(live);
        return;
      } catch (e) {
        saveSession(null);
      }
    }
    resetChips();
    showIdle();

    // 聊天：首屏加载 + 5s 轮询（测试期全开放，非时段才关闭）
    await loadChat();
    setInterval(loadChat, 5000);
  }

  // 轮询刷新：每 15s 拉一次快照
  setInterval(async () => {
    try { const s = await fetchSnap(); renderCount(s); }
    catch { /* 静默 */ }
  }, 15000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchSnap().then(renderCount).catch(() => {});
    }
  });

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
