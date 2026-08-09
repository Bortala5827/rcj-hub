// topics.js — 话题库（生活化、易答、无标准答案）
// 分级：light(轻,40%) / medium(中,35%) / heavy(重,25%)；spicy 为低概率调味剂。
// 取话题先按 level 权重抽样，再在该 level 内按 usageCount 降权；spicy 低概率出现。
// 日式问候与张朝阳名言不进 DB（见 SPEC §6）。

import { getAllTopics, putTopic, incrementTopicUsage } from './db.js';

export const GREETING_JP = '今日も、あなたの声を聞かせて。';
export const GREETING_CN = '今天，也听听自己的声音。';
export const QUOTE = '“独居的人每天要说足够多的话。” —— 张朝阳';

// 三级权重（合计=1）
const LEVEL_WEIGHT = { light: 0.40, medium: 0.35, heavy: 0.25 };
// spicy 出现概率（调味剂，非主风格）
const SPICY_PROB = 0.10;

// 60 条核心话题：light 24 / medium 21 / heavy 15
const SEED = [
  // ---------- light 轻 · 感官 / 流水账（24）----------
  { level: 'light', text: '今天你吃的第一口东西是什么？' },
  { level: 'light', text: '最近一次让你笑出来是什么时候？' },
  { level: 'light', text: '今天路上看到了什么有意思的小事？' },
  { level: 'light', text: '你现在手边最近的一样东西是什么，摸起来什么感觉？' },
  { level: 'light', text: '今天天气怎么样，你出门了吗？' },
  { level: 'light', text: '你今天喝的第一口水、茶或咖啡，温度刚好吗？' },
  { level: 'light', text: '房间里现在最安静的角落在哪里？' },
  { level: 'light', text: '今天有没有闻到什么味道——饭香、雨后的土、还是洗衣液？' },
  { level: 'light', text: '你刚才在听什么歌，或者什么声音？' },
  { level: 'light', text: '窗外的天色现在是怎样的？' },
  { level: 'light', text: '今天你走了多少路，脚累不累？' },
  { level: 'light', text: '你今天穿的衣服，舒服吗？' },
  { level: 'light', text: '冰箱里现在有什么，你打算怎么解决下一顿？' },
  { level: 'light', text: '最近一次晒太阳是什么时候，暖不暖？' },
  { level: 'light', text: '你养的绿植或宠物，今天状态怎么样？' },
  { level: 'light', text: '今天有没有哪一刻，你放空了五分钟？' },
  { level: 'light', text: '你昨晚睡得怎么样，做了梦吗？' },
  { level: 'light', text: '现在你周围有什么声音？' },
  { level: 'light', text: '你今天洗了几次手，水凉不凉？' },
  { level: 'light', text: '最近看的一部片子或短视频，开头好看吗？' },
  { level: 'light', text: '你桌上有没有什么小摆件，它怎么来的？' },
  { level: 'light', text: '今天的风大不大？' },
  { level: 'light', text: '你刚才是不是在想晚饭吃什么？' },
  { level: 'light', text: '此刻你坐着舒服吗，要不要换个姿势？' },

  // ---------- medium 中 · 微叙事 / 记忆（21）----------
  { level: 'medium', text: '最近有什么小事让你觉得开心？' },
  { level: 'medium', text: '如果今天可以只做一件事，你想做什么？' },
  { level: 'medium', text: '你现在最想对自己说的一句话是什么？' },
  { level: 'medium', text: '今天哪一刻，你觉得最放松？' },
  { level: 'medium', text: '你房间里现在最乱的地方是什么？' },
  { level: 'medium', text: '一个人住，最让你享受的一件事是什么？' },
  { level: 'medium', text: '此刻房间很安静，你在想什么？' },
  { level: 'medium', text: '说一段你最近学会的东西，假装教给一个人。' },
  { level: 'medium', text: '试着把今天发生的一件事，讲成一个小故事。' },
  { level: 'medium', text: '你最近一次鼓起勇气做了什么？' },
  { level: 'medium', text: '小时候最喜欢的一个地方，现在还记得吗？' },
  { level: 'medium', text: '你手机相册里最近一张照片，拍的是什么？' },
  { level: 'medium', text: '有没有一个习惯，你坚持了很久？' },
  { level: 'medium', text: '你最近一次收到惊喜，是什么？' },
  { level: 'medium', text: '如果明天能放一天假，你会怎么过？' },
  { level: 'medium', text: '你最近在为什么事偷偷努力？' },
  { level: 'medium', text: '有没有哪首歌，一听就想起某个人？' },
  { level: 'medium', text: '你最近一次对别人说"谢谢"，是为了什么？' },
  { level: 'medium', text: '你记忆里最暖的一个冬天是什么样的？' },
  { level: 'medium', text: '你最近在反复想的一个念头是什么？' },
  { level: 'medium', text: '你上一次很久没联系的朋友，最近还好吗？' },

  // ---------- heavy 重 · 轻哲学 / 观点（15）----------
  { level: 'heavy', text: '今天最烦的是什么？' },
  { level: 'heavy', text: '有没有什么情绪，憋在心里很久了？' },
  { level: 'heavy', text: '你觉得"独居"这件事，教会了你什么？' },
  { level: 'heavy', text: '如果声音会留下，你最想留给未来的自己一句什么话？' },
  { level: 'heavy', text: '你心目中的"把话说清楚"是什么样的？' },
  { level: 'heavy', text: '你更怕安静，还是更怕吵闹？' },
  { level: 'heavy', text: '什么时候，你觉得自己真正在表达，而不是在表演？' },
  { level: 'heavy', text: '你愿意为"被理解"付出多少努力？' },
  { level: 'heavy', text: '独处和孤独，对你来说是一回事吗？' },
  { level: 'heavy', text: '你希望十年后的自己，还保留现在的哪一点？' },
  { level: 'heavy', text: '如果不用考虑任何人的看法，你今天想说什么？' },
  { level: 'heavy', text: '你认为"好好说话"重要，还是"说真话"重要？' },
  { level: 'heavy', text: '你最近一次改变对一件事的看法，是因为什么？' },
  { level: 'heavy', text: '安静对你来说，是休息还是逃避？' },
  { level: 'heavy', text: '你觉得自己"开口"最难的那一步是什么？' },

  // ---------- spicy 有点皮（低概率调味剂，约 4 条）----------
  { level: 'medium', isSpicy: true, text: '你周边有几个公园？哪个最近？哪个最舒服？哪个……美女最多？' },
  { level: 'medium', isSpicy: true, text: '你最近一次因为好奇去搜一样东西，结果打开了新世界——是什么？' },
  { level: 'heavy', isSpicy: true, text: '如果现在能匿名对一个人说句真心话，你会对谁说？' },
  { level: 'medium', isSpicy: true, text: '你手机里有没有一段"舍不得删"的聊天记录？' },
];

let _cache = null;

export async function seedIfEmpty() {
  const existing = await getAllTopics();
  if (existing.length) { _cache = existing; return; }
  for (const t of SEED) {
    await putTopic({ level: t.level, text: t.text, isSpicy: !!t.isSpicy });
  }
  _cache = await getAllTopics();
}

function pickLevel() {
  const r = Math.random();
  let acc = 0;
  for (const lv of ['light', 'medium', 'heavy']) {
    acc += LEVEL_WEIGHT[lv];
    if (r <= acc) return lv;
  }
  return 'light';
}

// 加权取话题：先定 level，再在该 level 内按 usageCount 降权；spicy 低概率
export async function getTopic() {
  if (!_cache) await seedIfEmpty();
  const pool = _cache;
  if (!pool.length) return null;
  const wantSpicy = Math.random() < SPICY_PROB;
  const level = pickLevel();

  let candidates = pool.filter((t) => t.level === level && (t.isSpicy ? wantSpicy : !wantSpicy));
  if (!candidates.length) candidates = pool.filter((t) => t.level === level);
  if (!candidates.length) candidates = pool;

  const weighted = candidates.map((t) => ({ t, w: 1 / (1 + (t.usageCount || 0) * 0.5) }));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  let chosen = weighted[0].t;
  for (const x of weighted) { r -= x.w; if (r <= 0) { chosen = x.t; break; } }

  await incrementTopicUsage(chosen.id);
  return chosen;
}

export async function nextTopic(currentId) {
  if (!_cache) await seedIfEmpty();
  let t = await getTopic();
  let guard = 0;
  while (t && t.id === currentId && guard < 6) { t = await getTopic(); guard++; }
  return t;
}
