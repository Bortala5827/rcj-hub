// ghost-guide.js — 计时器上方的极轻引导语，每 3 秒轮换一次
// 不抢视觉、不评价，只是轻轻推一下思绪。

export const GHOST_GUIDES = [
  '想到什么就说什么。',
  '今天最想骂的人，是谁？',
  '今天最想感谢的，又是谁？',
  '如果大喊一声，你会喊什么？',
  '不说出来，就留给今晚的梦。',
  '不用连贯，破碎也没关系。',
  '把那句咽回去的话，说出来。',
  '此刻你身体哪里是紧的？',
  '对着空气，把委屈倒出来。',
  '唱两句也行，跑调也没关系。',
  '你不需要向谁交代。',
  '就在这里，哪怕只待十秒。',
];

// 启动轮换。返回清除函数，切页/停止时调用。
export function startGhostGuide(el, intervalMs = 3000) {
  if (!el) return () => {};
  let i = Math.floor(Math.random() * GHOST_GUIDES.length);
  const render = () => {
    if (!el) return;
    el.textContent = GHOST_GUIDES[i % GHOST_GUIDES.length];
  };
  render();
  const t = setInterval(() => { i++; render(); }, intervalMs);
  return () => clearInterval(t);
}
