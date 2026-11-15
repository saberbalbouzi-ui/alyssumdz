#!/usr/bin/env node
/* اختبار تكامل Supabase **Beta** (Auth + Database/RLS + Storage). يعمل على مشروع Beta فقط؛ لم يُشغَّل على أي مشروع حقيقي بعد (المشروع لم يُنشأ) ← الحالة BLOCKED حتى تتوفر بيانات الاعتماد.
   المتغيّرات (من بيئة الصدفة/GitHub Environment 'beta' فقط؛ لا تُكتب في ملفات ولا تُطبع):
     BETA_SUPABASE_URL=https://<ref>.supabase.co  BETA_SUPABASE_REF=<ref>  BETA_SUPABASE_ANON_KEY (عام)  BETA_SUPABASE_PAT  BETA_ADMIN_EMAIL  BETA_ADMIN_PASSWORD
   الأوضاع: --selfcheck (الحراسات فقط، بلا شبكة) | افتراضي: الاختبار الحقيقي — ناقص المتغيرات ← "RESULT: SKIPPED" (رمز 0؛ مع --require رمز 3). SKIPPED ≠ نجاح.
   الحراسات (قبل أي اتصال): المرجع ≠ مرجع Production/مشاريع محمية؛ الرابط = https://<ref>.supabase.co؛ مفتاح anon ليس service_role ولا sb_secret_ وإن كان JWT فـref/role يطابقان؛ بريد المدير ≠ هوية المالك؛ اسم المشروع المُسترجَع = alyssum-beta.
   لا يستعمل service_role أبداً. يكتب في Beta فقط: طلب تجريبي واحد برقم هاتف اصطناعي يُحذف في النهاية، وكل الكتابات المرفوضة متوقَّعة الرفض. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const HERE = path.dirname(new URL(import.meta.url).pathname), REG = JSON.parse(readFileSync(path.join(HERE, "../../../env/environments.json"), "utf8"));
const PROTECTED_REFS = new Set([REG.environments.production.supabase_ref, ...(REG.never_outside_production.supabase_refs ?? [])].filter(Boolean));
const PROTECTED_NAMES = new Set(REG.never_outside_production.other_project_names ?? []);
const BETA_NAME = REG.environments.beta.supabase_project_name, MARKERS = (REG.never_outside_production.identity_markers ?? []).map((m) => m.toLowerCase());
const b64 = (s) => { try { return JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; } };

export function guard(env) {
  const bad = [], ref = String(env.BETA_SUPABASE_REF || ""), url = String(env.BETA_SUPABASE_URL || ""), key = String(env.BETA_SUPABASE_ANON_KEY || ""), email = String(env.BETA_ADMIN_EMAIL || "");
  if (!/^[a-z0-9]{20}$/.test(ref)) bad.push("BETA_SUPABASE_REF غير صالح");
  if (PROTECTED_REFS.has(ref)) bad.push("المرجع مشروع Production/محمي — مرفوض");
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url); if (!m) bad.push("BETA_SUPABASE_URL غير صالح (https://<ref>.supabase.co)"); else if (m[1] !== ref) bad.push("الرابط لا يطابق BETA_SUPABASE_REF");
  if (!key) bad.push("BETA_SUPABASE_ANON_KEY مفقود");
  else if (/^sb_secret_/.test(key)) bad.push("المفتاح سرّي (sb_secret_) — يُسمح بالمفتاح العام فقط");
  else if (key.split(".").length === 3) { const p = b64(key.split(".")[1]); if (!p) bad.push("المفتاح JWT غير مقروء"); else { if (p.role !== "anon") bad.push(`دور المفتاح '${p.role}' ≠ anon (مرفوض: service_role وغيره)`); if (p.ref && p.ref !== ref) bad.push("مفتاح anon يخص مشروعاً آخر (ref لا يطابق)"); } }
  else if (!/^sb_publishable_/.test(key)) bad.push("صيغة المفتاح غير معروفة");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push("BETA_ADMIN_EMAIL غير صالح"); else if (MARKERS.some((x) => email.toLowerCase().includes(x))) bad.push("BETA_ADMIN_EMAIL يطابق هوية المالك الإنتاجية");
  if (!env.BETA_SUPABASE_PAT) bad.push("BETA_SUPABASE_PAT مفقود"); if (!env.BETA_ADMIN_PASSWORD) bad.push("BETA_ADMIN_PASSWORD مفقود");
  return bad;
}
const NEED = ["BETA_SUPABASE_URL", "BETA_SUPABASE_REF", "BETA_SUPABASE_ANON_KEY", "BETA_SUPABASE_PAT", "BETA_ADMIN_EMAIL", "BETA_ADMIN_PASSWORD"];
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(JSON.stringify(x)).slice(0, 240))); };
const end = (r, code) => { console.log("RESULT: " + r); process.exit(code); };

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--selfcheck")) {
    const ref = "abcdefghij0123456789", good = { BETA_SUPABASE_REF: ref, BETA_SUPABASE_URL: `https://${ref}.supabase.co`, BETA_SUPABASE_ANON_KEY: "sb_publishable_FAKE", BETA_SUPABASE_PAT: "x", BETA_ADMIN_EMAIL: "beta-admin@example.test", BETA_ADMIN_PASSWORD: "x" };
    const jwt = (o) => "e30." + Buffer.from(JSON.stringify(o)).toString("base64url") + ".sig", has = (e, re) => guard(e).some((x) => re.test(x));
    ok("[G1] إعداد سليم ← بلا مشاكل", guard(good).length === 0, guard(good));
    ok("[G2] مرجع Production مرفوض", has({ ...good, BETA_SUPABASE_REF: REG.environments.production.supabase_ref, BETA_SUPABASE_URL: `https://${REG.environments.production.supabase_ref}.supabase.co` }, /Production/));
    ok("[G3] رابط لا يطابق المرجع مرفوض", has({ ...good, BETA_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }, /لا يطابق/));
    ok("[G4] مفتاح service_role (JWT) مرفوض", has({ ...good, BETA_SUPABASE_ANON_KEY: jwt({ role: "service_role", ref }) }, /service_role/));
    ok("[G5] مفتاح sb_secret_ مرفوض", has({ ...good, BETA_SUPABASE_ANON_KEY: "sb_secret_X" }, /سرّي/));
    ok("[G6] مفتاح anon لمشروع آخر مرفوض", has({ ...good, BETA_SUPABASE_ANON_KEY: jwt({ role: "anon", ref: "zzzzzzzzzzzzzzzzzzzz" }) }, /مشروعاً آخر/));
    ok("[G7] مفتاح anon بنفس المشروع مقبول", !guard({ ...good, BETA_SUPABASE_ANON_KEY: jwt({ role: "anon", ref }) }).length);
    ok("[G8] بريد مدير = هوية المالك مرفوض", has({ ...good, BETA_ADMIN_EMAIL: "saber.balbouzi@gmail.com" }, /هوية المالك/));
    ok("[G9] بلا PAT/كلمة مرور مرفوض", has({ ...good, BETA_SUPABASE_PAT: "" }, /PAT/) && has({ ...good, BETA_ADMIN_PASSWORD: "" }, /PASSWORD/));
    end(`${pass} pass / ${fail} fail (selfcheck — حراسات فقط، بلا شبكة)`, fail ? 1 : 0);
  }
  const missing = NEED.filter((k) => !process.env[k]);
  if (missing.length) end("SKIPPED (missing: " + missing.join(",") + ") — لم يُشغَّل؛ ليس نجاحاً", argv.includes("--require") ? 3 : 0);
  const E = process.env, bad = guard(E); if (bad.length) { for (const b of bad) console.log("✖ " + b); end("FAIL: الحراسات رفضت الإعداد قبل أي اتصال", 2); }
  const URLB = E.BETA_SUPABASE_URL.replace(/\/$/, ""), REF = E.BETA_SUPABASE_REF, ANON = E.BETA_SUPABASE_ANON_KEY, MGMT = "https://api.supabase.com/v1/projects/" + REF;
  const mg = async (p, o = {}) => { const r = await fetch(MGMT + p, { ...o, headers: { Authorization: "Bearer " + E.BETA_SUPABASE_PAT, "Content-Type": "application/json" } }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const sql = async (query) => { const r = await mg("/database/query", { method: "POST", body: JSON.stringify({ query }) }); if (r.status >= 300) throw new Error("sql HTTP " + r.status); return r.body; };
  const api = async (p, { token, method = "GET", body, headers = {} } = {}) => { const r = await fetch(URLB + p, { method, headers: { apikey: ANON, Authorization: "Bearer " + (token || ANON), "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } return { status: r.status, json: j, text: t }; };
  const PHONE = "0550990001"; let token = null;
  try {
    /* P: هوية المشروع قبل أي كتابة */
    const pj = await mg(""); ok("[P1] المشروع المُسترجَع اسمه = " + BETA_NAME + " وليس مشروعاً محمياً", pj.status === 200 && pj.body?.name === BETA_NAME && !PROTECTED_NAMES.has(pj.body?.name), { status: pj.status, name: pj.body?.name });
    if (!(pj.status === 200 && pj.body?.name === BETA_NAME)) end("FAIL: هوية المشروع لا تطابق Beta — أُوقف قبل أي كتابة", 2);
    /* DB: بنية وعزل */
    const noRls = await sql("select tablename from pg_tables where schemaname='public' and not rowsecurity"); ok("[D1] RLS مفعّل على كل جداول public", noRls.length === 0, noRls);
    const adm = await sql("select (select count(*) from public.saas_admins) a, (select count(*) from public.saas_admins where lower(email)=lower('" + E.BETA_ADMIN_EMAIL.replace(/'/g, "''") + "')) b, (select count(*) from public.saas_customers) c, (select count(*) from public.saas_sites) s, (select count(*) from public.hub_sites) h, (select count(*) from public.orders where coalesce(phone,'') <> '" + PHONE + "') o");
    ok("[D2] مدير Beta فقط؛ لا عملاء/مواقع/مستودعات Production", +adm[0].a === 1 && +adm[0].b === 1 && +adm[0].c === 0 && +adm[0].s === 0 && +adm[0].h === 0, adm[0]);
    const idn = await sql("select count(*) n from (select email e from public.admins union all select email from public.saas_admins) t where " + (MARKERS.length ? MARKERS.map((m) => `e ilike '%${m.replace(/'/g, "''")}%'`).join(" or ") : "false")); ok("[D3] لا أثر لبريد/هوية المالك الإنتاجية في جداول المديرين", +idn[0].n === 0, idn);
    /* A: Auth */
    const cfg = await mg("/config/auth"); const signupOff = cfg.status === 200 && cfg.body?.disable_signup === true; ok("[A1] التسجيل العام معطَّل (disable_signup=true)", signupOff, { status: cfg.status, disable_signup: cfg.body?.disable_signup });
    if (signupOff) { const rnd = "beta-probe-" + Math.random().toString(36).slice(2, 10) + "@example.test", su = await api("/auth/v1/signup", { method: "POST", body: { email: rnd, password: "Pr0be-" + Math.random().toString(36).slice(2) } }); ok("[A2] محاولة تسجيل مستخدم جديد مرفوضة", su.status >= 400 && !su.json?.access_token, { status: su.status }); }
    else ok("[A2] لم تُجرَّ محاولة التسجيل لأن التسجيل العام غير معطَّل (لا ننشئ مستخدمين في Beta)", false, "فعّل disable_signup أولاً");
    const wrong = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email: E.BETA_ADMIN_EMAIL, password: E.BETA_ADMIN_PASSWORD + "_x" } }); ok("[A3] كلمة مرور خاطئة مرفوضة", wrong.status === 400 && !wrong.json?.access_token, { status: wrong.status });
    const li = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email: E.BETA_ADMIN_EMAIL, password: E.BETA_ADMIN_PASSWORD } }); token = li.json?.access_token; ok("[A4] دخول مدير Beta ينجح ويُصدِر جلسة", li.status === 200 && !!token, { status: li.status });
    if (token) { const me = await api("/auth/v1/user", { token }); ok("[A5] الجلسة تعود ببريد مدير Beta", me.json?.email?.toLowerCase() === E.BETA_ADMIN_EMAIL.toLowerCase(), { status: me.status }); }
    /* R: RLS عبر PostgREST */
    const isA = await api("/rest/v1/rpc/is_admin", { token, method: "POST", body: {} }); ok("[R1] is_admin() = true للمدير", token && isA.json === true, { status: isA.status, v: isA.json });
    const isAnon = await api("/rest/v1/rpc/is_admin", { method: "POST", body: {} }); ok("[R2] anon لا ينفّذ is_admin() (مرفوض)", isAnon.status >= 400 && isAnon.json !== true, { status: isAnon.status });
    for (const t of ["orders", "staff", "saas_admins", "audit_log", "pixabay_cache", "admins"]) { const r = await api(`/rest/v1/${t}?select=*&limit=1`); ok(`[R3] anon لا يقرأ ${t}`, r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), { status: r.status }); }
    /* S: submit_order الاصطناعي (يكتب في Beta فقط) + منع التكرار */
    const key = "betaprobe" + Math.random().toString(36).slice(2, 14), pl = { name: "اختبار Beta اصطناعي", phone: PHONE, wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "beta-probe", title: "منتج اصطناعي", qty: 1, price: 1000 }], subtotal: 1000, fee: 0, total: 1000, idem: key };
    const s1b = await api("/rest/v1/rpc/submit_order", { method: "POST", body: { p: pl } }); const id1 = typeof s1b.json === "string" ? s1b.json : null;
    ok("[S1] anon يرسل طلباً اصطناعياً فيُقبل (معرّف S######-XXXXXXXX)", /^S\d{6}-[0-9A-F]{8}$/.test(id1 || ""), { status: s1b.status, body: s1b.text?.slice(0, 120) });
    if (id1) { const s2 = await api("/rest/v1/rpc/submit_order", { method: "POST", body: { p: pl } }); ok("[S2] إعادة نفس المفتاح تعيد المعرّف نفسه (بلا طلب مكرر)", s2.json === id1 && +(await sql(`select count(*) n from public.orders where phone='${PHONE}'`))[0].n === 1, { status: s2.status }); }
    /* ST: Storage */
    const bk = await sql("select id, public from storage.buckets order by id"), ids = bk.map((b) => b.id); ok("[ST1] الحاويتان tenants وeditor موجودتان", ids.includes("tenants") && ids.includes("editor"), ids);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==", "base64");
    const up = async (bucket, name, tok, ctype = "image/png") => { const r = await fetch(`${URLB}/storage/v1/object/${bucket}/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + (tok || ANON), "Content-Type": ctype, "x-upsert": "false" }, body: png }); return { status: r.status, text: (await r.text()).slice(0, 120) }; };
    const stamp = "beta-probe-" + Date.now();
    const u1 = await up("tenants", `${stamp}/a.png`); ok("[ST2] anon لا يكتب في tenants (لا سياسة كتابة)", u1.status >= 400, u1);
    const u2 = token ? await up("tenants", `${stamp}/b.png`, token) : { status: 0 }; ok("[ST3] حتى المدير لا يكتب في tenants بالجلسة (الكتابة service_role حصراً)", u2.status >= 400, u2);
    const u3 = await up("editor", `${stamp}/c.png`); ok("[ST4] anon لا يرفع إلى editor بلا منحة رفع (editor.upload_grants)", u3.status >= 400, u3);
    const u4 = await up("editor", `${stamp}/d.txt`, null, "text/plain"); ok("[ST5] نوع غير مسموح (text/plain) مرفوض", u4.status >= 400, u4);
    const left = await sql(`select count(*) n from storage.objects where name like '${stamp}%'`); ok("[ST6] لا كائنات تُركت من محاولات الرفع المرفوضة", +left[0].n === 0, left);
  } catch (e) { ok("[X] استثناء غير متوقع: " + String(e.message).slice(0, 160), false); }
  finally {
    try { const d = await sql(`delete from public.orders where phone='${PHONE}' returning 1`); console.log("تنظيف: حُذف", d.length, "طلب اصطناعي"); } catch (e) { console.log("تنظيف فشل:", String(e.message).slice(0, 80)); }
  }
  end(`${pass} pass / ${fail} fail`, fail ? 1 : 0);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
