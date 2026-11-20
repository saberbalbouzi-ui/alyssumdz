/* اختبار الـWorker الساكن (الإصدارات/المؤشرات/الرجوع) على محرك Workers المحلي miniflare — ليس Cloudflare الحقيقي. يتطلب MF_DIR (مجلد فيه miniflare)؛ بدونه يُبلغ SKIPPED (ليس نجاحاً). */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import path from "node:path";
import { staticPlan } from "../release-lib.mjs";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
let Miniflare; try { const req = createRequire(path.join(process.env.MF_DIR || process.cwd(), "x.js")); ({ Miniflare } = await import(pathToFileURL(req.resolve("miniflare")).href)); } catch { console.log("SKIPPED: miniflare غير متوفر (MF_DIR) — لم يُشغَّل؛ ليس نجاحاً"); process.exit(process.argv.includes("--require") ? 3 : 0); }
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 300) : "")); } };
const code = readFileSync(path.join(ROOT, "platform/env/beta/static-worker.js"), "utf8");
const mf = new Miniflare({ modules: [{ type: "ESModule", path: "index.js", contents: code }, { type: "ESModule", path: "overrides.js", contents: "export default {};" }], kvNamespaces: ["FILES"], compatibilityDate: "2026-01-01" });
const kv = await mf.getKVNamespace("FILES"), get = (p, init) => mf.dispatchFetch("https://beta.test" + p, init), txt = async (r) => (await r.text());
const F = (o) => Object.entries(o).map(([p, t]) => ({ path: p, buf: Buffer.from(t) }));
async function publish(comp, rel, files) { const { map, objects } = staticPlan(F(files)); for (const [h, b] of objects) await kv.put("o/" + h, b); await kv.put(`__m/${comp}/${rel}`, JSON.stringify(map)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  /* 1) النمط القديم احتياطياً (بلا مؤشرات) */
  await kv.put("index.html", "<h1>قديم</h1>"); await kv.put("admin.html", "<b>admin</b>"); await kv.put("assets/pages/x.json", '{"legacy":1}');
  let r = await get("/"); ok("[1] النمط القديم: / يخدم index.html", r.status === 200 && (await txt(r)) === "<h1>قديم</h1>");
  ok("[2] ترويسات Beta: noindex وnosniff وno-cache للصفحات", /noindex/.test(r.headers.get("x-robots-tag")) && r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("cache-control") === "no-cache");
  r = await get("/admin"); ok("[3] /admin → admin.html (كما Pages)", r.status === 200 && (await txt(r)) === "<b>admin</b>");
  /* 2) نمط الإصدارات */
  await publish("ui", "r-A", { "index.html": "<h1>v-A</h1>", "assets/app.js": "A()", "admin.html": "<b>adminA</b>" }); await publish("templates", "t-A", { "assets/pages/home.json": '{"t":"A"}' });
  await kv.put("__ptr/ui", "r-A"); await kv.put("__ptr/templates", "t-A"); await sleep(5200);
  r = await get("/"); ok("[4] نمط الإصدارات: / من إصدار الواجهة A (وليس القديم)", (await txt(r)) === "<h1>v-A</h1>");
  ok("[5] ترويستا الإصدار تُصرّحان بإصدار الواجهة والقوالب", r.headers.get("x-beta-ui") === "r-A" && r.headers.get("x-beta-templates") === "t-A", [...r.headers]);
  r = await get("/assets/pages/home.json"); ok("[6] القوالب تُخدَم من مؤشرها المنفصل", (await txt(r)) === '{"t":"A"}' && r.headers.get("content-type").startsWith("application/json"));
  r = await get("/assets/app.js"); ok("[7] js: no-cache وtype صحيح", r.headers.get("content-type").startsWith("text/javascript") && r.headers.get("cache-control") === "no-cache");
  /* 3) الأمان */
  const h = Object.keys(JSON.parse(await kv.get("__m/ui/r-A")))[0], hash = JSON.parse(await kv.get("__m/ui/r-A"))[h];
  ok("[8] كائنات المحتوى لا تُكشَف مباشرة (/o/<بصمة> ⇒ 404)", (await get("/o/" + hash)).status === 404);
  ok("[9] بيانات الإصدار والمؤشرات لا تُكشَف (/__m و/__ptr ⇒ 404)، ولا اجتياز مسار", (await get("/__m/ui/r-A")).status === 404 && (await get("/__ptr/ui")).status === 404 && (await get("/a/../index.html")).status !== 500);
  ok("[10] في نمط الإصدارات: ملف قديم غير موجود في البيان ⇒ 404 (لا تسرّب من النمط القديم)", (await get("/assets/old-only.js")).status === 404);
  ok("[11] POST ⇒ 405، وHEAD بلا جسم", (await get("/", { method: "POST" })).status === 405 && (await txt(await get("/", { method: "HEAD" }))) === "");
  /* 4) إصدار جديد ثم رجوع بمؤشر واحد */
  await publish("ui", "r-B", { "index.html": "<h1>v-B</h1>", "assets/app.js": "B()", "admin.html": "<b>adminB</b>" }); await kv.put("__ptr/ui", "r-B"); await sleep(5200);
  r = await get("/"); ok("[12] تبديل المؤشر إلى B يغيّر المحتوى خلال ثوانٍ", (await txt(r)) === "<h1>v-B</h1>" && r.headers.get("x-beta-ui") === "r-B");
  ok("[13] القوالب لم تتغيّر بتبديل الواجهة (فصل الإصدارات)", (await txt(await get("/assets/pages/home.json"))) === '{"t":"A"}');
  await kv.put("__ptr/ui", "r-A"); await sleep(5200);
  r = await get("/"); ok("[14] الرجوع إلى A بكتابة مؤشر واحد: المحتوى القديم عاد", (await txt(r)) === "<h1>v-A</h1>" && r.headers.get("x-beta-ui") === "r-A");
  await publish("templates", "t-B", { "assets/pages/home.json": '{"t":"B"}' }); await kv.put("__ptr/templates", "t-B"); await sleep(5200);
  ok("[15] تبديل القوالب وحدها لا يمسّ الواجهة", (await txt(await get("/assets/pages/home.json"))) === '{"t":"B"}' && (await txt(await get("/"))) === "<h1>v-A</h1>");
  /* 5) متانة */
  await kv.put("__m/ui/r-C", JSON.stringify({ "index.html": "0".repeat(64) })); await kv.put("__ptr/ui", "r-C"); await sleep(5200);
  r = await get("/"); ok("[16] بيان يشير إلى كائن مفقود ⇒ 404 نظيف لا 500", r.status === 404, r.status);
  await kv.put("__ptr/ui", "r-A"); await sleep(5200);
  ok("[17] صفحة 404 تُرسَل بـno-store", (await get("/nope")).headers.get("cache-control") === "no-store");
} finally { await mf.dispose(); }
console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `✓ ${n} فحصاً ناجحاً (محرك Workers المحلي miniflare، ليس Cloudflare الحقيقي)`); process.exit(bad ? 1 : 0);
