const VERSION='edge-driver-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.add('/driver-offline.html')));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('edge-driver-shell-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
// Delivery addresses and authenticated responses are always network-only.
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.origin===self.location.origin&&url.pathname==='/driver')event.respondWith(fetch(event.request).catch(()=>caches.match('/driver-offline.html')));});
