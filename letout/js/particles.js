// LetOut 背景粒子：自托管 tsParticles（slim bundle）封装
// 设计原则（对齐 noomo 的「微动态氛围」+ 克制）：
//   1. 零构建、零外部 CDN —— bundle 随仓库部署（国内不走 jsdelivr，避免加载失败）
//   2. 情绪叙事 —— 切换情绪时粒子颜色随 --mode-live 换色
//   3. 省电 —— 录音时 pause()，避免移动端小米等老旧内核卡顿/耗电（之前踩过坑）
//   4. 降级 —— 系统「减少动态」或低端机直接不加载
// 加载方式：index.html 用 <script defer> 加载 UMD bundle（挂全局 window.tsParticles / window.loadSlim），
//           本模块直接读取全局，无需 import（UMD 非 ESM，import() 会失败）

let instance = null;
let ready = false;
let pendingColor = '#e07850';

function buildOptions(color) {
  return {
    fullScreen: { enable: false },
    background: { color: 'transparent' },
    fpsLimit: 30,
    detectRetina: true,
    particles: {
      number: { value: 46, density: { enable: true, area: 900 } },
      color: { value: [color, '#ffffff'] },
      opacity: { value: { min: 0.12, max: 0.4 } },
      size: { value: { min: 1, max: 3 } },
      links: { enable: false },
      move: {
        enable: true,
        speed: 0.5,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'out' },
      },
    },
    interactivity: {
      events: { onHover: { enable: false }, onClick: { enable: false } },
    },
  };
}

function getEngine() {
  const tp = window.tsParticles || globalThis.tsParticles;
  const ls = window.loadSlim || globalThis.loadSlim;
  if (tp && ls) return { tp, ls };
  return null;
}

export async function initParticles() {
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return;

  try {
    const eng = getEngine();
    if (!eng) {
      console.warn('[particles] tsParticles bundle 未加载');
      return;
    }
    await eng.ls(eng.tp); // 注册 slim 预设到单例
    const color =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--mode-live').trim() || pendingColor;
    instance = await eng.tp.load({ id: 'bg-particles', options: buildOptions(color) });
    ready = true;
  } catch (e) {
    console.warn('[particles] init skipped:', e && e.message);
  }
}

export function setParticleEmotion(color) {
  pendingColor = color || pendingColor;
  if (!ready || !instance) return;
  try {
    instance.options.particles.color.value = [color, '#ffffff'];
    if (instance.refresh) instance.refresh();
  } catch (_) {
    /* 换色失败不影响录音 */
  }
}

export function pauseParticles() {
  if (instance && instance.pause) instance.pause();
}
export function resumeParticles() {
  if (instance && instance.play) instance.play();
}

// 暴露给 app.js（window.__particles?.xxx 可选链调用，未就绪也不崩）
window.__particles = {
  setEmotion: setParticleEmotion,
  pause: pauseParticles,
  resume: resumeParticles,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initParticles);
} else {
  initParticles();
}
