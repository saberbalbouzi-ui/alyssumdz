#!/usr/bin/env node
// اتساق سجل موارد Beta وأسماء الأسرار + أن اختبارات التكامل تتخطى بصدق دون بيانات اعتماد وترفض الهويات الإنتاجية + فحص تسرّب أسرار في ملفات Beta. بلا شبكة.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process"), ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(JSON.stringify(x)).slice(0, 260))); };
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")), R = J("platform/env/environments.json"), M = J("platform/env/beta-resources.json"), B = R.environments.beta, P = R.environments.production;
const run = (args, env = {}) => spawnSync("node", args, { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_PATH: process.env.NODE_PATH || "", ...env } });
/* R: الموارد */
const res = M.cloudflare.resources, names = new Set(res.map((r) => r.name)), prodNames = [P.cf_worker, P.cf_d1, P.gateway_worker, P.gateway_d1, P.api_host, P.gateway_host, P.app_host, P.pages_project].filter(Boolean);
ok("[R1] كل مورد له id/type/name/approval/status/created_by وid فريد", res.every((r) => r.id && r.type && r.name && typeof r.approval === "boolean" && r.status && r.created_by) && new Set(res.map((r) => r.id)).size === res.length);
ok("[R2] لا مورد Beta يحمل اسم/مضيف Production", !res.some((r) => prodNames.some((n) => r.name === n || r.name.startsWith(n + "/"))), res.filter((r) => prodNames.includes(r.name)).map((r) => r.name));
ok("[R3] أسماء الموارد تطابق سجل البيئات (D1/Workers/Pages/المضيفات)", [B.cf_d1, B.gateway_d1, B.cf_worker, B.gateway_worker, B.pages_project, B.app_host, B.api_host + "/*", B.gateway_host + "/*"].every((n) => names.has(n)), [...names]);
ok("[R4] كل موارد Beta تتطلب موافقة صريحة وحالتها NOT CREATED أو CREATED (لا حالة أخرى)، والمنشأ منها قاعدتا D1 فقط (لا Worker ولا مسار ولا DNS)", res.every((r) => r.approval === true && /^(NOT CREATED|CREATED)/.test(r.status)) && res.filter((r) => /^CREATED/.test(r.status)).every((r) => r.type === "d1_database"), res.map((r) => r.status.slice(0, 40)));
ok("[R5] مشروع Supabase: الاسم alyssum-beta ومحظور مطابقة Production/imaginia-staging", M.supabase.project.name === B.supabase_project_name && M.supabase.project.must_not_equal.includes(P.supabase_ref) && M.supabase.project.must_not_equal.includes("imaginia-staging"));
ok("[R6] رمز النشر خارج GitHub؛ رمز الاختبار D1:Edit فقط بلا Workers/Pages/DNS/Routes", /خارج GitHub/.test(M.cloudflare.api_token_scopes.beta_deploy_token.where) && M.cloudflare.api_token_scopes.beta_test_token.permissions.length === 1 && /D1/.test(M.cloudflare.api_token_scopes.beta_test_token.permissions[0]));
ok("[R7] رمز النشر لا يشمل DNS ولا مناطق Production", M.cloudflare.api_token_scopes.beta_deploy_token.permissions.every((p) => !/^DNS/.test(p)) && M.cloudflare.api_token_scopes.beta_deploy_token.excluded.some((e) => /DNS/.test(e)));
ok("[R8] Chargily: قاعدة الاختبار فقط ومطابقة للسجل", M.chargily.api_base === B.chargily_api && /\/test\/api\/v2$/.test(M.chargily.api_base));
/* S: الأسرار والمتغيرات */
const V = M.github.variables, S = M.github.secrets, all = [...V, ...S], nm = all.map((x) => x.name), tests = M.integration_tests;
ok("[S1] كل الأسماء بادئتها BETA_ وفريدة", nm.every((n) => /^BETA_[A-Z0-9_]+$/.test(n)) && new Set(nm).size === nm.length, nm);
ok("[S2] لا قيم داخل السجل (لا حقل value/default) ولا أنماط مفاتيح", !all.some((x) => "value" in x || "default" in x) && !/(sbp_[a-z0-9]{20}|sb_secret_|eyJ[A-Za-z0-9_-]{30,}|test_sk_[A-Za-z0-9]{12,}|live_sk_)/i.test(JSON.stringify(M)));
ok("[S3] طريقة إدخال كل سرّ: gh secret set … --env beta (أو لوحة المزوّد) مع تنبيه عدم اللصق في المحادثة", S.every((s) => /--env alyssumdz-beta/.test(s.enter) && s.rotate !== undefined) , S.filter((s) => !/--env alyssumdz-beta/.test(s.enter)).map((s) => s.name));
ok("[S4] المتغيرات غير السرّية فقط في variables والسرّية في secrets (PAT/كلمات المرور/الرموز/مفتاح chargily)", S.every((s) => s.kind === "secret") && V.every((v) => v.kind !== "secret") && ["BETA_SUPABASE_PAT", "BETA_ADMIN_PASSWORD", "BETA_CF_API_TOKEN", "BETA_CHARGILY_TEST_SECRET_KEY", "BETA_API_ADMIN_TOKEN"].every((n) => S.some((s) => s.name === n)));
ok("[S5] service_role لا يُخزَّن في GitHub: لا اسم يطابق service_role أو مفتاح سرّي لـSupabase", !nm.some((n) => /SERVICE_?ROLE|SB_SECRET/i.test(n)) && M.supabase.rules.some((r) => /service_role/.test(r)));
ok("[S6] كل اختبار تكامل: ملفه موجود ومتطلباته كلها معرَّفة أسماء ضمن variables/secrets وrequired_for يذكره", tests.every((t) => fs.existsSync(path.join(ROOT, t.file)) && t.requires.every((n) => nm.includes(n)) && t.requires.every((n) => all.find((x) => x.name === n).required_for.includes(t.id))), tests.map((t) => t.id));
ok("[S7] الأسرار لا تظهر في أي سطر مفعّل بملفات Beta (البحث عن name=قيمة غير القالب)", ["platform/env/beta.env.example"].every((f) => !/^BETA_[A-Z_]*(TOKEN|PAT|PASSWORD|KEY)=(?!<)/m.test(fs.readFileSync(path.join(ROOT, f), "utf8"))));
/* G: التوليد */
const g = run(["platform/env/gen-beta-env.mjs", "--check"]); ok("[G1] beta.env.example متزامن مع السجل", g.status === 0, g.stdout + g.stderr);
const sy = run(["platform/env/sync.mjs", "--check"]); ok("[G2] env-registry.js المولَّد متزامن مع environments.json", sy.status === 0, (sy.stdout + sy.stderr).slice(0, 200));
/* I: سلوك اختبارات التكامل بلا بيانات */
const tr = (r) => /RESULT: (.*)/.exec(r.stdout)?.[1] || "";
const d1 = run(["platform/api/test/integration/d1-beta.integration.mjs"]), sb = run(["platform/supabase/tests/beta/beta-supabase.integration.mjs"]), ch = run(["platform/api/test/integration/chargily-sandbox.integration.mjs"]);
ok("[I1] الثلاثة تخرج SKIPPED (رمز 0) بلا بيانات اعتماد — وتصرّح أنه ليس نجاحاً", [d1, sb, ch].every((r) => r.status === 0 && /^SKIPPED/.test(tr(r)) && /ليس نجاحاً/.test(tr(r))), [d1, sb, ch].map(tr));
const rq = [["platform/api/test/integration/d1-beta.integration.mjs"], ["platform/supabase/tests/beta/beta-supabase.integration.mjs"], ["platform/api/test/integration/chargily-sandbox.integration.mjs"]].map((a) => run([...a, "--require"]));
ok("[I2] مع --require يفشل التخطي برمز 3 (لا يمرّ كنجاح في وضع تشغيل البيانات الحقيقية)", rq.every((r) => r.status === 3), rq.map((r) => r.status));
const sc = run(["platform/supabase/tests/beta/beta-supabase.integration.mjs", "--selfcheck"]); ok("[I3] حراسات Supabase (--selfcheck): 11/11", sc.status === 0 && /11 pass \/ 0 fail/.test(sc.stdout), tr(sc));
const st = run(["platform/api/test/integration/chargily-sandbox.integration.mjs", "--stub"]); ok("[I4] Chargily --stub: كله ناجح وموسوم STUB (محاكاة)", st.status === 0 && /STUB/.test(tr(st)) && /0 fail/.test(tr(st)), tr(st));
const lv = run(["platform/api/test/integration/chargily-sandbox.integration.mjs"], { BETA_CHARGILY_TEST_SECRET_KEY: "live_sk_FAKE" }); ok("[I5] مفتاح Chargily حيّ يُرفض بالرمز 2 قبل أي اتصال", lv.status === 2 && /FAIL/.test(tr(lv)), tr(lv));
const prodRef = P.supabase_ref, pe = run(["platform/supabase/tests/beta/beta-supabase.integration.mjs"], { BETA_SUPABASE_URL: `https://${prodRef}.supabase.co`, BETA_SUPABASE_REF: prodRef, BETA_SUPABASE_ANON_KEY: "sb_publishable_X", BETA_SUPABASE_PAT: "x", BETA_ADMIN_EMAIL: "beta-admin@example.test", BETA_ADMIN_PASSWORD: "x" });
ok("[I6] مرجع Supabase الإنتاجي يُرفض بالرمز 2 قبل أي اتصال", pe.status === 2 && /FAIL/.test(tr(pe)), tr(pe));
const dn = run(["platform/api/test/integration/d1-beta.integration.mjs"], { BETA_CF_ACCOUNT_ID: "x", BETA_CF_API_TOKEN: "x", BETA_D1_NAME: P.cf_d1 }); ok("[I7] اسم قاعدة D1 الإنتاجية يُرفض بالرمز 2 قبل أي اتصال", dn.status === 2 && /FAIL/.test(tr(dn)), tr(dn));
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
