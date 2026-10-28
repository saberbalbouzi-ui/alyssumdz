/* «سرعة الموقع»: تحليل أداء موقعك للجوال والحاسوب (الأداء، إمكانية الوصول، أفضل الممارسات، SEO) ثم «معالج الأخطاء»:
   قائمة بالبنود الراسبة مرتبة بعدد النقاط التي ستستردّها كل واحدة مع طريقة إصلاحها حتى تصل إلى 100.
   الواجهة بلا خيارات: تختار الأداة الطريقة داخلياً — فحص مفصّل على خادم الموقع، وإن لم يتوفر تنتقل تلقائياً لخدمة احتياطية.
   المنطق النقي في speed-core.js؛ المشغّل scripts/speed-run.mjs + .github/workflows/speed-test.yml. */
const AdminSpeed = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const K_HIST = "alyssum_speed_hist", K_URL = "alyssum_speed_url";
  const CAT_N = { performance: "الأداء", accessibility: "إمكانية الوصول", "best-practices": "أفضل الممارسات", seo: "SEO" };
  const DEV_N = { mobile: "الجوال", desktop: "الحاسوب" };
  const S = { url: "", dev: "both", eng: "", busy: false, prog: "", err: "", res: null, cur: "mobile", cat: "all", open: {}, full: false, runId: 0, loaded: false };
  const rd = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const hist = () => { try { return JSON.parse(rd(K_HIST, "[]")) || []; } catch (e) { return []; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function ghCfg() { try { const c = typeof GH !== "undefined" && GH.cfg ? GH.cfg() : null; return c && c.token && c.token !== "php" && c.owner ? c : null; } catch (e) { return null; } }

  async function loadRecipes() {
    if (S.loaded || typeof SpeedCore === "undefined") return; S.loaded = true;
    try { const r = await fetch("assets/data/speed-recipes.json", { cache: "no-cache" }); if (r.ok) SpeedCore.setRecipes(await r.json()); } catch (e) { }
  }

  /* ───────── المحرّك 1: Lighthouse على خادم الموقع (Actions) ───────── */
  async function runServer(url, devices, say, token) {
    const c = ghCfg(); if (!c) throw Object.assign(new Error("الفحص غير متاح حالياً"), { code: "NOGH", fallback: true });
    const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), api = "https://api.github.com/repos/" + c.owner + "/" + c.repo, br = c.branch || "main";
    const H = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" }, path = "assets/speed/" + id + ".json.gz", t0 = Date.now();
    say("جارٍ تجهيز الفحص…");
    const r = await fetch(api + "/actions/workflows/speed-test.yml/dispatches", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ ref: br, inputs: { url, devices, locale: "ar", id } }) }).catch(e => { console.warn("speed dispatch", e); throw Object.assign(new Error("تعذّر الاتصال بالخدمة"), { fallback: true }); });
    if (r.status !== 204) throw Object.assign(new Error("فشل تشغيل الفحص (" + r.status + ")"), { fallback: true });
    let n = 0;
    while (Date.now() - t0 < 600000) {
      await sleep(6000); if (S.runId !== token) throw new Error("أُلغي الفحص"); n++;
      say("جارٍ فحص موقعك… " + Math.round((Date.now() - t0) / 1000) + " ثانية");
      const g = await fetch(api + "/contents/" + path + "?ref=" + encodeURIComponent(br) + "&t=" + Date.now(), { headers: H }).catch(() => null);
      if (g && g.ok) {
        const m = await g.json(); if (!m.content && m.sha) { const bl = await fetch(api + "/git/blobs/" + m.sha, { headers: H }).then(x => x.ok ? x.json() : null).catch(() => null); if (bl && bl.content) m.content = bl.content; }     // ملف أكبر من 1MB لا تعيده واجهة المحتويات
        if (!m.content) throw new Error("تعذّر قراءة نتيجة الفحص");
        const bin = Uint8Array.from(atob(String(m.content || "").replace(/\s/g, "")), ch => ch.charCodeAt(0));
        const res = await SpeedCore.gunzipJson(bin);
        fetch(api + "/contents/" + path, { method: "DELETE", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ message: "speed: تنظيف", sha: m.sha, branch: br }) }).catch(() => { });
        return res;
      }
      if (g && g.status !== 404) throw new Error("تعذّر قراءة النتيجة (" + g.status + ")");
      if (n % 3 === 0) {       // اكتشاف فشل التشغيل مبكراً بدل انتظار المهلة كلها
        const rr = await fetch(api + "/actions/workflows/speed-test.yml/runs?event=workflow_dispatch&per_page=5&t=" + Date.now(), { headers: H }).then(x => x.ok ? x.json() : null).catch(() => null);
        const bad = rr && (rr.workflow_runs || []).find(w => Date.parse(w.created_at) >= t0 - 15000 && w.conclusion === "failure");
        if (bad) throw new Error("تعذّر إكمال الفحص — أعد المحاولة بعد قليل");
      }
    }
    throw new Error("انتهت المهلة قبل اكتمال الفحص — حاول مجدداً");
  }

  /* ───────── المحرّك 2: PageSpeed Insights ───────── */
  async function runPsi(url, devices, say, token) {
    const out = { v: 1, url, at: new Date().toISOString(), devices: {} }, key = "";
    for (const d of (devices === "both" ? ["mobile", "desktop"] : [devices])) {
      if (S.runId !== token) throw new Error("أُلغي الفحص");
      say("جارٍ فحص نسخة " + DEV_N[d] + "…");
      const q = "url=" + encodeURIComponent(url) + "&strategy=" + d + "&locale=ar" + CAT_N_KEYS().map(c => "&category=" + c.toUpperCase().replace("-", "_")).join("") + (key ? "&key=" + encodeURIComponent(key) : "");
      let j = null, st = 0;
      for (let a = 0; a < 2 && !(j && j.lighthouseResult); a++) {
        try { const r = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + q); st = r.status; j = await r.json().catch(() => null); } catch (e) { j = { error: { code: 0, message: "تعذّر الاتصال بالخدمة — تحقق من اتصالك" } }; }
        if (st === 429) break; if (!j || j.error) await sleep(2500);
      }
      if (st === 429) out.devices[d] = { error: { code: "PSI_QUOTA", message: "الخدمة مشغولة الآن، حاول بعد دقائق قليلة." } };
      else out.devices[d] = SpeedCore.fromPsi(d, j);
    }
    return out;
  }
  const CAT_N_KEYS = () => Object.keys(CAT_N);


  /* ───────── الإصلاح التلقائي: نعدّل كود الصفحة وننشره ثم يُعاد الفحص ───────── */
  const K_UNDO = "alyssum_speed_undo";
  const b64dec = b => decodeURIComponent(escape(atob(String(b).replace(/\s/g, ""))));
  const b64enc = t => btoa(unescape(encodeURIComponent(t)));
  const blobB64 = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(b); });
  const undoList = () => { try { return JSON.parse(rd(K_UNDO, "[]")) || []; } catch (e) { return []; } };
  const ghReady = () => typeof GH !== "undefined" && GH.getFile && GH.putFile && ghCfg();
  async function ghPut(path, b64, msg) { let sha; try { sha = (await GH.getFile(path)).sha; } catch (e) { } return GH.putFile(path, b64, sha, msg); }
  async function loadSrc(path) {       // نسخة الرابط النظيف تُولَّد من الصفحة الأصلية، فنعدّل الأصل لا النسخة
    const f = await GH.getFile(path), html = b64dec(f.content);
    if (/<!--seo-mirror-->/.test(html)) { const m = /^([^/]+)\/index\.html$/.exec(path); if (m) for (const c of ["p/" + m[1] + "/index.html", "lp/" + m[1] + "/index.html"]) { try { const g = await GH.getFile(c); return { path: c, html: b64dec(g.content) }; } catch (e) { } } }
    return { path, html };
  }
  const fxDims = (srcs, base) => Promise.all(srcs.slice(0, 40).map(s => new Promise(res => { const im = new Image(); im.onload = () => res([s, im.naturalWidth && im.naturalHeight ? { w: im.naturalWidth, h: im.naturalHeight } : null]); im.onerror = () => res([s, null]); try { im.src = new URL(s, base).href; } catch (e) { res([s, null]); } }))).then(a => Object.fromEntries(a.filter(x => x[1])));
  async function fxWebp(srcs, base) {
    const files = [], map = {};
    for (const s of srcs) {
      if (files.length >= 6) break;
      try {
        const u = new URL(s, base); if (u.origin !== location.origin) continue;
        const r = await fetch(u.href, { cache: "no-store" }); if (!r.ok) continue; const b = await r.blob(); if (b.size < 40 * 1024) continue;
        const bm = await createImageBitmap(b), sc = Math.min(1, 1600 / bm.width), w = Math.round(bm.width * sc), h = Math.round(bm.height * sc), cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(bm, 0, 0, w, h);
        const wb = await new Promise(ok => cv.toBlob(ok, "image/webp", 0.82)); if (!wb || wb.type !== "image/webp" || wb.size > b.size * 0.85) continue;
        const rel = s.replace(/\.(?:png|jpe?g)(?:[?#].*)?$/i, "") + "-opt.webp"; files.push({ path: new URL(rel, base).pathname.replace(/^\//, ""), blob: wb, saved: b.size - wb.size }); map[s] = rel;
      } catch (e) { }
    }
    return { files, map };
  }
  function anyLhr() { const d = S.res && S.res.devices; if (!d) return null; return (d[S.cur] && d[S.cur].lhr) || (d.mobile && d.mobile.lhr) || (d.desktop && d.desktop.lhr) || null; }
  async function fxScan() {
    S.fx = { busy: true, msg: "جارٍ فحص كود الصفحة…" }; draw();
    try {
      if (!S.res || typeof SpeedFix === "undefined") throw new Error("حلّل الموقع أولاً");
      if (!ghReady()) throw new Error("الإصلاح التلقائي يحتاج ربط النشر من إعدادات الموقع");
      let u; try { u = new URL(S.res.url); } catch (e) { throw new Error("رابط غير صالح"); }
      if (u.origin !== location.origin) throw new Error("الإصلاح التلقائي يعمل على صفحات موقعك فقط");
      const path = SpeedFix.pagePath(u.href); if (!path) throw new Error("تعذّر تحديد ملف الصفحة");
      const src = await loadSrc(path).catch(() => { throw new Error("تعذّر قراءة الصفحة (" + path + ")"); });
      const base = new URL(src.path, location.origin + "/").href, lhr = anyLhr() || {}, origin = location.origin;
      S.fx.msg = "جارٍ تجهيز الصور…"; draw();
      const first = SpeedFix.analyze(src.html, lhr, { origin }), need = id => ((first.find(x => x.id === id) || {}).need) || [];
      const dims = await fxDims(need("ratio"), base), wp = await fxWebp(need("webp"), base), css = {};
      for (const h of SpeedFix.localCss(src.html, origin)) { try { const p = new URL(h, base).pathname.replace(/^\//, ""), g = await GH.getFile(p); css[p] = b64dec(g.content); } catch (e) { } }
      const ctx = { origin, dims, webp: wp.map, css }, plan = SpeedFix.analyze(src.html, lhr, ctx), sel = {}; plan.forEach(p => { sel[p.id] = p.risk === "safe" && p.count > 0; });
      S.fx = { path: src.path, html: src.html, lhr, ctx, plan, sel, files: wp.files, saved: wp.files.reduce((s, f) => s + f.saved, 0) };
    } catch (e) { S.fx = { err: e.message || String(e) }; }
    draw();
  }
  async function fxApply() {
    const fx = S.fx; if (!fx || fx.busy || !fx.plan) return; const ids = fx.plan.filter(p => fx.sel[p.id] && p.count).map(p => p.id);
    if (!ids.length) return toast("اختر إصلاحاً واحداً على الأقل");
    fx.busy = true; fx.msg = "جارٍ تطبيق الإصلاحات ونشرها…"; draw();
    try {
      const res = SpeedFix.apply(fx.html, ids, fx.lhr, fx.ctx), undo = { at: Date.now(), path: fx.path, prev: b64enc(fx.html), css: [] }, writes = [];
      if (ids.includes("webp")) for (const f of fx.files) writes.push({ path: f.path, b64: await blobB64(f.blob), msg: "سرعة الموقع: نسخة WebP أخف" });
      if (ids.includes("fontdisplay")) for (const [p, c] of Object.entries(fx.ctx.css)) { const r = SpeedFix.fixCss(c); if (r.n) { undo.css.push({ path: p, prev: b64enc(c) }); writes.push({ path: p, b64: b64enc(r.css), msg: "سرعة الموقع: عرض النص أثناء تحميل الخط" }); } }
      if (res.html !== fx.html) writes.push({ path: fx.path, b64: b64enc(res.html), msg: "سرعة الموقع: إصلاحات تلقائية (" + ids.join("، ") + ")" });
      if (!writes.length) throw new Error("لا تغييرات لتطبيقها");
      for (const w of writes) await ghPut(w.path, w.b64, w.msg);
      if (undo.prev.length + undo.css.reduce((s, c) => s + c.prev.length, 0) < 1500000) wr(K_UNDO, JSON.stringify([undo].concat(undoList()).slice(0, 3)));
      S.fx = { done: true, report: res.report.filter(r => r.n), path: fx.path, files: writes.length };
      toast("✓ نُشرت الإصلاحات — أعد الفحص بعد دقيقة");
    } catch (e) { S.fx = Object.assign({}, fx, { busy: false, err: "تعذّر تطبيق الإصلاح: " + (e.message || e) }); }
    draw();
  }
  async function fxUndo() {
    const l = undoList(), u = l[0]; if (!u) return;
    S.fx = { busy: true, msg: "جارٍ التراجع…" }; draw();
    try { await ghPut(u.path, u.prev, "سرعة الموقع: تراجع عن الإصلاح التلقائي"); for (const c of u.css || []) await ghPut(c.path, c.prev, "سرعة الموقع: تراجع عن الإصلاح التلقائي"); wr(K_UNDO, JSON.stringify(l.slice(1))); S.fx = { done: true, undone: true, path: u.path }; toast("✓ تم التراجع"); }
    catch (e) { S.fx = { err: "تعذّر التراجع: " + (e.message || e) }; }
    draw();
  }
  function fxBox() {
    const fx = S.fx || {}, un = undoList().length, who = "";
    const head = `<div class="sp-row" style="justify-content:space-between"><h3 style="margin:0">🛠 إصلاح تلقائي</h3><span>${un ? '<button class="sp-btn g" data-sp="fxundo">↩ تراجع عن آخر إصلاح</button> ' : ""}<button class="sp-btn" data-sp="fxscan"${fx.busy ? " disabled" : ""}>${fx.plan ? "إعادة الفحص" : "افحص ما يمكن إصلاحه"}</button></span></div>`;
    const hint = '<p class="sp-hint">لا نعرض المشاكل فقط: تعدّل الأداة كود صفحتك وتنشره، ويمكنك التراجع بنقرة. ما لا يمكن إصلاحه آلياً تجد حلّه مكتوباً في البنود أدناه.</p>';
    let body = "";
    if (fx.busy) body = `<div class="sp-prog"><span class="sp-spin"></span><span>${esc(fx.msg || "")}</span></div>`;
    else if (fx.err) body = `<div class="sp-err" role="alert">${esc(fx.err)}</div>`;
    else if (fx.done) body = `<div class="sp-fix"><b>${fx.undone ? "تم التراجع عن آخر إصلاح." : "تم تطبيق الإصلاحات ونشرها"}</b>${fx.report ? "<ul class=\"sp-it\" style=\"direction:rtl;text-align:start\">" + fx.report.map(r => "<li>" + esc((SpeedFix.FIXERS.find(f => f.id === r.id) || {}).title || r.id) + " — " + r.n + " تعديل</li>").join("") + "</ul>" : ""}<small>الموقع يتحدّث خلال دقيقة تقريباً، ثم اضغط «حلّل الآن» لترى النتيجة.</small></div>`;
    else if (fx.plan) {
      const rows = fx.plan.filter(p => p.count || p.manual.length).map(p => `<div class="sp-fxr"><label><input type="checkbox" data-sp="fxsel" data-id="${p.id}"${fx.sel[p.id] ? " checked" : ""}${p.count ? "" : " disabled"}> <b>${esc(p.title)}</b> <span class="sp-pts${p.count ? "" : " z"}">${p.count ? p.count + " تعديل" : "يدوي"}</span>${p.risk === "review" ? ' <span class="sp-cat">يحتاج مراجعة بعد التطبيق</span>' : ""}</label><small>${esc(p.desc)}${p.id === "webp" && fx.saved ? " — توفير ≈ " + Math.round(fx.saved / 1024) + " KiB" : ""}</small>${p.manual.length ? '<ul class="sp-it" style="direction:rtl;text-align:start">' + p.manual.slice(0, 5).map(m => "<li>" + esc(m) + " — يحتاج تدخلك</li>").join("") + "</ul>" : ""}</div>`).join("");
      const n = fx.plan.filter(p => fx.sel[p.id] && p.count).reduce((s, p) => s + p.count, 0);
      body = rows ? `<div class="sp-fxl">${rows}</div><div class="sp-row" style="margin-top:.7rem"><button class="sp-btn" data-sp="fxapply"${n ? "" : " disabled"}>طبّق الإصلاحات المحدّدة (${n})</button></div><p class="sp-hint">الصفحة: <span dir="ltr">${esc(fx.path)}</span> — الصفحات التي يعيد المطوّر بناءها عند حفظها قد تحتاج إعادة تطبيق الإصلاح.</p>` : '<p class="sp-hint">لا توجد إصلاحات آلية لهذه الصفحة. راجع الحلول المكتوبة في البنود أدناه.</p>';
    }
    return `<div class="sp-box sp-fx">${head}${hint}${body}</div>`;
  }

  /* ───────── تشغيل الفحص ───────── */
  async function run() {
    const url = SpeedCore.normUrl(S.url); if (!url) return toast("اكتب رابط موقعك الصحيح (يبدأ بـ https://)");
    if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.)/i.test(url)) return toast("الفحص يعمل على المواقع المنشورة فقط، لا على عناوين محلية");
    await loadRecipes(); S.url = url; wr(K_URL, url);
    const token = ++S.runId; S.busy = true; S.err = ""; S.res = null; S.fx = null; S.full = false; S.prog = "جارٍ التجهيز…"; draw();
    const say = t => { if (S.runId === token) { S.prog = t; const e = $("sp-prog"); if (e) e.textContent = t; } };
    try {
      let res; try { res = await runServer(url, S.dev, say, token); } catch (e) { if (!e.fallback) throw e; S.why = (e && (e.code || "") + " " + (e && e.message || "")).trim(); console.warn("speed: الفحص المفصّل غير متاح", S.why); res = await runPsi(url, S.dev, say, token); res.why = S.why; }
      if (S.runId !== token) return;
      S.res = res; S.cur = res.devices.mobile ? "mobile" : "desktop"; S.cat = "all"; S.open = {};
      pushHist(res);
      if (Object.values(res.devices).every(d => d.error)) S.err = Object.values(res.devices)[0].error.message;
    } catch (e) { if (S.runId === token) S.err = (/^Failed to fetch|NetworkError|Load failed/i.test(e && e.message || "") ? "تعذّر الاتصال بالخدمة (" + e.message + ") — تحقق من اتصالك وأعد تحميل اللوحة، أو بدّل طريقة الفحص." : e.message) || "فشل الفحص"; console.warn("speed", e); }
    if (S.runId === token) { S.busy = false; draw(); }
  }
  function pushHist(res) {
    const row = { at: res.at, url: res.url, s: {} };
    for (const d of Object.keys(res.devices)) if (res.devices[d].lhr) row.s[d] = SpeedCore.summarize(res.devices[d].lhr, { lang: "ar" }).scores;
    const h = hist().filter(x => !(x.url === row.url && x.at === row.at)); h.unshift(row); wr(K_HIST, JSON.stringify(h.slice(0, 12)));
  }

  /* ───────── العرض ───────── */
  function css() {
    if ($("sp-css")) return; const s = document.createElement("style"); s.id = "sp-css";
    s.textContent = `#sp-app{display:grid;gap:1rem;max-width:1100px;grid-template-columns:minmax(0,1fr)}#sp-app>*{min-width:0}
.sp-box{padding:1rem;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05)}.sp-box h3{margin:0 0 .6rem;font-size:1.05rem}
.sp-row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}.sp-in{flex:1 1 280px;min-width:0;padding:.65rem .8rem;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:inherit;font:inherit;direction:ltr}
.sp-seg{display:inline-flex;border:1px solid rgba(255,255,255,.22);border-radius:12px;overflow:hidden}.sp-seg button{padding:.5rem .9rem;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}.sp-seg button.on{background:rgba(var(--g-mint-rgb),.25);font-weight:800}
.sp-btn{padding:.6rem 1.3rem;border-radius:14px;font:inherit;font-weight:800;cursor:pointer;border:0;background:linear-gradient(180deg,#effe17,#e2fe17);color:#1f2123;transition:transform .15s}.sp-btn:hover{transform:translateY(-2px)}.sp-btn:active{transform:translateY(3px)}.sp-btn[disabled]{opacity:.55;pointer-events:none}.sp-btn.g{background:rgba(255,255,255,.12);color:inherit;border:1px solid rgba(255,255,255,.25)}
.sp-eng{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:.6rem;margin-top:.7rem}.sp-eng label{display:flex;gap:.5rem;padding:.7rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);cursor:pointer;align-items:flex-start}.sp-eng label.on{border-color:rgba(var(--g-mint-rgb),.8);background:rgba(var(--g-mint-rgb),.1)}.sp-eng label.off{opacity:.5}.sp-eng small{display:block;opacity:.8;margin-top:.15rem;line-height:1.6}
.sp-rings{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:.8rem;text-align:center}.sp-ring{display:grid;gap:.3rem;justify-items:center}.sp-ring svg{width:96px;height:96px}.sp-ring b{font-size:.85rem;font-weight:700}
.sp-good{--c:#0c6}.sp-mid{--c:#fa3}.sp-bad{--c:#f33}.sp-na{--c:#9aa}
.sp-met{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}.sp-met div{padding:.6rem .7rem;border-radius:12px;border:1px solid rgba(255,255,255,.14);border-inline-start:4px solid var(--c)}.sp-met small{display:block;opacity:.75}.sp-met b{font-size:1.15rem;direction:ltr;display:inline-block}
.sp-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0 .8rem}.sp-tabs button{padding:.35rem .8rem;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:inherit;font:inherit;font-size:.85rem;cursor:pointer}.sp-tabs button.on{background:rgba(var(--g-mint-rgb),.25);border-color:rgba(var(--g-mint-rgb),.7);font-weight:800}
.sp-iss{border:1px solid rgba(255,255,255,.14);border-radius:14px;margin-bottom:.55rem;overflow:hidden}.sp-iss>summary{display:flex;gap:.6rem;align-items:center;padding:.65rem .8rem;cursor:pointer;list-style:none}.sp-iss>summary::-webkit-details-marker{display:none}.sp-iss>summary b{flex:1;font-size:.92rem;line-height:1.5}
.sp-pts{flex:none;padding:.15rem .55rem;border-radius:999px;font-size:.78rem;font-weight:800;background:rgba(var(--g-amber-rgb),.2);color:rgb(var(--g-amber-rgb))}.sp-pts.z{background:rgba(255,255,255,.1);color:inherit;opacity:.8;font-weight:600}
.sp-cat{flex:none;font-size:.72rem;opacity:.75;padding:.1rem .45rem;border-radius:8px;border:1px solid rgba(255,255,255,.2)}
.sp-body{padding:0 .9rem .8rem;display:grid;gap:.5rem;font-size:.86rem;line-height:1.8}.sp-fix{padding:.55rem .75rem;border-radius:10px;background:rgba(var(--g-mint-rgb),.1);border:1px solid rgba(var(--g-mint-rgb),.35)}.sp-ds{opacity:.8}.sp-ds a{color:inherit}
.sp-it{margin:0;padding-inline-start:1.1rem;direction:ltr;text-align:left;font-size:.78rem;opacity:.9;word-break:break-all}
.sp-err{padding:.8rem 1rem;border-radius:12px;background:rgba(var(--g-rose-rgb),.15);border:1px solid rgba(var(--g-rose-rgb),.5)}.sp-prog{display:flex;gap:.7rem;align-items:center}.sp-spin{width:20px;height:20px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:rgb(var(--g-mint-rgb));animation:spSpin 1s linear infinite;flex:none}@keyframes spSpin{to{transform:rotate(360deg)}}
.sp-hist{display:grid;gap:.4rem;font-size:.85rem}.sp-hist button{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:space-between;text-align:start;padding:.5rem .7rem;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:inherit;font:inherit;cursor:pointer}.sp-hist i{font-style:normal;direction:ltr;opacity:.8}
.sp-hint{font-size:.8rem;opacity:.8;margin:.4rem 0 0;line-height:1.7}#sp-full{border-radius:14px;overflow:hidden;background:#fff;color:#212121}
.sp-fxl{display:grid;gap:.5rem}.sp-fxr{padding:.55rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.14)}.sp-fxr label{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;cursor:pointer}.sp-fxr small{display:block;opacity:.8;margin-top:.25rem;line-height:1.7}.sp-auto{border-color:rgba(var(--g-mint-rgb),.6);color:rgb(var(--g-mint-rgb))}
html.white .sp-box,html.white .sp-eng label,html.white .sp-iss{border-color:#d2d9e3}html.white .sp-in{background:#fff;border-color:#c5ccd8}`;
    document.head.appendChild(s);
  }
  function ring(score, label) {
    const g = SpeedCore.grade(score), r = 34, c = 2 * Math.PI * r, v = score == null ? 0 : score;
    return `<div class="sp-ring sp-${g}"><svg viewBox="0 0 80 80" role="img" aria-label="${esc(label)}: ${score == null ? "—" : score}"><circle cx="40" cy="40" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="6"/><circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--c)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(v / 100 * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)"/><text x="40" y="47" text-anchor="middle" font-size="22" font-weight="700" fill="var(--c)">${score == null ? "—" : score}</text></svg><b>${esc(label)}</b></div>`;
  }
  function current() { const d = S.res && S.res.devices[S.cur]; if (!d) return null; if (d.error) return { error: d.error }; if (!d._sum) d._sum = SpeedCore.summarize(d.lhr, { lang: "ar", maxItems: 8 }); return d._sum; }
  function issueHtml(it) {
    const open = S.open[S.cur + it.id] ? " open" : "", cats = Object.keys(it.categories).map(c => `<span class="sp-cat">${esc(CAT_N[c] || c)}</span>`).join("");
    const pts = it.pointsGain > 0 ? `<span class="sp-pts">+${it.pointsGain < 1 ? it.pointsGain.toFixed(1) : Math.round(it.pointsGain)}${it.approximate ? "≈" : ""} نقطة</span>` : `<span class="sp-pts z">تشخيص</span>`;
    const desc = esc(it.description || "").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    const body = `<div class="sp-body">${it.displayValue ? `<div><b>${esc(it.displayValue)}</b></div>` : ""}${it.fix ? `<div class="sp-fix"><b>طريقة الإصلاح:</b> ${esc(it.fix)}</div>` : ""}<div class="sp-ds">${desc}</div>${it.items.length ? `<div><b>العناصر المتأثرة${it.itemCount > it.items.length ? " (" + it.itemCount + ")" : ""}:</b><ul class="sp-it">${it.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}<div><button class="sp-btn g" data-sp="copy1" data-id="${esc(it.id)}">نسخ هذا البند</button></div></div>`;
    return `<details class="sp-iss" data-id="${esc(it.id)}"${open}><summary>${pts}<b>${esc(it.title)}</b>${typeof SpeedFix !== "undefined" && SpeedFix.AUDIT_FIX[it.id] ? '<span class="sp-cat sp-auto">🛠 يُصلَح تلقائياً</span>' : ""}${cats}</summary>${body}</details>`;
  }
  function draw() {
    const host = $("sp-app"); if (!host) return;
    const form = `<div class="sp-box"><h3>⚡ تحليل سرعة موقعك</h3><div class="sp-row"><input id="sp-url" class="sp-in" type="url" dir="ltr" placeholder="https://example.com" value="${esc(S.url)}"><div class="sp-seg" id="sp-dev">${[["both", "الاثنان"], ["mobile", "الجوال"], ["desktop", "الحاسوب"]].map(([v, n]) => `<button data-sp="dev" data-v="${v}" class="${S.dev === v ? "on" : ""}">${n}</button>`).join("")}</div><button class="sp-btn" data-sp="run" ${S.busy ? "disabled" : ""}>${S.busy ? "جارٍ الفحص…" : "حلّل الآن"}</button></div>
<p class="sp-hint">يستغرق الفحص من دقيقة إلى بضع دقائق بحسب حجم الصفحة. افحص الموقع بعد النشر.</p></div>`;
    const prog = S.busy ? `<div class="sp-box sp-prog"><span class="sp-spin"></span><span id="sp-prog">${esc(S.prog)}</span><button class="sp-btn g" data-sp="cancel" style="margin-inline-start:auto">إلغاء</button></div>` : "";
    const err = S.err ? `<div class="sp-err" role="alert">${esc(S.err)}</div>` : "";
    let out = "";
    if (S.res) {
      const devs = Object.keys(S.res.devices), sm = current();
      const tabs = devs.length > 1 ? `<div class="sp-tabs">${devs.map(d => `<button data-sp="cur" data-v="${d}" class="${S.cur === d ? "on" : ""}">${DEV_N[d]}${S.res.devices[d].error ? " ⚠" : ""}</button>`).join("")}</div>` : "";
      if (sm && sm.error) out = `<div class="sp-box">${tabs}<div class="sp-err" role="alert"><b>تعذّر فحص ${DEV_N[S.cur]}:</b> ${esc(sm.error.message)} <small dir="ltr">(${esc(sm.error.code)})</small></div></div>`;
      else if (sm) {
        const cats = SpeedCore.CATS.filter(c => sm.scores[c] != null);
        const rings = `<div class="sp-rings">${cats.map(c => ring(sm.scores[c], CAT_N[c])).join("")}</div>`;
        const mets = sm.metrics.length ? `<h3 style="margin:1rem 0 .5rem">مقاييس الأداء</h3><div class="sp-met">${sm.metrics.map(m => `<div class="sp-${SpeedCore.grade(m.score)}"><small>${esc(m.acronym)} — ${esc(m.title)}</small><b>${esc(m.value || "—")}</b></div>`).join("")}</div>` : "";
        const list = sm.issues.filter(i => S.cat === "all" || i.categories[S.cat] != null);
        const ftabs = `<div class="sp-tabs"><button data-sp="cat" data-v="all" class="${S.cat === "all" ? "on" : ""}">الكل (${sm.issues.length})</button>${cats.map(c => `<button data-sp="cat" data-v="${c}" class="${S.cat === c ? "on" : ""}">${CAT_N[c]} (${sm.issues.filter(i => i.categories[c] != null).length})</button>`).join("")}</div>`;
        const gain = Math.round(sm.issues.reduce((s, i) => s + (i.diagnostic ? 0 : i.pointsGain), 0));
        const fixes = `<div class="sp-box"><div class="sp-row" style="justify-content:space-between"><h3 style="margin:0">ما الذي يمنع الوصول إلى 100؟</h3><span><button class="sp-btn g" data-sp="copyall">نسخ تقرير الأخطاء</button> <button class="sp-btn g" data-sp="json">تحميل JSON</button></span></div><p class="sp-hint">مرتبة بعدد النقاط التي ستستردّها عند إصلاح كل بند (تقديرية للأداء، وقد تتداخل البنود). ${gain ? "المجموع النظري المتبقي: " + gain + " نقطة موزعة على الفئات." : ""}</p>${ftabs}${list.length ? list.map(issueHtml).join("") : '<p>ممتاز! لا توجد بنود راسبة في هذه الفئة.</p>'}</div>`;
        const warn = sm.meta.warnings && sm.meta.warnings.length ? `<p class="sp-hint">⚠ ${sm.meta.warnings.map(esc).join(" · ")}</p>` : "";
        out = `<div class="sp-box">${tabs}${rings}${mets}${warn}<div class="sp-row" style="margin-top:.8rem"><button class="sp-btn g" data-sp="full">${S.full ? "إخفاء التقرير الكامل" : "عرض التقرير الكامل"}</button></div>${S.full ? '<div id="sp-full" style="margin-top:.8rem"></div>' : ""}</div>${fxBox()}${fixes}`;
      }
    }
    const h = hist(), hs = h.length ? `<div class="sp-box"><h3>آخر الفحوص</h3><div class="sp-hist">${h.map((x, i) => `<button data-sp="again" data-i="${i}"><span dir="ltr">${esc(x.url.replace(/^https?:\/\//, ""))}</span><span>${["mobile", "desktop"].filter(d => x.s[d]).map(d => DEV_N[d] + ": <i>" + SpeedCore.CATS.map(c => x.s[d][c] == null ? "–" : x.s[d][c]).join(" / ") + "</i>").join(" · ")}</span><span class="sp-hint" style="margin:0">${esc(String(x.at).slice(0, 16).replace("T", " "))}</span></button>`).join("")}</div><p class="sp-hint">الأرقام: الأداء / إمكانية الوصول / أفضل الممارسات / SEO. اضغط على فحص لإعادته.</p></div>` : "";
    host.innerHTML = form + prog + err + out + hs;
    if (S.full && S.res) showFull();
  }
  async function showFull() {
    const d = S.res && S.res.devices[S.cur]; const box = $("sp-full"); if (!d || !d.lhr || !box) return;
    try {
      if (!window.__LHR) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "assets/js/vendor/lighthouse-report.js?v=1"; s.onload = ok; s.onerror = () => no(new Error("تعذّر تحميل عارض التقرير")); document.head.append(s); });
      const el = window.__LHR.renderReport(d.lhr, { omitTopbar: true, disableFireworks: true, disableDarkMode: true });
      el.setAttribute("dir", "rtl"); box.replaceChildren(el);
    } catch (e) { box.textContent = e.message; }
  }
  function reportText(sm, only) {
    const lines = ["# تقرير سرعة الموقع", "الرابط: " + (S.res.url || ""), ...(S.res.why ? ["ملاحظة تقنية: " + S.res.why] : []), "الجهاز: " + DEV_N[S.cur], "الدرجات: " + SpeedCore.CATS.filter(c => sm.scores[c] != null).map(c => CAT_N[c] + " " + sm.scores[c]).join(" | "), ""];
    if (!only) lines.push("المقاييس: " + sm.metrics.map(m => m.acronym + " " + (m.value || "—")).join(" | "), "");
    for (const i of sm.issues.filter(x => !only || x.id === only)) {
      lines.push("## " + i.title + " (" + i.id + ") — " + (i.diagnostic ? "تشخيص" : "+" + i.pointsGain + " نقطة") + " — " + Object.keys(i.categories).map(c => CAT_N[c] || c).join("، "));
      if (i.displayValue) lines.push(i.displayValue); if (i.fix) lines.push("الإصلاح: " + i.fix);
      i.items.forEach(x => lines.push("- " + x)); lines.push("");
    }
    return lines.join("\n");
  }
  async function copy(t) { try { await navigator.clipboard.writeText(t); toast("✓ نُسخ"); } catch (e) { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); toast("✓ نُسخ"); } catch (x) { toast("تعذّر النسخ"); } a.remove(); } }
  function onClick(e) {
    const el = e.target.closest("[data-sp]"); if (!el) return; const a = el.dataset.sp;
    if (a === "run") { S.url = ($("sp-url") || {}).value || S.url; run(); }
    else if (a === "dev") { S.dev = el.dataset.v; S.url = ($("sp-url") || {}).value || S.url; draw(); }
    else if (a === "cancel") { S.runId++; S.busy = false; S.err = "أُلغي الفحص"; draw(); }
    else if (a === "cur") { S.cur = el.dataset.v; S.cat = "all"; S.full = false; draw(); }
    else if (a === "cat") { S.cat = el.dataset.v; draw(); }
    else if (a === "full") { S.full = !S.full; draw(); }
    else if (a === "json") { const d = S.res && S.res.devices[S.cur]; if (d && d.lhr) { const u = URL.createObjectURL(new Blob([JSON.stringify(d.lhr)], { type: "application/json" })), l = document.createElement("a"); l.href = u; l.download = "lighthouse-" + S.cur + ".json"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); } }
    else if (a === "fxscan") fxScan();
    else if (a === "fxapply") fxApply();
    else if (a === "fxundo") fxUndo();
    else if (a === "fxsel") { if (S.fx && S.fx.sel) { S.fx.sel[el.dataset.id] = el.checked; draw(); } }
    else if (a === "copyall") { const sm = current(); if (sm && !sm.error) copy(reportText(sm)); }
    else if (a === "copy1") { const sm = current(); if (sm && !sm.error) copy(reportText(sm, el.dataset.id)); }
    else if (a === "again") { const x = hist()[+el.dataset.i]; if (x) { S.url = x.url; draw(); toast("اضغط «حلّل الآن» لإعادة الفحص"); } }
  }
  function bind() { const r = $("sp-app"); if (!r || r._b) return; r._b = 1; r.addEventListener("click", onClick); r.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest(".sp-iss"); if (d) S.open[S.cur + d.dataset.id] = d.open; }, true); r.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "sp-url") { e.preventDefault(); S.url = e.target.value; run(); } }); }
  async function render() {
    css(); const host = $("speed-content"); if (!host) return; if (!$("sp-app")) host.innerHTML = '<div id="sp-app"></div>'; bind();
    if (!S.url) S.url = rd(K_URL, "") || (location.origin.startsWith("http") ? location.origin + "/" : ""); await loadRecipes(); if (!S.busy) draw();
  }
  function init() {
    const w = () => { if (typeof Admin === "undefined" || !Admin.tab || Admin._spWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-speed"); if (el) el.classList.toggle("hidden", t !== "speed"); if (t === "speed") render(); return r; };
      Admin._spWrapped = true; };
    w(); setTimeout(w, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { render, S, run, _t: { reportText, issueHtml, ring } };
})();
