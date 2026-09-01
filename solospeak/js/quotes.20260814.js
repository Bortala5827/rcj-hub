// quotes.js — 今日金句 / 语言主题名言（已清空：2026-09-01，用户要求全部删除，"台词什么的很low"）
// 保留接口结构，getDailyQuote/getLanguageQuote/nextLanguageQuote 返回 null；
// 调用方需处理 null（不显示金句区）。

const QUOTES = [];
const LANGUAGE_QUOTES = [];

// 按日期确定性选取——池为空时返回 null
export function getDailyQuote(d = new Date()) {
  if (!QUOTES.length) return null;
  const day = Math.floor(Date.now() / 864e5);
  return QUOTES[day % QUOTES.length];
}

// 语言/表达主题名言：池为空时返回 null
let _langIdx = -1;
export function getLanguageQuote(d = new Date()) {
  if (!LANGUAGE_QUOTES.length) return null;
  if (_langIdx < 0) {
    const day = Math.floor(Date.now() / 864e5);
    _langIdx = day % LANGUAGE_QUOTES.length;
  }
  return LANGUAGE_QUOTES[_langIdx];
}
export function nextLanguageQuote() {
  if (!LANGUAGE_QUOTES.length) return null;
  _langIdx = (_langIdx + 1) % LANGUAGE_QUOTES.length;
  return LANGUAGE_QUOTES[_langIdx];
}

export const QUOTE_COUNT = QUOTES.length;
export const LANG_QUOTE_COUNT = LANGUAGE_QUOTES.length;
