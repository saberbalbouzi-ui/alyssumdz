#!/usr/bin/env node
/* idempotency وعنوان المكتب (دمج 12B.1 مع سطر «📍 عنوان المكتب» الذي أضافته main): يشغّل OrderTruth **الفعلي** من assets/js/api.js ثم يرسل إلى submit_order الحقيقي.
   الجزء 1 (بلا شبكة): ثبات المفتاح، وأثر العنوان في البصمة، واتساق مفتاح __ik مع مفتاح الإرسال.
   الجزء 2 (--server، يتطلب BETA_SUPABASE_URL وBETA_SUPABASE_ANON_KEY وBETA_SUPABASE_REF وBETA_SUPABASE_PAT، **على مشروع Beta فقط**): إعادة الإرسال والتزامن وتغيّر العنوان على الخادم؛ طلبات اصطناعية تُحذف في النهاية.
   node scripts/test-order-desk-idempotency.js [--server] [--require-server]      الخرج: PASS/FAIL للشروط، وFINDING لسلوك موثَّق غير مطلوب نجاحه. */
const fs = require("fs"), vm = require("vm"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, ".."); const ADDR = "📍 عنوان المكتب", VOL = { grp: "🧺 مجموعة", ref: "🔗 مرجع" };
let pass = 0, fail = 0, findings = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 220))); };
const finding = (m, x) => { findings++; console.log("◆ FINDING " + m + (x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 260))); };
function client() {
  const store = new Map(), ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i], get length() { return store.size } };
  const ctx = { console, crypto: crypto.webcrypto, TextEncoder, Date, JSON, Math, Object, Array, String, Number, Promise, setTimeout, localStorage: ls, sessionStorage: ls, location: { href: "http://localhost/", origin: "http://localhost" }, navigator: {}, document: {}, CONFIG: {}, fetch: async () => { throw new Error("no network in offline part"); } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/api.js"), "utf8") + "\n;globalThis.__OT = OrderTruth;", ctx); return ctx.__OT;
}
const baseOrder = (phone) => ({ name: "اختبار عنوان المكتب", phone, wilaya: "باتنة", commune: "Barika", dtype: "desk", desk: "Agence de Barika [Guepex]", items: [{ slug: "beta-probe", title: "منتج اصطناعي", qty: 1, price: 1500 }], subtotal: 1500, fee: 400, discount: 0, total: 1900, coupon: "", extra: {} });
/* يحاكي app.js: A = سطر العنوان قبل __ik (الدمج الحالي)، B = بعده */
async function flow(OT, order, addr, mode) {
  const o = JSON.parse(JSON.stringify(order)); let ik;
  if (mode === "A") { o.extra[ADDR] = addr; ik = await OT.keyFor(o); } else { ik = await OT.keyFor(o); o.extra[ADDR] = addr; }
  o.extra[VOL.grp] = "G" + ik.key.slice(0, 8); o.extra[VOL.ref] = "REF-" + ik.key.slice(0, 6);        // ما يضيفه app.js بعد __ik (مستثنى من البصمة)
  const submit = await OT.keyFor(o); return { order: o, ik: ik.key, submit: submit.key, reused: submit.reused };
}
async function offline() {
  console.log("── الجزء 1: شيفرة العميل الفعلية (بلا شبكة) ──");
  let OT = client(); const o = baseOrder("0550990100");
  const a1 = await flow(OT, o, "حي الرياض، باتنة", "A"), a2 = await flow(OT, o, "حي الرياض، باتنة", "A");
  ok("[O1] الدمج الحالي (A): نفس الطلب والعنوان ⇒ نفس المفتاح عند إعادة الحساب (إعادة الإرسال تعيد المفتاح)", a1.submit === a2.submit && a2.reused === true, [a1.submit, a2.submit]);
  ok("[O2] A: مفتاح __ik = مفتاح الإرسال (وسم المجموعة والمرجع مستثنيان من البصمة)", a1.ik === a1.submit, [a1.ik, a1.submit]);
  OT = client(); const x = await flow(OT, o, "عنوان 1", "A"), y = await flow(OT, o, "عنوان 2", "A");
  ok("[O3] A: تغيّر نص العنوان ⇒ مفتاح مختلف (العنوان داخل البصمة) — هذا هو الأثر موضوع المراجعة", x.submit !== y.submit, [x.submit, y.submit]);
  OT = client(); const b = await flow(OT, o, "حي الرياض، باتنة", "B");
  ok("[O4] B (العنوان بعد __ik): مفتاح __ik ≠ مفتاح الإرسال ⇒ يكسر اتساق وسم المجموعة/المرجع مع مفتاح الإرسال (لذلك لا يصلح B)", b.ik !== b.submit, [b.ik, b.submit]);
  OT = client(); const v1 = await flow(OT, o, "عنوان 1", "A"); const oo = JSON.parse(JSON.stringify(v1.order)); oo.extra[VOL.grp] = "Gxxxx"; oo.extra[VOL.ref] = "REF-other"; const k2 = await OT.keyFor(oo);
  ok("[O5] وسم المجموعة ومرجع الطلب لا يغيّران المفتاح", k2.key === v1.submit);
  OT = client(); const d1 = await flow(OT, o, "حي الرياض، باتنة", "A"), o2 = baseOrder("0550990100"); o2.desk = "Hub Batna 05"; const d2 = await flow(OT, o2, "حي الرياض، باتنة", "A");
  ok("[O6] تغيّر المكتب نفسه (حقل desk) ⇒ مفتاح مختلف في كل الأحوال (ليس أثراً للعنوان)", d1.submit !== d2.submit);
}
async function server() {
  const E = process.env, need = ["BETA_SUPABASE_URL", "BETA_SUPABASE_ANON_KEY", "BETA_SUPABASE_REF", "BETA_SUPABASE_PAT"].filter((k) => !E[k]);
  if (need.length) { console.log("○ الجزء 2 SKIPPED (ناقص: " + need.join(",") + ") — ليس نجاحاً"); return process.argv.includes("--require-server") ? 3 : 0; }
  const cfg = fs.readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8"), prod = (cfg.match(/SUPABASE_URL:\s*"https:\/\/([a-z0-9]{20})\.supabase\.co"/) || [])[1]; const REF = E.BETA_SUPABASE_REF;
  if (!prod || REF === prod || !/^[a-z0-9]{20}$/.test(REF) || E.BETA_SUPABASE_URL.replace(/\/$/, "") !== `https://${REF}.supabase.co`) { console.log("✖ الجزء 2: المرجع غير صالح أو يطابق Production — أُوقف قبل أي اتصال"); return 2; }
  const URLB = E.BETA_SUPABASE_URL.replace(/\/$/, ""), MG = "https://api.supabase.com/v1/projects/" + REF + "/database/query";
  const sql = async (query) => { const r = await fetch(MG, { method: "POST", headers: { Authorization: "Bearer " + E.BETA_SUPABASE_PAT, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); if (r.status >= 300) throw new Error("sql " + r.status); return r.json(); };
  const pj = await (await fetch("https://api.supabase.com/v1/projects/" + REF, { headers: { Authorization: "Bearer " + E.BETA_SUPABASE_PAT } })).json();
  if (pj.name !== "alyssum-beta") { console.log("✖ الجزء 2: اسم المشروع ≠ alyssum-beta — أُوقف"); return 2; }
  const rpc = async (p) => { const r = await fetch(URLB + "/rest/v1/rpc/submit_order", { method: "POST", headers: { apikey: E.BETA_SUPABASE_ANON_KEY, Authorization: "Bearer " + E.BETA_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p }) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } return { status: r.status, id: typeof j === "string" ? j : null, err: j && j.message ? j.message : (typeof j === "string" ? "" : t.slice(0, 80)) }; };
  const PH = "05509902", phones = ["01", "02", "03", "04", "05"].map((s) => PH + s), keys = []; const cnt = async (ph) => +(await sql(`select count(*) n from public.orders where phone='${ph}'`))[0].n;
  const OT = client(); const sendWith = (order, key) => rpc(Object.assign({}, order, { idem: key })); console.log("── الجزء 2: submit_order الحقيقي على Beta (طلبات اصطناعية تُحذف) ──");
  try {
    /* R1: إعادة الإرسال المتتابعة بنفس المفتاح */
    let f = await flow(OT, baseOrder(phones[0]), "حي الرياض، باتنة", "A"); keys.push(f.submit); const r1 = await sendWith(f.order, f.submit), r2 = await sendWith(f.order, f.submit), r3 = await sendWith(f.order, f.submit);
    ok("[R1] إعادة الإرسال ×3 بنفس المفتاح ⇒ المعرّف نفسه (لا طلب مكرر)", !!r1.id && r1.id === r2.id && r2.id === r3.id, [r1, r2, r3]); ok("[R1] طلب واحد فقط في القاعدة", (await cnt(phones[0])) === 1);
    /* R2: التزامن */
    f = await flow(OT, baseOrder(phones[1]), "حي الرياض، باتنة", "A"); keys.push(f.submit); const par = await Promise.all(Array.from({ length: 12 }, () => sendWith(f.order, f.submit))); const ids = [...new Set(par.map((x) => x.id).filter(Boolean))];
    ok("[R2] 12 إرسالاً متزامناً بنفس المفتاح ⇒ معرّف واحد للجميع", ids.length === 1 && par.every((x) => x.id === ids[0]), { statuses: par.map((x) => x.status), ids }); ok("[R2] طلب واحد فقط في القاعدة (القفل الاستشاري يسلسل المتزامنات)", (await cnt(phones[1])) === 1);
    /* R3: نفس المفتاح بمحتوى مختلف (العنوان تغيّر والمفتاح بقي) */
    f = await flow(OT, baseOrder(phones[2]), "عنوان 1", "A"); keys.push(f.submit); const first = await sendWith(f.order, f.submit); const alt = JSON.parse(JSON.stringify(f.order)); alt.extra[ADDR] = "عنوان 2 (بعد تحديث دليل المكاتب)"; const again = await sendWith(alt, f.submit);
    ok("[R3] نفس المفتاح + عنوان مختلف ⇒ الخادم يرفض idempotency_key_reuse ولا ينشئ طلباً ثانياً", !!first.id && !again.id && /idempotency_key_reuse/.test(again.err) && (await cnt(phones[2])) === 1, { first, again });
    /* R4: العنوان تغيّر بين محاولتين (A ⇒ مفتاح جديد) */
    const OT2 = client(); const f1 = await flow(OT2, baseOrder(phones[3]), "عنوان 1", "A"), f2 = await flow(OT2, baseOrder(phones[3]), "عنوان 2 (بعد تحديث دليل المكاتب)", "A"); keys.push(f1.submit, f2.submit);
    const s1 = await sendWith(f1.order, f1.submit), s2 = await sendWith(f2.order, f2.submit), n4 = await cnt(phones[3]);
    if (n4 === 2) finding("[R4] A: لو تغيّر نص العنوان بين محاولة وإعادتها (خلال 30 دقيقة) يُنشأ طلب ثانٍ (مفتاح جديد) — ثغرة ضيقة موثَّقة؛ شبكة duplicate_order اختيارية ومعطَّلة افتراضياً", { s1: s1.id, s2: s2.id, orders: n4 });
    else finding("[R4] A: مع تغيّر العنوان لم يُنشأ طلب ثانٍ (رفضه الخادم)", { s1, s2, orders: n4 });
    /* R5: الحل C المقترح (استثناء العنوان من البصمة على الخادم) لا يُجرَّب هنا لأنه تعديل SQL إنتاجي */
  } finally {
    const ks = keys.map((k) => `'${String(k).replace(/'/g, "''")}'`).join(",");
    const d1 = await sql(`delete from public.orders where phone in (${phones.map((p) => `'${p}'`).join(",")}) returning 1`); const d2 = keys.length ? await sql(`delete from public.order_idem where k in (${ks}) returning 1`) : [];
    console.log(`تنظيف: حُذف ${d1.length} طلباً اصطناعياً و${d2.length} مفتاح idem`);
  }
  return 0;
}
(async () => { await offline(); let rc = 0; if (process.argv.includes("--server")) rc = await server(); else console.log("○ الجزء 2 لم يُطلب (--server) — NOT TESTED");
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل، ${findings} ملاحظة موثَّقة`); process.exit(fail ? 1 : rc); })().catch((e) => { console.log("✗ استثناء: " + e.message); process.exit(1); });
