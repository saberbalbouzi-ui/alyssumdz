/* مُشغِّل المتجر الحقيقي للمعاينة الفضائية (المرحلة 8): يبني «نسخة PHP» النظيفة من الشيفرة الحقيقية للمتجر ولوحة التحكم (make-template)،
   يثبّتها على خادم php محلي، وينسخ المعاينة الفضائية داخلها (نفس الأصل origin كي تُدمج لوحة التحكم الحقيقية في الألواح دون تعديل أي ملف إنتاج)،
   ثم يُنشئ طلبات عبر مسار الطلب الحقيقي نفسه (POST /api/index.php?r=order) ويغيّر حالاتها عبر واجهة اللوحة (order_update).
   القاعدة معزولة ومؤقتة (SQLite داخل مجلد مؤقت) — لا اتصال بأي قاعدة إنتاج ولا مفاتيح ولا Supabase.
   الاستعمال:  const { startStore } = require("./harness");  const s = await startStore();  ...  s.stop(); */
const { spawn, spawnSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..", "..", "..");
const PW = "TestPass12345";
const ORDERS = [ /* طلبات بصيغة طلب المتجر الحقيقي: الاسم/الهاتف/الولاية/البلدية/نوع التوصيل/العناصر/الرسم/الإجمالي */
  { name: "ليلى بن عمر", phone: "0550123456", wilaya: "الجزائر", commune: "باب الزوار", dtype: "home", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 2, price: 3200 }], fee: 400, status: "nouvelle" },
  { name: "أمينة بوزيد", phone: "0661223344", wilaya: "وهران", commune: "بئر الجير", dtype: "home", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], fee: 600, status: "nouvelle" },
  { name: "سلمى قاسمي", phone: "0770554102", wilaya: "قسنطينة", commune: "الخروب", dtype: "stop", desk: "مكتب قسنطينة المركز", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 1, price: 3200 }, { slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], fee: 450, status: "confirmee" },
  { name: "ريم فلاح", phone: "0555908070", wilaya: "سطيف", commune: "العلمة", dtype: "home", items: [{ slug: "huile-a-barbe", title: "زيت اللحية الفاخر", qty: 1, price: 2100 }], fee: 550, status: "confirmee" },
  { name: "كريم مرابط", phone: "0699107785", wilaya: "عنابة", commune: "البوني", dtype: "home", items: [{ slug: "pack4", title: "باقة العناية الأربعة", qty: 1, price: 4900 }], fee: 600, status: "expediee" },
  { name: "نور الدين حداد", phone: "0540332167", wilaya: "تيزي وزو", commune: "عزازقة", dtype: "stop", desk: "مكتب تيزي وزو", items: [{ slug: "memory-drops", title: "قطرات الذاكرة", qty: 3, price: 1500 }], fee: 450, status: "expediee" },
  { name: "سعاد بلقاسم", phone: "0662804519", wilaya: "تلمسان", commune: "مغنية", dtype: "home", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 3, price: 3200 }], fee: 700, status: "livree" },
  { name: "هشام عمراني", phone: "0553770912", wilaya: "بجاية", commune: "أقبو", dtype: "home", items: [{ slug: "tarkiz", title: "قطرات التركيز", qty: 2, price: 1800 }], fee: 550, status: "livree" },
  { name: "وفاء شريف", phone: "0770331289", wilaya: "الجزائر", commune: "الحراش", dtype: "home", items: [{ slug: "huile-a-barbe", title: "زيت اللحية الفاخر", qty: 2, price: 2100 }], fee: 400, status: "annulee" },
  { name: "يوسف زروقي", phone: "0661998877", wilaya: "باتنة", commune: "عين التوتة", dtype: "stop", desk: "مكتب باتنة", items: [{ slug: "pack4", title: "باقة العناية الأربعة", qty: 1, price: 4900 }], fee: 450, status: "nouvelle" },
  { name: "إيمان سعدي", phone: "0550441290", wilaya: "البليدة", commune: "بوفاريك", dtype: "home", items: [{ slug: "memory-drops", title: "قطرات الذاكرة", qty: 1, price: 1500 }, { slug: "tarkiz", title: "قطرات التركيز", qty: 1, price: 1800 }], fee: 450, status: "confirmee" },
  { name: "طارق بن علي", phone: "0699220031", wilaya: "ورقلة", commune: "حاسي مسعود", dtype: "home", items: [{ slug: "miel-sidr", title: "عسل السدر الجبلي 500غ", qty: 1, price: 3200 }], fee: 900, status: "echec" },
];
const J = (base, route, body, cookie) => fetch(base + "/api/index.php?r=" + route, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });

async function startStore(opts = {}) {
  const port = opts.port || 8100 + Math.floor(Math.random() * 400), out = path.join(ROOT, "dist", "spatial-test-" + port), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spatial-store-"));
  fs.rmSync(out, { recursive: true, force: true });
  const b = spawnSync("python3", ["scripts/make-template.py", "--target", "php", "--out", "dist/spatial-test-" + port, "--name", "Mystore", "--wa", "213000000000", "--kind", "physical"], { cwd: ROOT, encoding: "utf8" });
  const code = (/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/.exec(b.stdout) || [])[1]; if (!code) throw new Error("تعذّر بناء حزمة المتجر: " + (b.stdout + b.stderr).slice(-300));
  fs.cpSync(out, tmp, { recursive: true }); fs.rmSync(out, { recursive: true, force: true });
  /* المعاينة الفضائية داخل نفس الأصل (بلا اختبارات/تسجيلات) */
  const dst = path.join(tmp, "admin-preview", "spatial-os"); fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "admin-preview", "spatial-os"))) { if (["test", "compare", "recordings"].includes(f)) continue; fs.cpSync(path.join(ROOT, "admin-preview", "spatial-os", f), path.join(dst, f), { recursive: true }); }
  const php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", tmp], { stdio: "ignore" });
  const stop = () => { try { php.kill(); } catch (e) { } fs.rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", stop);
  await new Promise(r => setTimeout(r, 1500));
  const base = "http://127.0.0.1:" + port;
  const inst = await (await fetch(base + "/install.php", { method: "POST", body: new URLSearchParams({ code, pw: PW, pw2: PW, name: "Mystore", wa: "213000000000" }) })).text();
  if (!/تم التثبيت/.test(inst)) { stop(); throw new Error("فشل تثبيت المتجر المحلي"); }
  /* طلبات حقيقية عبر مسار الطلب العام ثم حالاتها عبر واجهة اللوحة */
  const lg = await J(base, "login", { password: PW }), cookie = (lg.headers.getSetCookie ? lg.headers.getSetCookie() : []).map(c => c.split(";")[0]).join("; ");
  /* المرحلة 9 (opts.stock): منتجات بمخزون محدود تطابق عناصر الطلبات، تُكتب عبر مسار الملفات الحقيقي (PUT assets/js/data.js)، مع بداية مخزون قديمة كي يعمل منطق المخزون الحالي */
  if (opts.stock) {
    await J(base, "kv", { k: "stockcfg", v: { since: "2020-01-01T00:00:00.000Z" } }, cookie);
    const f = await (await fetch(base + "/api/index.php?r=file&path=assets/js/data.js", { headers: { "X-Requested-With": "XMLHttpRequest", Cookie: cookie } })).json();
    const raw = Buffer.from(f.content, "base64").toString("utf8"), ip = raw.indexOf("var PRODUCTS = "), ic = raw.indexOf("var CATEGORIES = "), old = { c: JSON.parse(raw.slice(ic + 17, raw.lastIndexOf(";\n", ip))), p: JSON.parse(raw.slice(ip + 15, raw.lastIndexOf(";"))) };
    const mk = (slug, title, price, stock) => ({ slug, title, price, old: Math.round(price * 1.3), images: ["assets/img/demo/0.svg"], desc: title, cat: "general", active: true, stock, seoTitle: "", seoDesc: "", offers: [{ qty: 1, price }] });
    const P = old.p.concat([mk("miel-sidr", "عسل السدر الجبلي 500غ", 3200, 40), mk("tarkiz", "قطرات التركيز", 1800, 30), mk("huile-a-barbe", "زيت اللحية الفاخر", 2100, 25), mk("pack4", "باقة العناية الأربعة", 4900, 20), mk("memory-drops", "قطرات الذاكرة", 1500, 35)]);
    const txt = "var CATEGORIES = " + JSON.stringify(old.c) + ";\nvar PRODUCTS = " + JSON.stringify(P) + ";\n";
    const r = await fetch(base + "/api/index.php?r=file", { method: "PUT", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", Cookie: cookie }, body: JSON.stringify({ path: "assets/js/data.js", content: Buffer.from(txt, "utf8").toString("base64"), sha: f.sha, message: "seed" }) });
    if (!r.ok) { stop(); throw new Error("فشل بذر المنتجات: " + r.status); }
  }
  const ids = [];
  let seeded = 0;
  for (const o of (opts.orders || ORDERS)) {
    /* حدّ الطلب العام: 20 طلباً/ساعة لكل IP؛ ما زاد يُضاف عبر مسار «طلب يدوي» الحقيقي لمدير اللوحة */
    const manual = seeded++ >= 19, subtotal = o.items.reduce((a, i) => a + i.price * i.qty, 0), r = await (await J(base, "order", { order: Object.assign({ name: o.name, phone: o.phone, wilaya: o.wilaya, commune: o.commune, dtype: o.dtype, desk: o.desk || "", items: o.items, subtotal, fee: o.fee, total: subtotal + o.fee }, manual ? { manual: true } : {}) }, manual ? cookie : undefined)).json();
    if (!r.ok) { stop(); throw new Error("رُفض طلب البذر: " + JSON.stringify(r)); } ids.push({ id: r.id, status: o.status, name: o.name, total: subtotal + o.fee });
    if (o.status !== "nouvelle") await J(base, "order_update", { id: r.id, status: o.status }, cookie);
  }
  return { base, port, pw: PW, ids, stop, spatial: base + "/admin-preview/spatial-os/index.html", cookie };
}
module.exports = { startStore, PW, ORDERS };
