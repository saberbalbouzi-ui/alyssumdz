/* مناطق التوصيل (Zones): كل منطقة = مجموعة ولايات بسعر للمنزل وسعر للمكتب، مع خيار الشحن المجاني (دائماً أو عند بلوغ مبلغ)،
   واستثناء بلديات (لا توصيل نهائياً أو لا توصيل للمنزل فقط) أو ولايات كاملة.
   التخزين: `var SHIPPING = {v,zones,ex,exw}` داخل assets/js/wilayas.js (نفس ملف الرسوم)، ولكل ولاية في WILAYAS حقول مشتقة يقرؤها المتجر:
   zn اسم المنطقة، fh/fs مجاني للمنزل/المكتب، fo حدّ المجاني، xw ولاية مستثناة، xc {بلدية:"all"|"home"}.
   الولاية خارج أي منطقة تبقى بأسعارها الفردية في شبكة «رسوم كل ولاية». المنطق في المتجر: shipQuote في assets/js/app.js. */
const AdminZones = (() => {
  const $ = id => document.getElementById(id), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const uid = () => "z" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  const pad = n => String(n).padStart(2, "0");
  const S = { zones: [], ex: [], exw: [], inited: false, open: null, exWil: "", exSel: [] };
  const base = () => (typeof SHIPPING !== "undefined" && SHIPPING) ? SHIPPING : {};
  function load() {
    const b = base(); S.zones = JSON.parse(JSON.stringify(b.zones || [])); S.ex = JSON.parse(JSON.stringify(b.ex || [])); S.exw = (b.exw || []).slice(); S.inited = true;
    // ولايات مستثناة/بلديات محفوظة في الحقول المشتقة دون SHIPPING (مثلاً من نسخة قديمة): نستعيدها
    if (!S.ex.length && !S.exw.length && A() && A().fees) A().fees.forEach(w => { if (w.xw && !S.exw.includes(w.id)) S.exw.push(w.id); if (w.xc) Object.keys(w.xc).forEach(c => S.ex.push({ w: w.id, c, m: w.xc[c] })); });
  }
  const data = () => ({ v: 1, zones: S.zones, ex: S.ex, exw: S.exw });
  /* اشتقاق حقول الولايات من المناطق والاستثناءات */
  function apply() {
    const a = A(); if (!a || !a.fees) return; const byW = {};
    S.zones.forEach(z => (z.wilayas || []).forEach(id => { byW[id] = z; }));
    a.fees.forEach(w => {
      const z = byW[w.id];
      if (z) { w.home = Math.max(0, Number(z.home) || 0); w.stop = Math.max(0, Number(z.stop) || 0); w.zn = z.name || "منطقة"; z.freeHome ? w.fh = 1 : delete w.fh; z.freeStop ? w.fs = 1 : delete w.fs; Number(z.freeOver) > 0 ? w.fo = Number(z.freeOver) : delete w.fo; }
      else { delete w.zn; delete w.fh; delete w.fs; delete w.fo; }
      S.exw.includes(w.id) ? w.xw = 1 : delete w.xw;
      const xc = {}; S.ex.filter(e => e.w === w.id).forEach(e => { xc[e.c] = e.m === "home" ? "home" : "all"; });
      Object.keys(xc).length ? w.xc = xc : delete w.xc;
    });
    if (typeof window !== "undefined") window.SHIPPING = data();
  }
  function commit(rerender) { apply(); try { a_().renderFees(); } catch (e) { } if (rerender) draw(); else status(); }
  const a_ = () => A();
  function status() { const e = $("zn-st"); if (e) e.textContent = "غير محفوظ — اضغط «حفظ الكل» أعلى الصفحة لنشرها على الموقع"; }
  const wname = id => { const w = (A().fees || []).find(x => x.id === id); return w ? pad(w.id) + " — " + w.name : String(id); };
  function zoneOf(id, except) { return S.zones.find(z => z.id !== except && (z.wilayas || []).includes(id)); }
  function css() {
    if ($("zn-css")) return; const st = document.createElement("style"); st.id = "zn-css";
    st.textContent = `#zn-card .zn-z{border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:12px 14px;margin-top:10px;background:rgba(255,255,255,.05)}
#zn-card .zn-r{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end}
#zn-card .zn-r label{display:block;font-size:.8rem;margin:0 0 4px;opacity:.8}#zn-card .zn-c{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
#zn-card details{margin-top:8px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.05)}#zn-card summary{cursor:pointer;padding:9px 12px;font-weight:800}
#zn-card .zn-l{max-height:230px;overflow:auto;padding:8px 12px 10px;display:grid;gap:3px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));background:rgba(9,24,18,.985);border-top:1px solid rgba(255,255,255,.12);border-radius:0 0 12px 12px}
#zn-card .zn-l label{display:flex;gap:6px;align-items:center;margin:0;font-size:.84rem;opacity:1}#zn-card .zn-l input{width:auto}#zn-card .zn-l label.off{opacity:.45}
#zn-card .zn-tag{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(134,240,106,.16);margin:2px;font-size:.78rem}#zn-card .zn-tag.rd{background:rgba(255,100,100,.18)}#zn-card .zn-tag button{border:0;background:transparent;color:inherit;cursor:pointer;margin-inline-start:4px}
#zn-card .zn-sum th,#zn-card .zn-sum td{padding:6px 8px;text-align:start;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:top}#zn-card .zn-sum th{opacity:.75;white-space:nowrap}
#zn-card .zn-x{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)}`;
    document.head.appendChild(st);
  }
  function zoneHtml(z) {
    const n = (z.wilayas || []).length;
    return `<div class="zn-z" data-z="${esc(z.id)}"><div class="zn-r"><div><label>اسم المنطقة</label><input data-f="name" value="${esc(z.name)}"></div>
<div><label>🏠 سعر المنزل (دج)</label><input data-f="home" type="number" min="0" value="${esc(z.home)}"></div><div><label>🏢 سعر المكتب (دج)</label><input data-f="stop" type="number" min="0" value="${esc(z.stop)}"></div>
<div><label>مجاني عند طلب بقيمة ≥ (0 = لا)</label><input data-f="freeOver" type="number" min="0" value="${esc(z.freeOver || 0)}"></div></div>
<div class="zn-c"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-f="freeHome" style="width:auto" ${z.freeHome ? "checked" : ""}> توصيل مجاني للمنزل دائماً</label>
<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-f="freeStop" style="width:auto" ${z.freeStop ? "checked" : ""}> توصيل مجاني للمكتب دائماً</label>
<button type="button" class="small warn" data-zdel="${esc(z.id)}" style="margin-inline-start:auto">حذف المنطقة</button></div>
<details ${S.open === z.id ? "open" : ""} data-zd="${esc(z.id)}"><summary>الولايات (${n})</summary><div class="zn-l">${(A().fees || []).map(w => { const o = zoneOf(w.id, z.id); return `<label class="${o ? "off" : ""}" title="${o ? "ضمن منطقة «" + esc(o.name) + "»" : ""}"><input type="checkbox" data-zw="${w.id}" ${(z.wilayas || []).includes(w.id) ? "checked" : ""} ${o ? "disabled" : ""}> ${pad(w.id)} ${esc(w.name)}${o ? " ← " + esc(o.name) : ""}</label>`; }).join("")}</div></details></div>`;
  }
  /* ملخص مقروء: كل المناطق بأسعارها وولاياتها (مرتّبة بحسب السعر) + الولايات غير المنسوبة لمنطقة */
  function sumHtml() {
    const f = A().fees || [], m = n => Number(n || 0).toLocaleString("fr-DZ"), inZ = new Set(); S.zones.forEach(z => (z.wilayas || []).forEach(id => inZ.add(id)));
    const rows = S.zones.map((z, i) => `<tr><td><b>${i + 1}</b></td><td style="white-space:nowrap">${esc(z.name)}</td><td>${z.freeHome ? "مجاني" : m(z.home)}</td><td>${z.freeStop ? "مجاني" : m(z.stop)}</td><td>${Number(z.freeOver) > 0 ? "≥ " + m(z.freeOver) : "—"}</td><td style="white-space:normal;min-width:260px">${(z.wilayas || []).map(id => { const w = f.find(x => x.id === id); return w ? `<bdi>${pad(w.id)} ${esc(w.name)}</bdi>` : id; }).join("، ") || "—"}</td></tr>`).join("");
    const rest = f.filter(w => !inZ.has(w.id));
    return `<details class="zn-sum" open><summary>ملخص المناطق (${S.zones.length}) — ${inZ.size} ولاية منسوبة${rest.length ? " و" + rest.length + " بدون منطقة" : ""}</summary><div style="overflow:auto;padding:8px 12px"><table style="width:100%;border-collapse:collapse;font-size:.84rem"><thead><tr><th>#</th><th>المنطقة</th><th>🏠 منزل</th><th>🏢 مكتب</th><th>مجاني</th><th>الولايات</th></tr></thead><tbody>${rows}</tbody></table>${rest.length ? `<div class="hint" style="margin-top:6px">بدون منطقة (بأسعارها الفردية): ${rest.map(w => `<bdi>${pad(w.id)} ${esc(w.name)}</bdi>`).join("، ")}</div>` : ""}</div></details>`;
  }
  function draw() {
    const host = $("zn-card"); if (!host) return; css(); const a = A(); if (!a || !a.fees || !a.fees.length) { host.innerHTML = ""; return; }
    const w = a.fees.find(x => x.id === +S.exWil), comm = (w && w.communes) || [];
    host.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem"><div><b style="color:var(--green)">مناطق التوصيل (Zones)</b>
<div class="hint">اجمع الولايات في مناطق بسعر موحَّد للمنزل والمكتب، مع شحن مجاني اختياري. الولاية داخل منطقة تُدار أسعارها من المنطقة، وخارجها تبقى بسعرها الفردي أدناه.</div></div>
<button type="button" class="small" data-zadd="1">+ منطقة جديدة</button></div><div class="hint" id="zn-st"></div>
${S.zones.length ? sumHtml() : ""}
${S.zones.length ? S.zones.map(zoneHtml).join("") : '<div class="hint" style="margin-top:10px">لا مناطق بعد — أضف منطقة (مثل: «الشمال» 400/300، «الجنوب» 1000/700).</div>'}
<div class="zn-x"><b>الاستثناءات من التوصيل</b><div class="hint">بلدات أو ولايات لا يصلها التوصيل: يظهر للزبون «غير متاح» ولا يستطيع إتمام الطلب إليها.</div>
<div class="zn-r" style="margin-top:8px"><div><label>الولاية</label><select id="zn-xw"><option value="">— اختر —</option>${a.fees.map(x => `<option value="${x.id}" ${+S.exWil === x.id ? "selected" : ""}>${pad(x.id)} — ${esc(x.name)}</option>`).join("")}</select></div>
<div><label>نوع الاستثناء</label><select id="zn-xm"><option value="all">لا توصيل نهائياً (منزل ومكتب)</option><option value="home">لا توصيل للمنزل فقط (المكتب متاح)</option></select></div></div>
${w ? `<details open><summary>البلدات (${comm.length}) — حدّد المستثناة</summary><div class="zn-l">${comm.map((c, i) => { const e = S.ex.find(x => x.w === w.id && x.c === c); return `<label><input type="checkbox" data-xc="${i}" ${(S.exSel.includes(c)) ? "checked" : ""} ${e ? "disabled" : ""}> ${esc(c)}${e ? (e.m === "home" ? " (منزل ممنوع)" : " (ممنوعة)") : ""}</label>`; }).join("")}</div></details>
<div class="zn-c"><button type="button" class="small" data-xadd="1">إضافة البلدات المحددة</button><button type="button" class="small gray" data-xwhole="1">استثناء الولاية كلها</button></div>` : ""}
<div style="margin-top:8px">${S.exw.map(id => `<span class="zn-tag rd">ولاية ${esc(wname(id))} كلها<button type="button" data-xwdel="${id}" title="إزالة">×</button></span>`).join("")}${S.ex.map((e, i) => `<span class="zn-tag ${e.m === "all" ? "rd" : ""}">${esc(wname(e.w))} / ${esc(e.c)} ${e.m === "home" ? "(منزل)" : ""}<button type="button" data-xdel="${i}" title="إزالة">×</button></span>`).join("") || (S.exw.length ? "" : '<span class="hint">لا استثناءات.</span>')}</div></div>`;
    bind(host);
  }
  function bind(host) {
    host.querySelector("[data-zadd]").onclick = () => { const z = { id: uid(), name: "منطقة " + (S.zones.length + 1), home: 600, stop: 400, freeHome: false, freeStop: false, freeOver: 0, wilayas: [] }; S.zones.push(z); S.open = z.id; commit(true); };
    host.querySelectorAll("[data-zdel]").forEach(b => b.onclick = () => { if (!confirm("حذف هذه المنطقة؟ تبقى أسعار ولاياتها كما هي ويمكنك تعديلها فردياً.")) return; S.zones = S.zones.filter(z => z.id !== b.dataset.zdel); commit(true); });
    host.querySelectorAll("[data-z]").forEach(card => {
      const z = S.zones.find(x => x.id === card.dataset.z); if (!z) return;
      card.querySelectorAll("[data-f]").forEach(i => i.onchange = () => { const f = i.dataset.f; z[f] = i.type === "checkbox" ? i.checked : (i.type === "number" ? Math.max(0, Number(i.value) || 0) : i.value.trim()); commit(false); });
      card.querySelectorAll("[data-zw]").forEach(i => i.onchange = () => { const id = +i.dataset.zw; z.wilayas = (z.wilayas || []).filter(x => x !== id); if (i.checked) z.wilayas.push(id); S.open = z.id; commit(true); });
    });
    const xw = $("zn-xw"); xw.onchange = () => { S.exWil = xw.value; S.exSel = []; draw(); };
    host.querySelectorAll("[data-xc]").forEach(i => i.onchange = () => { const w = A().fees.find(x => x.id === +S.exWil), c = w.communes[+i.dataset.xc]; S.exSel = S.exSel.filter(x => x !== c); if (i.checked) S.exSel.push(c); });
    const add = host.querySelector("[data-xadd]"); if (add) add.onclick = () => { if (!S.exSel.length) return toastMsg("حدّد بلدية واحدة على الأقل"); const m = $("zn-xm").value; S.exSel.forEach(c => { S.ex = S.ex.filter(e => !(e.w === +S.exWil && e.c === c)); S.ex.push({ w: +S.exWil, c, m }); }); S.exSel = []; commit(true); };
    const wh = host.querySelector("[data-xwhole]"); if (wh) wh.onclick = () => { if (!S.exw.includes(+S.exWil)) S.exw.push(+S.exWil); commit(true); };
    host.querySelectorAll("[data-xdel]").forEach(b => b.onclick = () => { S.ex.splice(+b.dataset.xdel, 1); commit(true); });
    host.querySelectorAll("[data-xwdel]").forEach(b => b.onclick = () => { S.exw = S.exw.filter(x => x !== +b.dataset.xwdel); commit(true); });
  }
  const toastMsg = t => { try { toast(t); } catch (e) { alert(t); } };
  /* شبكة الولايات: تُقفل حقول ولاية داخل منطقة وتُعلَّم */
  function lockGrid() {
    const g = $("fees-grid"); if (!g) return;
    g.querySelectorAll(".fee").forEach(card => {
      const h = card.querySelector("h4"), id = h ? parseInt(h.textContent, 10) : 0, w = (A().fees || []).find(x => x.id === id); if (!w) return;
      if (w.zn) { card.querySelectorAll("input").forEach(i => { i.disabled = true; }); h.insertAdjacentHTML("beforeend", ` <span class="badge-draft" title="تُدار من المنطقة">${esc(w.zn)}${w.fh ? " · منزل مجاني" : ""}${w.fs ? " · مكتب مجاني" : ""}${w.fo ? " · مجاني ≥" + w.fo : ""}</span>`); }
      if (w.xw) h.insertAdjacentHTML("beforeend", ' <span class="badge-draft" style="background:#c0392b;color:#fff">مستثناة</span>');
      else if (w.xc) h.insertAdjacentHTML("beforeend", ` <span class="badge-draft" style="background:#c0392b;color:#fff">${Object.keys(w.xc).length} بلدية مستثناة</span>`);
    });
  }
  function init() {
    const a = A(); if (!a || a.__znWrap || typeof a.renderFees !== "function") return setTimeout(init, 400);
    a.__znWrap = 1; const host = $("fees-grid"); if (!host) return setTimeout(init, 400);
    if (!$("zn-card")) { const c = document.createElement("div"); c.className = "card"; c.id = "zn-card"; host.closest(".card").parentNode.insertBefore(c, host.closest(".card")); }
    const rf = a.renderFees; a.renderFees = function () { const r = rf.apply(this, arguments); if (!S.inited || (a.fees && a.fees.length && !$("zn-card").innerHTML)) { if (!S.inited) load(); draw(); } lockGrid(); return r; };
    const rs = a.resetFees; a.resetFees = function () { const r = rs.apply(this, arguments); load(); apply(); draw(); return r; };
    /* النشر: wilayas.js يحمل WILAYAS (مع الحقول المشتقة) + SHIPPING */
    a.publishWilayasJs = async function () {
      const cfg = GH.cfg(); if (!cfg || !cfg.token) { toast("⚠️ اضبط GitHub أولاً"); this.openGhSettings(); return false; }
      try {
        apply(); const file = await GH.getFile("assets/js/wilayas.js");
        const content = "/* رسوم التوصيل ومكاتب Yalidine ومناطق التوصيل — يُعدَّل تلقائياً من لوحة التحكم admin.html */\n/* آخر تحديث: " + new Date().toISOString().slice(0, 10) + " */\n" +
          "var WILAYAS = " + JSON.stringify(this.fees) + ";\nvar SHIPPING = " + JSON.stringify(data()) + ";\n";
        await GH.putFile("assets/js/wilayas.js", btoa(unescape(encodeURIComponent(content))), file.sha, "تحديث رسوم التوصيل ومناطقه عبر لوحة التحكم"); return true;
      } catch (err) { console.error(err); toast("❌ تعذّر تحديث ملف رسوم التوصيل على الموقع الحي: " + err.message); return false; }
    };
    if (a.fees && a.fees.length) { load(); draw(); lockGrid(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  return { S, apply, data, load, draw };
})();
