/* ===== Google Mic Recorder · JS 逻辑 =====
   合并到你的页面 <script> 中。
   提供 enterRecording() / exitRecording() 两个状态切换函数，
   以及完整的 MediaRecorder 录音对接示例。
*/

// ── DOM 引用（按实际 ID 调整）──
const micBtn   = document.getElementById('mic-btn');
const micCaption = document.getElementById('mic-caption');
const micTimer = document.getElementById('mic-timer');

// ── 状态切换（纯 UI，不碰录音逻辑）──
function micEnterRec() {
  micBtn.classList.add('recording');
  micCaption.textContent = '录音中… 再次点击停止';
  micCaption.style.color = '#fca5a5';
  micTimer.style.color   = '#fca5a5';
}

function micExitRec() {
  micBtn.classList.remove('recording');
  micCaption.textContent = '点击开始录音';
  micCaption.style.color = '';
  micTimer.style.color   = '';
}

// ── 计时器辅助 ──
let micSec = 0, micTick = null;

function micStartTimer() {
  micSec = 0;
  micTick = setInterval(() => {
    micSec++;
    const m = String(Math.floor(micSec / 60)).padStart(2, '0');
    const s = String(micSec % 60).padStart(2, '0');
    micTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function micStopTimer() {
  clearInterval(micTick);
  micTick = null;
}

// ── 完整录音对接示例（复制到你的 click handler 中）──
/*
let mediaRecorder = null;
let audioChunks = [];

micBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        // TODO: 处理 blob — 播放 / 上传 / AI 点评
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      micEnterRec();
      micStartTimer();
    } catch (err) {
      alert('无法访问麦克风：' + err.message);
    }
  } else {
    mediaRecorder.stop();
    micStopTimer();
    micExitRec();
  }
});
*/
