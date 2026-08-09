// goals.js — 动态目标（时长制，P2）
// 每日基础目标默认 30 分钟（LocalStorage 可调）；
// 动态补差 = 昨天缺口 × 50%，当日目标上限 60 分钟；
// 进度 = 今日已说秒数 / 当日目标分钟。不制造焦虑。
// SPEC §3.3 / §7：核心精神「昨天没说完，今天继续」。

import { getGoal, putGoal } from './db.js';

const SETTINGS_KEY = 'solospeak.settings';
const DEFAULT_BASE_MIN = 30;   // 基础目标（分钟）
const MAKEUP_RATE = 0.5;       // 补差比例
const TARGET_CAP_MIN = 60;     // 当日目标上限（分钟）

function todayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return todayStr(d);
}
function sameDay(ts, now) {
  const a = new Date(ts), b = new Date(now);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---- 设置（LocalStorage）----
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

export function getDailyGoalMin() {
  const s = loadSettings();
  const v = Number(s.dailyGoalMin);
  return v > 0 ? v : DEFAULT_BASE_MIN;
}
export function setDailyGoalMin(min) {
  const s = loadSettings();
  s.dailyGoalMin = Math.max(1, Math.round(min));
  saveSettings(s);
}

// 计算当日目标（基础 + 补差，封顶 60）
async function computeTarget(baseMin) {
  const y = await getGoal(yesterdayStr());
  let target = baseMin;
  let makeup = 0;
  if (y) {
    const yDone = (y.doneSec || 0) / 60;
    const shortfall = Math.max(0, y.targetMin - yDone);
    makeup = shortfall * MAKEUP_RATE;
    target = Math.min(TARGET_CAP_MIN, baseMin + makeup);
  }
  return { targetMin: Math.round(target * 10) / 10, makeupMin: Math.round(makeup * 10) / 10 };
}

export async function getTodayGoal() {
  const date = todayStr();
  let g = await getGoal(date);
  if (!g) {
    const base = getDailyGoalMin();
    const { targetMin, makeupMin } = await computeTarget(base);
    const y = await getGoal(yesterdayStr());
    const streak = (y && y.lastDoneAt) ? (y.streak || 0) : 0;
    g = { date, baseMin: base, targetMin, makeupMin, doneSec: 0, streak, lastDoneAt: null };
    await putGoal(g);
  }
  return g;
}

// 每次录音结束累计时长；首条触发连续天数 +1
export async function addSpoken(durationMs) {
  const g = await getTodayGoal();
  const wasDoneToday = g.lastDoneAt && sameDay(g.lastDoneAt, Date.now());
  if (!wasDoneToday) {
    const y = await getGoal(yesterdayStr());
    g.streak = (y && y.lastDoneAt) ? (y.streak || 0) + 1 : 1;
  }
  g.doneSec = (g.doneSec || 0) + durationMs / 1000;
  g.lastDoneAt = Date.now();
  await putGoal(g);
  return g;
}

export async function getStreak() {
  return (await getTodayGoal()).streak || 0;
}
