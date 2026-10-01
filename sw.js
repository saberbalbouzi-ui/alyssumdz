/* عامل الخدمة: يجعل الموقع قابلاً للتثبيت على الهاتف ويفتح آخر نسخة محفوظة عند انقطاع الإنترنت.
   الشبكة أولاً دائماً (حتى لا يرى الزبون سعراً قديماً)، والصور تُخدم من الذاكرة المؤقتة أولاً. لا يمسّ طلبات الـ API ولا غير GET. */
const CACHE = "store-v1";
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isImg = u => /\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(u.pathname);
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || /\/api\//.test(u.pathname)) return;
  if (isImg(u)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(c => {
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; });
      const cached = c.match(r);
      const slow = new Promise(res => setTimeout(() => res(null), 4000)).then(() => cached);      // شبكة بطيئة جداً ⟵ النسخة المحفوظة
      return Promise.race([net, slow.then(h => h || net)]).catch(() => cached.then(h => h || (r.mode === "navigate" ? c.match("index.html") : Response.error())));
    })
  );
});
