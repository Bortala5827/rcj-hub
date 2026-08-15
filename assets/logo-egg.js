/*
 * logo-egg.js — RCJ Lab 主站吉祥物互动彩蛋（"会跑的 mascot"）
 *
 * 设计约束（来自需求文档）：
 *  - 原生 JS + CSS，不引入任何第三方库 / 游戏引擎 / 后端 / 数据库
 *  - 默认状态 mascot 退为背景氛围元素（低透明度、在文字之后）
 *  - 点击后在 .hero 容器内缓慢漫游、撞边反弹；再点回到原位
 *  - 移动用 transform + requestAnimationFrame，绝不改 top/left 引发布局重排
 *  - 状态机：IDLE → MOVING ⇄ RAGE → RETURNING → IDLE
 *  - 移动端用 tap（pointer/click）触发；touch-action:manipulation 关闭双击缩放
 */
(function () {
  'use strict';

  var box = document.querySelector('.hero-mascot');
  var img = document.querySelector('.hero-mascot-img');
  if (!box || !img) return;

  var hero = box.closest('.hero');
  if (!hero) hero = document.body;

  var S = { IDLE: 'idle', MOVING: 'moving', RAGE: 'rage', RETURNING: 'returning' };
  var state = S.IDLE;

  // ---- 运动参数（背景漫游：更慢、更克制）----
  var NORMAL_MIN = 55, NORMAL_MAX = 110; // px/s，hero 容器内漫游
  var RAGE_MULT = 2.2;                   // 狂暴倍率
  var RAGE_MS = 3000;                    // 狂暴持续 3s
  var AVOID_RADIUS = 70;                 // 鼠标靠近避让半径(px)
  var AVOID_FORCE = 90;                  // 避让转向强度（背景模式更轻）
  var DBL_MS = 280;                      // 双击判定窗口

  var baseSpeed = 0;
  var speed = 0;
  var dir = { x: 1, y: 0 };
  var pos = { x: 0, y: 0 };   // 相对 enterFree 时位置的位移
  var baseline = { left: 0, top: 0, w: 0, h: 0 };
  var minX = 0, maxX = 0, minY = 0, maxY = 0;
  var pointer = { x: -9999, y: -9999, active: false };
  var rageUntil = 0;

  var rafId = null, lastT = 0;
  var singleTimer = null, lastClick = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---- 计算 hero 容器边界 ----
  function updateBounds() {
    var heroRect = hero.getBoundingClientRect();
    maxX = Math.max(0, heroRect.width - baseline.w);
    maxY = Math.max(0, heroRect.height - baseline.h);
    minX = -baseline.left;
    minY = -baseline.top;
  }

  // ---- 进入自由移动（在 hero 容器内漫游）----
  function enterFree() {
    var heroRect = hero.getBoundingClientRect();
    var rect = box.getBoundingClientRect();

    // 记录进入瞬间相对 hero 的基准位置
    baseline.left = rect.left - heroRect.left;
    baseline.top = rect.top - heroRect.top;
    baseline.w = rect.width;
    baseline.h = rect.height;

    updateBounds();

    // 把容器锚定在 hero 内的当前坐标（后续用 transform 位移）
    box.style.left = baseline.left + 'px';
    box.style.top = baseline.top + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
    box.style.margin = '0';
    box.classList.add('is-free');

    // 暂停内部图片的漂浮动画，避免其 transform 与容器运动叠加
    img.style.animation = 'none';

    pos.x = 0; pos.y = 0;
    var ang = rand(0, Math.PI * 2);
    dir.x = Math.cos(ang); dir.y = Math.sin(ang);
    baseSpeed = rand(NORMAL_MIN, NORMAL_MAX);
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
    speed += (target - speed) * Math.min(1, dt * 4);
    var vx = dir.x * speed, vy = dir.y * speed;

    // 鼠标/指针靠近：轻避让（不瞬移、不过度敏感）
    if (pointer.active) {
      var heroRect = hero.getBoundingClientRect();
      var cx = heroRect.left + baseline.left + pos.x + baseline.w / 2;
      var cy = heroRect.top + baseline.top + pos.y + baseline.h / 2;
      var dx = cx - pointer.x, dy = cy - pointer.y;
      var dist = Math.hypot(dx, dy);
      if (dist < AVOID_RADIUS && dist > 0.001) {
        var f = (1 - dist / AVOID_RADIUS) * (AVOID_FORCE / Math.max(speed, 30));
        dir.x += (dx / dist) * f * dt * 5;
        dir.y += (dy / dist) * f * dt * 5;
        var m = Math.hypot(dir.x, dir.y) || 1;
        dir.x /= m; dir.y /= m;
      }
    }

    pos.x += vx * dt;
    pos.y += vy * dt;

    // 边界反弹（不穿透、不卡边、不抖动）
    if (pos.x <= minX) { pos.x = minX; dir.x = Math.abs(dir.x); }
    else if (pos.x >= maxX) { pos.x = maxX; dir.x = -Math.abs(dir.x); }
    if (pos.y <= minY) { pos.y = minY; dir.y = Math.abs(dir.y); }
    else if (pos.y >= maxY) { pos.y = maxY; dir.y = -Math.abs(dir.y); }

    box.style.transform = 'translate(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px)';

    if (state === S.MOVING || state === S.RAGE) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }

  // ---- 回到原位（轻微缩放回弹，≤500ms）----
  function returnHome() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    state = S.RETURNING;
    box.classList.remove('is-free');
    box.classList.add('is-returning');

    box.style.transition = 'none';
    box.style.transform = 'translate(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px) scale(0.85)';
    void box.offsetWidth;
    box.style.transition = 'transform .45s cubic-bezier(0.34,1.56,0.64,1), opacity .35s ease';
    box.style.transform = 'translate(0px,0px) scale(1)';

    var done = function (e) {
      if (e && e.propertyName && e.propertyName !== 'transform') return;
      box.removeEventListener('transitionend', done);
      // 还原为文档流中的正常 mascot
      box.style.left = ''; box.style.top = '';
      box.style.right = ''; box.style.bottom = '';
      box.style.margin = ''; box.style.transform = ''; box.style.transition = '';
      box.classList.remove('is-returning');
      img.style.animation = ''; // 恢复 heroFloat 漂浮动画
      state = S.IDLE;
    };
    box.addEventListener('transitionend', done);
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
    e.preventDefault();
    e.stopPropagation();
    var t = Date.now();
    if (t - lastClick < DBL_MS) {
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

  // ---- 容器/视口变化：重算边界并夹取 ----
  window.addEventListener('resize', function () {
    if (state === S.IDLE) return;
    var heroRect = hero.getBoundingClientRect();
    maxX = Math.max(0, heroRect.width - baseline.w);
    maxY = Math.max(0, heroRect.height - baseline.h);
    minX = -baseline.left; minY = -baseline.top;
    if (pos.x > maxX) pos.x = maxX;
    if (pos.x < minX) pos.x = minX;
    if (pos.y > maxY) pos.y = maxY;
    if (pos.y < minY) pos.y = minY;
  }, { passive: true });

  box.addEventListener('click', onClick);
})();
