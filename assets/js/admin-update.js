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
    if (!avail || noted === latest) return; noted = latest; try { if (sessionStorage.getItem("au_dismiss") === latest) return; } catch (e) { }
    const d = document.createElement("div"); d.id = "au-banner"; d.style.cssText = "position:fixed;bottom:18px;inset-inline-start:18px;z-index:10080;background:#173f35;color:#fff;border-radius:14px;padding:.7rem 1rem;box-shadow:0 10px 34px rgba(0,0,0,.4);display:flex;gap:.7rem;align-items:center;font-family:inherit;direction:rtl;max-width:min(92vw,420px)";
    d.innerHTML = `<span style="font-size:1.3rem">🔔</span><div style="flex:1;font-weight:800;font-size:.86rem;line-height:1.6">يتوفر تحديث جديد للوحة <span dir="ltr">${latest}</span><br><small style="font-weight:600;opacity:.8">تعديلاتك غير المنشورة في المطوّر تُحفظ كمسودة وتُستعاد</small></div><button type="button" id="au-go" style="background:#c8a24b;color:#173f35;border:0;border-radius:10px;padding:.45rem .9rem;font-weight:900;cursor:pointer;font-family:inherit">حدّث الآن</button><button type="button" id="au-x" style="background:none;border:0;color:#fff;opacity:.7;cursor:pointer;font-size:1rem" aria-label="لاحقاً">✕</button>`;
    document.body.appendChild(d); d.querySelector("#au-go").onclick = apply; d.querySelector("#au-x").onclick = () => { try { sessionStorage.setItem("au_dismiss", latest); } catch (e) { } d.remove(); };
  }
  async function check(force) {
    try { const r = await fetch("VERSION?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; const v = (await r.text()).trim(); if (!/^\d+\.\d+\.\d+$/.test(v)) return; latest = v; avail = !!cur && cmp(v, cur) > 0; paint(); if (avail) banner(); else if (force) toast("✅ أنت على آخر نسخة (" + cur + ")"); } catch (e) { if (force) toast("تعذّر التحقق من وجود تحديث"); }
  }
  const toast = m => { try { if (typeof Admin !== "undefined" && Admin.toast) return Admin.toast(m); } catch (e) { } const t = document.createElement("div"); t.textContent = m; t.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#173f35;color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-weight:800;z-index:10090;font-family:inherit"; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };
  /* حالة الصفحة قبل إعادة التحميل: التبويب المفتوح، وصفحة المطوّر المفتوحة بما فيها تعديلاتها غير المنشورة — فتعود كما كانت */
  function saveState() {
    try {
      const st = { t: Date.now(), tab: "", pb: null }, on = document.querySelector(".nav-btn.on"), m = on && /Admin\.tab\('([^']+)'/.exec(on.getAttribute("onclick") || ""); if (m) st.tab = m[1];
      const app = document.getElementById("pb-app");
      if (typeof PBApp !== "undefined" && app && app.classList.contains("on") && PBApp.E && PBApp.E.page) { const E = PBApp.E; st.pb = { page: E.page, slug: E.slug || "", isNew: !!E.isNew, dirty: !!E.dirty, dev: E.dev, sel: E.sel, ltab: E.ltab }; PBApp.saveDraftNow && PBApp.saveDraftNow(); }
      sessionStorage.setItem("au_state", JSON.stringify(st));
    } catch (e) { try { sessionStorage.removeItem("au_state"); } catch (x) { } }
  }
  function restoreState() {
    let st = null; try { st = JSON.parse(sessionStorage.getItem("au_state") || "null"); sessionStorage.removeItem("au_state"); } catch (e) { } if (!st || Date.now() - st.t > 120000) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { }
    try { if (st.tab && typeof Admin !== "undefined") { const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + st.tab + "'")); if (b) Admin.tab(st.tab, b); } } catch (e) { }
    try { if (st.pb && typeof PBApp !== "undefined") { PBApp.open(st.pb.page, st.pb.slug, st.pb.isNew); const E = PBApp.E; E.dirty = st.pb.dirty; if (st.pb.dev && st.pb.dev !== "d") PBApp.setDev(st.pb.dev); if (st.pb.sel && E.page) { setTimeout(() => { try { if (PBApp.find(st.pb.sel)) { E.sel = st.pb.sel; PBApp.renderCanvas(); } } catch (e) { } }, 400); } } } catch (e) { console.warn(e); }
    toast("✅ أُعيد تحميل الصفحة وبقيت في مكانها");
  }
  /* نصوص الأزرار أثناء العمل: «جاري التحديث…» / «جاري مسح الكاش…» */
  let busy = false;
  function setBusy(kind) {
    busy = true; const txt = kind === "cc" ? "جاري مسح الكاش…" : "جاري التحديث…";
    document.querySelectorAll("[data-au], #au-cc, #pbx-cc").forEach(b => { b.disabled = true; const isCC = b.id === "au-cc" || b.id === "pbx-cc"; if (isCC !== (kind === "cc")) return; const t = b.querySelector(".au-t") || b.querySelector("span:last-child"); if (t) t.textContent = txt; else b.textContent = "⏳ " + txt; });
  }
  /* يجلب الصفحة وسكربتاتها وأنماطها من الخادم متجاوزاً الكاش ثم يعيد تحميل الصفحة نفسها (دون مغادرتها) */
  async function reloadFresh(param, val) {
    saveState();
    try { const urls = [location.pathname, "VERSION", ...[...document.scripts].map(x => x.src), ...[...document.querySelectorAll('link[rel="stylesheet"]')].map(x => x.href)].filter(Boolean); await Promise.all(urls.map(u => fetch(u, { cache: "reload" }).catch(() => 0))); } catch (e) { }
    const u = new URL(location.href); u.searchParams.set(param, val); if (latest) u.searchParams.set("v", latest); location.replace(u.toString());
  }
  /* تحديث: يتحقق من آخر نسخة ويعيد تحميل الصفحة نفسها بها، وتعود إلى التبويب/صفحة المطوّر المفتوحة بما فيها من تعديلات */
  async function apply() {
    if (busy) return; setBusy("up"); await new Promise(r => setTimeout(r, 50)); try { await check(false); } catch (e) { }
    await reloadFresh("u", Date.now().toString(36));
  }
  /* مسح الكاش: يحذف Cache Storage ويلغي عمّال الخدمة (PWA) ثم يعيد تحميل الصفحة نفسها. لا يمسّ localStorage (تسجيل الدخول، المفاتيح، المسودات). */
  async function clearCache() {
    if (busy) return; setBusy("cc"); await new Promise(r => setTimeout(r, 50));
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) { }
    try { if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch (e) { }
    await reloadFresh("cc", Date.now().toString(36));
  }
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
