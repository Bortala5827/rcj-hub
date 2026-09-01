// topics.js — 话题库（已清空：2026-09-01，用户要求全部删除预设话题）
// 保留接口结构，getTopic/nextTopic 返回 null；seedIfEmpty 不写入任何数据。
// 问候语改由 i18n.js 管理（SSI18N.t('greeting') / t('greetingJp')）。

import { getAllTopics, putTopic, incrementTopicUsage } from './db.js';

// 空种子：不再预设任何话题
const SEED = [];

let _cache = null;

export async function seedIfEmpty() {
  const existing = await getAllTopics();
  if (existing.length) { _cache = existing; return; }
  // SEED 为空，不写入
  _cache = [];
}

// 加权取话题：池为空时返回 null
export async function getTopic() {
  if (!_cache) await seedIfEmpty();
  const pool = _cache;
  if (!pool || !pool.length) return null;
  // 池非空时的简单随机（保留原加权逻辑的简化版）
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (chosen && chosen.id) await incrementTopicUsage(chosen.id);
  return chosen;
}

export async function nextTopic(currentId) {
  if (!_cache) await seedIfEmpty();
  let t = await getTopic();
  let guard = 0;
  while (t && t.id === currentId && guard < 6) { t = await getTopic(); guard++; }
  return t;
}
