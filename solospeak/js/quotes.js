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

// 按日期确定性选取，同一天不变
export function getDailyQuote(d = new Date()) {
  const day = Math.floor(Date.now() / 864e5);
  return QUOTES[day % QUOTES.length];
}

export const QUOTE_COUNT = QUOTES.length;
