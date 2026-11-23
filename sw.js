// Offline-Speicher für Lager
// Die Version kommt aus app.js (APP_VER) über sw.js?v=… – hier nichts hochzählen.
//
// Grundsatz: Die App muss IMMER starten – auch ohne Internet und auch dann, wenn das Netz
// hängt (WLAN ohne Internet, ein Balken Empfang). Darum: Netz nur kurz probieren (NET_WAIT),
// sonst sofort die gespeicherte Version. Kommt die Antwort später doch, wird sie für den
// nächsten Start gespeichert.
const VER = new URL(location.href).searchParams.get('v') || 'dev';
const CACHE = 'lager-' + VER;      // App-Dateien dieser Version
const MODELS = 'lager-models';      // Fotoerkennung (groß, bleibt über Updates erhalten)
const CDN = 'lager-cdn';            // Bibliotheken vom CDN
const KEEP = [CACHE, MODELS, CDN];
const NET_WAIT = 2500;
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './vendor/qrcode.js',
  './recognize.js', './recognize-worker.js', './recognize-engine.js', './fonts/fonts.css'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    // Schriftdateien aus fonts.css mitnehmen
    try {
      const css = await (await c.match('./fonts/fonts.css')).text();
      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => new URL(m[1].replace(/['"]/g, ''), new URL('./fonts/', location.href)).href);
      await c.addAll(urls);
    } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // nur alte App-Versionen löschen – fremde Speicher (z. B. der Fotoerkennung) bleiben
    for (const k of await caches.keys()) if (k.startsWith('lager-') && !KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

let slowUntil = 0; // hing das Netz eben, warten die übrigen Dateien nicht nochmal

// Netz zuerst, aber höchstens NET_WAIT lang – danach (oder offline) aus dem Speicher
function netFirst(e, cacheName, keys) {
  const req = e.request;
  const net = fetch(req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(req, { cache: 'no-cache' }))
    .then(async r => { if (r.ok) await (await caches.open(cacheName)).put(keys[0], r.clone()); return r; });
  e.waitUntil(net.catch(() => {})); // späte Antwort trotzdem speichern
  const cached = async () => {
    for (const k of keys) { const hit = await caches.match(k, { ignoreSearch: true }); if (hit) return hit; }
    return null;
  };
  return (async () => {
    if (self.navigator.onLine === false || Date.now() < slowUntil) { const hit = await cached(); if (hit) return hit; }
    let timer;
    const tooSlow = new Promise((_, rej) => { timer = setTimeout(() => { slowUntil = Date.now() + 20000; rej(new Error('timeout')); }, NET_WAIT); });
    try {
      const r = await Promise.race([net, tooSlow]);
      clearTimeout(timer); slowUntil = 0;
      if (r.ok || r.status === 404) return r;
      return (await cached()) || r; // Serverfehler: lieber die gespeicherte Version
    } catch {
      clearTimeout(timer);
      return (await cached()) || net; // nichts gespeichert: weiter auf das Netz warten
    }
  })();
}

// Speicher zuerst (große, selten geänderte Dateien)
function cacheFirst(e, cacheName) {
  return (async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok) await (await caches.open(cacheName)).put(e.request, r.clone());
    return r;
  })();
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'cdn.jsdelivr.net') { e.respondWith(cacheFirst(e, CDN)); return; }
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname.slice(scope.length);
  if (e.request.mode === 'navigate') { e.respondWith(netFirst(e, CACHE, [url.origin + url.pathname, './', './index.html'])); return; }
  if (/^(models|vendor\/(transformers|ort))\//.test(path)) {
    // Modell und Laufzeit ändern sich kaum – Wortschatz (json/bin) dagegen schon
    e.respondWith(/\.(json|bin)$/.test(path) ? netFirst(e, MODELS, [e.request]) : cacheFirst(e, MODELS));
    return;
  }
  if (path.startsWith('fonts/')) { e.respondWith(cacheFirst(e, CACHE)); return; }
  e.respondWith(netFirst(e, CACHE, [e.request]));
});
