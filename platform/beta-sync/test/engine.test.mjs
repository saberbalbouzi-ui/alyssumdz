/* اختبار محرّك المزامنة (بلا شبكة): مصدر مستودع وهمي بالتزامات، ووجهة KV وهمية تُخدَّم بـ**static-worker.js الحقيقي** (النص نفسه المنشور على Beta)، وD1 فعلي بـnode:sqlite.
   يغطي اختبارات القبول: تعديل/إضافة/حذف منتج، إعدادات (شحن/checkout/دفع)، صفحات ومحتوى، صور، انقطاع Beta ثم عودة بالترتيب، تشغيل مرتين بلا تكرار،
   عدم نقل الطلبات/العملاء/الأسرار، عدم لمس الشيفرة (اختلاف التصميم)، حذف آمن مع استعادة، تراجع الرأس، انحراف البيان بعد إصدار جديد. */
import { readFileSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeSqliteDb } from "../src/db-node.mjs";
import { KVTarget } from "../src/targets.js";
import { makeSanitizer, classify, compOf, TPL_PREFIXES, sha256Hex, findSecrets } from "../src/rules.js";
import { runSync, restoreDeleted, syncStatus } from "../src/engine.js";
import { meta } from "../src/db.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
let n = 0, bad = 0; const ok = (m, c, x) => { n++; if (!c) { bad++; console.log("✗ " + m + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 400) : "")); } };
const enc = new TextEncoder(), dec = new TextDecoder(), sec = (t) => console.log("— " + t);
const REG = JSON.parse(readFileSync(path.join(ROOT, "platform/env/environments.json"), "utf8")), NP = REG.never_outside_production, BETA = REG.environments.beta;

/* ── static-worker الحقيقي (نسخة حديثة لكل طلب: بلا ذاكرة 5ث) ── */
const tmp = mkdtempSync(path.join(tmpdir(), "bsync-")); let swN = 0;
const swSrc = readFileSync(path.join(ROOT, "platform/env/beta/static-worker.js"), "utf8");
const swFile = async () => { const f = path.join(tmp, `sw${swN++}.mjs`); writeFileSync(f, swSrc.replace('./overrides.js', "./ov.mjs")); if (swN === 1) writeFileSync(path.join(tmp, "ov.mjs"), "export default {};"); return (await import(pathToFileURL(f).href + "?x=" + swN)).default; };

class MemKV {
  constructor() { this.m = new Map(); this.fail = false; this.puts = 0; }
  async get(k, t) { if (this.fail) throw new Error("kv offline"); const v = this.m.get(k); if (v == null) return null; if (t === "arrayBuffer" || t?.type === "arrayBuffer") return typeof v === "string" ? enc.encode(v).buffer : v.slice().buffer; return typeof v === "string" ? v : dec.decode(v); }
  async getWithMetadata(k) { if (this.fail) throw new Error("kv offline"); return { value: this.m.has(k) ? { cancel() { } } : null }; }
  async put(k, v) { if (this.fail) throw new Error("kv offline"); this.puts++; this.m.set(k, typeof v === "string" ? v : new Uint8Array(v)); }
}
const web = (kv) => ({ fetch: async (req) => { const sw = await swFile(); return sw.fetch(req, { FILES: kv }); } });
const seed = async (kv, comp, rel, files) => { const map = {}; for (const [p, c] of Object.entries(files)) { const b = enc.encode(c), h = await sha256Hex(b); map[p] = h; kv.m.set("o/" + h, b); } kv.m.set("__ptr/" + comp, rel); kv.m.set(`__m/${comp}/${rel}`, JSON.stringify(map)); };

/* ── مستودع وهمي ── */
class FakeRepo {
  constructor() { this.commits = []; this.files = new Map(); this.calls = []; this.offline = false; this.hi = -1; }
  async commit(msg, changes) { this.commits = this.commits.slice(0, this.hi + 1); const next = new Map(this.files); for (const [p, c] of Object.entries(changes)) { if (c === null) next.delete(p); else next.set(p, typeof c === "string" ? enc.encode(c) : c); } const sha = (await sha256Hex(enc.encode(msg + this.commits.length))).slice(0, 40); this.commits.push({ sha, msg, snap: next }); this.hi = this.commits.length - 1; this.files = next; return sha; }
  at(sha) { return this.commits.find((c) => c.sha === sha); }
  async head() { this.calls.push("head"); if (this.offline) throw new Error("github offline"); return this.commits[this.hi].sha; }
  async tree(sha) { this.calls.push("tree"); const m = new Map(); for (const [p, b] of this.at(sha).snap) m.set(p, { blob: "b" + (await sha256Hex(b)).slice(0, 38), size: b.length }); return m; }
  async bytes(sha, p) { this.calls.push("raw:" + p); const b = this.at(sha).snap.get(p); if (!b) throw new Error("404"); return b; }
  async compare(from, to) { const i = this.commits.findIndex((c) => c.sha === from), j = this.commits.findIndex((c) => c.sha === to); if (i < 0 || j < 0) return { status: "diverged", commits: [] }; if (i === j) return { status: "identical", commits: [] }; return j > i ? { status: "ahead", commits: this.commits.slice(i + 1, j + 1).map((c) => ({ sha: c.sha, message: c.msg })) } : { status: "behind", commits: [] }; }
  reset(sha) { const i = this.commits.findIndex((c) => c.sha === sha); this.hi = i; this.files = this.commits[i].snap; }
}
const san = makeSanitizer({ registry: { never_outside_production: NP }, beta: { appHost: BETA.app_host, supabaseUrl: "https://xhdnqnxmcmfhrgctlkzy.supabase.co", anonKey: "sb_publishable_BETA_TEST_KEY_000000000000", waPlaceholder: "213000000000" } });
const PRODUCTS = (arr) => `/* منتجات */\nvar CATEGORIES = {"general":"المنتجات"};\nvar PRODUCTS = ${JSON.stringify(arr)};\n`;
const P1 = { slug: "honey", title: "عسل السدر", price: 2000, desc: "عسل طبيعي", images: ["assets/img/honey/0.webp"], cat: "general", active: true };
const PAGE = (t) => `<!doctype html><html><head><title>${t}</title></head><body><h1>${t}</h1></body></html>`;
const IMG = (k) => new Uint8Array([0x52, 0x49, 0x46, 0x46, k, 1, 2, 3, 4, 5, 6, 7]);

async function world() {
  const repo = new FakeRepo(), kv = new MemKV(), db = new NodeSqliteDb();
  await seed(kv, "ui", "r-1", { "index.html": PAGE("قالب"), "assets/js/app.js": "console.log('app v1')", "assets/js/data.js": PRODUCTS([{ slug: "demo", title: "تجريبي", price: 1 }]), "assets/css/style.css": "body{}" });
  await seed(kv, "templates", "r-1", { "assets/pages/templates/home.json": "{}" });
  const target = new KVTarget({ kv, web: web(kv), base: "https://" + BETA.app_host, sleep: async () => { }, verifyTries: 2 });
  await repo.commit("c0 أساس", { "assets/js/data.js": PRODUCTS([P1]), "assets/img/honey/0.webp": IMG(1), "p/honey/index.html": PAGE("عسل"), "assets/data/store.json": JSON.stringify({ name: "متجري", phone: "0559237239", email: "x@y.z", address: "الجزائر", tz: "Africa/Algiers" }), "assets/js/app.js": "console.log('PROD app')", "assets/css/admin.css": "x{}" });
  const run = (o = {}) => runSync({ source: repo, target, db, san, ...o });
  return { repo, kv, db, target, run, web: target.web, get: async (p) => { const r = await target.web.fetch(new Request(`https://${BETA.app_host}/${p}`)); return { s: r.status, t: await r.text() }; } };
}

sec("A) تصنيف المسارات: allowlist صريح (لا شيفرة، لا طلبات/عملاء/أسرار)");
{ const C = (p) => classify(p)?.id ?? null;
  ok("[A1] المحتوى التجاري مُصنَّف", C("assets/js/data.js") === "products" && C("assets/data/ship-co.json") === "settings:ship-co" && C("assets/data/checkout.json") === "settings:checkout" && C("assets/data/pay-methods.json") === "settings:pay-methods" && C("assets/img/honey/0.webp") === "media" && C("p/honey/index.html") === "pages" && C("lp/promo/index.html") === "pages" && C("assets/pages/home.json") === "pages" && C("assets/data/theme.json") === "settings:theme");
  ok("[A2] الشيفرة والقوالب البرمجية خارج النطاق (تصل بالإصدارات)", ["assets/js/app.js", "assets/css/style.css", "admin.html", "sw.js", "assets/pages/templates/home.json", "assets/pages/_conv/x.json", "assets/img/tpl/a.webp", "p/_template/index.html", "scripts/pagebuilder.js"].every((p) => C(p) === null));
  ok("[A3] بيانات الطلبات والعملاء والأسرار لا قاعدة لها أبداً", ["assets/data/payments.json", "assets/data/customers.json", "assets/data/returns.json", "assets/data/social.json", "assets/data/pixels.json", "assets/data/med-notes.json", "supabase/schema.sql", ".env", "assets/data/staff.json"].every((p) => C(p) === null));
  ok("[A4] توجيه المكوّن مطابق لـstatic-worker.js الحقيقي (TPL)", (() => { const m = swSrc.match(/const TPL = \[([^\]]+)\]/); const sw = m[1].split(",").map((x) => x.trim().replace(/"/g, "")); return JSON.stringify(sw) === JSON.stringify(TPL_PREFIXES); })(), swSrc.match(/const TPL = \[([^\]]+)\]/)?.[1]);
  ok("[A5] lp/ وassets/pages/ ← templates؛ p/ وassets/img/ ← ui", compOf("lp/a/index.html") === "templates" && compOf("assets/pages/home.json") === "templates" && compOf("p/a/index.html") === "ui" && compOf("assets/data/theme.json") === "ui"); }

sec("B) التنظيف: لا أسرار ولا هوية ولا Production");
{ const t = (p, s, cls = classify(p)) => san.transform(p, enc.encode(s), cls);
  const st = t("assets/data/store.json", JSON.stringify({ name: "م", phone: "0559237239", email: "a@b.c", wa: "213559237239", address: "x", tz: "Africa/Algiers", lang: "ar" })); const so = st.bytes && JSON.parse(dec.decode(st.bytes));
  ok("[B1] store.json: حقول الاتصال تُفرَّغ والإعدادات العامة تبقى", so && so.phone === "" && so.email === "" && so.wa === "" && so.address === "" && so.tz === "Africa/Algiers" && so.lang === "ar" && so.name === "م", so);
  const ck = t("assets/data/checkout.json", JSON.stringify({ waNumber: "213559237239", steps: true, guard: { dup: true }, orderBtnText: "تأكيد" })); const co = ck.bytes && JSON.parse(dec.decode(ck.bytes));
  ok("[B2] checkout.json: يتطابق مع المصدر عدا رقم المالك ← رقم Beta الوهمي", co && co.steps === true && co.guard.dup === true && co.orderBtnText === "تأكيد" && co.waNumber === "213000000000", co);
  const pm = t("assets/data/pay-methods.json", JSON.stringify({ baridimob: { on: true, rip: "00799999001234567890", name: "علي" }, ccp: { on: true, account: "1234567", key: "89", name: "علي" }, chargily: { on: true, secretKey: "x" } })); const po = pm.bytes && JSON.parse(dec.decode(pm.bytes)), raw = pm.bytes ? dec.decode(pm.bytes) : "";
  ok("[B3] pay-methods.json: أعلام التفعيل تتطابق، والأرقام/الحسابات/المفاتيح لا تنتقل", po && po.baridimob.on === true && po.ccp.on === true && po.chargily.on === true && po.baridimob.rip === "" && po.ccp.account === "" && po.ccp.key === "" && !/0079999|1234567|secretKey|"89"/.test(raw), raw);
  const d = t("assets/js/data.js", PRODUCTS([{ slug: "a", title: "ب", images: ["https://alyssumdz.com/assets/img/a.webp"], link: "https://" + "qvdaiundlkfbmjlummni" + ".supabase.co/x" }])); const dt = d.bytes ? dec.decode(d.bytes) : "";
  ok("[B4] مضيف/مرجع Production في المحتوى يُستبدل بـBeta (ويُسجَّل)", d.bytes && !/alyssumdz\.com|qvdaiundlkfbmjlummni/.test(dt) && dt.includes(BETA.app_host) && d.notes.some((x) => /prod-host/.test(x)) && d.notes.some((x) => /supabase-ref/.test(x)), d.notes);
  ok("[B5] سرّ (sk_live) في أي ملف ⇒ حجر لا نسخ", !!t("assets/js/data.js", PRODUCTS([{ k: "sk_live_" + "A".repeat(20) }])).blocked && findSecrets("Bearer " + "a".repeat(45)).length === 1);
  ok("[B6] هوية مالك (بريد/اسم حساب) ⇒ حجر", !!t("assets/pages/p.json", JSON.stringify({ note: "saber.balbouzi@gmail.com" })).blocked && !!t("lp/x/index.html", "<a href='https://github.com/saberbalbouzi-ui/x'>x</a>").blocked);
  ok("[B7] رقم المالك داخل صفحة ← رقم Beta الوهمي (لا حجر)", (() => { const r = t("lp/x/index.html", "<head></head><body><a href='https://wa.me/213559237239'>x</a></body>"); return r.bytes && !dec.decode(r.bytes).includes("559237239") && dec.decode(r.bytes).includes("213000000000"); })());
  const h = t("p/honey/index.html", "<html><head><title>x</title></head><body>b</body></html>"); const ht = dec.decode(h.bytes);
  ok("[B8] HTML: طبقة Beta (noindex + شريط Beta بمسار نسبي صحيح)", /name="robots" content="noindex,nofollow"/.test(ht) && ht.includes('<script src="../../assets/js/beta-banner.js" defer></script>'), ht);
  ok("[B9] JSON تالف/وسيط كبير/فارغ ⇒ حجر", !!t("assets/data/theme.json", "{bad").blocked && !!san.transform("assets/img/a.webp", new Uint8Array(9_000_000), classify("assets/img/a.webp")).blocked && !!san.transform("assets/img/a.webp", new Uint8Array(0), classify("assets/img/a.webp")).blocked); }

sec("C) المزامنة الأولى + اختبارات القبول");
{ const w = await world(); const r1 = await w.run();
  ok("[C1] التشغيل الأول ينجح ويطبّق المحتوى فقط (data.js + صورة + صفحة منتج + store.json)", r1.ok && r1.applied === 4 && r1.failed === 0, r1);
  const d = await w.get("assets/js/data.js"), pg = await w.get("p/honey/index.html"), img = await w.kv.get("o/" + (JSON.parse(w.kv.m.get("__m/ui/r-1"))["assets/img/honey/0.webp"]), "arrayBuffer");
  ok("[C2] Beta تخدم منتجات اللوحة التقليدية (لا التجريبية) وصفحة المنتج بطبقة Beta", d.s === 200 && d.t.includes("عسل السدر") && !d.t.includes("تجريبي") && pg.s === 200 && /noindex/.test(pg.t));
  ok("[C3] الصورة وصلت وبقيت بايتاتها كما هي (التحقق الحيّ بالبصمة)", img && new Uint8Array(img).length === IMG(1).length);
  const st = await w.get("assets/data/store.json"), sj = JSON.parse(st.t);
  ok("[C4] store.json بلا هاتف/بريد/عنوان ومع الإعدادات العامة", sj.phone === "" && sj.email === "" && sj.address === "" && sj.tz === "Africa/Algiers", sj);
  const app = await w.get("assets/js/app.js"), css = await w.get("assets/css/style.css");
  ok("[C5] الشيفرة لم تُمَسّ (app.js/style.css من إصدار Beta لا من main): اختلاف التصميم/الشيفرة لا يغيّر المحتوى", app.t.includes("app v1") && !app.t.includes("PROD app") && css.t === "body{}");
  const before = (await w.db.get("SELECT COUNT(*) n FROM sync_events")).n, puts = w.kv.puts, r2 = await w.run();
  ok("[C6] تشغيل ثانٍ بلا تغيير ⇒ لا أحداث ولا كتابات (idempotent)", r2.ok && r2.planned === 0 && r2.applied === 0 && (await w.db.get("SELECT COUNT(*) n FROM sync_events")).n === before && w.kv.puts === puts, r2);
  const r3 = await w.run({ kind: "reconcile" }); ok("[C7] تشغيل ثالث (تسوية بفحص حيّ) بلا فروقات ولا أحداث", r3.ok && r3.diffs === 0 && r3.applied === 0 && r3.verified >= 3, r3);
  /* 1) تعديل اسم منتج  2) سعر/وصف/صورة */
  await w.repo.commit("تعديل منتج", { "assets/js/data.js": PRODUCTS([{ ...P1, title: "عسل السدر الملكي", price: 2500, desc: "وصف جديد", images: ["assets/img/honey/0.webp", "assets/img/honey/1.webp"] }]), "assets/img/honey/1.webp": IMG(2) });
  const r4 = await w.run(); const d2 = (await w.get("assets/js/data.js")).t;
  ok("[C8] تعديل الاسم والسعر والوصف + إضافة صورة يصل Beta خلال تشغيل واحد، الوسائط قبل data.js", r4.ok && r4.applied === 2 && d2.includes("الملكي") && d2.includes("2500") && d2.includes("وصف جديد"), r4);
  const evs = await w.db.all("SELECT path FROM sync_events ORDER BY seq DESC LIMIT 2"); ok("[C9] ترتيب الاعتماديات: الصورة قبل data.js في السجل", evs[0].path === "assets/js/data.js" && evs[1].path === "assets/img/honey/1.webp", evs);
  const im2 = JSON.parse(w.kv.m.get("__m/ui/r-1"))["assets/img/honey/1.webp"]; ok("[C10] الصورة الجديدة محمّلة فعلياً من الواجهة الحيّة", !!im2 && (await w.get("assets/img/honey/1.webp")).s === 200);
  /* 3) إضافة منتج  */
  await w.repo.commit("منتج جديد", { "assets/js/data.js": PRODUCTS([P1, { slug: "tea", title: "شاي", price: 900, images: ["assets/img/tea/0.webp"], cat: "general", active: true }]), "assets/img/tea/0.webp": IMG(3), "p/tea/index.html": PAGE("شاي") });
  const r5 = await w.run(); ok("[C11] إضافة منتج: الصفحة والصورة والبيانات", r5.ok && (await w.get("p/tea/index.html")).s === 200 && (await w.get("assets/js/data.js")).t.includes("شاي") && (await w.get("assets/img/tea/0.webp")).s === 200, r5);
  /* 4) حذف منتج مع الاستعادة */
  await w.repo.commit("حذف منتج", { "assets/js/data.js": PRODUCTS([P1]), "assets/img/tea/0.webp": null, "p/tea/index.html": null });
  const r6 = await w.run(); ok("[C12] حذف منتج ينعكس: الصفحة والصورة 404 وlist data.js بلا المنتج", r6.ok && r6.deleted === 2 && (await w.get("p/tea/index.html")).s === 404 && (await w.get("assets/img/tea/0.webp")).s === 404 && !(await w.get("assets/js/data.js")).t.includes("شاي"), r6);
  ok("[C13] الحذف آمن: سجل محذوفات والكائن باقٍ في KV", (await w.db.get("SELECT COUNT(*) n FROM sync_trash")).n === 2 && (await w.target.hasObject((await w.db.get("SELECT out_sha FROM sync_trash WHERE path='p/tea/index.html'")).out_sha)));
  const rs = await restoreDeleted({ target: w.target, db: w.db, path: "p/tea/index.html" }); ok("[C14] استعادة العنصر المحذوف تعمل", rs.ok && (await w.get("p/tea/index.html")).s === 200, rs);
  /* 5-7) إعدادات */
  await w.repo.commit("إعدادات", { "assets/data/ship-co.json": JSON.stringify({ def: "yalidine", companies: { yalidine: { prices: { 16: { home: 600 } } } } }), "assets/data/checkout.json": JSON.stringify({ steps: true, waNumber: "213559237239", guard: { dup: true } }), "assets/data/pay-methods.json": JSON.stringify({ chargily: { on: true }, baridimob: { on: true, rip: "00799999001234567890" } }), "assets/data/theme.json": JSON.stringify({ accent: "#d4a947" }) });
  const r7 = await w.run(); const sh = JSON.parse((await w.get("assets/data/ship-co.json")).t), ch = JSON.parse((await w.get("assets/data/checkout.json")).t), pmj = (await w.get("assets/data/pay-methods.json")).t;
  ok("[C15] الشحن/checkout/الدفع/المظهر تصل Beta", r7.ok && sh.companies.yalidine.prices[16].home === 600 && ch.steps === true && JSON.parse((await w.get("assets/data/theme.json")).t).accent === "#d4a947", r7);
  ok("[C16] checkout: رقم المالك لم يصل؛ pay-methods: الأعلام وصلت والـRIP لم يصل", ch.waNumber === "213000000000" && JSON.parse(pmj).chargily.on === true && !/0079999/.test(pmj), { ch, pmj });
  /* 8) صفحة ومحتوى وقالب */
  await w.repo.commit("صفحات", { "assets/pages/home.json": JSON.stringify({ sections: [{ type: "hero", title: "مرحباً" }] }), "lp/promo/index.html": PAGE("عرض"), "index.html": PAGE("الرئيسية الجديدة"), "assets/pages/templates/x.json": "{}" });
  const r8 = await w.run(); const m2 = JSON.parse(w.kv.m.get("__m/templates/r-1")), m1 = JSON.parse(w.kv.m.get("__m/ui/r-1"));
  ok("[C17] صفحات المحتوى تصل لمكوّنها (templates للـlp وassets/pages، ui للرئيسية)", r8.ok && !!m2["lp/promo/index.html"] && !!m2["assets/pages/home.json"] && !!m1["index.html"] && (await w.get("lp/promo/index.html")).s === 200 && (await w.get("")).t.includes("الرئيسية الجديدة"), r8);
  ok("[C18] قوالب المكتبة البرمجية لم تُزامَن", !m2["assets/pages/templates/x.json"]);
  /* 12) عزل الطلبات/العملاء/الأسرار */
  await w.repo.commit("خاص", { "assets/data/payments.json": JSON.stringify({ byOrder: { S1: { rip: "x" } } }), "assets/data/customers.json": "[{\"phone\":\"0550000000\"}]", "assets/data/returns.json": "[]", "assets/data/pixels.json": "[{\"id\":\"123\"}]", ".env": "KEY=sk_live_" + "B".repeat(20), "assets/pages/leak.json": JSON.stringify({ token: "sk_live_" + "C".repeat(20) }), "assets/data/seo.json": JSON.stringify({ contact: "saber.balbouzi@gmail.com" }) });
  const r9 = await w.run(); const all = JSON.stringify([...w.kv.m.keys()]) + JSON.stringify(JSON.parse(w.kv.m.get("__m/ui/r-1"))) + JSON.stringify(JSON.parse(w.kv.m.get("__m/templates/r-1")));
  ok("[C19] الطلبات/العملاء/المدفوعات/الأسرار لا تصل Beta ولا تظهر في أي بيان", r9.ok && !/payments\.json|customers\.json|returns\.json|pixels\.json|\.env|leak\.json/.test(all) && !JSON.stringify([...w.kv.m.entries()].filter(([k]) => k.startsWith("o/")).map(([, v]) => typeof v === "string" ? v : dec.decode(v))).match(/sk_live_|saber\.balbouzi|0079999/), r9);
  ok("[C20] الملفات التي فيها سرّ/هوية محجورة وتظهر بسببها في اللوحة", r9.quarantined === 2 && (await syncStatus(w.db)).quarantined.length === 2, await syncStatus(w.db).then((s) => s.quarantined));
  ok("[C21] لا اتصال إلا بالمصدر (git) — لا طلب إلى أي مضيف Production", w.repo.calls.every((c) => /^(head|tree|raw:)/.test(c)));
  const s = await syncStatus(w.db); ok("[C22] لوحة المراقبة: متزامن، آخر تحديث، عدد العناصر، وسائط، revision", s.in_sync && s.synced_at && s.items_total >= 10 && s.media.synced === 2 && s.rev > 10 && s.head_seen === await w.repo.head(), { in_sync: s.in_sync, items: s.items_total, media: s.media, rev: s.rev });
  w.db.close(); }

sec("D) انقطاع Beta/المصدر: لا فقد، ترتيب، وإعادة محاولة");
{ const w = await world(); await w.run();
  w.kv.fail = true;                                                                                              // Beta غير متاحة
  await w.repo.commit("تغيير 1", { "assets/js/data.js": PRODUCTS([{ ...P1, title: "نسخة 1" }]) });
  await w.repo.commit("تغيير 2", { "assets/img/honey/2.webp": IMG(9), "assets/data/theme.json": JSON.stringify({ accent: "#111" }) });
  await w.repo.commit("تغيير 3", { "assets/js/data.js": PRODUCTS([{ ...P1, title: "نسخة 3 النهائية" }]) });
  const f1 = await w.run(), f2 = await w.run();
  ok("[D1] أثناء الانقطاع: التشغيل يفشل بوضوح ولا يُفقد شيء ولا يُسجَّل متزامناً", !f1.ok && !f2.ok && (await syncStatus(w.db)).in_sync === false && !!(await syncStatus(w.db)).last_error, { f1: f1.error, f2: f2.error });
  w.kv.fail = false; const r = await w.run();
  const d = (await w.get("assets/js/data.js")).t, evs = await w.db.all("SELECT path, status FROM sync_events WHERE status='applied' ORDER BY seq DESC LIMIT 3");
  ok("[D2] بعد عودة Beta تصل كل التغييرات (الحالة النهائية: «نسخة 3») بالترتيب: وسائط ثم إعدادات ثم data.js", r.ok && d.includes("نسخة 3 النهائية") && !d.includes("نسخة 1") && (await w.get("assets/img/honey/2.webp")).s === 200 && JSON.parse((await w.get("assets/data/theme.json")).t).accent === "#111" && evs[0].path === "assets/js/data.js", { r, evs });
  const r2 = await w.run(); ok("[D3] لا تكرار بعد التعافي", r2.planned === 0 && r2.applied === 0);
  /* المصدر نفسه غير متاح (GitHub) */
  w.repo.offline = true; const g = await w.run(); w.repo.offline = false; ok("[D4] انقطاع GitHub: فشل واضح بلا أثر على Beta، وعودة تلقائية", !g.ok && /github offline/.test(g.error) && (await w.run()).ok);
  /* كتابة جزئية: الكائنات تُرفع لكن البيان يفشل */
  await w.repo.commit("تغيير 4", { "assets/js/data.js": PRODUCTS([{ ...P1, title: "نسخة 4" }]) }); const putOrig = w.target.setManifest.bind(w.target); w.target.setManifest = async () => { throw new Error("manifest put failed"); };
  const pf = await w.run(); w.target.setManifest = putOrig; ok("[D5] فشل كتابة البيان: الحدث failed ويُعاد لاحقاً، والموقع يخدم النسخة السابقة سليمة", !pf.ok && (await w.get("assets/js/data.js")).t.includes("نسخة 3 النهائية"));
  const pr = await w.run(); const att = await w.db.get("SELECT attempts, status FROM sync_events WHERE path='assets/js/data.js' ORDER BY seq DESC LIMIT 1"); ok("[D6] إعادة المحاولة تنجح وتُسجَّل (attempts>1) بلا حدث مكرر", pr.ok && att.status === "applied" && att.attempts >= 2 && (await w.get("assets/js/data.js")).t.includes("نسخة 4"), att);
  w.db.close(); }

sec("E) سلامة: تراجع الرأس، تفرّع، إصدار واجهة جديد، ميزانية، قفل");
{ const w = await world(); await w.run(); const h1 = await w.repo.head();
  await w.repo.commit("تغيير", { "assets/js/data.js": PRODUCTS([{ ...P1, title: "أحدث" }]) }); await w.run();
  w.repo.reset(h1); const back = await w.run();
  ok("[E1] رأس أقدم من المرصود (تراجع المصدر) لا يُطبَّق فوق الأحدث", back.skipped === "stale-head" && (await w.get("assets/js/data.js")).t.includes("أحدث"), back);
  const forced = await w.run({ force: true }); ok("[E2] force صريح فقط يسمح بتطبيق الأقدم", forced.ok && (await w.get("assets/js/data.js")).t.includes("عسل السدر") && !(await w.get("assets/js/data.js")).t.includes("أحدث"), forced);
  w.db.close(); }
{ const w = await world(); await w.run();                                                                         // إصدار واجهة جديد يستبدل البيان فتضيع التعديلات ← تسوية تعيدها
  await seed(w.kv, "ui", "r-2", { "index.html": PAGE("قالب"), "assets/js/app.js": "console.log('app v2')", "assets/js/data.js": PRODUCTS([{ slug: "demo", title: "تجريبي" }]) }); const r = await w.run();
  ok("[E3] بعد إصدار واجهة جديد (بيان جديد) تُعاد المزامنة تلقائياً بلا تغيير في المصدر (انحراف مكتشف)", r.ok && r.diffs >= 3 && (await w.get("assets/js/data.js")).t.includes("عسل السدر") && (await w.get("assets/js/app.js")).t.includes("app v2"), r);
  w.db.close(); }
{ const w = await world(); const files = {}; for (let i = 0; i < 30; i++) files[`assets/img/b/${i}.webp`] = IMG(i + 20); await w.repo.commit("30 صورة", files);
  const a = await w.run({ budget: { files: 8 } }); ok("[E4] الميزانية تقسّم العمل (8 ملفات) وتبقى «غير متزامن» حتى الاكتمال", a.ok && a.applied === 8 && a.pending > 0 && !(await syncStatus(w.db)).in_sync, a);
  let last; for (let i = 0; i < 6; i++) last = await w.run({ budget: { files: 8 } }); ok("[E5] التشغيلات التالية تُكمل بلا تكرار وتصل إلى «متزامن»", last.pending === 0 && (await syncStatus(w.db)).in_sync && (await syncStatus(w.db)).media.synced === 31, await syncStatus(w.db).then((s) => s.media));
  await meta.set(w.db, "lock", Date.now()); const lk = await w.run(); ok("[E6] قفل نشط يمنع تشغيلاً متزامناً ثانياً", lk.skipped === "locked"); await meta.set(w.db, "lock", 0);
  w.db.close(); }
{ const w = await world(); const noMan = new MemKV(); const t2 = new KVTarget({ kv: noMan, web: web(noMan), base: "https://x", sleep: async () => { } }); const r = await runSync({ source: w.repo, target: t2, db: new NodeSqliteDb(), san });
  ok("[E7] بلا إصدار واجهة منشور ⇒ يتوقف بخطأ صريح بلا كتابة", !r.ok && /لا إصدار واجهة/.test(r.error ?? "") && noMan.puts === 0, r); w.db.close(); }

sec("E2) خمول بلا حصة API، وتراجع عند حدّ معدّل GitHub");
{ const w = await world(); await w.run(); const t1 = w.repo.calls.filter((c) => c === "tree").length;
  for (let i = 0; i < 5; i++) await w.run();
  ok("[E8] الحالة المستقرة: الرأس نفسه ⇒ لا قراءة شجرة ولا حصة API (طلب الرأس فقط) ولا صفوف تشغيل جديدة", w.repo.calls.filter((c) => c === "tree").length === t1 && (await w.db.get("SELECT COUNT(*) n FROM sync_runs")).n === 1, { trees: w.repo.calls.filter((c) => c === "tree").length });
  const idle = await w.run(); ok("[E9] تشغيل الخمول يعيد idle=true", idle.ok && idle.idle === true && idle.planned === 0);
  await seed(w.kv, "ui", "r-9", { "index.html": PAGE("x"), "assets/js/data.js": PRODUCTS([]) }); const dr = await w.run();
  ok("[E10] انحراف البيان يوقظ المسار الكامل رغم أن الرأس لم يتغيّر", dr.ok && !dr.idle && dr.diffs >= 3 && (await w.get("assets/js/data.js")).t.includes("عسل السدر"), dr);
  await w.repo.commit("تغيير", { "assets/data/theme.json": JSON.stringify({ a: 1 }) }); const od = w.repo.tree.bind(w.repo); w.repo.tree = async () => { const e = new Error("source: trees → 429"); e.status = 429; e.retryAfterMs = 120000; throw e; };
  const rl = await w.run(); ok("[E11] 429 من GitHub: فشل واضح مع تراجع، ولا شيء يُفقد", !rl.ok && rl.rateLimited && /تراجع/.test(rl.error), rl);
  const callsBefore = w.repo.calls.length; const sk = await w.run(); ok("[E12] أثناء التراجع لا طلبات إلى GitHub إطلاقاً (لا إلحاح)", sk.skipped === "backoff" && w.repo.calls.length === callsBefore, sk);
  w.repo.tree = od; await meta.set(w.db, "backoff_until", 0); const rec = await w.run(); ok("[E13] بعد انتهاء التراجع تصل التغييرات", rec.ok && (await w.get("assets/data/theme.json")).t.includes('"a": 1') || JSON.parse((await w.get("assets/data/theme.json")).t).a === 1, rec);
  w.db.close(); }

sec("F) حواجز الشيفرة");
{ const src = ["engine.js", "rules.js", "github.js", "targets.js", "worker.js", "db.js"].map((f) => readFileSync(path.join(HERE, "../src", f), "utf8")).join("\n");
  ok("[F1] لا رمز كتابة إلى المصدر: كل طلبات GitHub GET (لا PUT/POST/PATCH/DELETE إلى github)", !/method:\s*"(PUT|POST|PATCH|DELETE)"[^}]*github/i.test(src) && !/api\.github\.com[^`'"]*\/(contents|git\/refs|git\/commits)/.test(src.replace(/git\/trees|compare/g, "")));
  ok("[F2] لا مفاتيح Production ولا مضيفات في الشيفرة (تُقرأ من السجل وقت التشغيل)", !/qvdaiundlkfbmjlummni|alyssumhub\.fyi|1dffae72b40ca6558da19b84eff8c864|sb_publishable_1Zt/.test(src.replace(/productionAccounts = \["1dffae72b40ca6558da19b84eff8c864"\]/, "")));
  ok("[F3] الـWorker يرفض العمل خارج ENVIRONMENT=beta", /ENVIRONMENT !== "beta"/.test(src));
  ok("[F4] مسارات HTTP الحسّاسة تتطلب رمزاً (مقارنة ثابتة الزمن)", /tokEq/.test(src) && /unauthorized/.test(src)); }

rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `\n✗ ${bad} فاشل من ${n}` : `\n✓ ${n} فحصاً ناجحاً`); process.exit(bad ? 1 : 0);
