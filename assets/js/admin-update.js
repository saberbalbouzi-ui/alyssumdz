/* تحديث لوحة الإدارة لآخر نسخة منشورة: زر «تحديث» في شريط اللوحة وفي شريط مطوّر الصفحات، وإشعار عند وجود نسخة أحدث.
   النسخة الحالية في <meta name="admin-version"> (يكتبها scripts/build-admin-pb.py من ملف VERSION)، والأحدث تُقرأ من /VERSION على الخادم. */
const AdminUpdate = (() => {
  const meta = document.querySelector('meta[name="admin-version"]'), cur = meta ? meta.content : "";
  let latest = "", avail = false, noted = "";
  const cmp = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  function paint() {
    if (busy) return;
    document.querySelectorAll("[data-au]").forEach(b => { b.classList.toggle("au-new", avail); b.title = avail ? "يتوفر تحديث جديد " + latest + " — اضغط لتحديث هذه الصفحة" : "تحديث الصفحة لآخر نسخة (الحالية " + (cur || "؟") + ")"; const t = b.querySelector(".au-t"); if (t) t.textContent = avail ? "تحديث " + latest : "تحديث"; });
  }
  function banner() {
    if (!avail || noted === latest) return; noted = latest; warm(); try { if (localStorage.getItem("au_dismiss") === latest || sessionStorage.getItem("au_dismiss") === latest) return; } catch (e) { }
    const d = document.createElement("div"); d.id = "au-banner"; d.style.cssText = "position:fixed;top:14px;inset-inline-end:18px;z-index:10080;background:#173f35;color:#fff;border-radius:14px;padding:.7rem 1rem;box-shadow:0 10px 34px rgba(0,0,0,.4);display:flex;gap:.7rem;align-items:center;font-family:inherit;direction:rtl;max-width:min(92vw,420px)";
    d.innerHTML = `<span style="font-size:1.3rem">🔔</span><div style="flex:1;font-weight:800;font-size:.86rem;line-height:1.6">يتوفر تحديث جديد للوحة <span dir="ltr">${latest}</span><br><small style="font-weight:600;opacity:.8">تعديلاتك غير المنشورة في المطوّر تُحفظ كمسودة وتُستعاد</small></div><button type="button" id="au-go" style="background:#c8a24b;color:#173f35;border:0;border-radius:10px;padding:.45rem .9rem;font-weight:900;cursor:pointer;font-family:inherit">حدّث الآن</button><button type="button" id="au-x" style="background:none;border:0;color:#fff;opacity:.7;cursor:pointer;font-size:1rem" aria-label="لاحقاً">✕</button>`;
    document.body.appendChild(d); setTimeout(() => { if (d.isConnected && !d.matches(":hover")) { d.style.transition = "opacity .6s"; d.style.opacity = "0"; setTimeout(() => d.remove(), 650); } }, 20000); d.querySelector("#au-go").onclick = apply; d.querySelector("#au-x").onclick = () => { try { localStorage.setItem("au_dismiss", latest); sessionStorage.setItem("au_dismiss", latest); } catch (e) { } d.remove(); };
  }
  /* عند اكتشاف نسخة أحدث: يُحدَّث كاش المتصفح للصفحة وسكربتاتها في الخلفية، فإعادة التحميل العادية (F5) تأتي بالنسخة الجديدة ويختفي الإشعار (كان الكاش القديم يعيده بعد كل إعادة تحميل) */
  let warmed = "";
  function warm() {
    if (warmed === latest) return; warmed = latest;
    try { const urls = [location.pathname, ...[...document.scripts].map(x => x.src), ...[...document.querySelectorAll('link[rel="stylesheet"]')].map(x => x.href)].filter(Boolean); urls.forEach(u => fetch(u, { cache: "reload" }).catch(() => 0)); } catch (e) { }
  }
  async function check(force) {
    try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 6000); let r; try { r = await fetch("VERSION?t=" + Date.now(), { cache: "no-store", signal: ac.signal }); } finally { clearTimeout(tm); } if (!r.ok) return; const v = (await r.text()).trim(); if (!/^\d+\.\d+\.\d+$/.test(v)) return; latest = v; avail = !!cur && cmp(v, cur) > 0; paint(); if (avail) banner(); else if (force) toast("✅ أنت على آخر نسخة (" + cur + ")"); } catch (e) { if (force) toast("تعذّر التحقق من وجود تحديث"); }
  }
  const toast = m => { try { if (typeof Admin !== "undefined" && Admin.toast) return Admin.toast(m); } catch (e) { } const t = document.createElement("div"); t.className = "au-toast"; t.textContent = m; t.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-weight:800;z-index:10090;font-family:inherit"; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };
  /* حالة الصفحة قبل إعادة التحميل: التبويب المفتوح، وصفحة المطوّر المفتوحة بما فيها تعديلاتها غير المنشورة — فتعود كما كانت */
  function saveState() {
    try {
      const st = { t: Date.now(), tab: "", pb: null }, on = document.querySelector(".nav-btn.on"), m = on && /Admin\.tab\('([^']+)'/.exec(on.getAttribute("onclick") || ""); if (m) st.tab = m[1];
      const app = document.getElementById("pb-app");
      if (typeof PBApp !== "undefined" && app && app.classList.contains("on") && PBApp.E && PBApp.E.page) { const E = PBApp.E; st.pb = { page: E.page, slug: E.slug || "", isNew: !!E.isNew, dirty: !!E.dirty, dev: E.dev, sel: E.sel, ltab: E.ltab }; PBApp.saveDraftNow && PBApp.saveDraftNow(); }
      try { sessionStorage.setItem("au_state", JSON.stringify(st)); }
      catch (e) { if (st.pb) { const p = st.pb.page; st.pb.page = null; st.pb.slim = true; try { PBApp.saveDraftNow && PBApp.saveDraftNow(); } catch (x) { } sessionStorage.setItem("au_state", JSON.stringify(st)); st.pb.page = p; } else throw e; }      // صفحة كبيرة لا تتّسع لمخزن الجلسة: تُحفظ مسودتها في المتصفح وتُستعاد منها
    } catch (e) { try { sessionStorage.removeItem("au_state"); } catch (x) { } }
  }
  function restoreState() {
    let st = null; try { st = JSON.parse(sessionStorage.getItem("au_state") || "null"); sessionStorage.removeItem("au_state"); } catch (e) { } if (!st || Date.now() - st.t > 600000) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
    try { if (st.tab && typeof Admin !== "undefined") { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + st.tab + "'")); if (b) Admin.tab(st.tab, b); } } catch (e) { }
    try { if (st.pb && st.pb.slim && !st.pb.page) { let d = null; try { d = JSON.parse(localStorage.getItem("pb_draft_" + (st.pb.slug || "new")) || "null"); } catch (e) { } if (d) st.pb.page = d; else if (st.pb.slug && typeof PBAdmin !== "undefined") { PBAdmin.edit(st.pb.slug); st.pb = null; } }
      if (st.pb && st.pb.page && typeof PBApp !== "undefined") { PBApp.open(st.pb.page, st.pb.slug, st.pb.isNew); const E = PBApp.E; E.dirty = st.pb.dirty; if (st.pb.dev && st.pb.dev !== "d") PBApp.setDev(st.pb.dev); if (st.pb.sel && E.page) { setTimeout(() => { try { if (PBApp.find(st.pb.sel)) { E.sel = st.pb.sel; PBApp.renderCanvas(); } } catch (e) { } }, 400); } } } catch (e) { console.warn(e); }
    toast("✅ تم تحديث الصفحة");
  }
  /* نصوص الأزرار أثناء العمل: «جاري التحديث…» / «جاري مسح الكاش…» */
  let busy = false;
  function setBusy(kind) {
    busy = true; const txt = kind === "cc" ? "جاري مسح الكاش…" : "جاري التحديث…";
    document.querySelectorAll("[data-au], #au-cc, #pbx-cc").forEach(b => { b.disabled = true; const isCC = b.id === "au-cc" || b.id === "pbx-cc"; if (isCC !== (kind === "cc")) return; const t = b.querySelector(".au-t") || b.querySelector("span:last-child"); if (t) t.textContent = txt; else b.textContent = "⏳ " + txt; });
  }
  /* يجلب الصفحة وسكربتاتها وأنماطها من الخادم متجاوزاً الكاش ثم يعيد تحميل الصفحة نفسها (دون مغادرتها) */
  async function reloadFresh(param, val) {
    { const u0 = new URL(location.href); u0.searchParams.set(param, val); setTimeout(() => { try { location.replace(u0.toString()); } catch (e) { location.reload(); } }, 12000); }      /* صمّام أمان: لا يبقى «جاري التحديث…» أكثر من 12 ثانية مهما حدث */
    saveState(); try { API.sb.dbg("update-reload " + param + " left=" + Math.round(((API.sb.session() || {}).expires_at - Date.now()) / 60000) + "m"); } catch (e) { }
    /* لا نخسر الدخول عند التحديث: نجدّد الجلسة الآن إن قاربت على الانتهاء ونوقف أي تجديد آخر قبل إعادة التحميل (ردّ تجديد ضائع يُبطل رمز التجديد القديم) */
    try { if (typeof API !== "undefined" && API.sb && API.sb.enabled() && API.sb.session()) { const s = API.sb.session(); if (s.expires_at - Date.now() < 4 * 60 * 1000) await Promise.race([API.sb.renew(), new Promise(r => setTimeout(r, 5000))]); API.sb._freeze = true; } } catch (e) { }
    try { const urls = [location.pathname, "VERSION", ...[...document.scripts].map(x => x.src), ...[...document.querySelectorAll('link[rel="stylesheet"]')].map(x => x.href)].filter(Boolean); await Promise.race([Promise.all(urls.map(u => fetch(u, { cache: "reload" }).catch(() => 0))), new Promise(r => setTimeout(r, 7000))]); } catch (e) { }      /* لا ينتظر أكثر من 7 ثوانٍ: التحديث لا يعلق على مورد بطيء */
    const u = new URL(location.href); u.searchParams.set(param, val); if (latest) u.searchParams.set("v", latest); location.replace(u.toString());
  }
  /* تحديث: يتحقق من آخر نسخة ويعيد تحميل الصفحة نفسها بها، وتعود إلى التبويب/صفحة المطوّر المفتوحة بما فيها من تعديلات */
  async function apply() {
    if (busy) return; try { localStorage.removeItem("au_dismiss"); } catch (e) { } setBusy("up"); await new Promise(r => setTimeout(r, 50)); try { await check(false); } catch (e) { }
    await reloadFresh("u", Date.now().toString(36));
  }
  /* مسح الكاش: يحذف Cache Storage ويلغي عمّال الخدمة (PWA) ثم يعيد تحميل الصفحة نفسها. لا يمسّ localStorage (تسجيل الدخول، المفاتيح، المسودات). */
  async function clearCache() {
    if (busy) return; setBusy("cc"); await new Promise(r => setTimeout(r, 50));
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) { }
    try { if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch (e) { }
    await reloadFresh("cc", Date.now().toString(36));
  }
  /* أي إعادة تحميل (F5 أو إغلاق عرضي) تحفظ عمل المطوّر المفتوح فيعود كما كان؛ ولا يُحفظ شيء إن كان المطوّر مغلقاً */
  const inEditor = () => { const app = document.getElementById("pb-app"); return typeof PBApp !== "undefined" && app && app.classList.contains("on") && PBApp.E && PBApp.E.page; };
  window.addEventListener("pagehide", () => { try { if (inEditor()) saveState(); } catch (e) { } });
  /* تحديث تلقائي: إن وُجدت نسخة أحدث والمطوّر مفتوح ولا نشاط منذ 45 ثانية (ولا رفع صور ولا نشر جارٍ) يُحفَظ العمل ويُحدَّث ثم يُعاد فتح الصفحة كما كانت. يظهر عدّاد 10 ثوانٍ مع زر إلغاء */
  let lastAct = Date.now(), autoOff = "", cdTimer = 0; const seenDocs = new WeakSet();
  const act = () => { lastAct = Date.now(); }, hookDoc = d => { if (!d || seenDocs.has(d)) return; seenDocs.add(d); ["pointerdown", "keydown", "wheel", "input"].forEach(ev => d.addEventListener(ev, act, true)); };
  hookDoc(document);
  function autoTick() {
    try {
      if (!avail || busy || autoOff === latest || cdTimer || !inEditor()) return; const E = PBApp.E, fr = document.getElementById("pbx-frame"); try { hookDoc(fr && fr.contentDocument); } catch (e) { }
      if (Date.now() - lastAct < 45000 || E.upN || E.pubBusy || E.busy) return;
      let n = 10; const d = document.createElement("div"); d.id = "au-auto"; d.style.cssText = "position:fixed;bottom:18px;inset-inline-start:18px;z-index:10090;background:#173f35;color:#fff;border-radius:14px;padding:.7rem 1rem;box-shadow:0 10px 34px rgba(0,0,0,.4);display:flex;gap:.8rem;align-items:center;font-family:inherit;direction:rtl;font-weight:800;font-size:.86rem";
      d.innerHTML = '<span id="au-n"></span><button type="button" style="background:#c8a24b;color:#173f35;border:0;border-radius:10px;padding:.35rem .8rem;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>'; document.body.appendChild(d);
      const say = () => { d.querySelector("#au-n").textContent = "سيُحدَّث المطوّر تلقائياً بعد " + n + " ثوانٍ وتعود صفحتك كما هي"; }; say();
      d.querySelector("button").onclick = () => { autoOff = latest; clearInterval(cdTimer); cdTimer = 0; d.remove(); };
      cdTimer = setInterval(() => { if (Date.now() - lastAct < 3000 || E.pubBusy || E.upN) { autoOff = latest; clearInterval(cdTimer); cdTimer = 0; d.remove(); return; } n--; if (n <= 0) { clearInterval(cdTimer); cdTimer = 0; d.remove(); apply(); } else say(); }, 1000);
    } catch (e) { }
  }
  setInterval(autoTick, 10000);
  /* بعد تحميل اللوحة (تنتهي Admin.load باستدعاء routeHash) نعيد التبويب وصفحة المطوّر */
  function hookRestore() {
    let has = false; try { has = !!sessionStorage.getItem("au_state"); } catch (e) { } if (!has) return;
    let done = false; const run = () => { if (done) return; done = true; setTimeout(restoreState, 200); };
    const t0 = setInterval(() => { try { if (typeof Admin !== "undefined" && typeof Admin.routeHash === "function" && !Admin.__auHook) { Admin.__auHook = 1; const o = Admin.routeHash; Admin.routeHash = function () { const r = o.apply(this, arguments); run(); return r; }; clearInterval(t0); } } catch (e) { } }, 50);
    setTimeout(() => { clearInterval(t0); if (!done) run(); }, 30000);
  }
  const init = () => {
    const add = () => { const top = document.querySelector("#app .top"); if (!top || document.getElementById("au-btn")) return; const b = document.createElement("button"); b.id = "au-btn"; b.type = "button"; b.className = "small gold au-b"; b.setAttribute("data-au", "1"); b.innerHTML = '<span class="au-i">🔄</span> <span class="au-t">تحديث</span>'; b.onclick = apply; const lg = top.querySelector(".logout"); lg ? top.insertBefore(b, lg) : top.appendChild(b); const c = document.createElement("button"); c.id = "au-cc"; c.type = "button"; c.className = "small gray"; c.title = "مسح كاش المتصفح لهذا الموقع وإعادة تحميل الصفحة"; c.innerHTML = "🧹 مسح الكاش"; c.onclick = clearCache; b.after(c); paint(); };
    const st = document.createElement("style"); st.textContent = ".au-new{position:relative;animation:aupulse 1.6s infinite}.au-new::after{content:\"\";position:absolute;top:-3px;inset-inline-end:-3px;width:10px;height:10px;border-radius:50%;background:#e53935;border:2px solid #fff}@keyframes aupulse{50%{box-shadow:0 0 0 6px rgba(200,162,75,.35)}}"; document.head.appendChild(st);
    hookRestore(); add(); setInterval(add, 1500); check(false); setInterval(() => check(false), 5 * 60 * 1000); document.addEventListener("visibilitychange", () => { if (!document.hidden) check(false); });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { check, apply, clearCache, paint, get current() { return cur; }, get latest() { return latest; } };
})();
