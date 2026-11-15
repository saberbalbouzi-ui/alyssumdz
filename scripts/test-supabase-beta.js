#!/usr/bin/env node
// حزمة SQL الخاصة بـBeta + حراسات أداة التطبيق (بلا شبكة) + تدريب على PostgreSQL 16 محلي معزول (ليس Supabase الحقيقي: لا GoTrue ولا Storage API ولا PostgREST).
// الجزء الأخير يُتخطّى بوضوح (SKIPPED) إن لم يتوفر PostgreSQL محلي. نتيجة الاختبار الحقيقي على مشروع Beta: platform/supabase/tests/beta/beta-supabase.integration.mjs (لم يُشغَّل بعد).
const fs = require("fs"), path = require("path"), os = require("os"), { spawnSync } = require("child_process"); const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0, skipped = []; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(JSON.stringify(x)).slice(0, 260))); };
(async () => {
  const T = await import(path.join(ROOT, "scripts/supabase-beta-apply.mjs")); const cfg = T.loadConfig(); const EMAIL = "beta-admin@example.test";
  /* A: الحزمة */
  const b = T.buildBundle({ adminEmail: EMAIL }), names = b.files.map((f) => f.path), req = cfg.M.supabase.sql_apply_order.required;
  ok("[A1] الحزمة تبنى بلا مشاكل: الملفات المطلوبة بالترتيب المسجَّل + صف المدير", b.problems.length === 0 && JSON.stringify(names.slice(0, req.length)) === JSON.stringify(req) && names.at(-1) === "(generated) admins", b.problems);
  const runLocal = fs.readFileSync(path.join(ROOT, "platform/supabase/tests/local/run-local.sh"), "utf8").match(/for f in ([^;]+);/)[1].split(/\s+/).map((f) => "platform/" + f), idx = req.map((f) => runLocal.indexOf(f));
  ok("[A2] الترتيب المطلوب مستخرَج بالترتيب نفسه من run-local.sh (المُتحقَّق على PostgreSQL 16) وكل ملف فيه", idx.every((i) => i >= 0) && idx.every((v, i) => i === 0 || idx[i - 1] < v), { idx });
  ok("[A3] apply-pending.sql مستبعَد؛ hub.sql مضمَّن لكن بلا بذرة مستودع Production (hub_sites/hub_members فارغان)", !names.some((n) => /apply-pending/.test(n)) && cfg.M.supabase.sql_apply_order.excluded.length === 1 && names.includes("platform/supabase/hub.sql") && !/insert into public\.hub_/.test(b.files.find((f) => f.path.endsWith("hub.sql")).sql));
  const sch = b.files.find((f) => f.path === "platform/sql/schema.sql").sql; ok("[A4] بذور المالك استُبدلت: مدير Beta فقط، بلا عميل/موقع Production", sch.includes(`values ('${EMAIL}', 'Beta Admin', 'owner')`) && !sch.includes("saas_sites where origin = 'https://alyssumdz.com'") && !/saber\.balbouzi|alyssumdz\.com|qvdaiund/i.test(sch));
  ok("[A5] لا أي علامة هوية إنتاجية في أي ملف من الحزمة (مضيف/مرجع/مفتاح عام/بريد/رقم)", !b.files.some((f) => [...cfg.N.identity_markers, ...cfg.N.hosts, ...cfg.N.supabase_refs, ...cfg.N.public_key_markers].some((m) => f.sql.toLowerCase().includes(m.toLowerCase()))));
  ok("[A6] بريد المالك الإنتاجي مرفوض كبريد مدير Beta؛ بريد غير صالح مرفوض", T.buildBundle({ adminEmail: "saber.balbouzi@gmail.com" }).problems.length > 0 && T.buildBundle({ adminEmail: "x" }).problems.length > 0 && T.buildBundle({ adminEmail: "" }).problems.length > 0);
  /* B: حراسات الأداة */
  const REF = "abcdefghijklmnopqrst", env = { BETA_SUPABASE_REF: REF, BETA_SUPABASE_PAT: "sbp_FAKE_PAT_VALUE_0123456789", BETA_ADMIN_EMAIL: EMAIL }; const calls = []; let name = "alyssum-beta";
  const fx = async (url, init = {}) => { calls.push({ url, method: init.method || "GET", auth: init.headers?.Authorization }); if (/\/database\/query$/.test(url)) return { status: 201, text: async () => "[]", json: async () => [] }; return { status: 200, json: async () => ({ name }), text: async () => "" }; };
  const go = async (argv, e = env) => { const logs = []; const r = await T.run({ argv, env: e, fetchFn: fx, log: (...a) => logs.push(a.join(" ")) }); return { ...r, logs: logs.join("\n") }; };
  const dry = await go(["--dry-run"]); ok("[B1] dry-run: لا شبكة", dry.code === 0 && calls.length === 0);
  let r = await go(["--apply"]); ok("[B2] --apply بلا --confirm-ref ← رفض (لا اتصال)", r.code === 2 && calls.length === 0, r.logs);
  r = await go(["--apply", "--confirm-ref", "zzzzzzzzzzzzzzzzzzzz"]); ok("[B3] --confirm-ref لا يطابق المرجع ← رفض", r.code === 2 && calls.length === 0);
  r = await go(["--apply", "--confirm-ref", cfg.R.environments.production.supabase_ref], { ...env, BETA_SUPABASE_REF: cfg.R.environments.production.supabase_ref }); ok("[B4] مرجع Production ← رفض صريح قبل أي اتصال", r.code === 2 && /Production/.test(r.logs) && calls.length === 0, r.logs);
  r = await go(["--apply", "--confirm-ref", REF], { ...env, BETA_SUPABASE_PAT: "" }); ok("[B5] بلا PAT ← رفض", r.code === 2 && calls.length === 0);
  for (const bad of ["ALYSSUMDZ", "imaginia-staging", "اسم-آخر"]) { calls.length = 0; name = bad; r = await go(["--apply", "--confirm-ref", REF]); ok(`[B6] اسم المشروع المُسترجَع '${bad}' ≠ alyssum-beta ← يُوقَف قبل أي تطبيق SQL`, r.code === 2 && !calls.some((c) => /database\/query/.test(c.url)), r.logs); }
  calls.length = 0; name = "alyssum-beta"; r = await go(["--apply", "--confirm-ref", REF]); const qs = calls.filter((c) => /database\/query/.test(c.url));
  ok("[B7] مشروع بالاسم الصحيح: تُطبَّق الملفات بالترتيب (7 طلبات POST) بـBearer PAT، ولا يُطبع PAT/كلمة مرور", r.code === 0 && qs.length === b.files.length && qs.every((c) => c.method === "POST" && /^Bearer sbp_/.test(c.auth)) && !r.logs.includes("sbp_FAKE_PAT"), { n: qs.length });
  ok("[B8] كل الطلبات إلى api.supabase.com/v1/projects/<ref> الخاص بـBeta فقط", calls.every((c) => c.url.startsWith("https://api.supabase.com/v1/projects/" + REF)));
  /* C: PostgreSQL محلي */
  const B = process.env.PGBIN || "/usr/lib/postgresql/16/bin"; if (!fs.existsSync(B + "/initdb")) { skipped.push("PostgreSQL محلي غير متوفر (" + B + ")"); }
  else {
    const D = fs.mkdtempSync(path.join(os.tmpdir(), "pgsb-")), P = String(5400 + Math.floor(Math.random() * 500)), root = process.getuid && process.getuid() === 0, sh = (cmd) => spawnSync("bash", ["-c", root ? `su postgres -c '${cmd.replace(/'/g, "'\\''")}'` : cmd], { encoding: "utf8" });
    if (root) fs.chownSync(D, 0, 0) || spawnSync("chown", ["postgres:postgres", D]); if (root) spawnSync("chown", ["postgres:postgres", D]);
    const psql = (db, args, input) => spawnSync("bash", ["-c", `${root ? "su postgres -c " : ""}${root ? `'` : ""}${B}/psql -h ${D} -p ${P} -U postgres -d ${db} -v ON_ERROR_STOP=0 ${args}${root ? `'` : ""}`], { encoding: "utf8", input });
    try {
      const init = sh(`${B}/initdb -D ${D}/data -U postgres -A trust`); if (init.status !== 0) throw new Error("initdb: " + init.stderr.slice(0, 200));
      sh(`${B}/pg_ctl -D ${D}/data -o "-p ${P} -k ${D} -c listen_addresses="  -l ${D}/pg.log -w start`); sh(`${B}/createdb -h ${D} -p ${P} -U postgres rls`);
      const L = path.join(ROOT, "platform/supabase/tests/local"); psql("rls", `-q -f ${L}/bootstrap.sql`); psql("rls", `-q -f ${L}/bootstrap2.sql`);
      let errs = 0; const errl = []; for (const f of b.files) { const tmp = path.join(D, "f.sql"); fs.writeFileSync(tmp, f.sql); if (root) fs.chmodSync(tmp, 0o644); const o = psql("rls", `-q -f ${tmp}`); const m = (o.stderr || "").match(/ERROR:[^\n]*/g) || []; errs += m.length; if (m.length) errl.push(f.path + " → " + m.join(" | ").slice(0,300)); }
      const qq = (sql) => psql("rls", "-At -f -", sql), q = (sql) => (qq(sql).stdout || "").trim().split("\n").filter((l) => !/^(BEGIN|SET|COMMIT|ROLLBACK)$/.test(l) && !l.startsWith("{")).pop() || "";
      ok("[C1] تطبيق الحزمة على PostgreSQL 16 المحلي: لا أخطاء ERROR", errs === 0, errl);
      ok("[C2] لكل جدول في public تفعيل RLS (باستثناء قائمة السماح المعلنة)", q("select string_agg(tablename, ',') from pg_tables where schemaname='public' and not rowsecurity") === "", q("select string_agg(tablename, ',') from pg_tables where schemaname='public' and not rowsecurity"));
      ok("[C3] saas_admins: مدير Beta فقط (1 صف، لا بريد مالك)؛ لا عملاء ولا مواقع؛ admins: بريد Beta", q("select count(*) from public.saas_admins") === "1" && q(`select count(*) from public.saas_admins where email='${EMAIL}'`) === "1" && q("select count(*) from public.saas_customers") === "0" && q("select count(*) from public.saas_sites") === "0" && q(`select count(*) from public.admins where email='${EMAIL}'`) === "1");
      ok("[C4] لا أثر نصي لهوية Production في أي جدول (saas_*/admins)", q("select count(*) from (select email e from public.saas_admins union all select email from public.admins) t where e ilike '%balbouzi%'") === "0");
      const claim = (role, email) => `begin; set local role ${role}; select set_config('request.jwt.claims','{"role":"${role}","email":"${email}"}',true);`;
      { const raw = qq(`${claim("anon", "")} select public.is_admin(); rollback;`); ok("[C5] anon لا ينفّذ is_admin() (permission denied — تشديد hardening-v01)", /permission denied for function is_admin/.test(raw.stderr || ""), (raw.stdout + raw.stderr).slice(0, 200)); }
      const adm = q(`${claim("authenticated", EMAIL)} select public.is_admin(); rollback;`), oth = q(`${claim("authenticated", "other@example.test")} select public.is_admin(); rollback;`); ok("[C5] مدير Beta → t؛ غيره → f", /t$/.test(adm) && /f$/.test(oth), { adm, oth });
      const denied = qq(`${claim("anon", "")} select count(*) from public.orders; rollback;`); ok("[C6] anon لا يقرأ orders (permission denied/ RLS)", /permission denied/.test((denied.stderr || "") + (denied.stdout || "")), (denied.stderr + denied.stdout).slice(0, 120));
      const pl = JSON.stringify({ name: "زبون اختبار Beta", phone: "0550777001", wilaya: "الجزائر", commune: "مركز", dtype: "home", items: [{ slug: "demo", title: "منتج تجريبي", qty: 1, price: 2000 }], subtotal: 2000, fee: 400, total: 2400, idem: "betak1aaaaaaaaaaaaaaaa" }).replace(/'/g, "''");
      const sub = q(`${claim("anon", "")} select public.submit_order('${pl}'::jsonb); commit;`); ok("[C7] anon يستدعي submit_order بنجاح (معرّف طلب بصيغة S######-XXXXXXXX)", /S\d{6}-[0-9A-F]{8}$/.test(sub), sub);
      const sub2 = q(`${claim("anon", "")} select public.submit_order('${pl}'::jsonb); commit;`); ok("[C7] إعادة بالمفتاح نفسه ← المعرّف نفسه (لا طلب مكرر)", sub2.split("\n").pop() === sub.split("\n").pop() && q("select count(*) from public.orders where phone='0550777001'") === "1", { sub, sub2 });
    } catch (e) { ok("[C] تدريب PostgreSQL: " + String(e.message).slice(0, 160), false); }
    finally { sh(`${B}/pg_ctl -D ${D}/data -m immediate stop`); try { fs.rmSync(D, { recursive: true, force: true }); } catch { } }
  }
  if (skipped.length) console.log("SKIPPED:", skipped.join("; "), "— لم يُشغَّل؛ ليس نجاحاً");
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل${skipped.length ? "، " + skipped.length + " متخطّى" : ""}`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
