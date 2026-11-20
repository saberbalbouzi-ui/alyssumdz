/* إقلاع بوابة الشحن في Beta (نقطة الدخول الفعلية src/index.js): فشل مُغلَق على الإعداد/الهوية، وربط الخدمة بمنصة نفس البيئة. ⚠ LOCAL ONLY (D1 = node:sqlite). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
let total = 0, fails = 0; const ok = (n, c, x) => { total++; if (!c) { fails++; console.log("✗ " + n + (x === undefined ? "" : " " + JSON.stringify(x))); } else console.log("✓ " + n); };
const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
const mk = (envName) => { const db = new DatabaseSync(":memory:"); db.exec(SCHEMA); if (envName) db.prepare("INSERT INTO pf_meta (k,v,at) VALUES ('environment',?,'t')").run(envName); const nz = (a) => a.map((v) => (v === undefined ? null : v));
  return { db, d1: { prepare: (sql) => ({ bind: (...a) => ({ first: async () => db.prepare(sql).get(...nz(a)) ?? null, all: async () => ({ results: db.prepare(sql).all(...nz(a)) }), run: async () => { const r = db.prepare(sql).run(...nz(a)); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }), first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => { db.prepare(sql).run(); return { meta: {} }; } }), batch: async () => [] } }; };
const KEY = Buffer.from(new Uint8Array(32).fill(5)).toString("base64"), health = async (env) => { const r = await worker.fetch(new Request("https://x.test/health"), env); return r.status; };
const base = { APP_ENCRYPTION_KEY: KEY, ADMIN_TOKEN: "gw-admin-token-0123456789abcdef", ENVIRONMENT: "beta", PUBLIC_URL: "https://alyssum-shipping-gateway-beta.contact-alyssumbio.workers.dev", PLATFORM_URL: "https://alyssum-platform-api-beta.contact-alyssumbio.workers.dev" };
ok("[GB1] gateway في Beta بقاعدة موسومة beta يقلع", (await health({ ...base, DB: mk("beta").d1 })) === 200);
ok("[GB1] قاعدة بلا هوية (أو Production) ← 503", (await health({ ...base, DB: mk(null).d1 })) === 503 && (await health({ ...base, DB: mk("production").d1 })) === 503);
const B = mk("beta").d1; for (const [n, x] of Object.entries({ "RELAY_URL إنتاج": { RELAY_URL: "https://shipping.alyssumhub.fyi/relay" }, "PUBLIC_URL إنتاج": { PUBLIC_URL: "https://shipping.alyssumhub.fyi" }, "PLATFORM_URL إنتاج": { PLATFORM_URL: "https://api.alyssumhub.fyi" }, "مفتاح حيّ": { GATEWAY_KEY: "gk_live_abc" } })) ok(`[GB2] Beta + ${n} ← 503 (فشل مُغلَق)`, (await health({ ...base, DB: B, ...x })) === 503);
ok("[GB3] الإنتاج بلا ENVIRONMENT وبقاعدة بلا هوية: يقلع كالسابق (توافق)", (await health({ APP_ENCRYPTION_KEY: KEY, ADMIN_TOKEN: "gw-admin-token-0123456789abcdef", PUBLIC_URL: "https://shipping.alyssumhub.fyi", DB: mk(null).d1 })) === 200);
ok("[GB3] الإنتاج على قاعدة موسومة beta ← 503", (await health({ APP_ENCRYPTION_KEY: KEY, ADMIN_TOKEN: "gw-admin-token-0123456789abcdef", PUBLIC_URL: "https://shipping.alyssumhub.fyi", DB: mk("beta").d1 })) === 503);
console.log(fails ? `\n✗ ${fails} من ${total} فشل` : `\n✓ ${total} فحصاً ناجحاً`); process.exit(fails ? 1 : 0);
