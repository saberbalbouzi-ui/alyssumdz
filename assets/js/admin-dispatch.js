/* التوجيه اللوجستي (Dispatching): (1) توجيه تلقائي للطلب إلى شركة التوصيل بحسب منطقته أو أداء الشركات في ولايته،
   (2) «أرسل الكل ثم اطبع البوردرو» بنقرة واحدة (حتى 150 طرداً مجمّعة بالشركة)، (3) محطة مسح الباركود لتجهيز الطرود والتحقق من محتوى كل واحد،
   (4) كشف تسليم مطبوع لكل شركة. المنطق النقي (REGIONS/regionOf/perfStats/pick/matchScan) قابل للاختبار؛ الواجهة تستعمل الدوال القائمة في Admin
   (orderCompanyKey ← AdminDispatch.route، bulkSend، printBordereaux) فلا منطق شحن موازٍ. */
(function (root) {
  "use strict";
  /* مناطق الولايات (بمعرّف الولاية الأم: الجديدة 59–69 تتبع أمّها). تُعدَّل لكل ولاية على حدة من الواجهة. */
  const REGIONS = {
    est: { n: "الشرق", ids: [4, 5, 6, 12, 18, 19, 21, 23, 24, 25, 34, 36, 40, 41, 43] },
    centre: { n: "الوسط", ids: [2, 9, 10, 15, 16, 17, 26, 28, 35, 42, 44] },
    ouest: { n: "الغرب", ids: [13, 14, 20, 22, 27, 29, 31, 38, 46, 48] },
    sud: { n: "الجنوب", ids: [1, 3, 7, 8, 11, 30, 32, 33, 37, 39, 45, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58] },
  };
  const regionOf = pid => { for (const k of Object.keys(REGIONS)) if (REGIONS[k].ids.indexOf(+pid) >= 0) return k; return ""; };
  /* أداء الشركات: لكل (شركة، ولاية أم) عدد المسلَّم والفاشل من الطلبات المرسَلة */
  function perfStats(orders, trackingOf, pidOf) {
    const out = {};
    (orders || []).forEach(o => {
      if (!o || (o.status !== "livree" && o.status !== "echec")) return; const t = trackingOf(o); if (!t || !t.company) return; const pid = pidOf(o); if (!pid) return;
      const c = out[t.company] || (out[t.company] = {}), w = c[pid] || (c[pid] = { d: 0, f: 0 }); if (o.status === "livree") w.d++; else w.f++;
    });
    return out;
  }
  const smooth = x => (x.d + 1) / (x.d + x.f + 2);
  /* يختار شركة ولاية بالقواعد: ولاية ← منطقة ← "" (الافتراضية)؛ والقيمة auto = الأفضل أداءً (عيّنة كافية في الولاية وإلا في منطقتها) */
  function pick(pid, cfg, enabled, stats, minSample) {
    if (!cfg || !cfg.on || !pid) return ""; const reg = regionOf(pid), min = Math.max(1, +minSample || +cfg.minSample || 8);
    const ch = (cfg.wil && cfg.wil[pid]) || (cfg.regions && cfg.regions[reg]) || ""; if (!ch) return "";
    if (ch !== "auto") return enabled.indexOf(ch) >= 0 ? ch : "";
    let best = "", bs = -1;
    enabled.forEach(k => {
      const c = (stats && stats[k]) || {}; let x = c[pid];
      if (!x || x.d + x.f < min) { x = { d: 0, f: 0 }; REGIONS[reg] && REGIONS[reg].ids.forEach(i => { if (c[i]) { x.d += c[i].d; x.f += c[i].f; } }); }
      if (x.d + x.f < min) return; const s = smooth(x); if (s > bs + 1e-9) { bs = s; best = k; }
    });
    return best;
  }
  /* يحوّل ما يلتقطه الماسح (نص الباركود) إلى مفتاح مقارنة: بلا مسافات وبحروف كبيرة، وإن كان رابطاً أو فيه بادئة يؤخذ آخر مقطع طويل */
  const normScan = v => { let s = String(v == null ? "" : v).trim(); const m = s.match(/[A-Za-z0-9\-_]{6,}\s*$/); if (/[\/?=]/.test(s) && m) s = m[0]; return s.replace(/\s+/g, "").toUpperCase(); };
  const model = { REGIONS, regionOf, perfStats, pick, normScan, smooth };
  if (typeof module !== "undefined" && module.exports) { module.exports = model; }
  if (typeof document === "undefined") return;

  /* ═══════════════ الواجهة ═══════════════ */
  const $ = id => document.getElementById(id), A = () => (typeof Admin !== "undefined" ? Admin : null);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { cfg: { on: false, regions: {}, wil: {}, minSample: 8 }, loaded: false, scan: {}, last: null, cam: null, busy: false, open: false };
  const day = () => (A() && A().isoDay ? A().isoDay() : new Date().toISOString().slice(0, 10)), SK = () => "alyssum_scan_" + day();
  const loadScan = () => { try { S.scan = JSON.parse(localStorage.getItem(SK()) || "{}") || {}; } catch (e) { S.scan = {}; } };
  const saveScan = () => { try { localStorage.setItem(SK(), JSON.stringify(S.scan)); } catch (e) { } };
  const wOfOrder = o => { const W = typeof WILAYAS !== "undefined" ? WILAYAS : []; return W.find(x => x.name === (o && o.wilaya)) || null; };
  const pidOf = o => { const w = wOfOrder(o); return w ? (w.par || w.id) : 0; };
  const cos = () => (A() ? A().allDeliveryCompanies() : {}), en = () => (A() ? A().enabledCompanyKeys() : []), coName = k => (cos()[k] && cos()[k].name) || k;
  const stats = () => perfStats(A().orders, o => A().trackingOf(o), pidOf);

  /* واجهة الاستخدام داخل Admin.orderCompanyKey */
  let memo = { at: 0, n: -1, v: null };
  const statsMemo = () => { const a = A(), n = (a.orders || []).length; if (memo.v && memo.n === n && Date.now() - memo.at < 5000) return memo.v; memo = { at: Date.now(), n, v: stats() }; return memo.v; };
  function route(o) {
    if (!S.cfg || !S.cfg.on || !A()) return ""; const pid = pidOf(o); if (!pid) return "";
    return pick(pid, S.cfg, en(), statsMemo());
  }
  async function load() {
    try { const v = typeof Priv !== "undefined" ? await Priv.get("shiprouting", null) : null; if (v && typeof v === "object") S.cfg = Object.assign({ on: false, regions: {}, wil: {}, minSample: 8 }, v); } catch (e) { }
    S.loaded = true; loadScan();
  }
  async function save() {
    const g = id => $(id) || {}, cfg = { on: !!g("dp-on").checked, minSample: Math.max(3, Math.min(100, Math.round(+g("dp-min").value || 8))), regions: {}, wil: {} };
    Object.keys(REGIONS).forEach(k => { const v = (g("dp-r-" + k).value || ""); if (v) cfg.regions[k] = v; });
    document.querySelectorAll("#dp-wil [data-w]").forEach(s => { if (s.value) cfg.wil[s.dataset.w] = s.value; });
    S.cfg = cfg; await Priv.set("shiprouting", cfg); toast("🧭 حُفظ التوجيه"); draw();
  }

  /* ───── الإرسال والطباعة بنقرة ───── */
  const pending = () => { const a = A(); return a ? (a.orders || []).filter(o => o.status === "confirmee" && !a.trackingOf(o) && !a.isBlacklisted(o.phone) && a.priceCheck(o).ok) : []; };
  const printable = () => { const a = A(); return a ? (a.orders || []).map(o => ({ o, t: a.trackingOf(o) })).filter(x => x.t && (x.o.status === "confirmee" || x.o.status === "nouvelle")) : []; };
  async function runAll() {
    const a = A(); if (!a || S.busy) return; const list = pending().slice(0, 150); if (!list.length) { toast("ℹ️ لا طلب مؤكَّد بانتظار الإرسال"); return; }
    const w = window.open("", "_blank");                                  // يُفتح الآن (ضمن النقرة) كي لا يحجبه المتصفح بعد الانتظار
    if (w) try { w.document.write('<body dir="rtl" style="font-family:sans-serif;padding:2rem;text-align:center">⏳ جارِ إرسال الطلبات إلى شركات التوصيل…</body>'); } catch (e) { }
    S.busy = true;
    try {
      const go = await a.bulkSend(list, { quiet: true }); const L = a._lastBulk || { sent: [], bad: [] };
      if (!go || !L.sent.length) { if (w) try { w.close(); } catch (e) { } if (L.bad && L.bad.length) a.showNotice("❌ تعذّر الإرسال", L.bad.slice(0, 8).map(x => "• " + esc(x.o.name || "") + ": " + esc(x.why)).join("<br>")); return; }
      if (L.bad.length) toast("⚠️ تعذّر إرسال " + L.bad.length + " طلب — راجعها من «الطلبات»");
      await a.printBordereaux(L.sent.map(o => ({ o, t: a.trackingOf(o) })).filter(x => x.t), w);
    } finally { S.busy = false; draw(); }
  }
  async function printAll() {
    const a = A(), l = printable().slice(0, 150); if (!l.length) { toast("ℹ️ لا طرود قيد التجهيز"); return; }
    const w = window.open("", "_blank"); await a.printBordereaux(l, w || undefined);
  }

  /* ───── محطة المسح ───── */
  function beep(ok) { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = ok ? 880 : 220; g.gain.value = .08; o.start(); setTimeout(() => { o.stop(); c.close(); }, ok ? 120 : 380); } catch (e) { } }
  function findByCode(code) {
    const a = A(), k = normScan(code); if (!a || !k) return null;
    for (const o of a.orders || []) { const t = a.trackingOf(o); if ((t && normScan(t.tracking) === k) || normScan(o.id) === k) return { o, t }; }
    return null;
  }
  function onScan(code) {
    const k = normScan(code); if (!k) return; const hit = findByCode(code); let st = "unknown", info = null;
    if (hit) {
      const key = hit.t ? normScan(hit.t.tracking) : normScan(hit.o.id);
      if (!hit.t) st = "notsent"; else if (hit.o.status !== "confirmee" && hit.o.status !== "nouvelle") st = "gone"; else if (S.scan[key]) st = "dup"; else { st = "ok"; S.scan[key] = { ts: Date.now(), id: hit.o.id, co: hit.t.company }; saveScan(); }
      info = hit;
    }
    S.last = { st, info, code: k, at: Date.now() }; beep(st === "ok"); draw();
    const inp = $("dp-scan"); if (inp) { inp.value = ""; inp.focus(); }
  }
  const scannedList = () => Object.keys(S.scan).map(k => Object.assign({ k }, S.scan[k])).sort((a, b) => a.ts - b.ts);
  function undo() { const l = scannedList().pop(); if (!l) return; delete S.scan[l.k]; saveScan(); S.last = null; draw(); toast("↩ أُلغي آخر مسح"); }
  async function camToggle() {
    if (S.cam) { stopCam(); draw(); return; }
    if (!("BarcodeDetector" in window)) { toast("المتصفح لا يدعم قراءة الباركود بالكاميرا — استعمل جهاز الماسح أو اكتب الرقم"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }), v = document.createElement("video"); v.srcObject = stream; v.playsInline = true; await v.play();
      const det = new BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "qr_code", "itf"] }); let last = "", lastAt = 0;
      S.cam = { stream, v, t: setInterval(async () => { try { const r = await det.detect(v); if (r && r[0]) { const c = r[0].rawValue; if (c !== last || Date.now() - lastAt > 2500) { last = c; lastAt = Date.now(); onScan(c); } } } catch (e) { } }, 300) };
      draw(); const host = $("dp-cam"); if (host) host.appendChild(v), v.style.cssText = "width:100%;max-height:240px;border-radius:12px";
    } catch (e) { toast("تعذّر فتح الكاميرا: " + (e.message || e)); }
  }
  function stopCam() { if (S.cam) { clearInterval(S.cam.t); try { S.cam.stream.getTracks().forEach(t => t.stop()); } catch (e) { } S.cam = null; } }
  function manifest(coKey) {
    const a = A(), rows = scannedList().filter(x => !coKey || x.co === coKey).map(x => ({ x, o: (a.orders || []).find(o => o.id === x.id) })).filter(r => r.o); if (!rows.length) { toast("ℹ️ لا طرود ممسوحة"); return; }
    const by = {}; rows.forEach(r => { (by[r.x.co] = by[r.x.co] || []).push(r); });
    const money = n => (Math.round(+n || 0)).toLocaleString("fr-DZ") + " دج", w = window.open("", "_blank"); if (!w) { toast("⚠️ المتصفح حجب النافذة"); return; }
    const sec = k => { const l = by[k]; return '<section><h2>كشف تسليم الطرود — ' + esc(coName(k)) + '</h2><p>' + esc(new Date().toLocaleString("fr-DZ")) + ' · عدد الطرود: <b>' + l.length + '</b> · مجموع التحصيل عند التسليم: <b>' + money(l.reduce((t, r) => t + (+r.o.total || 0), 0)) + '</b></p><table><thead><tr><th>#</th><th>التتبع</th><th>الزبون</th><th>الولاية</th><th>المبلغ</th><th>✓</th></tr></thead><tbody>' +
      l.map((r, i) => '<tr><td>' + (i + 1) + '</td><td dir="ltr">' + esc((a.trackingOf(r.o) || {}).tracking || r.o.id) + '</td><td>' + esc(r.o.name || "") + '</td><td>' + esc(r.o.wilaya || "") + '</td><td>' + money(r.o.total) + '</td><td></td></tr>').join("") + '</tbody></table><div class="sg"><span>توقيع المسلِّم: ………………</span><span>توقيع مندوب ' + esc(coName(k)) + ': ………………</span></div></section>'; };
    w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف التسليم</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:16px}section{page-break-after:always}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:5px 7px;text-align:right}th{background:#eee}.sg{display:flex;justify-content:space-between;margin-top:40px}.b{position:fixed;top:8px;left:8px}@media print{.b{display:none}}</style></head><body><button class="b" onclick="print()">🖨 طباعة</button>' + Object.keys(by).map(sec).join("") + '</body></html>'); w.document.close();
  }

  /* ───── الرسم ───── */
  const COL = { ok: ["#22c55e", "✅ تم — ضعه في الصندوق"], dup: ["#f59e0b", "⚠ ممسوح سابقاً"], gone: ["#a78bfa", "ℹ طرد خرج/سُلِّم سابقاً"], notsent: ["#f59e0b", "⚠ الطلب لم يُرسل لشركة بعد"], unknown: ["#ef4444", "❌ غير موجود في طلباتك"] };
  function css() {
    if ($("dp-css")) return; const st = document.createElement("style"); st.id = "dp-css";
    st.textContent = `#dp{display:grid;gap:.9rem;max-width:1100px}#dp .card{padding:1rem}#dp h3{margin:.1rem 0 .5rem}.dp-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.dp-big{padding:.9rem 1.2rem;font-size:1.05rem;font-weight:900;min-height:54px}
.dp-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.5rem}.dp-chip{padding:.35rem .7rem;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);font-weight:700;font-size:.85rem}
.dp-res{padding:1rem;border-radius:16px;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}.dp-res h2{margin:0 0 .4rem}.dp-scan{font-size:1.4rem;padding:.8rem;width:100%;max-width:420px;direction:ltr;text-align:center}
#dp table{width:100%}#dp td,#dp th{padding:.35rem .5rem}.dp-bar{height:8px;border-radius:8px;background:rgba(255,255,255,.14)}.dp-bar i{display:block;height:8px;border-radius:8px;background:#22c55e}`;
    document.head.appendChild(st);
  }
  function coOptions(sel, extra) { return (extra || []).concat(en().map(k => [k, coName(k)])).map(([v, l]) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(l)}</option>`).join(""); }
  function draw() {
    const host = $("dispatch-content"); if (!host || !A()) return; css(); const a = A(), pend = pending(), prt = printable(), st = stats(), ens = en();
    const split = {}; pend.forEach(o => { const k = a.orderCompanyKey(o) || a.activeCompanyKey(); split[coName(k)] = (split[coName(k)] || 0) + 1; });
    const exp = prt, sc = scannedList(), scSet = new Set(sc.map(x => x.k)), left = exp.filter(x => !scSet.has(normScan(x.t.tracking)));
    const pct = exp.length ? Math.round((exp.length - left.length) / exp.length * 100) : 0;
    const regionRow = k => `<label class="dp-chip" style="display:flex;gap:.4rem;align-items:center">${esc(REGIONS[k].n)} <select id="dp-r-${k}">${coOptions((S.cfg.regions || {})[k] || "", [["", "الافتراضية"], ["auto", "🤖 الأفضل أداءً"]])}</select></label>`;
    const W = typeof WILAYAS !== "undefined" ? WILAYAS.filter(w => !w.par).sort((x, y) => x.id - y.id) : [];
    const perfRows = Object.keys(REGIONS).map(r => `<tr><td>${esc(REGIONS[r].n)}</td>` + ens.map(k => { const c = st[k] || {}; let d = 0, f = 0; REGIONS[r].ids.forEach(i => { if (c[i]) { d += c[i].d; f += c[i].f; } }); return `<td>${d + f ? `<b style="color:${smooth({ d, f }) >= .8 ? "#86efac" : smooth({ d, f }) >= .6 ? "#fcd34d" : "#fca5a5"}">${Math.round(d / (d + f) * 100)}%</b> <small>(${d}/${d + f})</small>` : "—"}</td>`; }).join("") + `</tr>`).join("");
    const L = S.last, c = L ? COL[L.st] : null, o = L && L.info ? L.info.o : null;
    host.innerHTML = `<div id="dp">
<div class="card"><h3>🚚 إرسال وطباعة بنقرة واحدة</h3><p class="hint">يرسل كل الطلبات المؤكَّدة غير المرسَلة (حتى 150) كل طلب إلى شركته بحسب قواعد التوجيه أدناه، ثم يفتح بوردرو الجميع في صفحة واحدة مجمّعة بالشركة والولاية (للشركات التي لا تُصدر بوردرو يُنشأ وصل بباركود رقم التتبع).</p>
<div class="dp-row"><span class="dp-chip">بانتظار الإرسال: <b>${pend.length}</b></span>${Object.keys(split).map(k => `<span class="dp-chip">${esc(k)}: <b>${split[k]}</b></span>`).join("")}<span class="dp-chip">قيد التجهيز (لها بوردرو): <b>${prt.length}</b></span></div>
<div class="dp-row" style="margin-top:.6rem"><button class="small green dp-big" data-dp="run"${pend.length ? "" : " disabled"}>🚚 أرسل ${pend.length} طلب ثم اطبع البوردرو</button><button class="small blue dp-big" data-dp="print"${prt.length ? "" : " disabled"}>🖨 اطبع بوردرو قيد التجهيز (${prt.length})</button></div></div>
<div class="card"><h3>🧭 التوجيه الذكي (Auto-Routing)</h3><p class="hint">اختر لكل منطقة شركتها، أو «الأفضل أداءً» ليختار النظام الشركة الأعلى نسبة تسليم في الولاية (من طلباتك المسلَّمة والفاشلة، بعد عيّنة كافية، وإلا الافتراضية). شركة المنتج المحدَّدة في بطاقة المنتج تتقدّم على التوجيه، والطرد المسجَّل يبقى عند شركته.</p>
<div class="dp-row"><label><input type="checkbox" id="dp-on"${S.cfg.on ? " checked" : ""}> فعّل التوجيه التلقائي</label>${Object.keys(REGIONS).map(regionRow).join("")}<label class="dp-chip">أقل عيّنة <input id="dp-min" type="number" min="3" max="100" value="${esc(S.cfg.minSample || 8)}" style="width:4rem"></label></div>
<details style="margin-top:.5rem"><summary>تخصيص ولاية بعينها</summary><div id="dp-wil" class="dp-g" style="margin-top:.5rem">${W.map(w => `<label class="dp-chip">${w.id} ${esc(w.name)} <select data-w="${w.id}">${coOptions((S.cfg.wil || {})[w.id] || "", [["", "حسب المنطقة"], ["auto", "🤖 الأفضل أداءً"]])}</select></label>`).join("")}</div></details>
<div class="dp-row" style="margin-top:.6rem"><button class="small green" data-dp="save">💾 حفظ التوجيه</button>${ens.length < 2 ? '<span class="hint">فعّل شركتين على الأقل من «شركات التوصيل» ليكون للتوجيه معنى.</span>' : ""}</div>
<h4 style="margin:.8rem 0 .3rem">📊 نسبة التسليم لكل شركة حسب المنطقة <small class="hint">(مسلَّم/ (مسلَّم+فاشل))</small></h4>${ens.length ? `<div style="overflow-x:auto"><table><thead><tr><th>المنطقة</th>${ens.map(k => `<th>${esc(coName(k))}</th>`).join("")}</tr></thead><tbody>${perfRows}</tbody></table></div>` : '<p class="hint">لا شركة مفعّلة.</p>'}</div>
<div class="card"><h3>📦 محطة المسح (تجهيز الطرود)</h3><p class="hint">امسح باركود كل بوردرو بجهاز الماسح (يكتب الرقم ويضغط Enter) أو بالكاميرا: يظهر محتوى الطلب للتحقق قبل وضعه في الصندوق، ويُسجَّل أنه جُهِّز اليوم.</p>
<div class="dp-row"><input id="dp-scan" class="dp-scan" placeholder="امسح أو اكتب رقم التتبع ثم Enter" autocomplete="off"><button class="small blue" data-dp="cam">${S.cam ? "⏹ أوقف الكاميرا" : "📷 كاميرا"}</button><button class="small warn" data-dp="undo">↩ تراجع</button></div>
<div id="dp-cam" style="margin:.5rem 0"></div>
<div class="dp-row" style="margin:.5rem 0"><span class="dp-chip">جُهِّز اليوم: <b>${sc.length}</b></span><span class="dp-chip">متبقٍ: <b>${left.length}</b> من ${exp.length}</span><div class="dp-bar" style="flex:1;min-width:140px"><i style="width:${pct}%"></i></div></div>
${L ? `<div class="dp-res" style="--c:${c[0]}"><h2>${c[1]}</h2>${o ? `<div><b>${esc(o.name || "")}</b> · <span dir="ltr">${esc(o.phone || "")}</span> · ${esc([o.wilaya, o.commune].filter(Boolean).join(" / "))} · ${o.dtype === "stop" ? "مكتب" : "منزل"}</div><div style="white-space:pre-line;margin:.4rem 0">${esc(a.itemsDisplay(o))}</div><div>التحصيل: <b>${(Math.round(+o.total) || 0).toLocaleString("fr-DZ")} دج</b>${L.info.t ? ` · ${esc(coName(L.info.t.company))} · <span dir="ltr">${esc(L.info.t.tracking)}</span>` : ""}</div>` : `<div dir="ltr">${esc(L.code)}</div>`}</div>` : ""}
<div class="dp-row" style="margin-top:.6rem"><button class="small green" data-dp="manifest">🖨 كشف التسليم لكل الشركات</button>${[...new Set(sc.map(x => x.co))].map(k => `<button class="small blue" data-dp="manifest:${esc(k)}">كشف ${esc(coName(k))} (${sc.filter(x => x.co === k).length})</button>`).join("")}<button class="small warn" data-dp="reset">مسح سجل اليوم</button></div>
${left.length ? `<details style="margin-top:.5rem"><summary>المتبقي للتجهيز (${left.length})</summary><div style="overflow-x:auto;max-height:260px"><table><tbody>${left.slice(0, 200).map(x => `<tr><td dir="ltr">${esc(x.t.tracking)}</td><td>${esc(x.o.name || "")}</td><td>${esc(x.o.wilaya || "")}</td><td>${esc(coName(x.t.company))}</td></tr>`).join("")}</tbody></table></div></details>` : ""}</div></div>`;
    const inp = $("dp-scan"); if (inp && S.open && !S.cam) inp.focus();
    if (S.cam && S.cam.v) { const h = $("dp-cam"); if (h) { h.appendChild(S.cam.v); S.cam.v.style.cssText = "width:100%;max-height:240px;border-radius:12px"; } }
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest("[data-dp]"); if (!b || !$("dispatch-content") || !$("dispatch-content").contains(b)) return; const a = b.dataset.dp;
    if (a === "run") runAll(); else if (a === "print") printAll(); else if (a === "save") save(); else if (a === "cam") camToggle(); else if (a === "undo") undo();
    else if (a === "reset") { if (confirm("مسح سجل المسح لهذا اليوم؟")) { S.scan = {}; saveScan(); S.last = null; draw(); } }
    else if (a === "manifest") manifest(); else if (a.indexOf("manifest:") === 0) manifest(a.slice(9));
  }
  function init() {
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", e => { if (e.target && e.target.id === "dp-scan" && e.key === "Enter") { e.preventDefault(); onScan(e.target.value); } });
    const w = () => {
      if (typeof Admin === "undefined" || !Admin.tab || Admin._dpWrapped) return; const orig = Admin.tab;
      Admin.tab = function (t, btn) { const r = orig.call(this, t, btn), el = $("tab-dispatch"); if (el) el.classList.toggle("hidden", t !== "dispatch"); S.open = t === "dispatch"; if (t === "dispatch") { loadScan(); draw(); } else stopCam(); return r; };
      Admin._dpWrapped = true; load();
    };
    w(); setTimeout(w, 600); setTimeout(w, 2500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  root.AdminDispatch = Object.assign({ route, load, draw, onScan, runAll, manifest, findByCode, _S: S }, model);
})(typeof window !== "undefined" ? window : globalThis);
