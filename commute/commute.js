// playground/commute · 极简实时感
// 单一职责：拉快照、点 start/arrive、显示数字。其它都是装饰。
(function () {
  'use strict';

  const API = '/api/moment';
  const LS_SESSION = 'rcj_moment_session_v1'; // {id, startedAt, mode, traffic}
  const LS_CLIENT = 'rcj_moment_client_v1';

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
    if (!r.ok || !j.ok) throw new Error(j.error || ('网络异常 ' + r.status));
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
    setBtnLoading(btn, true, '正在加入…');
    try {
      const j = await postAction({ action: 'start', clientId: getClientId(), mode: pickedMode, traffic: pickedTraffic });
      const session = { id: j.id, startedAt: j.startedAt || new Date().toISOString(), mode: pickedMode, traffic: pickedTraffic };
      saveSession(session);
      renderCount(j);
      showOn(session);
      startTimer(session.startedAt);
    } catch (e) {
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
    // 复用 mHint 区域做轻提示（成功/错误），不额外塞 DOM
    if (!$('mErr')) {
      const p = document.createElement('p');
      p.id = 'mErr'; p.className = 'm-err'; p.setAttribute('role', 'status');
      $('mHint').after(p);
    }
  }
  function showErr(msg) { ensureHintLine(); const e = $('mErr'); e.style.color = '#b91c1c'; e.textContent = msg || ''; }
  function showOk(msg) { ensureHintLine(); const e = $('mErr'); e.style.color = 'var(--ink-3)'; e.textContent = msg || ''; }

  // ── 启动 ──
  async function bootstrap() {
    // reveal 简单延迟
    requestAnimationFrame(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));

    // 顶栏菜单
    const burger = $('navBurger'), menu = $('navMenu');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', open ? 'false' : 'true');
        menu.classList.toggle('open', !open);
      });
    }

    // 绑定
    $('mBtnStart').addEventListener('click', onStart);
    $('mBtnArrive').addEventListener('click', onArrive);
    $('mBtnCancel').addEventListener('click', onCancel);
    // chip 单选绑定
    bindChips('mModeChips', 'pickedMode', (b) => b.dataset.mode);
    bindChips('mTrafficChips', 'pickedTraffic', (b) => b.dataset.traffic);

    // 拉快照（先静默一次）
    let snap = null;
    try { snap = await fetchSnap(); renderCount(snap); }
    catch (e) { /* 静默首屏失败，UI 仍可点 */ }

    // 恢复本地 session（如果仍 active）
    const sess = loadSession();
    if (sess) {
      // 用服务端活跃列表确认会话还活着
      try {
        const live = await postAction({ action: 'start', id: sess.id });
        // 命中恢复
        pickedMode = sess.mode || '';
        pickedTraffic = sess.traffic || '';
        saveSession({ id: sess.id, startedAt: sess.startedAt, mode: pickedMode, traffic: pickedTraffic });
        showOn(sess);
        startTimer(sess.startedAt);
        renderCount(live);
        return;
      } catch (e) {
        // 已超时或被清，恢复 idle
        saveSession(null);
      }
    }
    resetChips();
    showIdle();
  }

  // 轮询刷新：每 15s 拉一次快照，仅更新数字；通勤中不动
  setInterval(async () => {
    try { const s = await fetchSnap(); renderCount(s); }
    catch { /* 静默 */ }
  }, 15000);

  // 回到页面时立刻刷一次
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchSnap().then(renderCount).catch(() => {});
    }
  });

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
