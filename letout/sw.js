// sw.js — 极简离线缓存（本地优先，缓存应用壳）
const CACHE = 'letout-v1';
const ASSETS = [
  './', './index.html', './styles/app.css',
  './js/app.js', './js/db.js', './js/recorder.js', './js/waveform.js', './js/player.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('./index.html'))));
});
