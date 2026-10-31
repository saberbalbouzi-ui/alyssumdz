/* مواعيد الرقية الشرعية: يقرأ حجوزات صفحة /ruqya-booking/ من الجدول ruqya_bookings (للمدير فقط)، ويؤكّدها أو يلغيها أو يعلّمها «تمت»،
   مع زر واتساب للتواصل وإعداد عدد الحجوزات المسموحة في الساعة الواحدة (admin_kv 'ruqya' = {cap}). الأسعار تُحسب في الخادم. */
const AdminRuqya = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const KIND = { single: "فردية", couple: "زوج وزوجة", kids: "أبناء", family: "عائلة (كبار)" };
  const ST = { pending: "بانتظار التأكيد", confirmed: "مؤكَّد", done: "تمت", cancelled: "ملغى" };
  const S = { rows: [], filter: "up", cap: 1, err: "", busy: false };
  async function call(path, opt) {
    const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة، أعد تسجيل الدخول");
    const r = await fetch(API.sb.url("/rest/v1/" + path), Object.assign({ headers: Object.assign(API.sb.headers(t), { Prefer: "return=representation" }) }, opt || {}));
    const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("تعذّر الاتصال (" + r.status + ")")); return j;
  }
  async function load() {
    S.err = "";
    try {
      S.rows = await call("ruqya_bookings?select=*&order=day.asc,slot.asc&limit=500");
      const k = await call("admin_kv?select=value&key=eq.ruqya"); S.cap = Math.max(1, Number(k && k[0] && k[0].value && k[0].value.cap) || 1);
    } catch (e) { S.err = e.message; }
  }
  const today = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  function dayName(d) { try { return new Date(d + "T12:00:00").toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" }); } catch (_) { return d; } }
  function draw() {
    const host = $("ruqya-content"); if (!host) return;
    const up = S.rows.filter(r => r.day >= today() && r.status !== "cancelled"), pend = S.rows.filter(r => r.status === "pending").length;
    let list = S.rows;
    if (S.filter === "up") list = up; else if (S.filter === "pending") list = S.rows.filter(r => r.status === "pending"); else if (S.filter === "past") list = S.rows.filter(r => r.day < today());
    const f = (k, n) => '<button class="rq-fb' + (S.filter === k ? " on" : "") + '" data-rq="f" data-k="' + k + '">' + n + '</button>';
    let h = '<div class="card" style="padding:16px"><h2 style="margin:0 0 6px">مواعيد الرقية الشرعية</h2><div class="hint">الحجوزات القادمة من صفحة الحجز العامة. اضغط «تأكيد» ثم راسل صاحب الحجز بواتساب.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' + f("up", "القادمة (" + up.length + ")") + f("pending", "بانتظار التأكيد (" + pend + ")") + f("past", "السابقة") + f("all", "الكل") +
      '<span style="flex:1"></span><label style="display:flex;align-items:center;gap:6px;font-weight:700">الحجوزات في الساعة الواحدة <input type="number" id="rq-cap" min="1" max="20" value="' + S.cap + '" style="width:70px"></label><button class="btn" data-rq="cap">حفظ</button></div>';
    if (S.err) h += '<div class="warn" style="margin:8px 0">' + esc(S.err) + '</div>';
    if (!list.length) h += '<div class="hint">لا توجد حجوزات هنا.</div>';
    else {
      h += '<div style="overflow-x:auto"><table class="rt" style="min-width:880px"><thead><tr><th>الموعد</th><th>الاسم</th><th>الهاتف</th><th>البلدية</th><th>الجلسة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>';
      list.forEach(r => {
        const wa = "https://wa.me/213" + String(r.phone).replace(/^0/, "") + "?text=" + encodeURIComponent("السلام عليكم " + r.name + "، بخصوص موعدك للرقية الشرعية يوم " + dayName(r.day) + " الساعة " + r.slot + (r.status === "confirmed" ? " (مؤكَّد)." : "."));
        h += '<tr><td data-l="الموعد"><b>' + esc(dayName(r.day)) + '</b><br>' + esc(r.slot) + (r.slots > 1 ? ' (' + r.slots + ' جلسات)' : '') + '</td><td data-l="الاسم">' + esc(r.name) + '<br><small>' + (r.first_time ? "أول مرة" : "مسجَّل") + '</small></td>' +
          '<td data-l="الهاتف" dir="ltr">' + esc(r.phone) + '</td><td data-l="البلدية">' + esc(r.commune || "—") + (r.wilaya ? '<br><small>' + esc(r.wilaya) + '</small>' : '') + '</td>' +
          '<td data-l="الجلسة">' + esc(KIND[r.kind] || r.kind) + '<br><small>' + r.persons + ' أفراد · ' + r.sessions + ' جلسة</small></td>' +
          '<td data-l="المبلغ">' + money(r.total) + (r.pack_price ? '<br><small>يشمل الباقة 4: ' + money(r.pack_price) + '</small>' : '') + '</td><td data-l="الحالة">' + esc(ST[r.status] || r.status) + '</td>' +
          '<td data-l="إجراء" style="white-space:nowrap"><a class="btn gray" target="_blank" rel="noopener" href="' + wa + '">واتساب</a> ' +
          (r.status === "pending" ? '<button class="btn" data-rq="st" data-id="' + r.id + '" data-v="confirmed">تأكيد</button> ' : '') +
          (r.status === "confirmed" ? '<button class="btn" data-rq="st" data-id="' + r.id + '" data-v="done">تمت</button> ' : '') +
          (r.status !== "cancelled" && r.status !== "done" ? '<button class="btn warn" data-rq="st" data-id="' + r.id + '" data-v="cancelled">إلغاء</button>' : '') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    host.innerHTML = h + '</div><style>.rq-fb{border:1px solid #ffffff44;background:transparent;color:inherit;border-radius:12px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer}.rq-fb.on{background:var(--g-mint,#e2fe17);color:#1f2123;border-color:transparent}</style>';
  }
  async function render() { const host = $("ruqya-content"); if (!host) return; host.innerHTML = '<div class="hint">جارٍ التحميل…</div>'; await load(); draw(); }
  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest("[data-rq]"); if (!b || !$("ruqya-content") || !$("ruqya-content").contains(b)) return;
    const a = b.getAttribute("data-rq");
    if (a === "f") { S.filter = b.getAttribute("data-k"); draw(); }
    else if (a === "st") {
      const v = b.getAttribute("data-v"); if (v === "cancelled" && !confirm("إلغاء هذا الحجز؟ سيتحرر الموعد.")) return;
      try { await call("ruqya_bookings?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "PATCH", body: JSON.stringify({ status: v }) }); await load(); draw(); } catch (er) { S.err = er.message; draw(); }
    } else if (a === "cap") {
      const n = Math.max(1, Math.min(20, parseInt($("rq-cap").value, 10) || 1));
      try { await call("admin_kv?on_conflict=key", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ key: "ruqya", value: { cap: n } }) }); S.cap = n; S.err = ""; draw(); } catch (er) { S.err = er.message; draw(); }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Admin === "undefined" || Admin._ruqyaTabWrapped) return;
    const original = Admin.tab;
    Admin.tab = function (t, btn) { const r = original.call(this, t, btn); const el = $("tab-ruqya"); if (el) el.classList.toggle("hidden", t !== "ruqya"); if (t === "ruqya") render(); return r; };
    Admin._ruqyaTabWrapped = true;
  });
  return { render, rows: () => S.rows, pending: () => S.rows.filter(r => r.status === "pending").length };
})();
