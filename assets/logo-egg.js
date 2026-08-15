/*
 * logo-egg.js — RCJ Lab 主站吉祥物互动彩蛋（"会跑的 mascot"）
 *
 * 设计约束（来自需求文档）：
 *  - 原生 JS + CSS，不引入任何第三方库 / 游戏引擎 / 后端 / 数据库
 *  - 默认状态与原站完全一致；只在 .hero-mascot-img 上叠加互动能力
 *  - 移动用 transform + requestAnimationFrame，绝不改 top/left 引发布局重排
 *  - 状态机：IDLE → MOVING ⇄ RAGE → RETURNING → IDLE
 *  - 移动端用 tap（pointer/click）触发；touch-action:manipulation 关闭双击缩放
 */
(function () {
  'use strict';

  var mascot = document.querySelector('.hero-mascot-img');
  if (!mascot) return; // 页面没有吉祥物，安全退出

  var S = { IDLE: 'idle', MOVING: 'moving', RAGE: 'rage', RETURNING: 'returning' };
  var state = S.IDLE;

  // ---- 运动参数 ----
  var NORMAL_MIN = 150, NORMAL_MAX = 250; // px/s，按屏幕尺寸自适应微调
  var RAGE_MULT = 1.9;                    // 狂暴倍率（≈持续到 450）
  var RAGE_MS = 3000;                     // 狂暴持续 3s
  var AVOID_RADIUS = 90;                  // 鼠标靠近避让半径(px)
  var AVOID_FORCE = 170;                  // 避让转向强度
  var DBL_MS = 280;                       // 双击判定窗口

  var baseSpeed = 0;                      // 常态速度（进入时随机）
  var speed = 0;                         // 当前标量速度
  var dir = { x: 1, y: 0 };              // 单位方向
  var pos = { x: 0, y: 0 };              // 当前相对固定基线的位移(px)
  var baseline = { left: 0, top: 0, w: 0, h: 0 };
  var maxX = 0, maxY = 0;
  var pointer = { x: -9999, y: -9999, active: false };
  var rageUntil = 0;

  var rafId = null, lastT = 0;
  var singleTimer = null, lastClick = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  // ---- 进入自由移动 ----
  function enterFree() {
    var rect = mascot.getBoundingClientRect();
    baseline.left = rect.left; baseline.top = rect.top; baseline.w = rect.width; baseline.h = rect.height;
    maxX = Math.max(0, vw() - baseline.w);
    maxY = Math.max(0, vh() - baseline.h);

    // 固定在当前视口位置（脱离 hero 文档流，但不影响页面布局）
    mascot.style.position = 'fixed';
    mascot.style.left = baseline.left + 'px';
    mascot.style.top = baseline.top + 'px';
    mascot.style.width = baseline.w + 'px';
    mascot.style.height = baseline.h + 'px';
    mascot.style.margin = '0';
    mascot.style.zIndex = '9999';
    mascot.style.willChange = 'transform';
    mascot.style.animationPlayState = 'paused'; // 暂停原 heroFloat 漂浮动画
    mascot.classList.add('is-free');

    pos.x = 0; pos.y = 0;
    var ang = rand(0, Math.PI * 2);
    dir.x = Math.cos(ang); dir.y = Math.sin(ang);
    baseSpeed = rand(NORMAL_MIN, NORMAL_MAX) * Math.min(1.15, Math.max(0.8, vw() / 1280));
    speed = baseSpeed;

    state = S.MOVING;
    if (rafId == null) { lastT = performance.now(); rafId = requestAnimationFrame(tick); }
  }

  // ---- 主循环 ----
  function tick(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000) || 0;
    lastT = now;

    var nowRage = false;
    if (state === S.RAGE) {
      if (performance.now() < rageUntil) nowRage = true;
      else state = S.MOVING;
    }

    var target = baseSpeed;
    if (nowRage) target = Math.min(NORMAL_MAX * RAGE_MULT, baseSpeed * RAGE_MULT);
    speed += (target - speed) * Math.min(1, dt * 4); // 狂暴进出平滑过渡
    var vx = dir.x * speed, vy = dir.y * speed;

    // 鼠标/指针靠近：轻避让（不瞬移、不过度敏感）
    if (pointer.active) {
      var cx = baseline.left + pos.x + baseline.w / 2;
      var cy = baseline.top + pos.y + baseline.h / 2;
      var dx = cx - pointer.x, dy = cy - pointer.y;
      var dist = Math.hypot(dx, dy);
      if (dist < AVOID_RADIUS && dist > 0.001) {
        var f = (1 - dist / AVOID_RADIUS) * (AVOID_FORCE / speed);
        dir.x += (dx / dist) * f * dt * 6;
        dir.y += (dy / dist) * f * dt * 6;
        var m = Math.hypot(dir.x, dir.y) || 1;
        dir.x /= m; dir.y /= m;
      }
    }

    pos.x += vx * dt;
    pos.y += vy * dt;

    // 边界反弹（不穿透、不卡边、不抖动）
    if (pos.x <= 0) { pos.x = 0; dir.x = Math.abs(dir.x); }
    else if (pos.x >= maxX) { pos.x = maxX; dir.x = -Math.abs(dir.x); }
    if (pos.y <= 0) { pos.y = 0; dir.y = Math.abs(dir.y); }
    else if (pos.y >= maxY) { pos.y = maxY; dir.y = -Math.abs(dir.y); }

    mascot.style.transform = 'translate(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px)';

    if (state === S.MOVING || state === S.RAGE) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }

  // ---- 回到原位（轻微缩放回弹，≤500ms）----
  function returnHome() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    state = S.RETURNING;
    mascot.classList.remove('is-free');
    mascot.classList.add('is-returning');

    mascot.style.transition = 'none';
    mascot.style.transform = 'translate(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px) scale(0.82)';
    void mascot.offsetWidth; // 强制 reflow，让下一次 transform 走过渡
    mascot.style.transition = 'transform .42s cubic-bezier(0.34,1.56,0.64,1)';
    mascot.style.transform = 'translate(0px,0px) scale(1)';

    var done = function (e) {
      if (e && e.propertyName && e.propertyName !== 'transform') return;
      mascot.removeEventListener('transitionend', done);
      // 还原为文档流中的正常 mascot
      mascot.style.position = ''; mascot.style.left = ''; mascot.style.top = '';
      mascot.style.width = ''; mascot.style.height = '';
      mascot.style.margin = ''; mascot.style.zIndex = ''; mascot.style.willChange = '';
      mascot.style.transform = ''; mascot.style.transition = '';
      mascot.style.animationPlayState = ''; // 恢复 heroFloat 动画
      mascot.classList.remove('is-returning');
      state = S.IDLE;
    };
    mascot.addEventListener('transitionend', done);
    // 兜底：若 transitionend 未触发（如 reduced-motion），500ms 后强制还原
    setTimeout(function () { if (state === S.RETURNING) done(); }, 520);
  }

  // ---- 狂暴模式 ----
  function rage() {
    rageUntil = performance.now() + RAGE_MS;
    state = S.RAGE;
    if (rafId == null) { lastT = performance.now(); rafId = requestAnimationFrame(tick); }
  }

  // ---- 触发：单击切换 / 双击狂暴 ----
  function onClick(e) {
    e.preventDefault(); // 阻止默认行为（如图片拖动）
    e.stopPropagation();
    var t = Date.now();
    if (t - lastClick < DBL_MS) {
      // 双击
      lastClick = 0;
      if (singleTimer) { clearTimeout(singleTimer); singleTimer = null; }
      if (state === S.IDLE) enterFree();
      rage();
      return;
    }
    lastClick = t;
    if (singleTimer) clearTimeout(singleTimer);
    singleTimer = setTimeout(function () {
      singleTimer = null;
      if (state === S.IDLE) enterFree();
      else if (state === S.MOVING || state === S.RAGE) returnHome();
    }, 260);
  }

  // ---- 指针（鼠标 hover 避让 / 触摸坐标）----
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') { pointer.active = false; pointer.x = -9999; pointer.y = -9999; }
  }, { passive: true });
  window.addEventListener('pointercancel', function () {
    pointer.active = false; pointer.x = -9999; pointer.y = -9999;
  }, { passive: true });

  // ---- 视口变化：重算边界并夹取 ----
  window.addEventListener('resize', function () {
    if (state === S.IDLE) return;
    maxX = Math.max(0, vw() - baseline.w);
    maxY = Math.max(0, vh() - baseline.h);
    if (pos.x > maxX) pos.x = maxX;
    if (pos.y > maxY) pos.y = maxY;
  }, { passive: true });

  // 绑定到吉祥物
  mascot.addEventListener('click', onClick);
})();
