/* مواعيد الرقية الشرعية: يقرأ حجوزات صفحة /ruqya-booking/ من الجدول ruqya_bookings (للمدير فقط)، ويؤكّدها أو يلغيها أو يعلّمها «تمت»،
   مع زر واتساب للتواصل وإعداد عدد الحجوزات المسموحة في الساعة الواحدة (admin_kv 'ruqya' = {cap}). الأسعار تُحسب في الخادم. */
const AdminRuqya = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const KIND = { single: "فردية", couple: "زوج وزوجة", kids: "أبناء", family: "عائلة (كبار)" };
  const ST = { pending: "بانتظار التأكيد", confirmed: "مؤكَّد", done: "تمت", cancelled: "ملغى" };
  const S = { rows: [], filter: "up", cap: 1, err: "", busy: false, q: "", found: null, msg: "", pat: null, visits: [], perr: "" };
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
  /* ── بحث في كل السجل (الاسم أو الهاتف) من الخادم، لا في آخر 500 فقط ── */
  let qT = 0;
  async function search() {
    const q = S.q.trim().replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
    if (q.length < 2) { S.found = null; draw(); return; }
    const dg = q.replace(/\D/g, ""), conds = ["name.ilike.*" + q + "*"]; if (dg.length >= 3) conds.push("phone.ilike.*" + dg.replace(/^(00213|213)/, "0") + "*");
    try { S.found = await call("ruqya_bookings?select=*&or=" + encodeURIComponent("(" + conds.join(",") + ")") + "&order=day.desc,slot.desc&limit=300"); S.err = ""; } catch (e) { S.err = e.message; S.found = []; }
    draw(); const i = $("rq-q"); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) { } }
  }
  /* ── استيراد عملاء من تقويم Google (.ics أو .zip فيه ملف ics): الاسم من عنوان الموعد والهاتف من الموقع/الوصف؛ كل (هاتف + اسم) سجلّ واحد «مسجَّل» بآخر موعد ── */
  const phoneNorm = v => { let d = String(v || "").replace(/\D/g, ""); if (/^00213/.test(d)) d = "0" + d.slice(5); else if (/^213/.test(d) && d.length >= 12) d = "0" + d.slice(3); else if (d.length === 9 && /^[567]/.test(d)) d = "0" + d; return d; };
  const phoneOk = d => /^0[567]\d{8}$/.test(d) || /^0[2-4]\d{7}$/.test(d);
  async function unzipIcs(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(); let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("الملف ليس zip صالحاً");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true), name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
      if (!/\.ics$/i.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.subarray(start, start + csize);
      if (method === 0) return dec.decode(raw);
      const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(raw); w.close(); return dec.decode(await new Response(ds.readable).arrayBuffer());
    }
    throw new Error("لا يوجد ملف .ics داخل الـ zip");
  }
  function parseIcs(text) {
    const unesc = v => v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"), P = new Map(); let bad = 0, none = 0;
    String(text).replace(/\r?\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1).forEach(blk => {
      const d = {}; blk.split("END:VEVENT")[0].split(/\r?\n/).forEach(l => { const i = l.indexOf(":"); if (i > 0) d[l.slice(0, i).split(";")[0]] = unesc(l.slice(i + 1)); });
      let name = String(d.SUMMARY || "").replace(/\s+/g, " ").trim().replace(/(?:\s*(?:رقية|رقيه))?\s*\d{1,2}\s*$/, "").trim().replace(/\s*(?:رقية|رقيه)\s*$/, "").trim(); if (name.length < 2 || !d.DTSTART) return;
      const src = (d.LOCATION || "") + " " + String(d.DESCRIPTION || "").split("http")[0] + " " + (d.SUMMARY || ""), raw = (src.match(/\+?\d[\d\s.\-]{7,16}\d/g) || []).map(x => phoneNorm(x)), ok = raw.filter(phoneOk);
      if (!ok.length) { raw.length ? bad++ : none++; return; }
      const ds = d.DTSTART; let dt; if (/^\d{8}$/.test(ds)) dt = new Date(ds.slice(0, 4) + "-" + ds.slice(4, 6) + "-" + ds.slice(6, 8) + "T10:00:00+01:00"); else { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/.exec(ds); if (!m) return; dt = new Date(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + (m[7] ? "Z" : "+01:00")); }
      if (isNaN(dt)) return; const loc = dt.toLocaleString("sv-SE", { timeZone: "Africa/Algiers" }), key = ok[0] + "|" + name.replace(/\s/g, "");
      const r = P.get(key) || { n: 0, last: "", name, phone: ok[0], v: [] }; r.n++; if (loc > r.last) { r.last = loc; r.name = name; } const note = String(d.DESCRIPTION || "").replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3900); const vd = loc.slice(0, 10), vs = loc.slice(11, 16); if (!r.v.some(x => x.day === vd && x.slot === vs)) r.v.push({ day: vd, slot: vs, note }); P.set(key, r);
    });
    return { people: [...P.values()], bad, none };
  }
  async function importIcs(file) {
    S.busy = true; S.msg = "⏳ جارٍ قراءة الملف…"; draw();
    try {
      const buf = await file.arrayBuffer(), text = /\.zip$/i.test(file.name) || new Uint8Array(buf, 0, 2)[0] === 0x50 ? await unzipIcs(buf) : new TextDecoder().decode(buf), R = parseIcs(text);
      if (!R.people.length) throw new Error("لم أجد مواعيد بأسماء وأرقام هاتف صالحة في الملف");
      const have = new Set(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_bookings?select=phone,name&order=id.asc&limit=1000&offset=" + off); part.forEach(x => have.add(x.phone + "|" + String(x.name).replace(/\s/g, ""))); if (part.length < 1000) break; }
      const t = today(), rows = R.people.filter(x => !have.has(x.phone + "|" + x.name.replace(/\s/g, ""))).map(x => { const day = x.last.slice(0, 10); return { day, slot: x.last.slice(11, 16), slots: 1, registered: true, first_time: false, name: x.name.slice(0, 120), phone: x.phone, kind: "single", persons: 1, sessions: Math.min(Math.max(x.n, 1), 8), session_price: 0, pack_price: 0, total: 0, terms: true, status: day >= t ? "confirmed" : "done", note: "مستورد من تقويم Google · " + x.n + " موعداً مسجّلاً" }; });
      let done = 0; for (let i = 0; i < rows.length; i += 200) { await call("ruqya_bookings", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "return=minimal" }), body: JSON.stringify(rows.slice(i, i + 200)) }); done += Math.min(200, rows.length - i); S.msg = "⏳ أُضيف " + done + " من " + rows.length + "…"; draw(); }
      S.msg = "✅ أُضيف " + rows.length + " عميل مسجَّل" + (R.people.length - rows.length ? " (وتخطّيتُ " + (R.people.length - rows.length) + " موجودين مسبقاً)" : "") + ". مواعيد بلا رقم هاتف: " + R.none + "، وبرقم غير صحيح (لم تُضَف): " + R.bad + ".";
      /* زيارات كل مريض (موعد التقويم = زيارة، ووصفه = ملاحظات المتابعة) */
      const idOf = new Map(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_bookings?select=id,phone,name&order=id.asc&limit=1000&offset=" + off); part.forEach(x => { const k = x.phone + "|" + String(x.name).replace(/\s/g, ""); if (!idOf.has(k)) idOf.set(k, x.id); }); if (part.length < 1000) break; }
      const haveV = new Set(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_visits?select=booking_id,day,slot&order=id.asc&limit=1000&offset=" + off); part.forEach(x => haveV.add(x.booking_id + "|" + x.day + "|" + (x.slot || ""))); if (part.length < 1000) break; }
      const vrows = []; R.people.forEach(x => { const id = idOf.get(x.phone + "|" + x.name.replace(/\s/g, "")); if (!id) return; x.v.sort((a, b) => (a.day + a.slot).localeCompare(b.day + b.slot)).forEach((v, i) => { if (!haveV.has(id + "|" + v.day + "|" + v.slot)) vrows.push({ booking_id: id, day: v.day, slot: v.slot, progress: i === 0 ? "new" : "", note: v.note, followup: "" }); }); });
      let vd = 0; for (let i = 0; i < vrows.length; i += 300) { await call("ruqya_visits", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "return=minimal" }), body: JSON.stringify(vrows.slice(i, i + 300)) }); vd += Math.min(300, vrows.length - i); S.msg = "⏳ أُضيفت " + vd + " من " + vrows.length + " زيارة…"; draw(); }
      S.msg += " · " + vrows.length + " زيارة مع ملاحظاتها.";
      await load();
    } catch (e) { S.msg = "❌ " + e.message; }
    S.busy = false; draw();
  }
  /* ── صفحة المريض: الاسم والمنطقة والزيارات (تاريخ، تطور الحالة، المتابعة) ── */
  const PROG = { "": "—", new: "زيارة أولى", better: "تحسّن", same: "مستقرة", worse: "تراجع", done: "انتهت الحالة" };
  const PCOL = { new: "#60a5fa", better: "#86efac", same: "#fde047", worse: "#fca5a5", done: "#c4b5fd" };
  async function openPatient(id) {
    const r = (S.found || []).concat(S.rows).find(x => String(x.id) === String(id)); if (!r) return;
    S.pat = r; S.visits = []; S.perr = ""; draw();
    try { S.visits = await call("ruqya_visits?select=*&booking_id=eq." + encodeURIComponent(r.id) + "&order=day.desc,slot.desc&limit=500"); } catch (e) { S.perr = e.message; } draw();
  }
  function patientHtml() {
    const r = S.pat, vs = S.visits, first = vs.length ? vs[vs.length - 1].day : r.day, last = vs.length ? vs[0].day : r.day;
    const wa = "https://wa.me/213" + String(r.phone).replace(/^0/, "");
    const opts = k => Object.keys(PROG).map(x => '<option value="' + x + '"' + (x === k ? " selected" : "") + ">" + PROG[x] + "</option>").join("");
    const card = v => '<div class="card" style="padding:12px;margin:10px 0;border-inline-start:4px solid ' + (PCOL[v.progress] || "#ffffff44") + '" data-vid="' + v.id + '"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc(dayName(v.day)) + (v.slot ? " · " + esc(v.slot) : "") + '</b><span style="flex:1"></span><select data-vf="progress">' + opts(v.progress) + '</select></div>' +
      '<label style="display:block;margin-top:8px;font-weight:700">تطور الحالة / ملاحظات الزيارة</label><textarea data-vf="note" rows="3" style="width:100%">' + esc(v.note) + '</textarea>' +
      '<label style="display:block;margin-top:8px;font-weight:700">المتابعة (التوصيات والموعد القادم)</label><textarea data-vf="followup" rows="2" style="width:100%">' + esc(v.followup) + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-rq="vsave" data-id="' + v.id + '">حفظ</button><button class="btn warn" data-rq="vdel" data-id="' + v.id + '">حذف الزيارة</button></div></div>';
    return '<div class="card" style="padding:16px"><button class="btn gray" data-rq="pback">← رجوع للمواعيد</button>' +
      '<h2 style="margin:12px 0 4px">ملف المريض</h2>' + (S.perr ? '<div class="warn" style="margin:8px 0">' + esc(S.perr) + '</div>' : "") + (S.msg ? '<div class="hint">' + esc(S.msg) + '</div>' : "") +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0"><div><label style="font-weight:700">الاسم</label><input id="rq-pn" value="' + esc(r.name) + '"></div><div><label style="font-weight:700">المنطقة</label><input id="rq-pr" value="' + esc(r.commune || "") + '" placeholder="البلدية / الولاية"></div><div><label style="font-weight:700">الهاتف</label><div dir="ltr" style="padding:8px 0"><b>' + esc(r.phone) + '</b> · <a target="_blank" rel="noopener" href="' + wa + '">واتساب</a></div></div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-rq="psave">حفظ بيانات المريض</button><span class="hint">أول زيارة: ' + esc(first) + ' · آخر زيارة: ' + esc(last) + ' · عدد الزيارات: ' + vs.length + '</span></div>' +
      '<h3 style="margin:18px 0 6px">＋ زيارة جديدة</h3><div class="card" style="padding:12px"><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" id="rq-vd" value="' + today() + '"><input type="time" id="rq-vt" value="10:00"><select id="rq-vp">' + opts("") + '</select></div>' +
      '<textarea id="rq-vn" rows="3" style="width:100%;margin-top:8px" placeholder="تطور الحالة في هذه الزيارة…"></textarea><textarea id="rq-vf" rows="2" style="width:100%;margin-top:8px" placeholder="المتابعة: التوصيات والموعد القادم…"></textarea><button class="btn" data-rq="vadd" style="margin-top:8px">إضافة الزيارة</button></div>' +
      '<h3 style="margin:18px 0 6px">سجل الزيارات (' + vs.length + ')</h3>' + (vs.length ? vs.map(card).join("") : '<div class="hint">لا زيارات مسجّلة بعد.</div>') + '</div>';
  }
  function draw() {
    const host = $("ruqya-content"); if (!host) return;
    if (S.pat) { host.innerHTML = patientHtml(); return; }
    const up = S.rows.filter(r => r.day >= today() && r.status !== "cancelled"), pend = S.rows.filter(r => r.status === "pending").length;
    let list = S.found || S.rows;
    if (S.found) { /* نتائج البحث في كل السجل */ } else if (S.filter === "up") list = up; else if (S.filter === "pending") list = S.rows.filter(r => r.status === "pending"); else if (S.filter === "past") list = S.rows.filter(r => r.day < today());
    const f = (k, n) => '<button class="rq-fb' + (S.filter === k ? " on" : "") + '" data-rq="f" data-k="' + k + '">' + n + '</button>';
    let h = '<div class="card" style="padding:16px"><h2 style="margin:0 0 6px">مواعيد الرقية الشرعية</h2><div class="hint">الحجوزات القادمة من صفحة الحجز العامة. اضغط «تأكيد» ثم راسل صاحب الحجز بواتساب.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0"><input id="rq-q" type="search" placeholder="🔍 ابحث بالاسم أو رقم الهاتف في كل السجل" value="' + esc(S.q) + '" style="flex:1;min-width:220px"><button class="btn gray" data-rq="imp"' + (S.busy ? ' disabled' : '') + '>📥 استيراد من تقويم Google</button><input type="file" id="rq-file" accept=".ics,.zip" class="hidden"></div>' + (S.msg ? '<div class="hint" style="margin:6px 0">' + esc(S.msg) + '</div>' : '') + (S.found ? '<div class="hint" style="margin:6px 0">نتائج البحث: ' + S.found.length + (S.found.length >= 300 ? ' (أول 300)' : '') + '</div>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' + f("up", "القادمة (" + up.length + ")") + f("pending", "بانتظار التأكيد (" + pend + ")") + f("past", "السابقة") + f("all", "الكل") +
      '<span style="flex:1"></span><label style="display:flex;align-items:center;gap:6px;font-weight:700">الحجوزات في الساعة الواحدة <input type="number" id="rq-cap" min="1" max="20" value="' + S.cap + '" style="width:70px"></label><button class="btn" data-rq="cap">حفظ</button></div>';
    if (S.err) h += '<div class="warn" style="margin:8px 0">' + esc(S.err) + '</div>';
    if (!list.length) h += '<div class="hint">لا توجد حجوزات هنا.</div>';
    else {
      h += '<div style="overflow-x:auto"><table class="rt" style="min-width:880px"><thead><tr><th>الموعد</th><th>الاسم</th><th>الهاتف</th><th>البلدية</th><th>الجلسة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>';
      list.forEach(r => {
        const wa = "https://wa.me/213" + String(r.phone).replace(/^0/, "") + "?text=" + encodeURIComponent("السلام عليكم " + r.name + "، بخصوص موعدك للرقية الشرعية يوم " + dayName(r.day) + " الساعة " + r.slot + (r.status === "confirmed" ? " (مؤكَّد)." : "."));
        h += '<tr><td data-l="الموعد"><b>' + esc(dayName(r.day)) + '</b><br>' + esc(r.slot) + (r.slots > 1 ? ' (' + r.slots + ' جلسات)' : '') + '</td><td data-l="الاسم"><a href="#" data-rq="pat" data-id="' + r.id + '" style="font-weight:800;color:inherit;text-decoration:underline">' + esc(r.name) + '</a>' + '<br><small>' + (r.first_time ? "أول مرة" : "مسجَّل") + '</small></td>' +
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
    if (a === "f") { S.filter = b.getAttribute("data-k"); S.q = ""; S.found = null; S.pat = null; draw(); }
    else if (a === "imp") { const fi = $("rq-file"); if (fi) fi.click(); }
    else if (a === "pat") { e.preventDefault(); openPatient(b.getAttribute("data-id")); }
    else if (a === "pback") { S.pat = null; S.visits = []; S.msg = ""; draw(); }
    else if (a === "psave") {
      const nm = $("rq-pn").value.trim(), rg = $("rq-pr").value.trim(); if (nm.length < 2) { S.perr = "الاسم قصير"; draw(); return; }
      try { await call("ruqya_bookings?id=eq." + encodeURIComponent(S.pat.id), { method: "PATCH", body: JSON.stringify({ name: nm.slice(0, 120), commune: rg.slice(0, 120) || null }) }); S.pat.name = nm; S.pat.commune = rg; S.perr = ""; S.msg = "✅ حُفظت بيانات المريض"; await load(); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vadd") {
      const day = $("rq-vd").value; if (!day) { S.perr = "اختر تاريخ الزيارة"; draw(); return; }
      try { await call("ruqya_visits", { method: "POST", body: JSON.stringify({ booking_id: S.pat.id, day, slot: $("rq-vt").value || null, progress: $("rq-vp").value, note: $("rq-vn").value.trim().slice(0, 4000), followup: $("rq-vf").value.trim().slice(0, 2000) }) }); S.perr = ""; S.msg = "✅ أُضيفت الزيارة"; S.visits = await call("ruqya_visits?select=*&booking_id=eq." + encodeURIComponent(S.pat.id) + "&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vsave") {
      const card = b.closest("[data-vid]"), g = k => card.querySelector('[data-vf="' + k + '"]').value;
      try { await call("ruqya_visits?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "PATCH", body: JSON.stringify({ progress: g("progress"), note: g("note").trim().slice(0, 4000), followup: g("followup").trim().slice(0, 2000) }) }); S.perr = ""; S.msg = "✅ حُفظت الزيارة"; S.visits = await call("ruqya_visits?select=*&booking_id=eq." + encodeURIComponent(S.pat.id) + "&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vdel") {
      if (!confirm("حذف هذه الزيارة نهائياً؟")) return;
      try { await call("ruqya_visits?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "DELETE" }); S.perr = ""; S.visits = await call("ruqya_visits?select=*&booking_id=eq." + encodeURIComponent(S.pat.id) + "&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    }
    else if (a === "st") {
      const v = b.getAttribute("data-v"); if (v === "cancelled" && !confirm("إلغاء هذا الحجز؟ سيتحرر الموعد.")) return;
      try { await call("ruqya_bookings?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "PATCH", body: JSON.stringify({ status: v }) }); await load(); draw(); } catch (er) { S.err = er.message; draw(); }
    } else if (a === "cap") {
      const n = Math.max(1, Math.min(20, parseInt($("rq-cap").value, 10) || 1));
      try { await call("admin_kv?on_conflict=key", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ key: "ruqya", value: { cap: n } }) }); S.cap = n; S.err = ""; draw(); } catch (er) { S.err = er.message; draw(); }
    }
  });
  document.addEventListener("input", e => { if (e.target && e.target.id === "rq-q") { S.q = e.target.value; clearTimeout(qT); qT = setTimeout(search, 350); } });
  document.addEventListener("change", e => { if (e.target && e.target.id === "rq-file" && e.target.files && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ""; importIcs(f); } });
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Admin === "undefined" || Admin._ruqyaTabWrapped) return;
    const original = Admin.tab;
    Admin.tab = function (t, btn) { const r = original.call(this, t, btn); const el = $("tab-ruqya"); if (el) el.classList.toggle("hidden", t !== "ruqya"); if (t === "ruqya") render(); return r; };
    Admin._ruqyaTabWrapped = true;
  });
  return { render, parseIcs, unzipIcs, rows: () => S.rows, pending: () => S.rows.filter(r => r.status === "pending").length };
})();
