// export.js — 导出个人声音日志（用户始终拥有数据）
// 支持 TXT / Markdown / JSON；单条或全部。音频本体单独导出为 .webm。

function fmtDate(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toTxt(rows) {
  return rows.map((r) =>
    `[${fmtDate(r.createdAt)}] 时长 ${Math.round(r.durationMs / 1000)}s` +
    (r.topicText ? `  话题：${r.topicText}` : '') + '\n' +
    (r.transcript ? r.transcript + '\n' : '') +
    '—'.repeat(20) + '\n'
  ).join('\n');
}

function toMd(rows) {
  let out = '# SoloSpeak 声音日志\n\n';
  for (const r of rows) {
    out += `## ${fmtDate(r.createdAt)}\n`;
    out += `- 时长：${Math.round(r.durationMs / 1000)}s\n`;
    if (r.topicText) out += `- 话题：${r.topicText}\n`;
    if (r.transcript) out += `- 转写：${r.transcript}\n`;
    out += '\n';
  }
  return out;
}

function toJson(rows) {
  return JSON.stringify({
    exportedAt: Date.now(),
    count: rows.length,
    recordings: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      durationMs: r.durationMs,
      topicId: r.topicId || null,
      topicText: r.topicText || null,
      transcript: r.transcript || null,
      peaks: Array.from(r.peaks || []),
      moodTag: r.moodTag || null,
      favorite: !!r.favorite,
    })),
  }, null, 2);
}

const BUILDERS = { txt: toTxt, md: toMd, json: toJson };
const EXT = { txt: 'txt', md: 'md', json: 'json' };
const MIME = { txt: 'text/plain;charset=utf-8', md: 'text/markdown;charset=utf-8', json: 'application/json' };

// rows: 已筛选的录音数组
export function exportData(rows, format = 'md') {
  const build = BUILDERS[format] || toMd;
  const stamp = new Date().toISOString().slice(0, 10);
  download(`solospeak-log-${stamp}.${EXT[format] || 'md'}`, build(rows), MIME[format]);
}

// 单条音频导出为 .webm（用户自留，非 AI 用途）
export function exportAudio(recording) {
  const url = URL.createObjectURL(recording.audioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solospeak-${new Date(recording.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
