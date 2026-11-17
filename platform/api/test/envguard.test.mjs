/* حارس البيئات: سجل البيئات، التحقق من الإعدادات (فشل مُغلَق)، سياسة الخروج، وخطة النشر. نقي بلا شبكة (LOCAL ONLY لكنه منطق خالص). */
import { readFileSync } from "node:fs";
import REG from "../src/env-registry.js";
import { validateEnvironment, assertEnvironment, egressPolicy, egressAllowed, guardFetch, EgressBlocked, deployPlan, isDenied, envName } from "../src/envguard.js";
import { Tally } from "./_harness.mjs";
const { ok, done } = Tally(); const J = JSON.parse(readFileSync(new URL("../../env/environments.json", import.meta.url), "utf8")); delete J._note;
const codes = (r) => r.errors.map((e) => e.code + (e.var ? "@" + e.var : ""));
/* G1: السجل */
ok("[G1] env-registry.js مطابق لـenvironments.json (شغّل node platform/env/sync.mjs)", JSON.stringify(REG) === JSON.stringify(J));
ok("[G1] نسخة gateway من envguard وenv-registry مطابقتان للأصل", readFileSync(new URL("../src/envguard.js", import.meta.url), "utf8") === readFileSync(new URL("../../gateway/src/envguard.js", import.meta.url), "utf8") && readFileSync(new URL("../src/env-registry.js", import.meta.url), "utf8") === readFileSync(new URL("../../gateway/src/env-registry.js", import.meta.url), "utf8"));
const E = REG.environments, P = E.production, B = E.beta;
ok("[G1] أسماء موارد Beta كلها مختلفة عن Production (worker/d1/hosts)", ["cf_worker", "cf_d1", "api_host", "gateway_worker", "gateway_d1", "gateway_host", "app_host"].every((k) => B[k] !== P[k]));
ok("[G1] وضع Beta: كل الأوضاع sandbox؛ والإنتاج live", Object.values(B.modes).every((m) => m === "sandbox") && Object.values(P.modes).every((m) => m === "live"));
/* G2: التحقق */
ok("[G2] ENVIRONMENT غائب = production ضمنياً مع تحذير (توافق مع النشر القائم)", envName({}) === "production" && validateEnvironment(REG, {}).warnings.some((w) => w.code === "environment_implicit_production") && validateEnvironment(REG, {}).errors.length === 0);
ok("[G2] بيئة غير معروفة ← خطأ", codes(validateEnvironment(REG, { ENVIRONMENT: "staging" })).includes("unknown_environment"));
const goodBeta = { ENVIRONMENT: "beta", PUBLIC_URL: "https://alyssum-platform-api-beta.saber-balbouzi.workers.dev", CHARGILY_MODE: "test", SUPABASE_URL: "https://abcdefghijklmnop.supabase.co", CORS: "https://alyssum-beta-web.pages.dev", PLATFORM_SECRET: "x".repeat(40), ADMIN_TOKEN: "y".repeat(40) };
ok("[G2] إعداد Beta سليم ينجح (بما فيه مضيف alyssum-beta-web.pages.dev رغم احتوائه alyssumdz.com)", validateEnvironment(REG, goodBeta).errors.length === 0, codes(validateEnvironment(REG, goodBeta)));
const bad = (extra, code) => codes(validateEnvironment(REG, { ...goodBeta, ...extra })).some((c) => c.startsWith(code));
ok("[G2] Beta + SUPABASE_URL = مشروع الإنتاج ← supabase_is_production", bad({ SUPABASE_URL: "https://qvdaiundlkfbmjlummni.supabase.co" }, "supabase_is_production"));
ok("[G2] Beta + مرجع الإنتاج داخل أي متغير آخر ← production_supabase_ref_in_var", bad({ SOME_URL: "https://qvdaiundlkfbmjlummni.supabase.co/rest/v1" }, "production_supabase_ref_in_var"));
ok("[G2] Beta + المفتاح العام (publishable) لمشروع الإنتاج في أي متغير ← production_public_key_in_var", bad({ SAAS_KEY: "sb_publishable_1ZtNDbkZ0uLFEdJeGkX0mw_zwXVI59h" }, "production_public_key_in_var") && !bad({ SAAS_KEY: "sb_publishable_BETA_OWN_KEY_0000000000000000" }, "production_public_key_in_var"));
ok("[G2] Beta + مضيف API الإنتاج في أي متغير ← production_host_in_var", bad({ RELAY_URL: "https://api.alyssumhub.fyi/x" }, "production_host_in_var") && bad({ GW: "https://shipping.alyssumhub.fyi" }, "production_host_in_var") && bad({ ORIGIN: "https://alyssumdz.com" }, "production_host_in_var"));
ok("[G2] Beta + مفتاح حيّ (live_/sk_live/pk_live/gk_live_) ← live_credential_in_beta", bad({ CHARGILY_SECRET_KEY: "live_sk_abc" }, "live_credential_in_beta") && bad({ STRIPE_SECRET_KEY: "sk_live_abc" }, "live_credential_in_beta") && bad({ PLATFORM_KEY: "pk_live_abc" }, "live_credential_in_beta") && bad({ GATEWAY_KEY: "gk_live_abc" }, "live_credential_in_beta"));
ok("[G2] Beta + مفتاح تجريبي test_ لا يُرفض", !bad({ CHARGILY_SECRET_KEY: "test_sk_abc" }, "live_credential_in_beta"));
ok("[G2] Beta + CHARGILY_MODE=live ← payments_mode_not_test", bad({ CHARGILY_MODE: "live" }, "payments_mode_not_test"));
ok("[G2] Beta + PUBLIC_URL غير مضيف Beta ← public_url_host_mismatch (حتى لو مضيف Production)", bad({ PUBLIC_URL: "https://api.alyssumhub.fyi" }, "public_url_host_mismatch") && bad({ PUBLIC_URL: "https://evil.example" }, "public_url_host_mismatch"));
ok("[G2] Beta + بيانات Meta بلا BETA_ALLOW_META ← مرفوض", bad({ META_APP_SECRET: "s".repeat(32) }, "meta_credentials_in_beta") && !bad({ META_APP_SECRET: "s".repeat(32), BETA_ALLOW_META: "yes" }, "meta_credentials_in_beta"));
ok("[G2] Beta + EGRESS_ALLOW_EXTRA يضم محظوراً (مضيف/مسار حيّ) ← مرفوض", bad({ EGRESS_ALLOW_EXTRA: "api.alyssumhub.fyi" }, "egress_extra_denied") && bad({ EGRESS_ALLOW_EXTRA: "pay.chargily.net/api/v2" }, "egress_extra_denied") && !bad({ EGRESS_ALLOW_EXTRA: "sandbox.example.test" }, "egress_extra_denied"));
ok("[G2] PUBLIC_URL بمضيف بوابة الشحن لنفس البيئة مقبول (Beta وProduction)، وبمضيف بوابة بيئة أخرى مرفوض", !bad({ PUBLIC_URL: "https://alyssum-shipping-gateway-beta.saber-balbouzi.workers.dev" }, "public_url_host_mismatch") && bad({ PUBLIC_URL: "https://shipping.alyssumhub.fyi" }, "public_url_host_mismatch") && validateEnvironment(REG, { PUBLIC_URL: "https://shipping.alyssumhub.fyi" }).errors.length === 0 && codes(validateEnvironment(REG, { ENVIRONMENT: "production", PUBLIC_URL: "https://alyssum-shipping-gateway-beta.saber-balbouzi.workers.dev" })).some((c) => c.startsWith("public_url_host_mismatch")));
const secret = "SUPER-SECRET-VALUE-9f3a1c"; const rr = validateEnvironment(REG, { ...goodBeta, CHARGILY_SECRET_KEY: "live_" + secret, RELAY_URL: "https://api.alyssumhub.fyi/" + secret });
ok("[G2] لا يُسرَّب أي قيمة في الأخطاء (أسماء المتغيرات فقط)", rr.errors.length >= 2 && !JSON.stringify(rr).includes(secret));
let thrown = null; try { assertEnvironment(REG, { ...goodBeta, CHARGILY_MODE: "live" }); } catch (e) { thrown = e; } ok("[G2] assertEnvironment يرمي env_guard بالرموز", thrown?.code === "env_guard" && /payments_mode_not_test/.test(thrown.message));
ok("[G2] الإنتاج: مضيف Beta في متغير ← beta_host_in_production؛ PUBLIC_URL غير مضيف الإنتاج ← خطأ", codes(validateEnvironment(REG, { ENVIRONMENT: "production", X: "https://alyssum-platform-api-beta.saber-balbouzi.workers.dev" })).some((c) => c.startsWith("beta_host_in_production")) && codes(validateEnvironment(REG, { ENVIRONMENT: "production", PUBLIC_URL: "https://alyssum-platform-api-beta.saber-balbouzi.workers.dev" })).some((c) => c.startsWith("public_url_host_mismatch")));
ok("[G2] الإنتاج السليم بدون ENVIRONMENT وبـPUBLIC_URL الإنتاج ينجح", validateEnvironment(REG, { PUBLIC_URL: "https://api.alyssumhub.fyi" }).errors.length === 0);
/* G3: سياسة الخروج */
const pol = egressPolicy(REG, goodBeta);
ok("[G3] الإنتاج: لا حارس (سلوك الإنتاج القائم لا يتغير)", egressPolicy(REG, { ENVIRONMENT: "production" }) === null && egressPolicy(REG, {}) === null);
const A = (u) => egressAllowed(pol, u);
ok("[G3] Beta يسمح فقط بـChargily التجريبي", A("https://pay.chargily.net/test/api/v2/checkouts") && !A("https://pay.chargily.net/api/v2/checkouts"));
ok("[G3] Beta يحجب Production (API/الشحن/المتجر/Supabase) ولو سُمح بذلك بالخطأ", !A("https://api.alyssumhub.fyi/admin/cron") && !A("https://shipping.alyssumhub.fyi/") && !A("https://alyssumdz.com/") && !A("https://www.alyssumdz.com/") && !A("https://qvdaiundlkfbmjlummni.supabase.co/rest/v1/orders"));
ok("[G3] Beta يحجب المزوّدين الحيّين (رسائل/بريد/ميتا/شركات التوصيل/Sheets)", ["https://api.resend.com/emails", "https://graph.facebook.com/v19.0/me", "https://yalidine.app/x", "https://app.noest-dz.com/api", "https://script.google.com/macros/s/x/exec", "https://api.zrexpress.app/x", "https://example.com"].every((u) => !A(u)));
const pol2 = egressPolicy(REG, { ...goodBeta, EGRESS_ALLOW_EXTRA: "sandbox.example.test, api.alyssumhub.fyi" }); ok("[G3] المحظور يغلب قائمة السماح الإضافية دائماً", egressAllowed(pol2, "https://sandbox.example.test/x") && !egressAllowed(pol2, "https://api.alyssumhub.fyi/x"));
ok("[G3] local يسمح بـlocalhost فقط", egressAllowed(egressPolicy(REG, { ENVIRONMENT: "local" }), "http://localhost:8787/x") && !egressAllowed(egressPolicy(REG, { ENVIRONMENT: "local" }), "https://example.com"));
ok("[G3] isDenied يقرأ مضيفي Production ومسار الدفع الحي", isDenied(REG, "api.alyssumhub.fyi/x") && isDenied(REG, "https://pay.chargily.net/api/v2/x") && !isDenied(REG, "pay.chargily.net/test/api/v2") && !isDenied(REG, "alyssum-beta-web.pages.dev") && isDenied(REG, "evil.alyssumdz.com"));
/* G4: guardFetch */
{ const calls = []; const inner = async (u) => { calls.push(u); return { status: 200, text: async () => "{}" }; }; const blocked = []; const g = guardFetch(inner, pol, (h) => blocked.push(h));
  const r1 = await g("https://pay.chargily.net/test/api/v2/checkouts"); let e2 = null; try { await g("https://api.alyssumhub.fyi/admin/events?secret=abc"); } catch (e) { e2 = e; } let e3 = null; try { await g("https://pay.chargily.net/api/v2/checkouts"); } catch (e) { e3 = e; }
  ok("[G4] المسموح يمرّ للـfetch الأصلي", r1.status === 200 && calls.length === 1);
  ok("[G4] المحظور يُرمى EgressBlocked ولا يخرج أي طلب (الاستدعاءات لم تزد)", e2 instanceof EgressBlocked && e3 instanceof EgressBlocked && calls.length === 1);
  ok("[G4] onBlock يستلم اسم المضيف فقط (لا URL ولا استعلام)", blocked.join() === "api.alyssumhub.fyi,pay.chargily.net" && !JSON.stringify(blocked).includes("secret=abc"));
  ok("[G4] السياسة null (إنتاج) ← نفس الدالة بلا تغليف", guardFetch(inner, null) === inner); }
/* G5: خطة النشر */
const tr = (fn) => { try { fn(); return null; } catch (e) { return String(e.message); } };
const V = { CF_ACCOUNT_ID: "acct-x", CF_ZONE_ID: "zone-x" };
ok("[G5] بلا --env ← يُرفض", /--env/.test(tr(() => deployPlan(REG, { kind: "api", vars: V }))) && /--env/.test(tr(() => deployPlan(REG, { kind: "api", env: "staging", vars: V }))));
ok("[G5] production بلا --production وبلا ALLOW_PRODUCTION_DEPLOY=yes ← يُرفض (كلاهما مطلوب)", /production/.test(tr(() => deployPlan(REG, { kind: "api", env: "production", vars: V }))) && /production/.test(tr(() => deployPlan(REG, { kind: "api", env: "production", flags: { production: true }, vars: V }))) && /production/.test(tr(() => deployPlan(REG, { kind: "api", env: "production", vars: { ...V, ALLOW_PRODUCTION_DEPLOY: "yes" } }))));
const pb = deployPlan(REG, { kind: "api", env: "beta", vars: V }), gb = deployPlan(REG, { kind: "gateway", env: "beta", vars: V });
ok("[G5] خطة Beta: worker/d1/host من السجل (ولا شيء من Production) ومنصة الربط = منصة Beta", pb.worker === B.cf_worker && pb.d1 === B.cf_d1 && pb.host === B.api_host && gb.worker === B.gateway_worker && gb.platformService === B.cf_worker && ![pb.worker, pb.d1, pb.host, gb.worker, gb.d1, gb.host, gb.platformService].some((x) => [P.cf_worker, P.cf_d1, P.api_host, P.gateway_worker, P.gateway_d1, P.gateway_host].includes(x)));
ok("[G5] Beta بلا CF_ACCOUNT_ID/CF_ZONE_ID صريحين ← يُرفض (لا افتراضات إنتاجية)", /CF_ACCOUNT_ID/.test(tr(() => deployPlan(REG, { kind: "api", env: "beta", vars: {} }))) && /CF_ACCOUNT_ID/.test(tr(() => deployPlan(REG, { kind: "api", env: "beta", vars: { CF_ACCOUNT_ID: "a" } }))));
ok("[G5] Beta مع علم/متغير الإنتاج ← يُرفض (لا خلط إعدادات)", /لا تجمع/.test(tr(() => deployPlan(REG, { kind: "api", env: "beta", flags: { production: true }, vars: V }))) && /لا تجمع/.test(tr(() => deployPlan(REG, { kind: "api", env: "beta", vars: { ...V, ALLOW_PRODUCTION_DEPLOY: "yes" } }))));
ok("[G5] local لا يُنشر لـCloudflare", /local/.test(tr(() => deployPlan(REG, { kind: "api", env: "local", vars: V }))));
const pp = deployPlan(REG, { kind: "api", env: "production", flags: { production: true }, vars: { ALLOW_PRODUCTION_DEPLOY: "yes", CF_ACCOUNT_ID: "a", CF_ZONE_ID: "z" } }); ok("[G5] production بالتأكيدين المنفصلين ← خطة بأسماء الإنتاج", pp.worker === P.cf_worker && pp.host === P.api_host);
/* تطابق عبر نسخة مجرّد: أسماء السجل تُطابق ما تستعمله أدوات النشر الحالية للإنتاج (حتى لا ينقلب الإنتاج) */
ok("[G5] أسماء Production في السجل = ثوابت أدوات النشر الحالية (platform/api & gateway) في الالتزام الأساسي", P.cf_worker === "alyssum-platform-api" && P.api_host === "api.alyssumhub.fyi" && P.gateway_worker === "alyssum-shipping-gateway" && P.gateway_host === "shipping.alyssumhub.fyi");
done();
