/* «سرعة الموقع»: تحليل أداء موقعك بمحرّك Lighthouse نفسه الذي تعتمد عليه PageSpeed (الأداء، إمكانية الوصول، أفضل الممارسات، SEO) للجوال والحاسوب،
   ثم «معالج الأخطاء»: قائمة بالبنود الراسبة مرتبة بعدد النقاط التي ستستردّها كل واحدة مع طريقة إصلاحها حتى تصل إلى 100.
   طريقتان للفحص: (1) فحص مفصّل على خادم الموقع (Chromium حقيقي، نتيجة مطابقة لـPageSpeed ولا حصة عليه) (2) PageSpeed Insights من Google مباشرة (بلا إعداد؛ حصته المشتركة قد تنفد فيلزم مفتاح مجاني).
   المنطق النقي (الملخص والوصفات) في speed-core.js؛ المشغّل scripts/speed-run.mjs + .github/workflows/speed-test.yml. */
const AdminSpeed = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = t => { if (typeof Admin !== "undefined" && Admin.toast) Admin.toast(t); else alert(t); };
  const K_HIST = "alyssum_speed_hist", K_KEY = "alyssum_psi_key", K_ENG = "alyssum_speed_eng", K_URL = "alyssum_speed_url";
  const CAT_N = { performance: "الأداء", accessibility: "إمكانية الوصول", "best-practices": "أفضل الممارسات", seo: "SEO" };
  const DEV_N = { mobile: "الجوال", desktop: "الحاسوب" };
  const S = { url: "", dev: "both", eng: "", busy: false, prog: "", err: "", res: null, cur: "mobile", cat: "all", open: {}, full: false, runId: 0, loaded: false };
  const rd = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const hist = () => { try { return JSON.parse(rd(K_HIST, "[]")) || []; } catch (e) { return []; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function ghCfg() { try { const c = typeof GH !== "undefined" && GH.cfg ? GH.cfg() : null; return c && c.token && c.token !== "php" && c.owner ? c : null; } catch (e) { return null; } }
  function engines() { return [{ id: "server", n: "فحص مفصّل بخادم الموقع", d: "Chromium حقيقي على خادم، نتيجة مطابقة لـPageSpeed وبلا حصة. يستغرق 2–4 دقائق.", ok: !!ghCfg() }, { id: "psi", n: "PageSpeed Insights من Google", d: "فوري تقريباً (30–60 ثانية) بلا إعداد. حصته المشتركة قد تنفد، فأضف مفتاحاً مجانياً إن ظهر خطأ الحصة.", ok: true }]; }

  async function loadRecipes() {
    if (S.loaded || typeof SpeedCore === "undefined") return; S.loaded = true;
    try { const r = await fetch("assets/data/speed-recipes.json", { cache: "no-cache" }); if (r.ok) SpeedCore.setRecipes(await r.json()); } catch (e) { }
  }

  /* ───────── المحرّك 1: Lighthouse على خادم الموقع (Actions) ───────── */
  async function runServer(url, devices, say, token) {
    const c = ghCfg(); if (!c) throw Object.assign(new Error("الفحص المفصّل يحتاج ربط النشر في الإعدادات. استعمل PageSpeed Insights."), { code: "NOGH" });
    const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), api = "https://api.github.com/repos/" + c.owner + "/" + c.repo, br = c.branch || "main";
    const H = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" }, path = "assets/speed/" + id + ".json.gz", t0 = Date.now();
    say("تشغيل الفحص على الخادم…");
    const r = await fetch(api + "/actions/workflows/speed-test.yml/dispatches", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ ref: br, inputs: { url, devices, locale: "ar", id } }) }).catch(e => { console.warn("speed dispatch", e); throw new Error("تعذّر الاتصال بخدمة الفحص المفصّل (" + (e && e.message || "شبكة") + "). أعد تحميل اللوحة (Ctrl+Shift+R) ثم حاول، أو جرّب PageSpeed Insights."); });
    if (r.status !== 204) throw new Error(r.status === 404 ? "خدمة الفحص المفصّل غير مفعّلة في موقعك — حدّث اللوحة أو استعمل PageSpeed Insights" : r.status === 403 || r.status === 401 ? "رمز النشر بلا صلاحية تشغيل الفحص" : "فشل تشغيل الفحص (" + r.status + ")");
    let n = 0;
    while (Date.now() - t0 < 600000) {
      await sleep(6000); if (S.runId !== token) throw new Error("أُلغي الفحص"); n++;
      say("الخادم يفحص موقعك… " + Math.round((Date.now() - t0) / 1000) + " ثانية (يستغرق عادة 2–4 دقائق)");
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
        if (bad) throw new Error("فشل تشغيل الفحص على الخادم — أعد المحاولة أو استعمل PageSpeed Insights");
      }
    }
    throw new Error("انتهت المهلة قبل اكتمال الفحص — حاول مجدداً");
  }

  /* ───────── المحرّك 2: PageSpeed Insights ───────── */
  async function runPsi(url, devices, say, token) {
    const out = { v: 1, url, at: new Date().toISOString(), devices: {} }, key = rd(K_KEY, "");
    for (const d of (devices === "both" ? ["mobile", "desktop"] : [devices])) {
      if (S.runId !== token) throw new Error("أُلغي الفحص");
      say("PageSpeed يفحص نسخة " + DEV_N[d] + "… (قد يستغرق دقيقة)");
      const q = "url=" + encodeURIComponent(url) + "&strategy=" + d + "&locale=ar" + CAT_N_KEYS().map(c => "&category=" + c.toUpperCase().replace("-", "_")).join("") + (key ? "&key=" + encodeURIComponent(key) : "");
      let j = null, st = 0;
      for (let a = 0; a < 2 && !(j && j.lighthouseResult); a++) {
        try { const r = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + q); st = r.status; j = await r.json().catch(() => null); } catch (e) { j = { error: { code: 0, message: "تعذّر الاتصال بـPageSpeed — تحقق من اتصالك" } }; }
        if (st === 429) break; if (!j || j.error) await sleep(2500);
      }
      if (st === 429) out.devices[d] = { error: { code: "PSI_QUOTA", message: key ? "تجاوزت حصة مفتاحك في PageSpeed. حاول لاحقاً." : "حصة PageSpeed المشتركة منتهية الآن. أضف مفتاحاً مجانياً (من Google Cloud ← PageSpeed Insights API) في الحقل أدناه، أو استعمل الفحص المفصّل." } };
      else out.devices[d] = SpeedCore.fromPsi(d, j);
    }
    return out;
  }
  const CAT_N_KEYS = () => Object.keys(CAT_N);

  /* ───────── تشغيل الفحص ───────── */
  async function run() {
    const url = SpeedCore.normUrl(S.url); if (!url) return toast("اكتب رابط موقعك الصحيح (يبدأ بـ https://)");
    if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.)/i.test(url)) return toast("الفحص يعمل على المواقع المنشورة فقط، لا على عناوين محلية");
    await loadRecipes(); S.url = url; wr(K_URL, url); wr(K_ENG, S.eng);
    const token = ++S.runId; S.busy = true; S.err = ""; S.res = null; S.full = false; S.prog = "جارٍ التجهيز…"; draw();
    const say = t => { if (S.runId === token) { S.prog = t; const e = $("sp-prog"); if (e) e.textContent = t; } };
    try {
      const res = S.eng === "server" ? await runServer(url, S.dev, say, token) : await runPsi(url, S.dev, say, token);
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
    return `<details class="sp-iss" data-id="${esc(it.id)}"${open}><summary>${pts}<b>${esc(it.title)}</b>${cats}</summary>${body}</details>`;
  }
  function draw() {
    const host = $("sp-app"); if (!host) return; const engs = engines(); if (!S.eng || !(engs.find(e => e.id === S.eng) || {}).ok) S.eng = (engs[0].ok ? engs[0].id : "psi");
    const form = `<div class="sp-box"><h3>⚡ تحليل سرعة موقعك</h3><div class="sp-row"><input id="sp-url" class="sp-in" type="url" dir="ltr" placeholder="https://example.com" value="${esc(S.url)}"><div class="sp-seg" id="sp-dev">${[["both", "الاثنان"], ["mobile", "الجوال"], ["desktop", "الحاسوب"]].map(([v, n]) => `<button data-sp="dev" data-v="${v}" class="${S.dev === v ? "on" : ""}">${n}</button>`).join("")}</div><button class="sp-btn" data-sp="run" ${S.busy ? "disabled" : ""}>${S.busy ? "جارٍ الفحص…" : "حلّل الآن"}</button></div>
<div class="sp-eng">${engs.map(e => `<label class="${S.eng === e.id ? "on" : ""} ${e.ok ? "" : "off"}"><input type="radio" name="sp-eng" data-sp="eng" value="${e.id}" ${S.eng === e.id ? "checked" : ""} ${e.ok ? "" : "disabled"}><span><b>${esc(e.n)}</b>${e.ok ? "" : " (يحتاج ربط النشر)"}<small>${esc(e.d)}</small></span></label>`).join("")}</div>
${S.eng === "psi" ? `<div class="sp-row" style="margin-top:.6rem"><input id="sp-key" class="sp-in" dir="ltr" placeholder="مفتاح PageSpeed API (اختياري — يحميك من نفاد الحصة)" value="${esc(rd(K_KEY, ""))}"></div>` : ""}
<p class="sp-hint">يعمل الفحص بإعدادات PageSpeed نفسها: جوال (Moto G Power، 4G بطيء، معالج أبطأ 4 مرات) وحاسوب. افحص الموقع بعد النشر، ولا تفتح نافذة أخرى في الجهاز أثناء الفحص.</p></div>`;
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
        out = `<div class="sp-box">${tabs}${rings}${mets}${warn}<div class="sp-row" style="margin-top:.8rem"><button class="sp-btn g" data-sp="full">${S.full ? "إخفاء التقرير الكامل" : "عرض التقرير الكامل"}</button></div>${S.full ? '<div id="sp-full" style="margin-top:.8rem"></div>' : ""}</div>${fixes}`;
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
    const lines = ["# تقرير سرعة الموقع", "الرابط: " + (S.res.url || ""), "الجهاز: " + DEV_N[S.cur], "الدرجات: " + SpeedCore.CATS.filter(c => sm.scores[c] != null).map(c => CAT_N[c] + " " + sm.scores[c]).join(" | "), ""];
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
    if (a === "run") { S.url = ($("sp-url") || {}).value || S.url; const k = $("sp-key"); if (k) wr(K_KEY, k.value.trim()); run(); }
    else if (a === "dev") { S.dev = el.dataset.v; S.url = ($("sp-url") || {}).value || S.url; draw(); }
    else if (a === "eng") { S.eng = el.value; S.url = ($("sp-url") || {}).value || S.url; draw(); }
    else if (a === "cancel") { S.runId++; S.busy = false; S.err = "أُلغي الفحص"; draw(); }
    else if (a === "cur") { S.cur = el.dataset.v; S.cat = "all"; S.full = false; draw(); }
    else if (a === "cat") { S.cat = el.dataset.v; draw(); }
    else if (a === "full") { S.full = !S.full; draw(); }
    else if (a === "json") { const d = S.res && S.res.devices[S.cur]; if (d && d.lhr) { const u = URL.createObjectURL(new Blob([JSON.stringify(d.lhr)], { type: "application/json" })), l = document.createElement("a"); l.href = u; l.download = "lighthouse-" + S.cur + ".json"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); } }
    else if (a === "copyall") { const sm = current(); if (sm && !sm.error) copy(reportText(sm)); }
    else if (a === "copy1") { const sm = current(); if (sm && !sm.error) copy(reportText(sm, el.dataset.id)); }
    else if (a === "again") { const x = hist()[+el.dataset.i]; if (x) { S.url = x.url; draw(); toast("اضغط «حلّل الآن» لإعادة الفحص"); } }
  }
  function bind() { const r = $("sp-app"); if (!r || r._b) return; r._b = 1; r.addEventListener("click", onClick); r.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest(".sp-iss"); if (d) S.open[S.cur + d.dataset.id] = d.open; }, true); r.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "sp-url") { e.preventDefault(); S.url = e.target.value; run(); } }); }
  async function render() {
    css(); const host = $("speed-content"); if (!host) return; if (!$("sp-app")) host.innerHTML = '<div id="sp-app"></div>'; bind();
    if (!S.url) S.url = rd(K_URL, "") || (location.origin.startsWith("http") ? location.origin + "/" : ""); S.eng = S.eng || rd(K_ENG, ""); await loadRecipes(); if (!S.busy) draw();
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
