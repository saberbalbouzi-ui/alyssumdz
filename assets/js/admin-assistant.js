/* مساعد لوحة الإدارة («اسألني» — اسم مؤقت): يجيب عن طريقة استعمال أقسام اللوحة وعناصر مطوّر الصفحات وإعداداتها.
   يعمل دون اتصال ودون مفتاح: بحث ذكي في قاعدة معرفة assets/data/admin-help.json (تطبيع عربي + أوزان). لإضافة معلومة: أضف عنصراً هناك {id,t,k,a,go}. */
const AdminHelp = (() => {
  const NAME = "اسألني", $ = id => document.getElementById(id);
  let KB = null, open = false, last = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* تطبيع عربي: إزالة التشكيل والتطويل، توحيد الألف والتاء المربوطة والياء، حذف «ال» والسوابق الشائعة */
  const norm = s => String(s || "").toLowerCase().replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  const STOP = new Set("ما هو هي هل كيف اين متى لماذا عن في من الى على مع هذا هذه ذلك التي الذي ان او و يا لي لك انا اريد اود ممكن يمكن استطيع كم اي شرح اشرح لي علي يعني بس وش ايش شو ماهو ماهي ماذا شنو كيفاش علاش هاد هاذا هادي".split(" "));
  const stem = w => { w = w.replace(/^(وال|بال|كال|فال|لل|ال)/, ""); w = w.replace(/(ات|ون|ين|ان|ه|ها|هم|ي)$/, m => w.length > 4 ? "" : m); return w; };
  const wordGroups = s => norm(s).split(/[^a-z0-9\u0600-\u06FF]+/).filter(w => w && w.length > 1 && !STOP.has(w)).map(stem).filter(w => w.length > 1).map(w => (/^[انيت]/.test(w) && w.length > 3) ? [w, w.slice(1)] : [w]);      // صيغة الفعل المضارع (انقل/اضيف/احرك) تُطابق المصدر (نقل/اضافه/تحريك)
  const toks = s => wordGroups(s).flat();
  let IDX = null;
  function index() {
    const df = {}; IDX = KB.map(e => { const t = toks(e.t), k = toks(e.k), a = toks(e.a), all = new Set([...t, ...k, ...a]); all.forEach(w => { df[w] = (df[w] || 0) + 1; }); return { e, t: new Set(t), k: new Set(k), a: new Set(a) }; });
    IDX.df = df; IDX.n = KB.length;
  }
  function search(q, n) {
    const qs = [...new Set(toks(q))]; if (!qs.length) return []; const groups = wordGroups(q);
    const nq = norm(q);
    return IDX.map(it => { let sc = 0; qs.forEach(w => { const idf = Math.log(1 + IDX.n / (1 + (IDX.df[w] || 0))); const pre = s => { for (const x of s) if (x.startsWith(w) || w.startsWith(x)) return true; return false; };
        if (it.t.has(w)) sc += 3 * idf; else if (pre(it.t)) sc += 1.6 * idf; if (it.k.has(w)) sc += 2 * idf; else if (pre(it.k)) sc += 1 * idf; if (it.a.has(w)) sc += .6 * idf; });
      if (norm(it.e.t) && nq.includes(norm(it.e.t))) sc += 4;
      const hit = w => { for (const S of [it.t, it.k, it.a]) { if (S.has(w)) return true; for (const x of S) if (x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))) return true; } return false; };
      const cov = groups.length ? groups.filter(g => g.some(hit)).length / groups.length : 0; return { e: it.e, sc, cov }; }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, n || 3);
  }
  const fmt = a => esc(a).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
  const curTab = () => { const b = document.querySelector(".nav-btn.on"), m = b && /Admin\.tab\('([a-z]+)'/.exec(b.getAttribute("onclick") || ""); return m ? m[1] : ""; };
  function goTab(id) {
    if (id === "builder" || !id) { }
    const b = [...document.querySelectorAll(".nav-btn")].find(x => (x.getAttribute("onclick") || "").includes("'" + id + "'")); if (b && typeof Admin !== "undefined") { Admin.tab(id, b); close(); }
  }
  function css() {
    if ($("ah-css")) return; const st = document.createElement("style"); st.id = "ah-css";
    st.textContent = `.ah-btn{display:inline-flex;align-items:center;gap:.45rem;border:0;cursor:pointer;font-family:inherit;font-weight:800;font-size:.85rem;color:#173f35;background:linear-gradient(135deg,#f3e6bd,#c8a24b);border-radius:999px;padding:.28rem .85rem .28rem .6rem;box-shadow:0 4px 14px rgba(200,162,75,.45);transition:.2s}.ah-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(200,162,75,.55)}.ah-btn svg{flex:none}
.ah-panel{position:fixed;top:64px;right:14px;width:min(400px,calc(100vw - 20px));height:min(560px,calc(100vh - 84px));background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(15,46,38,.35);z-index:9990;display:none;flex-direction:column;overflow:hidden;direction:rtl;font-family:inherit;border:1px solid #eadfc4}.ah-panel.on{display:flex}
.ah-h{display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;background:linear-gradient(135deg,#0f2e26,#173f35);color:#fff}.ah-h b{font-size:.98rem}.ah-h small{display:block;font-size:.7rem;opacity:.8;font-weight:600}.ah-x{margin-inline-start:auto;background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:1rem}
.ah-m{flex:1;overflow:auto;padding:.8rem;background:#faf7f0;display:flex;flex-direction:column;gap:.55rem}.ah-b{max-width:92%;padding:.6rem .8rem;border-radius:14px;font-size:.86rem;line-height:1.8}.ah-b.u{align-self:flex-start;background:#173f35;color:#fff;border-end-start-radius:4px}.ah-b.a{align-self:flex-end;background:#fff;border:1px solid #eadfc4;color:#2a3430;border-end-end-radius:4px}.ah-b code{background:#f1ede1;padding:0 .3em;border-radius:4px;font-size:.8em;direction:ltr;unicode-bidi:embed}
.ah-t{font-weight:900;color:#173f35;margin-bottom:.15rem}.ah-ch{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}.ah-c{border:1.5px solid #e0d6b8;background:#fffaf0;color:#173f35;border-radius:999px;padding:.22rem .7rem;font-size:.76rem;font-weight:800;cursor:pointer;font-family:inherit}.ah-c:hover{background:#c8a24b}.ah-c.go{background:#157a55;border-color:#157a55;color:#fff}
.ah-f{display:flex;gap:.4rem;padding:.6rem;border-top:1px solid #eee;background:#fff}.ah-f input{flex:1;border:1.5px solid #e0d6b8;border-radius:12px;padding:.55rem .8rem;font-family:inherit;font-size:.9rem;min-width:0}.ah-f button{border:0;background:#173f35;color:#fff;border-radius:12px;padding:0 1rem;font-weight:800;cursor:pointer;font-family:inherit}
@media(max-width:560px){.ah-panel{right:8px;top:56px}.ah-btn span.t{display:none}}`;
    document.head.appendChild(st);
  }
  /* أيقونة وجه روبوت أنيقة */
  const ROBOT = (body, face, eye) => `<svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-hidden="true"><line x1="20" y1="3.5" x2="20" y2="9" stroke="${body}" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="3.2" r="2.2" fill="${body}"/><rect x="5" y="9" width="30" height="24" rx="9" fill="${body}"/><rect x="2" y="17" width="3.4" height="8" rx="1.7" fill="${body}"/><rect x="34.6" y="17" width="3.4" height="8" rx="1.7" fill="${body}"/><rect x="9" y="13" width="22" height="16" rx="6" fill="${face}"/><circle cx="15" cy="20" r="3.3" fill="${eye}"/><circle cx="25" cy="20" r="3.3" fill="${eye}"/><circle cx="15.8" cy="19.2" r="1.1" fill="#fff"/><circle cx="25.8" cy="19.2" r="1.1" fill="#fff"/><path d="M15.5 25.2c1.2 1.3 2.8 1.9 4.5 1.9s3.3-.6 4.5-1.9" stroke="${eye}" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`;
  const SUGG = ["كيف أضيف قسماً جديداً؟", "كيف أنقل قسماً أو عنصراً؟", "ما هي الأدوات الذكية؟", "كيف أستعمل التحريك الحر؟", "كيف أربط شركة توصيل؟", "كيف أستعمل الهيرو؟"];
  function bubble(cls, html) { const m = $("ah-m"), d = document.createElement("div"); d.className = "ah-b " + cls; d.innerHTML = html; m.appendChild(d); m.scrollTop = m.scrollHeight; return d; }
  function chips(list, d) { const w = document.createElement("div"); w.className = "ah-ch"; list.forEach(([label, fn, go]) => { const b = document.createElement("button"); b.type = "button"; b.className = "ah-c" + (go ? " go" : ""); b.textContent = label; b.onclick = fn; w.appendChild(b); }); d.appendChild(w); }
  function answer(e, more) {
    const d = bubble("a", `<div class="ah-t">${esc(e.t)}</div>${fmt(e.a)}`), cs = [];
    if (e.go) cs.push(["↗ افتح القسم", () => goTab(e.go), 1]);
    (more || []).forEach(x => cs.push([x.e.t, () => { bubble("u", esc(x.e.t)); answer(x.e); }]));
    if (cs.length) chips(cs, d); last = e;
  }
  function ask(q) {
    q = String(q || "").trim(); if (!q) return; bubble("u", esc(q));
    if (!KB) return bubble("a", "تعذّر تحميل قاعدة المعرفة. تأكد من الاتصال ثم أعد المحاولة.");
    if (/^(اشرح|ماذا يفعل|ما هذا).*(القسم|الصفحه|هذا)/.test(norm(q)) || /هذا القسم|هذه الصفحه/.test(norm(q))) { const t = curTab(), e = KB.find(x => x.go === t && x.id === t) || KB.find(x => x.id === t); if (e) return answer(e); }
    const r = search(q, 4);
    /* الأفضل ألا أجيب بجواب خاطئ: إن لم يكن السؤال واضحاً أطلب إعادة الصياغة باسم الإعداد/العنصر */
    if (!r.length || r[0].sc < 6 || r[0].cov < .6) { const d = bubble("a", "أعد طرح السؤال رجاءً مع ذكر اسم الإعداد أو العنصر الذي تريده 🙏 (مثل: الهيرو، الطبقات، التحريك الحر، رسوم التوصيل، الشارات). أو اختر موضوعاً:"); chips(SUGG.map(s => [s, () => ask(s)]), d); return; }
    const close = r.slice(1).filter(x => x.sc > r[0].sc * .88 && x.cov >= r[0].cov - .01);
    if (close.length) { const d = bubble("a", "سؤالك يحتمل أكثر من موضوع — أيها تقصد؟"); chips([r[0]].concat(close).slice(0, 4).map(x => [x.e.t, () => { bubble("u", esc(x.e.t)); answer(x.e); }]), d); return; }
    answer(r[0].e, r.slice(1, 4).filter(x => x.sc > r[0].sc * .45));
  }
  function build() {
    css(); const top = document.querySelector("#app .top"); if (!top || $("ah-btn")) return;
    const b = document.createElement("button"); b.id = "ah-btn"; b.type = "button"; b.className = "ah-btn"; b.title = "مساعد استعمال الأدوات والإعدادات (اسم مؤقت)"; b.innerHTML = ROBOT("#173f35", "#0f2e26", "#E4C87F") + `<span class="t">${NAME}</span>`; b.onclick = toggle; top.insertBefore(b, top.firstChild);
    const p = document.createElement("div"); p.id = "ah-panel"; p.className = "ah-panel";
    p.innerHTML = `<div class="ah-h">${ROBOT("#E4C87F", "#173f35", "#E4C87F")}<div><b>${NAME}</b><small>مساعد استعمال الأدوات (اسم مؤقت)</small></div><button class="ah-x" onclick="AdminHelp.close()" aria-label="إغلاق">✕</button></div><div class="ah-m" id="ah-m"></div><form class="ah-f" onsubmit="AdminHelp.send(event)"><input id="ah-in" placeholder="اسأل: كيف أستعمل…؟ ما هو…؟" autocomplete="off"><button type="submit">إرسال</button></form>`;
    document.body.appendChild(p);
    const d = bubble("a", "مرحباً 👋 أنا مساعدك لشرح أدوات الموقع وإعداداته. اسألني عن أي قسم في اللوحة أو أي عنصر في مطوّر الصفحات."); const t = curTab();
    chips([["اشرح لي هذا القسم", () => ask("اشرح هذا القسم")]].concat(SUGG.map(s => [s, () => ask(s)])), d);
  }
  async function load() { if (KB) return; try { const r = await fetch("assets/data/admin-help.json", { cache: "no-cache" }); KB = await r.json(); index(); } catch (e) { KB = null; } }
  function toggle() { open ? close() : show(); }
  async function show() { build(); await load(); open = true; $("ah-panel").classList.add("on"); setTimeout(() => { const i = $("ah-in"); if (i) i.focus(); }, 50); }
  function close() { open = false; const p = $("ah-panel"); if (p) p.classList.remove("on"); }
  function send(ev) { ev.preventDefault(); const i = $("ah-in"), v = i.value; i.value = ""; ask(v); }
  const init = () => { const tryB = () => { if (document.querySelector("#app .top")) { build(); load(); } else setTimeout(tryB, 400); }; tryB(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { ask, send, close, toggle, decide: q => { const r = KB ? search(q, 4) : []; if (!r.length || r[0].sc < 6 || r[0].cov < .6) return 'REPHRASE'; const c = r.slice(1).filter(x => x.sc > r[0].sc * .88 && x.cov >= r[0].cov - .01); return c.length ? 'AMBIG:' + [r[0]].concat(c).map(x => x.e.id).join('+') : 'OK:' + r[0].e.id; }, search: q => (KB ? search(q, 3) : []), get kb() { return KB; } };
})();
