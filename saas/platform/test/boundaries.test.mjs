/* حارس الحدود المعمارية: يمنع التسلّل بين الوحدات (جداولها وأحداثها) قبل أن يصل للإنتاج.
   القاعدة (ARCHITECTURE.md): كل وحدة تكتب في جداول بادئتها فقط؛ جداول النواة pf_* للقراءة فقط خارج النواة/وحدة platform؛
   ولا وحدة تعتمد على وحدة أخرى إلا عبر ناقل الأحداث (ctx.emit / on). */
import { readFileSync, readdirSync } from "node:fs";
import { Tally } from "./_harness.mjs";
import { adminModule } from "../src/core.js";
import { antifraud } from "../src/modules/antifraud.js";
import { capi } from "../src/modules/capi.js";
import { hooks } from "../src/modules/hooks.js";
import { digital } from "../src/modules/digital.js";
import { whatsapp } from "../src/modules/whatsapp.js";
import { sheets } from "../src/modules/sheets.js";
import { ab } from "../src/modules/ab.js";
import { ai } from "../src/modules/ai.js";
import { carts } from "../src/modules/carts.js";
import { payments } from "../src/modules/payments.js";
import { sms } from "../src/modules/sms.js";
import { commerce } from "../src/modules/commerce.js";
import { sources } from "../src/modules/sources.js";
import { ads } from "../src/modules/ads.js";
import { adsOauth } from "../src/modules/adsoauth.js";
import { wallet } from "../src/modules/wallet.js";
import { agency } from "../src/modules/agency.js";
import { appstore } from "../src/modules/appstore.js";
import { platformModule } from "../src/modules/platform.js";

const t = Tally();
const dir = new URL("../src/modules/", import.meta.url);
/* ملف الوحدة ← بادئات الجداول التي يحق لها الكتابة فيها */
const OWN = {
  "ab.js": ["ab_"], "ads.js": ["ad_"], "adsoauth.js": ["ad_oauth", "ad_accounts"], "ai.js": ["ai_"], "antifraud.js": ["fr_"], "capi.js": ["cp_"],
  "carts.js": ["cr_"], "commerce.js": ["cm_"], "digital.js": ["dg_"], "hooks.js": ["hk_"], "payments.js": ["pay_"], "platform.js": ["pf_events", "pf_integrations"],
  "sheets.js": [], "sms.js": ["sms_"], "sources.js": ["src_"], "wallet.js": ["wl_"], "whatsapp.js": ["wa_"], "agency.js": ["marketing_services", "agency_"], "appstore.js": ["apps", "app_", "oauth_", "platform_revenues"],
};
/* قراءة جداول الآخرين المسموحة صراحةً (SELECT فقط) — أي إضافة هنا قرار معماري موثّق في ARCHITECTURE.md */
const READ_OK = {
  "*": ["pf_tenants", "pf_integrations"],          // هوية المستأجر وإعداداته وأسرار تكاملاته (عبر الخزنة)
  "wallet.js": ["pf_events"],                        // التحقق من مصدر payment.confirmed
  "adsoauth.js": ["ad_accounts"],                    // يربط حسابات الإعلان (ينسخ الرمز المشفّر لحساب مملوك لوحدة ads: استثناء موثّق)
};
const WRITE_OK = { "adsoauth.js": ["ad_accounts"] }; // استثناء موثّق: الربط السريع ينشئ صف ad_accounts بواجهته

const tables = (src) => {
  const out = { r: new Set(), w: new Set() };
  for (const m of src.matchAll(/\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+([a-z][a-z0-9_]*)/gi)) out.w.add(m[1].toLowerCase());
  for (const m of src.matchAll(/\b(?:FROM|JOIN)\s+([a-z][a-z0-9_]*)/g)) out.r.add(m[1].toLowerCase());
  return out;
};
const known = new Set([...readFileSync(new URL("../schema.sql", import.meta.url), "utf8").matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase()));
const isOwn = (f, tb) => (OWN[f] ?? []).some((p) => tb.startsWith(p));

for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  t.ok("وحدة غير مسجّلة في خريطة الملكية: " + f, f in OWN);
  const { r, w } = tables(readFileSync(new URL(f, dir), "utf8"));
  for (const tb of w) {
    if (!known.has(tb)) continue; // كلمات SQL داخل نصوص عربية/تعليقات
    t.ok(`${f}: كتابة في جدول غيرها «${tb}»`, isOwn(f, tb) || (WRITE_OK[f] ?? []).includes(tb));
  }
  for (const tb of r) {
    if (!known.has(tb)) continue;
    t.ok(`${f}: قراءة جدول غير مسموح «${tb}»`, isOwn(f, tb) || READ_OK["*"].includes(tb) || (READ_OK[f] ?? []).includes(tb) || (WRITE_OK[f] ?? []).includes(tb));
  }
}
/* لا وحدة تستورد وحدة أخرى (التواصل عبر الأحداث فقط) إلا أدوات نقية موثّقة */
const IMPORT_OK = { "adsoauth.js": ["./ads.js"], "sheets.js": [] };
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  const src = readFileSync(new URL(f, dir), "utf8");
  for (const m of src.matchAll(/from\s+"\.\/([a-z]+\.js)"/g)) t.ok(`${f}: استيراد وحدة أخرى ./${m[1]}`, (IMPORT_OK[f] ?? []).includes("./" + m[1]));
}

/* كتالوج الأحداث: كل حدث تستمع إليه وحدة يجب أن يكون له مُصدِر معروف (وحدة أو مصدر خارجي موثّق) */
const MODS = { admin: adminModule, antifraud, capi, hooks, digital, whatsapp, sheets, ab, ai, carts, payments, sms, commerce, sources, ads, adsOauth, wallet, agency, appstore, platform: platformModule([]) };
const EXTERNAL = new Set(["order.status_changed", "order.created", "order.confirmed", "order.shipped", "order.out_for_delivery", "order.delivered", "order.cancelled", "order.failed", "order.returned", "payment.confirmed", "payment.failed", "payment.cancelled"]); // تدفعها لوحة التاجر/البوابة عبر POST /v1/events
const emitted = new Set(); // أحداث تُصدرها الوحدات حرفياً
for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
  const src = readFileSync(new URL(f, dir), "utf8");
  for (const m of src.matchAll(/\.emit\(\s*[^,]+,\s*"([a-z_.]+)"/g)) emitted.add(m[1]);
}
for (const e of ["order.customer_confirmed", "order.customer_cancelled", "payment.confirmed", "payment.failed", "payment.cancelled", "payment.mismatch"]) emitted.add(e); // payments: m[1] مُعيَّن من جدول
const listened = {}; for (const [id, m] of Object.entries(MODS)) for (const ev of Object.keys(m.on ?? {})) (listened[ev] ??= []).push(id);
for (const [ev, who] of Object.entries(listened)) if (ev !== "*") t.ok(`حدث «${ev}» (يستمع: ${who}) بلا مُصدِر`, emitted.has(ev) || EXTERNAL.has(ev));
t.ok("hooks يستمع إلى كل الأحداث", (listened["*"] ?? []).includes("hooks"));

/* كل جدول في المخطط ينتمي لوحدة واحدة معروفة (لا جداول يتيمة) */
const prefixes = [...new Set(Object.values(OWN).flat())], core = ["pf_"];
for (const tb of known) t.ok(`جدول يتيم بلا مالك: ${tb}`, prefixes.some((p) => tb.startsWith(p)) || core.some((p) => tb.startsWith(p)) || tb.startsWith("pf_"));

if (process.argv.includes("--catalog")) { console.log("مُصدَر:", [...emitted].sort().join(" ")); console.log("مستمَع:", JSON.stringify(listened)); }
t.done();
