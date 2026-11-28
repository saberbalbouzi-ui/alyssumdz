/* «الطلبات المسجلة» حسب التصميم: رأس، أزرار (بداية جديدة/الأرشيف/الفترة الحالية)، أربع بطاقات إحصاء، بطاقة شركات التوصيل (الكل + كل شركة)،
   بحث + «فلاتر»، صف فلاتر (الحالة/الولاية/من/إلى)، شريط ملخص، وجدول موحَّد (التتبع+نسخ، تاريخ التسجيل، العميل/الولاية، الحالة، قائمة ⋮).
   يقرأ Admin.shippedOrders() وAdmin.shipRaw فقط؛ بقية أدوات الصفحة القديمة (بطاقات الشركات، التنبيهات، الإعدادات) تبقى تحت زر «أدوات الشركة والتنبيهات». */
(function () {
  const $ = id => document.getElementById(id), T = s => (window.AdminI18n && AdminI18n.t) ? AdminI18n.t(s) : s;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { co: "", st: "", wil: "", from: "", to: "", q: "", sel: new Set(), tools: false, adv: false, lim: 25 };
  const A = () => (typeof Admin !== "undefined" ? Admin : null);
  const I = {
    box: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
    arch: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    chv: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>',
    ret: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
    srch: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    flt: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
    hour: '<svg viewBox="0 0 24 24"><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>',
    coin: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>'
  };
  /* تصنيف الحالة: مسلَّم / مرتجع / في المركز (وصل محطة الشركة) / قيد التوصيل / قيد التجهيز */
  function cls(o, raw) {
    if (o.status === "livree") return "ok";
    if (o.status === "echec" || o.status === "annulee") return "ret";
    if (o.status === "expediee") return /station|centre|stop|agence|bureau|مركز|مكتب/i.test(String(raw || "")) ? "ctr" : "way";
    return "prep";
  }
  const LBL = { ok: "مُسلَّم", ret: "مرتجع", ctr: "في المركز", way: "قيد التوصيل", prep: "قيد التجهيز" };
  const IC = { ok: I.ok, ret: I.ret, ctr: I.box, way: I.truck, prep: I.hour };
  const dz = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ");
  const ymd = d => { const x = new Date(d); return isNaN(x) ? "" : x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const FD = t => String(t == null ? "" : t).normalize("NFD").replace(/[̀-ًͯ-ٰٟ]/g, "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  function rowsAll() { const a = A(); if (!a || !a.shippedOrders) return []; const raw = a.shipRaw || {}; return a.shippedOrders().map(x => Object.assign({}, x, { raw: (raw[x.o.id] || {}).raw || "", c: cls(x.o, (raw[x.o.id] || {}).raw) })); }
  function filtered(all) {
    const q = FD(S.q.trim());
    return all.filter(r => (!S.co || r.t.company === S.co) && (!S.st || r.c === S.st) && (!S.wil || r.o.wilaya === S.wil) && (!S.from || ymd(r.o.date) >= S.from) && (!S.to || ymd(r.o.date) <= S.to) && (!q || FD([r.t.tracking, r.o.name, r.o.phone, r.o.id, r.o.wilaya, r.o.commune].join(" ")).includes(q)));
  }
  function build() {
    const tab = $("tab-shipped"); if (!tab || $("sh-soft")) return;
    const box = document.createElement("div"); box.id = "sh-soft";
    box.innerHTML = '<div class="ord-head"><span class="ord-ic">' + I.box + '</span><div><h2>' + T("الطلبات المسجلة") + "</h2><p>" + T("متابعة حالة الطرود المسجلة لدى شركات التوصيل") + "</p></div></div>" +
      '<div class="sh-ab"><button type="button" data-sh="new">' + I.undo + "<span>" + T("بداية جديدة") + '</span></button><button type="button" data-sh="arch">' + I.arch + "<span>" + T("الأرشيف") + '</span></button><button type="button" data-sh="per">' + I.cal + '<span id="sh-per">' + T("الفترة الحالية") + "</span><i>" + I.chv + "</i></button></div>" +
      '<div class="ord-stats sh-stats"><div class="os">' + I.box + "<span>" + T("إجمالي الطرود") + '</span><b id="shs-t">0</b></div><div class="os os-g">' + I.ok + "<span>" + T("مُسلَّم") + '</span><b id="shs-ok">0</b></div><div class="os os-b">' + I.truck + "<span>" + T("قيد التوصيل") + '</span><b id="shs-way">0</b></div><div class="os os-r">' + I.ret + "<span>" + T("مرتجع") + '</span><b id="shs-ret">0</b></div></div>' +
      '<div class="card sh-cos"><div class="sh-cosh">' + I.truck + "<b>" + T("شركات التوصيل") + '</b></div><div id="sh-chips"></div></div>' +
      '<div class="sh-srch"><label class="sh-inp"><i>' + I.srch + '</i><input id="sh-q" type="search" placeholder="' + esc(T("ابحث بالتتبع أو الاسم أو الهاتف أو رقم الطلب...")) + '"></label><button type="button" class="sh-flt" data-sh="tools">' + I.flt + "<span>" + T("فلاتر") + "</span></button></div>" +
      '<div class="sh-fl"><label class="sh-sel"><select id="sh-st"><option value="">' + T("كل الحالات") + "</option>" + Object.keys(LBL).map(k => '<option value="' + k + '">' + T(LBL[k]) + "</option>").join("") + '</select><u>' + I.chv + '</u></label><label class="sh-sel"><select id="sh-wil"><option value="">' + T("كل الولايات") + '</option></select><u>' + I.chv + '</u></label><label class="sh-sel sh-dt"><span>' + T("من") + '</span><input id="sh-from" type="date"></label><label class="sh-sel sh-dt"><span>' + T("إلى") + '</span><input id="sh-to" type="date"></label></div>' +
      '<div class="sh-tools" id="sh-tools" hidden></div>' +
      '<div class="sh-sum" id="sh-sum"></div>' +
      '<div id="sh-selbar" class="sh-selbar" hidden></div>' +
      '<div class="card sh-tbc"><table class="sh-t" data-nomc="1"><thead><tr><th><input type="checkbox" id="sh-all"></th><th>' + T("التتبع") + "</th><th>" + T("تاريخ التسجيل") + "</th><th>" + T("العميل / الولاية") + "</th><th>" + T("الحالة") + '</th><th></th></tr></thead><tbody id="sh-body"></tbody></table><div id="sh-empty" class="sh-empty" hidden></div><button type="button" id="sh-more" class="sh-more" data-sh="more" hidden></button></div>' +
      '<button type="button" class="sh-advb" data-sh="adv">' + I.gear + "<span>" + T("أدوات الشركة والتنبيهات") + "</span><i>" + I.chv + "</i></button>";
    tab.insertBefore(box, tab.firstChild); tab.classList.add("sh-soft-on");
    // الأدوات الثانوية (أزرار الصفحة القديمة) داخل «فلاتر»
    const tools = $("sh-tools"); ["ship-sent-btn", "ship-sync-btn", "ship-csv-btn", "ship-prep-btn", "ship-bord-btn", "ship-imp-btn", "ship-fees-btn", "ship-recent-btn", "ship-rec-btn"].forEach(id => { const e = $(id); if (e) tools.appendChild(e); });
    box.addEventListener("click", onClick); box.addEventListener("input", onInput); box.addEventListener("change", onInput);
  }
  function onInput(e) {
    const t = e.target; if (!t) return;
    if (t.id === "sh-q") { S.q = t.value; S.lim = 25; const o = $("ship-q"); if (o) o.value = t.value; draw(); }
    else if (t.id === "sh-st") { S.st = t.value; S.lim = 25; draw(); } else if (t.id === "sh-wil") { S.wil = t.value; S.lim = 25; draw(); }
    else if (t.id === "sh-from") { S.from = t.value; draw(); } else if (t.id === "sh-to") { S.to = t.value; draw(); }
    else if (t.id === "sh-all") { const L = filtered(rowsAll()).slice(0, S.lim); L.forEach(r => t.checked ? S.sel.add(r.t.tracking) : S.sel.delete(r.t.tracking)); draw(); }
    else if (t.matches && t.matches(".sh-ck")) { t.checked ? S.sel.add(t.dataset.t) : S.sel.delete(t.dataset.t); selbar(); }
  }
  function toast(m) { try { window.toast && window.toast(m); } catch (e) { } }
  function copy(txt) { try { navigator.clipboard.writeText(txt); toast("✅ " + T("نُسخ")); } catch (e) { const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (x) { } t.remove(); toast("✅ " + T("نُسخ")); } }
  function menu(btn, r) {
    document.querySelectorAll(".sh-menu").forEach(m => m.remove()); const a = A(); const m = document.createElement("div"); m.className = "sh-menu";
    m.innerHTML = '<button data-m="prev">' + T("معاينة الطلب") + '</button><button data-m="insp">' + T("فحص الطرد عند الشركة") + '</button><button data-m="copy">' + T("نسخ رقم التتبع") + "</button>";
    document.body.appendChild(m); const b = btn.getBoundingClientRect(); m.style.top = Math.min(innerHeight - 140, b.bottom + 4 + scrollY) + "px"; m.style.left = Math.max(8, b.left + scrollX) + "px";
    m.addEventListener("click", ev => { const k = ev.target.closest("[data-m]"); if (!k) return; m.remove(); try { if (k.dataset.m === "prev") a.openOrderPreview(r.i); else if (k.dataset.m === "insp") a.coInspect(r.i); else copy(r.t.tracking); } catch (e) { } });
    setTimeout(() => document.addEventListener("click", function h(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("click", h); } }), 0);
  }
  function onClick(e) {
    const b = e.target.closest("[data-sh],[data-trk],[data-kb],[data-co]"); if (!b) return; const a = A(), AR = typeof AdminArchive !== "undefined" ? AdminArchive : null;
    if (b.dataset.co !== undefined) { S.co = b.dataset.co; S.lim = 25; if (S.co && a) { try { a._shipCo = S.co; a.renderShipped(); } catch (x) { } } draw(); return; }
    if (b.dataset.trk) { copy(b.dataset.trk); return; }
    if (b.dataset.kb) { const r = rowsAll().find(x => x.t.tracking === b.dataset.kb); if (r) menu(b, r); return; }
    const k = b.dataset.sh;
    if (k === "new" || k === "per") { try { AR.show(); } catch (x) { } } else if (k === "arch") { try { AR.browse(); } catch (x) { } }
    else if (k === "tools") { S.tools = !S.tools; $("sh-tools").hidden = !S.tools; b.classList.toggle("on", S.tools); }
    else if (k === "more") { S.lim += 25; draw(); }
    else if (k === "adv") { S.adv = !S.adv; $("tab-shipped").classList.toggle("sh-adv-on", S.adv); b.classList.toggle("open", S.adv); }
    else if (k === "csvsel") { const rows = rowsAll().filter(r => S.sel.has(r.t.tracking)); const csv = "﻿tracking,date,name,wilaya,status,total\n" + rows.map(r => [r.t.tracking, ymd(r.o.date), r.o.name, r.o.wilaya, LBL[r.c], r.o.total].map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n"); const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" })), l = document.createElement("a"); l.href = u; l.download = "shipped.csv"; document.body.appendChild(l); l.click(); l.remove(); }
    else if (k === "copysel") { copy([...S.sel].join("\n")); } else if (k === "clrsel") { S.sel.clear(); draw(); }
  }
  function selbar() { const s = $("sh-selbar"); if (!s) return; s.hidden = !S.sel.size; if (S.sel.size) s.innerHTML = "<b>" + S.sel.size + "</b> " + T("محدّد") + ' <button type="button" data-sh="copysel">' + T("نسخ التتبع") + '</button><button type="button" data-sh="csvsel">CSV</button><button type="button" data-sh="clrsel">' + T("إلغاء التحديد") + "</button>"; }
  function draw() {
    const tab = $("tab-shipped"); if (!tab || !tab.offsetParent) return; build(); const a = A(); if (!a) return;
    const all = rowsAll(), set = (id, v) => { const e = $(id); if (e && e.textContent !== String(v)) e.textContent = v; };
    const cnt = k => all.filter(r => r.c === k).length;
    set("shs-t", all.length); set("shs-ok", cnt("ok")); set("shs-way", cnt("way") + cnt("ctr") + cnt("prep")); set("shs-ret", cnt("ret"));
    const AR = typeof AdminArchive !== "undefined" ? AdminArchive : null; if (AR && AR.S) { const p = $("sh-per"); if (p) { const want = T("الفترة الحالية"); if (p.textContent !== want) p.textContent = want; p.parentElement.title = AR.S.cut ? new Date(AR.S.cut).toISOString().slice(0, 10) : ""; } }
    // شركات التوصيل: «الكل» + كل شركة
    const by = {}; all.forEach(r => { by[r.t.company] = (by[r.t.company] || 0) + 1; }); const keys = Object.keys(by).sort((x, y) => by[y] - by[x]), top = 4, lbl = k => (a.coLabel ? a.coLabel(k) : k);
    const chip = (k, l, n) => '<button type="button" data-co="' + esc(k) + '" class="' + (S.co === k ? "on" : "") + '"><span>' + esc(l) + "</span><b>" + n + "</b></button>";
    const ch = $("sh-chips"); const html = chip("", T("الكل"), all.length) + keys.slice(0, top).map(k => chip(k, lbl(k), by[k])).join("") + (keys.length > top ? '<details class="sh-mc"><summary>•••</summary><div>' + keys.slice(top).map(k => chip(k, lbl(k), by[k])).join("") + "</div></details>" : ""); if (ch && ch.dataset.h !== html) { ch.innerHTML = html; ch.dataset.h = html; }
    // قائمة الولايات
    const ws = [...new Set(all.map(r => r.o.wilaya).filter(Boolean))].sort(), sw = $("sh-wil"); if (sw && sw.dataset.n !== ws.join("|")) { sw.dataset.n = ws.join("|"); sw.innerHTML = '<option value="">' + T("كل الولايات") + "</option>" + ws.map(w => '<option value="' + esc(w) + '"' + (S.wil === w ? " selected" : "") + ">" + esc(w) + "</option>").join(""); }
    const L = filtered(all), sh = L.slice(0, S.lim), ok = L.filter(r => r.c === "ok").length, rt = L.filter(r => r.c === "ret").length, wy = L.length - ok - rt, pct = ok + rt ? Math.round(ok / (ok + rt) * 100) : 0;
    $("sh-sum").innerHTML = '<span class="sm-t"><i>' + I.box + "</i><b>" + L.length + "</b> " + T("طرد") + '</span><span class="sm-o"><i>' + I.ok + "</i><b>" + ok + "</b> " + T("ناجح") + " " + pct + '%</span><span class="sm-w"><i>' + I.hour + "</i><b>" + wy + "</b> " + T("قيد") + '</span><span class="sm-r"><i>' + I.ret + "</i><b>" + rt + "</b> " + T("مرتجع") + '</span><span class="sm-v"><i>' + I.coin + "</i><b>" + dz(L.reduce((t, r) => t + (Number(r.o.total) || 0), 0)) + "</b> " + T("دج") + "</span>";
    const tb = $("sh-body"), rowHtml = r => '<tr><td><input type="checkbox" class="sh-ck" data-t="' + esc(r.t.tracking) + '"' + (S.sel.has(r.t.tracking) ? " checked" : "") + '></td><td class="trk" dir="ltr"><b>' + esc(r.t.tracking) + '</b><button type="button" data-trk="' + esc(r.t.tracking) + '" aria-label="copy">' + I.copy + '</button></td><td class="dt"><b>' + esc(ymd(r.o.date)) + "</b><small>" + I.clock + esc(new Date(r.o.date).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })) + '</small></td><td class="cu"><b>' + esc(r.o.name || "") + "</b><small>" + I.pin + esc(r.o.wilaya || "") + '</small></td><td><span class="st st-' + r.c + '">' + IC[r.c] + "<span>" + T(LBL[r.c]) + '</span></span></td><td><button type="button" class="kb" data-kb="' + esc(r.t.tracking) + '" aria-label="menu">' + I.dots + "</button></td></tr>";
    const h2 = sh.map(rowHtml).join(""); if (tb.dataset.h !== h2) { tb.innerHTML = h2; tb.dataset.h = h2; }
    const em = $("sh-empty"); em.hidden = !!sh.length; em.textContent = all.length ? T("لا نتائج مطابقة") : T("لا توجد طلبات مسجلة بعد — أكّد طلباً جديداً ليُرسل إلى شركة التوصيل"); const mo = $("sh-more"); mo.hidden = L.length <= sh.length; if (!mo.hidden) mo.textContent = T("عرض المزيد") + " (" + (L.length - sh.length) + ")";
    const ca = $("sh-all"); if (ca) ca.checked = !!sh.length && sh.every(r => S.sel.has(r.t.tracking)); selbar();
  }
  const go = () => { try { draw(); } catch (e) { console.warn("sh-soft", e); } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
  setInterval(go, 1500);
  window.AdminShippedSoft = { draw: go, S };
})();
