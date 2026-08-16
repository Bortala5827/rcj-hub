// streak.js — 高音量连续天数（本地 localStorage，用于 SoloSpeak → FaceTalk 引导）
// 「达标」定义：当天录音里出现过橙色高音量（recorder.level.highTriggered）。
// 只在本地记录，不上传、不分析。

const STREAK_KEY = 'rcj_solospeak_highvol_streak_v1';
const HIGH_THRESHOLD = 0.58;

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 标记今天为「高音量达标」。同一天重复录音只记一次。
// 返回当前连续天数。
export function markHighVolumeToday(level) {
  if (!level || !level.highTriggered) return getHighStreak();
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    const today = dayKey();
    if (raw.lastMarked === today) return raw.streak || 0; // 当天已记
    // 连续判断：上一次记录是昨天 → 累加；否则重置为 1
    const y = new Date(); y.setDate(y.getDate() - 1);
    const prev = (raw.lastMarked === dayKey(y)) ? (raw.streak || 0) : 0;
    const next = { streak: prev + 1, lastMarked: today };
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
    return next.streak;
  } catch {
    return getHighStreak();
  }
}

// 读取当前「仍有效」的连续天数。
// 若最后一次记录既不是今天也不是昨天，说明断了一天，连续归零。
export function getHighStreak() {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    if (!raw.streak) return 0;
    const t = dayKey();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yKey = dayKey(y);
    return (raw.lastMarked === t || raw.lastMarked === yKey) ? (raw.streak || 0) : 0;
  } catch {
    return 0;
  }
}

// 判定某次录音是否「高音量达标」
export function isHighVolume(level) {
  return !!(level && level.highTriggered);
}

export { HIGH_THRESHOLD };
