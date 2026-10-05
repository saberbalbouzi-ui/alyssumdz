/* تحديث لوحة الإدارة لآخر نسخة منشورة: زر «تحديث» في شريط اللوحة وفي شريط مطوّر الصفحات، وإشعار عند وجود نسخة أحدث.
   النسخة الحالية في <meta name="admin-version"> (يكتبها scripts/build-admin-pb.py من ملف VERSION)، والأحدث تُقرأ من /VERSION على الخادم. */
const AdminUpdate = (() => {
  const meta = document.querySelector('meta[name="admin-version"]'), cur = meta ? meta.content : "";
  let latest = "", avail = false, noted = "";
  const cmp = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  function paint() {
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
  /* تحديث الصفحة نفسها: يحفظ مسودة المطوّر ويعيد فتح الصفحة بمعامل جديد يتجاوز الكاش، فتُجلب آخر نسخة بعد الدمج */
  async function apply() {
    if (!avail && !(await (async () => { await check(false); return avail; })())) { toast("✅ أنت على آخر نسخة (" + cur + ")"); return; }
    try { if (typeof PBApp !== "undefined" && document.getElementById("pb-app") && document.getElementById("pb-app").classList.contains("on") && PBApp.E && PBApp.E.dirty) { PBApp.saveDraftNow && PBApp.saveDraftNow(); sessionStorage.setItem("pb_after_update", PBApp.E.slug || "new"); } } catch (e) { }
    const u = new URL(location.href); u.searchParams.set("v", latest); location.replace(u.toString());
  }
  const init = () => {
    const add = () => { const top = document.querySelector("#app .top"); if (!top || document.getElementById("au-btn")) return; const b = document.createElement("button"); b.id = "au-btn"; b.type = "button"; b.className = "small gold au-b"; b.setAttribute("data-au", "1"); b.innerHTML = '<span class="au-i">🔄</span> <span class="au-t">تحديث</span>'; b.onclick = () => (avail ? apply() : check(true)); const lg = top.querySelector(".logout"); lg ? top.insertBefore(b, lg) : top.appendChild(b); paint(); };
    const st = document.createElement("style"); st.textContent = ".au-new{position:relative;animation:aupulse 1.6s infinite}.au-new::after{content:\"\";position:absolute;top:-3px;inset-inline-end:-3px;width:10px;height:10px;border-radius:50%;background:#e53935;border:2px solid #fff}@keyframes aupulse{50%{box-shadow:0 0 0 6px rgba(200,162,75,.35)}}"; document.head.appendChild(st);
    add(); setInterval(add, 1500); check(false); setInterval(() => check(false), 5 * 60 * 1000); document.addEventListener("visibilitychange", () => { if (!document.hidden) check(false); });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { check, apply, paint, get current() { return cur; }, get latest() { return latest; } };
})();
