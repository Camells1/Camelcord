// Camelcord service worker: keeps the app shell available (and fast) when installed on a phone.
// Live data always comes from the network; only our own files are cached.
const CACHE = 'camelcord-shell-v1';
const SHELL = ['./', 'index.html', 'src/style.css', 'src/app.js', 'src/account.js', 'src/firebase.js', 'src/filter.js', 'src/social.js', 'src/servers.js',
  'src/voice.js', 'src/profiles.js', 'src/themes.js', 'src/prefs.js', 'src/limits.js', 'src/bots.js', 'manifest.webmanifest', 'assets/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;       // never touch Firebase / WebRTC traffic
  // Network first so an update shows up right away; the cache is the fallback when offline
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
