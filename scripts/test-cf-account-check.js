#!/usr/bin/env node
// اختبار حارس هوية حساب Cloudflare بـfetch محاكى (بلا شبكة): يرفض حساب الإنتاج، ولا يطبع الرمز، ويستعمل GET فقط.
const path = require("path"), { pathToFileURL } = require("url"), { spawnSync } = require("child_process"), ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0; const ok = (m, c, x) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  " + JSON.stringify(x).slice(0, 220))); };
(async () => {
  const { checkAccount } = await import(pathToFileURL(path.join(ROOT, "platform/env/cf-account-check.mjs")).href), ID = "0123456789abcdef0123456789abcdef", TOKEN = "TOKEN_SHOULD_NEVER_PRINT_123";
  const mk = (o = {}) => { const log = []; const f = async (url, init = {}) => { log.push({ url, method: init.method }); const u = new URL(url), p = u.pathname.replace("/client/v4", ""); let key = p === `/accounts/${ID}` ? "account" : p.endsWith("/d1/database") ? "d1" : p.endsWith("/workers/scripts") ? "workers" : p.endsWith("/pages/projects") ? "pages" : p === "/zones" ? "zones" : "?"; const v = o[key]; if (v === 401 || v === 403) return { ok: false, status: v, json: async () => ({ success: false }) }; return { ok: true, status: 200, json: async () => ({ success: true, result: v ?? [] }) }; }; return { f, log }; };
  let { f, log } = mk({ account: [{}] }); let r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[1] حساب فارغ (مناطق مقروءة) ⇒ SEPARATE رمز 0", r.code === 0 && r.verdict === "SEPARATE", r);
  ok("[2] كل الطلبات GET وإلى api.cloudflare.com فقط ولا يظهر الرمز في الناتج", log.length === 5 && log.every((l) => l.method === "GET" && l.url.startsWith("https://api.cloudflare.com/client/v4/")) && !JSON.stringify(r).includes(TOKEN), log.length);
  ({ f } = mk({ account: [{}], d1: [{ name: "alyssum-platform-api" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[3] D1 بإسم الإنتاج ⇒ PRODUCT_ACCOUNT رمز 2", r.code === 2 && /alyssum-platform-api/.test(r.findings.join()), r);
  ({ f } = mk({ account: [{}], workers: [{ id: "alyssum-shipping-gateway" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[4] Worker بإسم الإنتاج ⇒ PRODUCT_ACCOUNT", r.code === 2, r);
  ({ f } = mk({ account: [{}], zones: [{ name: "alyssumdz.com" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[5] منطقة alyssumdz.com ⇒ PRODUCT_ACCOUNT", r.code === 2 && /alyssumdz\.com/.test(r.findings.join()), r);
  ({ f } = mk({ account: [{}], zones: [{ name: "alyssumhub.fyi" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[6] منطقة alyssumhub.fyi ⇒ PRODUCT_ACCOUNT", r.code === 2, r);
  ({ f } = mk({ account: [{}], d1: [{ name: "alyssum-platform-api-beta" }], workers: [{ id: "alyssum-platform-api-beta" }], pages: [{ name: "alyssum-beta-web" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[7] موارد Beta المسمّاة بـ-beta وحدها مقبولة ⇒ SEPARATE", r.code === 0, r);
  ({ f } = mk({ account: [{}], zones: 403 })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[8] صلاحية المناطق ناقصة ⇒ UNVERIFIED رمز 3 (ليس نجاحاً)", r.code === 3 && r.verdict === "UNVERIFIED", r);
  ({ f } = mk({ account: 401 })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[9] رمز غير صالح ⇒ UNVERIFIED", r.code === 3, r);
  ({ f } = mk({ account: [{}], zones: 403, d1: [{ name: "alyssum-platform-api" }] })); r = await checkAccount({ accountId: ID, token: TOKEN, fetchFn: f });
  ok("[10] وجود مورد إنتاج يغلب نقص الصلاحية ⇒ PRODUCT_ACCOUNT (2) لا UNVERIFIED", r.code === 2, r);
  r = await checkAccount({ accountId: "xyz", token: TOKEN, fetchFn: f }); ok("[11] معرّف حساب غير صالح ⇒ رمز 1 قبل أي اتصال", r.code === 1);
  r = await checkAccount({ accountId: ID, token: "", fetchFn: f }); ok("[12] رمز مفقود ⇒ رمز 1", r.code === 1);
  const cli = spawnSync("node", ["platform/env/cf-account-check.mjs"], { cwd: ROOT, encoding: "utf8", env: { PATH: process.env.PATH } }); ok("[13] CLI بلا متغيرات ⇒ رمز 1 ولا اتصال", cli.status === 1, cli.status);
  console.log(`\nالنتيجة: ${pass} ناجح، ${fail} فاشل`); process.exit(fail ? 1 : 0);
})();
