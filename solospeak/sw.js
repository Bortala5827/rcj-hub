// sw.js — Service Worker：离线壳 + 静态资产缓存（开发友好版）
// ⚠️ 开发阶段策略（2026-08-14 按用户方案固化）：
//   - HTML / JS / JSON / manifest：一律网络优先且不写入缓存 → 部署新版本立即生效，杜绝旧版残留
//   - 图片 / 图标 / 字体 / 静态资源：缓存优先 → 离线可用 + 复访秒开
// 每次发布新版本请把 CACHE 版本号 +1，并同步更新 app.js 里 sw.js 注册带的 ?v=
const CACHE = 'solospeak-v7';
const STATIC_ASSETS = [
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 静态资产（图片/图标/字体）：缓存优先 → 秒开 + 离线
  if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return resp;
        }).catch(() => caches.match('./assets/icon-192.png'));
      })
    );
    return;
  }

  // HTML / JS / JSON / 其余：网络优先，不写入缓存 → 部署立即生效
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
