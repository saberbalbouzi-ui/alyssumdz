/* أرشيف الطلبات المرسَلة (v1.89.1248): نافذة بكل طلب أُرسل إلى شركة توصيل في يوم معيّن (اليوم افتراضياً): الوقت، الطلب، الزبون، الولاية، الشركة (وتنبيه إن لم تكن الافتراضية)، رقم التتبع، المبلغ، حالته الحالية. تتنقّل بين الأيام وتنزّل CSV أو تنسخ أرقام التتبع.
   المصدر: سجلّ الإرسال المحفوظ عند كل إرسال (AdminYd.sentLog، آخر ~400 إرسال) فلا يلزم أي طلب شبكة. مشتركة لكل العملاء: لا شيء خاص بمتجر. */
const AdminSent = (() => {
  const A = () => (typeof Admin !== "undefined" ? Admin : null), esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const S = { day: "", src: "" };
  const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  function rows(day) {
    const a = A(); if (!a || typeof AdminYd === "undefined" || !AdminYd.sentLog) return [];
    const from = new Date(day + "T00:00:00").getTime(), to = from + 864e5, reg = AdminYd.sentLog() || {}, cos = a.allDeliveryCompanies ? a.allDeliveryCompanies() : {}, def = a.activeCompanyKey ? a.activeCompanyKey() : "";
    return Object.keys(reg).map(tr => Object.assign({ tr }, reg[tr])).filter(x => x.at >= from && x.at < to).sort((x, y) => y.at - x.at).map(x => {
      const i = (a.orders || []).findIndex(o => String(o.id) === String(x.id)), o = i >= 0 ? a.orders[i] : null, raw = o && a.shipRaw && a.shipRaw[o.id] ? a.shipRaw[o.id].raw : "";
      const st = o ? (raw || (a.ST_AR && a.ST_AR[o.status]) || o.status || "") : "طلب محذوف أو غير موجود";
      return { time: hhmm(x.at), id: String(x.id), i, man: !!(o && a.isManualOrder && a.isManualOrder(o)), known: !!o, name: (o && o.name) || x.name || "", wilaya: (o && o.wilaya) || "", co: x.co, coName: (cos[x.co] && cos[x.co].name) || x.co || "—", other: !!(def && x.co && x.co !== def), tr: x.tr, total: o ? Number(o.total) || 0 : 0, st };
    });
  }
  const srcOf = r => (r.known ? (r.man ? "يدوي" : "من الموقع") : "—");
  function csv(day, L) {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', H = ["الوقت", "رقم الطلب", "المصدر", "الزبون", "الولاية", "الشركة", "التتبع", "المبلغ", "الحالة"];
    return "﻿" + [H.map(q).join(",")].concat(L.map(r => [r.time, r.id, srcOf(r), r.name, r.wilaya, r.coName, r.tr, r.total, r.st].map(q).join(","))).join("\r\n");
  }
  function draw() {
    const bg = document.getElementById("sent-bg"); if (!bg) return; const day = S.day, ALL = rows(day), nMan = ALL.filter(r => r.known && r.man).length, nWeb = ALL.filter(r => r.known && !r.man).length, L = S.src === "man" ? ALL.filter(r => r.known && r.man) : S.src === "web" ? ALL.filter(r => r.known && !r.man) : ALL, isToday = day === iso(Date.now());
    const by = {}; L.forEach(r => { by[r.coName] = (by[r.coName] || 0) + 1; });
    const sum = Object.keys(by).map(k => esc(k) + ": <b>" + by[k] + "</b>").join(" · ");
    const nOther = L.filter(r => r.other).length;
    bg.querySelector(".modal").innerHTML = '<button type="button" class="ord-x" id="sent-x" title="إغلاق" aria-label="إغلاق">✕</button><h3 style="margin:0 0 .5rem;padding-inline-end:2.4rem">الطلبات المرسَلة إلى شركات التوصيل</h3>' +
      '<div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.6rem"><button type="button" class="small gray" data-sd="-1" aria-label="اليوم السابق">اليوم السابق</button><input type="date" id="sent-day" value="' + esc(day) + '" max="' + iso(Date.now()) + '" style="max-width:150px;margin:0"><button type="button" class="small gray" data-sd="1"' + (isToday ? " disabled" : "") + ' aria-label="اليوم التالي">اليوم التالي</button>' + (isToday ? "" : '<button type="button" class="small gold" data-sd="today">اليوم</button>') + '</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:0 0 .5rem"><button type="button" class="small ' + (S.src === "" ? "gold" : "gray") + '" data-src="">الكل (' + ALL.length + ')</button><button type="button" class="small ' + (S.src === "web" ? "gold" : "gray") + '" data-src="web">من الموقع (' + nWeb + ')</button><button type="button" class="small ' + (S.src === "man" ? "gold" : "gray") + '" data-src="man">أدخلتُها يدوياً (' + nMan + ')</button></div>' +
      '<div class="hint" style="margin:0 0 .5rem"><b>' + L.length + '</b> طلب أُرسل ' + (isToday ? "اليوم" : "في هذا اليوم") + (sum ? " — " + sum : "") + '</div>' +
      (nOther ? '<div role="note" style="margin:.2rem 0 .6rem;padding:.45rem .7rem;border-radius:12px;border:1px solid #b45309;background:rgba(245,158,11,.12);font-weight:700;font-size:.86rem">' + nOther + ' طلب أُرسل إلى شركة غير الافتراضية (موسوم بـ«غير الافتراضية» في الجدول).</div>' : "") +
      (L.length ? '<div style="overflow:auto;max-height:55vh"><table class="rt m-scroll" style="width:100%;border-collapse:collapse"><thead><tr><th>الوقت</th><th>الطلب</th><th>المصدر</th><th>الزبون</th><th>الولاية</th><th>الشركة</th><th>التتبع</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>' +
        L.map((r, k) => '<tr data-k="' + k + '" style="cursor:pointer"><td data-l="الوقت">' + esc(r.time) + '</td><td data-l="الطلب" dir="ltr">' + esc(r.id.slice(-6)) + '</td><td data-l="المصدر">' + (r.known ? '<span class="o-src ' + (r.man ? "man" : "web") + '">' + (r.man ? "يدوي" : "الموقع") + "</span>" : "—") + '</td><td data-l="الزبون">' + esc(r.name) + '</td><td data-l="الولاية">' + esc(r.wilaya) + '</td><td data-l="الشركة">' + esc(r.coName) + (r.other ? ' <small style="color:#b45309;font-weight:800">(غير الافتراضية)</small>' : "") + '</td><td data-l="التتبع" dir="ltr">' + esc(r.tr) + '</td><td data-l="المبلغ">' + (r.total ? r.total.toLocaleString("fr-DZ") + " دج" : "—") + '</td><td data-l="الحالة">' + esc(r.st) + '</td></tr>').join("") + '</tbody></table></div>' : '<div class="hint" style="padding:1rem 0;text-align:center">لا طلبات أُرسلت ' + (isToday ? "اليوم بعد" : "في هذا اليوم") + '. (يحتفظ السجلّ بآخر 400 إرسال تقريباً.)</div>') +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem"><button type="button" class="small gold" id="sent-csv"' + (L.length ? "" : " disabled") + '>تنزيل CSV</button><button type="button" class="small gray" id="sent-copy"' + (L.length ? "" : " disabled") + '>نسخ أرقام التتبع</button></div>';
    const close = () => bg.remove(); bg.querySelector("#sent-x").onclick = close;
    const set = d => { S.day = d > iso(Date.now()) ? iso(Date.now()) : d; draw(); };
    bg.querySelectorAll("[data-sd]").forEach(b => b.onclick = () => { const v = b.getAttribute("data-sd"); if (v === "today") return set(iso(Date.now())); const d = new Date(S.day + "T00:00:00"); d.setDate(d.getDate() + (+v)); set(iso(d)); });
    bg.querySelectorAll("[data-src]").forEach(b => b.onclick = () => { S.src = b.getAttribute("data-src"); draw(); });
    const di = bg.querySelector("#sent-day"); di.onchange = () => { if (di.value) set(di.value); };
    bg.querySelectorAll("tbody tr[data-k]").forEach(tr => tr.onclick = () => { const r = L[+tr.getAttribute("data-k")]; if (r && r.i >= 0 && A().openOrderPreview) { close(); A().openOrderPreview(r.i); } });
    const bc = bg.querySelector("#sent-csv"); if (bc) bc.onclick = () => { const blob = new Blob([csv(day, L)], { type: "text/csv;charset=utf-8" }), u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "orders-sent-" + day + ".csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); };
    const bk = bg.querySelector("#sent-copy"); if (bk) bk.onclick = () => { const t = L.map(r => r.tr).join("\n"); try { navigator.clipboard.writeText(t).then(() => { if (typeof toast === "function") toast("نُسخ " + L.length + " رقم تتبع"); }, () => { }); } catch (e) { } };
  }
  function open(day) {
    S.day = day || iso(Date.now()); S.src = ""; let bg = document.getElementById("sent-bg"); if (bg) bg.remove();
    bg = document.createElement("div"); bg.id = "sent-bg"; bg.className = "modal-bg open"; bg.dir = "rtl"; bg.innerHTML = '<div class="modal" style="width:min(980px,96vw);max-width:min(980px,96vw);position:relative"></div>';
    bg.addEventListener("click", e => { if (e.target === bg) bg.remove(); }); document.body.appendChild(bg); draw();
  }
  return { open, rows, csv, _S: S };
})();
