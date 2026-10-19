/* PBCopilotUI — واجهة تجريبية صغيرة لـ PBCopilot (لا تُحمَّل إلا مع ?copilot=1 أو localStorage alyssum_copilot=1).
   وضع التجريب: المفتاح في المتصفح عبر ImgGen (alyssum_gp_gkey). لا نشر ولا تعديل منتج ولا سعر؛ كل تشغيل = مدخل واحد في تاريخ المحرر (تراجع). */
const PBCopilotUI = (() => {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "alyssum_gp_gkey";
  const ls = { get: k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
  const S = { img: null, tab: "make", ctl: null, last: null, busy: false, store: null, log: [], offers: [{ label: "", qty: "", price: "", free: "" }] };
  const CSS = `#pbcp-fab{position:fixed;left:14px;bottom:14px;z-index:99990;padding:.55rem 1rem;border-radius:14px;border:1px solid rgba(255,255,255,.35);color:#fff;font:800 .95rem Cairo,system-ui,sans-serif;cursor:pointer;background:linear-gradient(180deg,rgba(168,85,247,.55),rgba(88,28,135,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.25),0 6px 16px rgba(0,0,0,.35);backdrop-filter:blur(6px)}
#pbcp-fab:hover{transform:translateY(-2px)}
#pbcp{position:fixed;left:14px;bottom:62px;z-index:99991;width:min(430px,calc(100vw - 28px));max-height:min(82vh,760px);overflow:auto;direction:rtl;background:rgba(9,24,18,.985);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:12px;font:600 13px/1.5 Cairo,system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.55)}
#pbcp *{box-sizing:border-box}#pbcp h4{margin:0 0 6px;font-size:15px}#pbcp label{display:block;margin:6px 0 2px;color:#cbd5c0;font-size:12px}
#pbcp input,#pbcp textarea{width:100%;background:rgba(255,255,255,.07);color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:6px 8px;font:inherit}
#pbcp textarea{min-height:64px;resize:vertical}#pbcp .row{display:flex;gap:6px}#pbcp .row>*{flex:1;min-width:0}
#pbcp button.b{padding:.45rem .8rem;border-radius:11px;border:1px solid rgba(255,255,255,.3);color:#fff;font:800 12.5px Cairo,system-ui,sans-serif;cursor:pointer;background:linear-gradient(180deg,rgba(198,254,23,.28),rgba(60,90,10,.35));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 5px rgba(0,0,0,.25)}
#pbcp button.b.o{background:linear-gradient(180deg,rgba(251,146,60,.45),rgba(124,45,18,.4))}#pbcp button.b.r{background:linear-gradient(180deg,rgba(248,113,113,.45),rgba(127,29,29,.4))}#pbcp button.b:disabled{opacity:.45;cursor:default}
#pbcp .tabs{display:flex;gap:6px;margin:6px 0}#pbcp .tabs button{flex:1}#pbcp .tabs .on{outline:2px solid #c6fe17}
#pbcp .log{margin-top:8px;max-height:190px;overflow:auto;background:rgba(0,0,0,.35);border-radius:9px;padding:6px 8px;font:12px/1.55 ui-monospace,monospace;direction:rtl;white-space:pre-wrap}
#pbcp .warn{color:#fbbf24;font-size:12px}#pbcp .bad{color:#fca5a5}#pbcp .ok{color:#86efac}#pbcp small{color:#9fb39a}`;
  const say = (m, k) => { S.log.push((k ? "[" + k + "] " : "") + m); const l = $("pbcp-log"); if (l) { l.textContent = S.log.slice(-60).join("\n"); l.scrollTop = 1e9; } };
  function factsFrom() {
    const num = v => (v === "" || v == null ? null : Number(String(v).replace(/[^\d.]/g, "")));
    return { desc: ($("pbcp-desc") ? $("pbcp-desc").value : "").trim(), product: $("pbcp-prod").value.trim(), currency: $("pbcp-cur").value.trim() || "دج", price: num($("pbcp-price").value), oldPrice: num($("pbcp-old").value),
      offers: S.offers.map((o, i) => ({ label: $("pbcp-ol" + i).value.trim(), qty: num($("pbcp-oq" + i).value), price: num($("pbcp-op" + i).value), free: num($("pbcp-of" + i).value) || 0 })).filter(o => o.price != null) };
  }
  const plist = () => ((typeof Admin !== "undefined" && Admin.products && Admin.products.length ? Admin.products : (typeof PRODUCTS !== "undefined" ? PRODUCTS : [])) || []).filter(p => p && p.slug && p.slug !== "test" && p.active !== false);
  const imgSrc = p => p ? (p.cover || (p.images || [])[0] || "") : "";
  const urlOf = src => /^(https?:|data:|blob:|\/)/.test(src) ? src : "/" + src;
  async function loadImg(src) { if (!src) { S.img = null; return; } try { const r = await fetch(urlOf(src), { cache: "force-cache" }); const b = r.ok ? await r.blob() : null; S.img = b ? { src, blob: b } : { src, blob: null }; } catch (e) { S.img = { src, blob: null }; } }
  /* اختيار منتج من القائمة: يملأ الاسم والسعر والعروض والوصف والصورة من بياناته (كلها قابلة للتعديل بعدها) */
  async function pickProduct(slug) {
    keepForm(); const p = plist().find(x => x.slug === slug); S.psel = slug; if (!p) { draw(); return; }
    S.form = Object.assign(S.form || {}, { prod: p.title || "", price: p.price != null ? String(p.price) : "", old: p.old ? String(p.old) : "", desc: String(p.desc || p.description || p.short || "").replace(/\s+/g, " ").slice(0, 700) });
    S.offers = (p.offers && p.offers.length ? p.offers : [{}]).slice(0, 6).map(o => ({ label: o.label || "", qty: o.qty == null ? "" : o.qty, price: o.price == null ? "" : o.price, free: o.free || "" }));
    await loadImg(imgSrc(p)); draw(false); say("نُسخت بيانات المنتج وصورته ووصفه إلى النموذج (يمكنك تعديلها)");
  }
  function pickFile(f) { if (!f) return; S.img = { src: "", blob: f, url: URL.createObjectURL(f) }; draw(true); say("رُفعت صورة مرجعية من جهازك"); }
  const prodBlock = () => { const f = S.form || {}, o = plist().map(p => `<option value="${esc(p.slug)}" ${S.psel === p.slug ? "selected" : ""}>${esc(p.title)}</option>`).join(""), im = S.img, th = im ? (im.url || (im.src ? urlOf(im.src) : "")) : "";
    return `<label>المنتج (اختره من القائمة فتُؤخذ صورته ووصفه وسعره وعروضه)</label><select id="pbcp-psel" style="width:100%;background:#0d2219;color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:6px 8px;font:inherit"><option value="">— بدون / كتابة يدوية —</option>${o}</select>
    <div class="row" style="margin-top:6px;align-items:flex-start"><div style="flex:0 0 74px;height:74px;border-radius:10px;border:1px dashed rgba(255,255,255,.3);background:rgba(255,255,255,.05) center/contain no-repeat ${th ? `url('${esc(th)}')` : "none"};display:flex;align-items:center;justify-content:center;color:#9fb39a;font-size:11px;text-align:center">${th ? "" : "بلا صورة"}</div>
      <div><label style="margin:0">الصورة المرجعية للمنتج</label><div class="row" style="margin-top:3px"><button class="b" id="pbcp-upimg" style="flex:0 0 auto">رفع صورة</button><button class="b r" id="pbcp-rmimg" style="flex:0 0 auto" ${im ? "" : "disabled"}>إزالة</button></div><input id="pbcp-file" type="file" accept="image/*" hidden><small>تُستعمل مرجعاً لصور العبوة المولّدة</small></div></div>
    <label>وصف المنتج (يعتمد عليه النص والتصميم؛ لا تكتب فيه أسعاراً)</label><textarea id="pbcp-desc" placeholder="لمن هو، ما يميّزه، مكوّناته…">${esc(f.desc || "")}</textarea>`; };
  function fillFromProduct() {
    const E = PBApp.E, slug = E && E.page && E.page.product, list = (typeof Admin !== "undefined" && Admin.products && Admin.products.length ? Admin.products : (typeof PRODUCTS !== "undefined" ? PRODUCTS : [])), p = (list || []).find(x => x.slug === slug);
    if (!p) { say("لا منتج مربوط بالصفحة المفتوحة — اكتب البيانات يدوياً", "تنبيه"); return; }
    pickProduct(p.slug); return;
  }
  function offerRows() { return S.offers.map((o, i) => `<div class="row" style="margin-bottom:4px"><input id="pbcp-ol${i}" placeholder="اسم العرض" value="${esc(o.label)}"><input id="pbcp-oq${i}" placeholder="كمية" value="${esc(o.qty)}" inputmode="numeric"><input id="pbcp-op${i}" placeholder="السعر" value="${esc(o.price)}" inputmode="numeric"><input id="pbcp-of${i}" placeholder="مجاناً" value="${esc(o.free)}" inputmode="numeric"></div>`).join(""); }
  function keepForm() { const g = id => ($(id) ? $(id).value : ""); S.form = { desc: g("pbcp-desc"), goal: g("pbcp-goal"), prod: g("pbcp-prod"), cur: g("pbcp-cur"), price: g("pbcp-price"), old: g("pbcp-old"), ins: g("pbcp-ins"), key: g("pbcp-key") }; S.offers = S.offers.map((o, i) => $("pbcp-ol" + i) ? { label: $("pbcp-ol" + i).value, qty: $("pbcp-oq" + i).value, price: $("pbcp-op" + i).value, free: $("pbcp-of" + i).value } : o); }
  function draw(keep) {
    if (keep) keepForm(); const f = S.form || {}, rd = typeof ImgGen !== "undefined" ? ImgGen.ready() : { ok: false, nokey: true }, root = $("pbcp"); if (!root) return;
    const keyBox = rd.ok ? `<small class="ok">✓ مفتاح التوليد موجود في هذا المتصفح (وضع التجريب)</small> <details style="display:inline"><summary style="cursor:pointer;color:#9fb39a">تغيير المفتاح</summary><div class="row"><input id="pbcp-key" type="password" autocomplete="off" dir="ltr" placeholder="AIza…" value="${esc(f.key || "")}"><button class="b" id="pbcp-savekey" style="flex:0 0 auto">حفظ</button></div></details>` : `<label>مفتاح التوليد (تجريبي — يُحفظ في هذا المتصفح فقط)</label><div class="row"><input id="pbcp-key" type="password" autocomplete="off" dir="ltr" placeholder="AIza…" value="${esc(f.key || "")}"><button class="b" id="pbcp-savekey" style="flex:0 0 auto">حفظ</button></div>`;
    root.innerHTML = `<h4>✨ Copilot — تجريبي</h4>${keyBox}<div class="tabs"><button class="b ${S.tab === "make" ? "on" : ""}" data-t="make">إنشاء قسم</button><button class="b ${S.tab === "edit" ? "on" : ""}" data-t="edit">تعديل تدريجي</button></div>` +
      (S.tab === "make" ? `<label>ماذا تريد أن يُصمَّم؟</label><textarea id="pbcp-goal" placeholder="مثال: قسم عرض لعسل التركيز بتصميم دافئ متواصل مع اللون الحالي للصفحة">${esc(f.goal || "")}</textarea>
      ${prodBlock()}<label>بيانات المنتج (أنت مصدرها؛ الذكاء لا يخترع أرقاماً) <button class="b o" id="pbcp-fill" style="padding:.15rem .5rem">املأ من منتج الصفحة</button></label>
      <div class="row"><input id="pbcp-prod" placeholder="اسم المنتج" value="${esc(f.prod || "")}"><input id="pbcp-cur" placeholder="العملة" value="${esc(f.cur || "دج")}" style="flex:0 0 70px"></div>
      <div class="row" style="margin-top:4px"><input id="pbcp-price" placeholder="السعر" inputmode="numeric" value="${esc(f.price || "")}"><input id="pbcp-old" placeholder="السعر القديم (اختياري)" inputmode="numeric" value="${esc(f.old || "")}"></div>
      <label>العروض (اسم · كمية · سعر · مجاناً)</label>${offerRows()}<button class="b" id="pbcp-addoff" style="padding:.15rem .6rem">＋ عرض</button>`
        : `<label>ما التعديل المطلوب؟ (يُغيَّر أقل عدد من العناصر)</label><textarea id="pbcp-ins" placeholder="مثال: كبّر العنوان وغيّر لونه إلى الأحمر الداكن">${esc(f.ins || "")}</textarea>
      ${prodBlock()}<label>بيانات المنتج (إن احتاج نصاً بسعر)</label><div class="row"><input id="pbcp-prod" placeholder="اسم المنتج" value="${esc(f.prod || "")}"><input id="pbcp-cur" placeholder="العملة" value="${esc(f.cur || "دج")}" style="flex:0 0 70px"></div><div class="row" style="margin-top:4px"><input id="pbcp-price" placeholder="السعر" inputmode="numeric" value="${esc(f.price || "")}"><input id="pbcp-old" placeholder="السعر القديم" inputmode="numeric" value="${esc(f.old || "")}"></div>${offerRows()}`) +
      `<div class="row" style="margin-top:8px"><button class="b" id="pbcp-go" ${S.busy ? "disabled" : ""}>▶ ابدأ</button><button class="b r" id="pbcp-stop" ${S.busy ? "" : "disabled"}>■ إلغاء</button><button class="b o" id="pbcp-undo">↶ تراجع</button><button class="b" id="pbcp-resume" ${S.last && !S.busy && /failed|interrupted/.test(S.last.status || "") ? "" : "disabled"}>⟳ استئناف</button></div>
      <div class="row" style="margin-top:6px"><button class="b" id="pbcp-copy">نسخ تقرير التشغيل</button></div><div class="log" id="pbcp-log"></div>`;
    root.querySelectorAll("[data-t]").forEach(b => { b.onclick = () => { keepForm(); S.tab = b.dataset.t; draw(); }; });
    const bind = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
    bind("pbcp-savekey", () => { const v = $("pbcp-key").value.trim(); if (v.length < 20) return say("المفتاح قصير جداً", "تنبيه"); ls.set(KEY, v); S.form = Object.assign(S.form || {}, { key: "" }); say("حُفظ المفتاح في هذا المتصفح"); draw(); });
    bind("pbcp-fill", fillFromProduct); { const se = $("pbcp-psel"), fi = $("pbcp-file"); if (se) se.onchange = () => pickProduct(se.value); bind("pbcp-upimg", () => fi && fi.click()); if (fi) fi.onchange = () => pickFile(fi.files && fi.files[0]); bind("pbcp-rmimg", () => { keepForm(); S.img = null; draw(); }); } bind("pbcp-addoff", () => { keepForm(); if (S.offers.length < 6) S.offers.push({ label: "", qty: "", price: "", free: "" }); draw(); });
    bind("pbcp-go", go); bind("pbcp-stop", () => { if (S.ctl) S.ctl.abort(); }); bind("pbcp-undo", () => { if (typeof PBApp !== "undefined") { PBApp.undo(); say("↶ تراجع واحد (يعيد الصفحة كما كانت قبل آخر تشغيل)"); } });
    bind("pbcp-resume", () => resume()); bind("pbcp-copy", copyReport);
    const l = $("pbcp-log"); if (l) l.textContent = S.log.slice(-60).join("\n");
  }
  function adapters() {
    S.ctl = new AbortController(); S.store = S.store || PBCopilot.stores.ls;
    const a = PBCopilotReal.createBrowser({ ref: () => (S.img && S.img.blob) || null, signal: S.ctl.signal, store: S.store, hooks: { beforeOp: async op => { say("← " + op.op + (op.args && op.args.as ? " $" + op.args.as : "")); } }, timeoutMs: 90000 });
    return a;
  }
  function report(r) {
    if (!r) return; S.last = r;
    if (r.ok) say("✓ اكتمل: " + r.status + " — عناصر متغيّرة: " + r.changed + " · نموذج " + (r.counts && r.counts.llm) + " · صور " + (r.counts && r.counts.img), "ok");
    else say("✗ لم يُعتمد شيء — " + r.status + (r.error ? ": " + r.error.code + " — " + r.error.msg : ""), "خطأ");
    (r.errors || []).slice(0, 8).forEach(e => say((e.code || "") + " " + (e.msg || ""), "خطأ")); (r.warnings || []).slice(0, 5).forEach(w => say(w, "تنبيه"));
    if (r.ok && r.changed) say("يمكنك تحديد أي عنصر وتعديله، والتراجع بزر ↶ أو Ctrl+Z (مدخل واحد).");
  }
  async function exec(fn) {
    if (S.busy) return; S.busy = true; draw(true);
    try { report(await fn()); }
    catch (e) { if (e && (e.cancelled || e.interrupt)) { S.last = Object.assign({}, S.last || {}, { status: "interrupted" }); say("أُوقف التشغيل — الصفحة كما هي، ويمكن الاستئناف", "تنبيه"); } else say((e && e.code || "") + " " + (e && e.message || e), "خطأ"); }
    finally { S.busy = false; draw(false); }
  }
  function lastRunId() { const ix = S.store && S.store.list ? S.store.list() : []; return ix[ix.length - 1] || ""; }
  async function go() {
    if (!PBApp || !PBApp.E || !PBApp.E.page) return say("افتح صفحة في المطوّر أولاً", "تنبيه"); keepForm(); S.log.length = 0; let f; try { f = factsFrom(); } catch (e) { return say(String(e.message), "خطأ"); }
    const ad = adapters(); S.store = ad.store || S.store;
    if (S.tab === "make") { if (!(S.form.goal || "").trim()) return say("اكتب ما تريد تصميمه", "تنبيه"); say("بدء الإنشاء…"); await exec(async () => { const p = PBCopilot.run({ goal: S.form.goal, facts: f, adapters: ad }); setTimeout(() => { S.lastId = lastRunId(); }, 50); return p; }); }
    else { if (!(S.form.ins || "").trim()) return say("اكتب التعديل المطلوب", "تنبيه"); say("بدء التعديل…"); await exec(() => PBCopilot.edit({ instruction: S.form.ins, facts: f, adapters: ad })); }
  }
  async function resume() { const id = (S.last && S.last.runId) || lastRunId(); if (!id) return say("لا تشغيل للاستئناف", "تنبيه"); const ad = adapters(); say("استئناف " + id + "…"); await exec(() => PBCopilot.resume(id, { adapters: ad })); }
  function copyReport() {
    const id = (S.last && S.last.runId) || lastRunId(), run = id && S.store && S.store.load ? S.store.load(id) : null;
    const rep = { last: S.last, ops: run && run.ops, errors: run && run.errors, warnings: run && run.warnings, counts: run && run.counts, plan: run && run.plan, log: S.log.slice(-80) };
    const txt = JSON.stringify(rep, null, 1); try { navigator.clipboard.writeText(txt); say("نُسخ التقرير (بلا أي مفتاح) — أرسله لي لأحسّن التعليمات"); } catch (e) { say(txt.slice(0, 3000)); }
  }
  function mount() {
    if ($("pbcp-fab")) return; const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement("button"); fab.id = "pbcp-fab"; fab.type = "button"; fab.textContent = "✨ Copilot"; document.body.appendChild(fab);
    const box = document.createElement("div"); box.id = "pbcp"; box.hidden = true; document.body.appendChild(box);
    fab.onclick = () => { box.hidden = !box.hidden; if (!box.hidden) { const sl = PBApp && PBApp.E && PBApp.E.page && PBApp.E.page.product; if (!S.psel && !S.auto && sl && plist().some(p => p.slug === sl)) { S.auto = 1; pickProduct(sl); } else draw(); } };
  }
  if (typeof document !== "undefined") { if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount); }
  return { mount, draw, go, S };
})();
if (typeof window !== "undefined") window.PBCopilotUI = PBCopilotUI;
