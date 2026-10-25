/* رصيد أدوات «ستوديو ديزاين» (Credits): 1$ = 10 رصيد. يعرض الرصيد المتبقي أعلى اللوحة (متبقٍ/الإجمالي) وتكلفة كل أداة داخل نافذتها،
   ويخصم عند كل عملية فعلية (صورة واحدة = 2 رصيد، فيديو 4 رصيد للثانية، مجسّم 3D = 15، نزع الخلفية/التقاط العناصر = 1، صفحة كاملة = 40، A/B = 70).
   الدفتر يُحفظ في المتصفح ويتزامن بين أجهزة المالك عبر PrivSync (s_credits). **مهم:** هذا حسّاب واجهة (لا يمنع تلاعباً من المتصفح)؛ الإلزام الحقيقي لمواقع العملاء
   على الخادم (saas_ai_charge). لا يعمل إلا في موقع المالك (CONFIG.HUB_SITE) أو إن ضُبط `alyssum_credits` أو CONFIG.CREDITS_ON، وإلا يبقى خاملاً بلا أثر.
   الاستعمال: Credits.take(kind,{n}) ← {refund()} · Credits.bundle(id,{n},fn) · Credits.chip(id) · Credits.left()/total() · الاختبار: scripts/test-credits.js */
const Credits = (() => {
  const KEY = "alyssum_credits", START = 110;               // 10$ = 110 رصيد (حزمة «أساسية» بونص 10%)
  const KIND = { img: 2, text: 0, model3d: 15 };            // صورة واحدة = 2؛ الفيديو يُحسب بالثواني؛ النص مجاني
  const VIDEO_PER_SEC = 4;
  /* تكلفة كل أداة كما تظهر في نافذتها: n = رقم للمقارنة (اختياري) و t = نص العرض */
  const TOOLS = {
    bg: { t: "1 رصيد للصورة" }, cap: { t: "1 رصيد للصورة" }, erase: { t: "2 رصيد للمسحة" }, up: { t: "2 رصيد للصورة" },
    xp: { t: "6 رصيد (4 خيارات) · تغيير المقاس مجاني" }, resize: { t: "تغيير المقاس مجاني · التوسيع 6 رصيد" },
    sl: { t: "2 رصيد للأسلوب" }, ai: { t: "2 رصيد للتعديل" }, relight: { t: "2 رصيد" }, textrm: { t: "2 رصيد" }, uncrop: { t: "2 رصيد" }, beautify: { t: "2 رصيد" },
    fashion: { t: "2 رصيد للصورة" }, tryon: { t: "2 رصيد للصورة" }, recolor: { t: "2 رصيد لكل لون" },
    st: { t: "مشهد/خلفية بالوصف: 6 رصيد (4 خيارات) · بقية أدوات الاستوديو مجانية" },
    v360: { t: "2 رصيد لكل إطار جديد (8 إطارات = 14)" }, gen: { t: "2 رصيد للصورة" }, txt2img: { t: "2 رصيد للصورة" }, logo: { t: "الشعار النصي مجاني · الصورة 2 رصيد" },
    vgen: { t: "4 رصيد لكل ثانية (5 ثوانٍ = 20)" }, vad: { t: "4 رصيد لكل ثانية (5 ثوانٍ = 20)" }, studio3d: { t: "مجاني" },
    pagepilot: { t: "40 رصيد للصفحة · A/B 70 · إعادة رسم قسم 2" }, batch: { t: "الخطوة الذكية 2 رصيد للصورة · نزع الخلفية 1" }, catalog: { t: "نزع الخلفية 1 + المشهد 2 لكل منتج" }
  };
  /* مفتاح لوحة المحرر (EP_TABS) ← معرّف الأداة */
  const EP = { up: "up", fa: "fashion", to: "tryon", ps: "st", bgn: "st", v3: "v360", rc: "recolor", rl: "relight", tr: "textrm", uc: "uncrop", bf: "beautify", bg: "bg", cap: "cap", st: "st", xp: "xp", ai: "ai", sl: "sl", vg: "vgen", vad: "vad", er: "erase" };
  const PACKS = [[5, 50], [10, 110], [25, 300], [50, 650], [100, 1400]];     // [دولار, رصيد]
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let depth = 0;
  const siteOn = () => { try { return (typeof CONFIG !== "undefined" && (!!CONFIG.HUB_SITE || !!CONFIG.CREDITS_ON)); } catch (e) { return false; } };
  const on = () => siteOn() || LS.get(KEY) != null;
  function load() {
    let o = null; try { o = JSON.parse(LS.get(KEY) || "null"); } catch (e) { }
    if (!o || typeof o !== "object") o = { total: siteOn() ? START : 0, left: siteOn() ? START : 0, log: [] };
    o.total = Math.max(0, +o.total || 0); o.left = Math.max(0, Math.min(+o.left || 0, 1e9)); if (!Array.isArray(o.log)) o.log = [];
    return o;
  }
  const state = () => load();
  const left = () => load().left, total = () => load().total;
  function save(o) { o.log = o.log.slice(-30); LS.set(KEY, JSON.stringify(o)); paint(); try { window.dispatchEvent(new CustomEvent("alyssum:credits", { detail: { left: o.left, total: o.total } })); } catch (e) { } }
  const fmt = n => String(Math.round(n * 100) / 100);
  const cost = (kind, o) => { o = o || {}; if (o.n != null) return Math.max(0, +o.n || 0); if (kind === "video") return Math.max(0, Math.round((+o.dur || 5) * VIDEO_PER_SEC)); return KIND[kind] != null ? KIND[kind] : 0; };
  function mkErr(need, have) { const e = new Error("رصيدك لا يكفي: يلزم " + fmt(need) + " رصيد والمتبقي " + fmt(have) + " — اشحن الرصيد من أعلى اللوحة"); e.code = "NOCREDIT"; return e; }
  /* خصم مسبق قبل العملية؛ يُرجع {n, refund()}. داخل bundle أو بلا تفعيل لا يخصم شيئاً. */
  function take(kind, o) {
    const noop = { n: 0, refund() { } }; if (!on() || depth > 0) return noop;
    const n = cost(kind, o); if (!n) return noop;
    const s = load(); if (s.left < n) throw mkErr(n, s.left);
    const was = s.left / (s.total || 1); s.left = Math.round((s.left - n) * 100) / 100; s.log.push({ t: Date.now(), k: (o && o.label) || kind, n: -n }); save(s); lowNote(was, s);
    let back = 0;
    return { n, refund(x) { const amt = Math.min(n - back, x == null ? n - back : Math.max(0, +x || 0)); if (!(amt > 0)) return; back += amt; const r = load(); r.left = Math.round((r.left + amt) * 100) / 100; r.log.push({ t: Date.now(), k: ((o && o.label) || kind) + " (استرداد)", n: amt }); save(r); } };
  }
  /* عملية مركّبة بسعر واحد (صفحة كاملة، 4 خيارات…): تخصم n مرة واحدة وتتجاهل خصم الاستدعاءات الداخلية، وتسترد كاملة عند الفشل */
  async function bundle(label, o, fn) {
    if (typeof o === "function") { fn = o; o = {}; }
    const c = take("bundle", { n: (o || {}).n, label }); depth++;
    try { const r = await fn(); if (r === null && (o || {}).refundNull !== false) c.refund(); return r; } catch (e) { let a; try { a = (o || {}).refundOf ? o.refundOf(e) : null; } catch (_) { a = null; } c.refund(a == null ? undefined : a); throw e; } finally { depth--; }
  }
  function lowNote(was, s) {
    const frac = s.total ? s.left / s.total : 1; if (was > .2 && frac <= .2 && s.left > 0) toast("⚠️ رصيدك على وشك النفاد: " + fmt(s.left) + " من " + fmt(s.total));
    else if (s.left <= 0) toast("⛔ نفد الرصيد — اشحنه لمتابعة الأدوات");
  }
  function toast(m) { try { if (typeof Admin !== "undefined" && Admin.toast) return Admin.toast(m); } catch (e) { } try { console.warn(m); } catch (e) { } }
  /* إضافة رصيد (بعد تأكيد الدعم استلام الدفع): يزيد المتبقي والإجمالي معاً */
  function topup(n, label) { n = Math.round(+n * 100) / 100; if (!(n > 0)) return false; const s = load(); s.left = Math.round((s.left + n) * 100) / 100; s.total = Math.round((s.total + n) * 100) / 100; s.log.push({ t: Date.now(), k: label || "شحن", n }); save(s); return true; }
  function set(l, t) { const s = load(); s.left = Math.max(0, +l || 0); s.total = Math.max(s.left, t != null ? +t || 0 : s.total); s.log.push({ t: Date.now(), k: "تعديل يدوي", n: 0 }); save(s); }
  const label = id => (TOOLS[id] || {}).t || "";
  const chip = (id, extra) => {
    if (!on()) return ""; const s = load(), t = label(EP[id] ? EP[id] : id) || label(id); if (!t) return "";
    const low = s.total && s.left / s.total <= .2;
    return `<div class="cr-chip${low ? " low" : ""}" data-cr="chip"><span>التكلفة: <b>${esc(t)}</b></span><span class="cr-left">المتبقي <b>${fmt(s.left)}/${fmt(s.total)}</b></span>${extra || ""}</div>`;
  };
  /* ───────── الواجهة: شارة أعلى اللوحة + نافذة التفاصيل ───────── */
  const CSS = `.cr-chip{display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.45rem .75rem;margin:.4rem 0;border-radius:12px;font-size:.78rem;line-height:1.6;color:#fff;background:rgba(9,24,18,.92);border:1px solid rgba(198,254,23,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -2px 3px rgba(0,0,0,.18);backdrop-filter:blur(6px)}.cr-chip b{color:#c6fe17;font-weight:900}.cr-chip.low b.cr-lb,.cr-chip.low .cr-left b{color:#fdba74}
#cr-top{display:inline-flex;align-items:center;gap:.45rem;padding:.45rem .95rem;border-radius:12px;font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;color:#fff;background:rgba(198,254,23,.16);border:1px solid rgba(198,254,23,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 3px rgba(0,0,0,.22),0 1px 5px rgba(0,0,0,.25);backdrop-filter:blur(6px);transition:transform .15s,background .15s}#cr-top:hover{background:rgba(198,254,23,.3);transform:translateY(-2px)}#cr-top.low{background:rgba(245,158,11,.3);border-color:rgba(245,158,11,.7)}#cr-top.out{background:rgba(239,68,68,.3);border-color:rgba(239,68,68,.7)}#cr-top b{direction:ltr;unicode-bidi:isolate}
#cr-bg{position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,.7);display:grid;place-items:center;padding:12px}#cr-box{width:min(560px,100%);max-height:92vh;overflow:auto;background:rgba(9,24,18,.99);border:1px solid rgba(255,255,255,.22);border-radius:20px;padding:1.1rem 1.2rem;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#cr-box h3{margin:0 0 .6rem;font-size:1.1rem}#cr-box .cr-big{font-size:2rem;font-weight:900;color:#c6fe17;direction:ltr;text-align:center}#cr-box .cr-bar{height:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:.4rem 0 .9rem}#cr-box .cr-bar i{display:block;height:100%;background:linear-gradient(90deg,#86efac,#c6fe17)}
#cr-box .cr-packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin:.5rem 0}#cr-box .cr-btn{border:1px solid rgba(255,255,255,.28);color:#fff;border-radius:12px;padding:.6rem .8rem;font-weight:800;cursor:pointer;font-family:inherit;background:rgba(198,254,23,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 3px rgba(0,0,0,.2);backdrop-filter:blur(6px);transition:transform .15s,background .15s}#cr-box .cr-btn:hover{background:rgba(198,254,23,.36);transform:translateY(-2px)}#cr-box .cr-btn small{display:block;font-weight:600;opacity:.85}
#cr-box table{width:100%;border-collapse:collapse;font-size:.8rem}#cr-box td{padding:.3rem .2rem;border-bottom:1px solid rgba(255,255,255,.1)}#cr-box td:last-child{text-align:left;opacity:.85}#cr-box details{margin:.6rem 0}#cr-box summary{cursor:pointer;font-weight:800}#cr-box .cr-x{float:left;background:none;border:0;color:#fff;font-size:1.3rem;cursor:pointer}
#cr-box::-webkit-scrollbar{width:16px}#cr-box::-webkit-scrollbar-track{background:rgba(255,160,40,.14);border-radius:9px}#cr-box::-webkit-scrollbar-thumb{background:rgba(255,150,30,.75);border-radius:9px;border:3px solid transparent;background-clip:padding-box}`;
  function paint() {
    if (typeof document === "undefined") return;
    const b = document.getElementById("cr-top"); if (b) { const s = load(); b.className = s.left <= 0 ? "out" : (s.total && s.left / s.total <= .2 ? "low" : ""); b.innerHTML = `الرصيد <b>${fmt(s.left)}/${fmt(s.total)}</b>`; b.title = "الرصيد المتبقي من أدوات ستوديو ديزاين — اضغط للتفاصيل والشحن"; }
    document.querySelectorAll('[data-cr="chip"] .cr-left').forEach(e => { const s = load(); e.innerHTML = `المتبقي <b>${fmt(s.left)}/${fmt(s.total)}</b>`; });
  }
  function mount() {
    if (!on() || document.getElementById("cr-top")) { paint(); return; }
    const top = document.querySelector("#app .top, .top"); if (!top) return;
    if (!document.getElementById("cr-css")) { const st = document.createElement("style"); st.id = "cr-css"; st.textContent = CSS; document.head.appendChild(st); }
    const b = document.createElement("button"); b.type = "button"; b.id = "cr-top"; b.addEventListener("click", open);
    const anchor = document.getElementById("theme-btn"); if (anchor && anchor.parentNode === top) top.insertBefore(b, anchor); else top.appendChild(b); paint();
  }
  function close() { const e = document.getElementById("cr-bg"); if (e) e.remove(); document.removeEventListener("keydown", onKey, true); }
  const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  function open() {
    close(); if (!document.getElementById("cr-css")) { const st = document.createElement("style"); st.id = "cr-css"; st.textContent = CSS; document.head.appendChild(st); }
    const s = load(), pct = s.total ? Math.max(0, Math.min(100, s.left / s.total * 100)) : 0;
    const rows = Object.keys(TOOLS).filter(k => k !== "studio3d").map(k => { const i = (typeof AdminStudio !== "undefined" && AdminStudio.catalog) ? (AdminStudio.catalog().find(t => t.id === k) || {}) : {}; return `<tr><td>${esc(i.name || k)}</td><td>${esc(TOOLS[k].t)}</td></tr>`; }).join("");
    const hist = s.log.slice(-8).reverse().map(l => `<tr><td>${esc(l.k)}</td><td style="direction:ltr">${l.n > 0 ? "+" : ""}${fmt(l.n)}</td></tr>`).join("");
    const bg = document.createElement("div"); bg.id = "cr-bg";
    bg.innerHTML = `<div id="cr-box" role="dialog" aria-modal="true"><button type="button" class="cr-x" data-cr="x" aria-label="إغلاق">✕</button><h3>رصيد الأدوات</h3>
<div class="cr-big">${fmt(s.left)} / ${fmt(s.total)}</div><div class="cr-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
<div style="font-size:.8rem;opacity:.85">1$ = 10 رصيد · الرصيد لا ينتهي · أدوات الاستوديو المحلية (حواف، تمويه، بازل، ماسك، كولاج، باركود، استوديو 3D…) مجانية.</div>
<b style="display:block;margin-top:.8rem">شراء رصيد</b><div class="cr-packs">${PACKS.map(p => `<button type="button" class="cr-btn" data-cr="buy" data-u="${p[0]}" data-c="${p[1]}">${p[0]}$<small>${p[1]} رصيد${p[1] > p[0] * 10 ? " <span dir=\"ltr\">(+" + Math.round((p[1] / (p[0] * 10) - 1) * 100) + "%)</span>" : ""}</small></button>`).join("")}</div>
<details><summary>أسعار الأدوات</summary><table>${rows}</table></details>
${hist ? `<details><summary>آخر العمليات</summary><table>${hist}</table></details>` : ""}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener("click", async e => {
      if (e.target === bg) return close(); const el = e.target.closest("[data-cr]"); if (!el) return; const a = el.dataset.cr;
      if (a === "x") close();
      else if (a === "buy") {
        const u = +el.dataset.u, c = +el.dataset.c; if (!confirm("إرسال طلب شحن " + c + " رصيد (" + u + " $) إلى فريق الدعم؟")) return;
        try { const N = typeof AdminStores !== "undefined" && AdminStores.notify; if (!N) throw new Error("تعذّر الاتصال بالدعم — حاول لاحقاً"); await AdminStores.notify("طلب شحن رصيد الأدوات\nالرصيد: " + c + "\nالمبلغ: " + u + " $", "billing", { credits: c, usd: u }, "طلب شحن رصيد: " + c); el.innerHTML = "أُرسل الطلب<small>يُضاف الرصيد بعد تأكيد الدعم</small>"; }
        catch (er) { alert(er.message || er); }
      }
    });
    document.addEventListener("keydown", onKey, true);
  }
  function init() { mount(); window.addEventListener("storage", e => { if (e.key === KEY) paint(); }); setTimeout(mount, 1500); setTimeout(mount, 5000); }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
  return { on, take, bundle, cost, left, total, state, topup, set, chip, label, open, close, mount, paint, TOOLS, EP, PACKS, KIND };
})();
