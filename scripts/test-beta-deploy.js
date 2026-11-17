#!/usr/bin/env node
// أدوات نشر Cloudflare (platform/api + platform/gateway) تحت حارس البيئات: بلا شبكة (dry-run + fetch معطَّل). يتحقق من: --env إلزامي، منع النشر المتبادل، Beta بأسماء مستقلة،
// لا افتراضات إنتاجية لـBeta، ربط البوابة بمنصة نفس البيئة، بيانات الإصدار (ENVIRONMENT/GIT_SHA/SCHEMA_HASH)، التراجع للـWorker نفسه فقط، وعدم طباعة أسرار.
const { spawnSync } = require("child_process"); const path = require("path"); const ROOT = path.resolve(__dirname, ".."); let pass = 0, fail = 0;
const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + String(x).slice(0, 300))); };
const NN = path.join(ROOT, "platform/env/test/no-network.mjs"), TOOL = { api: "platform/api/tools/deploy.mjs", gateway: "platform/gateway/tools/deploy.mjs" };
const run = (kind, args, env = {}) => { const r = spawnSync(process.execPath, ["--import", NN, TOOL[kind], ...args], { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; };
const B = { CF_ACCOUNT_ID: "acct-beta-test", CF_ZONE_ID: "zone-beta-test", GIT_SHA: "0123456789abcdef0123456789abcdef01234567" };
const PROD_NAMES = /alyssum-platform-api(?!-beta)|alyssum-shipping-gateway(?!-beta)|(?<![a-z-])api\.alyssumhub\.fyi|(?<![a-z-])shipping\.alyssumhub\.fyi|1dffae72|2c1b59d3/;
for (const kind of ["api", "gateway"]) {
  const k = kind;
  { const r = run(k, ["--dry-run", "all"], B); ok(`[${k}] بلا --env ← رفض (rc=2)`, r.code === 2 && /--env/.test(r.out), r.out); }
  { const r = run(k, ["--env", "staging", "--dry-run", "all"], B); ok(`[${k}] --env غير معروف ← رفض`, r.code === 2, r.out); }
  { const r = run(k, ["--env", "beta", "--dry-run", "all"], {}); ok(`[${k}] beta بلا CF_ACCOUNT_ID/CF_ZONE_ID ← رفض (لا افتراضات إنتاجية)`, r.code === 2 && /CF_ACCOUNT_ID/.test(r.out), r.out); }
  { const r = run(k, ["--env", "beta", "--dry-run", "all"], B); ok(`[${k}] beta --dry-run all ينجح بلا شبكة (rc=0)`, r.code === 0 && /DRY/.test(r.out) && !/NETWORK_FORBIDDEN/.test(r.out), r.out.slice(-300));
    ok(`[${k}] خطة beta لا تذكر أي اسم/مضيف/معرّف Production`, !PROD_NAMES.test(r.out), (r.out.match(PROD_NAMES) || [])[0]);
    ok(`[${k}] كل مسارات الطلبات المخطَّطة تستعمل حساب/منطقة beta المُمرَّرين فقط`, /acct-beta-test/.test(r.out) && !/accounts\/(?!acct-beta-test)/.test(r.out.replace(/accounts\/acct-beta-test/g, "")) , r.out.match(/accounts\/[^/ ]+/g)?.slice(0, 3));
    ok(`[${k}] بيانات الإصدار تُحقن: ENVIRONMENT=beta وGIT_SHA وAPP_VERSION وSCHEMA_HASH`, /"name":"ENVIRONMENT","text":"beta"/.test(r.out) && /GIT_SHA","text":"0123456789abcdef/.test(r.out) && /APP_VERSION/.test(r.out) && /SCHEMA_HASH/.test(r.out));
    ok(`[${k}] هوية القاعدة تُكتب INSERT OR IGNORE بقيمة beta`, /INSERT OR IGNORE INTO pf_meta[^\n]*"params":\["beta"/.test(r.out));
    ok(`[${k}] لا أسرار في المخرجات (القيم محجوبة في dry-run)`, !/[0-9a-f]{64}/.test(r.out.replace(/0123456789abcdef0123456789abcdef01234567/g, "")) && /<dry-run-redacted>/.test(r.out));
    ok(`[${k}] المسار الشامل مرفوض والمسار = مضيف beta فقط`, /"pattern":"alyssum-(platform-api|shipping-gateway)-beta\.saber-balbouzi\.workers\.dev\/\*"/.test(r.out)); }
  { const r = run(k, ["--env", "beta", "--production", "--dry-run", "all"], B); ok(`[${k}] beta + --production ← رفض (لا خلط)`, r.code === 2 && /لا تجمع/.test(r.out), r.out); }
  { const r = run(k, ["--env", "beta", "--dry-run", "all"], { ...B, ALLOW_PRODUCTION_DEPLOY: "yes" }); ok(`[${k}] beta + ALLOW_PRODUCTION_DEPLOY=yes ← رفض`, r.code === 2, r.out); }
  { const r = run(k, ["--env", "production", "--dry-run", "all"], B); ok(`[${k}] production بلا تأكيد ← رفض`, r.code === 2 && /production/.test(r.out), r.out); }
  { const r = run(k, ["--env", "production", "--production", "--dry-run", "all"], B); ok(`[${k}] production مع --production فقط ← رفض`, r.code === 2, r.out); }
  { const r = run(k, ["--env", "production", "--dry-run", "all"], { ...B, ALLOW_PRODUCTION_DEPLOY: "yes" }); ok(`[${k}] production مع المتغير فقط (بلا --production) ← رفض`, r.code === 2, r.out); }
  { const r = run(k, ["--env", "production", "--production", "--dry-run", "worker"], { ...B, ALLOW_PRODUCTION_DEPLOY: "yes" }); ok(`[${k}] production بالتأكيدين: dry-run يخطّط بأسماء Production (لا شبكة)`, r.code === 0 && /DRY PUT/.test(r.out) && /"name":"ENVIRONMENT","text":"production"/.test(r.out), r.out.slice(-200)); }
  { const r = run(k, ["--env", "local", "--dry-run", "all"], B); ok(`[${k}] local لا يُنشر لـCloudflare`, r.code === 2, r.out); }
  { const r = run(k, ["--env", "beta", "--dry-run", "rollback"], B); ok(`[${k}] rollback (beta): يطلب نشرات Worker beta فقط ويُرجع إلى السابقة (الكود فقط)`, r.code === 0 && /DRY GET [^\n]*scripts\/[^/]*-beta\/deployments/.test(r.out) && /DRY POST [^\n]*scripts\/[^/]*-beta\/deployments/.test(r.out) && /v-prev/.test(r.out) && !/d1\/database\/[^/]+\/query/.test(r.out) && !PROD_NAMES.test(r.out), r.out); }
  { const r = run(k, ["--env", "beta", "--dry-run", "status"], B); ok(`[${k}] status يعرض آخر النشرات وpf_meta (sha/schema/environment) والمتوقع من المستودع`, r.code === 0 && /pf_meta/.test(r.out) && /schema_hash/.test(r.out)); } }
{ const r = run("gateway", ["--env", "beta", "--dry-run", "worker"], B); ok("[gateway] ربط الخدمة PLATFORM يشير إلى منصة beta (alyssum-platform-api-beta) وPLATFORM_URL لمضيف beta", /"type":"service","name":"PLATFORM","service":"alyssum-platform-api-beta"/.test(r.out) && /"name":"PLATFORM_URL","text":"https:\/\/alyssum-platform-api-beta\.saber-balbouzi\.workers\.dev"/.test(r.out), r.out.slice(-400)); }
{ const r = run("api", ["--env", "beta", "--dry-run", "meta"], B); ok("[api] خطوة meta محظورة في beta (تطبيق Meta له مسارات رجوع إنتاجية)", r.code === 2 && /محظورة/.test(r.out), r.out); }
console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
