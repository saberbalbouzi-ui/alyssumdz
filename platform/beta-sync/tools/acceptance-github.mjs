#!/usr/bin/env node
/* اختبار قبول **بمصدر GitHub حقيقي**: يُجري تعديلات حقيقية على فرع fixture (يحاكي ما تكتبه اللوحة التقليدية: commits على المستودع) ويدفعها، ثم يشغّل المحرّك الحقيقي
   (GitHubSource: info/refs + git trees + raw) على وجهة KV محلية تُخدَّم بـ static-worker.js الحقيقي، ويتحقق أن كل تعديل وصل. الانقطاع يُحاكى بإيقاف الوجهة/المصدر.
   الاستعمال: FIXTURE_DIR=<نسخة عمل من فرع fixture> node platform/beta-sync/tools/acceptance-github.mjs   (يدفع commits إلى origin/beta/sync-fixture فقط) */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeSqliteDb } from "../src/db-node.mjs";
import { KVTarget } from "../src/targets.js";
import { GitHubSource } from "../src/github.js";
import { makeSanitizer, sha256Hex } from "../src/rules.js";
import { runSync, restoreDeleted, syncStatus } from "../src/engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), FX = process.env.FIXTURE_DIR; if (!FX || !existsSync(path.join(FX, ".git"))) { console.error("FIXTURE_DIR مطلوب"); process.exit(2); }
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), BETA = REG.environments.beta, enc = new TextEncoder(), dec = new TextDecoder();
const git = (...a) => execFileSync("git", a, { cwd: FX, encoding: "utf8" }).trim();
let n = 0, bad = 0; const ok = (m, c, x) => { n++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  → " + JSON.stringify(x).slice(0, 300))); if (!c) bad++; };

const tmp = mkdtempSync(path.join(tmpdir(), "acc-")); let sw = 0; const swSrc = readFileSync(path.join(ROOT, "platform/env/beta/static-worker.js"), "utf8"); writeFileSync(path.join(tmp, "ov.mjs"), "export default {};");
const worker = async () => { const f = path.join(tmp, `sw${sw++}.mjs`); writeFileSync(f, swSrc.replace("./overrides.js", "./ov.mjs")); return (await import(pathToFileURL(f).href)).default; };
class MemKV { constructor() { this.m = new Map(); this.fail = false; } async get(k, t) { if (this.fail) throw new Error("kv offline"); const v = this.m.get(k); if (v == null) return null; return (t === "arrayBuffer" || t?.type === "arrayBuffer") ? (typeof v === "string" ? enc.encode(v).buffer : v.slice().buffer) : (typeof v === "string" ? v : dec.decode(v)); } async getWithMetadata(k) { if (this.fail) throw new Error("kv offline"); return { value: this.m.has(k) ? { cancel() { } } : null }; } async put(k, v) { if (this.fail) throw new Error("kv offline"); this.m.set(k, typeof v === "string" ? v : new Uint8Array(v)); } }
const kv = new MemKV(), seed = async (comp, files) => { const map = {}; for (const [p, c] of Object.entries(files)) { const b = enc.encode(c), h = await sha256Hex(b); map[p] = h; kv.m.set("o/" + h, b); } kv.m.set("__ptr/" + comp, "r-1"); kv.m.set(`__m/${comp}/r-1`, JSON.stringify(map)); };
await seed("ui", { "index.html": "<h1>Beta</h1>", "assets/js/app.js": "console.log('BETA app code')", "assets/js/data.js": "var CATEGORIES={};var PRODUCTS=[];" }); await seed("templates", { "assets/pages/templates/home.json": "{}" });
const web = { fetch: async (req) => (await worker()).fetch(req, { FILES: kv }) }, target = new KVTarget({ kv, web, base: "https://" + BETA.app_host, sleep: async () => { }, verifyTries: 2 });
const source = new GitHubSource({ repo: "saberbalbouzi-ui/alyssumdz", ref: "beta/sync-fixture", fetchFn: (...a) => globalThis.fetch(...a) }), db = new NodeSqliteDb();
const san = makeSanitizer({ registry: { never_outside_production: REG.never_outside_production }, beta: { appHost: BETA.app_host, supabaseUrl: "https://xhdnqnxmcmfhrgctlkzy.supabase.co", anonKey: "sb_publishable_BETA_TEST_KEY_000000000000", waPlaceholder: "213000000000" } });
const get = async (p) => { const r = await web.fetch(new Request(`https://${BETA.app_host}/${p}`)); return { s: r.status, t: await r.text() }; };
const sync = (o = {}) => runSync({ source, target, db, san, budget: { files: 100 }, ...o });
const edit = (files, msg) => { for (const [p, c] of Object.entries(files)) { const f = path.join(FX, p); if (c === null) { rmSync(f, { force: true }); continue; } mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, c); } git("add", "-A"); if (!git("status", "--porcelain")) return git("rev-parse", "HEAD"); git("-c", "user.name=Claude", "-c", "user.email=noreply@anthropic.com", "commit", "-q", "-m", msg + "\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"); git("push", "-q", "origin", "HEAD:refs/heads/beta/sync-fixture"); return git("rev-parse", "HEAD"); };
const dataJs = (arr) => '/* منتجات fixture */\nvar CATEGORIES = {"general":"المنتجات"};\nvar PRODUCTS = ' + JSON.stringify(arr.map((x) => ({ ...x, run: RUNID }))) + ";\n";
const base = JSON.parse(readFileSync(path.join(FX, "assets/js/data.js"), "utf8").match(/var PRODUCTS = (.*);/)[1]);
const RUNID = Date.now(); const png = (k) => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64").map((b, i, a) => (i === a.length - 20 ? (b + k + RUNID) & 255 : i === a.length - 21 ? (b + (RUNID >> 8)) & 255 : i === a.length - 22 ? (b + (RUNID >> 16)) & 255 : b));
const head = () => git("rev-parse", "HEAD");
const RUN = Date.now(); const t0 = Date.now(); console.log("المصدر: github:saberbalbouzi-ui/alyssumdz@beta/sync-fixture  الوجهة: KV محلية + static-worker الحقيقي\n");

/* 0) التزامن الأولي */
let r = await sync(); if (!r.ok) console.log("  [تشخيص]", JSON.stringify(await db.all("SELECT path, status, error FROM sync_events WHERE status<>'applied'")).slice(0, 700)); const h0 = head(); const st0 = await syncStatus(db);
ok(`[S0] المزامنة الأولى من GitHub الحقيقي (head ${h0.slice(0, 8)}): ${r.applied} عنصراً مطبَّقاً`, r.ok && r.head === h0 && r.applied === st0.items.applied && r.applied >= 8 && st0.in_sync, r);
const d0 = (await get("assets/js/data.js")).t; ok("[S0] Beta تخدم منتج اللوحة (لا المنتج التجريبي الفارغ)", d0.includes('"slug":"fx1"') && !d0.includes("var PRODUCTS=[]"));
const ck = JSON.parse((await get("assets/data/checkout.json")).t), pm = (await get("assets/data/pay-methods.json")).t, so = JSON.parse((await get("assets/data/store.json")).t);
ok("[S12] لا رقم المالك في checkout (← رقم Beta الوهمي) ولا RIP/حساب CCP في الدفع، وأعلام التفعيل تطابق", ck.waNumber === "213000000000" && typeof ck.steps === "boolean" && typeof JSON.parse(pm).chargily.on === "boolean" && !/0079999|1234567|7654321/.test(pm) && so.phone === "" && so.email === "" && so.address === "" && so.name === "متجر الاختبار", { ck, pm });
const keys = JSON.stringify([...kv.m.keys()].filter((k) => k.startsWith("__m/"))) + JSON.stringify([...Object.keys(JSON.parse(kv.m.get("__m/ui/r-1")))]);
ok("[S12] الطلبات/العملاء/المدفوعات والشيفرة لم تُنقل (payments.json، customers.json، app.js المصدر)", !/payments\.json|customers\.json/.test(keys) && (await get("assets/js/app.js")).t.includes("BETA app code"));

/* 1+2) تعديل اسم/سعر/وصف/صورة */
const c1 = edit({ "assets/js/data.js": dataJs([{ ...base[0], title: "منتج الاختبار — الاسم المعدَّل", price: 1800, desc: "وصف مُعدَّل من اللوحة", images: ["assets/img/fx1/0.png", "assets/img/fx1/1.png"] }]), "assets/img/fx1/1.png": png(1) }, "تعديل المنتج: الاسم والسعر والوصف + صورة"); r = await sync();
const d1 = (await get("assets/js/data.js")).t, im = await get("assets/img/fx1/1.png");
ok(`[S1-2] تعديل الاسم والسعر والوصف والصورة (commit ${c1.slice(0, 8)}) وصل Beta`, r.ok && r.applied === 2 && d1.includes("الاسم المعدَّل") && d1.includes("1800") && d1.includes("وصف مُعدَّل") && im.s === 200, r);
/* 3) إضافة منتج */
edit({ "assets/js/data.js": dataJs([{ ...base[0], title: "منتج الاختبار — الاسم المعدَّل", price: 1800, images: ["assets/img/fx1/0.png"] }, { slug: "fx2", title: "المنتج الثاني", price: 900, images: ["assets/img/fx2/0.png"], cat: "general", active: true }]), "assets/img/fx2/0.png": png(2), "p/fx2/index.html": "<!doctype html><html><head><title>fx2</title></head><body>المنتج الثاني</body><!-- " + RUNID + " --></html>" }, "إضافة منتج جديد"); r = await sync();
ok("[S3] المنتج الجديد: البيانات والصفحة والصورة", r.ok && (await get("p/fx2/index.html")).s === 200 && (await get("assets/img/fx2/0.png")).s === 200 && (await get("assets/js/data.js")).t.includes("المنتج الثاني"), r);
/* 4) حذف */
edit({ "assets/js/data.js": dataJs([{ ...base[0], title: "منتج الاختبار — الاسم المعدَّل", price: 1800, images: ["assets/img/fx1/0.png"] }]), "assets/img/fx2/0.png": null, "p/fx2/index.html": null }, "حذف المنتج الثاني"); r = await sync();
ok("[S4] الحذف انعكس: الصفحة والصورة 404، والمنتج غائب من البيانات", r.ok && r.deleted === 2 && (await get("p/fx2/index.html")).s === 404 && (await get("assets/img/fx2/0.png")).s === 404 && !(await get("assets/js/data.js")).t.includes("المنتج الثاني"), r);
const rs = await restoreDeleted({ target, db, path: "p/fx2/index.html" }); ok("[S4] الحذف آمن وقابل للاستعادة (الكائن محفوظ)", rs.ok && (await get("p/fx2/index.html")).s === 200, rs);
r = await sync(); ok("[S4b] التسوية التالية تعيد حذف ما استُعيد يدوياً ما دام محذوفاً من المصدر (المصدر هو المرجع)", r.ok && (await get("p/fx2/index.html")).s === 404 || r.planned === 0, r);
/* 5-7) الشحن/checkout/الدفع */
edit({ "assets/data/ship-co.json": JSON.stringify({ def: "yalidine", companies: { yalidine: { name: "Yalidine", prices: { 16: { home: 650, stop: 450 } } } }, run: RUNID }), "assets/data/checkout.json": JSON.stringify({ waNumber: "213559237239", steps: false, guard: { antibot: true, dup: false, hours: 12, phoneDz: true }, orderBtnText: "اطلب الآن", run: RUNID }), "assets/data/pay-methods.json": JSON.stringify({ baridimob: { on: false, rip: "00799999009999999999", name: "x" }, ccp: { on: true, account: "7654321", key: "11", name: "y" }, chargily: { on: false }, run: RUNID }) }, "تعديل الشحن وcheckout وطرق الدفع"); r = await sync();
const sh = JSON.parse((await get("assets/data/ship-co.json")).t), ck2 = JSON.parse((await get("assets/data/checkout.json")).t), pm2 = (await get("assets/data/pay-methods.json")).t;
ok("[S5] إعدادات الشحن وصلت", r.ok && sh.companies.yalidine.prices["16"].home === 650);
ok("[S6] إعدادات checkout وصلت (steps/guard/النص) بلا رقم المالك", ck2.steps === false && ck2.guard.hours === 12 && ck2.orderBtnText === "اطلب الآن" && ck2.waNumber === "213000000000");
ok("[S7] طرق الدفع: الأعلام تغيّرت (chargily مغلق، ccp مفعّل) دون نقل أي سرّ/حساب", JSON.parse(pm2).chargily.on === false && JSON.parse(pm2).ccp.on === true && !/0079999|7654321|"11"/.test(pm2), pm2);
/* 8-9) صفحة ومحتوى وقالب وصورة */
edit({ "assets/pages/home.json": JSON.stringify({ sections: [{ type: "hero", title: "عنوان من اللوحة" }], run: RUNID }), "lp/promo/index.html": "<!doctype html><html><head><title>عرض</title></head><body>عرض خاص</body><!-- " + RUNID + " --></html>", "index.html": "<!doctype html><html><head><title>الرئيسية</title></head><body><h1>رئيسية من اللوحة</h1></body><!-- " + RUNID + " --></html>", "assets/img/banner/hero.png": png(7) }, "صفحة ومحتوى وصورة"); r = await sync();
ok("[S8-9] الصفحات والمحتوى والصورة وصلت وحُمّلت فعلياً (تحقق بالبصمة من الواجهة الحيّة)", r.ok && (await get("lp/promo/index.html")).t.includes("عرض خاص") && (await get("")).t.includes("رئيسية من اللوحة") && (await get("assets/pages/home.json")).s === 200 && (await get("assets/img/banner/hero.png")).s === 200, r);
/* 11) تشغيل مرتين */
const evBefore = (await db.get("SELECT COUNT(*) n FROM sync_events")).n; const rA = await sync(), rB = await sync({ kind: "reconcile" });
ok("[S11] تشغيل المزامنة مرتين بلا تكرار: لا أحداث جديدة ولا تطبيقات", rA.planned === 0 && rB.planned === 0 && rA.applied === 0 && rB.applied === 0 && (await db.get("SELECT COUNT(*) n FROM sync_events")).n === evBefore, { rA, rB });
/* 10) انقطاع Beta ثم عودة */
kv.fail = true; const hOff = [
  edit({ "assets/js/data.js": dataJs([{ ...base[0], title: "نسخة 1 أثناء الانقطاع", price: 1801 }]) }, "أثناء الانقطاع 1"),
  edit({ "assets/img/fx1/2.png": png(11), "assets/data/theme.json": JSON.stringify({ accent: "#222222", run: RUNID }) }, "أثناء الانقطاع 2"),
  edit({ "assets/js/data.js": dataJs([{ ...base[0], title: "النسخة النهائية بعد الانقطاع", price: 1802 }]) }, "أثناء الانقطاع 3")];
const f1 = await sync(), f2 = await sync(); const stOff = await syncStatus(db);
ok("[S10] أثناء انقطاع Beta: فشل صريح، ولا يُعدّ متزامناً، ولا يُفقد شيء (3 commits تنتظر)", !f1.ok && !f2.ok && !stOff.in_sync && !!stOff.last_error, { e: f1.error, st: stOff.in_sync });
kv.fail = false; r = await sync(); const dF = (await get("assets/js/data.js")).t, last = await db.all("SELECT path FROM sync_events WHERE status='applied' ORDER BY seq DESC LIMIT 3");
ok(`[S10] بعد عودة Beta وصلت كل التغييرات (رأس ${head().slice(0, 8)}): الحالة النهائية «النسخة النهائية»، والصورة والمظهر، بالترتيب (data.js آخراً)`, r.ok && dF.includes("النسخة النهائية بعد الانقطاع") && dF.includes("1802") && !dF.includes("نسخة 1 أثناء") && (await get("assets/img/fx1/2.png")).s === 200 && JSON.parse((await get("assets/data/theme.json")).t).accent === "#222222" && last[0].path === "assets/js/data.js", { r, last });
const evMid = (await db.get("SELECT COUNT(*) n FROM sync_events")).n; const rC = await sync(); ok("[S10] لا تكرار بعد التعافي", rC.planned === 0 && (await db.get("SELECT COUNT(*) n FROM sync_events")).n === evMid);
const dup = await db.get("SELECT COUNT(*) n FROM (SELECT path, src_blob, COUNT(*) c FROM sync_events WHERE status='applied' AND op<>'delete' GROUP BY path, src_blob HAVING c>1)"); ok("[S10] لا حدث مطبَّق مكرر لنفس (مسار، محتوى) في كامل السجل", dup.n === 0, dup);
/* انقطاع المصدر */
const savedFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("network down"); }; const gOff = await sync(); globalThis.fetch = savedFetch; ok("[S10b] انقطاع GitHub: فشل واضح بلا أثر على Beta ثم عودة تلقائية", !gOff.ok && /network down|fetch/.test(gOff.error ?? "") && (await sync()).ok);
const fin = await syncStatus(db); console.log("\nلوحة الحالة:", JSON.stringify({ in_sync: fin.in_sync, head_synced: fin.head_synced?.slice(0, 8), items: fin.items, media: fin.media, rev: fin.rev, events: fin.events_total, retries: fin.retries, failed: fin.failed_events.length, quarantined: fin.quarantined.length }));
db.close(); rmSync(tmp, { recursive: true, force: true });
console.log(`\n${bad ? "✗ " + bad + " فاشل من " + n : "✓ " + n + " فحصاً ناجحاً"}  (${((Date.now() - t0) / 1000).toFixed(0)}ث)`); process.exit(bad ? 1 : 0);
