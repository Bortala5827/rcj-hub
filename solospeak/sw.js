// sw.js — Service Worker：缓存壳 + 离线可用
// 注意：每次发布新版本请把 CACHE 版本号 +1（如 v2→v3），并同步更新 index.html 里 sw.js 注册带的 ?v=
// 这样浏览器才会装上新 SW、清掉旧缓存，避免小米/部分安卓自带浏览器一直吐旧版 JS（表现为录音按钮不显示等）。
const CACHE = 'solospeak-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './styles/app.css',
  './js/app.js', './js/db.js', './js/recorder.js', './js/waveform.js',
  './js/player.js', './js/topics.js', './js/goals.js', './js/export.js',
  './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先：先试网络（保证新部署立即生效），失败再回退缓存/离线壳。
// 旧版是「缓存优先」，导致部分浏览器永久用旧 JS，录音按钮等不渲染。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return resp;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
