/* مواعيد الرقية الشرعية: يقرأ حجوزات صفحة /ruqya-booking/ من الجدول ruqya_bookings (للمدير فقط)، ويؤكّدها أو يلغيها أو يعلّمها «تمت»،
   مع زر واتساب للتواصل وإعداد عدد الحجوزات المسموحة في الساعة الواحدة (admin_kv 'ruqya' = {cap}). الأسعار تُحسب في الخادم. */
const AdminRuqya = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Math.round(Number(n) || 0).toLocaleString("fr-DZ") + " دج";
  const KIND = { single: "فردية", couple: "زوج وزوجة", kids: "أبناء", family: "عائلة (كبار)" };
  const ST = { pending: "بانتظار التأكيد", confirmed: "مؤكَّد", done: "تمت", cancelled: "ملغى", noshow: "غاب بلا إخطار" };
  const WMAX = 3;      /* بعد 3 إنذارات يُحظر الرقم من حجز المواعيد (يفرضه الخادم أيضاً) */
  const S = { rows: [], filter: "up", cap: 1, max: 15, err: "", busy: false, q: "", found: null, msg: "", pat: null, visits: [], perr: "", accts: [], link: "", wa: "", warn: [], cfg: {}, blocks: [], view: "" };
  async function call(path, opt) {
    const t = await API.sb.token(); if (!t) throw new Error("انتهت الجلسة، أعد تسجيل الدخول");
    const r = await fetch(API.sb.url("/rest/v1/" + path), Object.assign({ headers: Object.assign(API.sb.headers(t), { Prefer: "return=representation" }) }, opt || {}));
    const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("تعذّر الاتصال (" + r.status + ")")); return j;
  }
  async function load() {
    S.err = "";
    try {
      /* الأحدث أولاً ثم يُعكس: كان الجلب بترتيب تصاعدي بحدّ 500 فيعيد أقدم السجلات ولا تصل الحجوزات الجديدة بعد أن كثر المستورد؛ الأقدم تجده بالبحث */
      S.rows = (await call("ruqya_bookings?select=*&order=day.desc,slot.desc&limit=800")).reverse();
      try { S.blocks = await call("ruqya_blocks?select=phone,reason&limit=5000"); } catch (_) { S.blocks = []; }
      try { S.warn = await call("ruqya_warnings?select=id,phone,day,note,created_at&order=id.desc&limit=5000"); } catch (_) { S.warn = []; }
      const k = await call("admin_kv?select=value&key=eq.ruqya"); S.cfg = (k && k[0] && k[0].value) || {}; S.cap = Math.max(1, Number(S.cfg.cap) || 1); S.max = Math.max(1, Number(k && k[0] && k[0].value && k[0].value.maxday) || 15); S.pcap = Math.max(1, Number(S.cfg.pcap) || 5);
    } catch (e) { S.err = e.message; }
  }
  const today = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);
  function dayName(d) { try { return new Date(d + "T12:00:00").toLocaleDateString("ar-DZ", { weekday: "long", day: "numeric", month: "long" }); } catch (_) { return d; } }
  const wOf = ph => S.warn.filter(w => w.phone === ph), wBadge = ph => { const n = wOf(ph).length; if (isBlocked(ph)) return ' <span style="display:inline-block;background:#e5484d;color:#fff;border-radius:999px;padding:0 8px;font-size:.75rem;font-weight:800">محظور</span>'; return n ? ' <span style="display:inline-block;background:' + (n >= WMAX ? "#e5484d" : "#f59e0b") + ';color:#fff;border-radius:999px;padding:0 8px;font-size:.75rem;font-weight:800">' + (n >= WMAX ? "محظور" : "⚠️ إنذار " + n) + "</span>" : ""; };
  /* حفظ إعدادات المواعيد (admin_kv 'ruqya'): تُدمج مع الموجود فلا يضيع شيء (الأسعار، العطل، التعطيل، المنتجات، السقوف) */
  async function saveCfg(patch) {
    const v = Object.assign({}, S.cfg, patch);
    await call("admin_kv?on_conflict=key", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ key: "ruqya", value: v }) });
    S.cfg = v;
  }
  /* كل المنتجات (حتى غير المفعّلة في المتجر مثل ماء الورد): منتجات المركز لها سعر مستقل عن المتجر */
  S.catalog = () => (typeof Admin !== "undefined" && Admin.products) ? Admin.products.filter(p => p && p.slug) : [];
  /* نص آمن للتخزين: يُقطع بالأحرف الكاملة (لا نصف رمز تعبيري) ويُنزع أي نصف زوج بديل فيرفضه الخادم */
  const cut = (v, n) => Array.from(String(v == null ? "" : v).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, m => m.length === 2 ? m : "")).slice(0, n).join("");
  const note = (t, ok) => { try { if (typeof toast === "function") toast((ok ? "✅ " : "❌ ") + t); } catch (_) { } };
  const isBlocked = ph => S.blocks.some(x => x.phone === ph);
  const DEFP = { single: 1500, couple: 2000, kid: 500, family: 2000, pack: 3000 };
  function nextSaturdays(n) { const out = [], d = new Date(Date.now() + 36e5); d.setUTCHours(12, 0, 0, 0); while (out.length < n) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() === 6) out.push(d.toISOString().slice(0, 10)); } return out; }
  function cfgHtml() {
    const c = S.cfg || {}, pr = Object.assign({}, DEFP, c.prices || {}), closed = c.closed || [], sel = new Map((c.products || []).map(x => [x.slug, x]));
    const inp = (id, l, v) => '<div><label style="font-weight:700">' + l + '</label><input type="number" min="0" id="' + id + '" value="' + v + '"></div>';
    const prow = p => { const o = sel.get(p.slug); const img = p.cover || (p.images && p.images[0]) || ""; return '<div data-pp="' + esc(p.slug) + '" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #ffffff22;padding:6px 0"><label style="display:flex;gap:6px;align-items:center;min-width:160px;font-weight:700"><input type="checkbox" data-pon' + (o ? " checked" : "") + '>' + (img ? '<img src="/' + esc(img) + '" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:8px">' : "") + esc(p.title) + (p.active === false ? ' <small class="hint">(غير مفعّل في المتجر)</small>' : '') + '</label><input data-pdesc placeholder="وصف قصير" value="' + esc(o ? o.desc : cut(p.desc, 90)) + '" style="flex:1;min-width:160px"><input data-pprice type="number" min="0" value="' + (o ? o.price : p.price) + '" style="width:100px" title="السعر في المركز (دج)"></div>'; };
    return '<div id="rq-cfg" class="card" style="padding:16px"><button class="btn gray" data-rq="cfgback">← رجوع</button> <button class="btn gray" data-rq="ptpage">صفحة المرضى (دخول مباشر)</button><h2 style="margin:12px 0 4px">إعدادات المواعيد</h2>' + (S.err ? '<div class="warn" style="margin:8px 0">' + esc(S.err) + '</div>' : "") +
      '<h3 style="margin:14px 0 6px">⛔ تعطيل المواعيد</h3><label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" id="cf-off"' + (c.disabled ? " checked" : "") + '> إيقاف الحجز مؤقتاً (لا يستقبل الحجوزات)</label><textarea id="cf-msg" rows="2" style="width:100%;margin-top:6px" placeholder="رسالة تظهر للزائر (اختياري)">' + esc(c.msg || "") + '</textarea>' +
      '<h3 style="margin:14px 0 6px">📍 العنوان وأرقام الهاتف (تظهر للمريض في صفحة تأكيد الموعد)</h3><div class="hint">يراها المريض بعد الحجز مع تفاصيل موعده؛ والتأكيد النهائي يبقى من طرفكم على واتساب.</div><label style="display:block;margin-top:6px;font-weight:700">عنوان المركز</label><textarea id="cf-addr" rows="2" style="width:100%" maxlength="300">' + esc(c.address || "") + '</textarea><label style="display:block;margin-top:6px;font-weight:700">أرقام الهاتف (رقم في كل سطر)</label><textarea id="cf-phones" rows="2" style="width:100%;direction:ltr" maxlength="200" placeholder="0559 23 72 39">' + esc(c.phones || "") + '</textarea><label style="display:block;margin-top:6px;font-weight:700">رابط الموقع على الخريطة (اختياري)</label><input id="cf-map" type="url" dir="ltr" style="width:100%" maxlength="300" placeholder="https://maps.google.com/…" value="' + esc(c.map || "") + '">' +
      '<h3 style="margin:14px 0 6px">💰 الأسعار (دج)</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">' + inp("cf-single", "جلسة فردية", pr.single) + inp("cf-couple", "زوج وزوجة", pr.couple) + inp("cf-kid", "طفل (للفرد)", pr.kid) + inp("cf-family", "جماعية للعائلة", pr.family) + inp("cf-pack", "الباقة العلاجية", pr.pack) + '</div>' +
      '<h3 style="margin:14px 0 6px">🏖️ العطل (أيام سبت مغلقة)</h3><div style="display:flex;gap:8px;flex-wrap:wrap">' + nextSaturdays(16).map(d => '<label style="display:flex;gap:6px;align-items:center;border:1px solid #ffffff44;border-radius:10px;padding:6px 10px"><input type="checkbox" data-closed="' + d + '"' + (closed.includes(d) ? " checked" : "") + '>' + esc(dayName(d)) + '</label>').join("") + '</div>' +
      '<h3 style="margin:14px 0 6px">🛍️ منتجات تجدونها في المركز</h3><div class="hint">اختر من منتجات أليسوم ما يُعرض في صفحة الحجز: صورته ووصفه القصير وسعره في المركز وزر «احجز الآن» (يُضاف سعره إلى المجموع).</div>' + S.catalog().map(prow).join("") +
      '<div style="margin-top:14px"><button class="btn" data-rq="cfgsave">حفظ كل الإعدادات</button></div></div>';
  }
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
      if (isNaN(dt)) return; const loc = dt.toLocaleString("sv-SE", { timeZone: "Africa/Algiers" }), key = ok[0];      /* مريض واحد لكل هاتف (يُدمج اختلاف كتابة الاسم) */
      const r = P.get(key) || { n: 0, last: "", name, phone: ok[0], v: [] }; r.n++; if (loc > r.last) { r.last = loc; r.name = name; } const note = String(d.DESCRIPTION || "").replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 3900); const vd = loc.slice(0, 10), vs = loc.slice(11, 16); if (!r.v.some(x => x.day === vd && x.slot === vs)) r.v.push({ day: vd, slot: vs, note }); P.set(key, r);
    });
    return { people: [...P.values()], bad, none };
  }
  async function importIcs(file) {
    S.busy = true; S.msg = "⏳ جارٍ قراءة الملف…"; draw();
    try {
      const buf = await file.arrayBuffer(), text = /\.zip$/i.test(file.name) || new Uint8Array(buf, 0, 2)[0] === 0x50 ? await unzipIcs(buf) : new TextDecoder().decode(buf), R = parseIcs(text);
      if (!R.people.length) throw new Error("لم أجد مواعيد بأسماء وأرقام هاتف صالحة في الملف");
      const have = new Set(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_bookings?select=phone,name&order=id.asc&limit=1000&offset=" + off); part.forEach(x => have.add(x.phone)); if (part.length < 1000) break; }
      const t = today(), rows = R.people.filter(x => !have.has(x.phone)).map(x => { const day = x.last.slice(0, 10); return { day, slot: x.last.slice(11, 16), slots: 1, registered: true, first_time: false, name: x.name.slice(0, 120), phone: x.phone, kind: "single", persons: 1, sessions: Math.min(Math.max(x.n, 1), 8), session_price: 0, pack_price: 0, total: 0, terms: true, status: day >= t ? "confirmed" : "done", note: "مستورد من تقويم Google · " + x.n + " موعداً مسجّلاً" }; });
      let done = 0; for (let i = 0; i < rows.length; i += 200) { await call("ruqya_bookings", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "return=minimal" }), body: JSON.stringify(rows.slice(i, i + 200)) }); done += Math.min(200, rows.length - i); S.msg = "⏳ أُضيف " + done + " من " + rows.length + "…"; draw(); }
      S.msg = "✅ أُضيف " + rows.length + " عميل مسجَّل" + (R.people.length - rows.length ? " (وتخطّيتُ " + (R.people.length - rows.length) + " موجودين مسبقاً)" : "") + ". مواعيد بلا رقم هاتف: " + R.none + "، وبرقم غير صحيح (لم تُضَف): " + R.bad + ".";
      /* زيارات كل مريض (موعد التقويم = زيارة، ووصفه = ملاحظات المتابعة) */
      const idOf = new Map(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_bookings?select=id,phone,name&order=id.asc&limit=1000&offset=" + off); part.forEach(x => { if (!idOf.has(x.phone)) idOf.set(x.phone, x.id); }); if (part.length < 1000) break; }
      const haveV = new Set(); for (let off = 0; ; off += 1000) { const part = await call("ruqya_visits?select=booking_id,day,slot&order=id.asc&limit=1000&offset=" + off); part.forEach(x => haveV.add(x.booking_id + "|" + x.day + "|" + (x.slot || ""))); if (part.length < 1000) break; }
      const vrows = []; R.people.forEach(x => { const id = idOf.get(x.phone); if (!id) return; x.v.sort((a, b) => (a.day + a.slot).localeCompare(b.day + b.slot)).forEach((v, i) => { if (!haveV.has(id + "|" + v.day + "|" + v.slot)) vrows.push({ booking_id: id, day: v.day, slot: v.slot, progress: i === 0 ? "new" : "", note: v.note, followup: "" }); }); });
      let vd = 0; for (let i = 0; i < vrows.length; i += 300) { await call("ruqya_visits", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "return=minimal" }), body: JSON.stringify(vrows.slice(i, i + 300)) }); vd += Math.min(300, vrows.length - i); S.msg = "⏳ أُضيفت " + vd + " من " + vrows.length + " زيارة…"; draw(); }
      S.msg += " · " + vrows.length + " زيارة مع ملاحظاتها.";
      await load();
    } catch (e) { S.msg = "❌ " + e.message; }
    S.busy = false; draw();
  }
  /* ── صفحة المريض: الاسم والمنطقة والزيارات (تاريخ، تطور الحالة، المتابعة) ── */
  const PROG = { "": "—", new: "زيارة أولى", better: "تحسّن", same: "مستقرة", worse: "تراجع", done: "انتهت الحالة" };
  const PCOL = { new: "#60a5fa", better: "#86efac", same: "#fde047", worse: "#fca5a5", done: "#c4b5fd" };
  /* دخول مباشر لصفحة المرضى (وضع المدير): يُنقل رمز الوصول فقط (بلا رمز التجديد كي لا تُبطَل جلسة اللوحة)؛ id = فتح ملف مريض بعينه */
  function openPt(id) {
    try { const ss = API.sb.session && API.sb.session(); if (ss && ss.access_token) localStorage.setItem("alyssum_pt_session", JSON.stringify({ access_token: ss.access_token, refresh_token: "", expires_at: ss.expires_at || (Date.now() + 36e5) })); } catch (_) { }
    window.open("/ruqya-patient/" + (id ? "?p=" + encodeURIComponent(id) : ""), "_blank", "noopener");
  }
  const pids = () => (S.pbk && S.pbk.length ? S.pbk : [S.pat]).map(x => encodeURIComponent(x.id)).join(",");
  async function openPatient(id) {
    const r = (S.found || []).concat(S.rows).find(x => String(x.id) === String(id)); if (!r) return;
    S.pat = r; S.visits = []; S.perr = ""; S.accts = []; S.link = ""; S.wa = ""; S.pbk = [r]; draw();
    /* ملف واحد لكل مريض (برقم الهاتف): تُجمع كل مواعيده وزياراته مهما تعدّد حجزه */
    try { S.pbk = await call("ruqya_bookings?select=id,day,slot,slots,sessions,kind,status,created_at&phone=eq." + encodeURIComponent(r.phone) + "&order=day.desc,slot.desc&limit=200"); if (!S.pbk.some(x => String(x.id) === String(r.id))) S.pbk.push(r); } catch (e) { S.pbk = [r]; }
    try { S.visits = await call("ruqya_visits?select=*&booking_id=in.(" + pids() + ")&order=day.desc,slot.desc&limit=500"); S.accts = await call("ruqya_portal_accounts?select=user_id,provider,linked_at&booking_id=in.(" + pids() + ")"); } catch (e) { S.perr = e.message; } draw();
  }
  function patientHtml() {
    const r = S.pat, vs = S.visits, first = vs.length ? vs[vs.length - 1].day : r.day, last = vs.length ? vs[0].day : r.day;
    const wa = "https://wa.me/213" + String(r.whatsapp || r.phone).replace(/^0/, "");
    const opts = k => Object.keys(PROG).map(x => '<option value="' + x + '"' + (x === k ? " selected" : "") + ">" + PROG[x] + "</option>").join("");
    const card = v => '<div class="card" style="padding:12px;margin:10px 0;border-inline-start:4px solid ' + (PCOL[v.progress] || "#ffffff44") + '" data-vid="' + v.id + '"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc(dayName(v.day)) + (v.slot ? " · " + esc(v.slot) : "") + '</b><span style="flex:1"></span><select data-vf="progress">' + opts(v.progress) + '</select></div>' +
      '<label style="display:block;margin-top:8px;font-weight:700">تطور الحالة / ملاحظات الزيارة</label><textarea data-vf="note" rows="3" style="width:100%">' + esc(v.note) + '</textarea>' +
      '<label style="display:block;margin-top:8px;font-weight:700">المتابعة (التوصيات والموعد القادم)</label><textarea data-vf="followup" rows="2" style="width:100%">' + esc(v.followup) + '</textarea>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:700"><input type="checkbox" data-vf="shared"' + (v.shared ? " checked" : "") + '> إظهار هذه الزيارة للمريض في بوابته</label>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-rq="vsave" data-id="' + v.id + '">حفظ</button><button class="btn warn" data-rq="vdel" data-id="' + v.id + '">حذف الزيارة</button></div></div>';
    return '<div class="card" style="padding:16px"><button class="btn gray" data-rq="pback">← رجوع للمواعيد</button> <button class="btn gray" data-rq="ptfile" data-id="' + r.id + '">فتح ملفه في صفحة المرضى</button>' +
      '<h2 style="margin:12px 0 4px">ملف المريض</h2>' + (S.perr ? '<div class="warn" style="margin:8px 0">' + esc(S.perr) + '</div>' : "") + (S.msg ? '<div class="hint">' + esc(S.msg) + '</div>' : "") +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0"><div><label style="font-weight:700">الاسم</label><input id="rq-pn" value="' + esc(r.name) + '"></div><div><label style="font-weight:700">المنطقة</label><input id="rq-pr" value="' + esc(r.commune || "") + '" placeholder="البلدية / الولاية"></div><div><label style="font-weight:700">الهاتف</label><div dir="ltr" style="padding:8px 0"><b>' + esc(r.phone) + '</b> · <a target="_blank" rel="noopener" href="' + wa + '">واتساب' + (r.whatsapp && r.whatsapp !== r.phone ? ' ' + esc(r.whatsapp) : '') + '</a></div></div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-rq="psave">حفظ بيانات المريض</button><span class="hint">أول زيارة: ' + esc(first) + ' · آخر زيارة: ' + esc(last) + ' · عدد الزيارات: ' + vs.length + '</span></div>' +
      '<h3 style="margin:18px 0 6px">📅 مواعيد المريض (' + (S.pbk || []).length + ')</h3><div class="card" style="padding:10px">' + ((S.pbk || []).map(b => '<div style="display:flex;gap:10px;flex-wrap:wrap;padding:5px 0;border-bottom:1px dashed #ffffff22"><b>' + esc(dayName(b.day)) + (b.slot ? " · " + esc(b.slot) : "") + '</b><span>' + (b.sessions || 1) + ' جلسة</span><span class="hint">' + esc(ST[b.status] || b.status || "") + '</span></div>').join("") || '<div class="hint">لا مواعيد.</div>') + '</div>' +
      (function () {
        const n = S.accts.length, shared = vs.filter(x => x.shared).length;
        return '<h3 style="margin:18px 0 6px">🔐 بوابة المريض</h3><div class="card" style="padding:12px"><div class="hint">' + (n ? "✅ المريض مربوط بحساب (" + n + ") — يطّلع على الزيارات المشارَكة فقط (" + shared + " من " + vs.length + ")." : "المريض لم يربط حسابه بعد. أرسل له رابط التأكيد على واتساب: يفتحه، يسجّل الدخول بـ Google أو Apple أو البريد، فيُربط حسابه بملفه.") + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" data-rq="pinv">📲 إرسال رابط التأكيد بواتساب</button><button class="btn gray" data-rq="pshare">إظهار كل الزيارات للمريض</button>' + (n ? '<button class="btn warn" data-rq="punl">فصل الحساب</button>' : "") + '</div>' +
          (S.link ? '<div class="hint" style="margin-top:8px">الرابط (صالح 14 يوماً، يُستعمل مرة واحدة): <input readonly dir="ltr" value="' + esc(S.link) + '" style="width:100%" onclick="this.select()"> <a class="btn" target="_blank" rel="noopener" href="' + esc(S.wa) + '" style="display:inline-block;margin-top:6px">فتح واتساب لإرسال الرابط</a></div><div class="hint" style="margin-top:8px">رمز التحقق (يُرسَل في رسالة منفصلة، 5 محاولات خاطئة تُبطل الرابط): <b dir="ltr" style="font-size:1.2rem;letter-spacing:.2em">' + esc(S.pin || "") + '</b> <a class="btn" target="_blank" rel="noopener" href="' + esc(S.wa2 || "") + '" style="display:inline-block;margin-top:6px">إرسال الرمز في رسالة منفصلة</a></div>' : "") + '</div>';
      })() +
      (function () {
        const W = wOf(S.pat.phone), ban = W.length >= WMAX;
        return '<div style="margin:14px 0 0">' + (isBlocked(S.pat.phone) ? '<span class="warn" style="padding:6px 10px">🚫 هذا الرقم محظور من الحجز</span> <button class="btn gray" data-rq="unblock" data-ph="' + esc(S.pat.phone) + '">رفع الحظر</button>' : '<button class="btn warn" data-rq="block" data-ph="' + esc(S.pat.phone) + '">🚫 حظر الرقم من الحجز</button>') + '</div><h3 style="margin:18px 0 6px">⚠️ الإنذارات (' + W.length + ' / ' + WMAX + ')</h3><div class="card" style="padding:12px">' + (ban ? '<div class="warn" style="margin-bottom:8px">🚫 محظور من حجز المواعيد (3 إنذارات).</div>' : '') +
          '<div class="hint">الغياب دون إخطار قبل 24 ساعة يُسجَّل إنذاراً (زر «غاب بلا إخطار» في المواعيد). بعد ' + WMAX + ' إنذارات يُحظر الرقم من الحجز.</div>' +
          W.map(w => '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span>' + esc(w.day ? dayName(w.day) : String(w.created_at).slice(0, 10)) + ' — ' + esc(w.note || "") + '</span><span style="flex:1"></span><button class="btn gray" data-rq="wdel" data-id="' + w.id + '">حذف</button></div>').join("") +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><input type="date" id="rq-wd" value="' + today() + '"><input id="rq-wn" placeholder="ملاحظة (اختياري)" style="flex:1;min-width:160px"><button class="btn" data-rq="wadd">＋ إنذار يدوي</button>' + (W.length ? '<button class="btn warn" data-rq="wclr">تصفير الإنذارات ورفع الحظر</button>' : "") + '</div></div>';
      })() +
      '<h3 style="margin:18px 0 6px">＋ زيارة جديدة</h3><div class="card" style="padding:12px"><div style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" id="rq-vd" value="' + today() + '"><input type="time" id="rq-vt" value="10:00"><select id="rq-vp">' + opts("") + '</select></div>' +
      '<textarea id="rq-vn" rows="3" style="width:100%;margin-top:8px" placeholder="تطور الحالة في هذه الزيارة…"></textarea><textarea id="rq-vf" rows="2" style="width:100%;margin-top:8px" placeholder="المتابعة: التوصيات والموعد القادم…"></textarea><label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:700"><input type="checkbox" id="rq-vs" checked> إظهارها للمريض في بوابته</label><button class="btn" data-rq="vadd" style="margin-top:8px">إضافة الزيارة</button></div>' +
      '<h3 style="margin:18px 0 6px">سجل الزيارات (' + vs.length + ')</h3>' + (vs.length ? vs.map(card).join("") : '<div class="hint">لا زيارات مسجّلة بعد.</div>') + '</div>';
  }
  /* حجز موعد يدوي من الإدارة: لمريض جديد أو مسجَّل (يُعرف بالهاتف)، بلا قيود صفحة الزوار (مع تحذير إن امتلأت الفترة) */
  const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
  const normPh = v => { let d = String(v || "").replace(/[^0-9]/g, ""); if (/^00213/.test(d)) d = "0" + d.slice(5); else if (/^213/.test(d) && d.length >= 12) d = "0" + d.slice(3); else if (d.length === 9 && /^[567]/.test(d)) d = "0" + d; return d; };
  function manHtml() {
    const sats = nextSaturdays(12), D = S.man || {};
    return '<div class="card" style="padding:16px"><button class="btn gray" data-rq="manback">← رجوع</button><h2 style="margin:12px 0 4px">حجز موعد يدوي</h2>' + (S.err ? '<div class="warn" style="margin:8px 0">' + esc(S.err) + '</div>' : "") +
      '<div class="hint">يُسجَّل الحجز مؤكَّداً مباشرة باسم المريض ورقمه، ويظهر في الجدول وفي ملفه، ويُحتسب في سقف الفترة.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0">' +
      '<div><label style="font-weight:700">رقم الهاتف</label><input id="mn-phone" type="tel" dir="ltr" inputmode="tel" placeholder="05XXXXXXXX" value="' + esc(D.phone || "") + '"></div>' +
      '<div><label style="font-weight:700">الاسم الكامل</label><input id="mn-name" value="' + esc(D.name || "") + '"></div>' +
      '<div><label style="font-weight:700">البلدية / الولاية (اختياري)</label><input id="mn-com" value="' + esc(D.commune || "") + '"></div></div>' +
      '<div id="mn-known" class="hint" style="margin:-4px 0 8px">' + esc(D.known || "") + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0">' +
      '<div><label style="font-weight:700">اليوم</label><input type="date" id="mn-day" value="' + esc(D.day || sats[0] || "") + '"></div>' +
      '<div><label style="font-weight:700">الساعة</label><select id="mn-slot">' + SLOTS.map(t => '<option' + (t === D.slot ? " selected" : "") + '>' + t + '</option>').join("") + '</select></div>' +
      '<div><label style="font-weight:700">نوع الجلسة</label><select id="mn-kind">' + Object.keys(KIND).map(k => '<option value="' + k + '"' + (k === (D.kind || "single") ? " selected" : "") + '>' + esc(KIND[k]) + '</option>').join("") + '</select></div>' +
      '<div><label style="font-weight:700">عدد الأفراد (للأبناء/العائلة)</label><input type="number" id="mn-per" min="1" max="10" value="' + (D.per || 1) + '"></div>' +
      '<div><label style="font-weight:700">عدد الجلسات</label><input type="number" id="mn-n" min="1" max="8" value="' + (D.n || 1) + '"></div>' +
      '<div><label style="font-weight:700">الحالة</label><select id="mn-st"><option value="confirmed">مؤكَّد</option><option value="pending">بانتظار التأكيد</option></select></div></div>' +
      '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-rq="mansave">حفظ الحجز</button></div></div>';
  }
  function manKeep() { const g = id => ($(id) || {}).value || ""; S.man = { phone: g("mn-phone"), name: g("mn-name"), commune: g("mn-com"), day: g("mn-day"), slot: g("mn-slot"), kind: g("mn-kind"), per: g("mn-per"), n: g("mn-n") }; }
  function draw() {
    const host = $("ruqya-content"); if (!host) return;
    if (S.view === "cfg") { host.innerHTML = cfgHtml(); return; }
    if (S.view === "man") { host.innerHTML = manHtml(); return; }
    if (S.pat) { host.innerHTML = patientHtml(); return; }
    const up = S.rows.filter(r => r.day >= today() && r.status !== "cancelled" && r.status !== "noshow"), pend = S.rows.filter(r => r.status === "pending").length;
    let list = S.found || S.rows;
    if (S.found) { /* نتائج البحث في كل السجل */ } else if (S.filter === "up") list = up; else if (S.filter === "pending") list = S.rows.filter(r => r.status === "pending"); else if (S.filter === "past") list = S.rows.filter(r => r.day < today());
    const f = (k, n) => '<button class="rq-fb' + (S.filter === k ? " on" : "") + '" data-rq="f" data-k="' + k + '">' + n + '</button>';
    let h = '<div class="card" style="padding:16px"><h2 style="margin:0 0 6px">مواعيد الرقية الشرعية</h2><div class="hint">الحجوزات القادمة من صفحة الحجز العامة. اضغط «تأكيد» ثم راسل صاحب الحجز بواتساب.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0"><input id="rq-q" type="search" placeholder="🔍 ابحث بالاسم أو رقم الهاتف في كل السجل" value="' + esc(S.q) + '" style="flex:1;min-width:220px"><button class="btn gray" data-rq="cfg">⚙️ الإعدادات والأسعار والمنتجات</button><button class="btn gray" data-rq="ptpage">صفحة المرضى (دخول مباشر)</button><button class="btn" data-rq="mannew">حجز موعد يدوي</button></div>' + (S.msg ? '<div class="hint" style="margin:6px 0">' + esc(S.msg) + '</div>' : '') + (S.found ? '<div class="hint" style="margin:6px 0">نتائج البحث: ' + S.found.length + (S.found.length >= 300 ? ' (أول 300)' : '') + '</div>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' + f("up", "القادمة (" + up.length + ")") + f("pending", "بانتظار التأكيد (" + pend + ")") + f("past", "السابقة") + f("all", "الكل") +
      '<span style="flex:1"></span><label style="display:flex;align-items:center;gap:6px;font-weight:700">الحجوزات في الساعة الواحدة <input type="number" id="rq-cap" min="1" max="20" value="' + S.cap + '" style="width:70px"></label><label style="display:flex;align-items:center;gap:6px;font-weight:700">أقصى جلسات في السبت <input type="number" id="rq-max" min="1" max="60" value="' + S.max + '" style="width:70px"></label><label style="display:flex;align-items:center;gap:6px;font-weight:700">جلسات كل فترة (صباحاً / مساءً) <input type="number" id="rq-pcap" min="1" max="30" value="' + S.pcap + '" style="width:70px"></label><button class="btn" data-rq="cap">حفظ</button></div>';
    if (S.err) h += '<div class="warn" style="margin:8px 0">' + esc(S.err) + '</div>';
    if (!list.length) h += '<div class="hint">لا توجد حجوزات هنا.</div>';
    else {
      h += '<div style="overflow-x:auto"><table class="rt" style="min-width:880px"><thead><tr><th>الموعد</th><th>الاسم</th><th>الهاتف</th><th>البلدية</th><th>الجلسة</th><th>المبلغ</th><th>الحالة</th><th></th></tr></thead><tbody>';
      list.forEach(r => {
        const wa = "https://wa.me/213" + String(r.whatsapp || r.phone).replace(/^0/, "") + "?text=" + encodeURIComponent("السلام عليكم " + r.name + "، بخصوص موعدك للرقية الشرعية يوم " + dayName(r.day) + (r.status === "confirmed" ? " (مؤكَّد)." : ".") + " أوقات الحضور: الفترة الصباحية 09:00-12:30 والمسائية 13:30-17:00.");
        h += '<tr><td data-l="الموعد"><b>' + esc(dayName(r.day)) + '</b><br>' + esc(r.slot) + (r.slots > 1 ? ' (' + r.slots + ' جلسات)' : '') + '</td><td data-l="الاسم"><a href="#" data-rq="pat" data-id="' + r.id + '" style="font-weight:800;color:inherit;text-decoration:underline">' + esc(r.name) + '</a> <a href="#" data-rq="ptfile" data-id="' + r.id + '" title="فتح ملفه مباشرة في صفحة المرضى" style="font-size:.8rem;font-weight:700;white-space:nowrap">فتح الملف</a>' + wBadge(r.phone) + '<br><small>' + (r.first_time ? "أول مرة" : "مسجَّل") + '</small></td>' +
          '<td data-l="الهاتف" dir="ltr">' + esc(r.phone) + '</td><td data-l="البلدية">' + esc(r.commune || "—") + (r.wilaya ? '<br><small>' + esc(r.wilaya) + '</small>' : '') + '</td>' +
          '<td data-l="الجلسة">' + esc(KIND[r.kind] || r.kind) + '<br><small>' + r.persons + ' أفراد · ' + r.sessions + ' جلسة</small>' + (r.second_name ? '<br><small>+ فرد آخر: ' + esc(r.second_name) + ' <bdi dir="ltr">' + esc(r.second_phone || "") + '</bdi></small>' : '') + '</td>' +
          '<td data-l="المبلغ">' + (Number(r.total) > 0 ? '<bdi dir="ltr">' + money(r.total) + '</bdi>' : "—") + (Array.isArray(r.products) && r.products.length ? '<br><small>منتجات: ' + r.products.map(x => esc(x.title) + ' ×' + x.qty).join('، ') + '</small>' : '') + (r.pack_price ? '<br><small>يشمل الباقة 4: <bdi dir="ltr">' + money(r.pack_price) + '</bdi></small>' : '') + '</td><td data-l="الحالة">' + esc(ST[r.status] || r.status) + '</td>' +
          '<td data-l="إجراء" style="display:flex;flex-wrap:wrap;gap:6px;min-width:230px"><a class="btn gray" target="_blank" rel="noopener" href="' + wa + '">واتساب</a> ' +
          (isBlocked(r.phone) ? '<button class="btn gray" data-rq="unblock" data-ph="' + esc(r.phone) + '">رفع الحظر</button> ' : '<button class="btn warn" data-rq="block" data-ph="' + esc(r.phone) + '" title="يمنع هذا الرقم من الحجز">حظر</button> ') + (r.status !== "cancelled" && r.status !== "done" && r.status !== "noshow" ? '<button class="btn warn" data-rq="st" data-id="' + r.id + '" data-v="cancelled" title="يلغي الموعد ويحرّر مكانه">إلغاء الموعد</button> ' : '') + ((r.status === "pending" || r.status === "confirmed") && r.day <= today() ? '<button class="btn warn" data-rq="noshow" data-id="' + r.id + '" title="يسجَّل إنذار في ملفه">غاب بلا إخطار</button> ' : '') +
          (r.status === "pending" ? '<button class="btn" data-rq="st" data-id="' + r.id + '" data-v="confirmed">تأكيد</button> ' : '') +
          (r.status === "confirmed" ? '<button class="btn" data-rq="st" data-id="' + r.id + '" data-v="done">تمت</button> ' : '') +
          '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    host.innerHTML = h + '</div><style>.rq-fb{border:1px solid #ffffff44;background:transparent;color:inherit;border-radius:12px;padding:8px 14px;font:inherit;font-weight:800;cursor:pointer}.rq-fb.on{background:var(--g-mint,#e2fe17);color:#1f2123;border-color:transparent}@media(max-width:760px){#ruqya-content table.rt{min-width:0!important;width:100%!important;display:block!important}#ruqya-content table.rt thead{display:none!important}#ruqya-content table.rt tbody,#ruqya-content table.rt tr{display:block!important;width:100%!important}#ruqya-content table.rt tr{border:1px solid #ffffff2e;border-radius:14px;margin:10px 0;padding:8px 10px}#ruqya-content table.rt td{display:flex!important;justify-content:space-between;align-items:flex-start;gap:10px;padding:5px 2px!important;border:0!important;text-align:start;width:auto!important;min-width:0!important}#ruqya-content table.rt td::before{content:attr(data-l);font-weight:800;opacity:.65;flex:none}#ruqya-content table.rt td[data-l="إجراء"]{flex-wrap:wrap;justify-content:flex-start}#ruqya-content table.rt td[data-l="إجراء"]::before{display:none}#ruqya-content table.rt td[data-l="إجراء"] .btn{width:auto!important;flex:0 0 auto!important;min-height:36px!important;height:auto!important;padding:5px 14px!important;font-size:.88rem!important;border-radius:11px!important;margin:0!important}#ruqya-content table.rt td[data-l="إجراء"]{gap:6px!important}}</style>';
  }
  async function render() { const host = $("ruqya-content"); if (!host) return; host.innerHTML = '<div class="hint">جارٍ التحميل…</div>'; await load(); draw(); }
  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest("[data-rq]"); if (!b || !$("ruqya-content") || !$("ruqya-content").contains(b)) return;
    const a = b.getAttribute("data-rq");
    if (a === "f") { S.filter = b.getAttribute("data-k"); S.q = ""; S.found = null; S.pat = null; draw(); }
    else if (a === "imp") { const fi = $("rq-file"); if (fi) fi.click(); }
    else if (a === "pat") { e.preventDefault(); openPatient(b.getAttribute("data-id")); }
    else if (a === "pinv") {
      try { const inv = await call("rpc/ruqya_portal_invite2", { method: "POST", body: JSON.stringify({ p_booking_id: S.pat.id }) }); S.link = location.origin + "/ruqya-patient/?t=" + inv.token; S.pin = inv.pin; S.perr = "";
        const num = "https://wa.me/213" + String(S.pat.whatsapp || S.pat.phone).replace(/^0/, "");
        const txt = "السلام عليكم " + S.pat.name + "، هذا رابط ملفك في مواعيد الرقية الشرعية (أليسوم). افتحه وسجّل الدخول بحساب Google أو Apple أو بريدك، وسيطلب منك رمز التحقق الذي نرسله لك في رسالة منفصلة:\n" + S.link;
        S.wa = num + "?text=" + encodeURIComponent(txt); S.wa2 = num + "?text=" + encodeURIComponent("رمز التحقق لربط ملفك في مواعيد الرقية الشرعية (أليسوم): " + S.pin + "\nلا تشاركه مع أحد."); try { window.open(S.wa, "_blank", "noopener"); } catch (_) { } } catch (er) { S.perr = er.message; } draw();
    } else if (a === "pshare") {
      try { await call("ruqya_visits?booking_id=in.(" + pids() + ")", { method: "PATCH", body: JSON.stringify({ shared: true }) }); S.visits = await call("ruqya_visits?select=*&booking_id=in.(" + pids() + ")&order=day.desc,slot.desc&limit=500"); S.msg = "✅ صارت كل الزيارات ظاهرة للمريض"; } catch (er) { S.perr = er.message; } draw();
    } else if (a === "punl") {
      if (!confirm("فصل حساب المريض؟ لن يعود يرى ملفه حتى يُرسَل له رابط جديد.")) return;
      try { for (const bid of (S.pbk || [S.pat]).map(x => x.id)) await call("rpc/ruqya_portal_unlink", { method: "POST", body: JSON.stringify({ p_booking_id: bid }) }); S.accts = []; S.link = ""; S.wa = ""; S.msg = "تم فصل الحساب"; } catch (er) { S.perr = er.message; } draw();
    }
    else if (a === "noshow") {
      if (!confirm("تعليم هذا الحجز «غاب بلا إخطار» وتسجيل إنذار في ملف صاحبه؟")) return;
      try { const r = await call("rpc/ruqya_mark_noshow", { method: "POST", body: JSON.stringify({ p_booking_id: Number(b.getAttribute("data-id")) }) }); S.err = ""; await load(); S.msg = r && r.banned ? "🚫 بلغ 3 إنذارات: حُظر الرقم من الحجز." : "⚠️ سُجّل إنذار (" + (r && r.warnings) + " / " + WMAX + ")"; } catch (er) { S.err = er.message; } draw();
    } else if (a === "wadd") {
      try { await call("ruqya_warnings", { method: "POST", body: JSON.stringify({ phone: S.pat.phone, day: $("rq-wd").value || null, note: ($("rq-wn").value.trim() || "إنذار يدوي").slice(0, 500) }) }); S.warn = await call("ruqya_warnings?select=id,phone,day,note,created_at&order=id.desc&limit=5000"); S.perr = ""; } catch (er) { S.perr = er.message; } draw();
    } else if (a === "wdel") {
      try { await call("ruqya_warnings?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "DELETE" }); S.warn = S.warn.filter(w => String(w.id) !== b.getAttribute("data-id")); S.perr = ""; } catch (er) { S.perr = er.message; } draw();
    } else if (a === "wclr") {
      if (!confirm("حذف كل إنذارات هذا المريض ورفع الحظر؟")) return;
      try { await call("ruqya_warnings?phone=eq." + encodeURIComponent(S.pat.phone), { method: "DELETE" }); S.warn = S.warn.filter(w => w.phone !== S.pat.phone); S.perr = ""; } catch (er) { S.perr = er.message; } draw();
    }
    else if (a === "pback") { S.pat = null; S.visits = []; S.msg = ""; draw(); }
    else if (a === "psave") {
      const nm = $("rq-pn").value.trim(), rg = $("rq-pr").value.trim(); if (nm.length < 2) { S.perr = "الاسم قصير"; draw(); return; }
      try { await call("ruqya_bookings?id=eq." + encodeURIComponent(S.pat.id), { method: "PATCH", body: JSON.stringify({ name: nm.slice(0, 120), commune: rg.slice(0, 120) || null }) }); S.pat.name = nm; S.pat.commune = rg; S.perr = ""; S.msg = "✅ حُفظت بيانات المريض"; await load(); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vadd") {
      const day = $("rq-vd").value; if (!day) { S.perr = "اختر تاريخ الزيارة"; draw(); return; }
      try { await call("ruqya_visits", { method: "POST", body: JSON.stringify({ booking_id: S.pat.id, day, slot: $("rq-vt").value || null, progress: $("rq-vp").value, note: $("rq-vn").value.trim().slice(0, 4000), followup: $("rq-vf").value.trim().slice(0, 2000), shared: $("rq-vs").checked }) }); S.perr = ""; S.msg = "✅ أُضيفت الزيارة"; S.visits = await call("ruqya_visits?select=*&booking_id=in.(" + pids() + ")&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vsave") {
      const card = b.closest("[data-vid]"), g = k => card.querySelector('[data-vf="' + k + '"]').value;
      try { await call("ruqya_visits?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "PATCH", body: JSON.stringify({ progress: g("progress"), note: g("note").trim().slice(0, 4000), followup: g("followup").trim().slice(0, 2000), shared: card.querySelector('[data-vf="shared"]').checked }) }); S.perr = ""; S.msg = "✅ حُفظت الزيارة"; S.visits = await call("ruqya_visits?select=*&booking_id=in.(" + pids() + ")&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    } else if (a === "vdel") {
      if (!confirm("حذف هذه الزيارة نهائياً؟")) return;
      try { await call("ruqya_visits?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "DELETE" }); S.perr = ""; S.visits = await call("ruqya_visits?select=*&booking_id=in.(" + pids() + ")&order=day.desc,slot.desc&limit=500"); } catch (er) { S.perr = er.message; } draw();
    }
    else if (a === "st") {
      const v = b.getAttribute("data-v"); if (v === "cancelled" && !confirm("إلغاء هذا الحجز؟ سيتحرر الموعد.")) return;
      try { await call("ruqya_bookings?id=eq." + encodeURIComponent(b.getAttribute("data-id")), { method: "PATCH", body: JSON.stringify({ status: v }) }); await load(); draw(); } catch (er) { S.err = er.message; draw(); }
    } else if (a === "cap") {
      const n = Math.max(1, Math.min(20, parseInt($("rq-cap").value, 10) || 1)), mx = Math.max(1, Math.min(60, parseInt($("rq-max").value, 10) || 15)), pc = Math.max(1, Math.min(30, parseInt($("rq-pcap").value, 10) || 5));
      try { await saveCfg({ cap: n, maxday: mx, pcap: pc }); S.cap = n; S.max = mx; S.pcap = pc; S.err = ""; S.msg = "✅ حُفظ"; note("حُفظت الإعدادات", true); draw(); } catch (er) { S.err = er.message; note("تعذّر الحفظ: " + er.message, false); draw(); }
    } else if (a === "cfg") { S.view = "cfg"; draw(); }
    else if (a === "cfgback") { S.view = ""; draw(); }
    else if (a === "mannew") { S.view = "man"; S.err = ""; S.man = null; draw(); }
    else if (a === "manback") { S.view = ""; S.err = ""; draw(); }
    else if (a === "mansave") {
      manKeep(); const M = S.man, ph = normPh(M.phone), name = cut(M.name.trim(), 120), n = Math.max(1, Math.min(8, parseInt(M.n, 10) || 1));
      if (!/^0[1-9][0-9]{7,8}$/.test(ph)) { S.err = "رقم الهاتف غير صحيح"; draw(); return; }
      if (name.length < 2) { S.err = "اكتب اسم المريض"; draw(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(M.day)) { S.err = "اختر اليوم"; draw(); return; }
      const i = SLOTS.indexOf(M.slot); if (i + n > SLOTS.length || (M.slot < "13:00") !== (SLOTS[i + n - 1] < "13:00")) { S.err = "الجلسات لا تتسع في هذه الفترة، قلّل العدد أو اختر ساعة أبكر"; draw(); return; }
      const kind = M.kind, per = kind === "single" ? 1 : kind === "couple" ? 2 : Math.max(1, Math.min(10, parseInt(M.per, 10) || 1));
      const used = S.rows.filter(r => r.day === M.day && r.status !== "cancelled" && (r.slot < "13:00") === (M.slot < "13:00")).reduce((t, r) => t + (Number(r.sessions) || 1), 0), cap = S.pcap || 5;
      if (used + n > cap && !confirm("هذه الفترة فيها " + used + " من " + cap + " جلسات؛ إضافة " + n + " تتجاوز الحد. هل تحجز رغم ذلك؟")) return;
      const P = Object.assign({}, DEFP, (S.cfg && S.cfg.prices) || {}), unit = kind === "kids" ? (P.kid || 0) * per : (P[kind] || 0), known = S.rows.some(r => normPh(r.phone) === ph && r.status !== "cancelled");
      b.disabled = true;
      try { await call("ruqya_bookings", { method: "POST", body: JSON.stringify({ day: M.day, slot: M.slot, slots: n, name, phone: ph, whatsapp: /^0[5-7][0-9]{8}$/.test(ph) ? ph : null, commune: cut(M.commune.trim(), 120) || null, kind, persons: per, sessions: n, session_price: unit, pack_price: 0, total: unit * n, terms: true, status: $("mn-st").value, registered: known, first_time: !known }) }); S.view = ""; S.err = ""; S.man = null; S.msg = "تم حفظ الحجز اليدوي"; await load(); } catch (er) { S.err = er.message; }
      draw();
    }
    else if (a === "ptpage") { openPt(""); }
    else if (a === "ptfile") { e.preventDefault(); openPt(b.getAttribute("data-id")); }
    else if (a === "cfgsave") {
      const lab = b.textContent; b.disabled = true; b.textContent = "جارٍ الحفظ…";
      try {
        const num = id => Math.max(0, Math.round(Number($(id).value) || 0)), prods = [];
        document.querySelectorAll("#rq-cfg [data-pp]").forEach(r => { if (!r.querySelector("[data-pon]").checked) return; const pr = (S.catalog().find(x => x.slug === r.dataset.pp) || {}); prods.push({ slug: r.dataset.pp, title: cut(pr.title || r.dataset.pp, 120), img: pr.cover || (pr.images && pr.images[0]) || "", desc: cut(r.querySelector("[data-pdesc]").value.trim(), 160), price: Math.max(0, Math.round(Number(r.querySelector("[data-pprice]").value) || 0)) }); });
        const closed = [...document.querySelectorAll("#rq-cfg [data-closed]")].filter(c => c.checked).map(c => c.getAttribute("data-closed"));
        const prices = { single: num("cf-single"), couple: num("cf-couple"), kid: num("cf-kid"), family: num("cf-family"), pack: num("cf-pack") };
        const mapUrl = $("cf-map").value.trim(); if (mapUrl && !/^https:\/\//i.test(mapUrl)) throw new Error("رابط الخريطة يجب أن يبدأ بـ https://");
        const patch = { prices, disabled: $("cf-off").checked, msg: cut($("cf-msg").value.trim(), 300), closed, address: cut($("cf-addr").value.trim(), 300), phones: cut($("cf-phones").value.trim(), 200), map: mapUrl.slice(0, 300) }; if (document.querySelectorAll("#rq-cfg [data-pp]").length) patch.products = prods;      /* قائمة المنتجات لم تُحمَّل: لا تُمسح المحفوظة */
        await saveCfg(patch); if (!patch.products) prods.length = (S.cfg.products || []).length;
        /* تحقّق بالقراءة من الخادم أن ما حُفظ هو ما أُدخل */
        const back = await call("admin_kv?select=value&key=eq.ruqya"), v = back && back[0] && back[0].value || {};
        /* مقارنة بالقيم لا بنص JSON: قاعدة البيانات تُعيد ترتيب مفاتيح الكائن فكان النص يختلف دائماً والحفظ يُعدّ فاشلاً رغم نجاحه */
        const vp = v.prices || {}, pOk = Object.keys(prices).every(k => Number(vp[k]) === prices[k]), vq = v.products || [];
        if (!pOk || vq.length !== prods.length || prods.some(x => { const y = vq.find(z => z.slug === x.slug); return !y || Number(y.price) !== x.price; })) throw new Error("لم يتطابق المحفوظ مع المُدخل، أعد المحاولة");
        S.err = ""; S.msg = "✅ حُفظت الإعدادات (" + prods.length + " منتج، " + closed.length + " عطلة)"; S.view = ""; note("حُفظت الإعدادات", true);
      } catch (er) { S.err = er.message || String(er); note("تعذّر الحفظ: " + S.err, false); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { } }
      draw(); try { window.scrollTo({ top: 0 }); } catch (_) { }
    } else if (a === "block") {
      const ph = b.getAttribute("data-ph"); if (!confirm("حظر الرقم " + ph + " من حجز المواعيد؟")) return;
      try { await call("ruqya_blocks?on_conflict=phone", { method: "POST", headers: Object.assign(API.sb.headers(await API.sb.token()), { Prefer: "resolution=merge-duplicates,return=representation" }), body: JSON.stringify({ phone: ph, reason: "حظر يدوي" }) }); S.blocks = await call("ruqya_blocks?select=phone,reason&limit=5000"); S.err = ""; S.msg = "🚫 حُظر الرقم من الحجز"; } catch (er) { S.err = er.message; } draw();
    } else if (a === "unblock") {
      const ph = b.getAttribute("data-ph");
      try { await call("ruqya_blocks?phone=eq." + encodeURIComponent(ph), { method: "DELETE" }); S.blocks = S.blocks.filter(x => x.phone !== ph); S.err = ""; S.msg = "رُفع الحظر"; } catch (er) { S.err = er.message; } draw();
    }
  });
  document.addEventListener("change", e => { if (e.target && e.target.id === "mn-phone") {
    const ph = normPh(e.target.value), r = S.rows.filter(x => normPh(x.phone) === ph).pop(), nm = $("mn-name"), cm = $("mn-com"), af = S._af || {};
    /* يُملأ الاسم والبلدية من سجل المريض المعروف، ويُستبدلان إن غيّرتَ الرقم إلى مريض آخر ما لم تعدّلهما بيدك */
    if (nm && (!nm.value.trim() || nm.value === af.name)) nm.value = r ? (r.name || "") : "";
    if (cm && (!cm.value.trim() || cm.value === af.com)) cm.value = r ? (r.commune || "") : "";
    S._af = r ? { name: r.name || "", com: r.commune || "" } : {};
    if ($("mn-known")) $("mn-known").textContent = r ? "مريض مسجَّل: " + (r.name || "") : (/^0[1-9][0-9]{7,8}$/.test(ph) ? "مريض جديد" : "");
  } });
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
