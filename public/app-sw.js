const VERSION='edge-app-shell-v3-brand-20261021';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll([OFFLINE,'/icons/brand-20261021-192.png','/icons/brand-20261021-512.png'])));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('edge-app-shell-')||key.startsWith('edge-driver-shell-'))&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
// Navigation fallback only. Never persist HTML, APIs, cookies or customer data.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method==='GET'&&event.request.mode==='navigate'&&url.origin===self.location.origin&&!/^\/(api|auth|_next)(\/|$)/.test(url.pathname)){
    event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE)));
  }
});
