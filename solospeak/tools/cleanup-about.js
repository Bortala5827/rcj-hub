// cleanup-about.js — 精简 SoloSpeak about 页面：删 story/gourmet/faq，保留 hero+promise+foot
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'js', 'app.20260815.js');
let s = fs.readFileSync(p, 'utf8');

// 找到 renderAbout 函数并替换为精简版
const oldFnRe = /async function renderAbout\(\) \{[\s\S]*?\n\}/;
if (!oldFnRe.test(s)) { console.log('ERROR: renderAbout not found'); process.exit(1); }

const newFn = `async function renderAbout() {
  destroyPlayers();
  view.innerHTML = \`
    <div class="about">
      <div class="about-hero">
        <div class="about-jp">\${esc(t('aboutJp'))}</div>
        <h1 class="about-title">\${esc(t('aboutTitle'))}</h1>
        <div class="about-sub">\${esc(t('aboutSub'))}</div>
      </div>

      <section class="promise">
        <p class="promise-line">\${esc(t('promise1'))}</p>
        <p class="promise-line">\${esc(t('promise2'))}</p>
        <p class="promise-line">\${esc(t('promise3'))}</p>
        <p class="promise-leave">\${esc(t('promise4'))}</p>
      </section>

      <section class="about-foot">
        <p class="about-foot-note">\${esc(t('aboutFoot'))}</p>
      </section>
    </div>
  \`;
}`;

s = s.replace(oldFnRe, newFn);
fs.writeFileSync(p, s, 'utf8');
console.log('about 页面已精简（删 story/gourmet/faq）');
