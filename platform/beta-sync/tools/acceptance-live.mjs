#!/usr/bin/env node
/* اختبار قبول **حيّ على Beta**: يُجري commits حقيقية على فرع fixture (يحاكي حفظ اللوحة التقليدية) ثم **ينتظر** وصولها إلى Beta عبر Worker المزامنة المستقل (cron كل دقيقة، بلا أي تشغيل يدوي)،
   ويتحقق من واجهة Beta الحيّة (alyssum-beta-web) لا من محاكاة. الانقطاع: يُوقَف جدول cron للـWorker (الوصلة بين المصدر وBeta) أثناء 3 commits ثم يُعاد.
   الاستعمال: FIXTURE_DIR=<نسخة عمل fixture> SYNC_TOKEN_FILE=… BETA_CF_ACCOUNT_ID=… node platform/beta-sync/tools/acceptance-live.mjs */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), FX = process.env.FIXTURE_DIR;
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), B = REG.environments.beta, WEB = "https://" + B.app_host, SYNC = "https://" + B.sync_host, ACC = process.env.BETA_CF_ACCOUNT_ID;
if (!FX || !existsSync(path.join(FX, ".git")) || !/^[0-9a-f]{32}$/.test(ACC ?? "")) { console.error("FIXTURE_DIR وBETA_CF_ACCOUNT_ID مطلوبان"); process.exit(2); }
const TOKEN = JSON.parse(readFileSync(process.env.SYNC_TOKEN_FILE ?? "/home/user/beta-secrets-new/sync.json", "utf8")).SYNC_TOKEN, H = { Authorization: "Bearer " + TOKEN };
const git = (...a) => execFileSync("git", a, { cwd: FX, encoding: "utf8" }).trim(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, bad = 0; const ok = (m, c, x) => { n++; console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : "  → " + JSON.stringify(x).slice(0, 300))); if (!c) bad++; };
const get = async (p) => { const r = await fetch(`${WEB}/${p}?_=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } }); return { s: r.status, t: await r.text(), h: r.headers }; };
const status = async () => (await fetch(SYNC + "/status", { headers: H })).json();
const until = async (what, fn, ms = 200000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return { ok: true, secs: Math.round((Date.now() - t) / 1000) }; } catch { } await sleep(5000); } return { ok: false, secs: Math.round((Date.now() - t) / 1000) }; };
const edit = (files, msg) => { for (const [p, c] of Object.entries(files)) { const f = path.join(FX, p); if (c === null) { rmSync(f, { force: true }); continue; } mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, c); } git("add", "-A"); if (!git("status", "--porcelain")) return git("rev-parse", "HEAD"); git("-c", "user.name=Claude", "-c", "user.email=noreply@anthropic.com", "commit", "-q", "-m", msg + "\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"); git("push", "-q", "origin", "HEAD:refs/heads/beta/sync-fixture"); return git("rev-parse", "HEAD"); };
const RUN = Date.now(), dataJs = (arr) => '/* منتجات fixture */\nvar CATEGORIES = {"general":"المنتجات"};\nvar PRODUCTS = ' + JSON.stringify(arr.map((x) => ({ ...x, run: RUN }))) + ";\n";
const png = (k) => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64").map((b, i, a) => (i === a.length - 20 ? (b + k + RUN) & 255 : i === a.length - 21 ? (b + (RUN >> 8)) & 255 : b));
const base = { slug: "fx1", title: "منتج الاختبار", price: 1500, old: 2000, images: ["assets/img/fx1/0.png"], desc: "وصف", cat: "general", active: true };
const cfApi = async (method, p, body) => { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}${p}`, { method, headers: { Authorization: "Bearer placeholder", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!j.success) throw new Error(JSON.stringify(j.errors)); return j.result; };
const T0 = Date.now(); console.log(`الوجهة الحيّة: ${WEB}  |  مزامنة: ${SYNC}  |  مصدر: beta/sync-fixture\n`);
const st0 = await status(); ok(`[L0] Worker المزامنة يعمل ذاتياً (cron): آخر تشغيل ${st0.last_run}، متزامن=${st0.in_sync}، عناصر=${st0.items_total}`, !!st0.last_run && Date.now() - Date.parse(st0.last_run) < 180000);

/* 1+2 تعديل اسم/سعر/وصف/صورة */
let c = edit({ "assets/js/data.js": dataJs([{ ...base, title: "الاسم الجديد " + RUN, price: 1990, desc: "وصف جديد " + RUN, images: ["assets/img/fx1/0.png", "assets/img/fx1/9.png"] }]), "assets/img/fx1/9.png": png(9) }, "تعديل المنتج (حيّ)");
let w = await until("data", async () => (await get("assets/js/data.js")).t.includes("الاسم الجديد " + RUN) && (await get("assets/img/fx1/9.png")).s === 200);
ok(`[L1-2] تعديل الاسم والسعر والوصف + صورة جديدة (commit ${c.slice(0, 8)}) وصل Beta تلقائياً خلال ${w.secs}ث`, w.ok); { const d = (await get("assets/js/data.js")).t; ok("[L2] السعر والوصف على Beta", d.includes("1990") && d.includes("وصف جديد " + RUN)); }
/* 3 إضافة منتج */
c = edit({ "assets/js/data.js": dataJs([{ ...base, title: "الاسم الجديد " + RUN, price: 1990 }, { slug: "fx" + RUN, title: "منتج مضاف " + RUN, price: 700, images: ["assets/img/fx" + RUN + "/0.png"], cat: "general", active: true }]), ["assets/img/fx" + RUN + "/0.png"]: png(3), ["p/fx" + RUN + "/index.html"]: `<!doctype html><html><head><title>x</title></head><body>صفحة المنتج المضاف ${RUN}</body></html>` }, "إضافة منتج (حيّ)");
w = await until("add", async () => (await get(`p/fx${RUN}/index.html`)).t.includes("صفحة المنتج المضاف") && (await get(`assets/img/fx${RUN}/0.png`)).s === 200 && (await get("assets/js/data.js")).t.includes("منتج مضاف " + RUN));
ok(`[L3] إضافة منتج: الصفحة والصورة والبيانات وصلت خلال ${w.secs}ث`, w.ok); { const pg = (await get(`p/fx${RUN}/index.html`)).t; ok("[L3] طبقة Beta على الصفحة (noindex) وفق قواعد التنظيف", /noindex/.test(pg)); }
/* 4 حذف */
c = edit({ "assets/js/data.js": dataJs([{ ...base, title: "الاسم الجديد " + RUN, price: 1990 }]), ["assets/img/fx" + RUN + "/0.png"]: null, ["p/fx" + RUN + "/index.html"]: null }, "حذف منتج (حيّ)");
w = await until("del", async () => (await get(`p/fx${RUN}/index.html`)).s === 404 && (await get(`assets/img/fx${RUN}/0.png`)).s === 404 && !(await get("assets/js/data.js")).t.includes("منتج مضاف " + RUN));
ok(`[L4] الحذف انعكس على Beta خلال ${w.secs}ث (الصفحة والصورة 404 والبيانات بلا المنتج)`, w.ok); { const t = await until("trash", async () => (await status()).trash >= 2, 90000); const s = await status(); ok("[L4] الحذف آمن: سجل المحذوفات يحتفظ بالكائنات للاستعادة", t.ok && s.trash >= 2, s.trash); }
/* 5-7 إعدادات */
c = edit({ "assets/data/ship-co.json": JSON.stringify({ def: "yalidine", companies: { yalidine: { name: "Yalidine", prices: { 16: { home: 700 + (RUN % 50), stop: 450 } } } }, run: RUN }), "assets/data/checkout.json": JSON.stringify({ waNumber: "213559237239", steps: true, guard: { antibot: true, dup: true, hours: 24, phoneDz: true }, orderBtnText: "تأكيد " + RUN }), "assets/data/pay-methods.json": JSON.stringify({ baridimob: { on: true, rip: "00799999001234567890", name: "x" }, ccp: { on: false, account: "7777777", key: "55", name: "y" }, chargily: { on: true }, run: RUN }) }, "الشحن وcheckout والدفع (حيّ)");
w = await until("cfg", async () => (await get("assets/data/checkout.json")).t.includes("تأكيد " + RUN) && (await get("assets/data/ship-co.json")).t.includes(String(700 + (RUN % 50))) && (await get("assets/data/pay-methods.json")).t.includes(`"run": ${RUN}`));
ok(`[L5-7] الشحن وcheckout وطرق الدفع وصلت خلال ${w.secs}ث`, w.ok);
{ const ck = JSON.parse((await get("assets/data/checkout.json")).t), pm = (await get("assets/data/pay-methods.json")).t; ok("[L6] checkout: الإعدادات تطابق المصدر عدا رقم المالك (← رقم Beta الوهمي)", ck.steps === true && ck.orderBtnText === "تأكيد " + RUN && ck.waNumber === "213000000000");
  ok("[L7] الدفع: أعلام التفعيل تطابق، ولا RIP/حساب CCP/مفاتيح وصلت Beta", JSON.parse(pm).chargily.on === true && JSON.parse(pm).baridimob.on === true && !/0079999|7777777|"55"/.test(pm), pm); }
/* 8-9 صفحة/محتوى/صورة */
c = edit({ "assets/pages/home.json": JSON.stringify({ sections: [{ type: "hero", title: "عنوان " + RUN }] }), ["lp/promo/index.html"]: `<!doctype html><html><head><title>عرض</title></head><body>عرض ${RUN}</body></html>`, "assets/img/banner/hero.png": png(7) }, "صفحة ومحتوى وصورة (حيّ)");
w = await until("pg", async () => (await get("lp/promo/index.html")).t.includes("عرض " + RUN) && (await get("assets/pages/home.json")).t.includes("عنوان " + RUN) && (await get("assets/img/banner/hero.png")).s === 200);
ok(`[L8-9] صفحة المحتوى وlp والصورة وصلت وحُمّلت خلال ${w.secs}ث`, w.ok);
/* 11 تشغيل مرتين */
await until("sync", async () => (await status()).in_sync, 120000); const e1 = (await status()).events_total; await fetch(SYNC + "/run?kind=incremental", { method: "POST", headers: H }); await fetch(SYNC + "/run?kind=reconcile", { method: "POST", headers: H }); const s2 = await status();
ok("[L11] تشغيل المزامنة يدوياً مرتين فوق الدورات الذاتية: لا أحداث ولا تكرار", s2.events_total === e1 && s2.in_sync, { e1, e2: s2.events_total });
/* 10 انقطاع الوصلة ثم عودتها */
await cfApi("PUT", `/workers/scripts/${B.sync_worker}/schedules`, []); console.log("  [انقطاع] أُوقف جدول cron؛ انتظار توقف آخر تشغيل فعلياً (انتشار الإعداد)…");
{ let lastRun = (await status()).last_run, quiet = 0; for (let i = 0; i < 30 && quiet < 2; i++) { await sleep(65000); const lr = (await status()).last_run; if (lr === lastRun) quiet++; else { quiet = 0; lastRun = lr; } } ok("[L10] الوصلة متوقفة فعلاً: لا تشغيل جديد لدقيقتين متتاليتين", quiet >= 2, { lastRun }); }
console.log("  [انقطاع] ثلاثة commits أثناء الانقطاع…"); const evBefore = (await status()).events_total;
const offC = [edit({ "assets/js/data.js": dataJs([{ ...base, title: "أثناء الانقطاع 1 " + RUN, price: 2001 }]) }, "انقطاع 1"), edit({ "assets/img/fx1/off.png": png(21), "assets/data/theme.json": JSON.stringify({ accent: "#111" + (RUN % 10), run: RUN }) }, "انقطاع 2"), edit({ "assets/js/data.js": dataJs([{ ...base, title: "النهائي بعد الانقطاع " + RUN, price: 2002 }]) }, "انقطاع 3")];
await sleep(150000); const during = (await get("assets/js/data.js")).t; const sOff = await status();
ok("[L10] أثناء الانقطاع (150ث) لا يصل شيء إلى Beta ولا يُفقد من المصدر (3 commits تنتظر)", !during.includes("النهائي بعد الانقطاع") && !during.includes("أثناء الانقطاع") && sOff.events_total === evBefore, { events: sOff.events_total, evBefore });
await cfApi("PUT", `/workers/scripts/${B.sync_worker}/schedules`, [{ cron: "* * * * *" }]); console.log("  [عودة] أُعيد جدول cron");
w = await until("back", async () => (await get("assets/js/data.js")).t.includes("النهائي بعد الانقطاع " + RUN) && (await get("assets/img/fx1/off.png")).s === 200 && (await get("assets/data/theme.json")).t.includes(`"run": ${RUN}`));
ok(`[L10] بعد عودة الوصلة وصلت كل التغييرات تلقائياً خلال ${w.secs}ث (الحالة النهائية = رأس المصدر ${offC.at(-1).slice(0, 8)})`, w.ok);
await until("sync2", async () => (await status()).in_sync, 120000); const sF = await status(), ev = await (await fetch(SYNC + "/status", { headers: H })).json();
const order = sF.recent_events.filter((e) => e.status === "applied").slice(0, 3).map((e) => e.path);
ok("[L10] الترتيب: الصورة والمظهر قبل data.js في سجل الأحداث", order[0] === "assets/js/data.js", order);
ok("[L10] لا تكرار: كل حدث مطبَّق فريد، وإعادة التشغيل لا تضيف أحداثاً", sF.in_sync && (await (await fetch(SYNC + "/run?kind=incremental", { method: "POST", headers: H })).json()).planned === 0);
/* عزل */
const pay = (await get("assets/data/payments.json")).t, cus = (await get("assets/data/customers.json")).t, app = (await get("assets/js/app.js")).t;
ok("[L12] الطلبات/العملاء/المدفوعات لم تنتقل: payments وcustomers على Beta هما الافتراضيان الفارغان لا محتوى المصدر (S000000-FIXTURE / زبون وهمي)", !/FIXTURE|زبون وهمي/.test(pay + cus));
ok("[L12] الشيفرة لم تُزامَن: app.js على Beta ليس من المصدر", !/FIXTURE/.test(app));
const fin = await status(); ok("[L13] لا طلب إلى Production: أحداث السجل كلها مسارات محتوى، ولا مضيف خارجي غير GitHub في الشيفرة (فحص F1/F2)", fin.recent_events.every((e) => /^(assets|p|lp|index)/.test(e.path)));
console.log("\nلوحة الحالة:", JSON.stringify({ in_sync: fin.in_sync, head_synced: fin.head_synced?.slice(0, 8), items: fin.items, media: fin.media, rev: fin.rev, events: fin.events_total, retries: fin.retries, failed: fin.failed_events.length, quarantined: fin.quarantined.length, trash: fin.trash }));
console.log(`\n${bad ? "✗ " + bad + " فاشل من " + n : "✓ " + n + " فحصاً ناجحاً"}  (${Math.round((Date.now() - T0) / 1000)}ث)`); process.exit(bad ? 1 : 0);
