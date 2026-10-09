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
  const S = { zones: [], ex: [], exw: [], inited: false, edit: [], exWil: {}, exSel: {} };
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
#zn-card .zn-hd{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between}#zn-card .zn-hd b{font-size:1.02rem}
#zn-card .zn-r{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end}
#zn-card .zn-r label{display:block;font-size:.8rem;margin:0 0 4px;opacity:.8}#zn-card .zn-c{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}
#zn-card details{margin-top:8px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.05)}#zn-card summary{cursor:pointer;padding:9px 12px;font-weight:800}
#zn-card .zn-l{max-height:230px;overflow:auto;padding:8px 12px 10px;display:grid;gap:3px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));background:rgba(9,24,18,.985);border-top:1px solid rgba(255,255,255,.12);border-radius:0 0 12px 12px}
#zn-card .zn-l label{display:flex;gap:6px;align-items:center;margin:0;font-size:.84rem;opacity:1}#zn-card .zn-l input{width:auto}#zn-card .zn-l label.off{opacity:.45}
#zn-card .zn-tag{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(134,240,106,.16);margin:2px;font-size:.78rem}#zn-card .zn-tag.rd{background:rgba(255,100,100,.18)}#zn-card .zn-tag button{border:0;background:transparent;color:inherit;cursor:pointer;margin-inline-start:4px}
#zn-card .zn-ws{margin-top:6px;font-size:.84rem;line-height:1.9;opacity:.92}#zn-card .zn-x{margin-top:10px;padding:10px 12px;border:1px solid rgba(255,120,120,.25);border-radius:12px;background:rgba(255,100,100,.06)}`;
    document.head.appendChild(st);
  }
  const wl = id => { const w = (A().fees || []).find(x => x.id === id); return w ? `<bdi>${pad(w.id)} ${esc(w.name)}</bdi>` : String(id); };
  const zex = z => ({ whole: S.exw.filter(id => (z.wilayas || []).includes(id)), list: S.ex.filter(e => (z.wilayas || []).includes(e.w)) });
  function zoneHtml(z) {
    const n = (z.wilayas || []).length, open = S.edit.includes(z.id), x = zex(z), m = v => Number(v || 0).toLocaleString("fr-DZ");
    const head = `<div class="zn-hd"><div><b>${esc(z.name)}</b> <span class="zn-tag">🏠 ${z.freeHome ? "مجاني" : m(z.home) + " دج"}</span><span class="zn-tag">🏢 ${z.freeStop ? "مجاني" : m(z.stop) + " دج"}</span>${Number(z.freeOver) > 0 ? `<span class="zn-tag">مجاني ≥ ${m(z.freeOver)}</span>` : ""}<span class="zn-tag">${n} ولاية</span>${x.whole.length + x.list.length ? `<span class="zn-tag rd">${x.whole.length ? x.whole.length + " ولاية و" : ""}${x.list.length} بلدية غير متاحة</span>` : ""}</div>
<div class="zn-c" style="margin:0"><button type="button" class="small" data-zedit="${esc(z.id)}">${open ? "إغلاق التعديل" : "تعديل"}</button><button type="button" class="small warn" data-zdel="${esc(z.id)}">حذف</button></div></div>
<div class="zn-ws">${(z.wilayas || []).map(wl).join("، ") || "لا ولايات بعد — اضغط «تعديل» لاختيارها."}</div>`;
    if (!open) return `<div class="zn-z" data-z="${esc(z.id)}">${head}</div>`;
    const ew = +S.exWil[z.id] || 0, w = (A().fees || []).find(q => q.id === ew), comm = (w && w.communes) || [], sel = S.exSel[z.id] || [];
    return `<div class="zn-z" data-z="${esc(z.id)}">${head}<div class="zn-r" style="margin-top:12px"><div><label>اسم المنطقة</label><input data-f="name" value="${esc(z.name)}"></div>
<div><label>🏠 سعر المنزل (دج)</label><input data-f="home" type="number" min="0" value="${esc(z.home)}"></div><div><label>🏢 سعر المكتب (دج)</label><input data-f="stop" type="number" min="0" value="${esc(z.stop)}"></div>
<div><label>مجاني عند طلب بقيمة ≥ (0 = لا)</label><input data-f="freeOver" type="number" min="0" value="${esc(z.freeOver || 0)}"></div></div>
<div class="zn-c"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-f="freeHome" style="width:auto" ${z.freeHome ? "checked" : ""}> توصيل مجاني للمنزل دائماً</label>
<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-f="freeStop" style="width:auto" ${z.freeStop ? "checked" : ""}> توصيل مجاني للمكتب دائماً</label></div>
<details open data-zd="${esc(z.id)}"><summary>الولايات (${n})</summary><div class="zn-l">${(A().fees || []).map(q => { const o = zoneOf(q.id, z.id); return `<label class="${o ? "off" : ""}" title="${o ? "ضمن منطقة «" + esc(o.name) + "»" : ""}"><input type="checkbox" data-zw="${q.id}" ${(z.wilayas || []).includes(q.id) ? "checked" : ""} ${o ? "disabled" : ""}> <bdi>${pad(q.id)} ${esc(q.name)}</bdi>${o ? " ← " + esc(o.name) : ""}</label>`; }).join("")}</div></details>
<div class="zn-x"><b>التوصيل غير متوفر</b><div class="hint">اختر ولاية من هذه المنطقة ثم البلديات التي لا يصلها التوصيل، أو الولاية كلها.</div>
${n ? `<div class="zn-r" style="margin-top:8px"><div><label>الولاية</label><select data-xw><option value="">— اختر —</option>${(z.wilayas || []).map(id => { const q = (A().fees || []).find(t => t.id === id); return q ? `<option value="${q.id}" ${ew === q.id ? "selected" : ""}>${pad(q.id)} — ${esc(q.name)}</option>` : ""; }).join("")}</select></div>
<div><label>نوع الاستثناء</label><select data-xm><option value="all">لا توصيل نهائياً (منزل ومكتب)</option><option value="home">لا توصيل للمنزل فقط (المكتب متاح)</option></select></div></div>` : '<div class="hint">أضف ولايات للمنطقة أولاً.</div>'}
${w ? `<details open><summary>البلديات (${comm.length}) — حدّد غير المتاحة</summary><div class="zn-l">${comm.map((c, i) => { const e = S.ex.find(t => t.w === w.id && t.c === c); return `<label><input type="checkbox" data-xc="${i}" ${sel.includes(c) ? "checked" : ""} ${e ? "disabled" : ""}> ${esc(c)}${e ? (e.m === "home" ? " (منزل ممنوع)" : " (ممنوعة)") : ""}</label>`; }).join("")}</div></details>
<div class="zn-c"><button type="button" class="small" data-xadd="1">إضافة البلديات المحددة</button><button type="button" class="small gray" data-xwhole="1">الولاية كلها غير متوفرة</button></div>` : ""}
<div style="margin-top:8px">${x.whole.map(id => `<span class="zn-tag rd">${wl(id)} كلها<button type="button" data-xwdel="${id}" title="إزالة">×</button></span>`).join("")}${x.list.map(e => `<span class="zn-tag ${e.m === "all" ? "rd" : ""}">${wl(e.w)} / ${esc(e.c)} ${e.m === "home" ? "(منزل)" : ""}<button type="button" data-xdel="${S.ex.indexOf(e)}" title="إزالة">×</button></span>`).join("") || (x.whole.length ? "" : '<span class="hint">لا استثناءات في هذه المنطقة.</span>')}</div></div></div>`;
  }
  function draw() {
    const host = $("zn-card"); if (!host) return; css(); const a = A(); if (!a || !a.fees || !a.fees.length) { host.innerHTML = ""; return; }
    const inZ = new Set(); S.zones.forEach(z => (z.wilayas || []).forEach(id => inZ.add(id))); const rest = a.fees.filter(w => !inZ.has(w.id));
    host.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem"><div><b style="color:var(--green)">مناطق التوصيل (Zones)</b>
<div class="hint">كل منطقة: سعر للمنزل وسعر للمكتب، شحن مجاني اختياري، وبلديات أو ولايات «التوصيل غير متوفر». اضغط «تعديل» على المنطقة لتغيير ما فيها. الولايات الجديدة (59–69) تُرسَل لشركة التوصيل باسم ولايتها الأم.</div></div>
<button type="button" class="small" data-zadd="1">+ منطقة جديدة</button></div><div class="hint" id="zn-st"></div>
${S.zones.length ? S.zones.map(zoneHtml).join("") : '<div class="hint" style="margin-top:10px">لا مناطق بعد — أضف منطقة.</div>'}
${rest.length ? `<div class="zn-z"><b>ولايات بلا منطقة (${rest.length})</b><div class="zn-ws">${rest.map(w => `<bdi>${pad(w.id)} ${esc(w.name)}</bdi>`).join("، ")} — تبقى بسعرها الفردي الحالي؛ أضفها إلى منطقة من زر «تعديل».</div></div>` : ""}`;
    bind(host);
  }
  function bind(host) {
    host.querySelector("[data-zadd]").onclick = () => { const z = { id: uid(), name: "منطقة " + (S.zones.length + 1), home: 600, stop: 400, freeHome: false, freeStop: false, freeOver: 0, wilayas: [] }; S.zones.push(z); S.edit.push(z.id); commit(true); };
    host.querySelectorAll("[data-zedit]").forEach(b => b.onclick = () => { const id = b.dataset.zedit; S.edit = S.edit.includes(id) ? S.edit.filter(x => x !== id) : S.edit.concat(id); draw(); });
    host.querySelectorAll("[data-zdel]").forEach(b => b.onclick = () => { if (!confirm("حذف هذه المنطقة؟ تبقى أسعار ولاياتها كما هي ويمكنك تعديلها بإضافتها إلى منطقة أخرى.")) return; S.zones = S.zones.filter(z => z.id !== b.dataset.zdel); commit(true); });
    host.querySelectorAll("[data-z]").forEach(card => {
      const z = S.zones.find(x => x.id === card.dataset.z); if (!z) return;
      card.querySelectorAll("[data-f]").forEach(i => i.onchange = () => { const f = i.dataset.f; z[f] = i.type === "checkbox" ? i.checked : (i.type === "number" ? Math.max(0, Number(i.value) || 0) : i.value.trim()); commit(f === "name" || f === "home" || f === "stop" || f === "freeOver" || f === "freeHome" || f === "freeStop"); });
      card.querySelectorAll("[data-zw]").forEach(i => i.onchange = () => { const id = +i.dataset.zw; z.wilayas = (z.wilayas || []).filter(x => x !== id); if (i.checked) z.wilayas.push(id); commit(true); });
      const xw = card.querySelector("[data-xw]"); if (xw) xw.onchange = () => { S.exWil[z.id] = xw.value; S.exSel[z.id] = []; draw(); };
      card.querySelectorAll("[data-xc]").forEach(i => i.onchange = () => { const w = A().fees.find(x => x.id === +S.exWil[z.id]), c = w.communes[+i.dataset.xc], L = (S.exSel[z.id] || []).filter(x => x !== c); if (i.checked) L.push(c); S.exSel[z.id] = L; });
      const add = card.querySelector("[data-xadd]"); if (add) add.onclick = () => { const L = S.exSel[z.id] || []; if (!L.length) return toastMsg("حدّد بلدية واحدة على الأقل"); const m = card.querySelector("[data-xm]").value, w = +S.exWil[z.id]; L.forEach(c => { S.ex = S.ex.filter(e => !(e.w === w && e.c === c)); S.ex.push({ w, c, m }); }); S.exSel[z.id] = []; commit(true); };
      const wh = card.querySelector("[data-xwhole]"); if (wh) wh.onclick = () => { const w = +S.exWil[z.id]; if (w && !S.exw.includes(w)) S.exw.push(w); commit(true); };
      card.querySelectorAll("[data-xdel]").forEach(b => b.onclick = () => { S.ex.splice(+b.dataset.xdel, 1); commit(true); });
      card.querySelectorAll("[data-xwdel]").forEach(b => b.onclick = () => { S.exw = S.exw.filter(x => x !== +b.dataset.xwdel); commit(true); });
    });
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
    const og = $("fees-grid"); if (og) { const oc = og.closest(".card"); if (oc) oc.style.display = "none"; }
    if (!$("zn-card")) { const c = document.createElement("div"); c.className = "card"; c.id = "zn-card"; host.closest(".card").parentNode.insertBefore(c, host.closest(".card")); }
    const rf = a.renderFees; a.renderFees = function () { const r = rf.apply(this, arguments); if (!S.inited || (a.fees && a.fees.length && !$("zn-card").innerHTML)) { if (!S.inited) load(); draw(); } lockGrid(); return r; };
    const rs = a.resetFees; a.resetFees = function () { const r = rs.apply(this, arguments); load(); apply(); draw(); return r; };
    /* النشر: wilayas.js يحمل WILAYAS (مع الحقول المشتقة) + SHIPPING */
    a.publishWilayasJs = async function () {
      const cfg = GH.cfg(); if (!cfg || !cfg.token) { toast("⚠️ اربط النشر أولاً"); this.openGhSettings(); return false; }
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
