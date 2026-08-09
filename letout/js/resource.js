// resource.js — 情绪影子资源库（影视/人物台词：文本 + webm 音频）
// 从用户自建的 GitHub 仓库拉取 manifest，按日期选批次轮换（每 3 天一批）。
// 仓库未建好 / 拉取失败时，回退到本地占位，保证页面始终有内容。
//
// ⚠️ 接入方式：把 RESOURCE_REPO_RAW 改成你的仓库 raw 地址（仓库里放 manifest.json
//    和各个 webm 文件）。manifest 结构见本文件底部 LOCAL_FALLBACK。

const RESOURCE_REPO_RAW = 'https://raw.githubusercontent.com/Bortala5827/rcj-media-shadow/master'; // 情绪影子资源库（影视/人物台词）
const ROTATE_DAYS = 3;        // 每 3 天轮换一批

const LOCAL_FALLBACK = {
  batches: [
    {
      id: 'local-default',
      label: '本地占位 · 未接入资源库',
      items: [
        { id: 'p1', title: '功夫熊猫 · 阿宝', text: '你患得患失，太在意从前，又担心未来。昨天是段历史，明天是个谜，而今天，是上天的礼物。', audio: null },
        { id: 'p2', title: '海上钢琴师', text: '我们笑着说再见，却深知再见遥遥无期。', audio: null },
        { id: 'p3', title: '楚门的世界', text: '如果再见不到你，祝你早、午、晚都安。', audio: null },
        { id: 'p4', title: '阳光灿烂的日子', text: '在我最无聊的时候，我总喜欢这样，闻闻那种味道。', audio: null },
        { id: 'p5', title: '雷军', text: '永远相信美好的事情即将发生。', audio: null },
      ],
    },
  ],
};

function pickBatch(batches) {
  const day = Math.floor(Date.now() / 864e5);
  const idx = Math.floor(day / ROTATE_DAYS) % batches.length;
  return batches[idx];
}

function resolveAudio(p) {
  if (!p) return null;
  if (/^https?:\/\//.test(p)) return p;
  return `${RESOURCE_REPO_RAW}/${String(p).replace(/^\//, '')}`;
}

// 返回 { batch, items:[{id,title,text,audio}], remote:boolean }
export async function getEmotionShadows() {
  try {
    if (!RESOURCE_REPO_RAW) throw new Error('no repo configured');
    const res = await fetch(`${RESOURCE_REPO_RAW}/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    if (!data.batches || !data.batches.length) throw new Error('empty manifest');
    const batch = pickBatch(data.batches);
    const items = (batch.items || []).map((it) => ({
      id: it.id, title: it.title || '', text: it.text || '', audio: resolveAudio(it.audio),
    }));
    return { batch, items, remote: true };
  } catch {
    const batch = pickBatch(LOCAL_FALLBACK.batches);
    return { batch, items: batch.items.map((it) => ({ ...it })), remote: false };
  }
}
