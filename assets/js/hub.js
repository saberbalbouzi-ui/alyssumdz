/* النشر التلقائي (Hub) — v1.89.77. المدير يدخل ببريده وكلمة مروره فقط ولا يُدخل أي رمز نشر في المتصفح:
   (1) يمرّر هذا الملف كل طلبات النشر الصادرة نحو واجهة المستودع إلى دالة `hub` على الخادم (بجلسته)، فتنفّذها بالرمز المحفوظ مشفَّراً هناك؛
   (2) `Hub.dialog()` يربط الرمز مرة واحدة ثم يمسحه من المتصفح. يعمل فقط حين يُضبط `CONFIG.HUB_SITE` (معرّف المتجر)؛ وإلا لا يمسّ شيئاً.
   الخادم: supabase/functions/hub/index.ts + supabase/hub.sql. الاختبار: node scripts/test-hub.js */
(function () {
  const LSK = "alyssum_gh_cfg", RX = /^https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)\/(.*)$/;
  const cfg = () => (typeof CONFIG !== "undefined" ? CONFIG : {});
  const site = () => String(cfg().HUB_SITE || "");
  const on = () => !!site() && typeof API !== "undefined" && API.sb && API.sb.enabled();
  const fnUrl = p => String(cfg().SUPABASE_URL).replace(/\/$/, "") + "/functions/v1/hub" + p;
  const getCfg = () => { try { return JSON.parse(localStorage.getItem(LSK) || "null"); } catch (e) { return null; } };
  const setCfg = c => { try { if (c) localStorage.setItem(LSK, JSON.stringify(c)); else localStorage.removeItem(LSK); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { sites: null, linked: false, row: null, err: "" };

  /* ── تمرير طلبات المستودع عبر الخادم ── */
  const orig = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    let m = null;
    try { const u = typeof input === "string" ? input : (input && input.url) || ""; m = on() ? RX.exec(u) : null; } catch (e) { m = null; }
    if (m) {
      const c = getCfg();
      if (c && c.token === "hub" && c.owner === m[1] && c.repo === m[2]) {
        const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة — سجّل الدخول من جديد (401)");
        let h = (init && init.headers) || {}; if (typeof Headers !== "undefined" && h instanceof Headers) h = Object.fromEntries(h.entries());
        return orig(fnUrl("/gh/" + site() + "/" + m[3]), Object.assign({}, init, { headers: Object.assign({}, h, { Authorization: "Bearer " + t, apikey: cfg().SUPABASE_ANON_KEY }) }));
      }
    }
    return orig(input, init);
  };

  async function call(p, opt) {
    const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة — سجّل الدخول من جديد");
    return orig(fnUrl(p), Object.assign({}, opt, { headers: Object.assign({ apikey: cfg().SUPABASE_ANON_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" }, (opt && opt.headers) || {}) }));
  }
  /* بعد الدخول: إن كان النشر التلقائي مفعّلاً لهذا المتجر يُضبط الربط تلقائياً بلا أي رمز */
  async function sync() {
    if (!on()) return false;
    try {
      const r = await call("/sites", { method: "GET" }); if (!r.ok) { S.err = "تعذّر الاتصال بخدمة النشر"; return false; }
      S.sites = (await r.json()).sites || []; S.row = S.sites.find(x => x.id === site()) || null; S.linked = !!(S.row && S.row.linked);
      const c = getCfg();
      if (S.linked) { if (!c || c.token !== "hub" || c.owner !== S.row.gh_owner || c.repo !== S.row.gh_repo) setCfg({ token: "hub", owner: S.row.gh_owner, repo: S.row.gh_repo, branch: S.row.gh_branch || "main" }); }
      else if (c && c.token === "hub") setCfg(null);
      S.err = ""; return S.linked;
    } catch (e) { S.err = String(e.message || e); return false; }
  }
  async function link(token, owner, repo, branch) {
    const r = await call("/link", { method: "POST", body: JSON.stringify({ site: site(), token, owner, repo, branch }) }), j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error({ forbidden: "هذا الحساب ليس مالك المتجر", no_write_permission: "هذا الرمز بلا صلاحية كتابة على الموقع", github_rejected: "الرمز أو بيانات الموقع غير صحيحة", bad_input: "راجع الرمز وبيانات الموقع", hub_not_configured: "خدمة النشر غير مفعّلة بعد — تواصل مع الدعم", unauthorized: "انتهت الجلسة — سجّل الدخول من جديد" }[j.error] || "تعذّر التفعيل (" + r.status + ")");
    setCfg({ token: "hub", owner: j.owner, repo: j.repo, branch: j.branch }); S.linked = true; return j;
  }
  async function unlink() { const r = await call("/unlink", { method: "POST", body: JSON.stringify({ site: site() }) }); if (!r.ok) throw new Error("تعذّر إيقاف الربط"); setCfg(null); S.linked = false; }

  /* ── نافذة التفعيل ── */
  function dialog() {
    let bg = document.getElementById("hub-bg"); if (bg) bg.remove();
    bg = document.createElement("div"); bg.id = "hub-bg"; bg.dir = "rtl";
    bg.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px";
    const btn = (cls, col) => `font:inherit;font-weight:800;cursor:pointer;color:#fff;border-radius:14px;padding:.65rem 1.1rem;border:1px solid rgba(${col},.6);background:rgba(${col},.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -6px 10px rgba(0,0,0,.2),0 6px 16px rgba(0,0,0,.25);backdrop-filter:blur(8px)`;
    const row = S.row || {}, inp = "width:100%;box-sizing:border-box;padding:.6rem .7rem;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:inherit;margin:.2rem 0 .6rem";
    const draw = () => {
      bg.innerHTML = `<div style="background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(134,239,172,.35);border-radius:20px;max-width:460px;width:100%;padding:1.3rem;box-shadow:0 24px 70px rgba(0,0,0,.6);font-family:inherit">
<h3 style="margin:0 0 .5rem;color:#bef264">النشر التلقائي</h3>
${S.linked ? `<p style="line-height:1.9;margin:.3rem 0 1rem">النشر التلقائي <b style="color:#86efac">مفعّل</b>: تُنشر تعديلاتك على موقعك بحسابك مباشرة، ولا تحتاج إلى أي رمز أو مفتاح.</p>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" id="hub-close" style="${btn("", "74,222,128")}">تم</button><button type="button" id="hub-off" style="${btn("", "239,68,68")}">إيقاف الربط</button></div>`
        : `<p style="line-height:1.9;margin:.3rem 0 .8rem;font-size:.9rem">تفعّل النشر مرة واحدة فقط: ألصق رمز النشر هنا، فيُحفظ مشفَّراً على الخادم ويُمسح من متصفحك، وبعدها يكفيك الدخول بالبريد وكلمة المرور.</p>
<label style="font-size:.8rem;font-weight:800">رمز النشر</label><input id="hub-tk" type="password" dir="ltr" autocomplete="off" style="${inp}">
<label style="font-size:.8rem;font-weight:800">اسم الحساب</label><input id="hub-ow" dir="ltr" value="${esc(row.gh_owner || (typeof SITE_CFG !== "undefined" && SITE_CFG.repoOwner) || "")}" style="${inp}">
<label style="font-size:.8rem;font-weight:800">اسم الموقع</label><input id="hub-rp" dir="ltr" value="${esc(row.gh_repo || (typeof SITE_CFG !== "undefined" && SITE_CFG.repoName) || "")}" style="${inp}">
<label style="font-size:.8rem;font-weight:800">النسخة المنشورة</label><input id="hub-br" dir="ltr" value="${esc(row.gh_branch || "main")}" style="${inp}">
<p id="hub-msg" style="min-height:1.4em;font-size:.82rem;color:#fda4af;margin:.2rem 0 .6rem">${esc(S.err && !S.sites ? S.err : "")}</p>
<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" id="hub-go" style="${btn("", "74,222,128")}">تفعيل النشر التلقائي</button><button type="button" id="hub-close" style="${btn("", "251,146,60")}">إلغاء</button></div>`}
</div>`;
      const q = i => bg.querySelector("#" + i);
      if (q("hub-close")) q("hub-close").onclick = () => bg.remove();
      if (q("hub-off")) q("hub-off").onclick = async () => { try { await unlink(); draw(); } catch (e) { alert(e.message); } };
      if (q("hub-go")) q("hub-go").onclick = async () => {
        const m = q("hub-msg"), b = q("hub-go"); b.disabled = true; m.style.color = "#bef264"; m.textContent = "جارٍ التحقق…";
        try { await link(q("hub-tk").value.trim(), q("hub-ow").value.trim(), q("hub-rp").value.trim(), q("hub-br").value.trim() || "main"); draw(); if (typeof toast === "function") toast("تم تفعيل النشر التلقائي"); }
        catch (e) { m.style.color = "#fda4af"; m.textContent = e.message; b.disabled = false; }
      };
    };
    const was = S.linked; document.body.appendChild(bg); draw(); sync().then(() => { if (bg.isConnected && S.linked !== was) draw(); });
  }
  window.Hub = { on, ready: () => S.sites !== null, sync, link, unlink, dialog, state: () => S, _fnUrl: fnUrl };
})();
