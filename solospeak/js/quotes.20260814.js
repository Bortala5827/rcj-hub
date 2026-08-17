// quotes.js — 今日金句（影视 / 科技人物经典语录）
// 按日期确定性选取，当天刷新不变。纯文本；audio 预留语音接口（资源库接入后启用）。

const QUOTES = [
  { text: '昨天是段历史，明天是个谜团，而今天，是天赐的礼物。', author: '《功夫熊猫》', audio: null },
  { text: '你患得患失，太在意从前，又担心未来。', author: '《功夫熊猫》', audio: null },
  { text: '你的故事，只有你自己能写完。', author: '《功夫熊猫》', audio: null },
  { text: '永远相信美好的事情即将发生。', author: '雷军', audio: null },
  { text: '站在风口上，猪也能飞起来。', author: '雷军', audio: null },
  { text: '我们不是要超越谁，而是要把产品真正做好。', author: '余承东', audio: null },
  { text: '超级，无敌，遥遥领先。', author: '余承东', audio: null },
  { text: '生活就像一盒巧克力，你永远不知道下一颗是什么味道。', author: '《阿甘正传》', audio: null },
  { text: '希望是个好东西，也许是最好的东西。', author: '《肖申克的救赎》', audio: null },
  { text: '我命由我不由天。', author: '《哪吒》', audio: null },
  { text: '不是所有的鱼，都会生活在同一片海里。', author: '《海上钢琴师》', audio: null },
  { text: '点亮自己，别等着别人来点燃你。', author: '《心灵奇旅》', audio: null },
  { text: '且视他人之疑目如盏盏鬼火，大胆去走你的夜路。', author: '《天官赐福》', audio: null },
  { text: '不要因为走得太远，而忘记为什么出发。', author: '柴静《看见》', audio: null },
  { text: '种一棵树最好的时间是十年前，其次是现在。', author: '《人民日报》', audio: null },
  { text: '你所热爱的，就是你的生活。', author: '经典台词', audio: null },
  { text: '向下扎根，向上生长。', author: '佚名', audio: null },
  { text: '把每一个平凡的日子，过成限量版。', author: '佚名', audio: null },
];

// ─── 首页轮换名言（SoloSpeak 首页「张朝阳讲话」位置，不放大底部）───
// 两类混排：type='名人名言'（人物金句） / type='经典台词'（影视·书籍台词）。
// 温暖、有力、关于「开口 / 表达 / 语言」，不凄凉。按日期确定性选取 + ↻ 手动切换。
const LANGUAGE_QUOTES = [
  // ===== 名人名言 =====
  { type: '名人名言', text: '独居的人每天要说足够多的话。', author: '张朝阳' },
  { type: '名人名言', text: '语言是思想的衣服。', author: '雨果' },
  { type: '名人名言', text: '说话的目的不是为了让人理解，而是为了让人不误解。', author: '铃木镇一' },
  { type: '名人名言', text: '语言不只是工具，它是我们存在的方式。', author: '海德格尔' },
  { type: '名人名言', text: '声音是唯一一种能同时传递情绪和意义的媒介。', author: '沃尔特·艾萨克森' },
  { type: '名人名言', text: '永远相信美好的事情即将发生。', author: '雷军' },
  { type: '名人名言', text: '我们不是要超越谁，而是要把产品真正做好。', author: '余承东' },
  { type: '名人名言', text: '一个人的声音可以很轻，但只要开口，就已经在改变空气。', author: '佚名' },
  { type: '名人名言', text: '所谓表达，就是把自己的一部分交给别人，然后发现它并没有减少。', author: '佚名' },
  { type: '名人名言', text: '能准确说出自己感受的人，比大多数人更自由。', author: '佚名' },
  { type: '名人名言', text: '声音不需要完美，它只需要真实。', author: '佚名' },
  { type: '名人名言', text: '每天对自己说几句话，是最便宜的心理治疗。', author: '佚名' },
  { type: '名人名言', text: '开口的那一刻，你就已经比上一秒更勇敢了。', author: '佚名' },

  // ===== 经典台词 =====
  { type: '经典台词', text: '昨天是段历史，明天是个谜团，而今天，是天赐的礼物。', author: '《功夫熊猫》' },
  { type: '经典台词', text: '生活就像一盒巧克力，你永远不知道下一颗是什么味道。', author: '《阿甘正传》' },
  { type: '经典台词', text: '希望是个好东西，也许是最好的东西。', author: '《肖申克的救赎》' },
  { type: '经典台词', text: '我命由我不由天。', author: '《哪吒》' },
  { type: '经典台词', text: '不是所有的鱼，都会生活在同一片海里。', author: '《海上钢琴师》' },
  { type: '经典台词', text: '点亮自己，别等着别人来点燃你。', author: '《心灵奇旅》' },
  { type: '经典台词', text: '且视他人之疑目如盏盏鬼火，大胆去走你的夜路。', author: '《天官赐福》' },
  { type: '经典台词', text: '不要因为走得太远，而忘记为什么出发。', author: '柴静《看见》' },
  { type: '经典台词', text: '种一棵树最好的时间是十年前，其次是现在。', author: '《人民日报》' },
  { type: '经典台词', text: '你所热爱的，就是你的生活。', author: '经典台词' },
];


// 按日期确定性选取，同一天不变
export function getDailyQuote(d = new Date()) {
  const day = Math.floor(Date.now() / 864e5);
  return QUOTES[day % QUOTES.length];
}

// 语言/表达主题名言：按日轮换 + 支持手动切换下一条
let _langIdx = -1; // -1 = 尚未初始化（首次调用时按日期算）
export function getLanguageQuote(d = new Date()) {
  if (_langIdx < 0) {
    const day = Math.floor(Date.now() / 864e5);
    _langIdx = day % LANGUAGE_QUOTES.length;
  }
  return LANGUAGE_QUOTES[_langIdx];
}
export function nextLanguageQuote() {
  _langIdx = (_langIdx + 1) % LANGUAGE_QUOTES.length;
  return LANGUAGE_QUOTES[_langIdx];
}

export const QUOTE_COUNT = QUOTES.length;
export const LANG_QUOTE_COUNT = LANGUAGE_QUOTES.length;
