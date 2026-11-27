/* SpatialShare — مشاركة قراءات الخادم (GET فقط) بين ألواح Spatial الحقيقية (V4).
   المشكلة: كل لوح يحمّل admin.html كاملاً فيجلب القراءات نفسها (إعدادات kv، الطلبات، شركات الشحن…) ← ≈52% من طلبات API مكرّرة عند فتح 3 نوافذ.
   الحل: الإطار (assets/js/admin-embed-boot.js) يمرّر fetch إلى هذه الدالة؛ ما ينطبق عليه شرطنا يُدمَج (طلب جارٍ مشترك) ويُخدَم من ذاكرة قصيرة العمر.
   الأمان والعزل (قواعد صلبة، لا تُخفَّف):
     • GET فقط وإلى api/index.php فقط وبنفس أصل الصفحة الأم؛ أي شيء آخر يمرّ كما هو (يعيد null).
     • قائمة سماح صريحة بالمسارات (ALLOW) — ما عداها (me/login/logout/staff/… أي بيانات جلسة أو هوية) لا يُشارَك أبداً.
     • مفاتيح kv الحساسة (token/secret/pass/session/auth/key/otp/csrf) لا تُشارَك حتى لو كان المسار مسموحاً.
     • طلب فيه Authorization أو signal أو credentials:omit أو جسم لا يُشارَك.
     • مفتاح الذاكرة = أصل الصفحة + العنوان المطلق (بلا معامل t لكسر الكاش) وتتفرّغ كلها إن تغيّر المستأجر (SpatialHub.tenant)؛ لا يوجد وصول لها من خارج الصفحة (متغيّر داخل إغلاق).
     • أي كتابة (غير GET) إلى api/index.php تُفرغ الذاكرة كلها فوراً (تشمل login/logout)؛ كذلك أي حدث مقبول في الهَب وأي تحديث يطلبه الهَب.
     • الاستجابات غير الناجحة لا تُحفظ؛ كل مستهلك يحصل على Response جديد (نسخة مستقلة من الجسم) من عالمه هو (Response الإطار نفسه).
     • عمر الذاكرة: 3ث في الحالة العادية؛ أثناء «دفعة التحميل» (طابور إطارات يعمل) 45ث للمسارات المستقرة و8ث للطلبات ويُقصَّر فور انتهائها.
   التعطيل: ‎?noshare=1‎ في عنوان Spatial. */
(function () {
  "use strict";
  var OFF = /[?&]noshare=1/.test(location.search);
  var ALLOW = { kv: 1, orders: 1, ship_carriers: 1, ship_unknown: 1, file: 1 };
  var VOLATILE = { orders: 1, ship_unknown: 1 };        /* أقصر عمراً حتى أثناء الدفعة */
  var SENSITIVE_KV = /(token|secret|pass|session|auth|apikey|api_key|otp|csrf|cookie)/i;
  var JOIN_MAX = +window.__spShareJoinMax || 8000;   /* أقصى عمر لطلب جارٍ يُنضمّ إليه: طلب إطار أُغلق أثناء التحميل قد لا يُحلّ ولا يُرفض أبداً (يعلّق المنضمّين إليه) */
  var TTL_IDLE = 3000, TTL_BURST = 45000, TTL_BURST_VOL = 8000, MAX_BYTES = 1500000, MAX_ENTRIES = 200;
  var cache = new Map(), epoch = 0, epochs = {}, burst = false, st = { hit: 0, join: 0, miss: 0, bypass: 0, clears: 0, stored: 0 };

  var DBG = /[?&]sharedebug=1/.test(location.search) ? [] : null;   /* تشخيص: يسجّل كل قرار (hit/join/miss/clear) في SpatialShare.trace() */
  function dbg(k, v) { if (DBG) { DBG.push([Math.round(performance.now()), k, v]); if (DBG.length > 600) DBG.shift(); } }
  /* المستأجر يُعرَف بعد أول hello فمفتاح الذاكرة لا يتضمّنه (وإلا انقسمت الذاكرة قبل/بعد معرفته وضاع الدمج)؛ بدلاً من ذلك: إن تغيّر من قيمة معروفة إلى أخرى (متجر/جلسة مختلفة في الصفحة نفسها) تُفرَّغ الذاكرة كلها فوراً. الأصل (origin) في المفتاح دائماً. */
  var lastTenant = null;
  function tenantGuard() { try { var t = (window.SpatialHub && SpatialHub.tenant && SpatialHub.tenant()) || null; if (t && lastTenant && t !== lastTenant) { clear("tenant"); } if (t) lastTenant = t; } catch (_) { } }
  function now() { return Date.now(); }
  function clear(why) { dbg("clear", why); if (cache.size) { cache.clear(); } epoch++; epochs = {}; st.clears++; }
  /* كتابة معروفة المسار تُبطل ما قد يتأثر بها فقط (لا كل الذاكرة): كتابة file تُبطل file+الطلبات المتغيّرة+ship_carriers، وكتابة kv تُبطل kv+الطلبات المتغيّرة+ship_carriers؛
     أي مسار كتابة آخر (login/logout/أوامر الطلبات…) يُفرغ كل شيء. */
  var AFFECT = { file: { file: 1, orders: 1, ship_unknown: 1, ship_carriers: 1 }, kv: { kv: 1, orders: 1, ship_unknown: 1, ship_carriers: 1 } };
  /* تحديث الهَب لوحاً يقرأ موارد البيانات (طلبات/منتجات/تحليلات) من الخادم: نُبطل قراءاتها فقط ونُبقي الإعدادات (kv) */
  function clearData() { dbg("clearData", ""); cache.forEach(function (e, k) { if (e.name === "orders" || e.name === "file" || e.name === "ship_unknown") cache.delete(k); }); ["orders", "file", "ship_unknown"].forEach(function (n) { epochs[n] = (epochs[n] || 0) + 1; }); st.clears++; }
  function clearFor(route, sub) { dbg("clearFor", route + "|" + sub);
    var a = AFFECT[route]; if (!a) return clear("write:" + route);
    cache.forEach(function (e, k) { if (!e.name || !a[e.name]) return; if ((e.name === route) && sub && e.sub && e.sub !== sub) return; cache.delete(k); });   /* kv/file بمفتاح/مسار معروف: يُبطَل هو فقط */
    Object.keys(a).forEach(function (n) { if (n === route && sub) return; epochs[n] = (epochs[n] || 0) + 1; }); if (sub) epochs[route + "|" + sub] = (epochs[route + "|" + sub] || 0) + 1; st.clears++;
  }
  function trim() { var t = now(); cache.forEach(function (e, k) { if (e.exp && e.exp < t) cache.delete(k); }); while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value); }
  function setBurst(on) {
    on = !!on; if (on === burst) return; burst = on;
    if (!on) { var cap = now() + TTL_IDLE; cache.forEach(function (e) { if (e.exp && e.exp > cap) e.exp = cap; }); }   /* انتهت الدفعة: كل ما بقي ينتهي خلال 3ث */
  }

  /* يحلّل الطلب؛ يعيد {key, name} أو null إن لم يكن مؤهلاً */
  function classify(input, init, baseHref) {
    try {
      var isReq = input && typeof input === "object" && typeof input.url === "string" && !(typeof URL !== "undefined" && input instanceof URL);
      var method = String((init && init.method) || (isReq && input.method) || "GET").toUpperCase();
      var u = new URL(isReq ? input.url : String(input), baseHref || location.href);
      var isApi = u.origin === location.origin && /\/api\/index\.php$/.test(u.pathname);
      if (!isApi) return null;
      if (method !== "GET") {
        var sub = ""; try { var bd = init && init.body; if (typeof bd === "string" && bd.length < 200000) { var j = JSON.parse(bd); sub = String((j && (j.k || j.path)) || ""); } } catch (_) { }
        return { write: true, route: String(u.searchParams.get("r") || ""), sub: sub };
      }
      var name = u.searchParams.get("r"); if (!name || !ALLOW[name]) return null;
      if (name === "kv" && SENSITIVE_KV.test(String(u.searchParams.get("k") || ""))) return null;
      if (init && (init.signal || init.credentials === "omit" || init.body != null)) return null;
      if (isReq && input.signal) return null;
      var hdr = init && init.headers; if (hdr) { var h = new Headers(hdr); if (h.has("authorization")) return null; }
      if (isReq && input.headers && input.headers.has && input.headers.has("authorization")) return null;
      u.searchParams.delete("t"); u.searchParams.delete("_");   /* معاملات كسر الكاش لا تغيّر المحتوى */
      var sub = name === "kv" ? String(u.searchParams.get("k") || "") : name === "file" ? String(u.searchParams.get("path") || "") : "";
      return { sub: sub, key: location.origin + "|" + u.pathname + "?" + u.searchParams.toString(), name: name };
    } catch (_) { return null; }
  }

  function make(Resp, rec) {
    var body = (rec.status === 204 || rec.status === 205 || rec.status === 304) ? null : rec.buf.slice(0);
    return new Resp(body, { status: rec.status, statusText: rec.statusText, headers: rec.headers });
  }

  /* orig: fetch الإطار الأصلي؛ Resp: Response الإطار (ليبقى كل مستهلك في عالمه) */
  function sfetch(orig, input, init, Resp, baseHref) {
    if (OFF) return null;
    tenantGuard();
    var c = classify(input, init, baseHref);
    if (!c) { st.bypass++; return null; }
    if (c.write) { clearFor(c.route, c.sub); return null; }            /* الكتابة تمرّ كما هي لكن بعد إفراغ الذاكرة */
    var e = cache.get(c.key), t = now();
    if (e && e.exp && e.exp < t && !e.pending) { cache.delete(c.key); e = null; }
    if (e && e.pending && t - e.t0 > JOIN_MAX) { dbg("stale-pending", c.key); cache.delete(c.key); e = null; }   /* طلب جارٍ قديم: لا ننضمّ إليه (قد يكون صاحبه أُغلق) */
    if (e && e.pending) {
      dbg("join", c.key); st.join++;
      var left = Math.max(50, JOIN_MAX - (t - e.t0));   /* المنضمّ لا ينتظر أكثر من العمر المتبقي ثم يجلب بنفسه */
      return new Promise(function (res, rej) { var tm = setTimeout(function () { rej(new Error("share-join-timeout")); }, left); e.pending.then(function (v) { clearTimeout(tm); res(v); }, function (er) { clearTimeout(tm); rej(er); }); })
        .then(function (rec) { return make(Resp, rec); }, function () { return orig(input, init); });
    }
    if (e && e.rec) { dbg("hit", c.key); st.hit++; return Promise.resolve(make(Resp, e.rec)); }
    st.miss++; dbg("miss", c.key + (e ? " (exp)" : ""));
    var myEpoch = epoch, myNE = epochs[c.name] || 0, mySE = c.sub ? (epochs[c.name + "|" + c.sub] || 0) : 0, entry = { t0: t, name: c.name, sub: c.sub, exp: 0, pending: null, rec: null }, key = c.key, vol = !!VOLATILE[c.name];
    entry.pending = orig(input, init).then(function (res) {
      return res.arrayBuffer().then(function (buf) {
        var rec = { status: res.status, statusText: res.statusText, headers: Array.from(res.headers.entries()), buf: buf };
        var ok = res.status >= 200 && res.status < 300 && buf.byteLength <= MAX_BYTES && myEpoch === epoch && myNE === (epochs[c.name] || 0) && mySE === (c.sub ? (epochs[c.name + "|" + c.sub] || 0) : 0);
        entry.pending = null; dbg("done", key + " ok=" + ok + " st=" + res.status + " ep=" + (myEpoch === epoch) + " ne=" + (myNE === (epochs[c.name] || 0)) + " se=" + (mySE === (c.sub ? (epochs[c.name + "|" + c.sub] || 0) : 0)));
        if (ok) { entry.rec = rec; entry.exp = now() + (burst ? (vol ? TTL_BURST_VOL : TTL_BURST) : TTL_IDLE); st.stored++; if (cache.get(key) === entry) trim(); }
        else if (cache.get(key) === entry) cache.delete(key);
        return rec;
      });
    }, function (err) { if (cache.get(key) === entry) cache.delete(key); throw err; });
    cache.set(key, entry);
    return entry.pending.then(function (rec) { return make(Resp, rec); });   /* الطالب الأول أيضاً يستلم نسخته المستقلة */
  }

  window.SpatialShare = Object.freeze({
    v: 1, fetch: sfetch, clear: clear, clearData: clearData, burst: setBurst, classify: classify,
    trace: function () { return DBG ? DBG.slice() : null; }, stats: function () { return { hit: st.hit, join: st.join, miss: st.miss, bypass: st.bypass, clears: st.clears, stored: st.stored, size: cache.size, burst: burst, epoch: epoch, off: OFF }; }
  });
})();
