/* اختبار سلامة مكتبة القوالب (بلا متصفح): node scripts/test-templates.js
   يتحقق: وجود كل قالب في index.json وملفه ومعاينتيه، صياغة JSON، تفعيل demo،
   وجود كل صور assets/img/tpl المشار إليها، عدم تكرار صورة منتج داخل بطاقات المعاينة،
   وتنوّع الأسئلة الشائعة بين القوالب (حارس ضد طفرة المشاركة بالمرجع). */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const TPL = path.join(ROOT, "assets/pages/templates");
let fails = 0;
const bad = (id, msg) => { fails++; console.error(`::error::[${id}] ${msg}`); };

const idx = JSON.parse(fs.readFileSync(path.join(TPL, "index.json"), "utf8"));
const ids = idx.map(x => x.id);
if (!ids.length) bad("index", "index.json فارغ");

// 1) كل قالب في الفهرس: ملف موجود، صياغة سليمة، demo مفعّل، معاينتان موجودتان
const faqSets = {}; // signature -> [ids]
for (const id of ids) {
  const fp = path.join(TPL, id + ".json");
  if (!fs.existsSync(fp)) { bad(id, "ملف القالب مفقود"); continue; }
  let pg;
  try { pg = JSON.parse(fs.readFileSync(fp, "utf8")); } catch (e) { bad(id, "JSON غير صالح: " + e.message); continue; }
  // demo إلزامية فقط إذا وُجدت بيانات معاينة مضمّنة في ودجت منتجات (وإلا عُرضت فارغة)؛
  // القوالب بلا بيانات demo تعرض كتالوج المتجر الحي (مثل s-alyssum) وهذا مقصود.
  let hasDemoData = false;
  (function scan(o) {
    if (Array.isArray(o)) return o.forEach(scan);
    if (!o || typeof o !== "object") return;
    if (o.type === "products" && o.set && Array.isArray(o.set.demo) && o.set.demo.length) hasDemoData = true;
    Object.values(o).forEach(scan);
  })(pg.sections || []);
  if (hasDemoData && !pg.demo) bad(id, "بيانات معاينة مضمّنة لكن خاصية demo غير مفعّلة — المعاينة ستظهر فارغة");
  for (const suf of [".jpg", "-full.jpg"]) {
    const th = path.join(TPL, "thumbs", id + suf);
    if (!fs.existsSync(th)) bad(id, "المعاينة المصغّرة مفقودة: thumbs/" + id + suf);
  }

  // 2) كل صور tpl المشار إليها موجودة على القرص
  const refs = new Set();
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") return Object.values(o).forEach(walk);
    if (typeof o === "string") {
      const m = o.match(/assets\/img\/tpl\/[\w.-]+\.(?:webp|jpg|png)/g);
      if (m) m.forEach(x => refs.add(x));
    }
  })(pg);
  for (const r of refs) {
    if (!fs.existsSync(path.join(ROOT, r))) bad(id, "صورة مفقودة: " + r);
  }

  // 3) لا تكرار لصورة بين منتجات المعاينة داخل القالب الواحد
  (function walkWidgets(o) {
    if (Array.isArray(o)) return o.forEach(walkWidgets);
    if (!o || typeof o !== "object") return;
    if (o.type === "products" && o.set && Array.isArray(o.set.demo)) {
      const seen = {};
      for (const p of o.set.demo) {
        if (!p || !p.i) continue;
        if (seen[p.i]) bad(id, `صورة منتج مكرّرة في بطاقات المعاينة: ${p.i} («${seen[p.i]}» و«${p.t}»)`);
        else seen[p.i] = p.t;
      }
    }
    Object.values(o).forEach(walkWidgets);
  })(pg.sections || []);

  // 4) بصمة الأسئلة الشائعة
  (function walkAcc(o) {
    if (Array.isArray(o)) return o.forEach(walkAcc);
    if (!o || typeof o !== "object") return;
    if (o.type === "accordion" && o.set && Array.isArray(o.set.items) && o.set.items.length) {
      const sig = o.set.items.map(x => x.q).join("|");
      (faqSets[sig] = faqSets[sig] || []).push(id);
    }
    Object.values(o).forEach(walkAcc);
  })(pg.sections || []);
}

// 5) تنوّع الأسئلة الشائعة: لا يجوز أن تتشارك أغلب القوالب المجموعة نفسها (طفرة FAQ المشتركة 2026-11)
const entries = Object.entries(faqSets).sort((a, b) => b[1].length - a[1].length);
if (entries.length && entries[0][1].length > Math.max(3, Math.floor(ids.length / 3)))
  bad("faq", `مجموعة أسئلة واحدة مشتركة بين ${entries[0][1].length} قالباً (${entries[0][1].join(", ")}) — اشتباه طفرة مشاركة بالمرجع`);
if (entries.length < 8) bad("faq", `تنوّع أسئلة شائعة ضعيف: ${entries.length} مجموعات فقط لـ${ids.length} قالباً`);

// 6) جلود المنتجات prod-*.json: صياغة سليمة
for (const f of fs.readdirSync(TPL).filter(x => x.startsWith("prod-") && x.endsWith(".json"))) {
  try { JSON.parse(fs.readFileSync(path.join(TPL, f), "utf8")); }
  catch (e) { bad(f, "JSON غير صالح: " + e.message); }
}

console.log(fails ? `فشل: ${fails} خطأ` : `نجح: ${ids.length} قالباً، ${entries.length} مجموعة أسئلة، كل الصور والمعاينات موجودة`);
process.exit(fails ? 1 : 0);