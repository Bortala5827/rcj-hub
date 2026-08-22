// playground/commute · 极简实时感
// 单一职责：拉快照、点 start/arrive、显示数字。其它都是装饰。
(function () {
  'use strict';

  const API = '/api/moment';
  const LS_CITY = 'rcj_moment_city_v1';
  const LS_SESSION = 'rcj_moment_session_v1'; // {id, startedAt, city}

  // 第一版 16 个城市（克制起步，不堆）
  const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '苏州',
                  '武汉', '西安', '重庆', '长沙', '厦门', '青岛', '天津', '其他'];

  // ── 工具 ──
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString('zh-CN');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function loadSession() {
    try { const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); return s || null; }
    catch { return null; }
  }
  function saveSession(s) {
    if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s));
    else localStorage.removeItem(LS_SESSION);
  }

  // ── 视图：数字 / 城市行 / 按钮态切换 ──
  function renderCount(snap) {
    const n = (snap && Number(snap.active)) || 0;
    $('mNum').textContent = n > 0 ? fmt(n) : '0';
    const cities = (snap && snap.byCity) || {};
    const keys = Object.keys(cities).filter((k) => cities[k] > 0);
    if (keys.length === 0) {
      $('mCities').hidden = true;
    } else {
      $('mCities').hidden = false;
      keys.sort((a, b) => cities[b] - cities[a]);
      const top = keys.slice(0, 4);
      $('mCitiesList').innerHTML = top
        .map((k) => `<span class="m-city-chip"><b>${k}</b>${fmt(cities[k])}</span>`)
        .join('');
    }
  }

  function showIdle() {
    $('mActionIdle').hidden = false;
    $('mActionOn').hidden = true;
  }
  function showOn(session) {
    $('mActionIdle').hidden = true;
    $('mActionOn').hidden = false;
    $('mOnCity').textContent = session.city || '未选城市';
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

  // ── 城市 sheet ──
  function openSheet() {
    const grid = $('mCitiesGrid');
    const cur = localStorage.getItem(LS_CITY) || '';
    grid.innerHTML = CITIES.map((c) =>
      `<button type="button" data-c="${c}" aria-pressed="${c === cur ? 'true' : 'false'}">${c}</button>`
    ).join('');
    const sheet = $('mSheet');
    sheet.hidden = false;          // 兜底，避免某些浏览器 display 处理差异
    sheet.classList.add('is-open');
    grid.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const c = b.dataset.c;
        localStorage.setItem(LS_CITY, c);
        const sess = loadSession();
        if (sess) saveSession({ ...sess, city: c });
        closeSheet();
        // 如果当前在通勤中，立刻刷新城市显示
        if (sess) $('mOnCity').textContent = c;
      });
    });
  }
  function closeSheet() {
    const sheet = $('mSheet');
    sheet.classList.remove('is-open');
    sheet.hidden = true;
  }

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
      const city = localStorage.getItem(LS_CITY) || '';
      const j = await postAction({ action: 'start', city, mode: pickedMode, traffic: pickedTraffic });
      const session = { id: j.id, startedAt: j.startedAt || new Date().toISOString(), city, mode: pickedMode, traffic: pickedTraffic };
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
    $('mBtnCity').addEventListener('click', openSheet);
    document.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
    $('mSheetSkip').addEventListener('click', closeSheet);
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
        const live = await postAction({ action: 'start', id: sess.id, city: sess.city || '' });
        // 命中恢复
        pickedMode = sess.mode || '';
        pickedTraffic = sess.traffic || '';
        saveSession({ id: sess.id, startedAt: sess.startedAt, city: sess.city || '', mode: pickedMode, traffic: pickedTraffic });
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
