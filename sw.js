/* Service Worker: يجعل المتجر يعمل بدون إنترنت ويُسرّع التحميل */
const V = 'lumora-v1';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/i18n.js', 'js/data.js', 'js/app.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// شبكة أولًا (دائمًا أحدث نسخة)، ثم الكاش عند انقطاع الإنترنت
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok && new URL(r.url).origin === location.origin) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});
